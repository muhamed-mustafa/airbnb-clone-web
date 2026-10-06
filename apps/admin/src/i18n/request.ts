import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { LOCALE_COOKIE, readLocale, toFormattingLocale } from './locale';

export default getRequestConfig(async () => {
  const locale = readLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return {
    locale: toFormattingLocale(locale),
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: 'UTC',
  };
});
