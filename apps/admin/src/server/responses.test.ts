import { describe, expect, it } from 'vitest';
import { resolveUpstream } from './allowlist';
import { proxiedResponse } from './responses';

const ID = '670d1234567890abcdef1234';
const SHAPE = resolveUpstream('GET', ['admins'], new URLSearchParams())!.responseFields!;
const admin = { id: ID, name: 'Sara', email: 'sara@example.com', isSuperAdmin: false };
const meta = { page: 1, limit: 20, total: 1, totalPages: 1 };
// A synthetic marker, not a real hash: it must never appear in what the browser receives.
const SECRET = 'synthetic-secret-marker';

describe('proxiedResponse with the admin shape', () => {
  it.each([
    ['an empty item', { data: [{}], meta }],
    [
      'a missing email, with a leaked field',
      { data: [{ ...admin, email: undefined, password: SECRET }], meta },
    ],
    ['a wrong type', { data: [{ ...admin, isSuperAdmin: 'false', password: SECRET }], meta }],
    ['a broken detail', { data: { id: 1, name: 'Sara', password: SECRET } }],
    ['an unexpected body', { items: [{ ...admin, password: SECRET }] }],
    ['a non-JSON body', `password=${SECRET}`],
  ])('answers 502 without the raw body for %s', async (_label, body) => {
    const response = proxiedResponse({ status: 200, body }, 'req-1', SHAPE);
    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain('password');
    expect(text).not.toContain('Sara');
    expect(JSON.parse(text).error).toMatchObject({
      kind: 'server',
      status: 502,
      requestId: 'req-1',
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('rebuilds a valid list from the four fields, dropping password and extras', async () => {
    const response = proxiedResponse(
      { status: 200, body: { data: [{ ...admin, password: SECRET, extra: 1 }], meta } },
      'req-2',
      SHAPE,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [admin], meta });
  });

  it('rebuilds a valid detail', async () => {
    const response = proxiedResponse(
      { status: 200, body: { data: { ...admin, password: SECRET } } },
      'req-3',
      SHAPE,
    );
    expect(await response.json()).toEqual({ data: admin });
  });

  it('still normalizes backend errors (the shape applies to successes only)', async () => {
    const response = proxiedResponse(
      { status: 404, body: { statusCode: 404, message: 'Admin not found', error: 'Not Found' } },
      'req-4',
      SHAPE,
    );
    expect(response.status).toBe(404);
    expect((await response.json()).error.kind).toBe('not_found');
  });
});

describe('proxiedResponse without a shape', () => {
  it('passes success bodies through unchanged', async () => {
    const body = { data: [{ id: ID, name: 'Egypt', code: 'EG', anything: true }], meta };
    const response = proxiedResponse({ status: 200, body }, 'req-5');
    expect(await response.json()).toEqual(body);
  });
});
