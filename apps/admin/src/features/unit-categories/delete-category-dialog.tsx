'use client';

import type { AppError } from '@stays/api-contract';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { isBffError } from '@/lib/bff-client';
import { supportRequestId, useErrorText } from '@/lib/error-text';
import { ConfirmDialog } from '@/ui/dialog';
import { FormAlert } from '@/ui/states';
import { useToast } from '@/ui/toast';
import { useDeleteUnitCategory, type UnitCategory } from './api';

/** Uses the existing soft-delete endpoint; no cascade is implemented. */
export function DeleteUnitCategoryDialog({
  category,
  onClose,
  returnFocusTo,
}: {
  category: UnitCategory;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const t = useTranslations('unitCategories');
  const tc = useTranslations('common');
  const notify = useToast();
  const { formTexts } = useErrorText();
  const remove = useDeleteUnitCategory();
  const [alert, setAlert] = useState<{ messages: string[]; requestId?: string }>({ messages: [] });

  return (
    <ConfirmDialog
      open
      returnFocusTo={returnFocusTo}
      onOpenChange={(open) => !open && onClose()}
      title={t('deleteTitle', { name: category.name })}
      confirmLabel={t('deleteConfirm')}
      pendingLabel={tc('deleting')}
      pending={remove.isPending}
      onConfirm={() => {
        setAlert({ messages: [] });
        remove.mutate(category.id, {
          onSuccess: () => {
            notify(t('deleted', { name: category.name }));
            onClose();
          },
          onError: (error) => {
            const appError: AppError = isBffError(error)
              ? error.appError
              : { kind: 'unknown', formErrors: [], fieldErrors: {} };
            setAlert({ messages: formTexts(appError), requestId: supportRequestId(appError) });
          },
        });
      }}
    >
      <p>{t('deleteBody')}</p>
      <FormAlert messages={alert.messages} requestId={alert.requestId} />
    </ConfirmDialog>
  );
}
