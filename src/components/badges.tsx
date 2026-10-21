import { RISK_LABEL, RISK_ORDER, STATUS_LABEL } from '@/lib/format';
import { cn } from '@/lib/utils';

export const STATUS_VAR: Record<string, string> = {
  RECIBIDO: 'var(--st-recibido)',
  EN_REVISION: 'var(--st-revision)',
  VALIDADO: 'var(--st-validado)',
  RECHAZADO: 'var(--st-rechazado)',
  CANALIZADO: 'var(--st-canalizado)',
  ACTIVO: 'var(--st-validado)',
  SUSPENDIDO: 'var(--st-rechazado)',
  ELIMINADA: 'var(--muted)',
};

/** Estado: punto de color más texto (el color nunca va solo). */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const color = STATUS_VAR[status] ?? 'var(--muted)';
  return (
    <span
      className={cn('inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap', className)}
      style={{ color, background: `color-mix(in oklab, ${color} 12%, transparent)` }}
    >
      <span aria-hidden className="size-1.5 rounded-full" style={{ background: color }} />
      {STATUS_LABEL[status] ?? status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

/**
 * Riesgo como medidor de cuatro segmentos: se lee de un vistazo en una tabla
 * y no depende solo del color (cuántos segmentos van llenos también cuenta).
 */
export function RiskMeter({ level, className }: { level: string; className?: string }) {
  const step = Math.max(0, RISK_ORDER.indexOf(level));
  return (
    <span className={cn('inline-flex items-center gap-2 whitespace-nowrap', className)}>
      <span aria-hidden className="flex gap-0.5">
        {[1, 2, 3, 4].map((n) => (
          <span
            key={n}
            className="h-3 w-1 rounded-full"
            style={{ background: n <= step ? `var(--risk-${step})` : 'color-mix(in oklab, var(--ink) 12%, transparent)' }}
          />
        ))}
      </span>
      <span className={cn('text-[13px]', step === 0 ? 'text-muted' : 'text-ink-2')}>{RISK_LABEL[level] ?? level}</span>
    </span>
  );
}

export function RoleBadge({ role }: { role: string }) {
  return (
    <span className="inline-flex h-[22px] items-center rounded-md bg-ink/6 px-2 text-xs font-medium text-ink-2">
      {role === 'Policia' ? 'Policía' : role}
    </span>
  );
}

export function Avatar({ name, lastName = '', muted = false, className }: { name: string; lastName?: string; muted?: boolean; className?: string }) {
  const initials = ((name[0] ?? '') + (lastName[0] ?? name[1] ?? '')).toUpperCase();
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-full text-xs font-medium',
        muted ? 'bg-ink/5 text-muted' : 'bg-ink/8 text-ink-2',
        className,
      )}
    >
      {initials}
    </span>
  );
}
