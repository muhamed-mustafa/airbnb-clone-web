import { admin, expect, setLocale, signIn, test, openAccountMenu } from './support/fixtures';

// Sign out → sign in again → the session expires. Late answers to the previous session's
// requests must not turn an intentional sign-out into "your session ended", and must not
// leave anything behind that hides a real expiry later.
test('sign-out ignores late 401s from the old session; a later real expiry still redirects', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'Session logic does not depend on the viewport.');
  const navigations: string[] = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigations.push(frame.url());
  });
  await setLocale(page, 'en');

  // After sign-out starts, the cache is cleared and mounted screens (the shell's session
  // check included) fetch again. Those requests are held, then answered as the BFF answers a session that no
  // longer exists, while the browser is already loading the signed-out page.
  let signingOut = false;
  let late = 0;
  const held: (() => Promise<void>)[] = [];
  await page.route('**/bff/**', async (route) => {
    // The sign-out request itself goes through; reads started after it are held.
    if (!signingOut || route.request().method() !== 'GET') return route.continue();
    held.push(() =>
      route
        .fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: { kind: 'session_expired', formErrors: [], fieldErrors: {} },
          }),
        })
        .catch(() => undefined),
    );
  });
  await page.route('**/login?reason=signed-out', async (route) => {
    const answers = held.splice(0);
    late += answers.length;
    await Promise.all(answers.map((answer) => answer()));
    // Time for the old page to handle those answers before the new document arrives.
    await page.waitForTimeout(500);
    await route.continue().catch(() => undefined);
  });

  await signIn(page, '/');
  await expect(page.locator('.stat-tile .stat-value').first()).toHaveText(/\d/);
  await expect(page.locator('.stat-value[aria-busy="true"]')).toHaveCount(0);
  signingOut = true;
  await openAccountMenu(page);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByText('You signed out.')).toBeVisible();
  expect(late, 'late requests from the old session were answered').toBeGreaterThan(0);
  await expect(page).toHaveURL(/\/login$/);
  expect(navigations.filter((url) => url.includes('reason=expired'))).toEqual([]);
  await page.unrouteAll({ behavior: 'ignoreErrors' });

  // Sign in again: the new session works and nothing from the old one ends it.
  const { email, password } = admin();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname === '/');
  await expect(page.locator('.stat-value[aria-busy="true"]')).toHaveCount(0);
  await page.waitForTimeout(1000);
  await expect(page).toHaveURL(/\/$/);

  // A real expiry: the session cookie is gone, so the BFF answers the next request with
  // session_expired, and the app must still send the user to sign in with a reason.
  await page.goto('/settings/pricing');
  await expect(page.getByLabel('VAT rate (%)')).toBeVisible();
  await page.context().clearCookies();
  await setLocale(page, 'en');
  await page.getByLabel('VAT rate (%)').fill('14');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/login\?reason=expired&next=%2Fsettings%2Fpricing$/);
  await expect(page.getByText('Your session ended. Sign in again to continue.')).toBeVisible();
  // Only this expiry led to the expired notice (a document can report its URL twice).
  expect([...new Set(navigations.filter((url) => url.includes('reason=expired')))]).toEqual([
    page.url(),
  ]);
});
