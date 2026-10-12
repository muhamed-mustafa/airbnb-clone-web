import AxeBuilder from '@axe-core/playwright';
import { test, expect, setLocale, admin, expectNoHorizontalScroll } from './support/fixtures';

test('sign in and sign out show real progress and confirmation; overview shows live counts', async ({
  page,
}, info) => {
  await setLocale(page, 'en');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  // The confirmation is shown only for the frames before navigation (no added wait), which
  // polling can miss; an in-page observer reports every time it appears.
  const confirmations: { action: string; mark: boolean }[] = [];
  await page.exposeFunction('__sessionConfirmed', (action: string, mark: boolean) => {
    confirmations.push({ action, mark });
  });
  await page.addInitScript(() => {
    const seen = new WeakSet<Element>();
    new MutationObserver(() => {
      const story = document.querySelector('.session-story[data-complete="true"]');
      if (!story || seen.has(story)) return;
      seen.add(story);
      const report = (window as unknown as Record<string, (a: string, m: boolean) => void>)
        .__sessionConfirmed;
      report?.(story.getAttribute('data-action') ?? '', !!story.querySelector('.session-mark svg'));
    }).observe(document, { subtree: true, childList: true, attributes: true });
  });
  await page.goto('/login');
  await page.getByLabel('Email').fill(admin().email);
  await page.getByLabel('Password', { exact: true }).fill(admin().password);
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  // Confirmation appears only after the request succeeded: a check mark, then navigation.
  await expect(page).toHaveURL(/\/$/);
  expect(confirmations).toEqual([{ action: 'enter', mark: true }]);
  await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible();
  const order = ['countries', 'cities', 'currencies', 'unit-categories', 'admins'];
  for (const api of order) {
    const response = await page.request.get(`/bff/api/${api}?page=1&limit=1`);
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.meta.total).toBeGreaterThanOrEqual(0);
    await expect(
      page.locator('.stat-tile').nth(order.indexOf(api)).locator('.stat-value'),
    ).toHaveText(new Intl.NumberFormat('en').format(body.meta.total));
  }
  await expect(page.locator('.stat-value[aria-busy="true"]')).toHaveCount(0);
  await expectNoHorizontalScroll(page);
  await page.screenshot({
    path: `../../docs/phase-1/screens/${info.project.name}-overview-en.png`,
    fullPage: true,
    animations: 'disabled',
  });
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
  await setLocale(page, 'ar');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('.stat-value[aria-busy="true"]')).toHaveCount(0);
  await page.screenshot({
    path: `../../docs/phase-1/screens/${info.project.name}-overview-ar.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await setLocale(page, 'en');
  await page.reload();
  if (info.project.name === 'mobile') await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(confirmations).toEqual([
    { action: 'enter', mark: true },
    { action: 'exit', mark: true },
  ]);
});

test('overview count errors show retry, never a fabricated zero', async ({ page }) => {
  await setLocale(page, 'en');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/bff/api/countries?*', (route) =>
    route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ error: { kind: 'upstream', messages: [] } }),
    }),
  );
  await page.goto('/login');
  await page.getByLabel('Email').fill(admin().email);
  await page.getByLabel('Password', { exact: true }).fill(admin().password);
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Count unavailable', exact: false })).toBeVisible({
    timeout: 20000,
  });
  await page.unroute('**/bff/api/countries?*');
  await page.getByRole('button', { name: 'Count unavailable', exact: false }).click();
  await expect(page.getByRole('button', { name: 'Count unavailable', exact: false })).toHaveCount(
    0,
  );
});
