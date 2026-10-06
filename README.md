# airbnb-clone-web

Frontends for the stays platform. Talks to the NestJS API in `../airbnb-clone-api`.

| Package                 | What it is                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `apps/admin`            | Admin panel (Next.js). Sign-in, countries, cities, currencies.                       |
| `packages/api-contract` | Types and Zod schemas generated from the backend OpenAPI, plus the error normalizer. |

`apps/web` (customer site) is not started; it waits for the listings, pricing, availability and booking contract.

## Requirements

- Node 24 LTS (`.nvmrc`), pnpm 11
- The backend's MongoDB replica set (`docker compose up -d` in `airbnb-clone-api`)

## Run the admin locally

```bash
pnpm install
cp apps/admin/.env.example apps/admin/.env.local   # then set SESSION_SECRET (32+ random chars)
pnpm dev:admin                                      # http://localhost:4100
```

The browser never calls the API directly. `apps/admin/src/app/bff/*` is a backend-for-frontend:
it keeps the tokens in an encrypted HttpOnly cookie and proxies an allowlist of operations.
See `docs/session-error-contract.md`.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test          # unit tests (Vitest)
pnpm e2e           # Playwright, desktop + mobile, against an isolated backend
pnpm format:check
```

`pnpm e2e` builds a copy of the backend at a pinned commit (`git archive`, no `.env`, nothing
written to the backend repository), runs it on port 3100 against the `airbnb-clone-e2e`
database with test-only secrets, and wipes that database first, only after checking on the live
connection that its name is exactly `airbnb-clone-e2e`. Change the commit with `E2E_BACKEND_REF`.

Optional:

```bash
# Every e2e run also writes apps/admin/test-reports/e2e-<timestamp>.json (kept across runs).
CAPTURE_SCREENS=1 pnpm --filter @stays/admin exec playwright test e2e/screens.spec.ts
MEASURE_PERF=1 pnpm --filter @stays/admin exec playwright test e2e/perf.spec.ts
```

## Updating the API contract

```bash
pnpm api:sync      # merges /api/docs/{user,admin,shared}-json from http://localhost:3000, regenerates
```

The merged `packages/api-contract/openapi/openapi.json` is committed, so builds never need the backend.
