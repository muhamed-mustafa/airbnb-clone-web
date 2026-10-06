import { describe, expect, it } from 'vitest';
import { countrySchema } from '@/features/countries/schema';
import { currencySchema } from './schema';

const codeIssues = (schema: typeof currencySchema | typeof countrySchema, code: string) => {
  const input =
    schema === currencySchema
      ? { name: 'Valid name', currencyCode: code }
      : { name: 'Valid name', code };
  const result = schema.safeParse(input);
  return result.success
    ? []
    : result.error.issues.map(
        (issue) => `${issue.code}${'format' in issue ? `:${issue.format}` : ''}`,
      );
};

describe('currency code (create and edit share this schema)', () => {
  it('accepts three Latin letters after trim and uppercase', () => {
    expect(currencySchema.parse({ name: '  Egyptian Pound ', currencyCode: ' egp ' })).toEqual({
      name: 'Egyptian Pound',
      currencyCode: 'EGP',
    });
  });

  it.each(['123', 'A$B', 'E1P', 'ÉGP', 'جني'])('rejects %j as not Latin letters', (code) => {
    expect(codeIssues(currencySchema, code)).toEqual(['invalid_format:regex']);
  });

  it('reports the length first for codes of the wrong length', () => {
    expect(codeIssues(currencySchema, 'EG')[0]).toBe('too_small');
    expect(codeIssues(currencySchema, 'EGPX')[0]).toBe('too_big');
  });

  it('does not restrict to an ISO list', () => {
    expect(codeIssues(currencySchema, 'ZZZ')).toEqual([]);
  });
});

describe('country code', () => {
  it('accepts two Latin letters after trim and uppercase', () => {
    expect(countrySchema.parse({ name: 'Egypt', code: ' eg ' }).code).toBe('EG');
  });

  it.each(['1A', 'A$', '12'])('rejects %j as not Latin letters', (code) => {
    expect(codeIssues(countrySchema, code)).toEqual(['invalid_format:regex']);
  });
});
