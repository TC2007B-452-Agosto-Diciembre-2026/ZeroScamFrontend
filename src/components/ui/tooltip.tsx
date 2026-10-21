'use client';

import { Tooltip as Base } from '@base-ui/react/tooltip';

export const TooltipProvider = Base.Provider;

/**
 * Tooltip. El primero espera un momento; con uno ya abierto, los vecinos
 * abren al instante y sin animación (`data-instant`).
 */
export function Tooltip({
  label,
  shortcut,
  side = 'top',
  children,
}: {
  label: string;
  shortcut?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  children: React.ReactElement<Record<string, unknown>>;
}) {
  return (
    <Base.Root>
      <Base.Trigger render={children} />
      <Base.Portal>
        <Base.Positioner side={side} sideOffset={8} className="z-50">
          <Base.Popup className="pop flex items-center gap-2 rounded-md bg-ink px-2 py-1 text-xs font-medium text-bg shadow-pop [transition-duration:125ms]">
            {label}
            {shortcut && <kbd className="font-mono text-[11px] opacity-60">{shortcut}</kbd>}
          </Base.Popup>
        </Base.Positioner>
      </Base.Portal>
    </Base.Root>
  );
}
