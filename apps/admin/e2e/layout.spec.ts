import { expect, results, seed, signIn, test, unique, uniqueCode } from './support/fixtures';

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

  test('desktop lists use a width that keeps data close to its actions', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'Desktop layout only.');
    const widths: Record<string, number> = {
      '/locations/countries': 46,
      '/catalog/currencies': 46,
      '/catalog/unit-categories': 46,
      '/locations/cities': 54,
      '/settings/pricing': 40,
      '/account': 40,
    };
    for (const [path, rem] of Object.entries(widths)) {
      await page.goto(path);
      const body = page.locator('.page-body');
      await expect(body).toBeVisible();
      const box = (await body.boundingBox())!;
      expect(box.width, path).toBeLessThanOrEqual(rem * 16);
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
