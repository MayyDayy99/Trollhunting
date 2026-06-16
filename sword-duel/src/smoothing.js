// ============================================================================
// smoothing.js — 1€ (One-Euro) szűrő a kéz-jitter ellen.
// Adaptív aluláteresztő: nyugalomban erősen simít (kevés jitter),
// gyors mozgásnál enged (kevés késés). Casiez et al., gery.casiez.net/1euro
// ============================================================================

function smoothingFactor(te, cutoff) {
  const r = 2 * Math.PI * cutoff * te;
  return r / (r + 1);
}

export class OneEuroFilter {
  constructor(freq = 30, minCutoff = 1.0, beta = 0.0, dCutoff = 1.0) {
    this.freq = freq;
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.reset();
  }

  reset() {
    this.initialized = false;
    this.xPrev = 0;
    this.dxPrev = 0;
    this.tPrev = 0;
  }

  // value: szám, tsSec: időbélyeg másodpercben
  filter(value, tsSec) {
    if (!this.initialized) {
      this.xPrev = value;
      this.dxPrev = 0;
      this.tPrev = tsSec;
      this.initialized = true;
      return value;
    }

    let te = tsSec - this.tPrev;
    // frame-hitch / azonos timestamp elleni védelem
    if (!(te > 0)) te = 1 / this.freq;
    te = Math.min(Math.max(te, 1 / 240), 1 / 5);

    // derivált simítása
    const aD = smoothingFactor(te, this.dCutoff);
    const dx = (value - this.xPrev) / te;
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;

    // adaptív cutoff a sebesség alapján
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = smoothingFactor(te, cutoff);
    const xHat = a * value + (1 - a) * this.xPrev;

    this.xPrev = xHat;
    this.dxPrev = dxHat;
    this.tPrev = tsSec;
    return xHat;
  }
}

// Kényelmi burok 2D pontra (x, y külön szűrővel).
export class Vec2Filter {
  constructor(euro) {
    this.fx = new OneEuroFilter(euro.freq, euro.minCutoff, euro.beta, euro.dCutoff);
    this.fy = new OneEuroFilter(euro.freq, euro.minCutoff, euro.beta, euro.dCutoff);
  }
  filter(p, tsSec) {
    return { x: this.fx.filter(p.x, tsSec), y: this.fy.filter(p.y, tsSec) };
  }
  reset() {
    this.fx.reset();
    this.fy.reset();
  }
}
