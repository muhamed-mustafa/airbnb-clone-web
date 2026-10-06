import {
  expect,
  expectNoHorizontalScroll,
  seed,
  signIn,
  test,
  unique,
  uniqueCode,
} from './support/fixtures';

interface Country {
  id: string;
  name: string;
  code: string;
}

test.describe('countries', () => {
  test.beforeEach(async ({ page }) => signIn(page));

  test('create with validation, conflict that keeps input, then edit conflict on a field', async ({
    page,
  }) => {
    const existing = await seed<Country>('/countries', {
      name: unique('Existing land'),
      code: uniqueCode(),
    });
    await page.reload();

    await page.getByRole('button', { name: 'إضافة دولة' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'إضافة دولة' });
    await expect(dialog.getByLabel('اسم الدولة')).toBeFocused();

    // Client-side validation with limits from the OpenAPI contract.
    await dialog.getByLabel('اسم الدولة').fill('ab');
    await dialog.getByLabel('كود الدولة').fill('x');
    await dialog.getByRole('button', { name: 'حفظ' }).click();
    await expect(dialog.getByText('أدخل 3 أحرف على الأقل.')).toBeVisible();
    await expect(dialog.getByText('أدخل 2 أحرف بالضبط.')).toBeVisible();
    await dialog.getByLabel('كود الدولة').fill('1a');
    await dialog.getByRole('button', { name: 'حفظ' }).click();
    await expect(dialog.getByText('استخدم حروفًا لاتينية فقط (A–Z).')).toBeVisible();

    // Duplicate code on create: the backend gives no field (D2), so the message is form-level.
    const name = unique('New land');
    await dialog.getByLabel('اسم الدولة').fill(name);
    await dialog.getByLabel('كود الدولة').fill(existing.code.toLowerCase());
    await dialog.getByRole('button', { name: 'حفظ' }).click();
    await expect(dialog.getByRole('alert')).toContainText('توجد دولة بنفس الاسم أو الكود بالفعل.');
    await expect(dialog.getByLabel('اسم الدولة')).toHaveValue(name);
    await expect(dialog.getByLabel('كود الدولة')).toHaveValue(existing.code.toLowerCase());

    const code = uniqueCode();
    await dialog.getByLabel('كود الدولة').fill(code);
    await dialog.getByRole('button', { name: 'حفظ' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('status').filter({ hasText: `تمت إضافة ${name}.` })).toBeVisible();
    await expect(page.getByText(name, { exact: true }).filter({ visible: true })).toBeVisible();

    // Edit to an existing code: the backend returns the field (update path), shown under it.
    await page.getByRole('button', { name: `تعديل ${name}` }).click();
    const edit = page.getByRole('dialog', { name: `تعديل ${name}` });
    await edit.getByLabel('كود الدولة').fill(existing.code);
    await edit.getByRole('button', { name: 'حفظ' }).click();
    await expect(edit.getByText('هذه القيمة مستخدمة بالفعل.')).toBeVisible();
    await expect(edit.getByLabel('كود الدولة')).toHaveAttribute('aria-invalid', 'true');

    // Saving without changes is caught before any request.
    await edit.getByLabel('كود الدولة').fill(code);
    await edit.getByRole('button', { name: 'حفظ' }).click();
    await expect(edit.getByRole('alert')).toContainText('لم تغيّر أي حقل بعد.');
    await page.keyboard.press('Escape');
    await expect(edit).toBeHidden();
  });

  test('filters live in the URL, survive reload and only send searchable values', async ({
    page,
  }) => {
    const tag = unique('Filter').split(' ')[1]!;
    await seed('/countries', { name: `Alpha ${tag}`, code: uniqueCode() });
    await seed('/countries', { name: `Beta ${tag}`, code: uniqueCode() });
    await page.reload();

    const search = page.getByLabel('بحث بالاسم');
    await search.fill('Al');
    await page.waitForTimeout(600);
    await expect(page).not.toHaveURL(/name=/);
    await expect(page.getByText('3 أحرف على الأقل')).toBeVisible();

    await search.fill(`Alpha ${tag}`);
    await expect(page).toHaveURL(new RegExp(`name=Alpha\\+${tag}`));
    await expect(
      page.getByText(`Alpha ${tag}`, { exact: true }).filter({ visible: true }),
    ).toBeVisible();
    await expect(
      page.getByText(`Beta ${tag}`, { exact: true }).filter({ visible: true }),
    ).toBeHidden();

    await page.reload();
    await expect(page.getByLabel('بحث بالاسم')).toHaveValue(`Alpha ${tag}`);
    await expect(
      page.getByText(`Beta ${tag}`, { exact: true }).filter({ visible: true }),
    ).toBeHidden();

    await page.getByRole('button', { name: 'مسح الفلاتر' }).click();
    await expect(page).toHaveURL(/\/locations\/countries$/);
    await expect(page.getByLabel('بحث بالاسم')).toHaveValue('');
  });

  test('delete shows how many cities go with it', async ({ page }) => {
    const country = await seed<Country>('/countries', {
      name: unique('Doomed land'),
      code: uniqueCode(),
    });
    await seed('/cities', { name: unique('First town'), country: country.id });
    await seed('/cities', { name: unique('Second town'), country: country.id });
    await page.goto(`/locations/countries?name=${encodeURIComponent(country.name)}`);

    await page.getByRole('button', { name: `حذف ${country.name}` }).click();
    const confirm = page.getByRole('alertdialog', { name: `حذف ${country.name}؟` });
    await expect(confirm).toContainText('سيتم حذف مدينتين تابعتين لها أيضًا.');
    await expect(confirm.getByRole('button', { name: 'إلغاء' })).toBeFocused();
    await confirm.getByRole('button', { name: 'حذف الدولة' }).click();

    await expect(confirm).toBeHidden();
    await expect(
      page.getByRole('status').filter({ hasText: `تم حذف ${country.name}.` }),
    ).toBeVisible();
    await expect(page.getByText('لا توجد نتائج')).toBeVisible();
  });

  test('a failed load shows an error with retry and keeps the session', async ({ page }) => {
    await page.route('**/bff/api/countries?*', (route) => route.abort('internetdisconnected'));
    await page.reload();
    await expect(page.getByRole('main').getByRole('alert')).toContainText('تعذّر الاتصال');

    await page.unroute('**/bff/api/countries?*');
    await page.getByRole('button', { name: 'إعادة المحاولة' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toBeHidden();
    await expect(page).toHaveURL(/\/locations\/countries/);
  });

  test('a failed save keeps everything typed and is not retried automatically', async ({
    page,
  }) => {
    let posts = 0;
    await page.route('**/bff/api/countries', (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      posts += 1;
      return route.abort('timedout');
    });
    await page.getByRole('button', { name: 'إضافة دولة' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'إضافة دولة' });
    const name = unique('Offline land');
    await dialog.getByLabel('اسم الدولة').fill(name);
    await dialog.getByLabel('كود الدولة').fill('QQ');
    await dialog.getByRole('button', { name: 'حفظ' }).click();

    await expect(dialog.getByRole('alert')).toContainText('تعذّر الاتصال');
    await expect(dialog.getByLabel('اسم الدولة')).toHaveValue(name);
    await expect(dialog.getByLabel('كود الدولة')).toHaveValue('QQ');
    expect(posts).toBe(1);
  });

  test('works in English, left to right, without horizontal scroll', async ({ page }) => {
    await page
      .context()
      .addCookies([{ name: 'admin_locale', value: 'en', url: 'http://localhost:4100' }]);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('heading', { name: 'Countries' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add country' }).first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
