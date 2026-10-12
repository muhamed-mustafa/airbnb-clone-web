'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from './button';
import { CheckIcon, CopyIcon } from './icons';

/** Copies a value; the label confirms success and nothing changes when copying fails. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const t = useTranslations('account');
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={label}
      icon={copied ? <CheckIcon width={16} height={16} /> : <CopyIcon width={16} height={16} />}
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          },
          () => undefined,
        );
      }}
    >
      <span aria-live="polite">{copied ? t('copied') : t('copy')}</span>
    </Button>
  );
}
