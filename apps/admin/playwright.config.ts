import { randomBytes } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';
import { ADMIN_URL, E2E_BACKEND_URL } from './e2e/support/constants';

/**
 * End-to-end tests run the production build of the admin against an isolated backend
 * (fix/d11-d12@3ed3f9c, port 3100, database airbnb-clone-e2e, test-only secrets). They never
 * touch the development backend or database.
 */
export default defineConfig({
  testDir: './e2e',
  // Vitest owns *.test.ts (e.g. e2e/backend helpers); Playwright runs specs only.
  testMatch: '**/*.spec.ts',
  globalSetup: './e2e/global-setup.ts',
  // One shared database: run serially for deterministic state.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // One JSON report per run, in its own folder: the HTML reporter wipes playwright-report/
  // and the next run wipes test-results/, so neither can hold the evidence of a failure.
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    [
      'json',
      { outputFile: `test-reports/e2e-${new Date().toISOString().replace(/[:.]/g, '-')}.json` },
    ],
  ],
  use: {
    baseURL: ADMIN_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // E2E_SKIP_BUILD=1 reuses an existing production build, e.g. for repeated stability runs.
    // E2E_DEV=1 runs `next dev` instead, to see development-only diagnostics such as hydration
    // warnings. Next locks .next/dev, so use it where no other `next dev` runs (a separate
    // checkout), never against someone's running development server.
    command: process.env.E2E_DEV
      ? `pnpm exec next dev --port ${new URL(ADMIN_URL).port}`
      : `${process.env.E2E_SKIP_BUILD ? '' : 'pnpm exec next build && '}pnpm exec next start --port ${new URL(ADMIN_URL).port}`,
    url: `${ADMIN_URL}/login`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      NODE_ENV: process.env.E2E_DEV ? 'development' : 'production',
      NEXT_TELEMETRY_DISABLED: '1',
      // E2E_UPSTREAM routes the BFF through a timing proxy (performance diagnosis only).
      API_BASE_URL: process.env.E2E_UPSTREAM ?? E2E_BACKEND_URL,
      APP_ORIGIN: ADMIN_URL,
      SESSION_SECRET: randomBytes(32).toString('base64url'),
      REFRESH_SKEW_SECONDS: '30',
    },
  },
});
