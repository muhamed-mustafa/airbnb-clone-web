import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import type { BackendResult } from './backend';
import { RefreshCoordinator, type RefreshResult } from './refresh-coordinator';
import { readSessionValue, sealSession, type SealedSession, type SessionData } from './session';
import { callWithSession } from './session-call';
import { deferred, fakeTokens } from './test-helpers';

const NOW = 1_000_000;
const ok = (status = 200, body: unknown = { data: [] }): BackendResult => ({
  ok: true,
  status,
  body,
});
const guard401: BackendResult = {
  ok: true,
  status: 401,
  body: { code: 'INVALID_TOKEN', message: 'Invalid token' },
};

function setup(options: {
  accessExp: number;
  rotate?: (token: string) => Promise<RefreshResult>;
  seal?: (data: SessionData) => Promise<SealedSession>;
}) {
  const coordinator = new RefreshCoordinator({ now: () => NOW * 1000 });
  const session: SessionData = {
    ...fakeTokens(1, options.accessExp),
    sid: 'sid-1',
    subject: { id: 'admin-1', role: 'admin' },
  };
  const rotate = vi.fn(
    options.rotate ??
      (async (): Promise<RefreshResult> => ({ type: 'rotated', tokens: fakeTokens(2, NOW + 900) })),
  );
  const call = (run: (token: string) => Promise<BackendResult>) =>
    callWithSession(
      new NextRequest('http://admin.test/bff/api/countries', {
        headers: { cookie: 'admin_session=sealed' },
      }),
      'req-1',
      run,
      {
        coordinator,
        readSession: async () => session,
        rotate,
        nowSeconds: () => NOW,
        skewSeconds: 30,
        seal: options.seal ?? sealSession,
      },
    );
  return { coordinator, session, rotate, call };
}

async function cookieAfterCommit(commit: (response: NextResponse) => Promise<NextResponse>) {
  const response = await commit(NextResponse.json({}));
  const cookie = response.cookies.get('admin_session');
  return { cookie, data: await readSessionValue(cookie?.value || undefined) };
}

