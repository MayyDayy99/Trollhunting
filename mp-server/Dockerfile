# =============================================================================
#  Mohas Roham co-op server — Dockerfile (Node 22, Alpine)
# =============================================================================
FROM node:22-alpine

# App lives here.
WORKDIR /app

# Install dependencies first for better layer caching.
# (Only package.json + lockfile if present, so code changes don't bust the
#  npm-install layer.)
COPY package*.json ./
# Use `npm ci` when a lockfile exists (reproducible); otherwise `npm install`.
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Copy the rest of the app (server.js, public/, etc.).
COPY . .

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
