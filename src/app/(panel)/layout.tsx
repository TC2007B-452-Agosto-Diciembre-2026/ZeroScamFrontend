'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { CommandPalette } from '@/components/command-palette';
import { api, getAccessToken } from '@/lib/api';
import { SessionContext, type Me } from '@/lib/session';

type Count = { name: string; count: number };

/**
 * Todo lo que va detrás del login: comprueba que haya sesión, carga la cuenta
 * una sola vez y mantiene la cuenta de reportes pendientes de la barra lateral.
 */
export default function PanelLayout({ children }: LayoutProps<'/'>) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el token vive en localStorage: solo se conoce en el navegador
    setReady(true);
    // Sin perfil o sin cuenta el panel sigue sirviendo; un 401 ya lo atiende `api`.
    api
      .get<Me>('/users/me')
      .then(({ data }) => setMe(data))
      .catch(() => undefined);
    api
      .get<{ byStatus: Count[] }>('/stats')
      .then(({ data }) => {
        const of = (name: string) => data.byStatus.find((c) => c.name === name)?.count ?? 0;
        setPending(of('RECIBIDO') + of('EN_REVISION'));
      })
      .catch(() => undefined);
  }, [router]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openCommand = useCallback(() => setCommandOpen(true), []);
  const session = useMemo(() => ({ me, pending, setPending, openCommand }), [me, pending, openCommand]);

  if (!ready) return null;

  return (
    <SessionContext.Provider value={session}>
      <AppShell>{children}</AppShell>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </SessionContext.Provider>
  );
}
