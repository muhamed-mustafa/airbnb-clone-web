import { describe, expect, it } from 'vitest';
import { nextListQuery } from './list-query';

const KEYS = ['name', 'code'] as const;
const q = (value: string) => new URLSearchParams(value);

describe('nextListQuery', () => {
  it('applies two quick filter changes on top of each other without losing one', () => {
    const afterName = nextListQuery(KEYS, q(''), { name: 'Alpha' });
    const afterCode = nextListQuery(KEYS, q(afterName), { code: 'EG' });
    expect(afterCode).toBe('name=Alpha&code=EG');
  });

  it('returns to page 1 when a filter changes, keeps filters when paging', () => {
    expect(nextListQuery(KEYS, q('name=Alpha&page=3'), { code: 'EG' })).toBe('name=Alpha&code=EG');
    expect(nextListQuery(KEYS, q('name=Alpha&page=3'), { page: 4 })).toBe('name=Alpha&page=4');
  });

  it('clears filters with empty values', () => {
    expect(nextListQuery(KEYS, q('name=Alpha&code=EG&page=2'), { name: '', code: '' })).toBe('');
  });

  it('drops parameters the list does not declare', () => {
    expect(nextListQuery(KEYS, q('name=Alpha&sort=name&utm=x'), { page: 2 })).toBe(
      'name=Alpha&page=2',
    );
  });
});
