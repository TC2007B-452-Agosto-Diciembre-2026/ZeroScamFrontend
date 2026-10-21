import type { NextConfig } from "next";
import { STATIC_CSP, resolveApiUrl, securityHeaders } from "./src/lib/security";

const production = process.env.NODE_ENV === "production";
const api = resolveApiUrl(process.env.NEXT_PUBLIC_API_URL);

const nextConfig: NextConfig = {
  // Genera .next/standalone: un server.js mínimo para la imagen de Docker
  output: "standalone",
  // No anunciar "X-Powered-By: Next.js" (alerta de ZAP 10037).
  poweredByHeader: false,
  // El 308 automático que quita la "/" final salía sin cabeceras de seguridad
  // (alerta de ZAP 10021). Lo hace `proxy.ts`, ya con ellas.
  skipTrailingSlashRedirect: true,
  // X-Frame-Options, X-Content-Type-Options y demás (alertas de ZAP 10020 y 10021).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({ production, https: api.https }),
      },
      // Lo que no pasa por `proxy.ts` también lleva CSP (alerta de ZAP 10038).
      ...["/_next/static/:path*", "/_next/image/:path*", "/favicon.ico"].map((source) => ({
        source,
        headers: [{ key: "Content-Security-Policy", value: STATIC_CSP }],
      })),
    ];
  },
};

export default nextConfig;
