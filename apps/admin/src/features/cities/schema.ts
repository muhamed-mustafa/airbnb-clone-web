import { zCitiesCreateBody } from '@stays/api-contract/schemas';
import * as z from 'zod/mini';

// Limits come from the OpenAPI contract; the name is trimmed like the backend does.
export const citySchema = z.object({
  name: z.pipe(z.string().check(z.trim()), zCitiesCreateBody.shape.name),
  country: z.pipe(z.string().check(z.minLength(1)), zCitiesCreateBody.shape.country),
});
export type CityInput = z.input<typeof citySchema>;
export type CityValues = z.output<typeof citySchema>;
