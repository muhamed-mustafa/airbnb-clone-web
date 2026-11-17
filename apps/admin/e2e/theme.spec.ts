import type { Page } from '@playwright/test';
import { expectNoAxeViolations } from './support/axe';
import { ADMIN_URL } from './support/constants';
import {
  admin,
  expect,
  expectNoHorizontalScroll,
  openAccountMenu,
  setLocale,
  signIn,
  test,
} from './support/fixtures';

const ground = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
const LIGHT_GROUND = 'rgb(248, 250, 252)';
const DARK_GROUND = 'rgb(13, 18, 25)';

/** Console errors and uncaught exceptions (production React reports hydration failures here). */
function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    // Expected: unsaved pricing settings are a 404 the app shows as "not saved yet"; the
    // browser still logs the failed request.
    if (message.location().url.includes('/bff/api/app-settings')) return;
    errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test.describe('theme', () => {
  test('first visit follows the system, and keeps following it when it changes', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/login');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');
    expect(await ground(page)).toBe(DARK_GROUND);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(
      'light dark',
    );
    // The operating system switches: no reload, no script.
    await page.emulateMedia({ colorScheme: 'light' });
    expect(await ground(page)).toBe(LIGHT_GROUND);
    await expect(page.getByRole('radio', { name: 'النظام' })).toBeChecked();
  });

  test('Light, then Dark, then System: each persists; System clears the choice and follows the OS', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'desktop', 'Same logic on every viewport.');
    const errors = collectErrors(page);
    await page.emulateMedia({ colorScheme: 'dark' });
    await setLocale(page, 'en');
    await signIn(page, '/');
    const html = page.locator('html');
    // The theme control is in the sidebar, visible without opening the account panel.
    const choose = async (label: 'Light' | 'Dark' | 'System') => {
      const sidebar = page.locator('.sidebar-utilities').filter({ visible: true });
      await sidebar.locator('label.theme-option', { hasText: label }).click();
      await expect(sidebar.getByRole('radio', { name: label })).toBeChecked();
    };
    const themeCookie = async () =>
      (await page.context().cookies()).find((c) => c.name === 'admin_theme')?.value;
    const serverHtml = async () => (await page.request.get('/')).text();

    // Light while the OS is dark: the explicit choice wins, and survives a reload.
    await choose('Light');
    await expect(html).toHaveAttribute('data-theme', 'light');
    await expect.poll(() => ground(page)).toBe(LIGHT_GROUND);
    expect(await themeCookie()).toBe('light');
    expect(await serverHtml()).toMatch(/<html[^>]*data-theme="light"/);
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'light');
    expect(await ground(page)).toBe(LIGHT_GROUND);

    // Dark while the OS is light: the same, the other way round.
    await page.emulateMedia({ colorScheme: 'light' });
    await choose('Dark');
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect.poll(() => ground(page)).toBe(DARK_GROUND);
    expect(await themeCookie()).toBe('dark');
    expect(await serverHtml()).toMatch(/<html[^>]*data-theme="dark"/);
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    expect(await ground(page)).toBe(DARK_GROUND);

    // System: the explicit choice is cleared (attribute and cookie), and the OS decides.
    await choose('System');
    await expect(html).not.toHaveAttribute('data-theme');
    expect(await themeCookie()).toBeUndefined();
    await expect.poll(() => ground(page)).toBe(LIGHT_GROUND);
    expect(await serverHtml()).not.toMatch(/<html[^>]*data-theme=/);
    await page.reload();
    await expect(html).not.toHaveAttribute('data-theme');
    await expect(
      page
        .locator('.sidebar-utilities')
        .filter({ visible: true })
        .getByRole('radio', { name: 'System' }),
    ).toBeChecked();
    // Live OS changes after the reload, without any interaction.
    await page.emulateMedia({ colorScheme: 'dark' });
    expect(await ground(page)).toBe(DARK_GROUND);
    await page.emulateMedia({ colorScheme: 'light' });
    expect(await ground(page)).toBe(LIGHT_GROUND);
    expect(errors, 'no console errors').toEqual([]);
  });

  for (const mode of ['light', 'dark', 'system'] as const) {
    test(`${mode}: first paint and navigation keep one theme, without errors`, async ({
      page,
    }, info) => {
      test.skip(info.project.name !== 'desktop', 'Same logic on every viewport.');
      const errors = collectErrors(page);
      // The OS is set to the opposite of the explicit choice, so a wrong first paint would
      // show; System is checked against a dark OS.
      await page.emulateMedia({
        colorScheme: mode === 'light' ? 'dark' : mode === 'dark' ? 'light' : 'dark',
      });
      await setLocale(page, 'en');
      if (mode !== 'system') {
        await page.context().addCookies([{ name: 'admin_theme', value: mode, url: ADMIN_URL }]);
      }
      const expected = mode === 'light' ? LIGHT_GROUND : DARK_GROUND;
      // From the moment each document exists: the ground at the first animation frame
      // (before the first paint) and every later change of the theme attribute.
      await page.addInitScript(() => {
        const log = { frames: [] as string[], mutations: 0 };
        (window as unknown as { __theme: typeof log }).__theme = log;
        requestAnimationFrame(() =>
          log.frames.push(getComputedStyle(document.documentElement).backgroundColor),
        );
        new MutationObserver((records) => {
          log.mutations += records.length;
        }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-theme'] });
      });
      const read = () =>
        page.evaluate(
          () => (window as unknown as { __theme: { frames: string[]; mutations: number } }).__theme,
        );

      await page.goto('/login');
      expect((await read()).frames[0], 'first frame of the sign-in page').toBe(expected);
      await signIn(page, '/');
      expect((await read()).frames[0], 'first frame after sign-in').toBe(expected);
      // Client-side navigation: the attribute never changes and the ground stays the same.
      for (const name of ['Countries', 'Cities', 'Overview']) {
        await page.getByRole('link', { name, exact: true }).first().click();
        await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
        expect(await ground(page)).toBe(expected);
      }
      expect((await read()).mutations, 'theme attribute changes after load').toBe(0);
      await page.reload();
      expect((await read()).frames[0], 'first frame after reload').toBe(expected);
      expect((await read()).mutations).toBe(0);
      expect(errors, 'no console errors or hydration errors').toEqual([]);
    });
  }

  test('both themes pass the accessibility audit', async ({ page }, info) => {
    test.setTimeout(120_000);
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/login');
      await expectNoAxeViolations(page, `login ${scheme}`);
      await signIn(page, '/');
      await expect(page.locator('.stat-value[aria-busy="true"]')).toHaveCount(0);
      await expectNoAxeViolations(page, `home ${scheme}`);
      await expectNoHorizontalScroll(page);
      await page.goto('/locations/countries');
      await expect(page.locator('section[aria-busy="false"]')).toBeVisible();
      await expectNoAxeViolations(page, `countries ${scheme}`);
      await page.goto('/account');
      await expect(page.getByRole('main').getByText(admin().email)).toBeVisible();
      await expectNoAxeViolations(page, `profile ${scheme}`);
      await page.goto('/');
      if (info.project.name === 'mobile') {
        await page.getByRole('button', { name: 'فتح القائمة' }).click();
      }
      await openAccountMenu(page);
      await expectNoAxeViolations(page, `account menu ${scheme}`);
      await page.context().clearCookies();
    }
  });
});

