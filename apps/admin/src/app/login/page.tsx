import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BrandMark } from '@/ui/brand';
import { LoginForm } from '@/features/auth/login-form';
import { LogoutNotice } from '@/features/auth/logout-notice';
import { LocaleSwitch } from '@/features/shell/locale-switch';
import { safeNextPath } from '@/lib/safe-next-path';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('login');
  return { title: t('title') };
}

/** One focused task: a single card with the form; no decorative panel. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const params = await searchParams;
  const t = await getTranslations();

  return (
    <div className="auth-page grid min-h-dvh grid-rows-[auto_1fr] px-4 py-4 sm:px-8 sm:py-6">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BrandMark />
          <p className="text-sm font-semibold">{t('app.title')}</p>
        </div>
        <LocaleSwitch />
      </header>
      <main className="grid place-items-center py-8 sm:py-12">
        <section className="auth-card grid w-full max-w-[26rem] gap-6 p-6 sm:p-8">
          <div className="grid gap-1.5">
            <h1 className="text-2xl font-semibold">{t('login.title')}</h1>
            <p className="text-sm text-muted">{t('login.intro')}</p>
          </div>
          {params.reason === 'signed-out' ? (
            <LogoutNotice message={t('login.signedOut')} />
          ) : params.reason === 'expired' ? (
            <p role="status" className="auth-notice">
              {t('login.expired')}
            </p>
          ) : null}
          <LoginForm next={safeNextPath(params.next)} />
          <p className="border-t border-hairline pt-4 text-xs text-muted">
            {t('design.signInNote')}
          </p>
        </section>
      </main>
    </div>
  );
}
