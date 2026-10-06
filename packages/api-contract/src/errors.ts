/**
 * One error shape for the whole frontend (session-error-contract §B).
 *
 * The backend currently answers errors in four shapes (report D1):
 *   S1 { code, message }                                  ApplicationError
 *   S2 { errors: [{ code: 'ns.CODE', message, field? }] } HttpException
 *   S3 { errors: [{ code: 'minLength', field, message }] } validation
 *   S4 { errors: [{ message }] }                          500
 * normalizeBackendError accepts all of them, and also the unified shape the backend
 * plans to adopt (S2 for everything), so the two sides can ship independently.
 */

export type AppErrorKind =
  | 'validation'
  | 'invalid_credentials'
  | 'session_expired'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'csrf'
  | 'rate_limited'
  | 'server'
  | 'session_refresh_unavailable'
  | 'network'
  | 'timeout'
  | 'unknown';

export interface AppErrorItem {
  /** Always namespaced, e.g. `countries.COUNTRY_NOT_FOUND`, `validation.minLength`. */
  code: string;
  /** Backend text, kept for 4xx only. A fallback; the UI prefers its own catalog. */
  serverMessage?: string;
}

export interface AppError {
  kind: AppErrorKind;
  status?: number;
  /** Every error not tied to a field. A response can carry several. */
  formErrors: AppErrorItem[];
  fieldErrors: Record<string, AppErrorItem[]>;
  requestId?: string;
}

/** What the BFF sends to the browser for any non-2xx response. */
export interface BffErrorBody {
  error: AppError;
}

// Mirrors ERROR_CODES in airbnb-clone-api (src/common/errors/error-codes.ts). S1 responses
// carry the bare key; the namespaced value is what S2 responses and our catalog use.
const APPLICATION_ERROR_NAMESPACES: Record<string, string> = {
  INVALID_TOKEN: 'auth',
  INVALID_CREDENTIALS: 'auth',
  INVALID_PHONE_NUMBER: 'auth',
  USER_ALREADY_EXISTS: 'auth',
  USER_NOT_FOUND: 'auth',
  COUNTRY_ALREADY_EXISTS: 'countries',
  COUNTRY_NOT_FOUND: 'countries',
  CITY_ALREADY_EXISTS: 'cities',
  CITY_NOT_FOUND: 'cities',
  CURRENCY_ALREADY_EXISTS: 'currencies',
  CURRENCY_NOT_FOUND: 'currencies',
  UNIT_CATEGORY_ALREADY_EXISTS: 'unit-categories',
  UNIT_CATEGORY_NOT_FOUND: 'unit-categories',
  APP_SETTINGS_NOT_FOUND: 'app-settings',
  ADMIN_NOT_FOUND: 'admins',
};

const GENERIC_CODE_BY_KIND: Record<AppErrorKind, string> = {
  validation: 'errors.BAD_REQUEST',
  invalid_credentials: 'auth.INVALID_CREDENTIALS',
  session_expired: 'auth.SESSION_EXPIRED',
  forbidden: 'errors.FORBIDDEN',
  not_found: 'errors.NOT_FOUND',
  conflict: 'errors.CONFLICT',
  csrf: 'security.CSRF_REJECTED',
  rate_limited: 'errors.RATE_LIMITED',
  server: 'errors.INTERNAL_SERVER_ERROR',
  session_refresh_unavailable: 'auth.SESSION_REFRESH_UNAVAILABLE',
  network: 'errors.NETWORK',
  timeout: 'errors.TIMEOUT',
  unknown: 'errors.UNKNOWN',
};

interface RawItem {
  code?: unknown;
  message?: unknown;
  field?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined;

const namespaceCode = (code: string, hasField: boolean): string => {
  if (code.includes('.')) return code;
  const namespace = APPLICATION_ERROR_NAMESPACES[code];
  if (namespace) return `${namespace}.${code}`;
  // class-validator constraint names (minLength, isMongoId, whitelistValidation…)
  return hasField ? `validation.${code}` : `errors.${code}`;
};

const kindFromStatus = (status: number): AppErrorKind => {
  if (status === 400) return 'validation';
  if (status === 401) return 'session_expired';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'server';
  return 'unknown';
};

const readItems = (body: unknown): RawItem[] | undefined => {
  if (!isRecord(body)) return undefined;
  if (Array.isArray(body.errors)) return body.errors.filter(isRecord);
  if (asString(body.code)) return [body];
  return undefined;
};

export function createAppError(
  kind: AppErrorKind,
  options: { status?: number; requestId?: string; code?: string } = {},
): AppError {
  return {
    kind,
    ...(options.status !== undefined && { status: options.status }),
    formErrors: [{ code: options.code ?? GENERIC_CODE_BY_KIND[kind] }],
    fieldErrors: {},
    ...(options.requestId && { requestId: options.requestId }),
  };
}

/**
 * Normalize a non-2xx backend response.
 * `requestId` is the id the BFF sent upstream (the backend echoes it in x-request-id).
 */
export function normalizeBackendError(status: number, body: unknown, requestId?: string): AppError {
  let kind = kindFromStatus(status);
  const items = readItems(body);

  // 5xx and unrecognised bodies never surface backend text (contract §B).
  if (kind === 'server' || !items || items.length === 0) {
    return createAppError(kind, { status, ...(requestId && { requestId }) });
  }

  const keepText = status >= 400 && status < 500;
  const error: AppError = {
    kind,
    status,
    formErrors: [],
    fieldErrors: {},
    ...(requestId && { requestId }),
  };

  for (const item of items) {
    const field = asString(item.field);
    const rawCode = asString(item.code);
    const code = rawCode ? namespaceCode(rawCode, field !== undefined) : GENERIC_CODE_BY_KIND[kind];
    const serverMessage = keepText ? asString(item.message) : undefined;
    const entry: AppErrorItem = { code, ...(serverMessage && { serverMessage }) };

    if (field) {
      (error.fieldErrors[field] ??= []).push(entry);
    } else {
      error.formErrors.push(entry);
    }
  }

  if (status === 401 && error.formErrors.some((item) => item.code === 'auth.INVALID_CREDENTIALS')) {
    kind = 'invalid_credentials';
    error.kind = kind;
  }

  return error;
}

/**
 * True when a 401 came from the backend's JWT guard (missing, invalid or expired access
 * token) rather than from business logic. Only these may trigger a refresh and a single
 * replay, including for writes: the guard rejects before the handler runs.
 */
export function isAuthGuardRejection(status: number, body: unknown): boolean {
  if (status !== 401 || !isRecord(body)) return false;
  if (body.code === 'INVALID_TOKEN') return true;
  const first = Array.isArray(body.errors) ? body.errors[0] : undefined;
  return isRecord(first) && first.code === 'errors.UNAUTHORIZED';
}

export function isBffErrorBody(value: unknown): value is BffErrorBody {
  return (
    isRecord(value) &&
    isRecord(value.error) &&
    typeof value.error.kind === 'string' &&
    Array.isArray(value.error.formErrors) &&
    isRecord(value.error.fieldErrors)
  );
}
