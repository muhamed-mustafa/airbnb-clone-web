'use client';

import { useTranslations } from 'next-intl';
import { isBffError } from '@/lib/bff-client';
import { ErrorPanel, RowsSkeleton } from '@/ui/states';
import { useAppSettings } from './api';
import { PricingSettingsForm } from './pricing-settings-form';

/**
 * Pricing settings: the stored VAT rate and minimum price. They are only stored for now;
 * no booking or pricing flow applies them yet, and the screen says so.
 */
export function PricingSettingsScreen() {
  const t = useTranslations('pricingSettings');
  const tc = useTranslations('common');
  const settings = useAppSettings();

  return (
    <div className="grid max-w-2xl gap-5">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted">{t('intro')}</p>
      </div>

      <p className="rounded-md border border-hairline bg-sunken px-3 py-2.5 text-sm text-ink">
        {t('storedOnly')}
      </p>

      <section className="grid gap-4 rounded-lg border border-hairline bg-surface p-4 sm:p-5">
        {settings.isPending ? (
          <RowsSkeleton rows={2} label={tc('loading')} />
        ) : settings.isError ? (
          <ErrorPanel
            error={
              isBffError(settings.error)
                ? settings.error.appError
                : { kind: 'unknown', formErrors: [], fieldErrors: {} }
            }
            onRetry={() => void settings.refetch()}
          />
        ) : (
          <PricingSettingsForm stored={settings.data ?? null} />
        )}
      </section>
    </div>
  );
}
