'use client';

import type { AppError, Paginated } from '@stays/api-contract';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { bffFetch, isBffError } from '@/lib/bff-client';
import { supportRequestId, useErrorText } from '@/lib/error-text';
import { ConfirmDialog } from '@/ui/dialog';
import { FormAlert } from '@/ui/states';
import { useToast } from '@/ui/toast';
import { useDeleteCountry, type Country } from './api';

/** How many active cities the backend will delete along with the country (report L8). */
function useCityCount(countryId: string) {
  return useQuery({
    queryKey: ['cities', 'count', countryId],
    queryFn: ({ signal }) =>
      bffFetch<Paginated<unknown>>(`/bff/api/cities?country=${countryId}&limit=1`, { signal }).then(
        (result) => result.meta.total,
      ),
    staleTime: 0,
  });
}

export function DeleteCountryDialog({
  country,
  onClose,
  returnFocusTo,
}: {
  country: Country;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const t = useTranslations('countries');
  const tc = useTranslations('common');
  const notify = useToast();
  const { formTexts } = useErrorText();
  const remove = useDeleteCountry();
  const cityCount = useCityCount(country.id);
  const [alert, setAlert] = useState<{ messages: string[]; requestId?: string }>({ messages: [] });

  return (
    <ConfirmDialog
      open
      returnFocusTo={returnFocusTo}
      onOpenChange={(open) => !open && onClose()}
      title={t('deleteTitle', { name: country.name })}
      confirmLabel={t('deleteConfirm')}
      pendingLabel={tc('deleting')}
      pending={remove.isPending}
      onConfirm={() => {
        setAlert({ messages: [] });
        remove.mutate(country.id, {
          onSuccess: () => {
            notify(t('deleted', { name: country.name }));
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
      <p className="font-semibold text-ink" aria-live="polite">
        {cityCount.isPending
          ? t('deleteCitiesLoading')
          : cityCount.isError
            ? t('deleteCitiesUnknown')
            : t('deleteCities', { count: cityCount.data })}
      </p>
      <FormAlert messages={alert.messages} requestId={alert.requestId} />
    </ConfirmDialog>
  );
}
