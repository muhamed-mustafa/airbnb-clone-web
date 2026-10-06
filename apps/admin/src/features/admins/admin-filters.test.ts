import { describe, expect, it } from 'vitest';
import { isSendableEmail, isSendableName, normalizeEmailFilter } from './admin-filters';

describe('admin list filters (backend FindAllDto rules)', () => {
  it('name: 2–50 characters, or empty to clear', () => {
    expect(isSendableName('')).toBe(true);
    expect(isSendableName('s')).toBe(false);
    expect(isSendableName('sa')).toBe(true);
    expect(isSendableName('x'.repeat(51))).toBe(false);
  });

  it('email: lowercased, and only addresses the backend pattern accepts are sent', () => {
    expect(normalizeEmailFilter('  E2E-Admin@Example.COM ')).toBe('e2e-admin@example.com');
    expect(isSendableEmail('')).toBe(true);
    expect(isSendableEmail('e2e-admin@example.com')).toBe(true);
    expect(isSendableEmail('e2e-admin@example')).toBe(false);
    expect(isSendableEmail('partial')).toBe(false);
    // D5: the backend rejects top-level domains longer than 4 letters.
    expect(isSendableEmail('someone@agency.travel')).toBe(false);
  });
});
