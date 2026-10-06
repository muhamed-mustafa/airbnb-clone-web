import { ADMIN_URL } from './support/constants';
import { expect, signIn, test, unique, uniqueCode } from './support/fixtures';

// API-level checks of the BFF, using the signed-in browser context's cookie.
// Playwright's request client sends neither Origin nor Sec-Fetch-Site unless told to.
test.describe('BFF protections', () => {
  test.skip(({ isMobile }) => isMobile, 'Viewport-independent; run once.');
  test.beforeEach(async ({ page }) => signIn(page));

  const body = () => ({ name: unique('Csrf land'), code: uniqueCode() });

  test('rejects a foreign Origin even when Sec-Fetch-Site claims same-origin', async ({ page }) => {
    const response = await page.request.post('/bff/api/countries', {
      headers: { origin: 'http://evil.example', 'sec-fetch-site': 'same-origin' },
      data: body(),
    });
    expect(response.status()).toBe(403);
    const { error } = await response.json();
    expect(error.kind).toBe('csrf');
    expect(error.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers()['x-request-id']).toBe(error.requestId);
  });

  test('rejects a write with neither Origin nor Sec-Fetch-Site', async ({ page }) => {
    const response = await page.request.post('/bff/api/countries', { data: body() });
    expect(response.status()).toBe(403);
  });

  test('accepts Sec-Fetch-Site: same-origin when Origin is absent', async ({ page }) => {
    const response = await page.request.post('/bff/api/countries', {
      headers: { 'sec-fetch-site': 'same-origin' },
      data: body(),
    });
    expect(response.status()).toBe(201);
  });

  test('requires JSON for writes with a body, but not for a body-less sign-out', async ({
    page,
  }) => {
    const textPlain = await page.request.post('/bff/api/countries', {
      headers: { origin: ADMIN_URL, 'content-type': 'text/plain' },
      data: JSON.stringify(body()),
    });
    expect(textPlain.status()).toBe(403);

    const signOut = await page.request.delete('/bff/session', { headers: { origin: ADMIN_URL } });
    expect(signOut.status()).toBe(204);
  });

  test('the proxy is an allowlist and drops unknown query parameters', async ({ page }) => {
    for (const path of [
      '/bff/api/admins',
      '/bff/api/app-settings',
      '/bff/api/auth/me',
      '/bff/api/countries/x/y',
    ]) {
      expect((await page.request.get(path)).status(), path).toBe(404);
    }
    // The backend answers 400 to unknown parameters; the BFF must not forward them.
    expect((await page.request.get('/bff/api/countries?sort=name&utm_source=x')).status()).toBe(
      200,
    );
  });

  test('private responses are not cacheable or indexable', async ({ page }) => {
    const response = await page.request.get('/bff/api/countries');
    expect(response.headers()['cache-control']).toBe('no-store');
    expect(response.headers()['x-robots-tag']).toContain('noindex');
    const pageResponse = await page.request.get('/locations/countries');
    expect(pageResponse.headers()['x-robots-tag']).toContain('noindex');
    expect(pageResponse.headers()['x-powered-by']).toBeUndefined();
  });
});
