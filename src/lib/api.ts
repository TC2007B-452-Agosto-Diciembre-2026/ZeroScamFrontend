import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

// ---------- Guardado ----------

const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';

export function saveTokens(tokens: {
  accessToken: string;
  refreshToken?: string;
}): void {
  localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  if (tokens.refreshToken) {
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  }
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// ---------- Cliente ----------

export const api = axios.create({ baseURL: API_URL });

// ---------- Envío: el Bearer en cada petición ----------

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---------- Sesión ----------

/** Lo que regresa el login cuando la cuenta tiene verificación en dos pasos. */
export type TwoFactorChallenge = {
  challengeId: string;
  /** Correo enmascarado al que se mandó el código. */
  destination: string;
};

type Tokens = { accessToken: string; refreshToken: string };

/**
 * Inicia sesión. Si la cuenta tiene verificación en dos pasos no hay tokens
 * todavía: regresa el desafío, que se canjea con `verifyCode`.
 */
export async function login(
  email: string,
  password: string,
): Promise<TwoFactorChallenge | null> {
  const { data } = await api.post<
    Tokens | ({ twoFactorRequired: true } & TwoFactorChallenge)
  >('/auth/login', { email, password });
  if ('twoFactorRequired' in data) {
    return { challengeId: data.challengeId, destination: data.destination };
  }
  saveTokens(data);
  return null;
}

/** Segundo paso del login: el código de 6 dígitos del desafío. */
export async function verifyCode(
  challengeId: string,
  code: string,
): Promise<void> {
  const { data } = await api.post<Tokens>('/auth/two-factor/verify', {
    challengeId,
    code,
  });
  saveTokens(data);
}

export function logout(): void {
  clearTokens();
  window.location.replace('/login');
}

export function errorMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    if (!e.response) return 'No se pudo conectar con el servidor';
    const message = (e.response.data as { message?: string | string[] })
      ?.message;
    if (message) return Array.isArray(message) ? message.join(', ') : message;
  }
  return 'Ocurrió un error inesperado';
}

// ---------- Refresco: 401 → refresh → reintento ----------

let refreshing: Promise<void> | null = null;

function refreshAccessToken(): Promise<void> {
  // axios "pelón": esta petición no pasa por los interceptores de `api`
  refreshing ??= axios
    .post<{ accessToken: string }>(`${API_URL}/auth/refresh`, {
      refreshToken: getRefreshToken(),
    })
    .then(({ data }) => saveTokens(data))
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    const is401 = error.response?.status === 401;
    const isAuthRoute = original?.url?.startsWith('/auth/');
    if (!is401 || !original || original._retry || isAuthRoute) {
      return Promise.reject(error);
    }

    original._retry = true;
    try {
      await refreshAccessToken();
    } catch (e) {
      // El servidor rechazó el refresh: la sesión terminó. Si ni siquiera
      // respondió (está apagado), los tokens se conservan.
      if (axios.isAxiosError(e) && e.response) logout();
      return Promise.reject(e);
    }
    return api(original);
  },
);
