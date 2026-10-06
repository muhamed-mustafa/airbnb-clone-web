import { randomBytes } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';
import { ADMIN_URL, E2E_BACKEND_URL } from './e2e/support/constants';

/**
 * End-to-end tests run the production build of the admin against an isolated backend
 * (main@4d43d07, port 3100, database airbnb-clone-e2e, test-only secrets). They never
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
  // The JSON report keeps failures of every run (test-results/ is cleared by the next run).
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: `playwright-report/results-${Date.now()}.json` }],
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
    command: 'pnpm exec next build && pnpm exec next start --port 4100',
    url: `${ADMIN_URL}/login`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      NODE_ENV: 'production',
      NEXT_TELEMETRY_DISABLED: '1',
      API_BASE_URL: E2E_BACKEND_URL,
      APP_ORIGIN: ADMIN_URL,
      SESSION_SECRET: randomBytes(32).toString('base64url'),
      REFRESH_SKEW_SECONDS: '30',
    },
  },
});
