'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useApplyServerErrors, useZodErrorMap } from '@/lib/form-errors';
import { Button } from '@/ui/button';
import { Dialog } from '@/ui/dialog';
import { TextField } from '@/ui/field';
import { FormAlert } from '@/ui/states';
import { useToast } from '@/ui/toast';
import { useCreateCurrency, useUpdateCurrency, type Currency } from './api';
import { currencySchema, type CurrencyInput, type CurrencyValues } from './schema';

interface CurrencyFormDialogProps {
  currency?: Currency;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
}

export function CurrencyFormDialog({ currency, onClose, returnFocusTo }: CurrencyFormDialogProps) {
  const t = useTranslations('currencies');
  const tc = useTranslations('common');
  const notify = useToast();
  const errorMap = useZodErrorMap();
  const applyServerErrors = useApplyServerErrors();
  const create = useCreateCurrency();
  const update = useUpdateCurrency();
  const [alert, setAlert] = useState<{ messages: string[]; requestId?: string }>({ messages: [] });

  const form = useForm<CurrencyInput, unknown, CurrencyValues>({
    resolver: zodResolver(currencySchema, { error: errorMap }),
    defaultValues: { name: currency?.name ?? '', currencyCode: currency?.currencyCode ?? '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setAlert({ messages: [] });
    try {
      if (currency) {
        // PATCH only what changed; the backend requires at least one field.
        const changes = Object.fromEntries(
          Object.entries(values).filter(
            ([key, value]) => currency[key as keyof CurrencyValues] !== value,
          ),
        );
        if (Object.keys(changes).length === 0) {
          setAlert({ messages: [tc('noChanges')] });
          return;
        }
        const result = await update.mutateAsync({ id: currency.id, body: changes });
        notify(t('updated', { name: result.data.name }));
      } else {
        const result = await create.mutateAsync(values);
        notify(t('created', { name: result.data.name }));
      }
      onClose();
    } catch (error) {
      const result = applyServerErrors(error, form.setError, ['name', 'currencyCode']);
      setAlert({ messages: result.messages, requestId: result.requestId });
    }
  });

  return (
    <Dialog
      open
      returnFocusTo={returnFocusTo}
      onOpenChange={(open) => !open && !isSubmitting && onClose()}
      title={currency ? t('editTitle', { name: currency.name }) : t('createTitle')}
    >
      <form noValidate onSubmit={onSubmit} className="grid gap-4">
        <FormAlert messages={alert.messages} requestId={alert.requestId} />
        <TextField
          label={t('fieldName')}
          hint={t('fieldNameHint')}
          autoComplete="off"
          error={errors.name?.message}
          {...form.register('name')}
        />
        <TextField
          label={t('fieldCode')}
          hint={t('fieldCodeHint')}
          autoComplete="off"
          autoCapitalize="characters"
          dir="ltr"
          maxLength={3}
          className="max-w-28 font-mono uppercase"
          error={errors.currencyCode?.message}
          {...form.register('currencyCode')}
        />
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose} disabled={isSubmitting}>
            {tc('cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            loadingLabel={tc('saving')}
          >
            {tc('save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
