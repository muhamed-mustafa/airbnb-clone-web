import { hashToken, type SessionTokens } from './tokens';

/**
 * Coordinates refresh-token rotation per session (session-error-contract §A4).
 *
 * The backend keeps one refresh token per account and rotates it atomically, so of two
 * concurrent refreshes with the same token one succeeds and the other gets 401. This
 * coordinator makes sure:
 *  - only one refresh per session runs at a time in this server instance;
 *  - a request that still carries a rotated token gets the newer tokens for 30 seconds
 *    (a window for late requests, not a guarantee against every network failure);
 *  - logout revokes the session id so no in-flight request can write the cookie back;
 *  - a temporary failure with Retry-After (429/503) blocks new backend refreshes for that
 *    session until it passes, instead of hammering the backend.
 *
 * State is in memory, which is correct for a single server instance only. Running
 * several instances needs a shared store behind the same interface (hosting decision).
 */

export type RefreshResult =
  | { type: 'rotated'; tokens: SessionTokens }
  | { type: 'rejected' } // backend 401: the refresh token is no longer valid
  | { type: 'unavailable'; retryAfterSeconds?: number } // network, timeout, 429, 5xx
  | { type: 'failed' }; // unexpected response: not an auth rejection, not temporary

export type RefreshOutcome =
  | { type: 'refreshed'; tokens: SessionTokens }
  | { type: 'expired' }
  | { type: 'revoked' }
  | { type: 'unavailable'; retryAfterSeconds?: number }
  | { type: 'failed' };

interface SessionState {
  latest?: SessionTokens;
  /** hash(rotated refresh token) -> epoch ms until which it maps to `latest`. */
  superseded: Map<string, number>;
  inflight?: { tokenHash: string; promise: Promise<RefreshOutcome> };
  /** Epoch ms before which no backend refresh is attempted (from Retry-After). */
  blockedUntil?: number;
}

export interface RefreshCoordinatorOptions {
  supersededWindowMs?: number;
  now?: () => number;
}

export class RefreshCoordinator {
  private readonly sessions = new Map<string, SessionState>();
  /** sid -> epoch ms until which the tombstone is kept. */
  private readonly revoked = new Map<string, number>();
  private readonly windowMs: number;
  private readonly now: () => number;

  constructor(options: RefreshCoordinatorOptions = {}) {
    this.windowMs = options.supersededWindowMs ?? 30_000;
    this.now = options.now ?? Date.now;
  }

  isRevoked(sid: string): boolean {
    const until = this.revoked.get(sid);
    if (until === undefined) return false;
    if (until <= this.now()) {
      this.revoked.delete(sid);
      return false;
    }
    return true;
  }

  /** Logout: drop every cached result and refuse this sid until its refresh token expires. */
  revoke(sid: string, refreshExpSeconds: number): void {
    this.sessions.delete(sid);
    this.revoked.set(sid, Math.max(refreshExpSeconds * 1000, this.now() + this.windowMs));
  }

  /** Newer tokens for a request that still carries an already-rotated refresh token. */
  latestFor(sid: string, refreshToken: string): SessionTokens | undefined {
    const state = this.readState(sid);
    if (!state?.latest) return undefined;
    const until = state.superseded.get(hashToken(refreshToken));
    return until !== undefined && until > this.now() ? state.latest : undefined;
  }

  async refresh(
    sid: string,
    refreshToken: string,
    rotate: (refreshToken: string) => Promise<RefreshResult>,
  ): Promise<RefreshOutcome> {
    if (this.isRevoked(sid)) return { type: 'revoked' };

    const newer = this.latestFor(sid, refreshToken);
    if (newer) return { type: 'refreshed', tokens: newer };

    const blockedUntil = this.readState(sid)?.blockedUntil;
    if (blockedUntil !== undefined && blockedUntil > this.now()) {
      return {
        type: 'unavailable',
        retryAfterSeconds: Math.ceil((blockedUntil - this.now()) / 1000),
      };
    }

    const tokenHash = hashToken(refreshToken);
    const inflight = this.stateFor(sid).inflight;
    if (inflight) {
      // Same token: share the running refresh, whatever its outcome.
      if (inflight.tokenHash === tokenHash) return inflight.promise;
      await inflight.promise;
      if (this.isRevoked(sid)) return { type: 'revoked' };
      const rotated = this.latestFor(sid, refreshToken);
      if (rotated) return { type: 'refreshed', tokens: rotated };
    }

    const promise = this.rotateOnce(sid, refreshToken, rotate);
    const entry = { tokenHash, promise };
    this.stateFor(sid).inflight = entry;
    try {
      return await promise;
    } finally {
      const state = this.sessions.get(sid);
      if (state?.inflight === entry) state.inflight = undefined;
    }
  }

  private async rotateOnce(
    sid: string,
    refreshToken: string,
    rotate: (refreshToken: string) => Promise<RefreshResult>,
  ): Promise<RefreshOutcome> {
    const result = await rotate(refreshToken);

    // Logout happened while the backend call was in flight: never resurrect the session.
    if (this.isRevoked(sid)) return { type: 'revoked' };

    if (result.type === 'rotated') {
      const state = this.stateFor(sid);
      state.latest = result.tokens;
      state.superseded.set(hashToken(refreshToken), this.now() + this.windowMs);
      return { type: 'refreshed', tokens: result.tokens };
    }
    if (result.type === 'rejected') {
      // Another refresh for this sid may have won meanwhile.
      const rotated = this.latestFor(sid, refreshToken);
      return rotated ? { type: 'refreshed', tokens: rotated } : { type: 'expired' };
    }
    if (result.type === 'unavailable') {
      if (result.retryAfterSeconds !== undefined) {
        this.stateFor(sid).blockedUntil = this.now() + result.retryAfterSeconds * 1000;
      }
      return result;
    }
    return { type: 'failed' };
  }

  private stateFor(sid: string): SessionState {
    let state = this.sessions.get(sid);
    if (!state) {
      state = { superseded: new Map() };
      this.sessions.set(sid, state);
    }
    return state;
  }

  private readState(sid: string): SessionState | undefined {
    const state = this.sessions.get(sid);
    if (!state) return undefined;
    const now = this.now();
    for (const [hash, until] of state.superseded) {
      if (until <= now) state.superseded.delete(hash);
    }
    if (state.blockedUntil !== undefined && state.blockedUntil <= now) {
      state.blockedUntil = undefined;
    }
    if (state.superseded.size === 0 && !state.inflight && state.blockedUntil === undefined) {
      this.sessions.delete(sid);
      return undefined;
    }
    return state;
  }
}

// One instance per server process. Next.js may load route modules more than once in
// development, so the instance lives on globalThis.
const globalKey = Symbol.for('stays.admin.refreshCoordinator');
type GlobalWithCoordinator = typeof globalThis & { [globalKey]?: RefreshCoordinator };

export function getRefreshCoordinator(): RefreshCoordinator {
  const store = globalThis as GlobalWithCoordinator;
  store[globalKey] ??= new RefreshCoordinator();
  return store[globalKey];
}
