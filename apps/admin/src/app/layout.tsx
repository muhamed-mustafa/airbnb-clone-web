import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Arabic } from 'next/font/google';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { directionOf, LOCALE_COOKIE, readLocale } from '@/i18n/locale';
import { Providers } from './providers';
import './globals.css';

// One family covers Arabic and Latin (IBM Plex Sans Arabic ships a matching Latin subset).
const plexArabic = IBM_Plex_Sans_Arabic({
  // Only the weights the UI uses: next/font preloads every listed weight.
  weight: ['400', '600'],
  // Preload Arabic (the default UI language). Latin faces are still declared and load on
  // demand, only in the weights a page actually renders.
  subsets: ['arabic'],
  variable: '--font-plex-arabic',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('app');
  return {
    title: { default: t('title'), template: `%s · ${t('title')}` },
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f5f8f8',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = readLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return (
    <html lang={locale} dir={directionOf(locale)} className={plexArabic.variable}>
      <body>
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
