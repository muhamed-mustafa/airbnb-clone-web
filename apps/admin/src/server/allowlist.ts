/**
 * The BFF proxy is not open: only these backend operations are reachable from the
 * browser, with only these query parameters (the backend answers 400 to unknown ones).
 * The signed-in admin's own identity is read by /bff/session internally.
 *
 * A rule may also project successful responses to a fixed set of fields. Admin accounts
 * need it: the backend's GET /admins list returns entities including the password hash
 * (report D11), which must never reach the browser. GET /admins/{id} is mapped by the
 * backend today; it is projected too, so a regression there cannot leak either.
 */

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface Rule {
  resource: 'countries' | 'cities' | 'currencies' | 'app-settings' | 'admins';
  withId: boolean;
  methods: readonly Method[];
  query: readonly string[];
  /** Required fields of `data` (object or array of objects) and their types; nothing else passes. */
  responseFields?: ResponseShape;
}

export type ResponseShape = Readonly<Record<string, 'string' | 'boolean'>>;

const ADMIN_FIELDS: ResponseShape = {
  id: 'string',
  name: 'string',
  email: 'string',
  isSuperAdmin: 'boolean',
};

const RULES: readonly Rule[] = [
  {
    resource: 'countries',
    withId: false,
    methods: ['GET'],
    query: ['page', 'limit', 'name', 'code'],
  },
  { resource: 'countries', withId: false, methods: ['POST'], query: [] },
  { resource: 'countries', withId: true, methods: ['GET', 'PATCH', 'DELETE'], query: [] },
  {
    resource: 'cities',
    withId: false,
    methods: ['GET'],
    query: ['page', 'limit', 'name', 'country'],
  },
  { resource: 'cities', withId: false, methods: ['POST'], query: [] },
  { resource: 'cities', withId: true, methods: ['GET', 'PATCH', 'DELETE'], query: [] },
  {
    resource: 'currencies',
    withId: false,
    methods: ['GET'],
    query: ['page', 'limit', 'name', 'currencyCode'],
  },
  { resource: 'currencies', withId: false, methods: ['POST'], query: [] },
  { resource: 'currencies', withId: true, methods: ['GET', 'PATCH', 'DELETE'], query: [] },
  // Singleton: read and partial update only.
  { resource: 'app-settings', withId: false, methods: ['GET', 'PATCH'], query: [] },
  // Admin accounts are read-only in the API (no create, update or delete endpoints).
  {
    resource: 'admins',
    withId: false,
    methods: ['GET'],
    query: ['page', 'limit', 'name', 'email', 'isSuperAdmin'],
    responseFields: ADMIN_FIELDS,
  },
  { resource: 'admins', withId: true, methods: ['GET'], query: [], responseFields: ADMIN_FIELDS },
];

const MONGO_ID = /^[a-f0-9]{24}$/i;

export interface UpstreamTarget {
  path: string;
  query: URLSearchParams;
  responseFields?: ResponseShape;
}

export function resolveUpstream(
  method: string,
  segments: readonly string[],
  search: URLSearchParams,
): UpstreamTarget | undefined {
  const [resource, id, ...rest] = segments;
  if (rest.length > 0) return undefined;
  if (id !== undefined && !MONGO_ID.test(id)) return undefined;

  const rule = RULES.find(
    (candidate) =>
      candidate.resource === resource &&
      candidate.withId === (id !== undefined) &&
      candidate.methods.includes(method.toUpperCase() as Method),
  );
  if (!rule) return undefined;

  const query = new URLSearchParams();
  for (const name of rule.query) {
    const value = search.get(name);
    if (value !== null && value !== '') query.set(name, value);
  }
  return {
    path: id ? `/${rule.resource}/${id}` : `/${rule.resource}`,
    query,
    ...(rule.responseFields && { responseFields: rule.responseFields }),
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Rebuild `data` from the shape's fields only (and keep `meta` as is). Every item must have
 * every field with its type. Returns undefined for anything else (missing field, wrong type,
 * unexpected body), so the caller fails closed instead of passing the raw body through.
 */
export function projectResponse(body: unknown, shape: ResponseShape): unknown {
  if (!isRecord(body)) return undefined;
  const fields = Object.entries(shape);
  const pick = (item: unknown) =>
    isRecord(item) &&
    fields.every(([field, type]) => Object.hasOwn(item, field) && typeof item[field] === type)
      ? Object.fromEntries(fields.map(([field]) => [field, item[field]]))
      : undefined;
  if (Array.isArray(body.data)) {
    const items = body.data.map(pick);
    if (items.some((item) => item === undefined)) return undefined;
    return { data: items, ...(body.meta !== undefined && { meta: body.meta }) };
  }
  const item = pick(body.data);
  return item === undefined ? undefined : { data: item };
}
