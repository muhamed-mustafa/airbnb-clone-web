import { sealData, unsealData } from 'iron-session';
import type { NextRequest, NextResponse } from 'next/server';
import { getServerConfig } from './config';
import type { SessionTokens } from './tokens';

export interface SessionData extends SessionTokens {
  /** Random id per login. Keys refresh coordination and logout tombstones. */
  sid: string;
  subject: { id: string; role: 'admin' };
}

const isSessionData = (value: unknown): value is SessionData => {
  if (typeof value !== 'object' || value === null) return false;
  const data = value as Partial<SessionData>;
  return (
    typeof data.sid === 'string' &&
    typeof data.accessToken === 'string' &&
    typeof data.refreshToken === 'string' &&
    typeof data.accessExp === 'number' &&
    typeof data.refreshExp === 'number' &&
    data.subject?.role === 'admin' &&
    typeof data.subject.id === 'string'
  );
};

export function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies.has(getServerConfig().cookieName);
}

/** Returns undefined for a missing, tampered, expired or non-admin cookie. */
export async function readSession(request: NextRequest): Promise<SessionData | undefined> {
  return readSessionValue(request.cookies.get(getServerConfig().cookieName)?.value);
}

export async function readSessionValue(
  value: string | undefined,
): Promise<SessionData | undefined> {
  if (!value) return undefined;
  const { SESSION_SECRET } = getServerConfig();
  try {
    const data = await unsealData<unknown>(value, { password: SESSION_SECRET });
    return isSessionData(data) ? data : undefined;
  } catch {
    return undefined;
  }
}

export interface SealedSession {
  value: string;
  maxAge: number;
}

/** Encrypts the session. Asynchronous: callers must re-check revocation after it resolves. */
export async function sealSession(data: SessionData): Promise<SealedSession> {
  const { SESSION_SECRET } = getServerConfig();
  const maxAge = Math.max(0, data.refreshExp - Math.floor(Date.now() / 1000));
  return { value: await sealData(data, { password: SESSION_SECRET, ttl: maxAge }), maxAge };
}

/**
 * Synchronous on purpose: a revocation check immediately before this call cannot be
 * invalidated by a logout landing in between.
 */
export function setSessionCookie(response: NextResponse, { value, maxAge }: SealedSession): void {
  const { cookieName, secureCookie } = getServerConfig();
  response.cookies.set(cookieName, value, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
}

/** For a brand-new session (sign-in), which no logout can target yet. */
export async function writeSessionCookie(response: NextResponse, data: SessionData): Promise<void> {
  setSessionCookie(response, await sealSession(data));
}

export function clearSessionCookie(response: NextResponse): void {
  const { cookieName, secureCookie } = getServerConfig();
  response.cookies.set(cookieName, '', {
    httpOnly: true,
    secure: secureCookie,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
