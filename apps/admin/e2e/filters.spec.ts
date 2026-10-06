import { expect, seed, signIn, test, unique, uniqueCode } from './support/fixtures';

// Filter fields apply their value 350 ms after typing stops. These tests act inside that
// window to prove a pending search never outlives "Clear filters", the page, or another
// filter's change.
const AFTER_DEBOUNCE = 900;

test.describe('pending filter searches', () => {
  test.beforeEach(async ({ page }) => signIn(page));

  test('clearing filters before the search fires cancels it', async ({ page }) => {
    const code = uniqueCode();
    await seed('/countries', { name: unique('Clear land'), code });
    await page.goto(`/locations/countries?code=${code}`);

    await page.getByLabel('بحث بالاسم').fill('Pending search');
    await page.getByRole('button', { name: 'مسح الفلاتر' }).click(); // well within 350 ms
    await page.waitForTimeout(AFTER_DEBOUNCE);

    await expect(page).toHaveURL(/\/locations\/countries$/);
    await expect(page.getByLabel('بحث بالاسم')).toHaveValue('');
    await expect(page.getByLabel('الكود')).toHaveValue('');
  });

  test('leaving the page during a pending search does not navigate back', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Client-side navigation from the sidebar is a desktop layout.');
    await page.getByLabel('بحث بالاسم').fill('Pending search');
    await page.getByRole('link', { name: 'المدن' }).click(); // well within 350 ms
    await expect(page).toHaveURL(/\/locations\/cities$/);
    await page.waitForTimeout(AFTER_DEBOUNCE);

    await expect(page).toHaveURL(/\/locations\/cities$/);
    await expect(page.getByRole('heading', { name: 'المدن', exact: true })).toBeVisible();
  });

  test('two filters changed quickly are both applied', async ({ page }) => {
    const code = uniqueCode();
    const name = unique('Both land');
    await seed('/countries', { name, code });
    await page.reload();

    await page.getByLabel('بحث بالاسم').fill(name);
    await page.getByLabel('الكود').fill(code.toLowerCase()); // before the name search fires
    await page.waitForTimeout(AFTER_DEBOUNCE);

    const url = new URL(page.url());
    expect(url.searchParams.get('name')).toBe(name);
    expect(url.searchParams.get('code')).toBe(code);
    await expect(page.getByText(name, { exact: true }).filter({ visible: true })).toBeVisible();
  });
});
