import AxeBuilder from '@axe-core/playwright';
import {
  expect,
  test,
  signIn,
  unique,
  setLocale,
  seed,
  expectNoHorizontalScroll,
} from './support/fixtures';

const PAGE = '/catalog/unit-categories';

test('accommodation types: validation, create, partial edit, search, delete and accessibility', async ({
  page,
}, info) => {
  await setLocale(page, 'en');
  await signIn(page, PAGE);
  await page.getByRole('button', { name: 'Add accommodation type', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Accommodation type name').fill('ab');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByText('Enter at least 3 characters.')).toBeVisible();
  const name = unique('Villa');
  await dialog.getByLabel('Accommodation type name').fill(name);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.getByLabel('Search by name').fill(name);
  await expect(page).toHaveURL(/name=/);
  await page.getByRole('button', { name: `Edit ${name}`, exact: true }).click();
  await dialog.getByLabel('Icon identifier (optional)').fill('villa');
  const patch = page.waitForRequest(
    (request) =>
      request.method() === 'PATCH' && request.url().includes('/bff/api/unit-categories/'),
  );
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await patch).postDataJSON()).toEqual({ icon: 'villa' });
  await expect(dialog).toBeHidden();
  await expectNoHorizontalScroll(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: `../../docs/phase-1/screens/${info.project.name}-en-unit-categories.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: `Delete ${name}`, exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Delete accommodation type', exact: true })
    .click();
  await expect(page.getByRole('alertdialog')).toBeHidden();
  await expect(page.getByText('No results', { exact: true })).toBeVisible();
});

test('Arabic type names and duplicate error keep the entered name', async ({ page }, info) => {
  const name = unique('فيلا');
  await seed('/unit-categories', { name, icon: 'villa' });
  await setLocale(page, 'ar');
  await signIn(page, PAGE);
  await page.getByRole('button', { name: 'إضافة نوع إقامة', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('اسم نوع الإقامة').fill(name);
  await dialog.getByRole('button', { name: 'حفظ', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('يوجد نوع إقامة بنفس الاسم بالفعل.');
  await expect(dialog.getByLabel('اسم نوع الإقامة')).toHaveValue(name);
  await page.screenshot({
    path: `../../docs/phase-1/screens/${info.project.name}-ar-unit-category-conflict.png`,
    fullPage: true,
  });
});

test('a failed save is sent once and retains the input', async ({ page }) => {
  await setLocale(page, 'en');
  await signIn(page, PAGE);
  let writes = 0;
  await page.route('**/bff/api/unit-categories', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    writes += 1;
    return route.abort('failed');
  });
  await page.getByRole('button', { name: 'Add accommodation type', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  const name = unique('Chalet');
  await dialog.getByLabel('Accommodation type name').fill(name);
  await dialog.getByLabel('Icon identifier (optional)').fill('chalet');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByLabel('Accommodation type name')).toHaveValue(name);
  await expect(dialog.getByLabel('Icon identifier (optional)')).toHaveValue('chalet');
  expect(writes).toBe(1);
});
