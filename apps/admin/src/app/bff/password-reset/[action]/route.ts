import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { callBackend } from '@/server/backend';
import { readJsonBody, rejectCrossSite, requestLocale } from '@/server/request';
import { backendResponse, localError, privateHeaders } from '@/server/responses';

const routes = {
  request: '/auth/admin/password-reset/request',
  verify: '/auth/admin/password-reset/verify',
  complete: '/auth/admin/password-reset/complete',
} as const;

export async function POST(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  const requestId = randomUUID();
  const rejected = rejectCrossSite(request, requestId, true);
  if (rejected) return rejected;

  const { action } = await context.params;
  if (!Object.hasOwn(routes, action)) return localError('not_found', requestId);
  const parsed = await readJsonBody(request, requestId);
  if ('response' in parsed) return parsed.response;
  if (!parsed.body || typeof parsed.body !== 'object' || Array.isArray(parsed.body)) {
    return localError('validation', requestId, { status: 400 });
  }

  const values = parsed.body as Record<string, unknown>;
  const body =
    action === 'request'
      ? { email: values.email }
      : action === 'verify'
        ? { email: values.email, code: values.code }
        : { resetToken: values.resetToken, newPassword: values.newPassword };
  const result = await callBackend({
    method: 'POST',
    path: routes[action as keyof typeof routes],
    body,
    requestId,
    locale: requestLocale(request),
  });
  if (!result.ok) return localError(result.kind, requestId);
  if (result.status < 200 || result.status >= 300)
    return backendResponse(result.status, result.body, requestId);

  if (action === 'verify') {
    const payload = result.body as { data?: { resetToken?: unknown } } | null;
    const resetToken = payload?.data?.resetToken;
    if (typeof resetToken !== 'string' || resetToken.length < 32)
      return localError('server', requestId, { status: 502 });
    return privateHeaders(
      NextResponse.json({ resetToken }, { headers: { 'x-request-id': requestId } }),
    );
  }
  return privateHeaders(
    new NextResponse(null, { status: 204, headers: { 'x-request-id': requestId } }),
  );
}
