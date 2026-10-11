import { zUnitCategoriesCreateBody } from '@stays/api-contract/schemas';
import * as z from 'zod/mini';
export const categorySchema = z.object({
  name: z.pipe(z.string().check(z.trim()), zUnitCategoriesCreateBody.shape.name),
  icon: z.string().check(z.trim(), z.maxLength(100)),
});
export type UnitCategoryInput = z.input<typeof categorySchema>;
export type UnitCategoryValues = z.output<typeof categorySchema>;
