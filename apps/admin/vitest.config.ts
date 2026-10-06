import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts', 'e2e/backend/*.test.ts'],
    environment: 'node',
    env: {
      API_BASE_URL: 'http://backend.test',
      APP_ORIGIN: 'http://admin.test',
      SESSION_SECRET: 'test-secret-test-secret-test-secret-123',
    },
  },
});
