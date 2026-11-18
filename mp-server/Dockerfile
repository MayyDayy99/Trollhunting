# =============================================================================
#  Mohas Roham co-op server — Dockerfile (Node 22, Alpine)
#
#  Build context = the REPOSITORY ROOT (docker-compose.yml sets it), because the
#  image needs the game build and the shared gameplay config:
#    docker build -f mp-server/Dockerfile -t mohas-roham-mp-server .
# =============================================================================

# ---- 1) build the single-file game (dist/mohas-roham.html) -------------------
FROM node:22-alpine AS game
WORKDIR /repo
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY vite.config.js mohas-roham.html ./
COPY build ./build
COPY src ./src
RUN npx vite build

# ---- 2) the server ------------------------------------------------------------
FROM node:22-alpine

# Same layout as the repository: /app/mp-server/server.js imports ../src/shared/config.js
WORKDIR /app/mp-server

# Install dependencies first for better layer caching.
COPY mp-server/package*.json ./
# Use `npm ci` when a lockfile exists (reproducible); otherwise `npm install`.
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# server.js, public/ (lobby + net-client.js), the shared config and the built game
COPY mp-server/ ./
COPY src/shared /app/src/shared
COPY --from=game /repo/dist/mohas-roham.html ./public/mohas-roham.html

# Run as the built-in non-root `node` user for safety.
USER node

# The server reads PORT (default 8080). EXPOSE documents it for tooling.
ENV PORT=8080
ENV HOST=0.0.0.0
EXPOSE 8080

# Container-level healthcheck hits the /healthz endpoint.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
