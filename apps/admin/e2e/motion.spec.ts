import { expect, test, signIn, setLocale, expectNoHorizontalScroll } from './support/fixtures';

test('reduced motion covers login, route entry and sign-out without blocking navigation', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setLocale(page, 'en');
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Admin sign in' })).toBeVisible();
  const duration = await page
    .locator('.auth-card')
    .evaluate((node) => parseFloat(getComputedStyle(node).animationDuration));
  expect(duration).toBeLessThanOrEqual(0.001);
  await expectNoHorizontalScroll(page);
  await page.screenshot({
    path: `../../docs/phase-1/screens/${info.project.name}-premium-login-en.png`,
    fullPage: true,
  });
  await signIn(page);
  const routeDuration = await page
    .locator('main > .route-enter')
    .evaluate((node) => parseFloat(getComputedStyle(node).animationDuration));
  expect(routeDuration).toBeLessThanOrEqual(0.001);
  await page.route('**/bff/session', async (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback();
    const response = await route.fetch();
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.fulfill({ response });
  });
  if (info.project.name === 'mobile') await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  const overlay = page.locator('.session-overlay');
  await expect(overlay).toBeVisible();
  // The spinner does not spin under reduced motion; the text still says what is happening.
  const spin = await page
    .locator('.session-spinner')
    .evaluate((node) => parseFloat(getComputedStyle(node).animationDuration));
  expect(spin).toBeLessThanOrEqual(0.001);
  expect((await overlay.boundingBox())?.width).toBe(page.viewportSize()!.width);
  await page.screenshot({
    path: `../../docs/phase-1/screens/${info.project.name}-premium-signout.png`,
    fullPage: false,
    animations: 'disabled',
  });
  await expect(page).toHaveURL(/\/login$/);
});
