'use client';

import type { AppError, AppErrorItem } from '@stays/api-contract';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

const SUPPORT_KINDS = new Set<AppError['kind']>([
  'server',
  'network',
  'timeout',
  'unknown',
  'csrf',
  'session_refresh_unavailable',
]);

/**
 * The request id helps support trace a failure in backend logs. It is shown only where
 * the user cannot fix the problem themselves, not for wrong passwords or invalid input.
 */
export const supportRequestId = (error: AppError | undefined): string | undefined =>
  error && SUPPORT_KINDS.has(error.kind) ? error.requestId : undefined;

/**
 * Resolve the text for an error (session-error-contract §B):
 * our catalog by code → backend text (4xx only; normalizer drops it for 5xx) → generic by kind.
 * The backend text is a fallback because some validation messages arrive in English
 * regardless of Accept-Language (report D3).
 */
export function useErrorText() {
  const t = useTranslations('errors');

  const itemText = useCallback(
    (item: AppErrorItem, error: Pick<AppError, 'kind'>): string => {
      if (t.has(item.code)) return t(item.code);
      return item.serverMessage ?? t(`kinds.${error.kind}`);
    },
    [t],
  );

  /** Every general message of an error, never empty. */
  const formTexts = useCallback(
    (error: AppError): string[] => {
      const texts = error.formErrors.map((item) => itemText(item, error));
      return texts.length > 0 ? [...new Set(texts)] : [t(`kinds.${error.kind}`)];
    },
    [itemText, t],
  );

  /** Text under a field. Conflicts on a field read as "already in use". */
  const fieldText = useCallback(
    (item: AppErrorItem, error: AppError): string =>
      item.code.endsWith('_ALREADY_EXISTS') ? t('field.alreadyUsed') : itemText(item, error),
    [itemText, t],
  );

  return { itemText, formTexts, fieldText };
}
