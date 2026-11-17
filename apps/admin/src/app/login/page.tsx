import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BrandMark } from '@/ui/brand';
import { LoginForm } from '@/features/auth/login-form';
import { LogoutNotice } from '@/features/auth/logout-notice';
import { LocaleSwitch } from '@/features/shell/locale-switch';
import { ThemeSwitch } from '@/theme/theme-switch';
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

  return (
    <div className="auth-page min-h-dvh px-4 py-4 sm:px-8 sm:py-6">
      <header className="auth-topbar mx-auto flex w-full items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BrandMark />
          <p className="text-sm font-semibold">{t('app.title')}</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeSwitch compact />
          <LocaleSwitch />
        </div>
      </header>
      <main className="auth-main mx-auto grid w-full place-items-center">
        <div className="auth-layout">
          <section className="auth-story-panel" aria-label={t('login.storyTitle')}>
            <div className="auth-panel-meta">
              <span className="auth-panel-index">STAYS / 01</span>
              <span className="auth-panel-status">
                <span className="auth-status-dot" aria-hidden="true" />
                {t('login.storyEyebrow')}
              </span>
            </div>
            <div className="auth-map" aria-hidden="true">
              <svg viewBox="0 0 580 260" fill="none" role="presentation">
                <path className="auth-map-road" d="M-18 52 80 80l72-32 68 24 98-40 78 42 88-26 116 36" />
                <path className="auth-map-road" d="m-26 111 97 25 74-27 74 30 85-18 88 41 94-40 116 28" />
                <path className="auth-map-road" d="m-14 197 105-23 62 31 84-43 72 22 90-39 89 27 103-23" />
                <path className="auth-map-road" d="m83-10 18 68-28 76 32 63-13 77m107-274 9 57-30 76 25 66-9 72m115-277-26 69 31 76-21 62 9 69m116-278-19 63 27 73-17 62 34 66m100-253-21 67 20 65-21 55 29 63" />
                <path className="auth-map-route" d="M42 196c46-43 73-18 116-61s76-44 123-8 71 52 115 24 69-63 121-49" />
                <circle cx="43" cy="196" r="7" className="auth-map-pin" />
                <circle cx="418" cy="151" r="7" className="auth-map-pin" />
                <circle cx="517" cy="102" r="11" className="auth-map-pin" />
              </svg>
            </div>
            <div className="auth-story-copy">
              <p className="auth-kicker">{t('login.storyEyebrow')}</p>
              <h2 className="auth-story-title">{t('login.storyTitle')}</h2>
              <p className="auth-story-description">{t('login.storyBody')}</p>
            </div>
            <div className="auth-panel-foot">
              <span className="auth-panel-foot-mark" aria-hidden="true">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3 19 6v5c0 4.8-3 8-7 10-4-2-7-5.2-7-10V6l7-3Z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </span>
              <span className="auth-panel-foot-copy">
                <strong>{t('login.trustTitle')}</strong>
                <span>{t('login.trustBody')}</span>
              </span>
            </div>
          </section>
          <section className="auth-card grid w-full" aria-labelledby="login-title">
            <div className="auth-card-head">
              <p className="auth-kicker">{t('login.storyEyebrow')}</p>
              <h1 id="login-title">{t('login.title')}</h1>
              <p className="auth-card-intro">{t('login.intro')}</p>
            </div>
            {params.reason === 'signed-out' ? (
              <LogoutNotice message={t('login.signedOut')} />
            ) : params.reason === 'expired' ? (
              <p role="status" className="auth-notice">
                {t('login.expired')}
              </p>
            ) : null}
            <LoginForm next={safeNextPath(params.next)} />
            <p className="auth-card-note">{t('design.signInNote')}</p>
          </section>
        </div>
      </main>
    </div>
  );
}
