'use client';

import type { AppError } from '@stays/api-contract';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { supportRequestId, useErrorText } from '@/lib/error-text';
import { Button } from './button';
import { AlertIcon } from './icons';

/** Placeholder rows with the same height as real rows, so nothing shifts on load. */
export function RowsSkeleton({ rows = 6, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="divide-y divide-hairline">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex h-14 items-center gap-4 px-4">
          <span className="h-3 w-40 max-w-[50%] animate-pulse rounded bg-sunken" />
          <span className="h-3 w-12 animate-pulse rounded bg-sunken" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid justify-items-start gap-2 px-4 py-10 sm:px-6">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="max-w-prose text-sm text-muted">{body}</p>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

function RequestId({ id }: { id: string }) {
  const t = useTranslations('common');
  const [copied, setCopied] = useState(false);
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
      <span>{t('requestId')}:</span>
      <code dir="ltr" className="select-all font-mono">
        {id}
      </code>
      <button
        type="button"
        className="underline underline-offset-2 hover:text-ink"
        onClick={() => {
          void navigator.clipboard?.writeText(id).then(
            () => setCopied(true),
            () => undefined,
          );
        }}
      >
        {copied ? t('copied') : t('copy')}
      </button>
    </p>
  );
}

/** Inline error for a failed load, with retry. Never replaces the user's input. */
export function ErrorPanel({ error, onRetry }: { error: AppError; onRetry?: () => void }) {
  const t = useTranslations('common');
  const { formTexts } = useErrorText();
  return (
    <div role="alert" className="grid justify-items-start gap-3 px-4 py-8 sm:px-6">
      <div className="flex items-start gap-2 text-danger">
        <AlertIcon className="mt-0.5 shrink-0" />
        <div className="grid gap-1">
          {formTexts(error).map((text) => (
            <p key={text} className="text-sm font-semibold">
              {text}
            </p>
          ))}
        </div>
      </div>
      {supportRequestId(error) && <RequestId id={supportRequestId(error)!} />}
      {onRetry && <Button onClick={onRetry}>{t('retry')}</Button>}
    </div>
  );
}

/** Form-level messages (several are possible), announced when they appear. */
export function FormAlert({ messages, requestId }: { messages: string[]; requestId?: string }) {
  if (messages.length === 0) return null;
  return (
    <div
      role="alert"
      className="form-error grid gap-2 rounded-md border border-danger/25 bg-[#fff5f4] px-4 py-3 text-sm text-danger"
    >
      {messages.map((message) => (
        <p key={message} className="flex items-start gap-2 leading-6">
          <AlertIcon width={18} height={18} className="mt-0.5 shrink-0" />
          {message}
        </p>
      ))}
      {requestId && <RequestId id={requestId} />}
    </div>
  );
}
