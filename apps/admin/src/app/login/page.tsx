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
    <div className="auth-page min-h-dvh px-4 py-4 sm:px-8 sm:py-6">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BrandMark />
          <p className="text-sm font-semibold">{t('app.title')}</p>
        </div>
        <LocaleSwitch />
      </header>
      <main className="mx-auto grid min-h-[calc(100dvh-110px)] max-w-6xl items-center py-8 sm:py-12">
        <div className="auth-card grid overflow-hidden rounded-[24px] lg:grid-cols-[1fr_1.05fr]">
          <section
            className="auth-art hidden flex-col justify-between p-12 lg:flex"
            aria-label={t('design.welcome')}
          >
            <div className="relative z-10 grid gap-5">
              <p className="text-xs font-semibold tracking-[.16em] text-[#edc78c]">
                {t('design.adminSpace')}
              </p>
              <h2 className="max-w-sm text-4xl font-semibold leading-[1.4]">
                {t('design.welcome')}
              </h2>
              <p className="max-w-sm text-sm leading-7 text-[#b1c0d4]">{t('design.welcomeBody')}</p>
            </div>
            <div className="architecture-art" aria-hidden="true">
              <svg viewBox="0 0 350 350" className="relative z-10 h-full w-full" fill="none">
                <path
                  d="M69 260V143l106-69 106 69v117H69Z"
                  fill="#ffffff04"
                  stroke="#82afff"
                  strokeWidth="1.5"
                />
                <path
                  d="M103 260V163l72-46 72 46v97M144 260v-77h62v77M69 143h212M103 163h144M144 183h62"
                  stroke="#82afff"
                  strokeOpacity=".55"
                />
                <path d="M38 281h274M175 43v254" stroke="#ffffff20" strokeDasharray="3 6" />
                <circle cx="175" cy="74" r="5" fill="#82afff" />
                <circle cx="69" cy="260" r="4" fill="#82afff" />
                <circle cx="281" cy="260" r="4" fill="#82afff" />
              </svg>
            </div>
            <p className="relative z-10 border-t border-white/10 pt-6 text-xs text-[#b1c0d4]">
              {t('design.workspace')}
            </p>
          </section>
          <section className="grid content-center gap-7 p-6 sm:p-10 lg:px-14 lg:py-14">
            <div className="grid gap-3">
              <span className="mb-2 lg:hidden">
                <BrandMark />
              </span>
              <p className="text-xs font-semibold tracking-wide text-accent">
                {t('design.adminSpace')}
              </p>
              <h1 className="text-2xl font-semibold sm:text-3xl">{t('login.title')}</h1>
              <p className="text-sm leading-6 text-muted">{t('login.intro')}</p>
            </div>
            {params.reason === 'signed-out' ? (
              <LogoutNotice message={t('login.signedOut')} />
            ) : notice ? (
              <p
                role="status"
                className="route-enter rounded-md border border-hairline bg-accent-tint px-3 py-2.5 text-sm text-ink"
              >
                {notice}
              </p>
            ) : null}
            <LoginForm next={safeNextPath(params.next)} />
            <p className="border-t border-hairline pt-5 text-xs leading-6 text-muted">
              {t('design.signInNote')}
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
