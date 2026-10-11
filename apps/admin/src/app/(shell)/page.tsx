'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations, useFormatter } from 'next-intl';
import { bffFetch } from '@/lib/bff-client';
import { NavigationIcon } from '@/ui/navigation-icon';
const resources = [
  { key: 'countries', path: '/locations/countries', api: 'countries' },
  { key: 'cities', path: '/locations/cities', api: 'cities' },
  { key: 'unitCategories', path: '/catalog/unit-categories', api: 'unit-categories' },
  { key: 'currencies', path: '/catalog/currencies', api: 'currencies' },
] as const;
function Metric({ resource }: { resource: (typeof resources)[number] }) {
  const t = useTranslations();
  const format = useFormatter();
  const query = useQuery({
    queryKey: ['overview', resource.api],
    queryFn: ({ signal }) =>
      bffFetch<{ meta: { total: number } }>(`/bff/api/${resource.api}?page=1&limit=1`, { signal }),
  });
  return (
    <article className="dashboard-card grid gap-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{t(`nav.${resource.key}`)}</h2>
        <span className="rounded-xl bg-accent-tint p-3 text-accent">
          <NavigationIcon name={resource.key} />
        </span>
      </div>
      {query.isError ? (
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="text-start text-sm text-danger"
        >
          {t('home.error')} ? {t('common.retry')}
        </button>
      ) : (
        <p aria-busy={query.isPending} className="text-4xl font-semibold">
          {query.data ? format.number(query.data.meta.total) : '—'}
        </p>
      )}
      <Link href={resource.path} className="text-sm font-semibold text-accent">
        {t('home.manage')} <span aria-hidden="true">↗</span>
      </Link>
    </article>
  );
}
export default function Home() {
  const t = useTranslations();
  return (
    <div className="grid gap-8">
      <section className="dashboard-hero grid gap-4">
        <p className="text-sm text-blue-200">{t('design.workspace')}</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">{t('home.title')}</h1>
        <p className="max-w-xl text-sm leading-7 text-slate-300">{t('home.intro')}</p>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {resources.map((resource) => (
          <Metric key={resource.key} resource={resource} />
        ))}
      </div>
      <section className="grid gap-4">
        <h2 className="text-xl font-semibold">{t('home.tools')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { key: 'admins', href: '/team/admins' },
            { key: 'pricingSettings', href: '/settings/pricing' },
          ].map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="dashboard-card flex items-center gap-4"
            >
              <span className="rounded-xl bg-sunken p-3 text-accent">
                <NavigationIcon name={item.key} />
              </span>
              <span className="font-semibold">{t(`nav.${item.key}`)}</span>
              <span aria-hidden="true" className="ms-auto text-accent">
                ↗
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
