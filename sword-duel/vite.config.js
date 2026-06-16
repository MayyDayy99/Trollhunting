import { defineConfig } from 'vite';

export default defineConfig({
  // host:true -> a dev szerver a LAN-on is elérhető (de a kamera LAN-on csak
  // HTTPS-en megy; dev-hez használj http://localhost-ot, az secure context).
  server: { host: true },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2500, // a TF.js + Three.js bundle nagy, ez normális
  },
});
