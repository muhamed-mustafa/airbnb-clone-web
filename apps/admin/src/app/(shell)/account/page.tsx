import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AccountScreen } from '@/features/account/account-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('account');
  return { title: t('profile') };
}

export default function AccountPage() {
  return <AccountScreen />;
}
