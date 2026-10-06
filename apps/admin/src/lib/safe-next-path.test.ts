import { describe, expect, it } from 'vitest';
import { DEFAULT_PATH, safeNextPath } from './safe-next-path';

describe('safeNextPath', () => {
  it('keeps same-app paths with their query', () => {
    expect(safeNextPath('/locations/cities?country=abc&page=2')).toBe(
      '/locations/cities?country=abc&page=2',
    );
  });

  it.each([
    null,
    '',
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/login',
    '/login?next=/x',
    '/bff/session',
  ])('falls back for %s', (value) => {
    expect(safeNextPath(value)).toBe(DEFAULT_PATH);
  });
});
