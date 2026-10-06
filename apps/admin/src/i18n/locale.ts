export const LOCALES = ['ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/** Not sensitive: only chooses the UI language. Also sent upstream as Accept-Language. */
export const LOCALE_COOKIE = 'admin_locale';

export const readLocale = (value: string | undefined): Locale => (value === 'en' ? 'en' : 'ar');

export const directionOf = (locale: Locale): 'rtl' | 'ltr' => (locale === 'ar' ? 'rtl' : 'ltr');

/** Arabic UI with Latin digits (123) for now, as agreed. */
export const toFormattingLocale = (locale: Locale): string =>
  locale === 'ar' ? 'ar-u-nu-latn' : 'en';
