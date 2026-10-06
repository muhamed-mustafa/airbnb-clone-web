import { describe, expect, it } from 'vitest';
import {
  changedSettings,
  normalizeDecimalInput,
  pricingSettingsSchema,
} from './pricing-settings-schema';

const STORED = { vatRate: 14, minPrice: 500 };
const configured = pricingSettingsSchema(STORED);
const fresh = pricingSettingsSchema(null);

const parse = (vatRate: string, minPrice: string, schema = configured) =>
  schema.safeParse({ vatRate, minPrice });
const firstIssue = (vatRate: string, minPrice: string, schema = configured) => {
  const result = parse(vatRate, minPrice, schema);
  return result.success ? undefined : result.error.issues[0];
};

describe('normalizeDecimalInput', () => {
  it.each([
    [' 14 ', '14'],
    ['١٤', '14'],
    ['١٤٫٥', '14.5'],
    ['۱۴٫۲۵', '14.25'],
    ['14,5', '14.5'],
    ['14%', '14'],
    ['١٤٪', '14'],
    ['٥٠٠٫٧٥', '500.75'],
  ])('%j → %j', (input, output) => {
    expect(normalizeDecimalInput(input)).toBe(output);
  });
});

describe('vatRate (a percentage: 14 means 14%)', () => {
  it.each([
    ['0', 0],
    ['14', 14],
    ['14.5', 14.5],
    ['14.55', 14.55],
    ['25', 25],
    ['١٤٫٥', 14.5],
  ])('accepts %j as %d', (input, value) => {
    expect(parse(input, '500').data?.vatRate).toBe(value);
  });

  it('rejects values outside 0–25 with the range message', () => {
    expect(firstIssue('25.01', '500')).toMatchObject({ code: 'too_big', path: ['vatRate'] });
    expect(firstIssue('-1', '500')).toMatchObject({ code: 'too_small', path: ['vatRate'] });
  });

  it('rejects more than two decimals and non-numbers', () => {
    for (const input of ['14.555', 'abc', '1e1', '0x10', '1.']) {
      expect(firstIssue(input, '500'), input).toMatchObject({ code: 'custom', path: ['vatRate'] });
    }
  });
});

describe('minPrice (no currency or basis assumed)', () => {
  it.each([
    ['0', 0],
    ['500', 500],
    ['500.5', 500.5],
    ['500.55', 500.55],
    ['1000000', 1000000],
    ['٥٠٠٫٧٥', 500.75],
  ])('accepts %j as %d', (input, value) => {
    expect(parse('14', input).data?.minPrice).toBe(value);
  });

  it('rejects negative numbers with the range message', () => {
    expect(firstIssue('14', '-0.01')).toMatchObject({ code: 'too_small', path: ['minPrice'] });
  });

  it('rejects more than two decimals and non-numbers', () => {
    for (const input of ['500.555', 'abc', '5e2']) {
      expect(firstIssue('14', input), input).toMatchObject({ code: 'custom', path: ['minPrice'] });
    }
  });
});

describe('empty fields', () => {
  it('are required once settings are stored (a stored value cannot be cleared)', () => {
    expect(firstIssue('', '500')).toMatchObject({ code: 'invalid_type', path: ['vatRate'] });
    expect(firstIssue('14', '  ')).toMatchObject({ code: 'invalid_type', path: ['minPrice'] });
  });

  it('are allowed before the first save and are then not sent', () => {
    expect(parse('14', '', fresh)).toEqual({
      success: true,
      data: { vatRate: 14, minPrice: undefined },
    });
  });
});

describe('changedSettings', () => {
  it('sends only the tax when only the tax changed (never minPrice)', () => {
    expect(changedSettings({ vatRate: 15, minPrice: 500 }, STORED)).toEqual({ vatRate: 15 });
  });

  it('sends only minPrice when only minPrice changed', () => {
    expect(changedSettings({ vatRate: 14, minPrice: 750.5 }, STORED)).toEqual({ minPrice: 750.5 });
  });

  it('sends both when both changed, nothing when nothing changed', () => {
    expect(changedSettings({ vatRate: 0, minPrice: 0 }, STORED)).toEqual({
      vatRate: 0,
      minPrice: 0,
    });
    expect(changedSettings({ vatRate: 14, minPrice: 500 }, STORED)).toEqual({});
  });

  it('before the first save, sends only what was entered', () => {
    expect(changedSettings({ vatRate: 14, minPrice: undefined }, null)).toEqual({ vatRate: 14 });
    expect(changedSettings({ vatRate: undefined, minPrice: 0 }, null)).toEqual({ minPrice: 0 });
  });
});
