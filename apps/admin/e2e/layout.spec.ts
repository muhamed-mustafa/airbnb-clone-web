import {
  expect,
  expectNoHorizontalScroll,
  results,
  seed,
  setLocale,
  signIn,
  test,
  unique,
  uniqueCode,
  uniqueCurrencyCode,
} from './support/fixtures';

// Responsive details of the list layout that a render alone does not prove.
test.describe('list layout', () => {
  test.beforeEach(async ({ page }) => signIn(page));

  test('phone rows keep actions beside a short name and move them below a long one', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'mobile', 'Phone layout only.');
    const tag = unique('Row').split(' ')[1]!;
    const short = `Nu ${tag}`;
    const long = `The Long Federated Republic of Somewhere ${tag}`;
    await seed('/countries', { name: short, code: uniqueCode() });
    await seed('/countries', { name: long, code: uniqueCode() });
    await page.goto(`/locations/countries?name=${tag}`);

    const row = (name: string) => results(page).getByRole('listitem').filter({ hasText: name });
    await expect(row(short)).toBeVisible();
    await expect(row(long)).toBeVisible();

    const boxes = async (name: string) => {
      const main = await row(name).locator('.list-row-main').boundingBox();
      const actions = await row(name).locator('.list-row-actions').boundingBox();
      return { main: main!, actions: actions! };
    };
    const s = await boxes(short);
    // Same line: the actions start above the bottom of the information.
    expect(s.actions.y).toBeLessThan(s.main.y + s.main.height);
    const l = await boxes(long);
    // Second line, and the name keeps the full row width instead of being squeezed.
    expect(l.actions.y).toBeGreaterThanOrEqual(l.main.y + l.main.height);
    const rowBox = (await row(long).boundingBox())!;
    expect(l.main.width).toBeGreaterThan(rowBox.width * 0.8);
  });

  test('details pages and forms stay compact', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'Desktop layout only.');
    await page.setViewportSize({ width: 1920, height: 1000 });
    for (const path of ['/settings/pricing', '/account']) {
      await page.goto(path);
      const body = page.locator('.page-body');
      await expect(body).toBeVisible();
      expect((await body.boundingBox())!.width, path).toBeLessThanOrEqual(40 * 16);
    }
  });

  test('wide screens: lists keep a table width, centred, and actions follow their data', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'desktop', 'Desktop layout only.');
    await setLocale(page, 'en');
    const country = await seed<{ id: string }>('/countries', {
      name: unique('Wide land'),
      code: uniqueCode(),
    });
    await seed('/cities', { name: unique('Wide city'), country: country.id });
    await seed('/currencies', { name: unique('Wide coin'), currencyCode: uniqueCurrencyCode() });
    await seed('/unit-categories', { name: unique('Wide type') });
    await page.setViewportSize({ width: 1920, height: 1000 });
    // Each list: the control in the last column starts right after the column before it
    // (cell padding only), however wide the table is.
    const lists: [string, RegExp][] = [
      ['/locations/countries', /^Edit /],
      ['/locations/cities', /^Edit /],
      ['/catalog/currencies', /^Edit /],
      ['/catalog/unit-categories', /^Edit /],
      ['/team/admins', /^View /],
    ];
    for (const [path, control] of lists) {
      await page.goto(path);
      const body = (await page.locator('.page-body').boundingBox())!;
      const main = (await page.locator('main').boundingBox())!;
      // A table page: as wide as its columns need (68rem), centred in the workspace, never
      // stretched edge to edge and never a narrow column.
      expect(body.width, path).toBeGreaterThan(60 * 16);
      expect(body.width, path).toBeLessThanOrEqual(68 * 16);
      const start = body.x - main.x;
      const end = main.x + main.width - (body.x + body.width);
      expect(Math.abs(start - end), `${path} centred`).toBeLessThanOrEqual(2);
      expect(start, `${path} gutter`).toBeGreaterThanOrEqual(32);
      // Deliberate space above the page heading.
      const heading = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
      expect(heading.y - main.y, `${path} top space`).toBeGreaterThanOrEqual(32);
      const table = page.locator('table.data-table');
      expect((await table.boundingBox())!.width, path).toBeCloseTo(body.width, -1);
      const row = table.locator('tbody tr').first();
      const cells = row.locator(':scope > th, :scope > td');
      const count = await cells.count();
      const before = (await cells.nth(count - 2).boundingBox())!;
      const action = (await row
        .getByRole(path.includes('admins') ? 'link' : 'button', {
          name: control,
        })
        .boundingBox())!;
      expect(action.x - (before.x + before.width), path).toBeLessThanOrEqual(40);
    }
  });

  test('every page: deliberate top spacing, no doubled padding, no horizontal overflow in RTL', async ({
    page,
  }, info) => {
    test.setTimeout(120_000);
    const mobile = info.project.name === 'mobile';
    const pages = [
      '/',
      '/locations/countries',
      '/locations/cities',
      '/catalog/currencies',
      '/catalog/unit-categories',
      '/settings/pricing',
      '/team/admins',
      '/account',
    ];
    for (const locale of ['ar', 'en'] as const) {
      await setLocale(page, locale);
      for (const path of pages) {
        await page.goto(path);
        const heading = page.getByRole('heading', { level: 1 });
        await expect(heading).toBeVisible();
        const main = (await page.locator('main').boundingBox())!;
        const body = (await page.locator('.page-body').boundingBox())!;
        const first = (await page.locator('.page-body > :first-child').boundingBox())!;
        // Whole pixels: the route's entry animation leaves sub-pixel offsets.
        const top = Math.round(body.y - main.y);
        // One source of top space: the workspace. The page and its header add none.
        expect(first.y - body.y, `${path} ${locale}: no extra space before the header`).toBeCloseTo(
          0,
          0,
        );
        if (mobile) {
          expect(top, `${path} ${locale}: phone top space`).toBeGreaterThanOrEqual(20);
          expect(top, `${path} ${locale}: phone top space`).toBeLessThanOrEqual(24);
        } else {
          expect(top, `${path} ${locale}: desktop top space`).toBeGreaterThanOrEqual(32);
          expect(top, `${path} ${locale}: desktop top space`).toBeLessThanOrEqual(40);
        }
        await expectNoHorizontalScroll(page);
      }
    }
  });

  test('a short desktop window: the sidebar utilities (theme, account) stay fully visible', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'desktop', 'Desktop sidebar only.');
    for (const locale of ['ar', 'en'] as const) {
      await setLocale(page, locale);
      await page.setViewportSize({ width: 1280, height: 640 });
      await page.goto('/');
      const utilities = page.locator('aside .sidebar-utilities');
      await expect(utilities).toBeVisible();
      const box = (await utilities.boundingBox())!;
      expect(box.y + box.height, `${locale}: not clipped at the bottom`).toBeLessThanOrEqual(640);
      const aside = (await page.locator('aside').boundingBox())!;
      expect(box.x, `${locale}: inside the sidebar`).toBeGreaterThanOrEqual(aside.x);
      expect(box.x + box.width).toBeLessThanOrEqual(aside.x + aside.width + 0.5);
      // Every theme option and the account trigger are within the window and reachable.
      for (const option of await utilities.locator('label.theme-option').all()) {
        const o = (await option.boundingBox())!;
        expect(o.y + o.height).toBeLessThanOrEqual(640);
        expect(o.height).toBeGreaterThanOrEqual(24);
        // Each label is shown whole: never cut with an ellipsis.
        const label = option.locator('span').last();
        const cut = await label.evaluate((el) => el.scrollWidth > el.clientWidth);
        expect(cut, `${locale}: "${await label.textContent()}" is truncated`).toBe(false);
      }
      await expect(utilities.locator('.account-trigger')).toBeInViewport();
      await expectNoHorizontalScroll(page);
    }
  });

  test('list pages render their title and page note on the server', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'Server output does not depend on the viewport.');
    // Guards against a client-only render (e.g. a search-params bailout): the title and
    // page note must not wait for JavaScript.
    const pages: [string, string[]][] = [
      ['/team/admins', ['فريق الإدارة', 'عرض فقط.']],
      ['/locations/countries', ['الدول']],
      ['/locations/cities', ['المدن']],
      ['/catalog/currencies', ['العملات']],
      ['/catalog/unit-categories', ['أنواع الإقامة']],
    ];
    for (const [path, texts] of pages) {
      const html = await (await page.request.get(path)).text();
      const h1 = /<h1[^>]*>([^<]*)<\/h1>/.exec(html)?.[1];
      expect(h1, path).toBe(texts[0]);
      for (const text of texts.slice(1)) expect(html, path).toContain(text);
    }
  });
});
