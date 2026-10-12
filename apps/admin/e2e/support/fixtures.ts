import { randomBytes } from 'node:crypto';
import { expect, test as base, type Page } from '@playwright/test';
import { ADMIN_URL, E2E_BACKEND_URL } from './constants';

export const admin = () => ({
  email: process.env.E2E_ADMIN_EMAIL!,
  password: process.env.E2E_ADMIN_PASSWORD!,
  name: process.env.E2E_ADMIN_NAME!,
});

export async function setLocale(page: Page, locale: 'ar' | 'en') {
  await page.context().addCookies([{ name: 'admin_locale', value: locale, url: ADMIN_URL }]);
}

export async function signIn(page: Page, next = '/locations/countries') {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  const { email, password } = admin();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname === next.split('?')[0]);
}

/** Unique, readable test data (no collisions across runs on the same database). */
export const unique = (prefix: string) => `${prefix} ${randomBytes(3).toString('hex')}`;

// Codes already taken (loaded from the e2e backend per worker) or reserved for screenshots.
const usedCodes = new Set<string>(['EG', 'SA', 'AE', 'US', 'MA', 'VC']);
const usedCurrencyCodes = new Set<string>(['EGP', 'SAR', 'AED', 'USD', 'MAD', 'BAM']);

function uniqueLetters(length: number, used: Set<string>): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (;;) {
    const code = Array.from({ length }, () => letters[Math.floor(Math.random() * 26)]).join('');
    if (!used.has(code)) {
      used.add(code);
      return code;
    }
  }
}

/** A country code (2 letters) not used in the e2e database. */
export const uniqueCode = () => uniqueLetters(2, usedCodes);
/** A currency code (3 letters) not used in the e2e database. */
export const uniqueCurrencyCode = () => uniqueLetters(3, usedCurrencyCodes);

/** Seed data straight on the e2e backend, independent of the UI under test. */
export async function backendAdminToken(): Promise<string> {
  const { email, password } = admin();
  const response = await fetch(`${E2E_BACKEND_URL}/api/auth/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as { data: { accessToken: string } }).data.accessToken;
}

export async function seed<T>(path: string, body: unknown): Promise<T> {
  const token = await backendAdminToken();
  const response = await fetch(`${E2E_BACKEND_URL}/api${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  expect(response.status, `seed ${path}`).toBe(201);
  return ((await response.json()) as { data: T }).data;
}

/**
 * The list's results (table on desktop, list on mobile), without the applied-filter chips
 * that repeat a filter's value above them.
 */
export const results = (page: Page) => page.locator('section[aria-busy]').locator('table, ul');

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'page must not scroll horizontally').toBeLessThanOrEqual(0);
}

async function loadExisting(
  path: string,
  read: (item: Record<string, string>) => string,
  used: Set<string>,
) {
  for (let page = 1; ; page += 1) {
    const response = await fetch(`${E2E_BACKEND_URL}/api/${path}?page=${page}&limit=100`);
    const body = (await response.json()) as {
      data: Record<string, string>[];
      meta: { hasNextPage: boolean };
    };
    body.data.forEach((item) => used.add(read(item)));
    if (!body.meta.hasNextPage) return;
  }
}

/** Codes already in the e2e database, so generated codes never collide (workers can restart). */
async function loadExistingCodes() {
  await loadExisting('countries', (country) => country.code!, usedCodes);
  await loadExisting('currencies', (currency) => currency.currencyCode!, usedCurrencyCodes);
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- no test-scoped fixtures
export const test = base.extend<{}, { existingCodes: void }>({
  existingCodes: [
    async ({}, use) => {
      await loadExistingCodes();
      await use();
    },
    { scope: 'worker', auto: true },
  ],
});
export { expect };
