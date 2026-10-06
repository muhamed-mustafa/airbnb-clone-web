import { createAppError } from '@stays/api-contract';
import type { NextRequest, NextResponse } from 'next/server';
import { getServerConfig } from './config';
import { checkCsrf } from './csrf';
import { errorResponse, localError } from './responses';

export const requestLocale = (request: NextRequest): 'ar' | 'en' =>
  request.cookies.get('admin_locale')?.value === 'en' ? 'en' : 'ar';

/** Returns a rejection response, or undefined when the request may proceed. */
export function rejectCrossSite(
  request: NextRequest,
  requestId: string,
  hasBody: boolean,
): NextResponse | undefined {
  const verdict = checkCsrf(
    { method: request.method, headers: request.headers, hasBody },
    getServerConfig().APP_ORIGIN,
  );
  return verdict.ok ? undefined : localError('csrf', requestId);
}

export async function readJsonBody(
  request: NextRequest,
  requestId: string,
): Promise<{ body: unknown } | { response: NextResponse }> {
  try {
    return { body: await request.json() };
  } catch {
    return {
      response: errorResponse(
        createAppError('validation', { status: 400, requestId, code: 'errors.INVALID_JSON' }),
      ),
    };
  }
}
