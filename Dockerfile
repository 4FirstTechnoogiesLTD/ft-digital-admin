# syntax=docker/dockerfile:1

# ── build ──────────────────────────────────────────────────────────────────
FROM oven/bun:1.3 AS build
WORKDIR /app

# install deps against the committed lockfile
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

# build with the Nitro node-server preset (default here is cloudflare)
COPY . .
ENV NITRO_PRESET=node-server
RUN bun run build

# ── runtime ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.output ./.output

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/login" >/dev/null 2>&1 || exit 1

CMD ["node", ".output/server/index.mjs"]
