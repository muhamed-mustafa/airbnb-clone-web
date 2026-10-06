import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { callBackend, readTokenPair } from '@/server/backend';
import { getRefreshCoordinator } from '@/server/refresh-coordinator';
import { readJsonBody, rejectCrossSite, requestLocale } from '@/server/request';
import {
  backendResponse,
  localError,
  privateHeaders,
  refreshProblemResponse,
} from '@/server/responses';
import { callWithSession } from '@/server/session-call';
import { clearSessionCookie, readSession, writeSessionCookie } from '@/server/session';
import { readClaims, toSessionTokens } from '@/server/tokens';
import type { SessionStatus } from '@/features/auth/session-status';

/** Sign in: forwards credentials to POST /auth/admin/login and seals the tokens. */
export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  const rejected = rejectCrossSite(request, requestId, true);
  if (rejected) return rejected;

  const parsed = await readJsonBody(request, requestId);
  if ('response' in parsed) return parsed.response;
  const credentials = parsed.body as Record<string, unknown> | null;

  const result = await callBackend({
    method: 'POST',
    path: '/auth/admin/login',
    // Forward only the expected fields; the backend validates them.
    body: { email: credentials?.email, password: credentials?.password },
    requestId,
    locale: requestLocale(request),
  });
  if (!result.ok) return localError(result.kind, requestId);
  if (result.status !== 200) return backendResponse(result.status, result.body, requestId);

  const pair = readTokenPair(result.body);
  const tokens = pair && toSessionTokens(pair);
  const claims = pair && readClaims(pair.accessToken);
  if (!tokens || !claims) return localError('server', requestId);
  if (claims.role !== 'admin') return localError('forbidden', requestId);

  // A new login always starts a new session id; the previous one is revoked.
  const previous = await readSession(request);
  if (previous) getRefreshCoordinator().revoke(previous.sid, previous.refreshExp);

  const response = privateHeaders(new NextResponse(null, { status: 204 }));
  await writeSessionCookie(response, {
    ...tokens,
    sid: randomUUID(),
    subject: { id: claims.id, role: 'admin' },
  });
  return response;
}

/** Session status and identity. The admin id comes from the sealed session only. */
export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  const session = await readSession(request);
  const call = await callWithSession(request, requestId, (accessToken) =>
    callBackend({
      method: 'GET',
      path: `/admins/${session?.subject.id ?? ''}`,
      accessToken,
      requestId,
      locale: requestLocale(request),
    }),
  );

  const { outcome } = call;
  if (outcome.type === 'refresh_unavailable' || outcome.type === 'refresh_failed') {
    return call.commit(refreshProblemResponse(outcome, requestId));
  }
  if (outcome.type !== 'upstream') {
    const body: SessionStatus = { authenticated: false };
    return call.commit(privateHeaders(NextResponse.json(body)));
  }

  const subject: NonNullable<SessionStatus['subject']> = {
    id: outcome.session.subject.id,
    role: 'admin',
  };
  // Name and email are best effort: the session stays valid if the profile is unavailable.
  if (outcome.result.ok && outcome.result.status === 200) {
    const profile = (outcome.result.body as { data?: { name?: unknown; email?: unknown } }).data;
    if (typeof profile?.name === 'string') subject.name = profile.name;
    if (typeof profile?.email === 'string') subject.email = profile.email;
  }
  const body: SessionStatus = { authenticated: true, subject };
  return call.commit(privateHeaders(NextResponse.json(body)));
}

/**
 * Sign out from this browser. The backend has no logout endpoint yet (L2), so the refresh
 * token stays valid server-side until it expires; the UI says so honestly.
 */
export async function DELETE(request: NextRequest) {
  const requestId = randomUUID();
  const rejected = rejectCrossSite(request, requestId, false);
  if (rejected) return rejected;

  const session = await readSession(request);
  if (session) getRefreshCoordinator().revoke(session.sid, session.refreshExp);

  const response = privateHeaders(new NextResponse(null, { status: 204 }));
  clearSessionCookie(response);
  return response;
}
