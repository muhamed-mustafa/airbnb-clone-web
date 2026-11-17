import type { Page } from '@playwright/test';
import { ADMIN_URL } from './support/constants';
import { expect, openAccountMenu, setLocale, signIn, test } from './support/fixtures';

// Development-only diagnostics: React reports hydration mismatches (including attribute
// mismatches, which production does not report) only in `next dev`. Run in a checkout where
// no other `next dev` is running:
//   E2E_DEV=1 E2E_ADMIN_PORT=4300 pnpm exec playwright test e2e/dev-hydration.spec.ts
test.skip(!process.env.E2E_DEV, 'Set E2E_DEV=1 (runs against `next dev`).');

function collect(page: Page) {
  const problems: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (/hydrat|did not match|didn't match/i.test(text)) problems.push(`[hydration] ${text}`);
    else if (message.type() === 'error') {
      // Expected: unsaved pricing settings are a 404 the app shows as "not saved yet".
      if (message.location().url.includes('/bff/api/app-settings')) return;
      problems.push(`[error] ${text}`);
    }
  });
  page.on('pageerror', (error) => problems.push(`[exception] ${error.message}`));
  return problems;
}

for (const mode of ['light', 'dark', 'system'] as const) {
  for (const locale of ['ar', 'en'] as const) {
    test(`no hydration warnings or errors: ${mode}, ${locale}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'Desktop pass is enough for hydration.');
      test.setTimeout(180_000);
      const problems = collect(page);
      await page.emulateMedia({ colorScheme: mode === 'light' ? 'dark' : 'light' });
      if (mode !== 'system') {
        await page.context().addCookies([{ name: 'admin_theme', value: mode, url: ADMIN_URL }]);
      }
      await setLocale(page, locale);
      await page.goto('/login');
      await signIn(page, '/');
      await expect(page.locator('.stat-value[aria-busy="true"]')).toHaveCount(0);
      for (const path of [
        '/locations/countries',
        '/locations/cities',
        '/catalog/currencies',
        '/catalog/unit-categories',
        '/settings/pricing',
        '/team/admins',
        '/account',
      ]) {
        // Full loads: each page is server-rendered and hydrated.
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await page.waitForLoadState('networkidle');
      }
      await page.goto('/locations/countries');
      await page
        .getByRole('button', { name: locale === 'ar' ? 'إضافة دولة' : 'Add country' })
        .click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await openAccountMenu(page);
      await page.keyboard.press('Escape');
      // Client-side navigation back to the overview.
      await page.locator('a[href="/"]').filter({ visible: true }).first().click();
      await expect(page.locator('.stat-tile').first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(problems).toEqual([]);
    });
  }
}
