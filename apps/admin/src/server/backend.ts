import { getServerConfig } from './config';
import { toSessionTokens, type TokenPair } from './tokens';
import type { RefreshResult } from './refresh-coordinator';

export type BackendResult =
  | { ok: true; status: number; body: unknown; retryAfterSeconds?: number }
  | { ok: false; kind: 'network' | 'timeout' };

export interface BackendRequest {
  method: string;
  path: string;
  query?: URLSearchParams;
  body?: unknown;
  accessToken?: string;
  requestId: string;
  locale: string;
}

const MAX_RETRY_AFTER_SECONDS = 300;

/** Retry-After as seconds (delta or HTTP date), capped. Undefined when absent or invalid. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  const seconds = /^\d+$/.test(trimmed)
    ? Number(trimmed)
    : Math.ceil((Date.parse(trimmed) - now) / 1000);
  if (!Number.isFinite(seconds)) return undefined;
  return Math.min(Math.max(seconds, 0), MAX_RETRY_AFTER_SECONDS);
}

const failureKind = (error: unknown): 'network' | 'timeout' =>
  error instanceof DOMException && error.name === 'TimeoutError' ? 'timeout' : 'network';

/**
 * One call to the Nest API. Never retries: a write may already have been applied.
 * The timeout and error handling cover the whole exchange, including reading the body:
 * a connection that drops after the headers arrive is a network failure, not a crash.
 */
export async function callBackend(request: BackendRequest): Promise<BackendResult> {
  const { API_BASE_URL, BACKEND_TIMEOUT_MS } = getServerConfig();
  const url = new URL(`/api${request.path}`, API_BASE_URL);
  if (request.query) url.search = request.query.toString();

  const headers = new Headers({
    accept: 'application/json',
    'accept-language': request.locale,
    'x-request-id': request.requestId,
  });
  if (request.accessToken) headers.set('authorization', `Bearer ${request.accessToken}`);
  if (request.body !== undefined) headers.set('content-type', 'application/json');

  let status: number;
  let text: string;
  let retryAfterSeconds: number | undefined;
  try {
    const response = await fetch(url, {
      method: request.method,
      headers,
      ...(request.body !== undefined && { body: JSON.stringify(request.body) }),
      cache: 'no-store',
      signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
    });
    status = response.status;
    retryAfterSeconds = parseRetryAfter(response.headers?.get('retry-after') ?? null);
    text = status === 204 ? '' : await response.text();
  } catch (error) {
    return { ok: false, kind: failureKind(error) };
  }

  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    // Keep the raw text; the normalizer treats it as an unexpected body.
  }
  return {
    ok: true,
    status,
    body,
    ...(retryAfterSeconds !== undefined && { retryAfterSeconds }),
  };
}

const readTokenPair = (body: unknown): TokenPair | undefined => {
  const data = (body as { data?: Partial<TokenPair> } | undefined)?.data;
  return typeof data?.accessToken === 'string' && typeof data.refreshToken === 'string'
    ? { accessToken: data.accessToken, refreshToken: data.refreshToken }
    : undefined;
};

/**
 * Rotate the refresh token. Only a confirmed authentication rejection (401) ends the
 * session. Everything else keeps it:
 *  - network, timeout, 5xx and 429 are temporary (`unavailable`, honouring Retry-After);
 *  - any other response, including a 200 without tokens, is unexpected (`failed`).
 */
export async function rotateAtBackend(
  refreshToken: string,
  requestId: string,
  locale: string,
): Promise<RefreshResult> {
  const result = await callBackend({
    method: 'POST',
    path: '/auth/refresh-token',
    body: { token: refreshToken },
    requestId,
    locale,
  });
  if (!result.ok) return { type: 'unavailable' };
  if (result.status === 200) {
    const pair = readTokenPair(result.body);
    const tokens = pair && toSessionTokens(pair);
    return tokens ? { type: 'rotated', tokens } : { type: 'failed' };
  }
  if (result.status === 401) return { type: 'rejected' };
  if (result.status === 429 || result.status >= 500) {
    return {
      type: 'unavailable',
      ...(result.retryAfterSeconds !== undefined && {
        retryAfterSeconds: result.retryAfterSeconds,
      }),
    };
  }
  return { type: 'failed' };
}

export { readTokenPair };
