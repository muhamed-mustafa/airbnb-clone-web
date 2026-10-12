import type { Page, TestInfo } from '@playwright/test';

/** Records LCP (time and element) and CLS on every page load of this page. */
export async function installVitals(page: Page) {
  await page.addInitScript(() => {
    const vitals = { lcp: undefined as number | undefined, lcpElement: '', cls: 0 };
    (window as unknown as { __vitals: typeof vitals }).__vitals = vitals;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as {
        startTime: number;
        element?: Element | null;
      }[]) {
        vitals.lcp = entry.startTime;
        const element = entry.element;
        vitals.lcpElement = element
          ? `${element.tagName.toLowerCase()}.${element.className} "${(element.textContent ?? '').trim().slice(0, 40)}"`
          : '';
      }
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
}

/** Every page cold; on the mobile project roughly Lighthouse's mobile profile. */
export async function throttle(page: Page, testInfo: TestInfo, browserName: string) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (testInfo.project.name === 'mobile' && browserName === 'chromium') {
    // 4x CPU slowdown, ~1.6 Mbps down, 750 kbps up, 150 ms RTT.
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
  }
}

/**
 * Loads a page and reports sizes, LCP and CLS, plus the timings that explain a slow LCP:
 * when the HTML started arriving, when CSS finished, the first paint, and when the last
 * BFF data request finished.
 */
export async function measure(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  return page.evaluate(() => {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const js = resources.filter(
      (entry) => entry.initiatorType === 'script' || entry.name.endsWith('.js'),
    );
    const fonts = resources.filter((entry) => /\.woff2?$/.test(entry.name));
    const css = resources.filter((entry) => entry.name.endsWith('.css'));
    const data = resources.filter((entry) => entry.name.includes('/bff/'));
    const navigation = performance.getEntriesByType('navigation')[0] as
      PerformanceNavigationTiming | undefined;
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    const vitals = (
      window as unknown as { __vitals: { lcp?: number; lcpElement: string; cls: number } }
    ).__vitals;
    const end = (entries: PerformanceResourceTiming[]) =>
      entries.length ? Math.round(Math.max(...entries.map((entry) => entry.responseEnd))) : null;
    return {
      jsKB: Math.round(js.reduce((sum, entry) => sum + entry.encodedBodySize, 0) / 1024),
      fontKB: Math.round(fonts.reduce((sum, entry) => sum + entry.encodedBodySize, 0) / 1024),
      ttfbMs: navigation ? Math.round(navigation.responseStart) : null,
      cssDoneMs: end(css),
      fcpMs: fcp ? Math.round(fcp.startTime) : null,
      lastDataMs: end(data),
      dataRequests: data.length,
      lcpMs: vitals.lcp === undefined ? null : Math.round(vitals.lcp),
      lcpElement: vitals.lcpElement,
      cls: Number(vitals.cls.toFixed(3)),
    };
  });
}
