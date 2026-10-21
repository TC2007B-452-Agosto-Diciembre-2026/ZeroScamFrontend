'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, SearchX, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/app-shell';
import { Avatar, RoleBadge, StatusBadge } from '@/components/badges';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/field';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { api, errorMessage } from '@/lib/api';
import { formatDate, number } from '@/lib/format';
import { useMe } from '@/lib/session';
import { cn } from '@/lib/utils';

type User = {
  id: string;
  name: string;
  lastName: string;
  /** Nombre de usuario que la persona edita en la app. */
  alias?: string;
  country: string;
  email: string;
  role: string;
  accountStatus: string;
  createdAt: string;
};

type Filters = { q?: string; role?: string; accountStatus?: string };

/** Un cambio que espera confirmación: qué se manda y cómo se le explica a quien lo hace. */
type Pending = {
  user: User;
  changes: Partial<User>;
  title: string;
  description: string;
  confirmLabel: string;
  tone: 'primary' | 'danger';
  done: string;
};

const roleLabel = (role: string) => (role === 'Policia' ? 'Policía' : role);
const ROLE_OPTIONS = ['Usuario', 'Administrador', 'Policia', 'Owner'].map((role) => ({ value: role, label: roleLabel(role) }));

const COLUMNS = 'md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_9.5rem_6.5rem_6.5rem]';

