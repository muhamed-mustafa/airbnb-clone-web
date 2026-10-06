import { zCurrenciesCreateBody } from '@stays/api-contract/schemas';
import * as z from 'zod/mini';

// Documented fields and limits (name 3–50, currencyCode exactly 3), trimmed and uppercased
// like the backend does. The code must also be Latin letters: the backend search only
// accepts [A-Z]{3}, while its write path checks the length only (contract defect D10), so a
// code like "123" would be saved but never be searchable. No ISO list is enforced.
export const currencySchema = z.object({
  name: z.pipe(z.string().check(z.trim()), zCurrenciesCreateBody.shape.name),
  currencyCode: z.pipe(
    z.string().check(z.trim(), z.toUpperCase()),
    zCurrenciesCreateBody.shape.currencyCode.check(z.regex(/^[A-Z]{3}$/)),
  ),
});
export type CurrencyInput = z.input<typeof currencySchema>;
export type CurrencyValues = z.output<typeof currencySchema>;
