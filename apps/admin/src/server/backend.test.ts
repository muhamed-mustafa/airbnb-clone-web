import { afterEach, describe, expect, it, vi } from 'vitest';
import { callBackend, parseRetryAfter, rotateAtBackend } from './backend';
import { fakeTokens } from './test-helpers';

afterEach(() => {
  vi.unstubAllGlobals();
});

const request = { method: 'GET', path: '/countries', requestId: 'req', locale: 'en' };
const respond = (status: number, body = '{}', headers: Record<string, string> = {}) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(body, { status, headers })),
  );

describe('callBackend', () => {
  it('turns a connection drop while reading the body into a network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 200,
        headers: new Headers(),
        text: async () => {
          throw new TypeError('terminated');
        },
      })),
    );
    await expect(callBackend(request)).resolves.toEqual({ ok: false, kind: 'network' });
  });

  it('turns a timeout while reading the body into a timeout failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 200,
        headers: new Headers(),
        text: async () => {
          throw new DOMException('The operation timed out.', 'TimeoutError');
        },
      })),
    );
    await expect(callBackend(request)).resolves.toEqual({ ok: false, kind: 'timeout' });
  });

  it('calls fetch exactly once, even for a failed write', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    vi.stubGlobal('fetch', fetchMock);
    await callBackend({ ...request, method: 'POST', body: { name: 'x' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reads Retry-After', async () => {
    respond(429, '{}', { 'retry-after': '12' });
    await expect(callBackend(request)).resolves.toMatchObject({
      status: 429,
      retryAfterSeconds: 12,
    });
  });
});

describe('rotateAtBackend', () => {
  const rotate = () => rotateAtBackend('refresh-token', 'req', 'en');

  it('expires only on a confirmed authentication rejection (401)', async () => {
    respond(401, '{"code":"INVALID_TOKEN","message":"Invalid token"}');
    await expect(rotate()).resolves.toEqual({ type: 'rejected' });
  });

  it('treats 429 as temporary and keeps Retry-After', async () => {
    respond(429, '{}', { 'retry-after': '30' });
    await expect(rotate()).resolves.toEqual({ type: 'unavailable', retryAfterSeconds: 30 });
  });

  it.each([500, 502, 503])('treats %i as temporary', async (status) => {
    respond(status);
    await expect(rotate()).resolves.toEqual({ type: 'unavailable' });
  });

  it('treats a network failure as temporary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('fetch failed'))),
    );
    await expect(rotate()).resolves.toEqual({ type: 'unavailable' });
  });

  it.each([400, 403, 404, 409])(
    'treats unexpected %i as a failure, not a logout',
    async (status) => {
      respond(status);
      await expect(rotate()).resolves.toEqual({ type: 'failed' });
    },
  );

  it('treats a 200 without tokens as a failure, not a logout', async () => {
    respond(200, '{"data":{}}');
    await expect(rotate()).resolves.toEqual({ type: 'failed' });
  });

  it('returns the new tokens on 200', async () => {
    const tokens = fakeTokens(2, 2_000_000_000);
    respond(
      200,
      JSON.stringify({
        data: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
      }),
    );
    await expect(rotate()).resolves.toEqual({ type: 'rotated', tokens });
  });
});

describe('parseRetryAfter', () => {
  const now = Date.parse('2026-10-06T00:00:00Z');
  it('reads seconds and HTTP dates, caps at 300 s and ignores garbage', () => {
    expect(parseRetryAfter('15', now)).toBe(15);
    expect(parseRetryAfter('Tue, 06 Oct 2026 00:00:20 GMT', now)).toBe(20);
    expect(parseRetryAfter('99999', now)).toBe(300);
    expect(parseRetryAfter('Mon, 05 Oct 2026 23:00:00 GMT', now)).toBe(0);
    expect(parseRetryAfter('soon', now)).toBeUndefined();
    expect(parseRetryAfter(null, now)).toBeUndefined();
  });
});
