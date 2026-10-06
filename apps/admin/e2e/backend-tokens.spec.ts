// Characterization of backend defect D12 (report v7), straight against the e2e backend.
// Refresh tokens carry {id, role, type, iat, exp} with `iat` in whole seconds and no unique
// id (jti), so two tokens issued for one account within the same second are identical.
// These tests assert today's behavior on purpose: once the backend adds a random jti, the
// "same second" assertions fail and must be flipped to expect distinct tokens and a 401.
// No token value is ever logged.
import { E2E_BACKEND_URL } from './support/constants';
import { admin, expect, test } from './support/fixtures';

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

async function post(path: string, body: unknown): Promise<{ status: number; tokens?: Tokens }> {
  const response = await fetch(`${E2E_BACKEND_URL}/api${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = response.ok ? ((await response.json()) as { data: Tokens }) : undefined;
  return { status: response.status, tokens: json?.data };
}
async function login(): Promise<Tokens> {
  const { email, password } = admin();
  const { status, tokens } = await post('/auth/admin/login', { email, password });
  expect(status, 'sign-in status').toBe(200);
  return tokens!;
}
const refresh = (token: string) => post('/auth/refresh-token', { token });
const issuedAt = (token: string) =>
  (JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as { iat: number }).iat;

const startOfNextSecond = () =>
  new Promise((done) => setTimeout(done, 1000 - (Date.now() % 1000) + 20));

/** Runs `issue` from the start of a second until all its tokens share one `iat` (max 3 tries). */
async function withinOneSecond<T>(issue: () => Promise<T>, tokensOf: (result: T) => string[]) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await startOfNextSecond();
    const result = await issue();
    if (new Set(tokensOf(result).map(issuedAt)).size === 1) return result;
  }
  throw new Error('could not issue the tokens within one second in 3 attempts');
}

test.describe('backend refresh tokens (D12 characterization)', () => {
  test.skip(({ isMobile }) => isMobile, 'Backend only; run once.');

  test('two sign-ins in the same second get the same token; the first is not revoked', async () => {
    const [first, second] = await withinOneSecond(
      async () => [await login(), await login()] as const,
      ([a, b]) => [a.refreshToken, b.refreshToken],
    );
    expect(first.refreshToken === second.refreshToken, 'identical refresh tokens').toBe(true);
    expect((await refresh(first.refreshToken)).status, 'first token still accepted').toBe(200);
  });

  test('control: sign-ins a second apart revoke the earlier token (L1)', async () => {
    const first = await login();
    await startOfNextSecond();
    const second = await login();
    expect(first.refreshToken === second.refreshToken).toBe(false);
    expect((await refresh(first.refreshToken)).status).toBe(401);
  });

  test('a rotation in the same second returns the same token, which stays usable', async () => {
    const { signedIn, rotated } = await withinOneSecond(
      async () => {
        const signedIn = await login();
        const rotated = await refresh(signedIn.refreshToken);
        return { signedIn, rotated: rotated.tokens! };
      },
      ({ signedIn, rotated }) => [signedIn.refreshToken, rotated.refreshToken],
    );
    expect(signedIn.refreshToken === rotated.refreshToken, 'rotation changed nothing').toBe(true);
    // The pre-rotation token is the current one, so it is accepted again.
    expect((await refresh(signedIn.refreshToken)).status).toBe(200);
  });

  test('control: a rotation a second later rejects the pre-rotation token', async () => {
    const signedIn = await login();
    await startOfNextSecond();
    const rotated = await refresh(signedIn.refreshToken);
    expect(rotated.status).toBe(200);
    expect(rotated.tokens!.refreshToken === signedIn.refreshToken).toBe(false);
    expect((await refresh(signedIn.refreshToken)).status).toBe(401);
  });
});