export default function UsersPage() {
  const me = useMe();
  const isOwner = me?.role === 'Owner';
  const [users, setUsers] = useState<User[] | null>(null);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('ALL');
  const [accountStatus, setAccountStatus] = useState('ALL');
  const [filters, setFilters] = useState<Filters>({});
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  // El cambio pendiente se conserva mientras el diálogo se cierra, para que su
  // texto no desaparezca a media animación.
  const [pending, setPendingChange] = useState<Pending | null>(null);
  const [confirming, setConfirming] = useState(false);
  const setPending = (change: Pending) => {
    setPendingChange(change);
    setConfirming(true);
  };

  const load = useCallback(() => {
    return api
      .get<User[]>('/users', { params: filters })
      .then(({ data }) => {
        setUsers(data);
        setError('');
      })
      .catch((e) => setError(errorMessage(e)));
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  // Un alias o nombre cambiado desde la app se ve al regresar a la pestaña.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') load();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  // El texto espera a que se deje de escribir; los selectores aplican al momento.
  // Un filtro vacío no se manda: el servidor rechaza `role=` sin valor.
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setFilters({
          q: query.trim() || undefined,
          role: role === 'ALL' ? undefined : role,
          accountStatus: accountStatus === 'ALL' ? undefined : accountStatus,
        }),
      query ? 250 : 0,
    );
    return () => clearTimeout(timer);
  }, [query, role, accountStatus]);

  async function update({ user, changes, done }: Pending) {
    setSending(true);
    try {
      await api.patch<User>(`/users/${user.id}`, changes);
      toast.success(done);
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
    setSending(false);
  }

  const filtered = Boolean(filters.q || filters.role || filters.accountStatus);

  return (
    <>
      <PageHeader
        title="Usuarios"
        description={
          isOwner || !me
            ? 'Quién puede moderar, quién consulta y quién quedó suspendido.'
            : 'Quién puede moderar, quién consulta y quién quedó suspendido. Solo el Owner cambia roles.'
        }
      />

      <div className="flex flex-wrap items-center gap-2 pb-3">
        <div className="relative min-w-56 flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre, alias o correo…"
            aria-label="Buscar usuarios"
            className="pl-9 [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
        <Select
          aria-label="Filtrar por rol"
          value={role}
          onValueChange={setRole}
          className="w-40"
          options={[{ value: 'ALL', label: 'Cualquier rol' }, ...ROLE_OPTIONS]}
        />
        <Select
          aria-label="Filtrar por estado de la cuenta"
          value={accountStatus}
          onValueChange={setAccountStatus}
          className="w-40"
          options={[
            { value: 'ALL', label: 'Cualquier estado' },
            { value: 'ACTIVO', label: 'Activas' },
            { value: 'SUSPENDIDO', label: 'Suspendidas' },
          ]}
        />
      </div>

      <div className="overflow-hidden rounded-xl bg-surface shadow-card">
        <div className={cn('hidden items-center gap-4 border-b border-line px-4 py-2 text-xs text-muted md:grid', COLUMNS)}>
          <span>Cuenta</span>
          <span>País y alta</span>
          <span>Rol</span>
          <span>Estado</span>
          <span />
        </div>

        {error && (
          <EmptyState
            tone="danger"
            icon={<TriangleAlert />}
            title="No se pudieron cargar las cuentas"
            description={error}
            action={<Button onClick={() => load()}>Reintentar</Button>}
          />
        )}

        {!error && !users && (
          <ul aria-busy aria-label="Cargando cuentas">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
                <Skeleton className="size-8 rounded-full" />
                <span className="grid flex-1 gap-2">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-56" />
                </span>
              </li>
            ))}
          </ul>
        )}

        {!error && users?.length === 0 && (
          <EmptyState
            icon={<SearchX />}
            title="Ninguna cuenta coincide"
            action={
              filtered ? (
                <Button
                  onClick={() => {
                    setQuery('');
                    setRole('ALL');
                    setAccountStatus('ALL');
                  }}
                >
                  Quitar filtros
                </Button>
              ) : undefined
            }
          />
        )}

        {!error && users && users.length > 0 && (
          <ul className="stagger">
            {users.map((user) => {
              const self = user.id === me?.id;
              const active = user.accountStatus === 'ACTIVO';
              const deleted = user.accountStatus === 'ELIMINADA';
              const fullName = `${user.name} ${user.lastName}`;
              return (
                <li
                  key={user.id}
                  className={cn('grid items-center gap-x-4 gap-y-2.5 border-b border-line px-4 py-2.5 last:border-0', COLUMNS)}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar name={user.name} lastName={user.lastName} muted={!active} />
                    <span className="grid min-w-0 leading-snug">
                      <span className={cn('flex items-center gap-2 text-sm font-medium', !active && 'text-muted')}>
                        <span className="truncate">{fullName}</span>
                        {self && <span className="shrink-0 rounded bg-accent-wash px-1 text-[11px] text-accent-ink">Tú</span>}
                      </span>
                      <span className="truncate text-[13px] text-muted">
                        {user.alias && !deleted && <span className="text-ink-2">@{user.alias} · </span>}
                        {user.email}
                      </span>
                    </span>
                  </span>

                  <span className="grid text-[13px] leading-snug">
                    <span className="text-ink-2">{user.country || '—'}</span>
                    <time dateTime={user.createdAt} className="tnum text-muted">
                      {formatDate(user.createdAt)}
                    </time>
                  </span>

                  {isOwner && !self && !deleted ? (
                    <Select
                      aria-label={`Rol de ${fullName}`}
                      size="sm"
                      value={user.role}
                      disabled={sending}
                      options={ROLE_OPTIONS}
                      onValueChange={(value) =>
                        value !== user.role &&
                        setPending({
                          user,
                          changes: { role: value },
                          title: `¿Hacer ${roleLabel(value)} a ${user.name}?`,
                          description:
                            value === 'Usuario'
                              ? `${fullName} dejará de tener acceso a este panel.`
                              : `${fullName} tendrá los permisos de ${roleLabel(value)} la próxima vez que inicie sesión.`,
                          confirmLabel: 'Cambiar rol',
                          tone: 'primary',
                          done: `${user.email} ahora es ${roleLabel(value)}`,
                        })
                      }
                    />
                  ) : (
                    <span>
                      <RoleBadge role={user.role} />
                    </span>
                  )}

                  <span>
                    <StatusBadge status={user.accountStatus} />
                  </span>

                  <span className="md:justify-self-end">
                    {self || deleted ? null : active ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={sending}
                        onClick={() =>
                          setPending({
                            user,
                            changes: { accountStatus: 'SUSPENDIDO' },
                            title: `¿Suspender a ${user.name}?`,
                            description: `${fullName} no podrá iniciar sesión hasta que reactives su cuenta. Sus reportes se conservan.`,
                            confirmLabel: 'Suspender cuenta',
                            tone: 'danger',
                            done: `Cuenta de ${user.email} suspendida`,
                          })
                        }
                      >
                        Suspender
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={sending}
                        onClick={() =>
                          setPending({
                            user,
                            changes: { accountStatus: 'ACTIVO' },
                            title: `¿Reactivar a ${user.name}?`,
                            description: `${fullName} podrá volver a iniciar sesión.`,
                            confirmLabel: 'Reactivar cuenta',
                            tone: 'primary',
                            done: `Cuenta de ${user.email} reactivada`,
                          })
                        }
                      >
                        Reactivar
                      </Button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {users && users.length > 0 && !error && (
        <p className="tnum mt-3 text-[13px] text-muted">
          {number.format(users.length)} {users.length === 1 ? 'cuenta' : 'cuentas'}
          {filtered && ' con estos filtros'}
        </p>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={pending?.title ?? ''}
        description={pending?.description ?? ''}
        confirmLabel={pending?.confirmLabel ?? ''}
        tone={pending?.tone}
        onConfirm={() => pending && update(pending)}
      />
    </>
  );
}
