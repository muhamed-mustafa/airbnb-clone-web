'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Popover } from 'radix-ui';
import { useState } from 'react';
import { useSession, useSignOut } from '@/features/auth/use-session';
import { CopyButton } from '@/ui/copy-button';
import { EmailText } from '@/ui/email-text';
import { ChevronsUpDownIcon, SignOutIcon, SpinnerIcon, UserIcon } from '@/ui/icons';
import { SessionTransition } from '@/ui/session-transition';
import { LocaleSwitch } from './locale-switch';

/** Up to two initials from the name (first letter of the first two words), else the email. */
export function initialsOf(name: string | undefined, email: string | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((word) => Array.from(word)[0] ?? '');
  const initials = letters.join('') || Array.from(email ?? '?')[0] || '?';
  return initials.toLocaleUpperCase();
}

function Avatar({ initials, size = 'md' }: { initials: string; size?: 'md' | 'lg' }) {
  return (
    <span className="avatar" data-size={size} aria-hidden="true">
      {initials}
    </span>
  );
}

/**
 * The account control at the foot of the sidebar. The trigger is compact: initials, the name
 * and a one-line email preview (truncated on purpose). The panel it opens shows the full
 * email (wrapping safely), a copy action, the profile link, language and sign-out. The theme
 * control sits in the sidebar itself, visible without opening this panel.
 * It is a non-modal dialog (not an ARIA menu): it holds text and a radio group, not only
 * commands. Focus moves into it on open and back to the trigger on close; Escape closes it.
 */
export function AccountMenu({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('account');
  const { data } = useSession();
  const signOut = useSignOut();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const subject = data?.subject;
  const name = subject?.name ?? subject?.email ?? '—';
  const email = subject?.email;
  const initials = initialsOf(subject?.name, subject?.email);

  return (
    <div className="shrink-0">
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger className="account-trigger" title={t('openMenu')} disabled={!subject}>
          <Avatar initials={initials} />
          <span className="account-trigger-text">
            <span className="sr-only">{t('openMenu')}: </span>
            {/* dir=auto: a Latin name in the Arabic UI is cut at its own end, not its start. */}
            <bdi dir="auto" className="account-trigger-name">
              {name}
            </bdi>
            {subject?.name && email && (
              <bdi dir="ltr" className="account-trigger-email">
                {email}
              </bdi>
            )}
          </span>
          <ChevronsUpDownIcon width={16} height={16} className="account-trigger-icon" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="top"
            align="start"
            sideOffset={8}
            collisionPadding={12}
            className="account-panel"
            aria-label={t('menuLabel')}
          >
            <div className="account-panel-head">
              <Avatar initials={initials} size="lg" />
              <div className="grid min-w-0 gap-0.5">
                <p className="font-semibold break-words">{name}</p>
                {email && (
                  <p className="text-sm text-muted">
                    <EmailText email={email} />
                  </p>
                )}
              </div>
            </div>
            {email && (
              <div className="px-2">
                <CopyButton value={email} label={t('copyEmail')} />
              </div>
            )}
            <div className="account-panel-section">
              <Link
                href="/account"
                className="nav-item"
                aria-current={pathname === '/account' ? 'page' : undefined}
                onClick={() => {
                  setOpen(false);
                  onNavigate?.();
                }}
              >
                <UserIcon width={18} height={18} />
                {t('profile')}
              </Link>
              <LocaleSwitch appearance="nav" />
            </div>
            <div className="account-panel-section">
              <button
                type="button"
                className="nav-button"
                disabled={signOut.isPending}
                aria-busy={signOut.isPending || undefined}
                onClick={() => signOut.mutate()}
              >
                {signOut.isPending ? (
                  <SpinnerIcon width={18} height={18} />
                ) : (
                  <SignOutIcon width={18} height={18} className="rtl:-scale-x-100" />
                )}
                {signOut.isPending ? t('signingOut') : t('signOut')}
              </button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {signOut.isPending && (
        <SessionTransition complete={signOut.complete} label={t('signingOut')} />
      )}
    </div>
  );
}
