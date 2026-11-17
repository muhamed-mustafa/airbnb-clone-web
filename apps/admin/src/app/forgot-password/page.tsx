import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { PasswordResetForm } from '@/features/auth/password-reset-form';
import { BrandMark } from '@/ui/brand';
import { LocaleSwitch } from '@/features/shell/locale-switch';
import { ThemeSwitch } from '@/theme/theme-switch';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('passwordReset');
  return { title: t('title') };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations();
  return (
    <div className="auth-page min-h-dvh px-4 py-4 sm:px-8 sm:py-6">
      <header className="auth-topbar mx-auto flex w-full items-center justify-between gap-3">
        <Link href="/login" className="flex items-center gap-3 text-ink no-underline">
          <BrandMark />
          <p className="text-sm font-semibold">{t('app.title')}</p>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeSwitch compact />
          <LocaleSwitch />
        </div>
      </header>
      <main className="auth-main mx-auto grid w-full place-items-center">
        <div className="auth-layout">
          <section
            className="auth-story-panel reset-story"
            aria-label={t('passwordReset.storyTitle')}
          >
            <div className="auth-panel-meta">
              <span className="auth-panel-index">STAYS / SECURITY</span>
              <span className="auth-panel-status">
                <span className="auth-status-dot" aria-hidden="true" />
                {t('passwordReset.storyEyebrow')}
              </span>
            </div>
            <div className="reset-story-mark" aria-hidden="true">
              <svg
                viewBox="0 0 64 64"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M32 6 52 14v14c0 14-8 23-20 30C20 51 12 42 12 28V14L32 6Z" />
                <path d="m23 32 6 6 13-14" />
                <circle cx="32" cy="32" r="27" strokeDasharray="2 5" opacity=".35" />
              </svg>
            </div>
            <div className="auth-story-copy">
              <p className="auth-kicker">{t('passwordReset.storyEyebrow')}</p>
              <h2 className="auth-story-title">{t('passwordReset.storyTitle')}</h2>
              <p className="auth-story-description">{t('passwordReset.storyBody')}</p>
            </div>
            <div className="auth-panel-foot">
              <span className="auth-panel-foot-mark" aria-hidden="true">
                01—03
              </span>
              <span className="auth-panel-foot-copy">
                <strong>{t('passwordReset.secureTitle')}</strong>
                <span>{t('passwordReset.secureBody')}</span>
              </span>
            </div>
          </section>
          <section className="auth-card reset-card" aria-labelledby="reset-title">
            <div className="auth-card-head">
              <p className="auth-kicker">{t('passwordReset.eyebrow')}</p>
              <h1 id="reset-title">{t('passwordReset.title')}</h1>
              <p className="auth-card-intro">{t('passwordReset.intro')}</p>
            </div>
            <PasswordResetForm />
            <p className="auth-card-note">{t('passwordReset.footer')}</p>
          </section>
        </div>
      </main>
    </div>
  );
}
