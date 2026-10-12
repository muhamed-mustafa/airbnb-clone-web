import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { E2E_BACKEND_URL } from './support/constants';
import { backendAdminToken, expect, signIn, test } from './support/fixtures';
import { installVitals, measure, throttle } from './support/perf';
import { seedReviewData } from './support/review-data';

// Lab measurement of populated states (not the empty states of a fresh database): every
// sample is kept, so a slow one is reported rather than averaged away.
//   MEASURE_PERF=1 PERF_SAMPLES=5 pnpm exec playwright test e2e/perf-populated.spec.ts
const OUT = fileURLToPath(new URL('../../../docs/ui-review/perf-populated.json', import.meta.url));
const SAMPLES = Number(process.env.PERF_SAMPLES ?? 5);
const ROUTES = ['/', '/settings/pricing', '/team/admins'];
test.skip(!process.env.MEASURE_PERF, 'Set MEASURE_PERF=1 to measure.');

test('populated pages: lab metrics, every sample', async ({ page, browserName }, testInfo) => {
  test.setTimeout(SAMPLES * 90_000);
  await seedReviewData();
  const saved = await fetch(`${E2E_BACKEND_URL}/api/app-settings`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${await backendAdminToken()}`,
    },
    body: JSON.stringify({ vatRate: 14, minPrice: 250 }),
  });
  expect(saved.ok, 'pricing settings saved').toBe(true);

  await installVitals(page);
  await throttle(page, testInfo, browserName);
  await signIn(page);
  const samples: Record<string, unknown[]> = {};
  // Routes are interleaved so a slow moment of the machine does not hit one page only.
  for (let sample = 1; sample <= SAMPLES; sample += 1) {
    for (const route of ROUTES) {
      (samples[route] ??= []).push({ sample, ...(await measure(page, route)) });
    }
  }
  const project = testInfo.project.name;
  writeFileSync(OUT.replace('.json', `-${project}.json`), JSON.stringify(samples, null, 2));
});
