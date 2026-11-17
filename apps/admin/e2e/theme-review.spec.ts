import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { ADMIN_URL, E2E_BACKEND_URL } from './support/constants';
import { backendAdminToken, expect, setLocale, signIn, test } from './support/fixtures';
import { seedReviewData } from './support/review-data';

// Light and Dark captures of the focused sample (home, countries, account menu, profile,
// sign-in with the theme selector) at 1440 and 1920 px and on a phone, in Arabic and English.
//   CAPTURE_THEME=1 THEME_OUT=proposal E2E_ADMIN_PORT=4200 pnpm exec playwright test e2e/theme-review.spec.ts
const STAGE = process.env.THEME_OUT ?? 'proposal';
const OUT = fileURLToPath(new URL(`../../../docs/ui-review/theme/${STAGE}/`, import.meta.url));
test.skip(!process.env.CAPTURE_THEME, 'Set CAPTURE_THEME=1 to capture theme screenshots.');
// THEMES=dark captures one theme only (default: light and dark).
const THEMES = (process.env.THEMES ?? 'light,dark').split(',') as ('light' | 'dark')[];

// Synthetic account for truncation and wrapping: only the browser's copy of the session
// response is rewritten; nothing is stored.
const LONG = {
  name: 'Alexandria Montgomery-Fitzgerald Al-Rashidi',
  email: 'alexandria.montgomery-fitzgerald@operations.example-hospitality.com',
};

async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.context().addCookies([{ name: 'admin_theme', value: theme, url: ADMIN_URL }]);
}

test('theme sample at real widths', async ({ page }, testInfo) => {
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
  const mobile = testInfo.project.name === 'mobile';
  const widths = mobile ? [null] : [1440, 1920];
  const shot = (name: string, fullPage = true) =>
    page.screenshot({ path: `${OUT}${name}.png`, fullPage, animations: 'disabled' });

  for (const theme of THEMES) {
    await setTheme(page, theme);
    for (const locale of ['ar', 'en'] as const) {
      await setLocale(page, locale);
      for (const width of widths) {
        if (width) await page.setViewportSize({ width, height: 960 });
        await page.goto('/login');
        await settle(page);
        await shot(`login-${width ?? 'mobile'}-${locale}-${theme}`);
      }
    }
  }

  await signIn(page, '/');
  for (const theme of THEMES) {
    await setTheme(page, theme);
    for (const locale of ['ar', 'en'] as const) {
      await setLocale(page, locale);
      for (const width of widths) {
        if (width) await page.setViewportSize({ width, height: 960 });
        const tag = `${width ?? 'mobile'}-${locale}-${theme}`;
        for (const [path, name] of [
          ['/', 'home'],
          ['/locations/countries', 'countries'],
          ['/account', 'profile'],
        ] as const) {
          await page.goto(path);
          await settle(page);
          await shot(`${name}-${tag}`);
        }
        // An open form: the add-country dialog (a bottom sheet on phones).
        await page.goto('/locations/countries');
        await settle(page);
        await page
          .getByRole('button', { name: locale === 'ar' ? 'إضافة دولة' : 'Add country' })
          .click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.waitForTimeout(300);
        await shot(`country-form-${tag}`, false);
        await page.keyboard.press('Escape');

        // The account menu, opened from the sidebar (from the drawer on phones).
        await page.goto('/');
        await settle(page);
        if (mobile) {
          await page
            .getByRole('button', { name: locale === 'ar' ? 'فتح القائمة' : 'Open menu' })
            .click();
        }
        await page.locator('.account-trigger').filter({ visible: true }).click();
        await expect(page.locator('.account-panel')).toBeVisible();
        await page.waitForTimeout(300);
        await shot(`account-menu-${tag}`, false);
      }
    }
  }

  // Long synthetic name and email: the compact trigger truncates, the panel wraps safely.
  await page.route('**/bff/session', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const response = await route.fetch();
    const body = (await response.json()) as { subject?: Record<string, unknown> };
    if (body.subject) Object.assign(body.subject, LONG);
    await route.fulfill({ response, json: body });
  });
  for (const locale of ['ar', 'en'] as const) {
    await setLocale(page, locale);
    await setTheme(page, 'light');
    if (!mobile) await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto('/');
    await settle(page);
    if (mobile) {
      await page
        .getByRole('button', { name: locale === 'ar' ? 'فتح القائمة' : 'Open menu' })
        .click();
    }
    await shot(`long-account-trigger-${mobile ? 'mobile' : '1440'}-${locale}`, false);
    await page.locator('.account-trigger').filter({ visible: true }).click();
    await expect(page.locator('.account-panel')).toBeVisible();
    await page.waitForTimeout(300);
    await shot(`long-account-menu-${mobile ? 'mobile' : '1440'}-${locale}`, false);
  }
});
