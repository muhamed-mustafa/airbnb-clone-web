'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { LOCALE_COOKIE } from '@/i18n/locale';
import { Button } from '@/ui/button';
import { GlobeIcon } from '@/ui/icons';

export function LocaleSwitch({ className = '' }: { className?: string }) {
  const t = useTranslations('account');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // The formatting locale is "ar-u-nu-latn" for Arabic.
  const target = useLocale().startsWith('ar') ? 'en' : 'ar';

  return (
    <Button
      variant="ghost"
      className={className}
      icon={<GlobeIcon width={18} height={18} />}
      aria-label={t('switchLanguageLabel')}
      disabled={pending}
      onClick={() => {
        // Only a UI preference; not sensitive.
        document.cookie = `${LOCALE_COOKIE}=${target}; path=/; max-age=31536000; samesite=lax`;
        startTransition(() => router.refresh());
      }}
    >
      <span lang={target}>{t('switchLanguage')}</span>
    </Button>
  );
}
