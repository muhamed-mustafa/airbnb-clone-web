/**
 * CSRF check for state-changing BFF requests (session-error-contract §A6, OWASP
 * "Verifying Origin With Standard Headers" + Fetch Metadata).
 *
 * 1. Origin present: it must equal the configured app origin exactly. Nothing else can
 *    override a mismatching Origin.
 * 2. Origin absent: accept only `Sec-Fetch-Site: same-origin`.
 * 3. Neither present: reject.
 * 4. Requests that carry a body must declare `Content-Type: application/json`.
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export type CsrfVerdict = { ok: true } | { ok: false; reason: string };

export interface CsrfRequest {
  method: string;
  headers: Headers;
  hasBody: boolean;
}

export function checkCsrf(request: CsrfRequest, appOrigin: string): CsrfVerdict {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return { ok: true };

  const origin = request.headers.get('origin');
  if (origin !== null) {
    if (origin !== appOrigin) return { ok: false, reason: 'origin-mismatch' };
  } else if (request.headers.get('sec-fetch-site') !== 'same-origin') {
    return { ok: false, reason: 'no-origin-evidence' };
  }

  if (request.hasBody) {
    const contentType = request.headers.get('content-type') ?? '';
    if (!/^application\/json(\s*;|$)/i.test(contentType)) {
      return { ok: false, reason: 'content-type' };
    }
  }
  return { ok: true };
}
