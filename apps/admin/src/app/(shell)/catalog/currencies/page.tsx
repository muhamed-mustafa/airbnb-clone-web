import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { CurrenciesScreen } from '@/features/currencies/currencies-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('currencies');
  return { title: t('title') };
}

export default function CurrenciesPage() {
  return (
    <Suspense>
      <CurrenciesScreen />
    </Suspense>
  );
}
