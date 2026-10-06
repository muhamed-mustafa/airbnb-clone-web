import { createHash } from 'node:crypto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface SessionTokens extends TokenPair {
  /** Access token expiry, epoch seconds. */
  accessExp: number;
  /** Refresh token expiry, epoch seconds. Drives cookie lifetime and logout tombstones. */
  refreshExp: number;
}

export interface TokenClaims {
  id: string;
  role: string;
  exp: number;
}

/**
 * Read JWT claims without verifying the signature. The BFF never trusts these for
 * authorization; the backend verifies every token. They only schedule refreshes and
 * label the session.
 */
export function readClaims(token: string): TokenClaims | undefined {
  const payload = token.split('.')[1];
  if (!payload) return undefined;
  try {
    const value: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof value !== 'object' || value === null) return undefined;
    const { id, role, exp } = value as Record<string, unknown>;
    if (typeof id !== 'string' || typeof role !== 'string' || typeof exp !== 'number') {
      return undefined;
    }
    return { id, role, exp };
  } catch {
    return undefined;
  }
}

export function toSessionTokens(pair: TokenPair): SessionTokens | undefined {
  const access = readClaims(pair.accessToken);
  const refresh = readClaims(pair.refreshToken);
  if (!access || !refresh) return undefined;
  return { ...pair, accessExp: access.exp, refreshExp: refresh.exp };
}

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('base64url');
