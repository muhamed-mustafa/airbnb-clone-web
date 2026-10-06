import {
  createAppError,
  normalizeBackendError,
  type AppError,
  type AppErrorKind,
  type BffErrorBody,
} from '@stays/api-contract';
import { NextResponse } from 'next/server';
import { projectResponse, type ResponseShape } from './allowlist';

const STATUS_BY_KIND: Partial<Record<AppErrorKind, number>> = {
  session_expired: 401,
  csrf: 403,
  not_found: 404,
  session_refresh_unavailable: 503,
  network: 502,
  timeout: 504,
};

/** Every BFF response is private and must never be indexed or cached. */
export function privateHeaders(response: NextResponse): NextResponse {
  response.headers.set('cache-control', 'no-store');
  response.headers.set('x-robots-tag', 'noindex, nofollow');
  return response;
}

export function errorResponse(error: AppError): NextResponse {
  const status = error.status ?? STATUS_BY_KIND[error.kind] ?? 500;
  const body: BffErrorBody = { error: { ...error, status } };
  const response = NextResponse.json(body, { status });
  if (error.requestId) response.headers.set('x-request-id', error.requestId);
  return privateHeaders(response);
}

export function localError(
  kind: AppErrorKind,
  requestId: string,
  options: { status?: number; retryAfterSeconds?: number } = {},
): NextResponse {
  const response = errorResponse(
    createAppError(kind, {
      requestId,
      ...(options.status !== undefined && { status: options.status }),
    }),
  );
  if (options.retryAfterSeconds !== undefined) {
    response.headers.set('retry-after', String(options.retryAfterSeconds));
  }
  return response;
}

/** Response for a refresh that did not succeed but must not sign the user out. */
export function refreshProblemResponse(
  outcome: { type: 'refresh_unavailable'; retryAfterSeconds?: number } | { type: 'refresh_failed' },
  requestId: string,
): NextResponse {
  return outcome.type === 'refresh_failed'
    ? localError('server', requestId, { status: 502 })
    : localError('session_refresh_unavailable', requestId, {
        ...(outcome.retryAfterSeconds !== undefined && {
          retryAfterSeconds: outcome.retryAfterSeconds,
        }),
      });
}

/**
 * Response for a backend reply on an allowlisted route. With a response shape, success bodies
 * are rebuilt from the shape's fields only; anything that does not match it becomes a 502 and
 * the raw body never leaves the BFF (an unexpected shape could carry fields such as a hash).
 */
export function proxiedResponse(
  result: { status: number; body: unknown; retryAfterSeconds?: number },
  requestId: string,
  shape?: ResponseShape,
): NextResponse {
  if (shape && result.status >= 200 && result.status < 300) {
    const projected = projectResponse(result.body, shape);
    if (projected === undefined) return localError('server', requestId, { status: 502 });
    return backendResponse(result.status, projected, requestId);
  }
  return backendResponse(result.status, result.body, requestId, result.retryAfterSeconds);
}

/** Pass a backend response through: success bodies verbatim, errors normalized. */
export function backendResponse(
  status: number,
  body: unknown,
  requestId: string,
  retryAfterSeconds?: number,
): NextResponse {
  if (status >= 200 && status < 300) {
    const response =
      status === 204 || body === undefined
        ? new NextResponse(null, { status })
        : NextResponse.json(body, { status });
    response.headers.set('x-request-id', requestId);
    return privateHeaders(response);
  }
  const response = errorResponse(normalizeBackendError(status, body, requestId));
  if (retryAfterSeconds !== undefined)
    response.headers.set('retry-after', String(retryAfterSeconds));
  return response;
}
