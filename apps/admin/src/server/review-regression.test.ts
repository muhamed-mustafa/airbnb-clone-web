// Regression tests from the phase 1 review, kept as written by the reviewer (only the
// `typeof import()` annotation became a type import, for the lint rules).
// They failed before the fixes (logout during sealing, body read failure, 429 on refresh).
import type * as IronSession from 'iron-session';
import { NextRequest, NextResponse } from 'next/server';
import { afterEach, expect, it, vi } from 'vitest';
import { callBackend, rotateAtBackend } from './backend';
import { RefreshCoordinator } from './refresh-coordinator';
import { callWithSession } from './session-call';
import { fakeTokens } from './test-helpers';

const hooks = vi.hoisted(() => ({ duringSeal: () => {} }));
vi.mock('iron-session', async (original) => ({
  ...(await original<typeof IronSession>()),
  sealData: async () => {
    hooks.duringSeal();
    await Promise.resolve();
    return 'sealed-after-logout';
  },
}));
afterEach(() => {
  vi.unstubAllGlobals();
  hooks.duringSeal = () => {};
});

it('does not set a live cookie if logout occurs during sealing', async () => {
  const now = Math.floor(Date.now() / 1000);
  const coordinator = new RefreshCoordinator();
  const session = {
    ...fakeTokens(1, now + 10),
    sid: 'review-sid',
    subject: { id: 'admin-1', role: 'admin' as const },
  };
  const call = await callWithSession(
    new NextRequest('http://admin.test/bff/api/countries'),
    'review',
    async () => ({ ok: true, status: 200, body: {} }),
    {
      coordinator,
      readSession: async () => session,
      rotate: async () => ({ type: 'rotated', tokens: fakeTokens(2, now + 900) }),
      nowSeconds: () => now,
      skewSeconds: 30,
    },
  );
  hooks.duringSeal = () => coordinator.revoke(session.sid, session.refreshExp);
  const response = await call.commit(NextResponse.json({}));
  expect(response.cookies.get('admin_session')?.value ?? '').toBe('');
});

it('normalizes connection failure while reading response body', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      status: 200,
      text: async () => {
        throw new TypeError('terminated');
      },
    })),
  );
  await expect(
    callBackend({ method: 'GET', path: '/countries', requestId: 'review', locale: 'en' }),
  ).resolves.toEqual({ ok: false, kind: 'network' });
});

it('does not expire a session when refresh is rate limited', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 429 })),
  );
  await expect(rotateAtBackend('token', 'review', 'en')).resolves.toEqual({ type: 'unavailable' });
});
