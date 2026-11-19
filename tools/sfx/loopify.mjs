// Make a seamless loop from a music/ambience file:
//   out = x[0 : L-X], and the tail x[L-X : L] (fading out) is mixed onto the head x[0 : X] (fading in),
//   so playing out end-to-start continues the music exactly. Equal-power crossfade, then peak-normalize and encode.
//   node loopify.mjs <in> <out.mp3> <channels> <kbps> <xfadeSeconds> <peakDb>
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
const [inp, out, chS, kbpsS, xfS, pkS] = process.argv.slice(2);
const CH = +chS || 2, SR = 44100, X = Math.round((+xfS || 2) * SR), PEAK = Math.pow(10, (+pkS || -2) / 20);
const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', inp, '-ac', String(CH), '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
if (r.status !== 0) throw new Error(String(r.stderr));
const x = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.byteLength / 4).slice();
const L = x.length / CH, N = L - X, y = new Float32Array(N * CH);
for (let i = 0; i < N; i++) for (let c = 0; c < CH; c++) y[i * CH + c] = x[i * CH + c];
for (let i = 0; i < X; i++) {
  const t = i / X, gin = Math.sin(t * Math.PI / 2), gout = Math.cos(t * Math.PI / 2);
  for (let c = 0; c < CH; c++) y[i * CH + c] = x[i * CH + c] * gin + x[(N + i) * CH + c] * gout;
}
let peak = 0; for (const v of y) peak = Math.max(peak, Math.abs(v));
const k = PEAK / Math.max(1e-6, peak); for (let i = 0; i < y.length; i++) y[i] *= k;
const e = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', String(CH), '-i', '-', '-c:a', 'libmp3lame', '-b:a', kbpsS + 'k', out], { input: Buffer.from(y.buffer) });
if (e.status !== 0) throw new Error(String(e.stderr));
console.log(JSON.stringify({ out, seconds: +(N / SR).toFixed(2), bytes: fs.statSync(out).size, gain: +k.toFixed(3) }));
