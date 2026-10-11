'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { useSession, useSignOut } from '@/features/auth/use-session';
import { BrandMark } from '@/ui/brand';
import { SessionTransition } from '@/ui/session-transition';
import { NavigationIcon } from '@/ui/navigation-icon';
import { Button } from '@/ui/button';
import { CloseIcon, MenuIcon, SignOutIcon } from '@/ui/icons';
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
    <nav aria-label={t('label')} className="grid gap-4 overflow-y-auto pb-3">
      {NAV_GROUPS.map((group) => (
        <div
          key={group.key}
          role="group"
          aria-labelledby={`nav-${group.key}`}
          className="grid gap-1"
        >
          <p id={`nav-${group.key}`} className="px-3 pb-1 text-xs font-semibold text-muted">
            {t(group.key)}
          </p>
          {group.items.map((item) => {
            const current = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={current ? 'page' : undefined}
                className={[
                  'nav-item flex min-h-11 items-center rounded-md px-3 text-sm font-semibold pointer-coarse:min-h-11',
                  current ? 'text-white' : 'text-ink',
                ].join(' ')}
              >
                <NavigationIcon name={item.key} />
                {t(item.key)}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function Account() {
  const t = useTranslations('account');
  const { data } = useSession();
  const signOut = useSignOut();
  const subject = data?.subject;
  return (
    <div className="grid shrink-0 gap-2 border-t border-hairline pt-4">
      {subject && (
        <div className="grid rounded-lg bg-white/5 px-3 py-3 text-sm">
          <span className="text-xs text-muted">{t('signedInAs')}</span>
          <span className="truncate font-semibold">{subject.name ?? subject.email ?? '—'}</span>
          {subject.name && subject.email && (
            <span className="truncate text-xs text-muted">
              <bdi dir="ltr">{subject.email}</bdi>
            </span>
          )}
        </div>
      )}
      <LocaleSwitch className="justify-start text-start" />
      <Button
        variant="ghost"
        className="justify-start text-start"
        icon={<SignOutIcon width={18} height={18} className="rtl:-scale-x-100" />}
        loading={signOut.isPending}
        loadingLabel={t('signingOut')}
        onClick={() => signOut.mutate()}
      >
        {t('signOut')}
      </Button>
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
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2"
      >
        {t('app.skipToContent')}
      </a>

      <aside className="admin-sidebar sticky top-0 hidden h-dvh overflow-hidden flex-col justify-between border-e border-hairline bg-surface p-4 lg:flex">
        <div className="flex min-h-0 flex-1 flex-col gap-6">
          <div className="flex items-center gap-3 px-2 py-3">
            <BrandMark />
            <div className="grid gap-1">
              <p className="text-base font-semibold">{t('app.title')}</p>
              <p className="text-xs text-muted">{t('design.workspace')}</p>
            </div>
          </div>
          <Navigation />
        </div>
        <Account />
      </aside>

      <div className="min-w-0">
        <header className="shell-topbar sticky top-0 z-30 flex min-h-18 items-center justify-between border-b border-hairline px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="lg:hidden">
              <BrandMark />
            </span>
            <div>
              <p className="text-xs text-muted">{t('design.workspace')}</p>
              <p className="text-sm font-semibold">{t(`nav.${active?.key ?? 'home'}`)}</p>
            </div>
          </div>
          <span className="hidden rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-muted lg:inline-flex">
            {t('design.adminSpace')}
          </span>
          <DialogPrimitive.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <DialogPrimitive.Trigger asChild>
              <Button variant="ghost" className="px-2 lg:hidden" aria-label={t('nav.openMenu')}>
                <MenuIcon />
              </Button>
            </DialogPrimitive.Trigger>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="dialog-overlay fixed inset-0 z-40 bg-ink/45" />
              <DialogPrimitive.Content
                aria-describedby={undefined}
                className="admin-sidebar route-enter fixed inset-y-0 end-0 z-50 flex w-[min(20rem,85vw)] flex-col justify-between gap-6 overflow-y-auto p-4"
              >
                <div className="grid gap-6">
                  <div className="flex items-center justify-between">
                    <DialogPrimitive.Title className="px-3 text-base font-semibold">
                      {t('app.title')}
                    </DialogPrimitive.Title>
                    <DialogPrimitive.Close asChild>
                      <Button variant="ghost" className="px-2" aria-label={t('nav.closeMenu')}>
                        <CloseIcon />
                      </Button>
                    </DialogPrimitive.Close>
                  </div>
                  <Navigation onNavigate={() => setMenuOpen(false)} />
                </div>
                <Account />
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>
        </header>
        <OfflineBanner />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl px-4 py-6 focus:outline-none sm:px-6 lg:py-8"
        >
          <div key={pathname} className="route-enter">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
