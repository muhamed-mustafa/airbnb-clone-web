'use client';

import type { AppError } from '@stays/api-contract';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import type { z } from 'zod';
import { isBffError } from './bff-client';
import { supportRequestId, useErrorText } from './error-text';

/**
 * Localized messages for client-side validation. Limits come from the schemas generated
 * from OpenAPI; only the wording lives here.
 */
export function useZodErrorMap() {
  const t = useTranslations('validation');
  return useCallback(
    (issue: z.core.$ZodRawIssue): string => {
      if (issue.input === undefined || issue.input === '') return t('required');
      switch (issue.code) {
        case 'too_small':
          return issue.exact
            ? t('exactLength', { length: Number(issue.minimum) })
            : t('tooShort', { min: Number(issue.minimum) });
        case 'too_big':
          return issue.exact
            ? t('exactLength', { length: Number(issue.maximum) })
            : t('tooLong', { max: Number(issue.maximum) });
        case 'invalid_format':
          if (issue.format === 'email') return t('email');
          // The only pattern used in forms today: codes made of Latin letters.
          return issue.format === 'regex' ? t('latinLetters') : t('invalid');
        default:
          return t('invalid');
      }
    },
    [t],
  );
}

/**
 * Put server errors on the form without touching what the user typed. Field errors go
 * under their field; everything else is returned for the form-level alert.
 */
export function useApplyServerErrors() {
  const { formTexts, fieldText } = useErrorText();
  return useCallback(
    <T extends FieldValues>(
      error: unknown,
      setError: UseFormSetError<T>,
      fields: readonly Path<T>[],
    ): { messages: string[]; appError?: AppError; requestId?: string } => {
      if (!isBffError(error))
        return { messages: [formTexts({ kind: 'unknown', formErrors: [], fieldErrors: {} })[0]!] };
      const appError = error.appError;
      const unplaced: AppError = {
        ...appError,
        formErrors: [...appError.formErrors],
        fieldErrors: {},
      };
      let placedFirst = false;

      for (const [field, items] of Object.entries(appError.fieldErrors)) {
        const first = items[0];
        if (!first) continue;
        if ((fields as readonly string[]).includes(field)) {
          setError(
            field as Path<T>,
            { type: 'server', message: fieldText(first, appError) },
            {
              shouldFocus: !placedFirst,
            },
          );
          placedFirst = true;
        } else {
          unplaced.formErrors.push(...items);
        }
      }

      const hasGeneral = unplaced.formErrors.length > 0 || !placedFirst;
      return {
        messages: hasGeneral ? formTexts(unplaced) : [],
        appError,
        requestId: supportRequestId(appError),
      };
    },
    [fieldText, formTexts],
  );
}
