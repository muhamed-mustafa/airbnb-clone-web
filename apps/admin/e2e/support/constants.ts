export const E2E_DATABASE = 'airbnb-clone-e2e';
export const E2E_BACKEND_URL = 'http://localhost:3100';
const adminPort = process.env.E2E_ADMIN_PORT ?? '4100';
if (!/^\d+$/.test(adminPort) || Number(adminPort) < 1024 || Number(adminPort) > 65535) {
  throw new Error('E2E_ADMIN_PORT must be a port between 1024 and 65535.');
}
export const ADMIN_URL = `http://localhost:${Number(adminPort)}`;
