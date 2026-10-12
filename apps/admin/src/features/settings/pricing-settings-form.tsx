'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useApplyServerErrors, useZodErrorMap } from '@/lib/form-errors';
import { Button } from '@/ui/button';
import { TextField } from '@/ui/field';
import { FormAlert } from '@/ui/states';
import { useToast } from '@/ui/toast';
import { useSaveAppSettings, type AppSettings } from './api';
import {
  changedSettings,
  pricingSettingsSchema,
  type PricingSettingsInput,
  type PricingSettingsValues,
} from './pricing-settings-schema';

const toText = (value: number | undefined) => (value === undefined ? '' : String(value));

/**
 * VAT rate and minimum price. `stored` is null until the settings are saved once.
 * The minimum price is shown as a plain number: its currency, its basis (per night or per
 * booking, before or after taxes and fees) and the meaning of 0 are not defined yet, so
 * the screen states none of them.
 */
export function PricingSettingsForm({ stored }: { stored: AppSettings | null }) {
  const t = useTranslations('pricingSettings');
  const tc = useTranslations('common');
  const format = useFormatter();
  const notify = useToast();
  const errorMap = useZodErrorMap();
  const applyServerErrors = useApplyServerErrors();
  const save = useSaveAppSettings();
  const [alert, setAlert] = useState<{ messages: string[]; requestId?: string }>({ messages: [] });

  const schema = useMemo(() => pricingSettingsSchema(stored), [stored]);
  const form = useForm<PricingSettingsInput, unknown, PricingSettingsValues>({
    resolver: zodResolver(schema, { error: errorMap }),
    defaultValues: { vatRate: toText(stored?.vatRate), minPrice: toText(stored?.minPrice) },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(
    async (values) => {
      setAlert({ messages: [] });
      const patch = changedSettings(values, stored);
      if (Object.keys(patch).length === 0) {
        setAlert({ messages: [tc('noChanges')] });
        return;
      }
      try {
        const result = await save.mutateAsync(patch);
        // Show the values as the backend stored them; focus stays where it was.
        form.reset({
          vatRate: toText(result.data.vatRate),
          minPrice: toText(result.data.minPrice),
        });
        notify(t('saved'));
      } catch (error) {
        const result = applyServerErrors(error, form.setError, ['vatRate', 'minPrice']);
        setAlert({ messages: result.messages, requestId: result.requestId });
      }
    },
    // A new attempt that fails client validation must not keep the previous message.
    () => setAlert({ messages: [] }),
  );

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-5">
      <p className="text-sm text-muted" aria-live="polite">
        {stored === null
          ? t('notConfigured')
          : t('storedValues', {
              vatRate: format.number(stored.vatRate / 100, {
                style: 'percent',
                maximumFractionDigits: 2,
              }),
              minPrice: format.number(stored.minPrice, { maximumFractionDigits: 2 }),
            })}
      </p>
      <FormAlert messages={alert.messages} requestId={alert.requestId} />
      <TextField
        label={t('vatField')}
        hint={t('vatHint')}
        inputMode="decimal"
        autoComplete="off"
        dir="ltr"
        className="tabular"
        error={errors.vatRate?.message}
        {...form.register('vatRate')}
      />
      <TextField
        label={t('minPriceField')}
        hint={t('minPriceHint')}
        inputMode="decimal"
        autoComplete="off"
        dir="ltr"
        className="tabular"
        error={errors.minPrice?.message}
        {...form.register('minPrice')}
      />
      <div>
        <Button type="submit" variant="primary" loading={isSubmitting} loadingLabel={tc('saving')}>
          {tc('save')}
        </Button>
      </div>
    </form>
  );
}
