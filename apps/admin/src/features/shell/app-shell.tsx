'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { BrandMark } from '@/ui/brand';
import { NavigationIcon } from '@/ui/navigation-icon';
import { Button } from '@/ui/button';
import { CloseIcon, MenuIcon } from '@/ui/icons';
import { AccountMenu } from './account-menu';
import { ThemeSwitch } from '@/theme/theme-switch';

const NAV_GROUPS = [
  { key: 'overview', items: [{ href: '/', key: 'home' }] },
  {
    key: 'operations',
    items: [
      { href: '/catalog/units', key: 'units' },
      { href: '/bookings', key: 'bookings' },
    ],
  },
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

const SIDEBAR_PREFERENCE = 'stays-admin-sidebar';
const SIDEBAR_CHANGE_EVENT = 'stays-admin-sidebar-change';

function subscribeSidebarPreference(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(SIDEBAR_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(SIDEBAR_CHANGE_EVENT, callback);
  };
}

function getSidebarCollapsed() {
  return window.localStorage.getItem(SIDEBAR_PREFERENCE) === 'collapsed';
}

const getServerSidebarCollapsed = () => false;

function Navigation({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
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
            aria-labelledby={labelled && !collapsed ? `nav-${group.key}` : undefined}
            aria-label={t(group.key)}
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
                  aria-label={t(item.key)}
                  title={collapsed ? t(item.key) : undefined}
                  className="nav-item"
                >
                  <NavigationIcon name={item.key} />
                  <span className="nav-item-label">{t(item.key)}</span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

/** The foot of the sidebar (and of the phone drawer): the theme control, then the account. */
function SidebarUtilities({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  return (
    <div className="sidebar-utilities">
      <ThemeSwitch compact={collapsed} />
      <AccountMenu onNavigate={onNavigate} />
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
  const sidebarCollapsed = useSyncExternalStore(
    subscribeSidebarPreference,
    getSidebarCollapsed,
    getServerSidebarCollapsed,
  );
  const pathname = usePathname();
  const toggleSidebar = () => {
    window.localStorage.setItem(SIDEBAR_PREFERENCE, sidebarCollapsed ? 'expanded' : 'collapsed');
    window.dispatchEvent(new Event(SIDEBAR_CHANGE_EVENT));
  };
  const active = NAV_GROUPS.flatMap((group) => [...group.items]).find((item) =>
    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href),
  );

  return (
    <div className="admin-shell min-h-dvh lg:grid" data-sidebar-collapsed={sidebarCollapsed}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2"
      >
        {t('app.skipToContent')}
      </a>

      <aside className="app-sidebar desktop-sidebar sticky top-0 hidden h-dvh flex-col justify-between gap-4 overflow-hidden p-3 lg:flex">
        {/* The navigation scrolls on short screens; the utility area below never clips. */}
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
          <div className="sidebar-brand-row flex items-center justify-between gap-2 px-2 pt-2">
            <div className="flex min-w-0 items-center gap-3">
              <BrandMark />
              <p className="sidebar-title text-base font-semibold">{t('app.title')}</p>
            </div>
            <button
              type="button"
              className="sidebar-collapse-button hidden lg:grid"
              aria-label={t(sidebarCollapsed ? 'nav.expandSidebar' : 'nav.collapseSidebar')}
              title={t(sidebarCollapsed ? 'nav.expandSidebar' : 'nav.collapseSidebar')}
              aria-expanded={!sidebarCollapsed}
              aria-controls="admin-sidebar-navigation"
              onClick={toggleSidebar}
            >
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M9 4v16m3-11 3 3-3 3" />
              </svg>
            </button>
          </div>
          <div id="admin-sidebar-navigation" className="sidebar-navigation">
            <Navigation collapsed={sidebarCollapsed} />
          </div>
        </div>
        <SidebarUtilities collapsed={sidebarCollapsed} />
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
                <SidebarUtilities onNavigate={() => setMenuOpen(false)} />
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
