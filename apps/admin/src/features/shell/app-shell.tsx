'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { useSession, useSignOut } from '@/features/auth/use-session';
import { Button } from '@/ui/button';
import { CloseIcon, MenuIcon, SignOutIcon } from '@/ui/icons';
import { LocaleSwitch } from './locale-switch';

const NAV_GROUPS = [
  {
    key: 'locations',
    items: [
      { href: '/locations/countries', key: 'countries' },
      { href: '/locations/cities', key: 'cities' },
    ],
  },
  {
    key: 'referenceData',
    items: [{ href: '/catalog/currencies', key: 'currencies' }],
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
    <nav aria-label={t('label')} className="grid gap-5">
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
            const current = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={current ? 'page' : undefined}
                className={[
                  'flex min-h-10 items-center rounded-md px-3 text-sm font-semibold pointer-coarse:min-h-11',
                  current ? 'bg-accent-tint text-accent' : 'text-ink hover:bg-sunken',
                ].join(' ')}
              >
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
    <div className="grid gap-2 border-t border-hairline pt-4">
      {subject && (
        <div className="grid px-3 text-sm">
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

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2"
      >
        {t('app.skipToContent')}
      </a>

      <aside className="sticky top-0 hidden h-dvh flex-col justify-between border-e border-hairline bg-surface p-4 lg:flex">
        <div className="grid gap-6">
          <p className="px-3 text-base font-semibold">{t('app.title')}</p>
          <Navigation />
        </div>
        <Account />
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-hairline bg-surface px-4 py-2 lg:hidden">
          <p className="text-base font-semibold">{t('app.title')}</p>
          <DialogPrimitive.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <DialogPrimitive.Trigger asChild>
              <Button variant="ghost" className="px-2" aria-label={t('nav.openMenu')}>
                <MenuIcon />
              </Button>
            </DialogPrimitive.Trigger>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink/40" />
              <DialogPrimitive.Content
                aria-describedby={undefined}
                className="fixed inset-y-0 end-0 z-50 flex w-[min(20rem,85vw)] flex-col justify-between gap-6 overflow-y-auto bg-surface p-4"
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
          className="mx-auto w-full max-w-5xl px-4 py-6 focus:outline-none sm:px-6 lg:py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
