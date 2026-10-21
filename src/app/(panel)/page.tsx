'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Inbox, Link2, MessageSquare, Paperclip, Search, SearchX, TriangleAlert, Users } from 'lucide-react';
import { PageHeader } from '@/components/app-shell';
import { DomainText } from '@/components/domain';
import { RiskMeter, StatusBadge, STATUS_VAR } from '@/components/badges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { EmptyState, Kbd, Skeleton } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { FilterTabs } from '@/components/ui/tabs';
import { api, errorMessage } from '@/lib/api';
import { RISK_LABEL, RISK_LEVELS, STATUSES, STATUS_LABEL, folio, number, timeAgo } from '@/lib/format';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';

type Report = {
  id: number;
  fraudType: string;
  status: string;
  riskLevel: string;
  description: string;
  createdAt: string;
  urls?: string[];
  evidenceUrls?: string[];
};

/** Lo que agrega la vista de la app (`/community`): título, ciudad y actividad. */
type Extra = {
  id: number;
  title: string;
  city: string;
  confirmations: number;
  comments: number;
};

const COLUMNS = 'md:grid-cols-[8.5rem_minmax(0,1fr)_7.5rem_7rem_6.5rem_1rem]';

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export default function ReportsPage() {
  const { setPending } = useSession();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [extras, setExtras] = useState<Map<number, Extra>>(new Map());
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [risk, setRisk] = useState('ALL');
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .get<Report[]>('/reports')
      .then(({ data }) => {
        setReports(data);
        setPending(data.filter((r) => r.status === 'RECIBIDO' || r.status === 'EN_REVISION').length);
      })
      .catch((e) => setError(errorMessage(e)));
    // Los títulos viven en la vista de la app. Si el rol no puede pedirla
    // (Policía), la bandeja sigue funcionando con el tipo de fraude.
    Promise.allSettled(
      STATUSES.map((s) => api.get<Extra[]>('/community/reports', { params: { scope: 'queue', status: s } })),
    ).then((results) => {
      const found = new Map<number, Extra>();
      for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        for (const extra of result.value.data) found.set(extra.id, extra);
      }
      setExtras(found);
    });
  }, [setPending]);

  // "/" lleva al buscador, salvo que ya se esté escribiendo en algún campo.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (event.key !== '/' || event.metaKey || event.ctrlKey) return;
      if (target.closest('input, textarea, select, [contenteditable]')) return;
      event.preventDefault();
      search.current?.focus();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const counts = useMemo(() => {
    const by: Record<string, number> = {};
    for (const r of reports ?? []) by[r.status] = (by[r.status] ?? 0) + 1;
    return by;
  }, [reports]);

  const visible = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    return (reports ?? []).filter((r) => {
      if (status !== 'ALL' && r.status !== status) return false;
      if (risk !== 'ALL' && r.riskLevel !== risk) return false;
      if (words.length === 0) return true;
      const extra = extras.get(r.id);
      const haystack = normalize(
        [folio(r.id, r.createdAt), `#${r.id}`, extra?.title, extra?.city, r.fraudType, r.description, ...(r.urls ?? [])].join(' '),
      );
      return words.every((w) => haystack.includes(w));
    });
  }, [reports, extras, query, status, risk]);

  const filtered = Boolean(query || status !== 'ALL' || risk !== 'ALL');
  const pending = (counts.RECIBIDO ?? 0) + (counts.EN_REVISION ?? 0);

  return (
    <>
      <PageHeader
        title="Reportes"
        description={
          !reports
            ? 'Lo que la comunidad denuncia, del más reciente al más antiguo.'
            : pending > 0
              ? `${number.format(pending)} ${pending === 1 ? 'espera' : 'esperan'} revisión, de ${number.format(reports.length)} en total.`
              : `Todo al día: ${number.format(reports.length)} reportes y ninguno pendiente.`
        }
      />

      <FilterTabs
        aria-label="Filtrar por estado"
        value={status}
        onValueChange={setStatus}
        items={[
          { value: 'ALL', label: 'Todos', count: reports?.length },
          ...STATUSES.map((s) => ({
            value: s,
            label: STATUS_LABEL[s],
            count: reports ? (counts[s] ?? 0) : undefined,
            dot: STATUS_VAR[s],
          })),
        ]}
      />

      <div className="flex flex-wrap items-center gap-2 py-3">
        <div className="relative min-w-56 flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input
            ref={search}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === 'Escape' && event.currentTarget.blur()}
            placeholder="Folio, título, tipo, ciudad o enlace…"
            aria-label="Buscar reportes"
            className="pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
          />
          {!query && <Kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2">/</Kbd>}
        </div>
        <Select
          aria-label="Filtrar por nivel de riesgo"
          value={risk}
          onValueChange={setRisk}
          className="w-44"
          options={[
            { value: 'ALL', label: 'Cualquier riesgo' },
            { value: 'NO_EVALUADO', label: RISK_LABEL.NO_EVALUADO },
            ...RISK_LEVELS.map((level) => ({ value: level, label: RISK_LABEL[level] })),
          ]}
        />
      </div>

      <div className="overflow-hidden rounded-xl bg-surface shadow-card">
        <div className={cn('hidden items-center gap-4 border-b border-line px-4 py-2 text-xs text-muted md:grid', COLUMNS)}>
          <span>Folio</span>
          <span>Reporte</span>
          <span>Estado</span>
          <span>Riesgo</span>
          <span>Recibido</span>
        </div>

        {error && (
          <EmptyState
            tone="danger"
            icon={<TriangleAlert />}
            title="No se pudieron cargar los reportes"
            description={error}
            action={<Button onClick={() => window.location.reload()}>Reintentar</Button>}
          />
        )}

        {!error && !reports && (
          <ul aria-busy aria-label="Cargando reportes">
            {Array.from({ length: 7 }, (_, i) => (
              <li key={i} className={cn('grid items-center gap-4 border-b border-line px-4 py-3.5 last:border-0', COLUMNS)}>
                <Skeleton className="hidden h-3.5 w-24 md:block" />
                <span className="grid gap-2">
                  <Skeleton className="h-3.5 w-2/5" />
                  <Skeleton className="h-3 w-4/5" />
                </span>
                <Skeleton className="hidden h-5 w-20 rounded-full md:block" />
                <Skeleton className="hidden h-3.5 w-16 md:block" />
                <Skeleton className="hidden h-3.5 w-14 md:block" />
              </li>
            ))}
          </ul>
        )}

        {reports?.length === 0 && (
          <EmptyState
            icon={<Inbox />}
            title="Todavía no hay reportes"
            description="Cuando alguien denuncie un fraude desde la app aparecerá aquí, listo para revisarse."
          />
        )}

        {reports && reports.length > 0 && visible.length === 0 && (
          <EmptyState
            icon={<SearchX />}
            title="Nada coincide con esos filtros"
            action={
              <Button
                onClick={() => {
                  setQuery('');
                  setStatus('ALL');
                  setRisk('ALL');
                }}
              >
                Quitar filtros
              </Button>
            }
          />
        )}

        {visible.length > 0 && (
          <ul className="stagger">
            {visible.map((report) => {
              const extra = extras.get(report.id);
              const unread = report.status === 'RECIBIDO';
              return (
                <li key={report.id} className="border-b border-line last:border-0">
                  <Link
                    href={`/reportes/${report.id}`}
                    className={cn(
                      'group grid items-center gap-x-4 gap-y-2 px-4 py-3 outline-none transition-colors duration-100 hover:bg-ink/[0.035] focus-visible:bg-ink/[0.05] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
                      COLUMNS,
                    )}
                  >
                    <span className="flex items-center gap-2 font-mono text-xs text-muted">
                      <span aria-hidden className={cn('size-1.5 rounded-full', unread ? 'bg-accent' : 'bg-transparent')} />
                      {folio(report.id, report.createdAt)}
                      {unread && <span className="sr-only">(sin revisar)</span>}
                    </span>

                    <span className="grid min-w-0 gap-0.5">
                      <span className={cn('truncate', unread ? 'font-semibold' : 'font-medium')}>
                        {extra?.title ?? report.fraudType}
                      </span>
                      <span className="truncate text-[13px] text-muted">{report.description}</span>
                      <span className="flex min-w-0 items-center gap-3 overflow-hidden pt-0.5 text-xs text-muted">
                        {extra && (
                          <span className="shrink-0">
                            {report.fraudType}
                            {extra.city && ` · ${extra.city}`}
                          </span>
                        )}
                        {(report.urls?.length ?? 0) > 0 && (
                          <span className="flex min-w-0 items-center gap-1" title="Enlaces reportados">
                            <Link2 className="size-3 shrink-0" />
                            <DomainText url={report.urls![0]} className="block min-w-0 truncate text-[11.5px]" />
                            {report.urls!.length > 1 && <span className="shrink-0">+{report.urls!.length - 1}</span>}
                          </span>
                        )}
                        {(report.evidenceUrls?.length ?? 0) > 0 && (
                          <span className="flex items-center gap-1" title="Archivos de evidencia">
                            <Paperclip className="size-3" />
                            {report.evidenceUrls!.length}
                          </span>
                        )}
                        {extra && extra.confirmations > 0 && (
                          <span className="flex items-center gap-1" title="Personas que dijeron «Yo también»">
                            <Users className="size-3" />
                            {extra.confirmations}
                          </span>
                        )}
                        {extra && extra.comments > 0 && (
                          <span className="flex items-center gap-1" title="Comentarios">
                            <MessageSquare className="size-3" />
                            {extra.comments}
                          </span>
                        )}
                      </span>
                    </span>

                    <span className="flex flex-wrap items-center gap-x-4 gap-y-2 md:contents">
                      <StatusBadge status={report.status} className="justify-self-start" />
                      <RiskMeter level={report.riskLevel} />
                      <time dateTime={report.createdAt} className="tnum text-[13px] text-muted">
                        {timeAgo(report.createdAt)}
                      </time>
                    </span>
                    <ChevronRight
                      aria-hidden
                      className="hidden size-4 text-muted opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100 md:block"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {reports && filtered && visible.length > 0 && (
        <p className="tnum mt-3 text-[13px] text-muted">
          {number.format(visible.length)} de {number.format(reports.length)} reportes
        </p>
      )}
    </>
  );
}
