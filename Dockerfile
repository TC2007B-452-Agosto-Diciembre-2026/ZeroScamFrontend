# syntax=docker/dockerfile:1

# ---------- 1. Dependencias ----------
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Caché de npm entre builds: si cambia package-lock.json solo se descarga lo
# nuevo, no todas las dependencias otra vez.
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund

# ---------- 2. Build ----------
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next "congela" las variables NEXT_PUBLIC_* dentro del JS al compilar,
# por eso la URL de la API se pasa en el build y no al arrancar.
ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---------- 3. Imagen final ----------
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3001

CMD ["node", "server.js"]
