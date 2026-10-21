'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@base-ui/react/dialog';
import { Command } from 'cmdk';
import { ChartNoAxesColumn, FileText, Inbox, LogOut, Monitor, Moon, Search, Sun, Users } from 'lucide-react';
import { useTheme } from 'next-themes';
import { api, logout } from '@/lib/api';
import { folio, STATUS_LABEL } from '@/lib/format';
import { isStaff, useMe } from '@/lib/session';
import { Kbd } from './ui/misc';

type Report = { id: number; fraudType: string; status: string; description: string; createdAt: string };

const item =
  'flex h-9 cursor-default select-none items-center gap-2.5 rounded-md px-2 text-sm text-ink-2 outline-none data-[selected=true]:bg-ink/7 data-[selected=true]:text-ink [&_svg]:size-4 [&_svg]:text-muted';

/**
 * Paleta de comandos (⌘K). Se abre y se cierra sin animación: es una acción de
 * teclado que se repite todo el día, y cualquier espera se nota.
 */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const me = useMe();
  const { setTheme } = useTheme();
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    if (!open) return;
    api
      .get<Report[]>('/reports')
      .then(({ data }) => setReports(data))
      .catch(() => undefined);
  }, [open]);

  function run(action: () => void) {
    onOpenChange(false);
    action();
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-[#050a1c]/40" />
        <Dialog.Popup
          aria-label="Paleta de comandos"
          className="fixed top-[18vh] left-1/2 z-50 w-[min(92vw,36rem)] -translate-x-1/2 overflow-hidden rounded-2xl bg-surface shadow-pop outline-none"
        >
          <Command label="Paleta de comandos" loop>
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <Search aria-hidden className="size-4 text-muted" />
              <Command.Input
                autoFocus
                placeholder="Busca un reporte por folio o texto, o escribe una acción…"
                className="h-12 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
              />
              <Kbd>esc</Kbd>
            </div>
            <Command.List className="max-h-[min(50vh,24rem)] overflow-y-auto overscroll-contain p-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted">
              <Command.Empty className="px-2 py-8 text-center text-sm text-muted">Nada coincide.</Command.Empty>

              <Command.Group heading="Ir a">
                <Command.Item className={item} onSelect={() => run(() => router.push('/'))}>
                  <Inbox /> Reportes
                </Command.Item>
                {isStaff(me) && (
                  <Command.Item className={item} onSelect={() => run(() => router.push('/usuarios'))}>
                    <Users /> Usuarios
                  </Command.Item>
                )}
                <Command.Item className={item} onSelect={() => run(() => router.push('/estadisticas'))}>
                  <ChartNoAxesColumn /> Estadísticas
                </Command.Item>
              </Command.Group>

              {reports.length > 0 && (
                <Command.Group heading="Reportes">
                  {reports.slice(0, 50).map((report) => (
                    <Command.Item
                      key={report.id}
                      value={`${folio(report.id, report.createdAt)} ${report.fraudType} ${report.description}`}
                      className={item}
                      onSelect={() => run(() => router.push(`/reportes/${report.id}`))}
                    >
                      <FileText />
                      <span className="font-mono text-xs text-muted">{folio(report.id, report.createdAt)}</span>
                      <span className="min-w-0 flex-1 truncate">{report.description}</span>
                      <span className="shrink-0 text-xs text-muted">{STATUS_LABEL[report.status] ?? report.status}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              <Command.Group heading="Tema">
                <Command.Item className={item} onSelect={() => run(() => setTheme('system'))}>
                  <Monitor /> Igual que el sistema
                </Command.Item>
                <Command.Item className={item} onSelect={() => run(() => setTheme('light'))}>
                  <Sun /> Claro
                </Command.Item>
                <Command.Item className={item} onSelect={() => run(() => setTheme('dark'))}>
                  <Moon /> Oscuro
                </Command.Item>
              </Command.Group>

              <Command.Group heading="Sesión">
                <Command.Item className={item} onSelect={() => run(logout)}>
                  <LogOut /> Cerrar sesión
                </Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
