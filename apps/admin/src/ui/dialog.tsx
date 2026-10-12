'use client';

import { useTranslations } from 'next-intl';
import { AlertDialog as AlertPrimitive, Dialog as DialogPrimitive } from 'radix-ui';
import { useState, type ReactNode } from 'react';
import { Button } from './button';
import { CloseIcon, TrashIcon } from './icons';

// Phones: a bottom sheet that fits the visual viewport (works with the on-screen keyboard).
// Larger screens: a centered panel.
const panelClasses = [
  'dialog-panel fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col',
  'sm:inset-x-auto sm:bottom-auto sm:start-1/2 sm:top-[14vh] sm:w-full sm:max-w-[30rem]',
  'sm:ltr:-translate-x-1/2 sm:rtl:translate-x-1/2',
  'focus:outline-none',
].join(' ');

const overlayClasses = 'dialog-overlay fixed inset-0 z-40';

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
  /** @deprecated Decorative heading icons were removed from dialogs; ignored. */
  icon?: ReactNode;
  children: ReactNode;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
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
          <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-5 sm:px-6">
            <div className="grid gap-1">
              <DialogPrimitive.Title className="dialog-title">{title}</DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="text-sm text-muted">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <Button
                variant="ghost"
                className="icon-only -me-2 -mt-1 text-muted"
                aria-label={t('close')}
              >
                <CloseIcon width={18} height={18} />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <div className="overflow-y-auto px-5 pb-5 pt-4 sm:px-6 sm:pb-6">{children}</div>
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
          <div className="flex items-start gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
            <span className="danger-badge" aria-hidden="true">
              <TrashIcon width={18} height={18} />
            </span>
            <div className="grid gap-2 pt-1">
              <AlertPrimitive.Title className="dialog-title">{title}</AlertPrimitive.Title>
              <AlertPrimitive.Description asChild>
                <div className="grid gap-2 text-sm text-muted">{children}</div>
              </AlertPrimitive.Description>
            </div>
          </div>
          <div className="dialog-actions mx-5 mb-5 mt-5 sm:mx-6 sm:mb-6">
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
