import { zCountriesCreateBody } from '@stays/api-contract/schemas';
import { z } from 'zod';

// Limits come from the OpenAPI contract; the form trims/uppercases like the backend does.
// Latin letters only, matching the backend search ([A-Z]{2}); its write path checks the
// length only (contract defect D10). No ISO list is enforced.
export const countrySchema = z.object({
  name: z.string().trim().pipe(zCountriesCreateBody.shape.name),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(zCountriesCreateBody.shape.code.regex(/^[A-Z]{2}$/)),
});
export type CountryInput = z.input<typeof countrySchema>;
export type CountryValues = z.output<typeof countrySchema>;
