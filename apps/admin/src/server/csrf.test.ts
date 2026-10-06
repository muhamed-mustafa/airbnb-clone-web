import { describe, expect, it } from 'vitest';
import { checkCsrf } from './csrf';

const APP = 'http://admin.test';
const check = (method: string, headers: Record<string, string>, hasBody = false) =>
  checkCsrf({ method, headers: new Headers(headers), hasBody }, APP);

describe('checkCsrf', () => {
  it('lets safe methods through', () => {
    expect(check('GET', {})).toEqual({ ok: true });
  });

  it('accepts a matching Origin', () => {
    expect(check('DELETE', { origin: APP })).toEqual({ ok: true });
  });

  it('rejects a mismatching Origin even when Sec-Fetch-Site claims same-origin', () => {
    expect(
      check('POST', { origin: 'http://evil.test', 'sec-fetch-site': 'same-origin' }, true),
    ).toEqual({
      ok: false,
      reason: 'origin-mismatch',
    });
  });

  it('rejects "null" Origin', () => {
    expect(check('POST', { origin: 'null' }, false).ok).toBe(false);
  });

  it('falls back to Sec-Fetch-Site only when Origin is absent', () => {
    expect(
      check('PATCH', { 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' }, true),
    ).toEqual({
      ok: true,
    });
    expect(check('PATCH', { 'sec-fetch-site': 'same-site' }, false).ok).toBe(false);
  });

  it('rejects when neither Origin nor Sec-Fetch-Site is present', () => {
    expect(check('DELETE', {})).toEqual({ ok: false, reason: 'no-origin-evidence' });
  });

  it('requires JSON only for requests with a body', () => {
    expect(check('POST', { origin: APP, 'content-type': 'text/plain' }, true)).toEqual({
      ok: false,
      reason: 'content-type',
    });
    expect(
      check('POST', { origin: APP, 'content-type': 'application/json; charset=utf-8' }, true),
    ).toEqual({
      ok: true,
    });
    expect(check('DELETE', { origin: APP }, false)).toEqual({ ok: true });
  });
});
