import { createAppError, isBffErrorBody, type AppError } from '@stays/api-contract';

/** Thrown for every non-2xx BFF response and for failures to reach the BFF. */
export class BffError extends Error {
  constructor(readonly appError: AppError) {
    super(appError.kind);
    this.name = 'BffError';
  }
}

export const isBffError = (error: unknown): error is BffError => error instanceof BffError;

let onSessionExpired: (() => void) | undefined;

/** Registered once by the app providers: clears private caches and goes to /login. */
export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

interface BffRequest {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Calls the same-origin BFF. Tokens never reach this code: the session lives in an
 * HttpOnly cookie that only the BFF can read.
 */
export async function bffFetch<T>(path: string, request: BffRequest = {}): Promise<T> {
  const { method = 'GET', body, signal } = request;
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new BffError(createAppError('network'));
  }

  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => undefined);
  if (response.ok) return payload as T;

  const error = isBffErrorBody(payload)
    ? payload.error
    : createAppError('unknown', { status: response.status });
  if (error.kind === 'session_expired') onSessionExpired?.();
  throw new BffError(error);
}
