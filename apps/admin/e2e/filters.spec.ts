import type { Page } from '@playwright/test';
import { admin, expect, seed, signIn, test, unique, uniqueCode, results } from './support/fixtures';

// Filter fields apply their value 250 ms after typing stops. These tests act inside that
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
    await page.getByRole('button', { name: 'مسح الفلاتر' }).click(); // well within 250 ms
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
    await page.getByRole('link', { name: 'المدن' }).click(); // well within 250 ms
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
    await expect(
      results(page).getByText(name, { exact: true }).filter({ visible: true }),
    ).toBeVisible();
  });
});

// A pending search must not override a navigation that started before it fired. The race
// only shows when the navigation takes longer than the rest of the debounce, so the target
// page's server response is delayed (as on a slow network); nothing waits between typing
// and navigating.
test.describe('navigation started during a pending search', () => {
  const SLOW_RESPONSE = 800;
  const slowDown = (page: Page, url: RegExp) =>
    page.route(url, async (route) => {
      await new Promise((done) => setTimeout(done, SLOW_RESPONSE));
      await route.continue();
    });
  /** Every list request that carried the pending text: there must be none. */
  const searchesFor = (page: Page, text: string) => {
    const sent: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/bff/api/') && request.url().includes(text)) {
        sent.push(request.url());
      }
    });
    return sent;
  };
  const DETAIL = /\/team\/admins\/[a-f0-9]{24}$/;

  test.beforeEach(async ({ page }) => {
    await signIn(page, '/team/admins');
    await expect(page.getByRole('link', { name: `عرض ${admin().name}` })).toBeVisible();
    // Start the debounce race after the entrance settles, not while click actionability waits.
    await page.locator('main > .route-enter').evaluate(async (node) => {
      await Promise.all(
        node
          .getAnimations({ subtree: true })
          .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
          .map((animation) => animation.finished.catch(() => undefined)),
      );
    });
  });

  test('opening an admin keeps the detail page after the debounce', async ({ page }) => {
    await slowDown(page, /\/team\/admins\/[a-f0-9]{24}\?/);
    const sent = searchesFor(page, 'Pending');

    await page.getByLabel('بحث بالاسم').fill('Pending');
    await page.getByRole('link', { name: `عرض ${admin().name}` }).click(); // within 250 ms

    await expect(page).toHaveURL(DETAIL);
    await page.waitForTimeout(AFTER_DEBOUNCE);
    await expect(page).toHaveURL(DETAIL);
    await expect(page.getByRole('heading', { name: admin().name })).toBeVisible();
    expect(sent).toEqual([]);
  });

  // Every list screen that uses the shared filter field, leaving through the sidebar.
  for (const { from, to, link, heading } of [
    { from: '/locations/countries', to: '/locations/cities', link: 'المدن', heading: 'المدن' },
    { from: '/locations/cities', to: '/catalog/currencies', link: 'العملات', heading: 'العملات' },
    {
      from: '/catalog/currencies',
      to: '/team/admins',
      link: 'فريق الإدارة',
      heading: 'فريق الإدارة',
    },
    { from: '/team/admins', to: '/locations/countries', link: 'الدول', heading: 'الدول' },
  ]) {
    test(`a sidebar link from ${from} keeps its page after the debounce`, async ({
      page,
      isMobile,
    }) => {
      test.skip(isMobile, 'The sidebar is always visible only in the desktop layout.');
      await page.goto(from);
      await slowDown(page, new RegExp(`${to.replaceAll('/', '\\/')}\\?`));
      const sent = searchesFor(page, 'Pending');

      await page.getByLabel('بحث بالاسم').fill('Pending');
      await page.getByRole('link', { name: link, exact: true }).click(); // within 250 ms

      const target = new RegExp(`${to.replaceAll('/', '\\/')}$`);
      await expect(page).toHaveURL(target);
      await page.waitForTimeout(AFTER_DEBOUNCE);
      await expect(page).toHaveURL(target);
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      expect(sent).toEqual([]);
    });
  }

  test('Back keeps the previous page after the debounce', async ({ page }) => {
    // Client-side history: list → detail → list (back link), then Back while a search is pending.
    await page.getByRole('link', { name: `عرض ${admin().name}` }).click();
    await expect(page).toHaveURL(DETAIL);
    await page.getByRole('link', { name: 'العودة إلى فريق الإدارة' }).click();
    await expect(page).toHaveURL(/\/team\/admins$/);
    await slowDown(page, /\/team\/admins\/[a-f0-9]{24}\?/);
    const sent = searchesFor(page, 'Pending');

    await page.getByLabel('بحث بالاسم').fill('Pending');
    await page.goBack(); // within 250 ms

    await expect(page).toHaveURL(DETAIL);
    await page.waitForTimeout(AFTER_DEBOUNCE);
    await expect(page).toHaveURL(DETAIL);
    expect(sent).toEqual([]);
  });

  test('filters and paging still apply when nothing navigates', async ({ page }) => {
    await page.getByLabel('البريد الإلكتروني').fill(admin().email);
    await expect(page).toHaveURL(/email=/);
    await expect(page.getByText('مشرف واحد')).toBeVisible();
    await page.getByRole('button', { name: 'مسح الفلاتر' }).click();
    await expect(page).toHaveURL(/\/team\/admins$/);
  });
});
