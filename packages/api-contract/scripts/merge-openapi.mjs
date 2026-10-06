// The backend publishes one OpenAPI document per audience (user, admin, shared) and
// no combined document (report D4/B10). Merge them into a single snapshot so types and
// Zod schemas are generated from one source. The snapshot is committed, so builds never
// need a running backend.
import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl = process.env.API_DOCS_BASE_URL ?? 'http://localhost:3000';
const audiences = ['user', 'admin', 'shared'];

const documents = await Promise.all(
  audiences.map(async (audience) => {
    const response = await fetch(`${baseUrl}/api/docs/${audience}-json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${audience} OpenAPI document: HTTP ${response.status}`);
    }
    return response.json();
  }),
);

const [first] = documents;
const merged = {
  openapi: first.openapi,
  info: { ...first.info, title: 'Airbnb Clone API (merged)', description: undefined },
  servers: first.servers,
  paths: {},
  components: { ...first.components, schemas: {} },
};

for (const document of documents) {
  for (const [path, item] of Object.entries(document.paths)) {
    merged.paths[path] = { ...merged.paths[path], ...item };
  }
  Object.assign(merged.components.schemas, document.components?.schemas ?? {});
}

await mkdir(new URL('../openapi/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../openapi/openapi.json', import.meta.url),
  `${JSON.stringify(merged, null, 2)}\n`,
);

const operations = Object.values(merged.paths).reduce(
  (count, item) => count + Object.keys(item).length,
  0,
);
console.log(`Merged ${operations} operations from ${baseUrl} into openapi/openapi.json`);
