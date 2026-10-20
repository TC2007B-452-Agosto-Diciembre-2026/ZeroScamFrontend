'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from '@base-ui/react/menu';
import NumberFlow from '@number-flow/react';
import { motion } from 'motion/react';
import { ChartNoAxesColumn, Check, ChevronsUpDown, Inbox, LogOut, Monitor, Moon, Search, Sun, Users } from 'lucide-react';
import { useTheme } from 'next-themes';
import { logout } from '@/lib/api';
import { isStaff, useSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import { Avatar } from './badges';
import { Brand } from './brand';
import { Kbd, Skeleton } from './ui/misc';

const NAV = [
  { href: '/', label: 'Reportes', icon: Inbox, staffOnly: false },
  { href: '/usuarios', label: 'Usuarios', icon: Users, staffOnly: true },
  { href: '/estadisticas', label: 'Estadísticas', icon: ChartNoAxesColumn, staffOnly: false },
];

const THEMES = [
  { value: 'system', label: 'Igual que el sistema', icon: Monitor },
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
];

function useNav() {
  const pathname = usePathname();
  const { me } = useSession();
  return NAV.filter((entry) => !entry.staffOnly || !me || isStaff(me)).map((entry) => ({
    ...entry,
    // El detalle de un reporte sigue perteneciendo a "Reportes".
    active: entry.href === '/' ? pathname === '/' || pathname.startsWith('/reportes') : pathname.startsWith(entry.href),
  }));
}

const menuItem =
  'flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-sm text-ink-2 outline-none data-[highlighted]:bg-ink/7 data-[highlighted]:text-ink [&_svg]:size-4 [&_svg]:text-muted';

function AccountMenu({ compact = false }: { compact?: boolean }) {
  const { me } = useSession();
  const { theme, setTheme } = useTheme();

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Cuenta y preferencias"
        className={cn(
          'flex select-none items-center gap-2.5 rounded-lg text-left outline-none transition-[background-color,transform] duration-150 hover:bg-ink/6 focus-visible:outline-3 focus-visible:outline-accent active:scale-[0.98] data-[popup-open]:bg-ink/6',
          compact ? 'p-1' : 'w-full p-2',
        )}
      >
        {me ? <Avatar name={me.name} lastName={me.lastName} /> : <Skeleton className="size-8 rounded-full" />}
        {!compact && (
          <>
            <span className="grid min-w-0 flex-1 leading-tight">
              {me ? (
                <>
                  <span className="truncate text-[13px] font-medium">
                    {me.name} {me.lastName}
                  </span>
                  <span className="truncate text-xs text-muted">{me.role === 'Policia' ? 'Policía' : me.role}</span>
                </>
              ) : (
                <>
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-1.5 h-2.5 w-16" />
                </>
              )}
            </span>
            <ChevronsUpDown aria-hidden className="size-3.5 shrink-0 text-muted" />
          </>
        )}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side={compact ? 'bottom' : 'top'} align={compact ? 'end' : 'start'} sideOffset={6} className="z-50 outline-none">
          <Menu.Popup className="pop w-60 rounded-xl bg-surface p-1 shadow-pop outline-none">
            {me && (
              <div className="px-2 pt-1.5 pb-2">
                <p className="truncate text-[13px] font-medium">
                  {me.name} {me.lastName}
                </p>
                <p className="truncate text-xs text-muted">{me.email}</p>
              </div>
            )}
            <Menu.Separator className="mx-1 my-1 h-px bg-line" />
            <Menu.Group>
              <Menu.GroupLabel className="px-2 pt-1.5 pb-1 text-xs text-muted">Tema</Menu.GroupLabel>
              <Menu.RadioGroup value={theme} onValueChange={(value) => setTheme(String(value))}>
                {THEMES.map(({ value, label, icon: Icon }) => (
                  <Menu.RadioItem key={value} value={value} closeOnClick={false} className={menuItem}>
                    <Icon />
                    <span className="flex-1">{label}</span>
                    <Menu.RadioItemIndicator>
                      <Check className="!text-ink" />
                    </Menu.RadioItemIndicator>
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            </Menu.Group>
            <Menu.Separator className="mx-1 my-1 h-px bg-line" />
            <Menu.Item className={menuItem} onClick={logout}>
              <LogOut />
              Cerrar sesión
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const nav = useNav();
  const { pending, openCommand } = useSession();

  return (
    <div className="min-h-dvh lg:pl-60">
      {/* La barra lateral es el escenario del login: azul profundo en los dos
          temas. `dark` hace que todo lo de adentro use los tonos oscuros. */}
      <aside className="dark abyss fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-white/[0.06] text-ink lg:flex">
        <Link href="/" className="mx-2 mt-3 flex h-10 items-center rounded-lg px-2 outline-none focus-visible:outline-3 focus-visible:outline-accent">
          <Brand />
        </Link>

        <div className="px-2 pt-3">
          <button
            type="button"
            onClick={openCommand}
            className="flex h-8 w-full items-center gap-2 rounded-lg bg-white/[0.06] px-2.5 text-[13px] text-muted shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)] transition-[transform,color,background-color] duration-150 hover:bg-white/[0.09] hover:text-ink active:scale-[0.98]"
          >
            <Search aria-hidden className="size-3.5" />
            <span className="flex-1 text-left">Buscar…</span>
            <Kbd>⌘K</Kbd>
          </button>
        </div>

        <nav aria-label="Secciones" className="grid gap-0.5 px-2 pt-4">
          {nav.map(({ href, label, icon: Icon, active }) => (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm outline-none transition-colors duration-150 focus-visible:outline-3 focus-visible:outline-accent',
                active ? 'font-semibold text-ink' : 'text-ink-2 hover:bg-white/[0.04] hover:text-ink',
              )}
            >
              {/* El fondo de la sección activa viaja a la nueva, con el mismo
                  resorte que el foco de las casillas del código en el login. */}
              {active && (
                <motion.span
                  layoutId="nav-active"
                  aria-hidden
                  className="absolute inset-0 rounded-lg bg-white/[0.08] shadow-[inset_2px_0_0_var(--accent)]"
                  transition={{ type: 'spring', stiffness: 550, damping: 38 }}
                />
              )}
              <Icon
                aria-hidden
                className={cn('relative size-4', active ? 'text-accent' : 'text-muted')}
                strokeWidth={active ? 2.25 : 2}
              />
              <span className="relative flex-1">{label}</span>
              {href === '/' && pending !== null && pending > 0 && (
                <NumberFlow
                  value={pending}
                  aria-label={`${pending} por revisar`}
                  className="relative rounded-full bg-accent px-1.5 text-xs font-semibold text-on-accent"
                />
              )}
            </Link>
          ))}
        </nav>

        <div className="mt-auto border-t border-white/8 p-2">
          <AccountMenu />
        </div>
      </aside>

      {/* En pantallas angostas la barra lateral se vuelve una franja superior. */}
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md lg:hidden">
        <div className="flex h-12 items-center justify-between px-4">
          <Link href="/">
            <Brand />
          </Link>
          <span className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Buscar"
              onClick={openCommand}
              className="grid size-9 place-items-center rounded-lg text-ink-2 transition-transform duration-150 active:scale-[0.97]"
            >
              <Search className="size-4" />
            </button>
            <AccountMenu compact />
          </span>
        </div>
        <nav aria-label="Secciones" className="flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
          {nav.map(({ href, label, active }) => (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-8 shrink-0 items-center rounded-lg px-3 text-sm',
                active ? 'bg-ink/8 font-medium text-ink' : 'text-ink-2',
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="page-flow mx-auto w-full max-w-[72rem] px-4 pt-6 pb-24 sm:px-8 lg:px-10 lg:pt-10">{children}</main>
    </div>
  );
}

/** Encabezado de página: el título dice dónde estás; al lado, lo que puedes hacer. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="grid gap-1">
        <h1 className="text-[1.875rem] leading-[1.1] font-bold tracking-[-0.025em]">{title}</h1>
        {description && <p className="max-w-[65ch] text-[15px] text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
