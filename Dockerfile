# syntax=docker/dockerfile:1.7
# Slim-Variante: nutzt Next.js Standalone-Output ohne komplette node_modules.
# pdf-parse + @anthropic-ai/sdk + react-pdf werden via serverExternalPackages
# automatisch in .next/standalone/node_modules getraced.
# Falls dynamische Requires fehlen: einzelne Pakete hier nachkopieren.

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=4110
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Standalone hat eigenen Mini-server.js + Mini-node_modules (nur die Dependencies die der Server braucht)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
# Prisma-Engine landet in node_modules/.prisma/client/* — die wird vom Trace nicht erwischt
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs
EXPOSE 4110
CMD ["node", "server.js"]
