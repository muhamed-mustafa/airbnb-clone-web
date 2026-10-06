import { zCountriesCreateBody } from '@stays/api-contract/schemas';
import * as z from 'zod/mini';

// Limits come from the OpenAPI contract; the form trims/uppercases like the backend does.
// Latin letters only, matching the backend search ([A-Z]{2}); its write path checks the
// length only (contract defect D10). No ISO list is enforced.
export const countrySchema = z.object({
  name: z.pipe(z.string().check(z.trim()), zCountriesCreateBody.shape.name),
  code: z.pipe(
    z.string().check(z.trim(), z.toUpperCase()),
    zCountriesCreateBody.shape.code.check(z.regex(/^[A-Z]{2}$/)),
  ),
});
export type CountryInput = z.input<typeof countrySchema>;
export type CountryValues = z.output<typeof countrySchema>;
