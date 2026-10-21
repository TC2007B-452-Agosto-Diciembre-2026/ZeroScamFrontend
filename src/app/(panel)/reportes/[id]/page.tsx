'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Dialog } from '@base-ui/react/dialog';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Check, Copy, Download, FileText, Lock, TriangleAlert, VenetianMask, X } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, RiskMeter, StatusBadge, STATUS_VAR } from '@/components/badges';
import { Button, buttonVariants } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/field';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { API_URL, api, errorMessage } from '@/lib/api';
import { DomainText } from '@/components/domain';
import { RISK_LABEL, RISK_LEVELS, RISK_ORDER, STATUS_LABEL, defang, folio, formatDateTime, timeAgo } from '@/lib/format';
import { isStaff, useSession } from '@/lib/session';
import { cn } from '@/lib/utils';

type Report = {
  id: number;
  fraudType: string;
  status: string;
  riskLevel: string;
  description: string;
  incidentDate: string;
  createdAt: string;
  urls: string[];
  evidenceUrls: string[];
  history?: {
    fromStatus: string | null;
    toStatus: string;
    observations?: string;
    changedAt: string;
  }[];
  reporter?: { name: string; lastName: string; alias?: string; email: string; country: string };
  message?: string;
};

/** Lo que solo guarda la vista de la app (`GET /community/reports/:id`). */
type Extra = {
  title: string;
  city: string;
  anonymous: boolean;
  otherType?: string;
  suspiciousText?: string;
  affectedPerson?: { name: string; contact: string };
  confirmations: number;
  comments: number;
  author: { name: string };
};

/** A qué estados se puede mover un reporte desde cada uno; los finales, a ninguno. */
const NEXT: Record<string, string[]> = {
  RECIBIDO: ['EN_REVISION', 'RECHAZADO'],
  EN_REVISION: ['VALIDADO', 'RECHAZADO'],
  VALIDADO: ['CANALIZADO'],
  RECHAZADO: [],
  CANALIZADO: [],
};

/** El camino normal de un reporte; RECHAZADO lo corta donde esté. */
const PIPELINE = ['RECIBIDO', 'EN_REVISION', 'VALIDADO', 'CANALIZADO'];

