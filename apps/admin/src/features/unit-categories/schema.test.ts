import { describe, expect, it } from 'vitest';
import { categorySchema } from './schema';

describe('accommodation type schema', () => {
  it('accepts Arabic names and an empty optional icon without adding defaults', () => {
    expect(categorySchema.parse({ name: ' شقة ', icon: '' })).toEqual({ name: 'شقة', icon: '' });
  });
  it('enforces name and icon limits', () => {
    expect(categorySchema.safeParse({ name: 'ab', icon: '' }).success).toBe(false);
    expect(categorySchema.safeParse({ name: 'Villa', icon: 'x'.repeat(101) }).success).toBe(false);
    expect(categorySchema.safeParse({ name: 'x'.repeat(51), icon: '' }).success).toBe(false);
  });
});
