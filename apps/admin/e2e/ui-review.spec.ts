import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { insertAdmins } from './support/e2e-db';
import { admin, expect, seed, setLocale, signIn, test } from './support/fixtures';

// Visual review of every admin screen, Arabic and English, desktop and mobile. The same
// data and steps produce the "before" and "after" sets of the UI redesign report:
//   CAPTURE_REVIEW=1 REVIEW_OUT=before E2E_ADMIN_PORT=4200 pnpm exec playwright test e2e/ui-review.spec.ts
const STAGE = process.env.REVIEW_OUT ?? 'current';
const OUT = fileURLToPath(new URL(`../../../docs/ui-review/${STAGE}/`, import.meta.url));

test.skip(!process.env.CAPTURE_REVIEW, 'Set CAPTURE_REVIEW=1 to capture review screenshots.');

interface Created {
  id: string;
}

/** Seeds once per database; a conflict means the data is already there. */
async function seedOnce<T extends Created>(path: string, body: unknown): Promise<T | undefined> {
  try {
    return await seed<T>(path, body);
  } catch {
    return undefined;
  }
}

async function seedReviewData() {
  const egypt = await seedOnce('/countries', { name: 'Egypt', code: 'EG' });
  const saudi = await seedOnce('/countries', { name: 'Saudi Arabia', code: 'SA' });
  await seedOnce('/countries', { name: 'United Arab Emirates', code: 'AE' });
  await seedOnce('/countries', { name: 'المغرب', code: 'MA' });
  await seedOnce('/countries', { name: 'Saint Vincent and the Grenadines', code: 'VC' });
  await seedOnce('/countries', { name: 'الأردن', code: 'JO' });
  if (egypt) {
    for (const name of ['Cairo', 'Alexandria', 'الأقصر', 'Sharm El Sheikh']) {
      await seedOnce('/cities', { name, country: egypt.id });
    }
  }
  if (saudi) {
    for (const name of ['Riyadh', 'Jeddah', 'العُلا']) {
      await seedOnce('/cities', { name, country: saudi.id });
    }
  }
  for (const [name, currencyCode] of [
    ['Egyptian Pound', 'EGP'],
    ['Saudi Riyal', 'SAR'],
    ['درهم إماراتي', 'AED'],
    ['US Dollar', 'USD'],
  ]) {
    await seedOnce('/currencies', { name, currencyCode });
  }
  for (const name of ['Apartment', 'Villa', 'شاليه', 'Studio']) {
    await seedOnce('/unit-categories', { name });
  }
  try {
    await insertAdmins([
      { name: 'Omar Khaled', email: 'omar.khaled@example.com', isSuperAdmin: false },
      { name: 'سارة الحربي', email: 'sara.alharbi@example.com', isSuperAdmin: false },
      { name: 'منى عبد الرحمن السيد', email: 'mona.elsayed@example.com', isSuperAdmin: true },
    ]);
  } catch {
    // Already inserted by an earlier run on this database.
  }
}

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `${OUT}${name}.png`, fullPage: true, animations: 'disabled' });

/** Lets fonts, data and entry transitions settle before a capture. */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

test('capture every admin screen', async ({ page, isMobile }, testInfo) => {
  test.setTimeout(300_000);
  mkdirSync(OUT, { recursive: true });
  await seedReviewData();
  const device = testInfo.project.name;

  for (const locale of ['ar', 'en'] as const) {
    const at = (name: string) => `${device}-${locale}-${name}`;
    await page.context().clearCookies();
    await setLocale(page, locale);

    // Login: empty, then a wrong password (the form keeps the email).
    await page.goto('/login');
    await settle(page);
    await shot(page, at('01-login'));
    await page.locator('input[type="email"]').fill(admin().email);
    await page.locator('input[type="password"]').fill('wrong-password-1');
    await page.locator('form button[type="submit"]').click();
    await page.waitForTimeout(1500);
    await shot(page, at('02-login-error'));

    await signIn(page, '/');
    await setLocale(page, locale);
    await page.goto('/');
    await settle(page);
    await shot(page, at('03-home'));

    if (isMobile) {
      const menu = page.getByRole('button', {
        name: locale === 'ar' ? 'فتح القائمة' : 'Open menu',
      });
      if (await menu.isVisible()) {
        await menu.click();
        await page.waitForTimeout(500);
        await shot(page, at('04-mobile-menu'));
        await page.keyboard.press('Escape');
      }
    }

    // Countries: list, add, edit, delete confirmation, no results.
    await page.goto('/locations/countries');
    await settle(page);
    await shot(page, at('10-countries'));
    const add = page.getByRole('button', { name: locale === 'ar' ? 'إضافة دولة' : 'Add country' });
    if (await add.isVisible()) {
      await add.click();
      await page.waitForTimeout(500);
      await shot(page, at('11-country-add'));
      await page.locator('[role="dialog"] button[type="submit"]').click();
      await page.waitForTimeout(500);
      await shot(page, at('12-country-add-errors'));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
    const edit = page.getByRole('button', { name: new RegExp(locale === 'ar' ? 'تعديل' : 'Edit') });
    if (await edit.first().isVisible()) {
      await edit.first().click();
      await page.waitForTimeout(500);
      await shot(page, at('13-country-edit'));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
    const remove = page.getByRole('button', {
      name: new RegExp(locale === 'ar' ? 'حذف' : 'Delete'),
    });
    if (await remove.first().isVisible()) {
      await remove.first().click();
      await page.waitForTimeout(800);
      await shot(page, at('14-country-delete'));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
    await page.goto('/locations/countries?name=zzzz-no-such-country');
    await settle(page);
    await shot(page, at('15-countries-no-results'));

    for (const [route, name] of [
      ['/locations/cities', '20-cities'],
      ['/catalog/currencies', '30-currencies'],
      ['/catalog/unit-categories', '40-accommodation-types'],
      ['/settings/pricing', '50-pricing'],
      ['/team/admins', '60-admins'],
    ] as const) {
      await page.goto(route);
      await settle(page);
      await shot(page, at(name));
    }
    const view = page.getByRole('link', { name: new RegExp(admin().name) }).first();
    const detail = page.locator('a[href^="/team/admins/"]').first();
    await ((await view.isVisible()) ? view : detail).click();
    await expect(page).toHaveURL(/\/team\/admins\/[a-f0-9]{24}/);
    await settle(page);
    await shot(page, at('61-admin-detail'));

    await page.goto('/locations/cities');
    await settle(page);
    await page.getByRole('button', { name: locale === 'ar' ? 'إضافة مدينة' : 'Add city' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await settle(page);
    await shot(page, at('21-city-add'));

    await page.goto('/account');
    await settle(page);
    await shot(page, at('70-account'));
  }
});
