'use client';

import { useId } from 'react';
import NumberFlow from '@/components/number-flow';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { label as readable, number, RISK_ORDER } from '@/lib/format';
import { cn } from '@/lib/utils';

export type Count = { name: string; count: number };

/** `2026-10` → "oct 26". */
function month(name: string, long = false): string {
  if (!/^\d{4}-\d{2}$/.test(name)) return name;
  const [year, m] = name.split('-').map(Number);
  return new Date(year, m - 1, 1)
    .toLocaleDateString('es-MX', long ? { month: 'long', year: 'numeric' } : { month: 'short', year: '2-digit' })
    .replace('.', '');
}

/**
 * Completa los meses sin registros con cero y muestra al menos los últimos
 * seis: una serie con huecos (o con un solo punto) no deja ver la tendencia.
 */
function fillMonths(counts: Count[]): Count[] {
  const known = new Map(counts.filter((c) => /^\d{4}-\d{2}$/.test(c.name)).map((c) => [c.name, c.count]));
  if (known.size === 0) return counts;
  const index = (name: string) => Number(name.slice(0, 4)) * 12 + Number(name.slice(5, 7)) - 1;
  const names = [...known.keys()].sort();
  const last = index(names[names.length - 1]);
  const first = Math.min(index(names[0]), last - 5);
  return Array.from({ length: last - first + 1 }, (_, i) => {
    const n = first + i;
    const name = `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`;
    return { name, count: known.get(name) ?? 0 };
  });
}

