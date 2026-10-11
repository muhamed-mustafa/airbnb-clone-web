'use client';

import { useTranslations } from 'next-intl';
import { AlertDialog as AlertPrimitive, Dialog as DialogPrimitive } from 'radix-ui';
import { useState, type ReactNode } from 'react';
import { Button } from './button';
import { CloseIcon } from './icons';

// Phones: a bottom sheet that fits the visual viewport (works with the on-screen keyboard).
// Larger screens: a centered panel.
const panelClasses = [
  'dialog-panel fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-lg bg-surface shadow-xl',
  'sm:inset-x-auto sm:bottom-auto sm:start-1/2 sm:top-[16vh] sm:w-full sm:max-w-lg sm:rounded-lg',
  'sm:ltr:-translate-x-1/2 sm:rtl:translate-x-1/2',
  'focus:outline-none',
].join(' ');

const overlayClasses = 'dialog-overlay fixed inset-0 z-40 bg-ink/35';

/**
 * Our dialogs open from state, not from a Radix Trigger, so Radix cannot return focus on
 * close. Return it to the opener (see useDialog), else to what had focus at mount; if that
 * element is gone (e.g. the deleted row), fall back to the main content.
 */
function useReturnFocus(returnFocusTo: HTMLElement | null | undefined) {
  const [mountFocus] = useState(() =>
    typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null),
  );
  const origin = returnFocusTo ?? mountFocus;
  return (event: Event) => {
    event.preventDefault();
    const target = origin?.isConnected ? origin : document.getElementById('main');
    target?.focus();
  };
}

interface DialogProps {
  returnFocusTo?: HTMLElement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  icon,
  children,
  returnFocusTo,
}: DialogProps) {
  const t = useTranslations('common');
  const returnFocus = useReturnFocus(returnFocusTo);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlayClasses} />
        <DialogPrimitive.Content
          className={panelClasses}
          {...(description ? {} : { 'aria-describedby': undefined })}
          onCloseAutoFocus={returnFocus}
          onOpenAutoFocus={(event) => {
            // Start on the first field rather than the close button.
            const field = (event.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>(
              'input, select, textarea, [role="combobox"]',
            );
            if (field) {
              event.preventDefault();
              field.focus();
            }
          }}
        >
          <div className="dialog-heading flex items-start justify-between gap-4 border-b border-hairline px-7 py-6">
            <div className="flex items-start gap-3.5">
              {icon && (
                <span className="dialog-heading-icon" aria-hidden="true">
                  {icon}
                </span>
              )}
              <div className="grid gap-1.5">
                <DialogPrimitive.Title className="text-lg font-semibold">
                  {title}
                </DialogPrimitive.Title>
                {description && (
                  <DialogPrimitive.Description className="text-sm text-muted">
                    {description}
                  </DialogPrimitive.Description>
                )}
              </div>
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" className="-me-2 px-2" aria-label={t('close')}>
                <CloseIcon />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <div className="dialog-body overflow-y-auto px-7 py-6">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

interface ConfirmDialogProps {
  returnFocusTo?: HTMLElement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  confirmLabel: ReactNode;
  pendingLabel: ReactNode;
  pending: boolean;
  onConfirm: () => void;
}

/** Destructive confirmation. Focus starts on Cancel, the safe choice. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
  confirmLabel,
  pendingLabel,
  pending,
  onConfirm,
  returnFocusTo,
}: ConfirmDialogProps) {
  const t = useTranslations('common');
  const returnFocus = useReturnFocus(returnFocusTo);
  return (
    <AlertPrimitive.Root open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AlertPrimitive.Portal>
        <AlertPrimitive.Overlay className={overlayClasses} />
        <AlertPrimitive.Content className={panelClasses} onCloseAutoFocus={returnFocus}>
          <div className="grid gap-3 px-5 pt-5">
            <AlertPrimitive.Title className="text-lg font-semibold">{title}</AlertPrimitive.Title>
            <AlertPrimitive.Description asChild>
              <div className="grid gap-2 text-sm text-muted">{children}</div>
            </AlertPrimitive.Description>
          </div>
          <div className="flex flex-col-reverse gap-2 px-5 py-5 sm:flex-row sm:justify-end">
            <AlertPrimitive.Cancel asChild>
              <Button disabled={pending}>{t('cancel')}</Button>
            </AlertPrimitive.Cancel>
            <Button
              variant="danger"
              loading={pending}
              loadingLabel={pendingLabel}
              onClick={(event) => {
                // Keep the dialog open until the request settles.
                event.preventDefault();
                onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertPrimitive.Content>
      </AlertPrimitive.Portal>
    </AlertPrimitive.Root>
  );
}
