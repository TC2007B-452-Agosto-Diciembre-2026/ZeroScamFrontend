'use client';

import { useEffect, useState } from 'react';
import NumberFlow from '@/components/number-flow';
import { Lock, TriangleAlert } from 'lucide-react';
import { PageHeader } from '@/components/app-shell';
import { STATUS_VAR } from '@/components/badges';
import { RankChart, ShareChart, TrendChart, type Count } from '@/components/charts/charts';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { FilterTabs } from '@/components/ui/tabs';
import { api, errorMessage } from '@/lib/api';
import { RISK_LABEL, RISK_LEVELS } from '@/lib/format';

type Stats = {
  total: number;
  byStatus: Count[];
  byFraudType: Count[];
  byRiskLevel: Count[];
  byCountry: Count[];
  byMonth: Count[];
  approvalRate: number | null;
};

type SiteStats = {
  users: {
    total: number;
    byRole: Count[];
    byAccountStatus: Count[];
    byCountry: Count[];
    byMonth: Count[];
  };
  urls: { total: number; analyzed: number; byRiskLevel: Count[] };
  lookups: { total: number; users: number; byMonth: Count[] };
  notifications: { total: number; unread: number; riskAlerts: number };
};

type Filters = { from?: string; to?: string; country?: string; riskLevel?: string };

const STATUS_COLORS = {
  RECIBIDO: STATUS_VAR.RECIBIDO,
  EN_REVISION: STATUS_VAR.EN_REVISION,
  VALIDADO: STATUS_VAR.VALIDADO,
  CANALIZADO: STATUS_VAR.CANALIZADO,
  RECHAZADO: STATUS_VAR.RECHAZADO,
};

const ACCOUNT_COLORS = {
  ACTIVO: STATUS_VAR.ACTIVO,
  SUSPENDIDO: STATUS_VAR.SUSPENDIDO,
  ELIMINADA: 'var(--risk-0)',
};

