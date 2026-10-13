'use client';

import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useAppSettings } from '@/features/settings/api';
import { Button } from '@/ui/button';
import { ChevronNextIcon } from '@/ui/icons';
import { NavigationIcon } from '@/ui/navigation-icon';
import { Page } from '@/ui/page';
import { PageHeader } from '@/ui/page-header';
import { useCityBreakdown, useTotal } from './api';

const STATS = [
  { key: 'countries', api: 'countries', href: '/locations/countries' },
  { key: 'cities', api: 'cities', href: '/locations/cities' },
  { key: 'currencies', api: 'currencies', href: '/catalog/currencies' },
  { key: 'unitCategories', api: 'unit-categories', href: '/catalog/unit-categories' },
  { key: 'admins', api: 'admins', href: '/team/admins' },
] as const;

function Retry({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations();
  return (
    <span className="flex flex-wrap items-center gap-2 text-sm text-danger">
      {t('home.error')}
      <Button variant="ghost" size="sm" onClick={onRetry}>
        {t('common.retry')}
      </Button>
    </span>
  );
}

/**
 * A count with a link to its list. A failed count says so and offers a retry; it never
 * shows a zero or a dash that could be read as data.
 */
function StatTile({ stat }: { stat: (typeof STATS)[number] }) {
  const t = useTranslations();
  const format = useFormatter();
  const total = useTotal(stat.api);
  return (
    <article className="stat-tile">
      <span className="flex items-center justify-between gap-2 text-sm text-muted">
        <h2 className="font-normal">{t(`nav.${stat.key}`)}</h2>
        <NavigationIcon name={stat.key} />
      </span>
      {total.isError ? (
        <Button
          variant="secondary"
          size="sm"
          className="justify-self-start"
          onClick={() => void total.refetch()}
        >
          {t('home.error')} · {t('common.retry')}
        </Button>
      ) : (
        <p className="stat-value tabular" aria-busy={total.isPending}>
          {total.isPending ? (
            <span className="skeleton inline-block h-7 w-12 align-middle" />
          ) : (
            format.number(total.data)
          )}
        </p>
      )}
      <Link
        href={stat.href}
        className="stat-link"
        aria-label={`${t('home.view')} ${t(`nav.${stat.key}`)}`}
      >
        {t('home.view')}
        <ChevronNextIcon width={16} height={16} className="rtl:-scale-x-100" />
      </Link>
    </article>
  );
}

function Card({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="ui-panel grid content-start">
      <header className="flex items-start justify-between gap-3 border-b border-hairline px-4 py-3.5 sm:px-5">
        <div className="grid gap-0.5">
          <h2 className="section-title">{title}</h2>
          {description && <p className="text-sm text-muted">{description}</p>}
        </div>
        {action}
      </header>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}

/**
 * The accessible alternative to a chart: the same numbers as a real table, behind a
 * disclosure everyone can open (keyboard and screen readers included).
 */
function ChartData({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: [string, string];
  rows: { key: string; label: ReactNode; value: number }[];
}) {
  const t = useTranslations('home');
  const format = useFormatter();
  return (
    <details className="chart-data">
      <summary>{t('showTable')}</summary>
      <table className="data-table mt-2">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{columns[0]}</th>
            <th scope="col" className="num">
              {columns[1]}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row" className="font-normal">
                {row.label}
              </th>
              <td className="num">{format.number(row.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** Horizontal bars (visual) plus the same data as a table (accessible alternative). */
function CitiesByCountry() {
  const t = useTranslations('home');
  const format = useFormatter();
  const breakdown = useCityBreakdown();

  let body: ReactNode;
  if (breakdown.status === 'pending') {
    body = (
      <div className="grid gap-3" role="status" aria-label={t('citiesByCountry')}>
        {[70, 55, 40, 25].map((width) => (
          <span key={width} className="skeleton h-5" style={{ width: `${width}%` }} />
        ))}
      </div>
    );
  } else if (breakdown.status === 'error') {
    body = <Retry onRetry={breakdown.retry} />;
  } else if (breakdown.status === 'too-many') {
    body = (
      <p className="text-sm text-muted">
        {t('citiesByCountryTooMany', { count: breakdown.countries })}
      </p>
    );
  } else if (breakdown.rows.length === 0) {
    body = <p className="text-sm text-muted">{t('noCountries')}</p>;
  } else {
    const max = Math.max(1, ...breakdown.rows.map((row) => row.cities));
    const total = breakdown.rows.reduce((sum, row) => sum + row.cities, 0);
    body = (
      <div className="grid gap-3">
        <p className="sr-only">
          {t('citiesChartSummary', { countries: breakdown.rows.length, cities: total })}
        </p>
        {/* Visual only; the table below carries the same numbers for assistive tech. */}
        <div className="bar-chart" aria-hidden="true" data-testid="cities-chart">
          {breakdown.rows.map((row) => (
            <div key={row.code} className="bar-row" data-value={row.cities}>
              <span className="bar-label line-clamp-2 break-words">
                <bdi>{row.name}</bdi>
              </span>
              <span className="bar-track">
                {row.cities === 0 ? (
                  <span className="bar-zero" />
                ) : (
                  <span
                    className="bar-fill"
                    style={{ inlineSize: `${(row.cities / max) * 100}%` }}
                  />
                )}
              </span>
              <span className="bar-value tabular">{format.number(row.cities)}</span>
            </div>
          ))}
        </div>
        <ChartData
          caption={t('citiesByCountry')}
          columns={[t('country'), t('cities')]}
          rows={breakdown.rows.map((row) => ({
            key: row.code,
            label: <bdi>{row.name}</bdi>,
            value: row.cities,
          }))}
        />
      </div>
    );
  }

  return (
    <Card
      title={t('citiesByCountry')}
      description={t('citiesByCountryBody')}
      action={
        <Link href="/locations/cities" className="text-link">
          {t('view')}
        </Link>
      }
    >
      {body}
    </Card>
  );
}

function AdminsByRole() {
  const t = useTranslations();
  const format = useFormatter();
  const supers = useTotal('admins', '&isSuperAdmin=true');
  const regular = useTotal('admins', '&isSuperAdmin=false');

  let body: ReactNode;
  if (supers.isPending || regular.isPending) {
    body = <span className="skeleton block h-10" />;
  } else if (supers.isError || regular.isError) {
    body = (
      <Retry
        onRetry={() => {
          void supers.refetch();
          void regular.refetch();
        }}
      />
    );
  } else {
    const total = supers.data + regular.data;
    const parts = [
      { key: 'super', label: t('admins.superAdmin'), value: supers.data },
      { key: 'regular', label: t('admins.admin'), value: regular.data },
    ];
    body = (
      <div className="grid gap-3">
        <p className="text-sm text-muted">{t('home.adminsTotal', { count: total })}</p>
        {/* Visual only; ChartData below is the accessible alternative. */}
        <div aria-hidden="true" className="grid gap-3" data-testid="admins-chart">
          <div className="split-bar">
            {parts.map((part) =>
              part.value > 0 ? (
                <span
                  key={part.key}
                  data-part={part.key}
                  data-value={part.value}
                  style={{ flexGrow: part.value }}
                  className="split-part"
                />
              ) : null,
            )}
          </div>
          <ul className="grid gap-1.5 text-sm">
            {parts.map((part) => (
              <li key={part.key} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <span className="legend-dot" data-part={part.key} />
                  {part.label}
                </span>
                <span className="tabular font-semibold">{format.number(part.value)}</span>
              </li>
            ))}
          </ul>
        </div>
        <ChartData
          caption={t('home.adminsByRole')}
          columns={[t('account.role'), t('home.adminsCount')]}
          rows={parts.map((part) => ({ key: part.key, label: part.label, value: part.value }))}
        />
      </div>
    );
  }
  return (
    <Card
      title={t('home.adminsByRole')}
      action={
        <Link href="/team/admins" className="text-link">
          {t('home.view')}
        </Link>
      }
    >
      {body}
    </Card>
  );
}

function PricingSummary() {
  const t = useTranslations('home');
  const format = useFormatter();
  const settings = useAppSettings();
  let body: ReactNode;
  if (settings.isPending) body = <span className="skeleton block h-10" />;
  else if (settings.isError) body = <Retry onRetry={() => void settings.refetch()} />;
  else {
    const rows = [
      {
        label: t('vatRate'),
        value: settings.data ? `${format.number(settings.data.vatRate)}٪` : null,
      },
      {
        label: t('minPrice'),
        value: settings.data ? format.number(settings.data.minPrice) : null,
      },
    ];
    body = (
      <dl className="grid gap-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <dt className="text-muted">{row.label}</dt>
            <dd className="tabular font-semibold">{row.value ?? t('pricingNotSet')}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <Card
      title={t('pricing')}
      action={
        <Link href="/settings/pricing" className="text-link">
          {t('edit')}
        </Link>
      }
    >
      {body}
    </Card>
  );
}

export function HomeScreen() {
  const t = useTranslations('home');
  return (
    <Page>
      <PageHeader title={t('overview')} summary={t('overviewSummary')} />
      <section aria-label={t('statsLabel')} className="stat-grid">
        {STATS.map((stat) => (
          <StatTile key={stat.key} stat={stat} />
        ))}
      </section>
      {/* Each card keeps its own height: the chart is as tall as its data, never stretched
          to match the cards beside it. */}
      <div className="grid items-start gap-[var(--panel-gap)] lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <CitiesByCountry />
        <div className="grid content-start gap-[var(--panel-gap)]">
          <AdminsByRole />
          <PricingSummary />
        </div>
      </div>
    </Page>
  );
}
