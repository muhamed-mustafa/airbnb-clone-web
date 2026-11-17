import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { UnitsScreen } from '@/features/units/units-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('units');
  return { title: t('title') };
}

export default function UnitsPage() {
  return (
    <Suspense>
      <UnitsScreen />
    </Suspense>
  );
}