const of = (counts: Count[], name: string) => counts.find((c) => c.name === name)?.count ?? 0;

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [site, setSite] = useState<SiteStats | null>(null);
  const [error, setError] = useState('');
  const [siteError, setSiteError] = useState('');
  const [tab, setTab] = useState('reportes');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [country, setCountry] = useState('');
  const [riskLevel, setRiskLevel] = useState('ALL');
  const [filters, setFilters] = useState<Filters>({});

  // Los filtros aplican solos; el texto espera a que se deje de escribir.
  // Un filtro vacío no se manda: el servidor rechaza `from=` sin valor.
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setFilters({
          from: from || undefined,
          // El campo da solo el día; se manda su último segundo para que
          // "hasta el 30" incluya los reportes del 30.
          to: to ? to + 'T23:59:59' : undefined,
          country: country.trim() || undefined,
          riskLevel: riskLevel === 'ALL' ? undefined : riskLevel,
        }),
      country ? 300 : 0,
    );
    return () => clearTimeout(timer);
  }, [from, to, country, riskLevel]);

  useEffect(() => {
    api
      .get<Stats>('/stats', { params: filters })
      .then(({ data }) => {
        setStats(data);
        setError('');
      })
      .catch((e) => setError(errorMessage(e)));
    // Las métricas de la plataforma solo aceptan el periodo, no el país ni
    // el riesgo. Su error va aparte: la Policía ve los reportes pero no
    // esta parte, y eso no debe tapar lo demás.
    api
      .get<SiteStats>('/stats/site', { params: { from: filters.from, to: filters.to } })
      .then(({ data }) => {
        setSite(data);
        setSiteError('');
      })
      .catch((e) => {
        setSite(null);
        setSiteError(errorMessage(e));
      });
  }, [filters]);

  const filtered = Boolean(from || to || country || riskLevel !== 'ALL');
  const pending = stats ? of(stats.byStatus, 'RECIBIDO') + of(stats.byStatus, 'EN_REVISION') : 0;
  const confirmed = stats ? of(stats.byStatus, 'VALIDADO') + of(stats.byStatus, 'CANALIZADO') : 0;

  return (
    <>
      <PageHeader title="Estadísticas" description="Qué se denuncia, qué tan grave es y cómo se usa la plataforma." />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <Field label="Desde" className="w-40">
          <Input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
        </Field>
        <Field label="Hasta" className="w-40">
          <Input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
        </Field>
        <Field label="País del denunciante" className="w-44">
          <Input value={country} placeholder="Cualquiera" onChange={(event) => setCountry(event.target.value)} />
        </Field>
        <div className="grid w-40 gap-1.5">
          <span className="text-[13px] font-medium text-ink-2">Riesgo</span>
          <Select
            aria-label="Nivel de riesgo"
            value={riskLevel}
            onValueChange={setRiskLevel}
            options={[
              { value: 'ALL', label: 'Cualquiera' },
              ...RISK_LEVELS.map((level) => ({ value: level, label: RISK_LABEL[level] })),
            ]}
          />
        </div>
        {filtered && (
          <Button
            variant="ghost"
            onClick={() => {
              setFrom('');
              setTo('');
              setCountry('');
              setRiskLevel('ALL');
            }}
          >
            Quitar filtros
          </Button>
        )}
      </div>

      {/* Las cifras del periodo en una sola franja: se leen juntas, no como tarjetas sueltas. */}
      <dl className="mb-8 grid grid-cols-2 divide-line rounded-xl bg-surface shadow-card max-sm:divide-y sm:grid-cols-4 sm:divide-x">
        <Figure label={filtered ? 'Reportes con estos filtros' : 'Reportes'} value={stats?.total} />
        <Figure label="Por revisar" value={stats ? pending : undefined} />
        <Figure label="Validados o canalizados" value={stats ? confirmed : undefined} />
        <Figure
          label="Tasa de aprobación"
          value={stats ? (stats.approvalRate === null ? null : stats.approvalRate) : undefined}
          percent
          hint={stats?.approvalRate === null ? 'Aún no hay reportes resueltos' : undefined}
        />
      </dl>

      <FilterTabs
        aria-label="Vista"
        value={tab}
        onValueChange={setTab}
        items={[
          { value: 'reportes', label: 'Reportes' },
          { value: 'plataforma', label: 'Plataforma' },
        ]}
      />

      {tab === 'reportes' && (
        <div className="pt-5">
          {error && (
            <EmptyState
              tone="danger"
              icon={<TriangleAlert />}
              title="No se pudieron cargar las estadísticas"
              description={error}
              action={<Button onClick={() => setFilters({ ...filters })}>Reintentar</Button>}
            />
          )}
          {!error && !stats && <ChartsSkeleton />}
          {!error && stats && (
            <div className="arrive grid items-start gap-4 lg:grid-cols-2">
              <div className="lg:col-span-2">
                <TrendChart title="Reportes por mes" counts={stats.byMonth} />
              </div>
              <ShareChart title="Por estado" counts={stats.byStatus} colors={STATUS_COLORS} />
              <RankChart title="Por nivel de riesgo" counts={stats.byRiskLevel} kind="risk" />
              <RankChart title="Por tipo de fraude" counts={stats.byFraudType} />
              <RankChart title="Por país" counts={stats.byCountry} />
            </div>
          )}
        </div>
      )}

      {tab === 'plataforma' && (
        <div className="pt-5">
          {siteError && <EmptyState icon={<Lock />} title="Esta parte no está disponible para tu rol" description={siteError} />}
          {!siteError && !site && <ChartsSkeleton />}
          {site && (
            <div className="arrive grid gap-4">
              <dl className="grid grid-cols-2 gap-x-8 gap-y-5 rounded-xl bg-surface p-4 shadow-card sm:grid-cols-4">
                {(
                  [
                    ['Cuentas registradas', site.users.total],
                    ['URLs en el directorio', site.urls.total],
                    ['URLs ya analizadas', site.urls.analyzed],
                    ['Consultas de riesgo', site.lookups.total],
                    ['Usuarios que consultaron', site.lookups.users],
                    ['Notificaciones enviadas', site.notifications.total],
                    ['Notificaciones sin leer', site.notifications.unread],
                    ['Alertas de riesgo de una URL', site.notifications.riskAlerts],
                  ] as [string, number][]
                ).map(([text, value]) => (
                  <div key={text} className="grid gap-0.5">
                    <dt className="text-[13px] text-muted">{text}</dt>
                    <dd className="text-lg font-semibold tracking-[-0.01em]">
                      <NumberFlow value={value} locales="es-MX" />
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="grid items-start gap-4 lg:grid-cols-2">
                <TrendChart title="Registros por mes" counts={site.users.byMonth} />
                <TrendChart title="Consultas de riesgo por mes" counts={site.lookups.byMonth} />
                <ShareChart title="Cuentas por estado" counts={site.users.byAccountStatus} colors={ACCOUNT_COLORS} />
                <RankChart title="Cuentas por rol" counts={site.users.byRole} />
                <RankChart title="URLs por nivel de riesgo" counts={site.urls.byRiskLevel} kind="risk" />
                <RankChart title="Cuentas por país" counts={site.users.byCountry} />
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/** Una cifra de la franja. `undefined` = cargando; `null` = no aplica todavía. */
function Figure({
  label,
  value,
  percent = false,
  hint,
}: {
  label: string;
  value: number | null | undefined;
  percent?: boolean;
  hint?: string;
}) {
  return (
    <div className="grid gap-1 p-4">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="text-2xl font-semibold tracking-[-0.02em]">
        {value === undefined ? (
          <Skeleton className="my-1 h-6 w-14" />
        ) : value === null ? (
          <span className="text-muted">—</span>
        ) : (
          <NumberFlow
            value={value}
            locales="es-MX"
            format={percent ? { style: 'percent', maximumFractionDigits: 0 } : undefined}
          />
        )}
      </dd>
      {hint && <dd className="text-xs text-muted">{hint}</dd>}
    </div>
  );
}

function ChartsSkeleton() {
  return (
    <div aria-busy aria-label="Cargando estadísticas" className="grid gap-4 lg:grid-cols-2">
      <Skeleton className="h-64 rounded-xl lg:col-span-2" />
      <Skeleton className="h-44 rounded-xl" />
      <Skeleton className="h-44 rounded-xl" />
    </div>
  );
}
