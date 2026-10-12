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
import { useCreateUnitCategory, useUpdateUnitCategory, type UnitCategory } from './api';
import { categorySchema, type UnitCategoryInput, type UnitCategoryValues } from './schema';

interface UnitCategoryFormDialogProps {
  category?: UnitCategory;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
}

export function UnitCategoryFormDialog({
  category,
  onClose,
  returnFocusTo,
}: UnitCategoryFormDialogProps) {
  const t = useTranslations('unitCategories');
  const tc = useTranslations('common');
  const notify = useToast();
  const errorMap = useZodErrorMap();
  const applyServerErrors = useApplyServerErrors();
  const create = useCreateUnitCategory();
  const update = useUpdateUnitCategory();
  const [alert, setAlert] = useState<{ messages: string[]; requestId?: string }>({ messages: [] });

  const form = useForm<UnitCategoryInput, unknown, UnitCategoryValues>({
    resolver: zodResolver(categorySchema, { error: errorMap }),
    defaultValues: { name: category?.name ?? '', icon: category?.icon ?? '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(
    async (values) => {
      setAlert({ messages: [] });
      try {
        if (category) {
          // PATCH only what changed; the backend requires at least one field.
          const changes = Object.fromEntries(
            Object.entries(values).filter(
              ([key, value]) => (category[key as keyof UnitCategoryValues] ?? '') !== value,
            ),
          );
          if (Object.keys(changes).length === 0) {
            setAlert({ messages: [tc('noChanges')] });
            return;
          }
          const result = await update.mutateAsync({ id: category.id, body: changes });
          notify(t('updated', { name: result.data.name }));
        } else {
          const result = await create.mutateAsync(values);
          notify(t('created', { name: result.data.name }));
        }
        onClose();
      } catch (error) {
        const result = applyServerErrors(error, form.setError, ['name', 'icon']);
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
      description={t('formDescription')}
      title={category ? t('editTitle', { name: category.name }) : t('createTitle')}
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
        <TextField
          label={t('fieldCode')}
          placeholder={t('codePlaceholder')}
          hint={t('fieldCodeHint')}
          autoComplete="off"
          maxLength={100}
          className="font-mono placeholder:font-sans"
          error={errors.icon?.message}
          {...form.register('icon')}
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
