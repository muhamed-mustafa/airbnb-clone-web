import {
  expect,
  expectNoHorizontalScroll,
  seed,
  setLocale,
  signIn,
  test,
  unique,
  uniqueCurrencyCode,
} from './support/fixtures';

interface Currency {
  id: string;
  name: string;
  currencyCode: string;
}

const PAGE = '/catalog/currencies';

test.describe('currencies', () => {
  test.beforeEach(async ({ page }) => signIn(page, PAGE));

  test('create with validation, conflict that keeps input, then edit conflict on a field', async ({
    page,
  }) => {
    const existing = await seed<Currency>('/currencies', {
      name: unique('Existing coin'),
      currencyCode: uniqueCurrencyCode(),
    });
    await page.reload();

    await page.getByRole('button', { name: 'إضافة عملة' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'إضافة عملة' });
    await expect(dialog.getByLabel('اسم العملة')).toBeFocused();

    // Limits from the OpenAPI contract: name 3–50, currencyCode exactly 3.
    await dialog.getByLabel('اسم العملة').fill('ab');
    await dialog.getByLabel('كود العملة').fill('eg');
    await dialog.getByRole('button', { name: 'حفظ' }).click();
    await expect(dialog.getByText('أدخل 3 أحرف على الأقل.')).toBeVisible();
    await expect(dialog.getByText('أدخل 3 أحرف بالضبط.')).toBeVisible();

    // Three characters, but not Latin letters: rejected before any request (D10).
    for (const invalid of ['123', 'a$b']) {
      await dialog.getByLabel('كود العملة').fill(invalid);
      await dialog.getByRole('button', { name: 'حفظ' }).click();
      await expect(dialog.getByText('استخدم حروفًا لاتينية فقط (A–Z).')).toBeVisible();
    }

    // Duplicate code on create: no field from the backend (D2) → form-level message.
    const name = unique('New coin');
    await dialog.getByLabel('اسم العملة').fill(name);
    await dialog.getByLabel('كود العملة').fill(existing.currencyCode.toLowerCase());
    await dialog.getByRole('button', { name: 'حفظ' }).click();
    await expect(dialog.getByRole('alert')).toContainText('توجد عملة بنفس الاسم أو الكود بالفعل.');
    await expect(dialog.getByLabel('اسم العملة')).toHaveValue(name);
    await expect(dialog.getByLabel('كود العملة')).toHaveValue(existing.currencyCode.toLowerCase());

    const code = uniqueCurrencyCode();
    await dialog.getByLabel('كود العملة').fill(code);
    await dialog.getByRole('button', { name: 'حفظ' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('status').filter({ hasText: `تمت إضافة ${name}.` })).toBeVisible();
    await expect(page.getByText(name, { exact: true }).filter({ visible: true })).toBeVisible();

    // Edit to an existing code: the update path returns the field → message under it.
    await page.getByRole('button', { name: `تعديل ${name}` }).click();
    const edit = page.getByRole('dialog', { name: `تعديل ${name}` });
    await edit.getByLabel('كود العملة').fill(existing.currencyCode);
    await edit.getByRole('button', { name: 'حفظ' }).click();
    await expect(edit.getByText('هذه القيمة مستخدمة بالفعل.')).toBeVisible();
    await expect(edit.getByLabel('كود العملة')).toHaveAttribute('aria-invalid', 'true');
    await expect(edit.getByLabel('اسم العملة')).toHaveValue(name);

    // The edit form applies the same Latin-letters rule.
    await edit.getByLabel('كود العملة').fill('A$B');
    await edit.getByRole('button', { name: 'حفظ' }).click();
    await expect(edit.getByText('استخدم حروفًا لاتينية فقط (A–Z).')).toBeVisible();

    await edit.getByLabel('كود العملة').fill(code);
    await edit.getByRole('button', { name: 'حفظ' }).click();
    await expect(edit.getByRole('alert')).toContainText('لم تغيّر أي حقل بعد.');
  });

  test('filters live in the URL with the backend parameter names', async ({ page }) => {
    const tag = unique('Filter').split(' ')[1]!;
    const alpha = await seed<Currency>('/currencies', {
      name: `Alpha ${tag}`,
      currencyCode: uniqueCurrencyCode(),
    });
    await seed('/currencies', { name: `Beta ${tag}`, currencyCode: uniqueCurrencyCode() });
    await page.reload();

    // Two letters are not a valid currency code: nothing is sent.
    const code = page.getByLabel('الكود');
    await code.fill(alpha.currencyCode.slice(0, 2));
    await page.waitForTimeout(600);
    await expect(page).not.toHaveURL(/currencyCode=/);

    await code.fill(alpha.currencyCode.toLowerCase());
    await expect(page).toHaveURL(new RegExp(`currencyCode=${alpha.currencyCode}`));
    await expect(
      page.getByText(`Alpha ${tag}`, { exact: true }).filter({ visible: true }),
    ).toBeVisible();
    await expect(
      page.getByText(`Beta ${tag}`, { exact: true }).filter({ visible: true }),
    ).toBeHidden();

    await page.reload();
    await expect(page.getByLabel('الكود')).toHaveValue(alpha.currencyCode);

    await page.getByRole('button', { name: 'مسح الفلاتر' }).click();
    await expect(page).toHaveURL(new RegExp(`${PAGE}$`));
    await page.getByLabel('بحث بالاسم').fill(`Beta ${tag}`);
    await expect(page).toHaveURL(new RegExp(`name=Beta\\+${tag}`));
    await expect(
      page.getByText(`Beta ${tag}`, { exact: true }).filter({ visible: true }),
    ).toBeVisible();
  });

  test('delete a currency', async ({ page }) => {
    const currency = await seed<Currency>('/currencies', {
      name: unique('Doomed coin'),
      currencyCode: uniqueCurrencyCode(),
    });
    await page.goto(`${PAGE}?currencyCode=${currency.currencyCode}`);

    await page.getByRole('button', { name: `حذف ${currency.name}` }).click();
    const confirm = page.getByRole('alertdialog', { name: `حذف ${currency.name}؟` });
    await expect(confirm.getByRole('button', { name: 'إلغاء' })).toBeFocused();
    await confirm.getByRole('button', { name: 'حذف العملة' }).click();

    await expect(confirm).toBeHidden();
    await expect(
      page.getByRole('status').filter({ hasText: `تم حذف ${currency.name}.` }),
    ).toBeVisible();
    await expect(page.getByText('لا توجد نتائج')).toBeVisible();
  });

  test('a permission error keeps the input and the session', async ({ page }) => {
    // The admin role always has access in this backend, so a 403 is simulated at the BFF
    // boundary with the exact body the BFF sends for a forbidden upstream response.
    await page.route('**/bff/api/currencies', (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            kind: 'forbidden',
            status: 403,
            formErrors: [{ code: 'errors.FORBIDDEN', serverMessage: 'Forbidden resource' }],
            fieldErrors: {},
          },
        }),
      });
    });
    await page.getByRole('button', { name: 'إضافة عملة' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'إضافة عملة' });
    const name = unique('Forbidden coin');
    await dialog.getByLabel('اسم العملة').fill(name);
    await dialog.getByLabel('كود العملة').fill('QQQ');
    await dialog.getByRole('button', { name: 'حفظ' }).click();

    await expect(dialog.getByRole('alert')).toContainText('لا تملك صلاحية لهذا الإجراء.');
    await expect(dialog.getByLabel('اسم العملة')).toHaveValue(name);
    await expect(dialog.getByLabel('كود العملة')).toHaveValue('QQQ');
    await expect(page).toHaveURL(new RegExp(PAGE));
    const session = await page.evaluate(() => fetch('/bff/session').then((r) => r.json()));
    expect(session.authenticated).toBe(true);
  });

  test('a failed save keeps everything typed and is sent once', async ({ page }) => {
    let posts = 0;
    await page.route('**/bff/api/currencies', (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      posts += 1;
      return route.abort('timedout');
    });
    await page.getByRole('button', { name: 'إضافة عملة' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'إضافة عملة' });
    const name = unique('Offline coin');
    await dialog.getByLabel('اسم العملة').fill(name);
    await dialog.getByLabel('كود العملة').fill('QQQ');
    await dialog.getByRole('button', { name: 'حفظ' }).click();

    await expect(dialog.getByRole('alert')).toContainText('تعذّر الاتصال');
    await expect(dialog.getByLabel('اسم العملة')).toHaveValue(name);
    await expect(dialog.getByLabel('كود العملة')).toHaveValue('QQQ');
    expect(posts).toBe(1);
  });

  test('works in English, left to right, reachable from the menu, no horizontal scroll', async ({
    page,
    isMobile,
  }) => {
    await setLocale(page, 'en');
    await page.goto('/locations/countries');
    if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('link', { name: 'Currencies' }).filter({ visible: true }).click();
    await expect(page).toHaveURL(new RegExp(PAGE));
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('heading', { name: 'Currencies', exact: true })).toBeVisible();
    // The current section is marked in the navigation (inside the menu on phones).
    if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(
      page.getByRole('link', { name: 'Currencies' }).filter({ visible: true }),
    ).toHaveAttribute('aria-current', 'page');
    await expectNoHorizontalScroll(page);
  });
});
