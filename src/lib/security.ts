// Cabeceras de seguridad y validación de la URL de la API. Son funciones puras
// (sin Next ni DOM) para usarlas desde `next.config.ts` y `proxy.ts`.

export const DEFAULT_API_URL = 'http://localhost:3000';

/**
 * Valida `NEXT_PUBLIC_API_URL`.
 *
 * Solo comprueba que sea una URL http(s) sin usuario ni contraseña. No exige
 * https: el laboratorio llama a la API por http dentro de su red.
 *
 * @returns La URL sin diagonal final y su origen (para `connect-src`).
 * @throws Si la URL no es válida o no cumple lo anterior.
 */
export function resolveApiUrl(
  raw: string | undefined,
): { url: string; origin: string; https: boolean } {
  const value = (raw?.trim() || DEFAULT_API_URL).replace(/\/+$/, '');

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`NEXT_PUBLIC_API_URL no es una URL válida: "${value}".`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('NEXT_PUBLIC_API_URL debe empezar con http:// o https://.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('NEXT_PUBLIC_API_URL no debe llevar usuario ni contraseña.');
  }
  const https = parsed.protocol === 'https:';
  return { url: value, origin: parsed.origin, https };
}

/** Nonce de un solo uso para el CSP: 16 bytes aleatorios en base64. */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/**
 * SHA-256 del CSS que `sonner` mete en un `<style>` al cargarse (`__insertCSS`).
 * La librería no acepta nonce, así que el CSP permite ese texto exacto y nada
 * más. Si una actualización de sonner cambia su CSS, el navegador bloquea ese
 * estilo y hay que poner aquí el hash nuevo.
 */
export const SONNER_STYLE_HASH = "'sha256-StEaX+se6YS7pqjzrzMIA0KaX9zF/8zAhvQXZAe5epY='";

/**
 * SHA-256 de la cadena vacía. sonner primero agrega su `<style>` vacío y
 * después le pone el texto; sin este hash el navegador reporta el paso vacío
 * como violación. Un `<style>` vacío no aplica nada.
 */
export const EMPTY_STYLE_HASH = "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='";

/**
 * CSP de las respuestas que no pasan por `proxy.ts` (`/_next/static`,
 * `/_next/image`, `favicon.ico`): no son documentos, así que no cargan nada.
 * Cubre también los 404 de esas rutas (alerta de ZAP 10038). `base-uri` y
 * `form-action` no heredan de `default-src`, por eso van explícitas (ZAP 10055).
 */
export const STATIC_CSP = "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

/**
 * Content-Security-Policy de cada documento.
 *
 * - `script-src` con nonce y `strict-dynamic`: solo corre lo que Next.js marca
 *   con el nonce de esta respuesta. `unsafe-eval` únicamente en desarrollo
 *   (React lo usa para reconstruir pilas de error); en producción no.
 * - `style-src` sin `unsafe-inline` (alerta de ZAP 10055): Next.js pone el
 *   nonce en sus hojas de estilo y el `<style>` que crea `sonner` se permite por
 *   su hash ({@link SONNER_STYLE_HASH}, {@link EMPTY_STYLE_HASH}). Los estilos que React o motion ponen
 *   desde JavaScript usan CSSOM y el CSP no los bloquea; por eso el HTML del
 *   servidor no debe traer atributos `style=""`. En desarrollo sí se permite
 *   `unsafe-inline`, porque el recargador en caliente inserta `<style>` sin nonce.
 * - `connect-src`: el propio origen y el de la API, nada más.
 * - `img-src` con el origen de la API: las miniaturas de evidencia son
 *   `<img src="{API}/uploads/...">`.
 */
export function buildCsp(options: {
  nonce: string;
  apiOrigin: string;
  isDev?: boolean;
  /** Pedir al navegador que suba a https lo que quede en http (solo si el panel ya va por https). */
  upgradeInsecure?: boolean;
}): string {
  const { nonce, apiOrigin, isDev = false, upgradeInsecure = false } = options;
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}' ${SONNER_STYLE_HASH} ${EMPTY_STYLE_HASH}`}`,
    `img-src 'self' blob: data: ${apiOrigin}`,
    "font-src 'self'",
    // En desarrollo, además, el websocket del recargador en caliente.
    `connect-src 'self' ${apiOrigin}${isDev ? ' ws://localhost:* ws://127.0.0.1:*' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (upgradeInsecure) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

export type HeaderEntry = { key: string; value: string };

/**
 * Cabeceras que no dependen de la petición, para `headers()` de `next.config.ts`.
 *
 * `Strict-Transport-Security` solo se manda en producción y con la API en
 * https (señal de que el panel también va por TLS); sobre http el navegador
 * la ignora y en desarrollo sobre `localhost` estorbaría.
 */
export function securityHeaders(options: { production: boolean; https: boolean }): HeaderEntry[] {
  const headers: HeaderEntry[] = [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'no-referrer' },
    {
      key: 'Permissions-Policy',
      value: [
        'camera=()',
        'microphone=()',
        'geolocation=()',
        'payment=()',
        'usb=()',
        'serial=()',
        'bluetooth=()',
        'accelerometer=()',
        'gyroscope=()',
        'magnetometer=()',
        'clipboard-read=()',
        'browsing-topics=()',
      ].join(', '),
    },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ];
  if (options.production && options.https) {
    headers.push({ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' });
  }
  return headers;
}
