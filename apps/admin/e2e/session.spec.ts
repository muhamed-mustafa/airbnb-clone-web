import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, signIn, test } from './support/fixtures';

// The e2e backend issues 40 s access tokens and the BFF refreshes 30 s before expiry,
// so a token older than 10 s triggers a refresh on the next request.
const AGE_BEYOND_SKEW = 11_000;
const BACKEND_LOG = fileURLToPath(
  new URL('../../../.cache/e2e-backend/backend.log', import.meta.url),
);
const rotationsInBackendLog = () =>
  readFileSync(BACKEND_LOG, 'utf8').split('Refresh token rotated').length - 1;

test.describe('session refresh', () => {
  test.skip(({ isMobile }) => isMobile, 'Viewport-independent; run once.');
  test.setTimeout(120_000);

  test('concurrent requests share one refresh and the cookie keeps the newest token', async ({
    page,
  }) => {
    await signIn(page);
    await page.waitForTimeout(AGE_BEYOND_SKEW);

    const before = rotationsInBackendLog();
    const statuses = await page.evaluate(() =>
      Promise.all(
        Array.from({ length: 6 }, () => fetch('/bff/api/countries?limit=1').then((r) => r.status)),
      ),
    );
    expect(statuses).toEqual(Array(6).fill(200));
    await page.waitForTimeout(500); // let the backend flush its log
    expect(rotationsInBackendLog() - before, 'one backend rotation for six requests').toBe(1);

    // Past the 30 s grace window, only the token in the cookie can work: if any response
    // had written an older token, this refresh would be rejected.
    await page.waitForTimeout(31_000);
    const session = await page.evaluate(() => fetch('/bff/session').then((r) => r.json()));
    expect(session.authenticated).toBe(true);
  });

  test('signing in elsewhere ends this session at its next refresh, without guessing why', async ({
    page,
    browser,
  }) => {
    await signIn(page);
    // Another browser signs in with the same account: the backend keeps one refresh token
    // per account (report L1), so this browser's refresh token is now invalid.
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await signIn(otherPage);

    // Until the access token is near expiry, this browser keeps working (honest limit).
    await page.reload();
    await expect(page.getByRole('heading', { name: 'الدول' })).toBeVisible();

    await page.waitForTimeout(AGE_BEYOND_SKEW);
    await page.reload();
    await expect(page).toHaveURL(/\/login\?reason=expired&next=%2Flocations%2Fcountries/);
    await expect(page.getByRole('main').getByRole('status')).toContainText('انتهت الجلسة');

    // The other browser is unaffected.
    await otherPage.reload();
    await expect(otherPage.getByRole('heading', { name: 'الدول' })).toBeVisible();
    await other.close();
  });
});
