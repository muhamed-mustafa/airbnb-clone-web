'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useApplyServerErrors, useZodErrorMap } from '@/lib/form-errors';
import { Button } from '@/ui/button';
import { Dialog } from '@/ui/dialog';
import { NavigationIcon } from '@/ui/navigation-icon';
import { TextField } from '@/ui/field';
import { FormAlert } from '@/ui/states';
import { useToast } from '@/ui/toast';
import { useCreateCountry, useUpdateCountry, type Country } from './api';
import { countrySchema, type CountryInput, type CountryValues } from './schema';

interface CountryFormDialogProps {
  country?: Country;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
}

export function CountryFormDialog({ country, onClose, returnFocusTo }: CountryFormDialogProps) {
  const t = useTranslations('countries');
  const tc = useTranslations('common');
  const notify = useToast();
  const errorMap = useZodErrorMap();
  const applyServerErrors = useApplyServerErrors();
  const create = useCreateCountry();
  const update = useUpdateCountry();
  const [alert, setAlert] = useState<{ messages: string[]; requestId?: string }>({ messages: [] });

  const form = useForm<CountryInput, unknown, CountryValues>({
    resolver: zodResolver(countrySchema, { error: errorMap }),
    defaultValues: { name: country?.name ?? '', code: country?.code ?? '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(
    async (values) => {
      setAlert({ messages: [] });
      try {
        if (country) {
          // PATCH only what changed; the backend requires at least one field.
          const changes = Object.fromEntries(
            Object.entries(values).filter(
              ([key, value]) => country[key as keyof CountryValues] !== value,
            ),
          );
          if (Object.keys(changes).length === 0) {
            setAlert({ messages: [tc('noChanges')] });
            return;
          }
          const result = await update.mutateAsync({ id: country.id, body: changes });
          notify(t('updated', { name: result.data.name }));
        } else {
          const result = await create.mutateAsync(values);
          notify(t('created', { name: result.data.name }));
        }
        onClose();
      } catch (error) {
        const result = applyServerErrors(error, form.setError, ['name', 'code']);
        setAlert({ messages: result.messages, requestId: result.requestId });
      }
    },
    // A new attempt that fails client validation must not keep the previous message.
    () => setAlert({ messages: [] }),
  );

  return (
    <Dialog
      open
      icon={<NavigationIcon name="countries" />}
      returnFocusTo={returnFocusTo}
      onOpenChange={(open) => !open && !isSubmitting && onClose()}
      description={t('formDescription')}
      title={country ? t('editTitle', { name: country.name }) : t('createTitle')}
    >
      <form noValidate onSubmit={onSubmit} className="resource-form grid gap-6">
        <FormAlert messages={alert.messages} requestId={alert.requestId} />
        <TextField
          label={t('fieldName')}
          placeholder={t('namePlaceholder')}
          hint={t('fieldNameHint')}
          autoComplete="off"
          error={errors.name?.message}
          {...form.register('name')}
        />
        <TextField
          label={t('fieldCode')}
          placeholder={t('codePlaceholder')}
          hint={t('fieldCodeHint')}
          autoComplete="off"
          autoCapitalize="characters"
          dir="ltr"
          maxLength={2}
          className="font-mono uppercase"
          error={errors.code?.message}
          {...form.register('code')}
        />
        <div className="form-actions flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
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