test.describe('account menu', () => {
  test('keyboard: opens, moves focus in, closes with Escape and returns focus', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'desktop', 'Sidebar trigger; the drawer is covered elsewhere.');
    await setLocale(page, 'en');
    await signIn(page, '/');
    const trigger = page.getByRole('button', { name: /^Account menu/ });
    // Enabled once the session (name and email) has loaded.
    await expect(trigger).toBeEnabled();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.focus();
    await page.keyboard.press('Enter');
    const panel = page.getByRole('dialog', { name: 'Account' });
    await expect(panel).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect
      .poll(() => panel.evaluate((element) => element.contains(document.activeElement)))
      .toBe(true);
    // The full email is in the panel as text, not only in a hover tooltip.
    await expect(panel.getByText(admin().email)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('copying a long email in Arabic (RTL) gives back the exact original value', async ({
    page,
    context,
  }, info) => {
    test.skip(info.project.name !== 'desktop', 'Clipboard permission is desktop Chromium.');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const long = 'alexandria.montgomery-fitzgerald@operations.example-hospitality.com';
    // Synthetic: only the browser's copy of the session response is rewritten.
    await page.route('**/bff/session', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      const response = await route.fetch();
      const body = (await response.json()) as { subject?: Record<string, unknown> };
      if (body.subject) body.subject.email = long;
      await route.fulfill({ response, json: body });
    });
    await setLocale(page, 'ar');
    await signIn(page, '/');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
    // No direction marks, zero-width spaces or line breaks may leak into the copied value.
    const INVISIBLE = /[\u200b-\u200f\u202a-\u202e\u2066-\u2069\s]/;

    await openAccountMenu(page);
    await page.getByRole('button', { name: 'نسخ البريد الإلكتروني' }).click();
    await expect(page.getByRole('dialog').getByText('تم النسخ')).toBeVisible();
    const fromPanel = await clipboard();
    expect(fromPanel).toBe(long);
    expect(fromPanel).not.toMatch(INVISIBLE);
    await page.keyboard.press('Escape');

    await page.evaluate(() => navigator.clipboard.writeText(''));
    await page.goto('/account');
    await page.getByRole('main').getByRole('button', { name: 'نسخ البريد الإلكتروني' }).click();
    await expect(page.getByRole('main').getByText('تم النسخ')).toBeVisible();
    const fromProfile = await clipboard();
    expect(fromProfile).toBe(long);
    expect(fromProfile).not.toMatch(INVISIBLE);
    // The full value is also on the page as text, left to right.
    await expect(page.getByRole('main').locator('.email-text')).toHaveText(long);
  });

  test('long names and emails: one line in the trigger, in full in the panel', async ({
    page,
  }, info) => {
    const long = {
      name: 'Alexandria Montgomery-Fitzgerald Al-Rashidi',
      email: 'alexandria.montgomery-fitzgerald@operations.example-hospitality.com',
    };
    // Synthetic: only the browser's copy of the session response is rewritten.
    await page.route('**/bff/session', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      const response = await route.fetch();
      const body = (await response.json()) as { subject?: Record<string, unknown> };
      if (body.subject) Object.assign(body.subject, long);
      await route.fulfill({ response, json: body });
    });
    await signIn(page, '/');
    if (info.project.name === 'mobile') {
      await page.getByRole('button', { name: 'فتح القائمة' }).click();
    }
    const trigger = page.locator('.account-trigger').filter({ visible: true });
    // In the Arabic UI a Latin name keeps its own direction, so the ellipsis cuts its end.
    const name = trigger.locator('.account-trigger-name');
    await expect(name).toHaveText(long.name);
    expect(await name.evaluate((element) => getComputedStyle(element).direction)).toBe('ltr');
    const email = trigger.locator('.account-trigger-email');
    await expect(email).toHaveText(long.email);
    // One line, cut with an ellipsis rather than wrapped into fragments.
    expect((await email.boundingBox())!.height).toBeLessThan(24);
    expect(await email.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    await expectNoHorizontalScroll(page);

    await openAccountMenu(page);
    const full = page.getByRole('dialog').locator('.email-text');
    await expect(full).toHaveText(long.email);
    // Left-to-right inside the Arabic page; the domain is never split from its suffix.
    await expect(full).toHaveAttribute('dir', 'ltr');
    const domainLines = await full.evaluate((element) => {
      const text = element.lastChild!;
      const range = document.createRange();
      range.setStart(text, 0);
      range.setEnd(text, text.textContent!.length);
      return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
    });
    expect(domainLines, 'the domain stays on one line').toBe(1);
  });
});
