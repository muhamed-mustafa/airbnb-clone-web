import { expect, seed, signIn, test, unique, uniqueCode } from './support/fixtures';

interface Country {
  id: string;
  name: string;
}

test.describe('cities', () => {
  test.beforeEach(async ({ page }) => signIn(page, '/locations/cities'));

  test('create in a country, reject a duplicate, filter by country, edit and delete', async ({
    page,
  }) => {
    const country = await seed<Country>('/countries', {
      name: unique('Host land'),
      code: uniqueCode(),
    });
    await page.reload();

    await page.getByRole('button', { name: 'إضافة مدينة' }).click();
    const dialog = page.getByRole('dialog', { name: 'إضافة مدينة' });
    const name = unique('Harbour');
    await dialog.getByLabel('اسم المدينة').fill(name);
    await dialog.getByRole('button', { name: 'حفظ' }).click();
    await expect(dialog.getByText('هذا الحقل مطلوب.')).toBeVisible();

    await dialog.getByLabel('الدولة').click();
    await page.locator('.select-popover').getByRole('searchbox').fill(country.name);
    await page.getByRole('option').filter({ hasText: country.name }).click();
    await dialog.getByRole('button', { name: 'حفظ' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('status').filter({ hasText: `تمت إضافة ${name}.` })).toBeVisible();

    // Same name in the same country: conflict, input kept.
    await page.getByRole('button', { name: 'إضافة مدينة' }).click();
    await dialog.getByLabel('اسم المدينة').fill(name);
    await dialog.getByLabel('الدولة').click();
    await page.locator('.select-popover').getByRole('searchbox').fill(country.name);
    await page.getByRole('option').filter({ hasText: country.name }).click();
    await dialog.getByRole('button', { name: 'حفظ' }).click();
    await expect(dialog.getByRole('alert')).toContainText('توجد مدينة بنفس الاسم في هذه الدولة.');
    await expect(dialog.getByLabel('اسم المدينة')).toHaveValue(name);
    await page.keyboard.press('Escape');

    // Country filter in the URL; the country's name is shown, not its id (L4).
    await page.getByLabel('الدولة').click();
    await page.locator('.select-popover').getByRole('searchbox').fill(country.name);
    await page.getByRole('option').filter({ hasText: country.name }).click();
    await expect(page).toHaveURL(new RegExp(`country=${country.id}`));
    const row = page
      .getByRole('row', { name: new RegExp(name) })
      .or(page.getByRole('listitem').filter({ hasText: name }));
    await expect(row.first()).toContainText(country.name);

    await page.getByRole('button', { name: `تعديل ${name}` }).click();
    const edit = page.getByRole('dialog', { name: `تعديل ${name}` });
    const renamed = unique('Harbour renamed');
    await edit.getByLabel('اسم المدينة').fill(renamed);
    await edit.getByRole('button', { name: 'حفظ' }).click();
    await expect(page.getByRole('status').filter({ hasText: `تم حفظ ${renamed}.` })).toBeVisible();

    await page.getByRole('button', { name: `حذف ${renamed}` }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'حذف المدينة' }).click();
    await expect(page.getByRole('status').filter({ hasText: `تم حذف ${renamed}.` })).toBeVisible();
    await expect(page.getByText(renamed, { exact: true }).filter({ visible: true })).toBeHidden();
  });
});
