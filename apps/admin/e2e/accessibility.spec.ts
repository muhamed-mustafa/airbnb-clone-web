import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import {
  expect,
  expectNoHorizontalScroll,
  seed,
  setLocale,
  signIn,
  test,
  unique,
  uniqueCode,
} from './support/fixtures';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectNoAxeViolations(page: Page, label: string) {
  // Audit the settled visual state. Ignore indefinite decorative/loading animations.
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const summary = results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes.length} node(s): ${violation.nodes.map((node) => `${node.target.join(', ')}: ${node.failureSummary}`).join('; ')}`,
  );
  expect(summary, `axe violations on ${label}`).toEqual([]);
}

test.describe('accessibility', () => {
  test('login has no WCAG A/AA violations in Arabic and English', async ({ page }) => {
    await page.goto('/login');
    await expectNoAxeViolations(page, 'login ar');
    await expectNoHorizontalScroll(page);
    await setLocale(page, 'en');
    await page.reload();
    await expectNoAxeViolations(page, 'login en');
  });

  test('lists and dialogs have no WCAG A/AA violations', async ({ page }) => {
    await seed('/countries', { name: unique('Axe land'), code: uniqueCode() });
    await signIn(page);
    await expect(page.getByRole('table').or(page.getByRole('list')).first()).toBeVisible();
    await expectNoAxeViolations(page, 'countries');
    await expectNoHorizontalScroll(page);

    await page.getByRole('button', { name: 'إضافة دولة' }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'حفظ' }).click();
    await expect(page.getByText('هذا الحقل مطلوب.').first()).toBeVisible();
    await expectNoAxeViolations(page, 'country dialog with errors');
    await page.keyboard.press('Escape');

    await page.goto('/locations/cities');
    await expect(page.getByRole('heading', { name: 'المدن' })).toBeVisible();
    await expectNoAxeViolations(page, 'cities');
    await expectNoHorizontalScroll(page);

    await page.goto('/catalog/currencies');
    await expect(page.getByRole('heading', { name: 'العملات', exact: true })).toBeVisible();
    await expectNoAxeViolations(page, 'currencies');
    await expectNoHorizontalScroll(page);
    await page.getByRole('button', { name: 'إضافة عملة' }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'حفظ' }).click();
    await expect(page.getByText('هذا الحقل مطلوب.').first()).toBeVisible();
    await expectNoAxeViolations(page, 'currency dialog with errors');
    await page.keyboard.press('Escape');

    await page.goto('/settings/pricing');
    await expect(page.getByLabel('نسبة الضريبة (٪)')).toBeVisible();
    await expectNoAxeViolations(page, 'pricing settings');
    await expectNoHorizontalScroll(page);
    await page.getByLabel('نسبة الضريبة (٪)').fill('99');
    await page.getByRole('button', { name: 'حفظ' }).click();
    await expect(page.getByText('أدخل رقمًا لا يزيد عن 25.')).toBeVisible();
    await expectNoAxeViolations(page, 'pricing settings with an error');

    await page.goto('/team/admins');
    await expect(page.getByRole('heading', { name: 'فريق الإدارة', exact: true })).toBeVisible();
    await expect(
      page.getByRole('link', { name: /^عرض / }).filter({ visible: true }).first(),
    ).toBeVisible();
    await expectNoAxeViolations(page, 'admin team');
    await expectNoHorizontalScroll(page);
    await page.getByRole('link', { name: /^عرض / }).filter({ visible: true }).first().click();
    await expect(page.getByText('معرّف الحساب')).toBeVisible();
    await expectNoAxeViolations(page, 'admin detail');
  });

  test('keyboard only: add a country and get focus back where it started', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Hardware keyboard flow is checked on desktop.');
    await signIn(page);

    // The skip link is the first stop and moves focus to the content.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'انتقل إلى المحتوى' })).toBeFocused();
    await page.keyboard.press('Enter');

    const add = page.getByRole('button', { name: 'إضافة دولة' }).first();
    await add.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'إضافة دولة' });
    await expect(dialog.getByLabel('اسم الدولة')).toBeFocused();

    // Escape closes and returns focus to the button that opened the dialog.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(add).toBeFocused();

    await page.keyboard.press('Enter');
    const name = unique('Keyboard land');
    await page.keyboard.type(name);
    await page.keyboard.press('Tab');
    await page.keyboard.type(uniqueCode());
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('status').filter({ hasText: `تمت إضافة ${name}.` })).toBeVisible();
    await expect(add).toBeFocused();
  });

  test('mobile menu opens, traps focus and navigates', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile navigation only.');
    await signIn(page);
    await page.getByRole('button', { name: 'فتح القائمة' }).click();
    const menu = page.getByRole('dialog', { name: 'لوحة الإدارة' });
    await expect(menu).toBeVisible();
    await expectNoAxeViolations(page, 'mobile menu');
    await menu.getByRole('link', { name: 'المدن' }).click();
    await expect(page).toHaveURL(/\/locations\/cities/);
    await expect(menu).toBeHidden();
  });
});
