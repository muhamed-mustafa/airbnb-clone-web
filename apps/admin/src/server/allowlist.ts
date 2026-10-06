/**
 * The BFF proxy is not open: only these backend operations are reachable from the
 * browser, with only these query parameters (the backend answers 400 to unknown ones).
 * Admin identity is read by /bff/session internally, not through this proxy.
 */

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface Rule {
  resource: 'countries' | 'cities' | 'currencies' | 'app-settings';
  withId: boolean;
  methods: readonly Method[];
  query: readonly string[];
}

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
];

const MONGO_ID = /^[a-f0-9]{24}$/i;

export interface UpstreamTarget {
  path: string;
  query: URLSearchParams;
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
  return { path: id ? `/${rule.resource}/${id}` : `/${rule.resource}`, query };
}
