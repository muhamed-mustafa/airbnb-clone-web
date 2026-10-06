import { isAuthGuardRejection } from '@stays/api-contract';
import type { NextRequest, NextResponse } from 'next/server';
import { rotateAtBackend, type BackendResult } from './backend';
import { getServerConfig } from './config';
import { requestLocale } from './request';
import { getRefreshCoordinator, type RefreshCoordinator } from './refresh-coordinator';
import {
  clearSessionCookie,
  hasSessionCookie,
  readSession,
  sealSession,
  setSessionCookie,
  type SessionData,
} from './session';
import type { SessionTokens } from './tokens';

export type SessionCallOutcome =
  | { type: 'upstream'; result: BackendResult; session: SessionData }
  | { type: 'no_session' }
  | { type: 'expired' }
  | { type: 'refresh_unavailable'; retryAfterSeconds?: number }
  /** Unexpected refresh response: an error for this request, but the session is kept. */
  | { type: 'refresh_failed' };

export interface SessionCall {
  outcome: SessionCallOutcome;
  requestId: string;
  /** Applies the cookie decision to the response. Call it last, right before returning. */
  commit: (response: NextResponse) => Promise<NextResponse>;
}

interface Dependencies {
  coordinator: RefreshCoordinator;
  readSession: (request: NextRequest) => Promise<SessionData | undefined>;
  rotate: typeof rotateAtBackend;
  seal: typeof sealSession;
  nowSeconds: () => number;
  skewSeconds: number;
}

const resolveDependencies = (overrides: Partial<Dependencies>): Dependencies => ({
  coordinator: overrides.coordinator ?? getRefreshCoordinator(),
  readSession: overrides.readSession ?? readSession,
  rotate: overrides.rotate ?? rotateAtBackend,
  seal: overrides.seal ?? sealSession,
  nowSeconds: overrides.nowSeconds ?? (() => Math.floor(Date.now() / 1000)),
  skewSeconds: overrides.skewSeconds ?? getServerConfig().REFRESH_SKEW_SECONDS,
});

/**
 * Run one backend call with the caller's session (session-error-contract §A4):
 *  - picks up tokens another request already rotated;
 *  - refreshes ahead of expiry;
 *  - after a 401 from the JWT guard: refresh, then replay once (safe for writes because
 *    the guard rejects before the handler runs);
 *  - never replays after network errors or timeouts;
 *  - clears the session only when the backend rejects the refresh token (401); network,
 *    timeout, 429 and 5xx are temporary, other responses are errors, neither signs out;
 *  - never writes the cookie for a session that was logged out meanwhile.
 */
export async function callWithSession(
  request: NextRequest,
  requestId: string,
  run: (accessToken: string) => Promise<BackendResult>,
  overrides: Partial<Dependencies> = {},
): Promise<SessionCall> {
  const deps = resolveDependencies(overrides);
  const locale = requestLocale(request);
  const session = await deps.readSession(request);

  const finish = (outcome: SessionCallOutcome, tokens?: SessionTokens): SessionCall => ({
    outcome,
    requestId,
    commit: async (response) => {
      if (outcome.type === 'expired' || outcome.type === 'no_session') {
        // Also removes a tampered or unreadable cookie.
        if (outcome.type === 'expired' || hasSessionCookie(request)) clearSessionCookie(response);
        return response;
      }
      if (!session || !tokens || tokens.refreshToken === session.refreshToken) return response;
      // Logout may have happened while this request was running.
      if (deps.coordinator.isRevoked(session.sid)) {
        clearSessionCookie(response);
        return response;
      }
      const sealed = await deps.seal({ ...session, ...tokens });
      // Sealing is asynchronous, so logout may also land during it. Check again and write
      // in the same synchronous step: no await between this check and Set-Cookie.
      if (deps.coordinator.isRevoked(session.sid)) {
        clearSessionCookie(response);
        return response;
      }
      setSessionCookie(response, sealed);
      return response;
    },
  });

  if (!session) return finish({ type: 'no_session' });
  if (deps.coordinator.isRevoked(session.sid)) return finish({ type: 'expired' });

  let tokens: SessionTokens =
    deps.coordinator.latestFor(session.sid, session.refreshToken) ?? session;
  let refreshed = false;

  const refresh = async (): Promise<SessionCallOutcome | undefined> => {
    const outcome = await deps.coordinator.refresh(session.sid, tokens.refreshToken, (token) =>
      deps.rotate(token, requestId, locale),
    );
    if (outcome.type === 'refreshed') {
      tokens = outcome.tokens;
      refreshed = true;
      return undefined;
    }
    if (outcome.type === 'unavailable') {
      return {
        type: 'refresh_unavailable',
        ...(outcome.retryAfterSeconds !== undefined && {
          retryAfterSeconds: outcome.retryAfterSeconds,
        }),
      };
    }
    if (outcome.type === 'failed') return { type: 'refresh_failed' };
    return { type: 'expired' };
  };

  if (tokens.accessExp - deps.nowSeconds() <= deps.skewSeconds) {
    const failure = await refresh();
    if (failure) return finish(failure);
  }

  let result = await run(tokens.accessToken);

  if (result.ok && isAuthGuardRejection(result.status, result.body)) {
    if (refreshed) return finish({ type: 'expired' });
    const failure = await refresh();
    if (failure) return finish(failure);
    result = await run(tokens.accessToken);
    if (result.ok && isAuthGuardRejection(result.status, result.body)) {
      return finish({ type: 'expired' });
    }
  }

  if (deps.coordinator.isRevoked(session.sid)) return finish({ type: 'expired' });
  return finish({ type: 'upstream', result, session }, tokens);
}
