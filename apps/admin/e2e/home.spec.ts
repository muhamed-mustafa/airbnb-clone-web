import AxeBuilder from '@axe-core/playwright';
import { test, expect, setLocale, admin, expectNoHorizontalScroll } from './support/fixtures';

test('door scenes accompany a real sign in and sign out; overview shows live counts', async ({
  page,
}, info) => {
  await setLocale(page, 'en');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/login');
  await page.getByLabel('Email').fill(admin().email);
  await page.getByLabel('Password', { exact: true }).fill(admin().password);
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const entry = page.locator('.session-story[data-action="enter"][data-complete="true"]');
  await expect(entry).toBeVisible();
  await expect(entry.locator('.scene-door')).toHaveCSS('animation-name', 'door-open');
  const start = await entry.locator('.scene-door').boundingBox();
  expect(start).not.toBeNull();
  await expect
    .poll(async () => (await entry.locator('.scene-door').boundingBox())?.width ?? start!.width)
    .not.toBe(start!.width);
  await page.screenshot({ path: `../../docs/phase-1/screens/${info.project.name}-door-entry.png` });
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Your workspace, at a glance' })).toBeVisible();
  for (const api of ['countries', 'cities', 'unit-categories', 'currencies']) {
    const response = await page.request.get(`/bff/api/${api}?page=1&limit=1`);
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.meta.total).toBeGreaterThanOrEqual(0);
    const index = ['countries', 'cities', 'unit-categories', 'currencies'].indexOf(api);
    await expect(page.locator('article.dashboard-card').nth(index).locator('p')).toHaveText(
      new Intl.NumberFormat('en').format(body.meta.total),
    );
  }
  await expect(page.locator('.dashboard-card [aria-busy="true"]')).toHaveCount(0);
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
  await expect(page.locator('.dashboard-card [aria-busy="true"]')).toHaveCount(0);
  await page.screenshot({
    path: `../../docs/phase-1/screens/${info.project.name}-overview-ar.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await setLocale(page, 'en');
  await page.reload();
  if (info.project.name === 'mobile') await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  const exit = page.locator('.session-story[data-action="exit"][data-complete="true"]');
  await expect(exit).toBeVisible();
  await expect(exit.locator('.scene-door')).toHaveCSS('animation-name', 'door-close');
  const exitStart = await exit.locator('.scene-door').boundingBox();
  expect(exitStart).not.toBeNull();
  await expect
    .poll(async () => (await exit.locator('.scene-door').boundingBox())?.width ?? exitStart!.width)
    .not.toBe(exitStart!.width);
  await page.screenshot({ path: `../../docs/phase-1/screens/${info.project.name}-door-exit.png` });
  await expect(page).toHaveURL(/reason=signed-out/);
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