const isPending = (status: string) => status === 'RECIBIDO' || status === 'EN_REVISION';
const isImage = (path: string) => /\.(jpe?g|png|gif|webp)$/i.test(path);

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const { me, pending, setPending } = useSession();
  const canModerate = isStaff(me);
  const [report, setReport] = useState<Report | null>(null);
  const [extra, setExtra] = useState<Extra | null>(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState<'status' | 'risk' | 'export' | null>(null);
  const [nextStatus, setNextStatus] = useState('');
  const [risk, setRisk] = useState('');
  const [preview, setPreview] = useState<string | null>(null);

  const load = useCallback(() => {
    // La vista de la app es un extra: si el rol no puede pedirla, no pasa nada.
    api
      .get<Extra>(`/community/reports/${id}`)
      .then(({ data }) => setExtra(data))
      .catch(() => setExtra(null));
    return api
      .get<Report>(`/reports/${id}`)
      .then(({ data }) => {
        setReport(data);
        setRisk(data.riskLevel);
        setNextStatus(NEXT[data.status]?.[0] ?? '');
        return data;
      })
      .catch((e) => {
        setError(errorMessage(e));
        return null;
      });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function send(kind: 'status' | 'risk', body: object) {
    const before = report?.status;
    setSending(kind);
    try {
      const { data } = await api.patch<Report>(`/reports/${id}/${kind}`, body);
      toast.success(data.message ?? 'Cambio guardado');
      // El PATCH no regresa `history` ni `reporter`: se vuelve a pedir el detalle.
      const fresh = await load();
      // La cuenta de pendientes de la barra lateral sigue al cambio.
      if (fresh && before && pending !== null && isPending(before) !== isPending(fresh.status)) {
        setPending(Math.max(0, pending + (isPending(fresh.status) ? 1 : -1)));
      }
    } catch (e) {
      toast.error(errorMessage(e));
    }
    setSending(null);
  }

  async function handleExport() {
    setSending('export');
    try {
      const { data } = await api.get<{ folio: string }>(`/reports/${id}/export`);
      // Un enlace normal no puede mandar el Bearer: el expediente se pide
      // con `api` y el archivo se arma aquí con lo que regresó.
      const file = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(file);
      link.download = `${data.folio}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success(`Expediente ${data.folio} descargado`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
    setSending(null);
  }

  function handleStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const observations = String(new FormData(form).get('observations')).trim();
    send('status', {
      status: nextStatus,
      // El servidor rechaza un texto vacío: si no hay, no se manda.
      ...(observations && { observations }),
    }).then(() => form.reset());
  }

  if (error) {
    return (
      <EmptyState
        tone="danger"
        icon={<TriangleAlert />}
        title="No se pudo abrir el reporte"
        description={error}
        action={
          <Link href="/" className={buttonVariants()}>
            Volver a los reportes
          </Link>
        }
      />
    );
  }

  if (!report) return <Loading />;

  const options = NEXT[report.status] ?? [];
  const exportable = report.status === 'VALIDADO' || report.status === 'CANALIZADO';
  const type = extra?.otherType ?? report.fraudType;

  return (
    <div className="arrive">
      <Link
        href="/"
        className="-ml-1.5 mb-5 inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[13px] text-muted outline-none transition-colors duration-150 hover:text-ink focus-visible:outline-3 focus-visible:outline-accent"
      >
        <ArrowLeft className="size-3.5" />
        Reportes
      </Link>

      <header className="mb-8 grid gap-2">
        <h1 className="max-w-[28ch] text-[28px] leading-[1.15] font-semibold tracking-[-0.03em]">
          {extra?.title ?? report.fraudType}
        </h1>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
          <span className="font-mono text-xs">{folio(report.id, report.createdAt)}</span>
          <span aria-hidden>·</span>
          <span>{type}</span>
          {extra?.city && (
            <>
              <span aria-hidden>·</span>
              <span>{extra.city}</span>
            </>
          )}
          <span aria-hidden>·</span>
          <time dateTime={report.createdAt}>recibido {timeAgo(report.createdAt)}</time>
        </p>
      </header>

      <div className="grid items-start gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <Pipeline status={report.status} />

          <Section title="Qué pasó">
            <p className="max-w-[68ch] text-[15px] leading-[1.65] whitespace-pre-line">{report.description}</p>
            <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-3">
              <Fact label="Ocurrió" value={formatDateTime(report.incidentDate)} />
              <Fact label="Se reportó" value={formatDateTime(report.createdAt)} />
              {extra && extra.confirmations > 0 && (
                <Fact label="También les pasó" value={`${extra.confirmations} ${extra.confirmations === 1 ? 'persona' : 'personas'}`} />
              )}
              {extra && extra.comments > 0 && <Fact label="Comentarios" value={String(extra.comments)} />}
            </dl>
          </Section>

          {(report.urls.length > 0 || extra?.suspiciousText) && (
            <Section
              title={report.urls.length > 0 ? 'Enlaces reportados' : 'Dato reportado'}
              note={report.urls.length > 0 ? 'Desactivados para que nadie los abra por accidente' : undefined}
            >
              <ul className="grid gap-1.5">
                {report.urls.map((url) => (
                  <li key={url}>
                    <DefangedUrl url={url} />
                  </li>
                ))}
              </ul>
              {extra?.suspiciousText && (
                <p className="rounded-lg bg-sunk px-3 py-2.5 font-mono text-[13px] leading-relaxed break-words">
                  {extra.suspiciousText}
                </p>
              )}
            </Section>
          )}

          <Section
            title="Evidencia"
            note={report.evidenceUrls.length > 0 ? `${report.evidenceUrls.length} ${report.evidenceUrls.length === 1 ? 'archivo' : 'archivos'}` : undefined}
          >
            {report.evidenceUrls.length === 0 ? (
              <p className="text-sm text-muted">El denunciante no adjuntó archivos.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {report.evidenceUrls.map((path) => {
                  const name = path.replace('/uploads/', '');
                  const thumb = (
                    <>
                      <span className="grid aspect-[4/3] place-items-center overflow-hidden rounded-lg bg-sunk outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10">
                        {isImage(path) ? (
                          // eslint-disable-next-line @next/next/no-img-element -- el archivo vive en la API, fuera del optimizador de Next
                          <img src={API_URL + path} alt="" loading="lazy" className="size-full object-cover" />
                        ) : (
                          <FileText className="size-6 text-muted" />
                        )}
                      </span>
                      <span className="mt-1.5 block truncate font-mono text-[11px] text-muted">{name}</span>
                    </>
                  );
                  const shared =
                    'block w-full rounded-lg text-left outline-none transition-transform duration-150 ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent';
                  return (
                    <li key={path}>
                      {isImage(path) ? (
                        <button type="button" className={shared} aria-label={`Ver evidencia ${name}`} onClick={() => setPreview(path)}>
                          {thumb}
                        </button>
                      ) : (
                        <a href={API_URL + path} target="_blank" rel="noreferrer" className={shared}>
                          {thumb}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section title="Historial">
            {!report.history || report.history.length === 0 ? (
              <p className="text-sm text-muted">Sin cambios todavía.</p>
            ) : (
              <ol className="relative grid gap-4 before:absolute before:top-2 before:bottom-2 before:left-[3px] before:w-px before:bg-line-strong">
                {report.history.map((entry, index) => (
                  <li key={index} className="relative grid gap-0.5 pl-6">
                    <span
                      aria-hidden
                      className="absolute top-[7px] left-0 size-[7px] rounded-full ring-4 ring-bg"
                      style={{ background: STATUS_VAR[entry.toStatus] ?? 'var(--muted)' }}
                    />
                    <span className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span className="font-medium">{STATUS_LABEL[entry.toStatus] ?? entry.toStatus}</span>
                      {entry.fromStatus && entry.fromStatus !== entry.toStatus && (
                        <span className="text-muted">desde {(STATUS_LABEL[entry.fromStatus] ?? entry.fromStatus).toLowerCase()}</span>
                      )}
                      <time dateTime={entry.changedAt} className="tnum text-xs text-muted">
                        {formatDateTime(entry.changedAt)}
                      </time>
                    </span>
                    {entry.observations && <span className="text-[13px] leading-relaxed text-ink-2">{entry.observations}</span>}
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>

        {/* Decisiones: se quedan a la vista mientras se lee el reporte. */}
        <aside className="grid divide-y divide-line rounded-xl bg-surface shadow-card lg:sticky lg:top-8">
          <div className="grid gap-4 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-medium text-ink-2">Estado</h2>
              <StatusBadge status={report.status} />
            </div>
            {!canModerate ? null : options.length === 0 ? (
              <p className="text-[13px] leading-relaxed text-muted">
                {STATUS_LABEL[report.status]} es un estado final: este reporte ya no cambia.
              </p>
            ) : (
              <form onSubmit={handleStatus} className="grid gap-3">
                <div role="radiogroup" aria-label="Estado nuevo" className="grid gap-1.5">
                  {options.map((option) => {
                    const active = nextStatus === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setNextStatus(option)}
                        className={cn(
                          'flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm transition-[box-shadow,background-color,transform] duration-150 ease-out active:scale-[0.98]',
                          active ? 'bg-ink/5 font-medium shadow-[inset_0_0_0_1.5px_var(--ink)]' : 'text-ink-2 shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-ink/4',
                        )}
                      >
                        <span aria-hidden className="size-1.5 rounded-full" style={{ background: STATUS_VAR[option] }} />
                        Pasar a {STATUS_LABEL[option].toLowerCase()}
                        {active && <Check aria-hidden className="ml-auto size-4" />}
                      </button>
                    );
                  })}
                </div>
                <Field
                  label={nextStatus === 'RECHAZADO' ? 'Motivo del rechazo' : 'Observaciones (opcional)'}
                  hint="El denunciante lo verá en su notificación."
                >
                  <Textarea
                    name="observations"
                    rows={3}
                    required={nextStatus === 'RECHAZADO'}
                    maxLength={500}
                    placeholder={nextStatus === 'RECHAZADO' ? 'Por qué no procede…' : 'Qué revisaste…'}
                  />
                </Field>
                <Button
                  type="submit"
                  variant={nextStatus === 'RECHAZADO' ? 'danger' : 'primary'}
                  loading={sending === 'status'}
                  disabled={sending !== null || !nextStatus}
                >
                  {nextStatus === 'RECHAZADO' ? 'Rechazar reporte' : 'Guardar estado'}
                </Button>
              </form>
            )}
          </div>

          <div className="grid gap-3 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-medium text-ink-2">Riesgo</h2>
              <RiskMeter level={report.riskLevel} />
            </div>
            {canModerate && (
              <>
                <div role="radiogroup" aria-label="Nivel de riesgo" className="grid grid-cols-4 rounded-lg bg-sunk p-0.5">
                  {RISK_LEVELS.map((level) => {
                    const active = risk === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setRisk(level)}
                        className={cn(
                          'relative h-8 rounded-md text-xs transition-colors duration-150',
                          active ? 'font-medium text-ink' : 'text-muted hover:text-ink',
                        )}
                      >
                        {/* El pulgar se desliza entre opciones: es el mismo objeto, no cuatro fondos. */}
                        {active && (
                          <motion.span
                            layoutId="risk-thumb"
                            className="absolute inset-0 rounded-md bg-surface shadow-card"
                            transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
                          />
                        )}
                        <span className="relative flex items-center justify-center gap-1.5">
                          <span aria-hidden className="size-1.5 rounded-full" style={{ background: `var(--risk-${RISK_ORDER.indexOf(level)})` }} />
                          {RISK_LABEL[level]}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {risk !== report.riskLevel && RISK_LEVELS.includes(risk as never) && (
                  <Button className="arrive" loading={sending === 'risk'} disabled={sending !== null} onClick={() => send('risk', { riskLevel: risk })}>
                    Guardar como {RISK_LABEL[risk].toLowerCase()}
                  </Button>
                )}
              </>
            )}
          </div>

          {(report.reporter || extra) && (
            <div className="grid gap-3 p-4">
              <h2 className="text-[13px] font-medium text-ink-2">Denunciante</h2>
              {report.reporter ? (
                <div className="flex items-center gap-3">
                  <Avatar name={report.reporter.name} lastName={report.reporter.lastName} className="size-9" />
                  <span className="grid min-w-0 leading-snug">
                    <span className="truncate text-sm font-medium">
                      {report.reporter.name} {report.reporter.lastName}
                    </span>
                    {report.reporter.alias && (
                      <span className="truncate text-[13px] text-ink-2">@{report.reporter.alias}</span>
                    )}
                    <span className="truncate text-[13px] text-muted">{report.reporter.email}</span>
                  </span>
                </div>
              ) : (
                <p className="text-sm text-ink-2">{extra?.author.name}</p>
              )}
              {report.reporter?.country && <p className="text-[13px] text-muted">{report.reporter.country}</p>}
              {extra?.anonymous && (
                <p className="flex items-start gap-2 text-[13px] leading-relaxed text-muted">
                  <VenetianMask aria-hidden className="mt-0.5 size-4 shrink-0" />
                  Pidió publicarlo de forma anónima: la comunidad no ve su nombre.
                </p>
              )}
              {extra?.affectedPerson && (
                <div className="grid gap-0.5 rounded-lg bg-sunk p-3">
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <Lock aria-hidden className="size-3" />
                    Persona afectada · dato privado
                  </span>
                  <span className="text-sm font-medium">{extra.affectedPerson.name}</span>
                  <span className="font-mono text-xs text-ink-2">{extra.affectedPerson.contact}</span>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-2.5 p-4">
            <h2 className="text-[13px] font-medium text-ink-2">Expediente</h2>
            <p className="text-[13px] leading-relaxed text-muted">
              {exportable
                ? 'Archivo para la Policía Cibernética, con enlaces, evidencias con su huella e historial.'
                : 'Se puede descargar cuando el reporte esté validado o canalizado.'}
            </p>
            <Button loading={sending === 'export'} disabled={sending !== null || !exportable} onClick={handleExport}>
              <Download />
              Descargar expediente
            </Button>
          </div>
        </aside>
      </div>

      <Dialog.Root open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <Dialog.Portal>
          <Dialog.Backdrop className="backdrop fixed inset-0 z-50 bg-[#050a1c]/80" />
          <Dialog.Popup className="modal fixed inset-0 z-50 grid place-items-center p-6 outline-none" onClick={() => setPreview(null)}>
            <Dialog.Title className="sr-only">Evidencia</Dialog.Title>
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element -- el archivo vive en la API
              <img
                src={API_URL + preview}
                alt="Evidencia adjunta al reporte"
                className="max-h-full max-w-full rounded-lg object-contain shadow-pop"
                onClick={(event) => event.stopPropagation()}
              />
            )}
            <Dialog.Close
              aria-label="Cerrar"
              className="absolute top-4 right-4 grid size-9 place-items-center rounded-full bg-white/10 text-white transition-[background-color,transform] duration-150 hover:bg-white/20 active:scale-[0.97]"
            >
              <X className="size-4" />
            </Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

/** Dónde va el reporte en su camino. Informa; no se toca. */
function Pipeline({ status }: { status: string }) {
  const rejected = status === 'RECHAZADO';
  const current = PIPELINE.indexOf(status);
  return (
    <ol aria-label="Avance del reporte" className="mb-2 flex items-center gap-2 text-[13px]">
      {rejected ? (
        <li className="flex items-center gap-2 font-medium" style={{ color: STATUS_VAR.RECHAZADO }}>
          <span aria-hidden className="size-2 rounded-full bg-current" />
          Rechazado: el reporte no procedió
        </li>
      ) : (
        PIPELINE.map((step, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li key={step} aria-current={active ? 'step' : undefined} className="flex min-w-0 flex-1 items-center gap-2 last:flex-none">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full transition-colors duration-200"
                style={{ background: done || active ? STATUS_VAR[status] : 'var(--line-strong)' }}
              />
              <span className={cn('truncate', active ? 'font-medium text-ink' : done ? 'text-ink-2' : 'text-muted')}>
                {STATUS_LABEL[step]}
              </span>
              {index < PIPELINE.length - 1 && (
                <span aria-hidden className="relative h-px min-w-4 flex-1 bg-line-strong">
                  <span
                    className="absolute inset-0 origin-left transition-transform duration-300 ease-(--ease-in-out)"
                    style={{ background: STATUS_VAR[status], transform: `scaleX(${done ? 1 : 0})` }}
                  />
                </span>
              )}
            </li>
          );
        })
      )}
    </ol>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-6 first:border-0 first:pt-0">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-[13px] font-medium text-ink-2">{title}</h2>
        {note && <span className="text-xs text-muted">{note}</span>}
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tnum text-sm">{value}</dd>
    </div>
  );
}

function DefangedUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const safe = defang(url);
  return (
    <div className="flex items-center gap-2 rounded-lg bg-sunk py-1 pr-1 pl-3">
      <DomainText url={url} className="min-w-0 flex-1 text-[13px] break-all" />
      <Button
        variant="ghost"
        size="icon"
        aria-label={copied ? 'Copiado' : 'Copiar enlace desactivado'}
        onClick={() => {
          navigator.clipboard.writeText(safe).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          });
        }}
      >
        {/* El ícono cambia de uno a otro con un fundido: es el mismo botón diciendo "listo". */}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={copied ? 'ok' : 'copy'}
            initial={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
            className="grid"
          >
            {copied ? <Check className="text-ok" /> : <Copy />}
          </motion.span>
        </AnimatePresence>
      </Button>
    </div>
  );
}

function Loading() {
  return (
    <div aria-busy aria-label="Cargando reporte" className="grid gap-8">
      <div className="grid gap-3">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-8 w-3/5" />
        <Skeleton className="h-3.5 w-72" />
      </div>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid content-start gap-3">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-11/12" />
          <Skeleton className="h-3.5 w-4/5" />
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}
