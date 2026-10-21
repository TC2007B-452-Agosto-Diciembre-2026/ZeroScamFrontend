import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div aria-hidden className={cn('skeleton rounded-md', className)} {...props} />;
}

/** Estado vacío o de error de una lista: qué pasó y cómo se sale. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = 'neutral',
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <div role={tone === 'danger' ? 'alert' : undefined} className="flex flex-col items-center gap-1.5 px-6 py-16 text-center">
      <div className={cn('mb-2 [&_svg]:size-5', tone === 'danger' ? 'text-danger' : 'text-muted')}>{icon}</div>
      <p className="text-[15px] font-semibold">{title}</p>
      {description && <p className="max-w-xs text-[13px] text-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function InlineAlert({ children, tone = 'danger' }: { children: React.ReactNode; tone?: 'danger' | 'ok' }) {
  return (
    <p
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'rounded-lg px-3 py-2 text-[13px]',
        tone === 'danger' ? 'bg-danger-wash text-danger' : 'bg-ok/10 text-ok',
      )}
    >
      {children}
    </p>
  );
}

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] bg-ink/6 px-1 font-mono text-[11px] font-medium text-muted',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
