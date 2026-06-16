#!/usr/bin/env bash
# Self-signed cert (localhost + 127.0.0.1) generálása.
# Futtatás a projekt gyökeréből:  bash deploy/gen-cert.sh
set -euo pipefail
mkdir -p deploy/certs

# Windows Git-Bash: az MSYS átírja a "/CN=..."-t Windows-úttá -> MSYS_NO_PATHCONV=1
MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 825 \
  -keyout deploy/certs/server.key \
  -out    deploy/certs/server.crt \
  -subj   "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1"

echo "Kész: deploy/certs/server.crt és deploy/certs/server.key"
echo "Tipp: LAN-os eléréshez bővítsd a SAN-t az IdeaHub IP-jével/hostnevével."
