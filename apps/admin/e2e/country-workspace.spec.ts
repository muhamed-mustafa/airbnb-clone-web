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
  await expect(add).toHaveCSS('background-color', 'rgb(56, 57, 67)');
  const edit = page.getByRole('button', { name: 'Edit Egypt', exact: true });
  await edit.hover();
  await expect(edit).toHaveCSS('color', 'rgb(76, 64, 204)');
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
  await page.screenshot({
    path: `../../docs/phase-1/screens/${info.project.name}-workspace-countries-ar.png`,
    animations: 'disabled',
  });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
});
