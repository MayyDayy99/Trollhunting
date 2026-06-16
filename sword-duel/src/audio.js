// ============================================================================
// audio.js — szintetizált hangok (WebAudio), nincs külső mp3 fájl, offline megy.
// unlock()-ot user-gesztusból kell hívni (autoplay policy).
// ============================================================================

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this._noise = null;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this._noise = this._makeNoiseBuffer();
  }

  _makeNoiseBuffer() {
    const len = this.ctx.sampleRate * 0.5;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _now() { return this.ctx.currentTime; }

  _tone(freq, t0, dur, type = 'sine', gain = 0.3, glideTo = null) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  _noiseBurst(t0, dur, gain, filterType, freq, q = 1) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  _ok() { return this.enabled && this.ctx; }

  whoosh(speed) {
    if (!this._ok()) return;
    const t = this._now();
    const g = Math.min(0.25, 0.05 + speed * 0.01);
    this._noiseBurst(t, 0.18, g, 'bandpass', 700 + speed * 40, 1.2);
  }

  clash() {
    if (!this._ok()) return;
    const t = this._now();
    // fémes "ting": két enyhén elhangolt magas hang + zaj-tüske
    this._tone(2400, t, 0.18, 'square', 0.18, 1600);
    this._tone(3100, t, 0.16, 'triangle', 0.12, 2100);
    this._noiseBurst(t, 0.12, 0.18, 'highpass', 3000, 0.7);
  }

  hit(power = 1) {
    if (!this._ok()) return;
    const t = this._now();
    this._tone(180, t, 0.22, 'sine', 0.35, 60); // mély "thunk"
    this._noiseBurst(t, 0.14, 0.22 * power, 'lowpass', 500, 0.8);
  }

  tick(n) {
    if (!this._ok()) return;
    const t = this._now();
    this._tone(n <= 1 ? 880 : 520, t, 0.12, 'square', 0.22);
  }

  fightStart() {
    if (!this._ok()) return;
    const t = this._now();
    this._tone(1320, t, 0.35, 'square', 0.28, 1320);
    this._noiseBurst(t, 0.2, 0.15, 'bandpass', 1200, 1);
  }

  victory() {
    if (!this._ok()) return;
    const t = this._now();
    const notes = [523, 659, 784, 1047]; // C E G C
    notes.forEach((f, i) => this._tone(f, t + i * 0.12, 0.3, 'triangle', 0.3));
  }
}
