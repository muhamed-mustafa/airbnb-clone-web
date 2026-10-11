import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { signIn, test } from './support/fixtures';

// Lab measurement only (local production build, one run, Chromium). Not field data.
//   MEASURE_PERF=1 pnpm exec playwright test e2e/perf.spec.ts
const OUT = fileURLToPath(new URL('../../../docs/phase-1/perf-lab.json', import.meta.url));
test.skip(!process.env.MEASURE_PERF, 'Set MEASURE_PERF=1 to measure.');

const results: Record<string, unknown> = {};

async function measure(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  return page.evaluate(() => {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const js = resources.filter(
      (entry) => entry.initiatorType === 'script' || entry.name.endsWith('.js'),
    );
    const fonts = resources.filter((entry) => /\.woff2?$/.test(entry.name));
    const vitals = (window as unknown as { __vitals: { lcp?: number; cls: number } }).__vitals;
    const lcp = vitals.lcp;
    const cls = vitals.cls;
    return {
      jsKB: Math.round(js.reduce((sum, entry) => sum + entry.encodedBodySize, 0) / 1024),
      jsFiles: js.map((entry) => new URL(entry.name).pathname.split('/').pop()),
      fontKB: Math.round(fonts.reduce((sum, entry) => sum + entry.encodedBodySize, 0) / 1024),
      lcpMs: lcp === undefined ? null : Math.round(lcp),
      cls: Number(cls.toFixed(3)),
    };
  });
}

test('lab metrics', async ({ page, browserName }, testInfo) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    const vitals = { lcp: undefined as number | undefined, cls: 0 };
    (window as unknown as { __vitals: typeof vitals }).__vitals = vitals;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) vitals.lcp = entry.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
      }[]) {
        if (!entry.hadRecentInput) vitals.cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  // Every page is measured cold.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (testInfo.project.name === 'mobile' && browserName === 'chromium') {
    // Roughly Lighthouse's mobile profile: 4x CPU slowdown, ~1.6 Mbps, 150 ms RTT.
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
  }
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
  writeFileSync(OUT.replace('.json', `-${project}.json`), JSON.stringify(results, null, 2));
  console.log(project, results);
});
