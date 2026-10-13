import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { E2E_BACKEND_URL } from './support/constants';
import { backendAdminToken, expect, setLocale, signIn, test } from './support/fixtures';
import { seedReviewData } from './support/review-data';

// Screens at real desktop widths and on a phone, with populated data, for layout review.
// Writes to docs/ui-review/layout/<LAYOUT_OUT>/.
//   CAPTURE_LAYOUT=1 LAYOUT_OUT=current E2E_ADMIN_PORT=4200 pnpm exec playwright test e2e/layout-review.spec.ts
// LAYOUT_SCREENS=all captures every screen (default: home and countries);
// LAYOUT_WIDTHS=1440,1920 picks the desktop widths (default: 1280,1440,1920).
const STAGE = process.env.LAYOUT_OUT ?? 'current';
const OUT = fileURLToPath(new URL(`../../../docs/ui-review/layout/${STAGE}/`, import.meta.url));
const ALL = process.env.LAYOUT_SCREENS === 'all';
const DESKTOP_WIDTHS = (process.env.LAYOUT_WIDTHS ?? '1280,1440,1920').split(',').map(Number);
test.skip(!process.env.CAPTURE_LAYOUT, 'Set CAPTURE_LAYOUT=1 to capture layout screenshots.');

const PAGES: [string, string][] = ALL
  ? [
      ['/', 'home'],
      ['/locations/countries', 'countries'],
      ['/locations/cities', 'cities'],
      ['/catalog/currencies', 'currencies'],
      ['/catalog/unit-categories', 'accommodation-types'],
      ['/settings/pricing', 'pricing'],
      ['/team/admins', 'admins'],
      ['/account', 'account'],
    ]
  : [
      ['/', 'home'],
      ['/locations/countries', 'countries'],
    ];

async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

test('screens at real widths', async ({ page }, testInfo) => {
  test.setTimeout(900_000);
  mkdirSync(OUT, { recursive: true });
  await seedReviewData();
  await fetch(`${E2E_BACKEND_URL}/api/app-settings`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${await backendAdminToken()}`,
    },
    body: JSON.stringify({ vatRate: 14, minPrice: 250 }),
  });
  const widths = testInfo.project.name === 'mobile' ? [null] : DESKTOP_WIDTHS;
  const shot = (name: string) =>
    page.screenshot({ path: `${OUT}${name}.png`, fullPage: true, animations: 'disabled' });

  if (ALL) {
    // Signed out first: the login page.
    for (const locale of ['ar', 'en'] as const) {
      await setLocale(page, locale);
      for (const width of widths) {
        if (width) await page.setViewportSize({ width, height: 960 });
        await page.goto('/login');
        await settle(page);
        await shot(`login-${width ?? 'mobile'}-${locale}`);
      }
    }
  }

  await signIn(page, '/');
  for (const locale of ['ar', 'en'] as const) {
    await setLocale(page, locale);
    for (const width of widths) {
      if (width) await page.setViewportSize({ width, height: 960 });
      const tag = `${width ?? 'mobile'}-${locale}`;
      for (const [path, name] of PAGES) {
        await page.goto(path);
        await settle(page);
        await shot(`${name}-${tag}`);
      }
      if (!ALL) continue;

      await page.goto('/team/admins');
      await settle(page);
      await page.locator('a[href^="/team/admins/"]').filter({ visible: true }).first().click();
      await expect(page).toHaveURL(/\/team\/admins\/[a-f0-9]{24}/);
      await settle(page);
      await shot(`admin-detail-${tag}`);

      for (const [path, name, label] of [
        ['/locations/countries', 'country-add', locale === 'ar' ? 'إضافة دولة' : 'Add country'],
        ['/locations/cities', 'city-add', locale === 'ar' ? 'إضافة مدينة' : 'Add city'],
      ] as const) {
        await page.goto(path);
        await settle(page);
        await page.getByRole('button', { name: label, exact: true }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await settle(page);
        await shot(`${name}-${tag}`);
        await page.keyboard.press('Escape');
      }
    }
  }
});
