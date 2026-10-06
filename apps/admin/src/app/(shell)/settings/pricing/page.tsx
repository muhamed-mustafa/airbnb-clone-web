import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PricingSettingsScreen } from '@/features/settings/pricing-settings-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pricingSettings');
  return { title: t('title') };
}

export default function PricingSettingsPage() {
  return <PricingSettingsScreen />;
}
