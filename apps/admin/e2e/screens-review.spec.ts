import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { ADMIN_URL, E2E_BACKEND_URL } from './support/constants';
import { backendAdminToken, expect, setLocale, signIn, test } from './support/fixtures';
import { seedReviewData } from './support/review-data';

// Every remaining screen and state, Light and Dark, Arabic and English, desktop and phone,
// for the theme rollout review. Writes to docs/ui-review/theme/<SCREENS_OUT>/.
//   CAPTURE_SCREENS=1 SCREENS_OUT=rollout E2E_ADMIN_PORT=4200 pnpm exec playwright test e2e/screens-review.spec.ts
const STAGE = process.env.SCREENS_OUT ?? 'rollout';
const OUT = fileURLToPath(new URL(`../../../docs/ui-review/theme/${STAGE}/`, import.meta.url));
test.skip(!process.env.CAPTURE_SCREENS, 'Set CAPTURE_SCREENS=1 to capture review screenshots.');

type Messages = Record<string, Record<string, string>>;
const messages = (locale: 'ar' | 'en'): Messages =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../messages/${locale}.json`, import.meta.url)), 'utf8'),
  ) as Messages;

/** A message by namespace and key; a missing one fails loudly rather than matching nothing. */
function msg(m: Messages, namespace: string, key: string): string {
  const value = m[namespace]?.[key];
  if (typeof value !== 'string') throw new Error(`missing message ${namespace}.${key}`);
  return value;
}

async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}

test('remaining screens in both themes', async ({ page }, testInfo) => {
  test.setTimeout(1_800_000);
  mkdirSync(OUT, { recursive: true });
  await seedReviewData();
  const mobile = testInfo.project.name === 'mobile';
  const sizes = mobile ? [null] : [1440, 1920];
  const failures: string[] = [];
  const shot = (name: string, fullPage = true) =>
    page.screenshot({ path: `${OUT}${name}.png`, fullPage, animations: 'disabled' });
  // One failing step must not stop the rest of the review.
  const step = async (name: string, run: () => Promise<void>) => {
    try {
      await run();
    } catch (error) {
      failures.push(`${name}: ${(error as Error).message.split('\n')[0]}`);
      await page.keyboard.press('Escape').catch(() => undefined);
    }
  };

  for (const theme of ['light', 'dark'] as const) {
    await page.context().addCookies([{ name: 'admin_theme', value: theme, url: ADMIN_URL }]);
    for (const locale of ['ar', 'en'] as const) {
      const m = messages(locale);
      await setLocale(page, locale);
      for (const width of sizes) {
        if (width) await page.setViewportSize({ width, height: 960 });
        const tag = `${width ?? 'mobile'}-${locale}-${theme}`;

        // Signed out: validation on the sign-in form.
        await page.context().clearCookies({ name: /admin_session/ });
        await step(`login-errors-${tag}`, async () => {
          await page.goto('/login');
          await page.locator('form button[type="submit"]').click();
          await expect(page.locator('.field-error').first()).toBeVisible();
          await settle(page);
          await shot(`login-errors-${tag}`);
        });

        await signIn(page, '/locations/cities');
        await step(`cities-${tag}`, async () => {
          await settle(page);
          await shot(`cities-${tag}`);
        });
        await step(`city-form-picker-${tag}`, async () => {
          await page
            .getByRole('button', { name: msg(m, 'cities', 'add'), exact: true })
            .first()
            .click();
          const dialog = page.getByRole('dialog');
          await expect(dialog).toBeVisible();
          await dialog
            .getByRole('combobox')
            .or(dialog.getByRole('button', { name: msg(m, 'cities', 'chooseCountry') }))
            .first()
            .click();
          await page.waitForTimeout(400);
          await shot(`city-form-picker-${tag}`, false);
          await page.keyboard.press('Escape');
        });
        await step(`city-form-errors-${tag}`, async () => {
          const dialog = page.getByRole('dialog');
          if (!(await dialog.isVisible())) {
            await page
              .getByRole('button', { name: msg(m, 'cities', 'add'), exact: true })
              .first()
              .click();
          }
          await dialog.getByRole('button', { name: msg(m, 'common', 'save'), exact: true }).click();
          await expect(dialog.locator('.field-error').first()).toBeVisible();
          await page.waitForTimeout(300);
          await shot(`city-form-errors-${tag}`, false);
          await page.keyboard.press('Escape');
        });

        await step(`currencies-${tag}`, async () => {
          await page.goto('/catalog/currencies');
          await settle(page);
          await shot(`currencies-${tag}`);
        });
        await step(`currency-form-errors-${tag}`, async () => {
          await page
            .getByRole('button', { name: msg(m, 'currencies', 'add'), exact: true })
            .first()
            .click();
          const dialog = page.getByRole('dialog');
          await dialog.getByRole('button', { name: msg(m, 'common', 'save'), exact: true }).click();
          await expect(dialog.locator('.field-error').first()).toBeVisible();
          await page.waitForTimeout(300);
          await shot(`currency-form-errors-${tag}`, false);
          await page.keyboard.press('Escape');
        });

        await step(`types-${tag}`, async () => {
          await page.goto('/catalog/unit-categories');
          await settle(page);
          await shot(`types-${tag}`);
        });
        await step(`type-form-${tag}`, async () => {
          await page
            .getByRole('button', { name: msg(m, 'unitCategories', 'add'), exact: true })
            .first()
            .click();
          await expect(page.getByRole('dialog')).toBeVisible();
          await page.waitForTimeout(300);
          await shot(`type-form-${tag}`, false);
          await page.keyboard.press('Escape');
        });

        await step(`pricing-errors-${tag}`, async () => {
          await page.goto('/settings/pricing');
          await settle(page);
          await page.getByLabel(msg(m, 'pricingSettings', 'vatField')).fill('30');
          await page.getByRole('button', { name: msg(m, 'common', 'save'), exact: true }).click();
          await expect(page.locator('.field-error').first()).toBeVisible();
          await shot(`pricing-errors-${tag}`);
        });
        await step(`pricing-saving-${tag}`, async () => {
          // A value different from the one saved now, read through the page's own session
          // (BFF), so the save is really sent. A second backend sign-in here would revoke the
          // browser's session (the backend keeps one refresh token per admin).
          const current = (await (await page.request.get('/bff/api/app-settings')).json()) as {
            data?: { vatRate?: number };
          };
          const next = current.data?.vatRate === 14 ? 15 : 14;
          let release = () => {};
          const held = new Promise<void>((resolve) => (release = resolve));
          await page.route('**/bff/api/app-settings', async (route) => {
            if (route.request().method() !== 'PATCH') return route.fallback();
            await held;
            await route.fallback();
          });
          try {
            await page.getByLabel(msg(m, 'pricingSettings', 'vatField')).fill(String(next));
            await page.getByLabel(msg(m, 'pricingSettings', 'minPriceField')).fill('250');
            await page.getByRole('button', { name: msg(m, 'common', 'save'), exact: true }).click();
            await expect(page.locator('button[aria-busy="true"]')).toBeVisible();
            await shot(`pricing-saving-${tag}`, false);
            release();
            await expect(page.locator('.toast').first()).toBeVisible();
            await shot(`pricing-saved-toast-${tag}`, false);
          } finally {
            release();
            await page.unroute('**/bff/api/app-settings');
          }
        });

        await step(`admins-${tag}`, async () => {
          await page.goto('/team/admins');
          await settle(page);
          await shot(`admins-${tag}`);
        });
        await step(`admins-role-open-${tag}`, async () => {
          await page
            .getByRole('combobox', { name: msg(m, 'admins', 'filterRole') })
            .or(page.getByLabel(msg(m, 'admins', 'filterRole')))
            .first()
            .click();
          await page.waitForTimeout(400);
          await shot(`admins-role-open-${tag}`, false);
          await page.keyboard.press('Escape');
        });
        await step(`admin-detail-${tag}`, async () => {
          await page.locator('a[href^="/team/admins/"]').filter({ visible: true }).first().click();
          await expect(page).toHaveURL(/\/team\/admins\/[a-f0-9]{24}/);
          await settle(page);
          await shot(`admin-detail-${tag}`);
        });

        await step(`delete-confirm-${tag}`, async () => {
          await page.goto('/locations/countries');
          await settle(page);
          await page
            .getByRole('button', { name: new RegExp(`^${msg(m, 'common', 'delete')} `) })
            .filter({ visible: true })
            .first()
            .click();
          await expect(page.getByRole('alertdialog').or(page.getByRole('dialog'))).toBeVisible();
          await page.waitForTimeout(300);
          await shot(`delete-confirm-${tag}`, false);
          await page.keyboard.press('Escape');
        });
        await step(`no-results-${tag}`, async () => {
          await page.goto('/locations/countries?name=zzzz-no-such-country');
          await settle(page);
          await shot(`no-results-${tag}`);
        });
        await step(`loading-${tag}`, async () => {
          await page.route('**/bff/api/countries?*', async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 2500));
            await route.fallback();
          });
          await page.goto('/locations/countries');
          await expect(page.locator('.skeleton').first()).toBeVisible();
          await shot(`loading-${tag}`, false);
          await page.unroute('**/bff/api/countries?*');
        });
      }
    }
  }
  // Pricing back to its seeded values for later runs.
  await fetch(`${E2E_BACKEND_URL}/api/app-settings`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${await backendAdminToken()}`,
    },
    body: JSON.stringify({ vatRate: 14, minPrice: 250 }),
  });
  expect(failures, 'steps that could not be captured').toEqual([]);
});
