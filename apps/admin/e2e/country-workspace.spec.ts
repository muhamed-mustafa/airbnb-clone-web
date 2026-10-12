import AxeBuilder from '@axe-core/playwright';
import {
  expect,
  expectNoHorizontalScroll,
  seed,
  setLocale,
  signIn,
  test,
} from './support/fixtures';

test('country workspace gives live feedback, keeps newest results and exposes interaction states', async ({
  page,
}, info) => {
  if (info.project.name === 'desktop') {
    for (const [name, code] of [
      ['Egypt', 'EG'],
      ['Saudi Arabia', 'SA'],
      ['United Arab Emirates', 'AE'],
      ['United States', 'US'],
    ]) {
      await seed('/countries', { name, code });
    }
  }
  await setLocale(page, 'en');
  await signIn(page);
  const name = page.getByLabel('Search by name', { exact: true });
  let searches = 0;
  let rsc = 0;
  page.on('request', (request) => {
    if (
      request.url().includes('/bff/api/countries?') &&
      new URL(request.url()).searchParams.has('name')
    )
      searches++;
    if (
      request.headers().rsc === '1' &&
      request.headers()['next-router-prefetch'] !== '1' &&
      request.url().includes('/locations/countries')
    )
      rsc++;
  });
  await name.fill('d');
  await expect(
    page.getByText('Add 2 more characters to search. Current results are unchanged.'),
  ).toBeVisible();
  await page.waitForTimeout(400);
  expect(searches).toBe(0);
  const visible = (text: string) => page.getByText(text, { exact: true }).filter({ visible: true });
  await expect(visible('Egypt')).toBeVisible();
  await page.screenshot({
    path: `../../docs/phase-1/screens/${info.project.name}-workspace-short-search.png`,
    animations: 'disabled',
  });
  await page.route('**/bff/api/countries?*', async (route) => {
    const text = new URL(route.request().url()).searchParams.get('name');
    if (text !== 'Egypt') return route.continue();
    const response = await route.fetch();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.fulfill({ response }).catch(() => undefined); // Superseded requests can be aborted.
  });
  await name.fill('Egypt');
  await expect(page.getByText('Updating results...')).toBeVisible();
  await name.fill('Saudi');
  await expect(visible('Saudi Arabia')).toBeVisible();
  await expect(visible('Egypt')).toHaveCount(0);
  await page.waitForTimeout(1100);
  await expect(visible('Saudi Arabia')).toBeVisible();
  await expect(name).toHaveValue('Saudi');
  expect(new URL(page.url()).searchParams.get('name')).toBe('Saudi');
  expect(rsc).toBe(0);
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(name).toHaveValue('');
  await expect(name).toBeFocused();
  await expect(visible('Egypt')).toBeVisible();
  await expect(page).toHaveURL(/countries$/);
  const add = page.getByRole('button', { name: 'Add country', exact: true });
  await add.hover();
  await expect(add).toHaveCSS('background-color', 'rgb(76, 64, 204)');
  const edit = page.getByRole('button', { name: 'Edit Egypt', exact: true });
  await expect(edit).toHaveCSS('color', 'rgb(15, 118, 110)');
  await expect(page.getByRole('button', { name: 'Delete Egypt', exact: true })).toHaveCSS(
    'color',
    'rgb(180, 35, 24)',
  );
  await edit.hover();
  await expect(edit).toHaveCSS('color', 'rgb(17, 94, 89)');
  await edit.click();
  const countryName = page.getByLabel('Country name', { exact: true });
  const countryCode = page.getByLabel('Country code', { exact: true });
  const nameBox = await countryName.boundingBox();
  const codeBox = await countryCode.boundingBox();
  expect(nameBox).not.toBeNull();
  expect(codeBox).not.toBeNull();
  expect(codeBox!.width).toBeCloseTo(nameBox!.width, 0);
  expect(codeBox!.height).toBeCloseTo(nameBox!.height, 0);
  expect(codeBox!.x).toBeCloseTo(nameBox!.x, 0);
  await page.screenshot({
    path: `../../docs/phase-1/screens/${info.project.name}-aligned-country-form-en.png`,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expectNoHorizontalScroll(page);
  await page.screenshot({
    path: `../../docs/phase-1/screens/${info.project.name}-workspace-countries-en.png`,
    animations: 'disabled',
  });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await setLocale(page, 'ar');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(
    page.getByRole('button', { name: '\u062a\u0639\u062f\u064a\u0644 Egypt', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `../../docs/phase-1/screens/${info.project.name}-workspace-countries-ar.png`,
    animations: 'disabled',
  });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page
    .getByRole('button', { name: '\u062a\u0639\u062f\u064a\u0644 Egypt', exact: true })
    .click();
  const rtlName = await page
    .getByLabel('\u0627\u0633\u0645 \u0627\u0644\u062f\u0648\u0644\u0629', { exact: true })
    .boundingBox();
  const rtlCode = await page
    .getByLabel('\u0643\u0648\u062f \u0627\u0644\u062f\u0648\u0644\u0629', { exact: true })
    .boundingBox();
  expect(rtlCode!.width).toBeCloseTo(rtlName!.width, 0);
  expect(rtlCode!.x).toBeCloseTo(rtlName!.x, 0);
  await page.screenshot({
    path: `../../docs/phase-1/screens/${info.project.name}-aligned-country-form-ar.png`,
    animations: 'disabled',
  });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
});
