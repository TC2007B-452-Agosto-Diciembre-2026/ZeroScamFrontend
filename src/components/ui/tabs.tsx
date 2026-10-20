'use client';

import { Tabs as Base } from '@base-ui/react/tabs';
import NumberFlow from '@number-flow/react';
import { cn } from '@/lib/utils';

export type TabItem = { value: string; label: string; count?: number; dot?: string };

/**
 * Pestañas de filtro con subrayado que se desliza a la activa. El indicador
 * se mueve con CSS (no con JS) para que no pierda cuadros mientras carga la lista.
 */
export function FilterTabs({
  value,
  onValueChange,
  items,
  'aria-label': ariaLabel,
}: {
  value: string;
  onValueChange: (value: string) => void;
  items: TabItem[];
  'aria-label': string;
}) {
  return (
    <Base.Root value={value} onValueChange={(next) => onValueChange(String(next))}>
      <Base.List
        aria-label={ariaLabel}
        className="relative flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]"
      >
        {items.map((item) => (
          <Base.Tab
            key={item.value}
            value={item.value}
            className="group flex h-10 shrink-0 select-none items-center gap-2 px-2.5 text-sm text-muted outline-none transition-colors duration-150 hover:text-ink focus-visible:rounded-md focus-visible:outline-3 focus-visible:outline-accent data-[active]:font-medium data-[active]:text-ink"
          >
            {item.dot && <span aria-hidden className="size-1.5 rounded-full" style={{ background: item.dot }} />}
            {item.label}
            {item.count !== undefined && (
              <NumberFlow
                value={item.count}
                className={cn(
                  'rounded-full px-1.5 text-xs transition-colors duration-150',
                  'bg-ink/6 text-muted group-data-[active]:bg-ink group-data-[active]:text-bg',
                )}
              />
            )}
          </Base.Tab>
        ))}
        <Base.Indicator className="absolute bottom-0 left-0 h-0.5 w-(--active-tab-width) translate-x-(--active-tab-left) rounded-full bg-ink transition-[translate,width] duration-250 ease-(--ease-in-out)" />
      </Base.List>
    </Base.Root>
  );
}
