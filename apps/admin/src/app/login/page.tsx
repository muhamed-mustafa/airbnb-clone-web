import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LoginForm } from '@/features/auth/login-form';
import { LocaleSwitch } from '@/features/shell/locale-switch';
import { safeNextPath } from '@/lib/safe-next-path';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('login');
  return { title: t('title') };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const params = await searchParams;
  const t = await getTranslations();
  const notice =
    params.reason === 'expired'
      ? t('login.expired')
      : params.reason === 'signed-out'
        ? t('login.signedOut')
        : undefined;

  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr] px-4">
      <header className="flex items-center justify-between py-4">
        <p className="text-sm font-semibold text-muted">{t('app.title')}</p>
        <LocaleSwitch />
      </header>
      <main className="grid items-start justify-items-center pt-[8vh]">
        <div className="grid w-full max-w-sm gap-6">
          <div className="grid gap-1">
            <h1 className="text-2xl font-semibold">{t('login.title')}</h1>
            <p className="text-sm text-muted">{t('login.intro')}</p>
          </div>
          {notice && (
            <p
              role="status"
              className="rounded-md border border-hairline bg-accent-tint px-3 py-2.5 text-sm text-ink"
            >
              {notice}
            </p>
          )}
          <LoginForm next={safeNextPath(params.next)} />
        </div>
      </main>
    </div>
  );
}
