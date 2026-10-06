import type { SessionTokens } from './tokens';

/** Unsigned JWT-shaped token; the BFF only reads claims, the backend verifies. */
export function fakeJwt(claims: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none' })}.${encode(claims)}.sig`;
}

export function fakeTokens(
  generation: number,
  accessExp: number,
  refreshExp = 9_999_999_999,
): SessionTokens {
  return {
    accessToken: fakeJwt({
      id: 'admin-1',
      role: 'admin',
      type: 'access',
      exp: accessExp,
      g: generation,
    }),
    refreshToken: fakeJwt({
      id: 'admin-1',
      role: 'admin',
      type: 'refresh',
      exp: refreshExp,
      g: generation,
    }),
    accessExp,
    refreshExp,
  };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
