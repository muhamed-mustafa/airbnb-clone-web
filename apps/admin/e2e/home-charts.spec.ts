import { E2E_BACKEND_URL } from './support/constants';
import { backendAdminToken, expect, setLocale, signIn, test } from './support/fixtures';
import { seedReviewData } from './support/review-data';

// The home charts must show exactly what the API holds, with a bounded number of
// requests, and offer the same numbers as a table. Truth is read straight from the
// isolated backend, independently of the UI under test.

interface Page<T> {
  data: T[];
  meta: { total: number };
}

async function backend<T>(path: string): Promise<Page<T>> {
  const response = await fetch(`${E2E_BACKEND_URL}/api${path}`, {
    headers: { authorization: `Bearer ${await backendAdminToken()}` },
  });
  expect(response.status, path).toBe(200);
  return (await response.json()) as Page<T>;
}

test.describe('home charts', () => {
  test.skip(({ isMobile }) => isMobile, 'Data and requests do not depend on the viewport.');

  test('cities by country and admins by role match the API, with bounded requests', async ({
    page,
  }) => {
    await seedReviewData();
    const countries = await backend<{ id: string; name: string }>('/countries?page=1&limit=100');
    const truth = new Map<string, number>();
    for (const country of countries.data) {
      truth.set(
        country.name,
        (await backend(`/cities?page=1&limit=1&country=${country.id}`)).meta.total,
      );
    }
    const supers = (await backend('/admins?page=1&limit=1&isSuperAdmin=true')).meta.total;
    const regular = (await backend('/admins?page=1&limit=1&isSuperAdmin=false')).meta.total;

    const apiCalls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/bff/api/')) apiCalls.push(new URL(request.url()).search);
    });
    await setLocale(page, 'en');
    await signIn(page, '/');
    await page.waitForLoadState('networkidle');

    const perCountry = apiCalls.filter((search) => search.includes('country='));
    if (countries.meta.total > 12) {
      // Too many for per-country requests: an explanation, and no fan-out at all.
      await expect(page.getByText(/needs an aggregate endpoint/)).toBeVisible();
      expect(perCountry).toEqual([]);
    } else {
      // One limit=1 request per country, never more.
      expect(perCountry).toHaveLength(countries.meta.total);
      for (const search of perCountry) expect(search).toContain('limit=1');

      const rows = page.getByTestId('cities-chart').locator('.bar-row');
      await expect(rows).toHaveCount(countries.meta.total);
      const max = Math.max(1, ...truth.values());
      const track = await rows.first().locator('.bar-track').boundingBox();
      for (const [name, cities] of truth) {
        const row = rows.filter({ hasText: name });
        await expect(row).toHaveAttribute('data-value', String(cities));
        await expect(row.locator('.bar-value')).toHaveText(String(cities));
        if (cities === 0) {
          // A zero is never drawn as a bar: an empty track with a hollow marker.
          await expect(row.locator('.bar-fill')).toHaveCount(0);
          await expect(row.locator('.bar-zero')).toBeVisible();
        } else {
          // The bar's length is exactly proportional to the value.
          const fill = await row.locator('.bar-fill').boundingBox();
          expect(fill!.width).toBeCloseTo((cities / max) * track!.width, 0);
        }
      }

      // The accessible alternative: the same numbers in a real table.
      const cities = page.locator('section', { hasText: 'Cities by country' });
      await cities.getByText('Show data as a table').click();
      const table = cities.getByRole('table', { name: 'Cities by country' });
      await expect(table.getByRole('row')).toHaveCount(countries.meta.total + 1);
      for (const [name, value] of truth) {
        await expect(table.getByRole('row', { name: new RegExp(name) })).toContainText(
          String(value),
        );
      }
    }

    const admins = page.getByTestId('admins-chart');
    await expect(admins.locator('[data-part="super"]').first()).toHaveAttribute(
      'data-value',
      String(supers),
    );
    await expect(admins.locator('[data-part="regular"]').first()).toHaveAttribute(
      'data-value',
      String(regular),
    );
    const roles = page.locator('section', { hasText: 'Admin team by role' });
    await roles.getByText('Show data as a table').click();
    await expect(roles.getByRole('row', { name: /Super admin/ })).toContainText(String(supers));

    // Totals: one request per resource, two for the role split, one for the country list,
    // the per-country counts and the pricing settings. Nothing else.
    expect(apiCalls.length).toBeLessThanOrEqual(5 + 2 + 1 + perCountry.length + 1);
  });

  test('more than 12 countries: no per-country requests, an explanation instead', async ({
    page,
  }) => {
    // The list response is replaced only to simulate a large dataset in this test.
    await page.route('**/bff/api/countries?page=1&limit=12', (route) =>
      route.fulfill({
        json: {
          data: Array.from({ length: 12 }, (_, index) => ({
            id: `${'a'.repeat(23)}${index.toString(16)}`,
            name: `Country ${index}`,
            code: `C${index}`,
          })),
          meta: { page: 1, limit: 12, total: 13, totalPages: 2 },
        },
      }),
    );
    const perCountry: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/bff/api/cities') && request.url().includes('country=')) {
        perCountry.push(request.url());
      }
    });
    await setLocale(page, 'en');
    await signIn(page, '/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/You have 13 countries/)).toBeVisible();
    expect(perCountry).toEqual([]);
  });
});