describe('callWithSession', () => {
  it('does not touch the cookie when no refresh was needed', async () => {
    const { call, rotate } = setup({ accessExp: NOW + 600 });
    const result = await call(async () => ok());
    expect(result.outcome.type).toBe('upstream');
    expect(rotate).not.toHaveBeenCalled();
    expect((await cookieAfterCommit(result.commit)).cookie).toBeUndefined();
  });

  it('refreshes once for concurrent requests near expiry and writes the same new tokens', async () => {
    const pending = deferred<RefreshResult>();
    const next = fakeTokens(2, NOW + 900);
    const { call, rotate } = setup({ accessExp: NOW + 10, rotate: () => pending.promise });
    const run = vi.fn(async () => ok());

    const calls = Array.from({ length: 4 }, () => call(run));
    pending.resolve({ type: 'rotated', tokens: next });
    const results = await Promise.all(calls);

    expect(rotate).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(4);
    for (const result of results) {
      expect((await cookieAfterCommit(result.commit)).data?.refreshToken).toBe(next.refreshToken);
    }
  });

  it('after a guard 401, refreshes and replays a write exactly once', async () => {
    const { call, rotate } = setup({ accessExp: NOW + 600 });
    const run = vi
      .fn<(token: string) => Promise<BackendResult>>()
      .mockResolvedValueOnce(guard401)
      .mockResolvedValueOnce(ok(201, { data: { id: 'x' } }));

    const result = await call(run);
    expect(rotate).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(2);
    expect(result.outcome).toMatchObject({ type: 'upstream', result: { status: 201 } });
  });

  it('never replays after a network error or timeout', async () => {
    const { call, rotate } = setup({ accessExp: NOW + 600 });
    const run = vi.fn(async (): Promise<BackendResult> => ({ ok: false, kind: 'timeout' }));
    const result = await call(run);
    expect(run).toHaveBeenCalledTimes(1);
    expect(rotate).not.toHaveBeenCalled();
    expect(result.outcome).toMatchObject({
      type: 'upstream',
      result: { ok: false, kind: 'timeout' },
    });
  });

  it('does not retry a business 401 such as wrong credentials', async () => {
    const { call, rotate } = setup({ accessExp: NOW + 600 });
    const run = vi.fn(async () => ok(401, { code: 'INVALID_CREDENTIALS', message: 'x' }));
    await call(run);
    expect(run).toHaveBeenCalledTimes(1);
    expect(rotate).not.toHaveBeenCalled();
  });

  it('keeps the session when refresh fails on the network', async () => {
    const { call } = setup({ accessExp: NOW + 10, rotate: async () => ({ type: 'unavailable' }) });
    const result = await call(async () => ok());
    expect(result.outcome.type).toBe('refresh_unavailable');
    expect((await cookieAfterCommit(result.commit)).cookie).toBeUndefined();
  });

  it('expires the session when the backend rejects the refresh token', async () => {
    const { call } = setup({ accessExp: NOW + 10, rotate: async () => ({ type: 'rejected' }) });
    const result = await call(async () => ok());
    expect(result.outcome.type).toBe('expired');
    const { cookie } = await cookieAfterCommit(result.commit);
    expect(cookie?.value).toBe('');
  });

  it('expires instead of looping when the guard still rejects after a refresh', async () => {
    const { call, rotate } = setup({ accessExp: NOW + 600 });
    const run = vi.fn(async () => guard401);
    const result = await call(run);
    expect(rotate).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(2);
    expect(result.outcome.type).toBe('expired');
  });

  it('does not write the cookie when logout happens during the refresh', async () => {
    const pending = deferred<RefreshResult>();
    const { call, coordinator, session } = setup({
      accessExp: NOW + 10,
      rotate: () => pending.promise,
    });
    const running = call(async () => ok());

    coordinator.revoke(session.sid, session.refreshExp);
    pending.resolve({ type: 'rotated', tokens: fakeTokens(2, NOW + 900) });
    const result = await running;

    expect(result.outcome.type).toBe('expired');
    const { cookie, data } = await cookieAfterCommit(result.commit);
    expect(cookie?.value).toBe('');
    expect(data).toBeUndefined();
  });

  it('does not write the cookie when logout lands after the backend call but before commit', async () => {
    const { call, coordinator, session } = setup({ accessExp: NOW + 10 });
    const result = await call(async () => ok());
    coordinator.revoke(session.sid, session.refreshExp);
    const { cookie } = await cookieAfterCommit(result.commit);
    expect(cookie?.value).toBe('');
  });

  it('rejects any request that carries a logged-out session id', async () => {
    const { call, coordinator, session } = setup({ accessExp: NOW + 600 });
    coordinator.revoke(session.sid, session.refreshExp);
    const run = vi.fn(async () => ok());
    const result = await call(run);
    expect(run).not.toHaveBeenCalled();
    expect(result.outcome.type).toBe('expired');
  });

  it('does not write the cookie when logout happens while the cookie is being sealed', async () => {
    const sealing = deferred<void>();
    let sealStarted!: () => void;
    const started = new Promise<void>((done) => (sealStarted = done));
    const { call, coordinator, session } = setup({
      accessExp: NOW + 10,
      seal: async (data) => {
        sealStarted();
        await sealing.promise; // paused mid-encryption
        return sealSession(data);
      },
    });
    const result = await call(async () => ok());
    expect(result.outcome.type).toBe('upstream');

    const committing = cookieAfterCommit(result.commit);
    await started;
    coordinator.revoke(session.sid, session.refreshExp); // logout lands during sealing
    sealing.resolve();

    const { cookie, data } = await committing;
    expect(cookie?.value).toBe('');
    expect(data).toBeUndefined();
  });

  it('keeps the session and reports Retry-After when refresh is rate limited', async () => {
    const { call } = setup({
      accessExp: NOW + 10,
      rotate: async () => ({ type: 'unavailable', retryAfterSeconds: 20 }),
    });
    const result = await call(async () => ok());
    expect(result.outcome).toEqual({ type: 'refresh_unavailable', retryAfterSeconds: 20 });
    expect((await cookieAfterCommit(result.commit)).cookie).toBeUndefined();
  });

  it('keeps the session when refresh returns an unexpected response', async () => {
    const { call } = setup({ accessExp: NOW + 10, rotate: async () => ({ type: 'failed' }) });
    const result = await call(async () => ok());
    expect(result.outcome).toEqual({ type: 'refresh_failed' });
    expect((await cookieAfterCommit(result.commit)).cookie).toBeUndefined();
  });
});
