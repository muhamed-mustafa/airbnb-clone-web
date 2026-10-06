import { describe, expect, it } from 'vitest';
import { isAuthGuardRejection, normalizeBackendError } from './errors';

// Bodies below are copied from real responses of airbnb-clone-api main@4d43d07.

describe('normalizeBackendError', () => {
  it('namespaces S1 application errors', () => {
    const error = normalizeBackendError(
      404,
      { code: 'COUNTRY_NOT_FOUND', message: 'الدولة غير موجودة.' },
      'req-1',
    );
    expect(error).toEqual({
      kind: 'not_found',
      status: 404,
      formErrors: [{ code: 'countries.COUNTRY_NOT_FOUND', serverMessage: 'الدولة غير موجودة.' }],
      fieldErrors: {},
      requestId: 'req-1',
    });
  });

  it('treats a 409 from create (S1, no field) as a form error', () => {
    const error = normalizeBackendError(409, {
      code: 'COUNTRY_ALREADY_EXISTS',
      message: 'Country already exists',
    });
    expect(error.kind).toBe('conflict');
    expect(error.formErrors).toEqual([
      { code: 'countries.COUNTRY_ALREADY_EXISTS', serverMessage: 'Country already exists' },
    ]);
    expect(error.fieldErrors).toEqual({});
  });

  it('attaches a 409 from update (S2 with field) to that field', () => {
    const error = normalizeBackendError(409, {
      errors: [{ code: 'countries.COUNTRY_ALREADY_EXISTS', message: 'exists', field: 'code' }],
    });
    expect(error.fieldErrors).toEqual({
      code: [{ code: 'countries.COUNTRY_ALREADY_EXISTS', serverMessage: 'exists' }],
    });
    expect(error.formErrors).toEqual([]);
  });

  it('groups S3 validation errors per field, keeping all of them', () => {
    const error = normalizeBackendError(400, {
      errors: [
        { code: 'isEmail', field: 'email', message: 'email must be an email' },
        { code: 'isNotEmpty', field: 'email', message: 'email should not be empty' },
        { code: 'isNotEmpty', field: 'password', message: 'password should not be empty' },
      ],
    });
    expect(error.kind).toBe('validation');
    expect(error.fieldErrors.email?.map((item) => item.code)).toEqual([
      'validation.isEmail',
      'validation.isNotEmpty',
    ]);
    expect(error.fieldErrors.password?.[0]?.code).toBe('validation.isNotEmpty');
  });

  it('keeps every general error when there are several without fields', () => {
    const error = normalizeBackendError(400, {
      errors: [{ code: 'errors.BAD_REQUEST' }, { code: 'errors.SOMETHING_ELSE' }],
    });
    expect(error.formErrors.map((item) => item.code)).toEqual([
      'errors.BAD_REQUEST',
      'errors.SOMETHING_ELSE',
    ]);
  });

  it('never exposes backend text for 5xx (S4)', () => {
    const error = normalizeBackendError(
      500,
      { errors: [{ message: 'Internal server error' }] },
      'r',
    );
    expect(error).toEqual({
      kind: 'server',
      status: 500,
      formErrors: [{ code: 'errors.INTERNAL_SERVER_ERROR' }],
      fieldErrors: {},
      requestId: 'r',
    });
  });

  it('maps unexpected bodies to a generic error without text', () => {
    expect(normalizeBackendError(502, '<html>Bad gateway</html>').formErrors).toEqual([
      { code: 'errors.INTERNAL_SERVER_ERROR' },
    ]);
    expect(normalizeBackendError(418, null)).toMatchObject({
      kind: 'unknown',
      formErrors: [{ code: 'errors.UNKNOWN' }],
    });
  });

  it('marks wrong login credentials as invalid_credentials, not session_expired', () => {
    const error = normalizeBackendError(401, {
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid credentials',
    });
    expect(error.kind).toBe('invalid_credentials');
    expect(error.formErrors[0]?.code).toBe('auth.INVALID_CREDENTIALS');
  });

  it('accepts the planned unified shape for every status', () => {
    const error = normalizeBackendError(404, {
      errors: [{ code: 'countries.COUNTRY_NOT_FOUND', message: 'Country not found.' }],
    });
    expect(error.formErrors[0]?.code).toBe('countries.COUNTRY_NOT_FOUND');
  });
});

describe('isAuthGuardRejection', () => {
  it('recognises both guard 401 shapes', () => {
    expect(isAuthGuardRejection(401, { code: 'INVALID_TOKEN', message: 'Invalid token' })).toBe(
      true,
    );
    expect(
      isAuthGuardRejection(401, {
        errors: [{ code: 'errors.UNAUTHORIZED', message: 'Unauthorized' }],
      }),
    ).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isAuthGuardRejection(401, { code: 'INVALID_CREDENTIALS' })).toBe(false);
    expect(isAuthGuardRejection(403, { errors: [{ code: 'errors.FORBIDDEN' }] })).toBe(false);
    expect(isAuthGuardRejection(401, 'Unauthorized')).toBe(false);
  });
});
