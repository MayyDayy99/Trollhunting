# syntax=docker/dockerfile:1

###############################################################################
# 1. stage — a Vite app buildelése
###############################################################################
FROM node:22-alpine AS build
WORKDIR /app

# előbb csak a manifesteket másoljuk (jobb layer-cache)
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .
RUN npm run build
# -> /app/dist (Vite alapértelmezett kimenet)

###############################################################################
# 2. stage — a statikus dist/ kiszolgálása nginx-szel HTTPS-en
###############################################################################
FROM nginx:alpine AS runtime

RUN rm -f /etc/nginx/conf.d/default.conf
COPY deploy/nginx.conf /etc/nginx/conf.d/app.conf
COPY --from=build /app/dist /usr/share/nginx/html

# A self-signed certet futásidőben mountoljuk (docker-compose: ./deploy/certs).
# Alternatíva (bake-in): vedd ki a kommentet és töröld a compose volume-ot.
#   COPY deploy/certs/server.crt /etc/nginx/certs/server.crt
#   COPY deploy/certs/server.key /etc/nginx/certs/server.key
RUN mkdir -p /etc/nginx/certs

EXPOSE 443
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
