# Self-signed cert (localhost + 127.0.0.1) generálása Windows-on.
# openssl kell PATH-on (Git for Windows hozza: C:\Program Files\Git\usr\bin\openssl.exe).
# Futtatás a projekt gyökeréből:
#   powershell -ExecutionPolicy Bypass -File deploy\gen-cert.ps1
New-Item -ItemType Directory -Force -Path deploy\certs | Out-Null

openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 825 `
  -keyout deploy\certs\server.key `
  -out    deploy\certs\server.crt `
  -subj   "/CN=localhost" `
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1"

Write-Host "Kesz: deploy\certs\server.crt es deploy\certs\server.key"
Write-Host "Tipp: a LAN-os eleresehez add hozza az IdeaHub IP-jet/hostnevet a SAN-hoz."
