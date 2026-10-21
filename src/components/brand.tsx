import { cn } from '@/lib/utils';

/** El cero tachado: "cero fraude". Geometría pura, hereda el color del texto. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn('size-6', className)} fill="none">
      <ellipse cx="12" cy="12" rx="6" ry="8.5" stroke="currentColor" strokeWidth="2" />
      <path d="M5.5 19.5 18.5 4.5" stroke="var(--accent)" strokeWidth="2.25" strokeLinecap="round" />
    </svg>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <BrandMark />
      <span className="text-[15px] font-semibold tracking-[-0.02em]">ZeroScam</span>
    </span>
  );
}
