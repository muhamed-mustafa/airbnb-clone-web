'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { Country } from '@/features/countries/api';
import { useApplyServerErrors, useZodErrorMap } from '@/lib/form-errors';
import { Button } from '@/ui/button';
import { Dialog } from '@/ui/dialog';
import { TextField } from '@/ui/field';
import { SearchSelect } from '@/ui/search-select';
import { FormAlert } from '@/ui/states';
import { useToast } from '@/ui/toast';
import { useCreateCity, useUpdateCity, type City } from './api';
import { citySchema, type CityInput, type CityValues } from './schema';

interface CityFormDialogProps {
  city?: City;
  countries: Country[];
  /** Preselects the country currently used as a list filter. */
  defaultCountry?: string;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
}

export function CityFormDialog({
  city,
  countries,
  defaultCountry = '',
  onClose,
  returnFocusTo,
}: CityFormDialogProps) {
  const t = useTranslations('cities');
  const tc = useTranslations('common');
  const notify = useToast();
  const errorMap = useZodErrorMap();
  const applyServerErrors = useApplyServerErrors();
  const create = useCreateCity();
  const update = useUpdateCity();
  const [alert, setAlert] = useState<{ messages: string[]; requestId?: string }>({ messages: [] });

  const form = useForm<CityInput, unknown, CityValues>({
    resolver: zodResolver(citySchema, { error: errorMap }),
    defaultValues: { name: city?.name ?? '', country: city?.country ?? defaultCountry },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(
    async (values) => {
      setAlert({ messages: [] });
      try {
        if (city) {
          const changes = Object.fromEntries(
            Object.entries(values).filter(
              ([key, value]) => city[key as keyof CityValues] !== value,
            ),
          );
          if (Object.keys(changes).length === 0) {
            setAlert({ messages: [tc('noChanges')] });
            return;
          }
          const result = await update.mutateAsync({ id: city.id, body: changes });
          notify(t('updated', { name: result.data.name }));
        } else {
          const result = await create.mutateAsync(values);
          notify(t('created', { name: result.data.name }));
        }
        onClose();
      } catch (error) {
        const result = applyServerErrors(error, form.setError, ['name', 'country']);
        setAlert({ messages: result.messages, requestId: result.requestId });
      }
    },
    // A new attempt that fails client validation must not keep the previous message.
    () => setAlert({ messages: [] }),
  );

  return (
    <Dialog
      open
      returnFocusTo={returnFocusTo}
      onOpenChange={(open) => !open && !isSubmitting && onClose()}
      title={city ? t('editTitle', { name: city.name }) : t('createTitle')}
      description={t('formDescription')}
    >
      <form noValidate onSubmit={onSubmit} className="grid gap-5">
        <FormAlert messages={alert.messages} requestId={alert.requestId} />
        <TextField
          label={t('fieldName')}
          placeholder={t('namePlaceholder')}
          hint={t('fieldNameHint')}
          autoComplete="off"
          error={errors.name?.message}
          {...form.register('name')}
        />
        <Controller
          name="country"
          control={form.control}
          render={({ field }) => (
            <SearchSelect
              label={t('fieldCountry')}
              placeholder={t('chooseCountry')}
              options={countries.map((country) => ({
                value: country.id,
                label: country.name,
                detail: country.code,
              }))}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
              error={errors.country?.message}
            />
          )}
        />
        <div className="dialog-actions">
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
