import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: './openapi/openapi.json',
  output: './src/generated',
  plugins: [
    '@hey-api/typescript',
    // Zod Mini is tree-shakeable: forms ship ~6 KB of validation instead of ~90 KB (gzip),
    // measured in docs/phase-1/REPORT.md.
    { name: 'zod', compatibilityVersion: 'mini' },
  ],
});
