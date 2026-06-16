// ============================================================================
// handTracking.js — kamera + MediaPipe Hands (TF.js runtime).
// Frame-enként: detektálás -> normalizálás+selfie-tükrözés -> hozzárendelés ->
// One-Euro simítás slotonként. Kimenet: { p1, p2, rawCount }.
//
// Tükrözés: a megjelenített videót CSS-sel tükrözzük (scaleX(-1)), az inferencia
// a NYERS pixeleken fut (a CSS nem hat rá), ezért flipHorizontal:false, és a
// tükrözést itt, kódban végezzük (nx = -nx). Így nincs dupla tükrözés.
// ============================================================================

import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-converter';
import '@tensorflow/tfjs-backend-webgl';

import { CFG } from './config.js';
import { HandAssigner } from './handAssignment.js';
import { Vec2Filter } from './smoothing.js';

export class HandTracking {
  constructor() {
    this.video = null;
    this.detector = null;
    this.assigner = new HandAssigner(CFG);
    this.filters = [this._mkFilters(), this._mkFilters()];
    this.ready = false;
    this.lastCount = 0;
  }

  _mkFilters() {
    return { wrist: new Vec2Filter(CFG.ONE_EURO), tip: new Vec2Filter(CFG.ONE_EURO) };
  }

  async init(videoEl) {
    this.video = videoEl;

    // 1) kamera
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: CFG.CAM_W }, height: { ideal: CFG.CAM_H }, facingMode: 'user' },
      audio: false,
    });
    videoEl.srcObject = stream;
    await videoEl.play();
    await new Promise((res) => {
      if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) return res();
      videoEl.onloadeddata = () => res();
    });

    // 2) tfjs backend (webgl), MUSZÁJ awaitelni a detektor előtt.
    // FONTOS: egyes GPU-kon (főleg integrált Intel) a WebGL float16 textúrák
    // NaN-t adnak a modell kimenetén -> a kéz-keypointok NaN-ok lesznek (kard
    // "eltűnik"). A float32 kényszerítése ezt javítja (kicsit lassabb, de helyes).
    try {
      tf.env().set('WEBGL_RENDER_FLOAT32_ENABLED', true);
      tf.env().set('WEBGL_FORCE_F16_TEXTURES', false);
      tf.env().set('WEBGL_PACK_DEPTHWISECONV', false); // ismert NaN/precíziós bug egyes drivereken
    } catch (e) { /* ha nem állítható, megy tovább */ }
    try { await tf.setBackend('webgl'); } catch (e) { /* default backend marad */ }
    await tf.ready();

    // 3) detektor — tfjs runtime, lite (alacsony késleltetés), max 2 kéz
    const model = handPoseDetection.SupportedModels.MediaPipeHands;
    this.detector = await handPoseDetection.createDetector(model, {
      runtime: 'tfjs',
      modelType: 'lite',
      maxHands: 2,
    });

    // 4) bemelegítés, hogy az első valódi frame ne akadjon
    try {
      await this.detector.estimateHands(videoEl, { flipHorizontal: false, staticImageMode: false });
    } catch (e) { /* az első hívás néha üres, nem baj */ }

    this.ready = true;
  }

  // nowMs: performance.now(). async — megvárja az inferenciát.
  async update(nowMs) {
    const v = this.video;
    if (!this.ready || !v || v.readyState < 2 || v.videoWidth === 0) {
      return this._output(this.assigner.assign([]), nowMs);
    }

    let raw = [];
    try {
      raw = await this.detector.estimateHands(v, { flipHorizontal: false, staticImageMode: false });
    } catch (e) {
      raw = [];
    }
    this.lastCount = raw.length;

    const W = v.videoWidth, H = v.videoHeight;
    // diagnosztika: az első detektált kéz csukló-keypointja (formátum + érték)
    const k0 = raw[0] && raw[0].keypoints && raw[0].keypoints[0];
    this.dbgKp = k0 ? { keys: Object.keys(k0).join(','), x: k0.x, y: k0.y } : null;

    const hands = [];
    for (const h of raw) {
      const kp = h.keypoints;
      if (!kp || kp.length < 9) continue;
      const wrist = this._norm(kp[0], W, H);
      const indexTip = this._norm(kp[8], W, H);
      // NaN/Infinity keypoint (pl. WebGL precíziós hiba) -> eldobjuk, ne fertőzze meg a játékot
      if (!Number.isFinite(wrist.x) || !Number.isFinite(wrist.y) ||
          !Number.isFinite(indexTip.x) || !Number.isFinite(indexTip.y)) continue;
      hands.push({ wrist, indexTip, score: h.score ?? 1 });
    }

    return this._output(this.assigner.assign(hands), nowMs);
  }

  // pixel (origó: bal-felső) -> normalizált [-1,1], +y = fel, x tükrözve (selfie)
  _norm(pt, W, H) {
    const nx = -((pt.x / W) * 2 - 1);
    const ny = 1 - (pt.y / H) * 2;
    return { x: nx, y: ny };
  }

  _output(slots, nowMs) {
    const tsSec = nowMs / 1000;
    const out = { rawCount: this.lastCount };
    for (let i = 0; i < 2; i++) {
      const s = slots[i];
      const f = this.filters[i];
      if (s.justAcquired) { f.wrist.reset(); f.tip.reset(); }

      let wrist, indexTip;
      if (s.present) {
        wrist = f.wrist.filter(s.wrist, tsSec);
        indexTip = f.tip.filter(s.indexTip, tsSec);
        s._smWrist = wrist;
        s._smTip = indexTip;
      } else {
        // grace alatt az utolsó simított érték (szűrőt nem léptetjük)
        wrist = s._smWrist || { x: s.wrist.x, y: s.wrist.y };
        indexTip = s._smTip || { x: s.indexTip.x, y: s.indexTip.y };
      }

      out[s.id] = {
        wrist,
        indexTip,
        present: s.present,
        visible: s.visible,
        score: s.score,
        justAcquired: s.justAcquired, // szűrő-reset jelzés -> a kard így elnyomja a sebesség-tüskét
      };
    }
    return out;
  }
}
