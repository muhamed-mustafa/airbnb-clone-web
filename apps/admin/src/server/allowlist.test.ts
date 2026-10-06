import { describe, expect, it } from 'vitest';
import { resolveUpstream } from './allowlist';

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
    expect(resolve('GET', 'admins')).toBeUndefined();
    expect(resolve('GET', `admins/${ID}`)).toBeUndefined();
    expect(resolve('PATCH', 'app-settings')).toBeUndefined();
    expect(resolve('PUT', `countries/${ID}`)).toBeUndefined();
    expect(resolve('DELETE', 'countries')).toBeUndefined();
    expect(resolve('GET', `countries/${ID}/cities`)).toBeUndefined();
  });

  it('drops empty query values instead of sending them', () => {
    expect(resolve('GET', 'cities', 'name=&country=')?.query.toString()).toBe('');
  });
});
