import AxeBuilder from '@axe-core/playwright';
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

test('searchable country picker preserves form input, supports keyboard and closes independently', async ({
  page,
}, info) => {
  const country = await seed<{ id: string; name: string; code: string }>('/countries', {
    name: unique('Design country'),
    code: uniqueCode(),
  });
  await setLocale(page, 'en');
  await signIn(page, '/locations/cities');
  await page.getByRole('button', { name: 'Add city' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add city', exact: true });
  const name = dialog.getByLabel('City name');
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute('placeholder', 'e.g. Alexandria');
  await name.fill('Draft city');
  const countryPicker = dialog.getByRole('combobox', { name: 'Country', exact: true });
  await countryPicker.focus();
  await page.keyboard.press('Enter');
  const search = page.getByRole('searchbox', { name: 'Search countries' });
  await expect(search).toBeFocused();
  await search.fill('no-such-country-zzzz');
  await expect(page.getByText('No matching countries. Try another name.')).toBeVisible();
  await expect(countryPicker).toContainText('Choose a country');
  await search.fill(country.code);
  await expect(page.getByRole('option').filter({ hasText: country.name })).toBeVisible();
  await page.screenshot({
    path: `../../docs/phase-1/screens/${info.project.name}-form-country-picker-en.png`,
    animations: 'disabled',
  });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await search.fill(country.name);
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option').filter({ hasText: country.name })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(countryPicker).toContainText(country.name);
  await expect(countryPicker).toBeFocused();
  await expect(name).toHaveValue('Draft city');
  await countryPicker.click();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(countryPicker).toBeFocused();
  await expect(countryPicker).toContainText(country.name);
  await expectNoHorizontalScroll(page);
  await page.screenshot({
    path: `../../docs/phase-1/screens/${info.project.name}-form-city-en.png`,
    animations: 'disabled',
  });
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Add city' })).toBeFocused();
  await setLocale(page, 'ar');
  await page.reload();
  await page
    .locator('main button')
    .filter({ has: page.locator('svg') })
    .first()
    .click();
  const arabicDialog = page.getByRole('dialog').first();
  await expect(arabicDialog).toBeVisible();
  await page.screenshot({
    path: `../../docs/phase-1/screens/${info.project.name}-form-city-ar.png`,
    animations: 'disabled',
  });
  await arabicDialog.getByRole('combobox').click();
  await expect(page.getByRole('searchbox')).toBeFocused();
  await expect(page.locator('.select-popover')).toHaveAttribute('dir', 'rtl');
  await page.screenshot({
    path: `../../docs/phase-1/screens/${info.project.name}-form-country-picker-ar.png`,
    animations: 'disabled',
  });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
});
