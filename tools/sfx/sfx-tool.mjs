// SFX helper: decode with ffmpeg, trim silence, fade, peak-normalize, encode mono MP3; analyze files.
//   node sfx-tool.mjs process <in> <out.mp3> [peakDb=-1.2] [kbps=64]
//   node sfx-tool.mjs analyze <file...>
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const SR = 44100;
function decode(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error('ffmpeg decode failed: ' + r.stderr);
  const b = r.stdout; return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4).slice();
}
const db = x => (x > 0 ? 20 * Math.log10(x) : -Infinity);

function stats(x) {
  let peak = 0, sum = 0, clip = 0;
  for (const v of x) { const a = Math.abs(v); if (a > peak) peak = a; sum += v * v; if (a >= 0.999) clip++; }
  const thr = Math.max(0.002, peak * 0.1);                 // onset: first sample at -20 dB below peak
  let on = 0; while (on < x.length && Math.abs(x[on]) < thr) on++;
  const tthr = Math.max(0.0005, peak * 0.0032);            // tail: last sample within 50 dB of peak
  let end = x.length - 1; while (end > 0 && Math.abs(x[end]) < tthr) end--;
  // RMS over the active part only (onset..tail)
  let s2 = 0; for (let i = on; i <= end; i++) s2 += x[i] * x[i];
  return { dur: x.length / SR, peakDb: db(peak), rmsDb: db(Math.sqrt(s2 / Math.max(1, end - on + 1))), onsetMs: on / SR * 1000,
    activeS: (end - on) / SR, tailMs: (x.length - 1 - end) / SR * 1000, clip };
}

function processFile(inp, out, peakDb = -1.2, kbps = 64) {
  const x = decode(inp);
  let peak = 0; for (const v of x) peak = Math.max(peak, Math.abs(v));
  if (peak < 1e-4) throw new Error('silent input: ' + inp);
  const sThr = Math.max(0.003, peak * 0.03);                // leading silence: below -30 dB re peak
  let a = 0; while (a < x.length && Math.abs(x[a]) < sThr) a++;
  a = Math.max(0, a - Math.round(0.002 * SR));             // keep 2 ms of pre-roll
  const eThr = Math.max(0.0005, peak * 0.0032);             // trailing: below -50 dB re peak
  let e = x.length - 1; while (e > a && Math.abs(x[e]) < eThr) e--;
  e = Math.min(x.length, e + Math.round(0.03 * SR));
  const y = x.slice(a, e);
  const fi = Math.min(y.length, Math.round(0.002 * SR));    // 2 ms fade-in (over the pre-roll only)
  for (let i = 0; i < fi; i++) y[i] *= i / fi;
  const fo = Math.min(y.length >> 2, Math.round(0.04 * SR)); // 40 ms fade-out (no click at the cut)
  for (let i = 0; i < fo; i++) y[y.length - 1 - i] *= i / fo;
  let p2 = 0; for (const v of y) p2 = Math.max(p2, Math.abs(v));
  const g = Math.pow(10, peakDb / 20) / p2; for (let i = 0; i < y.length; i++) y[i] *= g;
  const raw = Buffer.from(y.buffer, y.byteOffset, y.byteLength);
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '1', '-i', '-',
    '-c:a', 'libmp3lame', '-b:a', kbps + 'k', '-ar', String(SR), '-ac', '1', '-map_metadata', '-1', '-id3v2_version', '0', '-write_xing', '1', out], { input: raw });
  if (r.status !== 0) throw new Error('ffmpeg encode failed: ' + r.stderr);
  return { trimLeadMs: a / SR * 1000, trimTailMs: (x.length - e) / SR * 1000, gainDb: db(g) };
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'process') {
  const info = processFile(args[0], args[1], args[2] ? +args[2] : -1.2, args[3] ? +args[3] : 64);
  const st = stats(decode(args[1]));
  console.log(JSON.stringify({ out: args[1], bytes: fs.statSync(args[1]).size, ...info, ...st }));
} else if (cmd === 'analyze') {
  for (const f of args) { const st = stats(decode(f)); console.log(JSON.stringify({ file: f, bytes: fs.statSync(f).size, ...st })); }
} else { console.error('usage: process <in> <out> | analyze <files...>'); process.exit(2); }
