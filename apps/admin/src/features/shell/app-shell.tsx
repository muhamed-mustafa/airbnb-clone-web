'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { useSession, useSignOut } from '@/features/auth/use-session';
import { BrandMark } from '@/ui/brand';
import { EmailText } from '@/ui/email-text';
import { SessionTransition } from '@/ui/session-transition';
import { NavigationIcon } from '@/ui/navigation-icon';
import { Button } from '@/ui/button';
import { CloseIcon, MenuIcon, SignOutIcon, SpinnerIcon, UserIcon } from '@/ui/icons';
import { LocaleSwitch } from './locale-switch';

const NAV_GROUPS = [
  { key: 'overview', items: [{ href: '/', key: 'home' }] },
  {
    key: 'locations',
    items: [
      { href: '/locations/countries', key: 'countries' },
      { href: '/locations/cities', key: 'cities' },
    ],
  },
  {
    key: 'referenceData',
    items: [
      { href: '/catalog/currencies', key: 'currencies' },
      { href: '/catalog/unit-categories', key: 'unitCategories' },
    ],
  },
  {
    key: 'team',
    items: [{ href: '/team/admins', key: 'admins' }],
  },
  {
    key: 'settings',
    items: [{ href: '/settings/pricing', key: 'pricingSettings' }],
  },
] as const;

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  return (
    <nav aria-label={t('label')} className="grid gap-5 overflow-y-auto pb-3">
      {NAV_GROUPS.map((group) => {
        // A one-link "overview" group needs no heading.
        const labelled = group.key !== 'overview';
        return (
          <div
            key={group.key}
            role="group"
            aria-labelledby={labelled ? `nav-${group.key}` : undefined}
            aria-label={labelled ? undefined : t(group.key)}
            className="grid gap-0.5"
          >
            {labelled && (
              <p id={`nav-${group.key}`} className="nav-group-label pb-1">
                {t(group.key)}
              </p>
            )}
            {group.items.map((item) => {
              const current = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={current ? 'page' : undefined}
                  className="nav-item"
                >
                  <NavigationIcon name={item.key} />
                  {t(item.key)}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

function Account({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('account');
  const { data } = useSession();
  const signOut = useSignOut();
  const pathname = usePathname();
  const subject = data?.subject;
  return (
    <div className="grid shrink-0 gap-0.5 border-t border-[var(--nav-border)] pt-3">
      {subject && (
        // The full email is always readable: it wraps instead of being cut.
        <div className="grid gap-0.5 px-3 pb-2 text-sm">
          <span className="sr-only">{t('signedInAs')}</span>
          <span className="sidebar-title break-words font-semibold">
            {subject.name ?? subject.email ?? '—'}
          </span>
          {subject.name && subject.email && (
            <span className="text-xs leading-5 text-nav-muted">
              <EmailText email={subject.email} />
            </span>
          )}
        </div>
      )}
      <Link
        href="/account"
        onClick={onNavigate}
        aria-current={pathname === '/account' ? 'page' : undefined}
        className="nav-item"
      >
        <UserIcon width={18} height={18} />
        {t('profile')}
      </Link>
      <LocaleSwitch appearance="nav" />
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
      {signOut.isPending && (
        <SessionTransition complete={signOut.complete} label={t('signingOut')} />
      )}
    </div>
  );
}

const subscribeOnline = (callback: () => void) => {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
};

function OfflineBanner() {
  const t = useTranslations();
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <p role="status" className="bg-warning-tint px-4 py-2 text-sm font-semibold text-warning">
      {t('offline')}
    </p>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const active = NAV_GROUPS.flatMap((group) => [...group.items]).find((item) =>
    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href),
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2"
      >
        {t('app.skipToContent')}
      </a>

      <aside className="app-sidebar sticky top-0 hidden h-dvh flex-col justify-between gap-4 overflow-hidden p-3 lg:flex">
        <div className="flex min-h-0 flex-1 flex-col gap-6">
          <div className="flex items-center gap-3 px-2 pt-2">
            <BrandMark />
            <p className="sidebar-title text-base font-semibold">{t('app.title')}</p>
          </div>
          <Navigation />
        </div>
        <Account />
      </aside>

      <div className="min-w-0">
        {/* Phones and tablets only: the sidebar carries this information on large screens. */}
        <header className="app-topbar sticky top-0 z-30 flex min-h-14 items-center justify-between gap-3 border-b border-hairline px-4 lg:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark />
            <p className="truncate text-sm font-semibold">
              {pathname === '/account' ? t('account.profile') : t(`nav.${active?.key ?? 'home'}`)}
            </p>
          </div>
          <DialogPrimitive.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <DialogPrimitive.Trigger asChild>
              <Button variant="ghost" className="icon-only -me-2" aria-label={t('nav.openMenu')}>
                <MenuIcon />
              </Button>
            </DialogPrimitive.Trigger>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="dialog-overlay fixed inset-0 z-40" />
              <DialogPrimitive.Content
                aria-describedby={undefined}
                className="app-sidebar drawer-enter fixed inset-y-0 end-0 z-50 flex w-[min(18rem,85vw)] flex-col justify-between gap-6 overflow-y-auto p-3"
              >
                <div className="grid gap-5">
                  <div className="flex items-center justify-between ps-2">
                    <DialogPrimitive.Title className="sidebar-title text-base font-semibold">
                      {t('app.title')}
                    </DialogPrimitive.Title>
                    <DialogPrimitive.Close asChild>
                      <button
                        type="button"
                        className="nav-button w-11 justify-center px-0"
                        aria-label={t('nav.closeMenu')}
                      >
                        <CloseIcon />
                      </button>
                    </DialogPrimitive.Close>
                  </div>
                  <Navigation onNavigate={() => setMenuOpen(false)} />
                </div>
                <Account onNavigate={() => setMenuOpen(false)} />
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>
        </header>
        <OfflineBanner />
        <main id="main" tabIndex={-1} className="workspace focus:outline-none">
          <div key={pathname} className="route-enter">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
