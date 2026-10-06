import type { Page } from '@playwright/test';
import { E2E_BACKEND_URL } from './support/constants';
import {
  backendAdminToken,
  expect,
  expectNoHorizontalScroll,
  setLocale,
  signIn,
  test,
} from './support/fixtures';

const PAGE = '/settings/pricing';
const VAT = 'نسبة الضريبة (٪)';
const MIN = 'الحد الأدنى للسعر';

async function storedSettings() {
  const response = await fetch(`${E2E_BACKEND_URL}/api/app-settings`, {
    headers: { authorization: `Bearer ${await backendAdminToken()}` },
  });
  return response.status === 404
    ? null
    : ((await response.json()) as { data: { vatRate: number; minPrice: number } }).data;
}

/** Sets both values directly on the backend so each test starts from a known state. */
async function storeSettings(values: { vatRate: number; minPrice: number }) {
  const response = await fetch(`${E2E_BACKEND_URL}/api/app-settings`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${await backendAdminToken()}`,
    },
    body: JSON.stringify(values),
  });
  expect(response.status).toBe(200);
}

/** Collects the bodies of PATCH requests sent by the page. */
function watchPatches(page: Page) {
  const bodies: unknown[] = [];
  page.on('request', (request) => {
    if (request.method() === 'PATCH' && request.url().endsWith('/bff/api/app-settings')) {
      bodies.push(request.postDataJSON());
    }
  });
  return bodies;
}

async function submit(page: Page, values: { vat?: string; min?: string }) {
  if (values.vat !== undefined) await page.getByLabel(VAT).fill(values.vat);
  if (values.min !== undefined) await page.getByLabel(MIN).fill(values.min);
  await page.getByRole('button', { name: 'حفظ' }).click();
}

const savedToast = (page: Page) =>
  page.getByRole('status').filter({ hasText: 'تم حفظ إعدادات التسعير.' });

test.describe('pricing settings', () => {
  test.describe('first save on an empty database', () => {
    test('saving only the tax sends only vatRate (and the backend fills minPrice with 0)', async ({
      page,
    }) => {
      const before = await storedSettings();
      await signIn(page, PAGE);
      const patches = watchPatches(page);
      const vat = before?.vatRate === 14 ? '7.5' : '14';

      // Before the first save the minimum price may stay empty; it is then not sent.
      if (before === null) await expect(page.getByLabel(MIN)).toHaveValue('');
      await submit(page, { vat });
      await expect(savedToast(page)).toBeVisible();
      expect(patches).toEqual([{ vatRate: Number(vat) }]);

      const after = await storedSettings();
      expect(after?.vatRate).toBe(Number(vat));
      if (before === null) {
        // Characterizes current backend behavior (documented, not changed in this slice):
        // the first save creates the settings document and its schema default sets
        // minPrice to 0 although the UI never sent it.
        expect(after?.minPrice).toBe(0);
        await expect(page.getByLabel(MIN)).toHaveValue('0');
        console.log('[characterization] first PATCH {vatRate} created minPrice =', after?.minPrice);
      }
    });
  });

  test.describe('with stored settings', () => {
    test.beforeEach(async ({ page }) => {
      await storeSettings({ vatRate: 14, minPrice: 500 });
      await signIn(page, PAGE);
      await expect(page.getByLabel(VAT)).toHaveValue('14');
      await expect(page.getByLabel(MIN)).toHaveValue('500');
    });

    test('states plainly that values are stored only, with no currency, basis or meaning of 0', async ({
      page,
    }) => {
      await expect(
        page.getByText(
          'تُحفظ هذه القيم فقط في الوقت الحالي. لا توجد بعد رحلة حجز أو تسعير تستخدمها',
        ),
      ).toBeVisible();
      const main = page.getByRole('main');
      await expect(main).toContainText('المحفوظ حاليًا');
      for (const word of ['ج.م', 'EGP', 'جنيه', 'لليلة', 'الليلة', 'عملة', 'تعطيل']) {
        await expect(main, word).not.toContainText(word);
      }
    });

    test('changing only the tax sends only vatRate', async ({ page }) => {
      const patches = watchPatches(page);
      await submit(page, { vat: '15' });
      await expect(savedToast(page)).toBeVisible();
      expect(patches).toEqual([{ vatRate: 15 }]);
      expect(await storedSettings()).toEqual({ vatRate: 15, minPrice: 500 });
    });

    test('changing only the minimum price sends only minPrice, decimals included', async ({
      page,
    }) => {
      const patches = watchPatches(page);
      await submit(page, { min: '750.5' });
      await expect(savedToast(page)).toBeVisible();
      await expect(page.getByLabel(MIN)).toHaveValue('750.5');
      await submit(page, { min: '٥٠٠٫٧٥' }); // Arabic-Indic digits and separator
      await expect(page.getByLabel(MIN)).toHaveValue('500.75');
      expect(patches).toEqual([{ minPrice: 750.5 }, { minPrice: 500.75 }]);
      expect(await storedSettings()).toEqual({ vatRate: 14, minPrice: 500.75 });
    });

    test('changing both sends both; 0 is a valid value for each', async ({ page }) => {
      const patches = watchPatches(page);
      await submit(page, { vat: '0', min: '0' });
      await expect(savedToast(page)).toBeVisible();
      expect(patches).toEqual([{ vatRate: 0, minPrice: 0 }]);
      expect(await storedSettings()).toEqual({ vatRate: 0, minPrice: 0 });
    });

    test('enforces the documented limits without sending anything', async ({ page }) => {
      const patches = watchPatches(page);
      const cases: [{ vat?: string; min?: string }, string, string][] = [
        [{ vat: '25.01' }, VAT, 'أدخل رقمًا لا يزيد عن 25.'],
        [{ vat: '-1' }, VAT, 'أدخل رقمًا لا يقل عن 0.'],
        [{ vat: '14.555' }, VAT, 'أدخل رقمًا بمنزلتين عشريتين كحد أقصى'],
        [{ vat: '' }, VAT, 'هذا الحقل مطلوب.'],
        [{ vat: '14', min: '-0.01' }, MIN, 'أدخل رقمًا لا يقل عن 0.'],
        [{ min: '500.555' }, MIN, 'أدخل رقمًا بمنزلتين عشريتين كحد أقصى'],
        [{ min: 'abc' }, MIN, 'أدخل رقمًا بمنزلتين عشريتين كحد أقصى'],
        [{ min: '' }, MIN, 'هذا الحقل مطلوب.'],
      ];
      for (const [values, field, message] of cases) {
        await submit(page, values);
        await expect(page.getByText(message), JSON.stringify(values)).toBeVisible();
        await expect(page.getByLabel(field)).toHaveAttribute('aria-invalid', 'true');
      }
      expect(patches).toEqual([]);
    });

    test('nothing changed sends nothing; a later invalid attempt replaces that message', async ({
      page,
    }) => {
      const patches = watchPatches(page);
      await submit(page, { vat: '14.00', min: '500' });
      await expect(page.getByRole('main').getByRole('alert')).toContainText('لم تغيّر أي حقل بعد.');
      expect(patches).toEqual([]);

      await submit(page, { min: '500.555' });
      await expect(page.getByText('أدخل رقمًا بمنزلتين عشريتين كحد أقصى')).toBeVisible();
      await expect(page.getByText('لم تغيّر أي حقل بعد.')).toHaveCount(0);
    });

    test('a failed save keeps both inputs, is sent once, and can be retried', async ({ page }) => {
      let attempts = 0;
      await page.route('**/bff/api/app-settings', (route) => {
        if (route.request().method() !== 'PATCH') return route.fallback();
        attempts += 1;
        return route.abort('timedout');
      });
      await submit(page, { vat: '9.25', min: '640' });
      await expect(page.getByRole('main').getByRole('alert')).toContainText('تعذّر الاتصال');
      await expect(page.getByLabel(VAT)).toHaveValue('9.25');
      await expect(page.getByLabel(MIN)).toHaveValue('640');
      expect(attempts).toBe(1);

      await page.unroute('**/bff/api/app-settings');
      await page.getByRole('button', { name: 'حفظ' }).click();
      await expect(savedToast(page)).toBeVisible();
      expect(await storedSettings()).toEqual({ vatRate: 9.25, minPrice: 640 });
    });

    test('works in English, left to right, from the menu, no horizontal scroll', async ({
      page,
      isMobile,
    }) => {
      await setLocale(page, 'en');
      await page.goto('/locations/countries');
      if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click();
      await page.getByRole('link', { name: 'Pricing settings' }).filter({ visible: true }).click();
      await expect(page).toHaveURL(new RegExp(PAGE));
      await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
      await expect(
        page.getByRole('heading', { name: 'Pricing settings', exact: true }),
      ).toBeVisible();
      await expect(page.getByLabel('Minimum price')).toHaveValue('500');
      await page.getByLabel('Minimum price').fill('-5');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText('Enter a number of at least 0.')).toBeVisible();
      await expectNoHorizontalScroll(page);
    });
  });

  test('before the first save, shows "not saved yet" with empty fields', async ({ page }) => {
    await signIn(page, PAGE);
    // Simulated at the BFF boundary: earlier tests have already saved settings.
    await page.route('**/bff/api/app-settings', (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            kind: 'not_found',
            status: 404,
            formErrors: [{ code: 'app-settings.APP_SETTINGS_NOT_FOUND' }],
            fieldErrors: {},
          },
        }),
      });
    });
    await page.reload();
    await expect(page.getByText('لم تُحفظ إعدادات التسعير بعد.')).toBeVisible();
    await expect(page.getByLabel(VAT)).toHaveValue('');
    await expect(page.getByLabel(MIN)).toHaveValue('');
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  });
});
