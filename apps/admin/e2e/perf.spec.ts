import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { signIn, test } from './support/fixtures';
import { installVitals, measure, throttle } from './support/perf';

// Lab measurement only (local production build, one run, Chromium). Not field data.
//   MEASURE_PERF=1 pnpm exec playwright test e2e/perf.spec.ts
// PERF_OUT keeps a new measurement apart from earlier ones (e.g. docs/ui-review/perf-lab.json).
const OUT = process.env.PERF_OUT
  ? fileURLToPath(new URL(`../../../${process.env.PERF_OUT}`, import.meta.url))
  : fileURLToPath(new URL('../../../docs/phase-1/perf-lab.json', import.meta.url));
test.skip(!process.env.MEASURE_PERF, 'Set MEASURE_PERF=1 to measure.');

const results: Record<string, unknown> = {};

test('lab metrics', async ({ page, browserName }, testInfo) => {
  test.setTimeout(120_000);
  await installVitals(page);
  await throttle(page, testInfo, browserName);
  const project = testInfo.project.name;
  results[`${project} /login`] = await measure(page, '/login');
  await signIn(page);
  results[`${project} /`] = await measure(page, '/');
  results[`${project} /locations/countries`] = await measure(page, '/locations/countries');
  results[`${project} /locations/cities`] = await measure(page, '/locations/cities');
  results[`${project} /catalog/currencies`] = await measure(page, '/catalog/currencies');
  results[`${project} /settings/pricing`] = await measure(page, '/settings/pricing');
  results[`${project} /catalog/unit-categories`] = await measure(page, '/catalog/unit-categories');
  results[`${project} /team/admins`] = await measure(page, '/team/admins');
  results[`${project} /account`] = await measure(page, '/account');
  writeFileSync(OUT.replace('.json', `-${project}.json`), JSON.stringify(results, null, 2));
  console.log(project, results);
});
