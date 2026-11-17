import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Arabic } from 'next/font/google';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { directionOf, LOCALE_COOKIE, readLocale } from '@/i18n/locale';
import { readTheme, THEME_COOKIE, themeAttribute } from '@/theme/theme';
import { ThemeProvider } from '@/theme/theme-provider';
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
  // The browser chrome follows the page ground in each scheme.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1219' },
  ],
  colorScheme: 'light dark',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const jar = await cookies();
  const locale = readLocale(jar.get(LOCALE_COOKIE)?.value);
  // An explicit theme is rendered by the server, so the first paint is already right; with
  // no choice, CSS follows the system (and its later changes). No script, no flash.
  const theme = readTheme(jar.get(THEME_COOKIE)?.value);
  return (
    <html
      lang={locale}
      dir={directionOf(locale)}
      data-theme={themeAttribute(theme)}
      className={plexArabic.variable}
    >
      <body>
        <NextIntlClientProvider>
          <ThemeProvider initialTheme={theme}>
            <Providers>{children}</Providers>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
