import { zUpsertAppSettingsDto } from '@stays/api-contract/schemas';
import { z } from 'zod';

const EASTERN_ARABIC_DIGITS = /[٠-٩]/g;
const PERSIAN_DIGITS = /[۰-۹]/g;

/**
 * Accept what an Arabic or English keyboard produces: Arabic-Indic digits, the Arabic
 * decimal separator (٫) or a comma, surrounding spaces and a trailing percent sign.
 * Returns a plain ASCII decimal string; it does not decide whether it is valid.
 */
export function normalizeDecimalInput(value: string): string {
  return value
    .trim()
    .replace(EASTERN_ARABIC_DIGITS, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(PERSIAN_DIGITS, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٫,]/g, '.')
    .replace(/\s*[%٪]$/, '')
    .trim();
}

/**
 * Number limits come from the OpenAPI contract (vatRate 0–25, minPrice ≥ 0). Only the
 * number checks are taken: the generated body schema also carries `.default(0)` for both
 * fields, so parsing a body with it would silently add the other field. Bodies are built
 * by hand from the changed fields only.
 */
const vatRateNumber = zUpsertAppSettingsDto.shape.vatRate.unwrap().unwrap();
const minPriceNumber = zUpsertAppSettingsDto.shape.minPrice.unwrap().unwrap();

/**
 * At most two decimals: enforced by the backend DTO (`IsNumber({ maxDecimalPlaces: 2 })`)
 * but not described in OpenAPI, so this rule is written here. A leading minus passes this
 * format check so negative numbers get the range message ("at least 0").
 */
const DECIMAL = /^-?\d+(\.\d{1,2})?$/;

/** A decimal text field. Empty means "not given" when `required` is false. */
function decimalField(number: z.ZodNumber, required: boolean) {
  const parsed = z
    .string()
    .transform(normalizeDecimalInput)
    .pipe(
      z.string().refine((text) => text === '' || DECIMAL.test(text), {
        params: { i18n: 'decimalNumber', maxDecimals: 2 },
      }),
    )
    .transform((text) => (text === '' ? undefined : Number(text)));
  return required ? parsed.pipe(number) : parsed.pipe(number.optional());
}

/**
 * Before the first save nothing is stored, so either field may stay empty and is then not
 * sent. Once a value is stored it cannot be cleared (the backend rejects null), so the
 * field becomes required.
 */
export function pricingSettingsSchema(stored: { vatRate: number; minPrice: number } | null) {
  return z.object({
    vatRate: decimalField(vatRateNumber, stored !== null),
    minPrice: decimalField(minPriceNumber, stored !== null),
  });
}

export type PricingSettingsInput = z.input<ReturnType<typeof pricingSettingsSchema>>;
export type PricingSettingsValues = z.output<ReturnType<typeof pricingSettingsSchema>>;

export type PricingSettingsPatch = Partial<{ vatRate: number; minPrice: number }>;

/** Only the fields whose value differs from what is stored. */
export function changedSettings(
  values: PricingSettingsValues,
  stored: { vatRate: number; minPrice: number } | null,
): PricingSettingsPatch {
  const patch: PricingSettingsPatch = {};
  if (values.vatRate !== undefined && values.vatRate !== stored?.vatRate) {
    patch.vatRate = values.vatRate;
  }
  if (values.minPrice !== undefined && values.minPrice !== stored?.minPrice) {
    patch.minPrice = values.minPrice;
  }
  return patch;
}
