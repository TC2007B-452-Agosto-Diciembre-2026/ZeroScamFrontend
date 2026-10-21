'use client';

import { createContext, useContext } from 'react';

export type Me = {
  id: string;
  name: string;
  lastName: string;
  /** Nombre de usuario que se edita en la app; falta si el API es anterior. */
  alias?: string;
  email: string;
  role: string;
};

export type Session = {
  /** La cuenta con sesión abierta; `null` mientras se pide a `GET /users/me`. */
  me: Me | null;
  /** Reportes RECIBIDO o EN_REVISION; `null` mientras no se sabe. */
  pending: number | null;
  setPending: (count: number) => void;
  openCommand: () => void;
};

export const SessionContext = createContext<Session>({
  me: null,
  pending: null,
  setPending: () => undefined,
  openCommand: () => undefined,
});

export function useSession(): Session {
  return useContext(SessionContext);
}

export function useMe(): Me | null {
  return useContext(SessionContext).me;
}

export function isStaff(me: Me | null): boolean {
  return me?.role === 'Administrador' || me?.role === 'Owner';
}
