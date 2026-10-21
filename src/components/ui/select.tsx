'use client';

import { Select as Base } from '@base-ui/react/select';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Option = { value: string; label: string };

/** Selector. "Todos" es la opción `ALL`: un valor vacío no se puede elegir. */
export function Select({
  value,
  onValueChange,
  options,
  disabled,
  className,
  size = 'md',
  'aria-label': ariaLabel,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md';
  'aria-label'?: string;
}) {
  return (
    <Base.Root
      items={options}
      value={value}
      onValueChange={(next) => next !== null && onValueChange(next as string)}
      disabled={disabled}
    >
      <Base.Trigger
        aria-label={ariaLabel}
        className={cn(
          'group inline-flex w-full select-none items-center justify-between gap-2 rounded-[9px] border border-line-strong bg-surface pr-2 pl-3 text-ink transition-[border-color,box-shadow,transform] duration-200 ease-out hover:border-field focus-visible:border-ink focus-visible:shadow-[0_0_0_3px_var(--accent)] focus-visible:outline-none enabled:active:scale-[0.98] data-[disabled]:opacity-50 data-[popup-open]:border-ink data-[popup-open]:shadow-[0_0_0_3px_var(--accent)]',
          size === 'sm' ? 'h-8 text-[13px]' : 'h-9 text-sm',
          className,
        )}
      >
        <Base.Value className="truncate" />
        <Base.Icon className="text-muted transition-colors group-hover:text-ink">
          <ChevronsUpDown className="size-3.5" />
        </Base.Icon>
      </Base.Trigger>
      <Base.Portal>
        <Base.Positioner sideOffset={6} alignItemWithTrigger={false} className="z-50 outline-none">
          <Base.Popup className="pop max-h-72 min-w-[var(--anchor-width)] overflow-y-auto overscroll-contain rounded-xl bg-surface p-1 shadow-pop outline-none">
            {options.map((option) => (
              <Base.Item
                key={option.value}
                value={option.value}
                className="grid h-8 cursor-default select-none grid-cols-[1rem_1fr] items-center gap-2 rounded-md pr-3 pl-2 text-sm text-ink outline-none data-[highlighted]:bg-ink/7"
              >
                <Base.ItemIndicator className="col-start-1">
                  <Check className="size-3.5" />
                </Base.ItemIndicator>
                <Base.ItemText className="col-start-2">{option.label}</Base.ItemText>
              </Base.Item>
            ))}
          </Base.Popup>
        </Base.Positioner>
      </Base.Portal>
    </Base.Root>
  );
}
