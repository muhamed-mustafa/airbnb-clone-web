import { readFileSync, writeFileSync } from 'node:fs';
import { zLoginAdminDtoWritable } from '@stays/api-contract/schemas';
import { describe, expect, it } from 'vitest';
import { citySchema } from '@/features/cities/schema';
import { countrySchema } from '@/features/countries/schema';
import { currencySchema } from '@/features/currencies/schema';
import { pricingSettingsSchema } from '@/features/settings/pricing-settings-schema';

/**
 * Guards the form validation against behavior changes, e.g. when the Zod flavor changes
 * (classic → mini). The golden file was recorded from the classic-Zod implementation.
 * For every input it fixes: success, the parsed output (so defaults cannot appear), and
 * each issue's code, path, limits, format and params. User-facing messages are derived
 * only from these fields (useZodErrorMap), so equal issues mean equal messages.
 *
 * Re-record deliberately with: UPDATE_VALIDATION_GOLDEN=1 pnpm vitest run validation-equivalence
 */
const GOLDEN = new URL('./__fixtures__/validation-golden.json', import.meta.url);

interface Parseable {
  safeParse: (input: unknown) => {
    success: boolean;
    data?: unknown;
    error?: { issues: Record<string, unknown>[] };
  };
}

const ISSUE_FIELDS = [
  'code',
  'path',
  'origin',
  'minimum',
  'maximum',
  'exact',
  'inclusive',
  'format',
  'params',
  'expected',
];

function describeResult(schema: Parseable, input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) return { success: true, data: result.data ?? null };
  return {
    success: false,
    issues: (result.error?.issues ?? []).map((issue) =>
      Object.fromEntries(
        ISSUE_FIELDS.filter((field) => issue[field] !== undefined).map((field) => [
          field,
          typeof issue[field] === 'bigint' ? String(issue[field]) : issue[field],
        ]),
      ),
    ),
  };
}

const NAMES = [
  '',
  ' ',
  'ab',
  ' ab ',
  'abc',
  ' Egypt ',
  'مصر',
  'القاهرة',
  'x'.repeat(50),
  'x'.repeat(51),
];
const CODES = [
  '',
  'eg',
  ' EG ',
  'e',
  'EGY',
  '1A',
  'A$',
  'egp',
  ' usd ',
  'EG',
  '123',
  'A$B',
  'E1P',
  'ÉGP',
  'جني',
  'EGPX',
];
const DECIMALS = [
  '',
  ' ',
  '0',
  '14',
  '14.5',
  '14.55',
  '14.555',
  '25',
  '25.01',
  '-1',
  '-0.01',
  'abc',
  '1e1',
  '0x10',
  '1.',
  '١٤٫٥',
  '14,5',
  '14%',
  '500',
  '500.75',
  '1000000',
];
const MONGO_IDS = ['', 'abc', '6aba3245612a916798f259ee'];

const CASES: Record<string, { schema: Parseable; inputs: unknown[] }> = {
  login: {
    schema: zLoginAdminDtoWritable as unknown as Parseable,
    inputs: [
      {},
      { email: '', password: '' },
      { email: 'not-an-email', password: 'x' },
      { email: 'admin@example.com', password: '' },
      { email: 'admin@example.com', password: 'secret' },
    ],
  },
  country: {
    schema: countrySchema as unknown as Parseable,
    inputs: NAMES.flatMap((name) => CODES.map((code) => ({ name, code }))),
  },
  city: {
    schema: citySchema as unknown as Parseable,
    inputs: NAMES.flatMap((name) => MONGO_IDS.map((country) => ({ name, country }))),
  },
  currency: {
    schema: currencySchema as unknown as Parseable,
    inputs: NAMES.flatMap((name) => CODES.map((currencyCode) => ({ name, currencyCode }))),
  },
  'pricing (stored)': {
    schema: pricingSettingsSchema({ vatRate: 14, minPrice: 500 }) as unknown as Parseable,
    inputs: DECIMALS.flatMap((vatRate) =>
      ['', '500', '-1', '500.555'].map((minPrice) => ({ vatRate, minPrice })),
    ).concat(DECIMALS.map((minPrice) => ({ vatRate: '14', minPrice }))),
  },
  'pricing (not stored yet)': {
    schema: pricingSettingsSchema(null) as unknown as Parseable,
    inputs: DECIMALS.flatMap((vatRate) => ['', '0'].map((minPrice) => ({ vatRate, minPrice }))),
  },
};

const actual = Object.fromEntries(
  Object.entries(CASES).map(([name, { schema, inputs }]) => [
    name,
    inputs.map((input) => ({ input, result: describeResult(schema, input) })),
  ]),
);

describe('form validation equivalence', () => {
  if (process.env.UPDATE_VALIDATION_GOLDEN) {
    it('records the golden file', () => {
      writeFileSync(GOLDEN, `${JSON.stringify(actual, null, 1)}\n`);
    });
    return;
  }

  const golden = JSON.parse(readFileSync(GOLDEN, 'utf8')) as typeof actual;

  it('covers the same cases as the golden file', () => {
    expect(Object.keys(actual)).toEqual(Object.keys(golden));
    for (const name of Object.keys(golden)) {
      expect(
        actual[name]!.map((entry) => entry.input),
        name,
      ).toEqual(golden[name]!.map((entry) => entry.input));
    }
  });

  for (const name of Object.keys(CASES)) {
    it(`${name}: same success, output and issues for every input`, () => {
      expect(actual[name]).toEqual(golden[name]);
    });
  }
});
