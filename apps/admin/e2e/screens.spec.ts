import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { insertAdmins } from './support/e2e-db';
import { expect, seed, setLocale, signIn, test } from './support/fixtures';

// Review screenshots for the phase report. Run alone on a fresh e2e database:
//   CAPTURE_SCREENS=1 pnpm exec playwright test e2e/screens.spec.ts
const OUT = fileURLToPath(new URL('../../../docs/phase-1/screens/', import.meta.url));

test.skip(!process.env.CAPTURE_SCREENS, 'Set CAPTURE_SCREENS=1 to capture review screenshots.');

interface Country {
  id: string;
  name: string;
}

const shot = (page: Page, project: string, name: string) =>
  page.screenshot({ path: `${OUT}${project}-${name}.png`, fullPage: true, animations: 'disabled' });

test('capture review screens', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  mkdirSync(OUT, { recursive: true });
  const project = testInfo.project.name;

  if (project === 'desktop') {
    // Realistic reference data, including Arabic and long names.
    const egypt = await seed<Country>('/countries', { name: 'Egypt', code: 'EG' });
    const saudi = await seed<Country>('/countries', { name: 'Saudi Arabia', code: 'SA' });
    await seed('/countries', { name: 'United Arab Emirates', code: 'AE' });
    await seed('/countries', { name: 'المغرب', code: 'MA' });
    await seed('/countries', { name: 'Saint Vincent and the Grenadines', code: 'VC' });
    for (const name of ['Cairo', 'Alexandria', 'الأقصر', 'Sharm El Sheikh']) {
      await seed('/cities', { name, country: egypt.id });
    }
    for (const name of ['Riyadh', 'Jeddah', 'العُلا'])
      await seed('/cities', { name, country: saudi.id });
    for (const [name, currencyCode] of [
      ['Egyptian Pound', 'EGP'],
      ['Saudi Riyal', 'SAR'],
      ['UAE Dirham', 'AED'],
      ['US Dollar', 'USD'],
      ['درهم مغربي', 'MAD'],
      ['Bosnia and Herzegovina Convertible Mark', 'BAM'],
    ]) {
      await seed('/currencies', { name, currencyCode });
    }
    await insertAdmins([
      { name: 'سارة الحربي', email: 'sara.alharbi@example.com', isSuperAdmin: false },
      { name: 'Omar Khaled', email: 'omar.khaled@example.com', isSuperAdmin: false },
      {
        name: 'منى عبد الرحمن السيد',
        email: 'mona.abdelrahman.elsayed@example.com',
        isSuperAdmin: true,
      },
    ]);
  }

  await page.goto('/login');
  await shot(page, project, 'ar-login');
  await page.getByLabel('البريد الإلكتروني').fill('admin@example.com');
  await page.getByLabel('كلمة المرور', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
  await shot(page, project, 'ar-login-error');

  await signIn(page);
  await expect(page.getByText('Egypt').filter({ visible: true })).toBeVisible();
  await shot(page, project, 'ar-countries');

  await page.getByRole('button', { name: 'إضافة دولة' }).first().click();
  await page.getByRole('dialog').getByLabel('اسم الدولة').fill('Eg');
  await page.getByRole('dialog').getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByText('أدخل 3 أحرف على الأقل.')).toBeVisible();
  await shot(page, project, 'ar-country-dialog-errors');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'حذف Egypt' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('سيتم حذف');
  await shot(page, project, 'ar-country-delete');
  await page.getByRole('alertdialog').getByRole('button', { name: 'إلغاء' }).click();

  await page.goto('/locations/cities');
  await expect(page.getByText('Cairo').filter({ visible: true })).toBeVisible();
  await shot(page, project, 'ar-cities');

  await page.goto('/catalog/currencies');
  await expect(page.getByText('Egyptian Pound').filter({ visible: true })).toBeVisible();
  await shot(page, project, 'ar-currencies');
  await page.getByRole('button', { name: 'إضافة عملة' }).first().click();
  await page.getByRole('dialog').getByLabel('اسم العملة').fill('Egyptian Pound');
  await page.getByRole('dialog').getByLabel('كود العملة').fill('egp');
  await page.getByRole('dialog').getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  await shot(page, project, 'ar-currency-conflict');
  await page.keyboard.press('Escape');

  await page.goto('/settings/pricing');
  await page.getByLabel('نسبة الضريبة (٪)').fill('14');
  await page.getByLabel('الحد الأدنى للسعر').fill('500');
  await page.getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByText(/المحفوظ حاليًا/)).toContainText('500');
  await shot(page, project, 'ar-pricing-settings');
  await page.getByLabel('الحد الأدنى للسعر').fill('-5');
  await page.getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByLabel('الحد الأدنى للسعر')).toHaveAttribute('aria-invalid', 'true');
  await shot(page, project, 'ar-pricing-settings-error');

  await page.goto('/team/admins');
  await expect(page.getByText('(أنت)').filter({ visible: true })).toBeVisible();
  await shot(page, project, 'ar-admins');
  await page.getByRole('link', { name: /^عرض / }).filter({ visible: true }).first().click();
  await expect(page.getByText('معرّف الحساب')).toBeVisible();
  await shot(page, project, 'ar-admin-detail');

  if (project === 'mobile') {
    await page.getByRole('button', { name: 'فتح القائمة' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await shot(page, project, 'ar-menu');
    await page.keyboard.press('Escape');
  }

  await setLocale(page, 'en');
  await page.goto('/locations/countries');
  await expect(page.getByRole('heading', { name: 'Countries' })).toBeVisible();
  await shot(page, project, 'en-countries');
  await page.goto('/catalog/currencies');
  await expect(page.getByRole('heading', { name: 'Currencies', exact: true })).toBeVisible();
  await shot(page, project, 'en-currencies');
  await page.goto('/settings/pricing');
  await expect(page.getByLabel('VAT rate (%)')).toBeVisible();
  await shot(page, project, 'en-pricing-settings');
  await page.goto('/team/admins');
  await expect(page.getByRole('heading', { name: 'Admin team', exact: true })).toBeVisible();
  await shot(page, project, 'en-admins');
});
