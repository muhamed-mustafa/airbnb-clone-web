import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { UnitCategoriesScreen } from '@/features/unit-categories/unit-categories-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('unitCategories');
  return { title: t('title') };
}

export default function UnitCategoriesPage() {
  return (
    <Suspense>
      <UnitCategoriesScreen />
    </Suspense>
  );
}
