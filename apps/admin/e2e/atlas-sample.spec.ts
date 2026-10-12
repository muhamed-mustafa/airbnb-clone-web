import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Locator, Page } from '@playwright/test';
import { expect, setLocale, signIn, test } from './support/fixtures';
import { seedReviewData } from './support/review-data';

// The approved Atlas sample at full resolution (device pixels, no scaling), plus the
// button states it defines. Real app, isolated e2e data:
//   CAPTURE_SAMPLE=1 E2E_ADMIN_PORT=4200 pnpm exec playwright test e2e/atlas-sample.spec.ts
const OUT = fileURLToPath(new URL('../../../docs/ui-review/atlas-sample/', import.meta.url));

test.skip(!process.env.CAPTURE_SAMPLE, 'Set CAPTURE_SAMPLE=1 to capture the sample.');

const settle = async (page: Page) => {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
};

/** A tight crop around one control, with some breathing room. */
const crop = async (page: Page, target: Locator, path: string) => {
  const box = (await target.boundingBox())!;
  await page.screenshot({
    path,
    clip: { x: box.x - 12, y: box.y - 12, width: box.width + 24, height: box.height + 24 },
    animations: 'disabled',
  });
};

test('Atlas sample screens and states', async ({ page, isMobile }, info) => {
  test.setTimeout(240_000);
  mkdirSync(OUT, { recursive: true });
  await seedReviewData();
  const device = info.project.name;
  await signIn(page, '/');

  for (const locale of ['ar', 'en'] as const) {
    await setLocale(page, locale);
    const at = (name: string) => `${OUT}${device}-${locale}-${name}.png`;
    const shot = (name: string) =>
      page.screenshot({ path: at(name), fullPage: true, animations: 'disabled' });

    await page.goto('/');
    await settle(page);
    await shot('1-home');

    await page.goto('/locations/countries');
    await settle(page);
    await shot('2-countries');

    await page.goto('/locations/countries?name=Arab');
    await settle(page);
    await shot('3-countries-filtered');

    await page.goto('/locations/countries');
    await settle(page);
    const edit = page.getByRole('button', {
      name: locale === 'ar' ? 'تعديل Egypt' : 'Edit Egypt',
      exact: true,
    });
    await edit.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(300);
    await shot('4-country-edit');

    if (!isMobile && locale === 'en') {
      // Button states, cropped at full size.
      const save = dialog.getByRole('button', { name: 'Save', exact: true });
      const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true });
      await page.mouse.move(0, 0);
      await crop(page, save, at('state-primary-default'));
      await save.hover();
      await page.waitForTimeout(200);
      await crop(page, save, at('state-primary-hover'));
      await page.mouse.down();
      await page.waitForTimeout(150);
      await crop(page, save, at('state-primary-pressed'));
      await page.mouse.move(0, 0);
      await page.mouse.up();
      await cancel.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200);
      await crop(page, cancel, at('state-secondary-focus'));
      await cancel.hover();
      await page.waitForTimeout(200);
      await crop(page, cancel, at('state-secondary-hover'));

      // Loading: the request is held so the saving state can be seen; nothing is faked.
      await page.route('**/bff/api/countries/*', async (route) => {
        if (route.request().method() !== 'PATCH') return route.continue();
        await new Promise((done) => setTimeout(done, 1500));
        await route.continue();
      });
      await dialog.getByLabel('Country name', { exact: true }).fill('Egypt Arab Republic');
      await save.click();
      await page.waitForTimeout(250);
      await crop(page, dialog.getByRole('button', { name: /Saving/ }), at('state-primary-saving'));
      await expect(dialog).toBeHidden();
      await page.unroute('**/bff/api/countries/*');
      // Restore the seeded name for later captures.
      await page.getByRole('button', { name: 'Edit Egypt Arab Republic', exact: true }).click();
      await page.getByRole('dialog').getByLabel('Country name', { exact: true }).fill('Egypt');
      await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeHidden();
    } else {
      await page.keyboard.press('Escape');
    }

    await page.goto('/locations/countries');
    await settle(page);
    await page
      .getByRole('button', { name: locale === 'ar' ? 'حذف Egypt' : 'Delete Egypt', exact: true })
      .click();
    await page.waitForTimeout(500);
    await shot('5-country-delete');
    await page.keyboard.press('Escape');

    await page.goto('/account');
    await settle(page);
    await shot('6-profile');

    if (isMobile) {
      await page
        .getByRole('button', { name: locale === 'ar' ? 'فتح القائمة' : 'Open menu' })
        .click();
      await page.waitForTimeout(400);
      await shot('7-menu-account');
      await page.keyboard.press('Escape');
    }
  }
});
