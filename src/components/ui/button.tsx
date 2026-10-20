import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  // Mismo lenguaje que el botón del login: los que tienen relieve se hunden
  // sobre su sombra al presionar; los planos se encogen (0.97).
  'group relative inline-flex shrink-0 select-none items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-[9px] font-semibold transition-[transform,background-color,box-shadow,color,filter] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // Ámbar: la acción principal de la pantalla, una sola. Con relieve y
        // el brillo que la cruza al pasar el puntero, como en el login.
        primary:
          'bg-accent text-on-accent shadow-[0_2px_0_var(--accent-ink)] enabled:hover:brightness-[1.03] enabled:active:translate-y-0.5 enabled:active:shadow-none',
        solid:
          'bg-ink text-bg shadow-[0_2px_0_rgb(0_0_0/0.35)] enabled:hover:bg-ink/90 enabled:active:translate-y-0.5 enabled:active:shadow-none',
        outline:
          'bg-surface text-ink shadow-[var(--ring),0_2px_0_var(--line-strong)] enabled:hover:bg-sunk enabled:active:translate-y-0.5 enabled:active:shadow-[var(--ring)]',
        ghost: 'text-ink-2 enabled:hover:bg-ink/6 enabled:hover:text-ink enabled:active:scale-[0.97]',
        danger:
          'bg-danger-wash text-danger enabled:hover:bg-danger enabled:hover:text-white enabled:active:scale-[0.97] dark:enabled:hover:text-bg',
      },
      size: {
        sm: 'h-8 px-2.5 text-[13px]',
        md: 'h-9 px-3.5 text-sm',
        lg: 'h-11 px-5 text-[15px]',
        icon: 'size-8',
      },
    },
    defaultVariants: { variant: 'outline', size: 'md' },
  },
);

export function Button({
  className,
  variant,
  size,
  loading = false,
  disabled,
  children,
  ...props
}: ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { loading?: boolean }) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {variant === 'primary' && <span aria-hidden className="sheen" />}
      {/* La etiqueta conserva su lugar mientras carga: el botón no cambia de ancho. */}
      <span className={cn('relative inline-flex items-center gap-1.5 transition-opacity duration-150', loading && 'opacity-0')}>
        {children}
      </span>
      {loading && <LoaderCircle aria-hidden className="spinner absolute" />}
    </button>
  );
}
