import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Providers } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'ZeroScam — Administración', template: '%s · ZeroScam' },
  description: 'Revisión de reportes de fraude, cuentas y estadísticas de ZeroScam.',
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  // El nonce del CSP lo genera `proxy.ts` en cada petición. Leerlo aquí también
  // hace dinámico el renderizado, que es lo que necesita para que Next.js lo
  // ponga en sus scripts.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    // next-themes pone la clase del tema antes de que React hidrate.
    <html lang="es" suppressHydrationWarning>
      <body>
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  );
}
