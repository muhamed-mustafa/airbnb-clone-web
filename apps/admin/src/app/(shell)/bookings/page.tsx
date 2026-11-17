import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { BookingsScreen } from '@/features/bookings/bookings-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('bookings');
  return { title: t('title') };
}

export default function BookingsPage() {
  return (
    <Suspense>
      <BookingsScreen />
    </Suspense>
  );
}
