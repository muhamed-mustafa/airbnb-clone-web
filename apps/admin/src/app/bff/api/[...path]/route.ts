import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { resolveUpstream } from '@/server/allowlist';
import { callBackend } from '@/server/backend';
import { readJsonBody, rejectCrossSite, requestLocale } from '@/server/request';
import { backendResponse, localError, refreshProblemResponse } from '@/server/responses';
import { callWithSession, type SessionCallOutcome } from '@/server/session-call';

interface Context {
  params: Promise<{ path: string[] }>;
}

async function proxy(request: NextRequest, context: Context) {
  const requestId = randomUUID();
  const { path } = await context.params;
  const target = resolveUpstream(request.method, path, request.nextUrl.searchParams);
  if (!target) return localError('not_found', requestId);

  const hasBody = request.method === 'POST' || request.method === 'PATCH';
  const rejected = rejectCrossSite(request, requestId, hasBody);
  if (rejected) return rejected;

  let body: unknown;
  if (hasBody) {
    const parsed = await readJsonBody(request, requestId);
    if ('response' in parsed) return parsed.response;
    body = parsed.body;
  }

  const call = await callWithSession(request, requestId, (accessToken) =>
    callBackend({
      method: request.method,
      path: target.path,
      query: target.query,
      body,
      accessToken,
      requestId,
      locale: requestLocale(request),
    }),
  );
  return call.commit(toResponse(call.outcome, requestId));
}

function toResponse(outcome: SessionCallOutcome, requestId: string) {
  switch (outcome.type) {
    case 'upstream':
      return outcome.result.ok
        ? backendResponse(
            outcome.result.status,
            outcome.result.body,
            requestId,
            outcome.result.retryAfterSeconds,
          )
        : localError(outcome.result.kind, requestId);
    case 'refresh_unavailable':
    case 'refresh_failed':
      return refreshProblemResponse(outcome, requestId);
    case 'no_session':
    case 'expired':
      return localError('session_expired', requestId);
  }
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE };
