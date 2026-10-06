import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AdminDetailScreen } from '@/features/admins/admin-detail-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admins');
  return { title: t('title') };
}

export default async function AdminDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminDetailScreen id={id} />;
}
