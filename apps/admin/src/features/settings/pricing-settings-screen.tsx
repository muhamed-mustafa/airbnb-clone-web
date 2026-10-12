'use client';

import { useTranslations } from 'next-intl';
import { isBffError } from '@/lib/bff-client';
import { Page } from '@/ui/page';
import { PageHeader } from '@/ui/page-header';
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
    <Page width="details">
      <PageHeader title={t('title')} summary={t('intro')} />
      <p className="info-note">{t('storedOnly')}</p>
      <section className="ui-panel">
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
    </Page>
  );
}
