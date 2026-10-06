import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { CitiesScreen } from '@/features/cities/cities-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('cities');
  return { title: t('title') };
}

export default function CitiesPage() {
  return (
    <Suspense>
      <CitiesScreen />
    </Suspense>
  );
}
