import { describe, expect, it } from 'vitest';
import { projectResponse, resolveUpstream } from './allowlist';

const ID = '6aba3245612a916798f259ee';
const resolve = (method: string, path: string, search = '') =>
  resolveUpstream(method, path.split('/'), new URLSearchParams(search));

describe('resolveUpstream', () => {
  it('maps allowed operations and keeps only known query parameters', () => {
    const target = resolve('GET', 'countries', 'name=egy&page=2&utm_source=x&sort=name');
    expect(target?.path).toBe('/countries');
    expect(target?.query.toString()).toBe('page=2&name=egy');
  });

  it('allows item operations with a valid id only', () => {
    expect(resolve('PATCH', `cities/${ID}`)?.path).toBe(`/cities/${ID}`);
    expect(resolve('DELETE', 'cities/../admins')).toBeUndefined();
    expect(resolve('GET', 'cities/not-an-id')).toBeUndefined();
  });

  it('refuses everything else, including admin identity endpoints', () => {
    // Admin accounts are read-only: every write is refused.
    expect(resolve('POST', 'admins')).toBeUndefined();
    expect(resolve('PATCH', `admins/${ID}`)).toBeUndefined();
    expect(resolve('DELETE', `admins/${ID}`)).toBeUndefined();
    expect(resolve('PUT', 'app-settings')).toBeUndefined(); // PATCH is allowed (settings screen)
    expect(resolve('PUT', `countries/${ID}`)).toBeUndefined();
    expect(resolve('DELETE', 'countries')).toBeUndefined();
    expect(resolve('GET', `countries/${ID}/cities`)).toBeUndefined();
  });

  it('drops empty query values instead of sending them', () => {
    expect(resolve('GET', 'cities', 'name=&country=')?.query.toString()).toBe('');
  });

  it('allows currencies with their own query parameters only', () => {
    const target = resolve('GET', 'currencies', 'currencyCode=EGP&code=EG&name=pound&country=x');
    expect(target?.path).toBe('/currencies');
    expect(target?.query.toString()).toBe('name=pound&currencyCode=EGP');
    expect(resolve('PATCH', `currencies/${ID}`)?.path).toBe(`/currencies/${ID}`);
    expect(resolve('DELETE', 'currencies')).toBeUndefined();
    expect(resolve('PUT', `currencies/${ID}`)).toBeUndefined();
  });

  it('allows reading and patching the settings singleton only', () => {
    expect(resolve('GET', 'app-settings')?.path).toBe('/app-settings');
    expect(resolve('PATCH', 'app-settings', 'x=1')?.query.toString()).toBe('');
    expect(resolve('PUT', 'app-settings')).toBeUndefined();
    expect(resolve('DELETE', 'app-settings')).toBeUndefined();
    expect(resolve('POST', 'app-settings')).toBeUndefined();
    expect(resolve('GET', `app-settings/${ID}`)).toBeUndefined();
  });

  it('allows reading admins with the documented filters, projected to safe fields', () => {
    const list = resolve(
      'GET',
      'admins',
      'name=sa&email=a@b.co&isSuperAdmin=true&password=x&page=2',
    );
    expect(list?.path).toBe('/admins');
    expect(list?.query.toString()).toBe('page=2&name=sa&email=a%40b.co&isSuperAdmin=true');
    expect(list?.responseFields).toEqual({
      id: 'string',
      name: 'string',
      email: 'string',
      isSuperAdmin: 'boolean',
    });
    expect(resolve('GET', `admins/${ID}`)?.responseFields).toEqual(list?.responseFields);
  });

  it('allows admin unit list and detail reads with only supported filters', () => {
    const list = resolve('GET', 'units/admin', 'title=sea&isActive=false&minPrice=10&sort=x');
    expect(list?.path).toBe('/units/admin');
    expect(list?.query.toString()).toBe('title=sea&minPrice=10&isActive=false');
    expect(resolve('GET', `units/admin/${ID}`)?.path).toBe(`/units/admin/${ID}`);
    expect(resolve('POST', 'units/admin')).toBeUndefined();
    expect(resolve('GET', 'units/admin/not-an-id')).toBeUndefined();
  });

  it('allows the admin booking list filters and text search only', () => {
    const list = resolve('GET', 'bookings/admin', 'status=PENDING&search=Mohamed&sort=createdAt');
    expect(list?.path).toBe('/bookings/admin');
    expect(list?.query.toString()).toBe('status=PENDING&search=Mohamed');
    expect(resolve('POST', 'bookings/admin')).toBeUndefined();
    expect(resolve('GET', `bookings/admin/${ID}`)).toBeUndefined();
  });
});

describe('projectResponse', () => {
  const FIELDS = resolveUpstream('GET', ['admins'], new URLSearchParams())!.responseFields!;
  // The shape GET /admins really returns today (report D11): entities with the hash.
  const leaked = {
    id: ID,
    name: 'E2E Admin',
    email: 'e2e-admin@example.com',
    password: '$argon2id$v=19$m=65536,t=3,p=4$abc',
    isSuperAdmin: true,
  };

  it('drops the password hash and any unknown field from lists, keeping meta', () => {
    const meta = {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    };
    const projected = projectResponse({ data: [{ ...leaked, extra: 1 }], meta }, FIELDS);
    expect(projected).toEqual({
      data: [{ id: ID, name: 'E2E Admin', email: 'e2e-admin@example.com', isSuperAdmin: true }],
      meta,
    });
    expect(JSON.stringify(projected)).not.toContain('argon2');
  });

  it('projects a single item', () => {
    expect(projectResponse({ data: leaked }, FIELDS)).toEqual({
      data: { id: ID, name: 'E2E Admin', email: 'e2e-admin@example.com', isSuperAdmin: true },
    });
  });

  it('fails closed on unexpected shapes', () => {
    expect(projectResponse(null, FIELDS)).toBeUndefined();
    expect(projectResponse('text', FIELDS)).toBeUndefined();
    expect(projectResponse({ items: [leaked] }, FIELDS)).toBeUndefined();
    expect(projectResponse({ data: [leaked, 'x'] }, FIELDS)).toBeUndefined();
  });

  const admin = {
    id: ID,
    name: 'E2E Admin',
    email: 'e2e-admin@example.com',
    isSuperAdmin: false,
  };
  const without = (field: keyof typeof admin) =>
    Object.fromEntries(Object.entries(admin).filter(([key]) => key !== field));
  const invalidItems: [string, unknown][] = [
    ['an empty item', {}],
    ...(['id', 'name', 'email', 'isSuperAdmin'] as const).map((field): [string, unknown] => [
      `no ${field}`,
      without(field),
    ]),
    ['a numeric id', { ...admin, id: 42 }],
    ['a null name', { ...admin, name: null }],
    ['an email object', { ...admin, email: { address: 'a@b.co' } }],
    ['isSuperAdmin as a string', { ...admin, isSuperAdmin: 'true' }],
    ['isSuperAdmin as a number', { ...admin, isSuperAdmin: 1 }],
    ['an inherited field', Object.assign(Object.create({ id: ID }), without('id'))],
  ];

  it.each(invalidItems)('fails closed on %s, in a list or alone', (_label, item) => {
    expect(projectResponse({ data: [item] }, FIELDS)).toBeUndefined();
    expect(projectResponse({ data: [admin, item] }, FIELDS)).toBeUndefined();
    expect(projectResponse({ data: item }, FIELDS)).toBeUndefined();
  });

  it('a valid item still passes with exactly the four fields', () => {
    expect(projectResponse({ data: [admin] }, FIELDS)).toEqual({ data: [admin] });
  });
});