/** Marco de una gráfica: título, total y, plegada, la misma información en tabla. */
export function ChartFrame({
  title,
  total,
  children,
  table,
  className,
}: {
  title: string;
  total?: number;
  children: React.ReactNode;
  table?: { label: string; value: number }[];
  className?: string;
}) {
  return (
    <section className={cn('flex flex-col rounded-xl bg-surface shadow-card', className)}>
      <header className="flex items-baseline justify-between gap-4 px-4 pt-4">
        <h3 className="text-sm font-medium">{title}</h3>
        {total !== undefined && (
          <span className="text-[13px] text-muted">
            <NumberFlow value={total} locales="es-MX" /> en total
          </span>
        )}
      </header>
      <div className="flex-1 px-4 pt-3 pb-4">{children}</div>
      {table && table.length > 0 && (
        <details className="group border-t border-line px-4 py-2.5">
          <summary className="cursor-pointer list-none text-xs text-muted select-none hover:text-ink [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Ver como tabla</span>
            <span className="hidden group-open:inline">Ocultar tabla</span>
          </summary>
          <table className="mt-2 w-full text-[13px]">
            <tbody>
              {table.map((row) => (
                <tr key={row.label} className="border-t border-line first:border-0">
                  <th scope="row" className="py-1 text-left font-normal text-ink-2">
                    {row.label}
                  </th>
                  <td className="tnum py-1 text-right">{number.format(row.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}

const empty = <p className="py-6 text-center text-[13px] text-muted">Sin datos en este periodo.</p>;

/**
 * Serie por mes como área. Una sola serie: no lleva leyenda (el título la
 * nombra). Al pasar el cursor, una guía vertical y la cifra exacta.
 */
export function TrendChart({ title, counts }: { title: string; counts: Count[] }) {
  const gradient = useId();
  const data = fillMonths(counts).map((c) => ({ ...c, label: month(c.name), full: month(c.name, true) }));
  const total = data.reduce((sum, d) => sum + d.count, 0);
  return (
    <ChartFrame title={title} total={total} table={data.map((d) => ({ label: d.full, value: d.count }))}>
      {total === 0 ? (
        empty
      ) : (
        <div role="img" aria-label={`${title}: ${data.map((d) => `${d.full}, ${d.count}`).join('; ')}`}>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--muted)', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: 'var(--muted)', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={28}
                tickCount={4}
              />
              <Tooltip
                cursor={{ stroke: 'var(--line-strong)', strokeWidth: 1 }}
                isAnimationActive={false}
                content={({ active, payload }) =>
                  active && payload?.[0] ? (
                    <div className="rounded-lg bg-ink px-2.5 py-1.5 text-xs text-bg shadow-pop">
                      <p className="opacity-70">{payload[0].payload.full}</p>
                      <p className="tnum text-sm font-medium">{number.format(Number(payload[0].value))}</p>
                    </div>
                  ) : null
                }
              />
              <Area
                type="monotoneX"
                dataKey="count"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill={`url(#${gradient})`}
                dot={data.length <= 12 ? { r: 3, fill: 'var(--surface)', stroke: 'var(--chart-1)', strokeWidth: 2 } : false}
                activeDot={{ r: 4, fill: 'var(--chart-1)', stroke: 'var(--surface)', strokeWidth: 2 }}
                animationDuration={500}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartFrame>
  );
}

/**
 * Categorías ordenadas de mayor a menor como barras finas con su cifra y su
 * parte del total. Es una lista con barras, no un lienzo: se lee y se copia.
 */
export function RankChart({
  title,
  counts,
  kind = 'categories',
}: {
  title: string;
  counts: Count[];
  kind?: 'categories' | 'risk';
}) {
  const data =
    kind === 'risk'
      ? [...counts].sort((a, b) => RISK_ORDER.indexOf(a.name) - RISK_ORDER.indexOf(b.name))
      : [...counts].sort((a, b) => b.count - a.count);
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ChartFrame title={title} total={total}>
      {data.length === 0 ? (
        empty
      ) : (
        <ul className="grid gap-2.5">
          {data.map((item) => {
            const share = total > 0 ? Math.round((item.count / total) * 100) : 0;
            const color =
              kind === 'risk' ? `var(--risk-${Math.max(0, RISK_ORDER.indexOf(item.name))})` : 'var(--chart-1)';
            return (
              <li key={item.name} className="grid gap-1">
                <span className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="truncate text-ink-2">{readable(item.name)}</span>
                  <span className="tnum shrink-0">
                    <span className="font-medium">{number.format(item.count)}</span>
                    <span className="ml-1.5 inline-block w-11 text-right whitespace-nowrap text-muted">{share} %</span>
                  </span>
                </span>
                <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-ink/6">
                  {/* La barra crece una vez, desde su base, con la misma curva que el resto del panel. */}
                  <span
                    className="bar block h-full origin-left rounded-full"
                    style={{ width: `${(item.count / max) * 100}%`, background: color }}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </ChartFrame>
  );
}

/** Partes de un todo en una sola barra, con su leyenda siempre a la vista. */
export function ShareChart({
  title,
  counts,
  colors,
}: {
  title: string;
  counts: Count[];
  colors: Record<string, string>;
}) {
  const total = counts.reduce((sum, c) => sum + c.count, 0);
  const order = Object.keys(colors);
  const data = [...counts].sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  return (
    <ChartFrame title={title} total={total}>
      {total === 0 ? (
        empty
      ) : (
        <>
          <div aria-hidden className="bar flex h-2.5 origin-left gap-0.5 overflow-hidden rounded-full">
            {data
              .filter((c) => c.count > 0)
              .map((c) => (
                <span
                  key={c.name}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  style={{ flexGrow: c.count, background: colors[c.name] ?? 'var(--muted)' }}
                />
              ))}
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            {data.map((c) => (
              <li key={c.name} className="grid gap-0.5">
                <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
                  <span aria-hidden className="size-2 rounded-full" style={{ background: colors[c.name] ?? 'var(--muted)' }} />
                  {readable(c.name)}
                </span>
                <span className="tnum pl-3.5 text-sm">
                  <span className="font-medium">{number.format(c.count)}</span>
                  <span className="ml-1.5 text-muted">{Math.round((c.count / total) * 100)} %</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </ChartFrame>
  );
}
