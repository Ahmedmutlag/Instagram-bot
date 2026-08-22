# syntax=docker/dockerfile:1

# ---- deps ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

# ---- build ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- runtime ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Prisma's query engine needs libssl on Alpine (musl) to detect the right
# engine variant; without it, it falls back to a guess and can fail at
# runtime with permission/engine-resolution errors.
RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 backend

COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# The `backend` user (not root) runs the process below, so it needs write
# access to node_modules/@prisma/engines — Prisma writes/caches generated
# engine files there at runtime (e.g. during `prisma migrate deploy`).
RUN chown -R backend:nodejs /app

USER backend

# The concrete process (API server, bot, or worker pool) is selected via the
# `command:` override in docker-compose.yml — all three share this one image.
CMD ["node", "dist/src/api/server.js"]
