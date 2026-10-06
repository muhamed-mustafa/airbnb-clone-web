import { zCurrenciesCreateBody } from '@stays/api-contract/schemas';
import { z } from 'zod';

// Documented fields and limits (name 3–50, currencyCode exactly 3), trimmed and uppercased
// like the backend does. The code must also be Latin letters: the backend search only
// accepts [A-Z]{3}, while its write path checks the length only (contract defect D10), so a
// code like "123" would be saved but never be searchable. No ISO list is enforced.
export const currencySchema = z.object({
  name: z.string().trim().pipe(zCurrenciesCreateBody.shape.name),
  currencyCode: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(zCurrenciesCreateBody.shape.currencyCode.regex(/^[A-Z]{3}$/)),
});
export type CurrencyInput = z.input<typeof currencySchema>;
export type CurrencyValues = z.output<typeof currencySchema>;
