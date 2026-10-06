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
});
