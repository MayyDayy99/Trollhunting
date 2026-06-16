// ============================================================================
// sword.js — egy játékos kardja. Kézből (csukló + mutatóujjhegy) építi a pengét,
// számolja a hegy sebességét, kezeli a neon-megjelenést, nyomvonalat, árnyékot.
// Kimenet (state): { guard, tip, dir, speed, present }.
// ============================================================================

import * as THREE from 'three';
import { CFG } from './config.js';

const UP = new THREE.Vector3(0, 1, 0);

// egyszer létrehozott, 0..1 közt futó penge-geometria (+Y irány)
function makeBladeGeo() {
  const g = new THREE.BoxGeometry(0.14, 1, 0.05);
  g.translate(0, 0.5, 0); // alap a 0-ban, hegy az 1-ben
  return g;
}
const BLADE_GEO = makeBladeGeo();

export function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Sword {
  constructor(scene, color, zOffset, glowTex) {
    this.color = color;
    this.zOffset = zOffset;

    // kimeneti állapot (referenciák — a frame-en belül olvassák ki)
    this.guard = new THREE.Vector3();
    this.tip = new THREE.Vector3();
    this.dir = new THREE.Vector3(0, 1, 0);
    this.speed = 0;
    this.present = false;
    this.visible = false;

    this._prevTip = new THREE.Vector3();
    this._vel = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this.wasVisible = false;

    // --- mesh ---
    this.obj = new THREE.Group();
    const bladeMat = new THREE.MeshBasicMaterial({ color, transparent: true });
    this.blade = new THREE.Mesh(BLADE_GEO, bladeMat);
    this.blade.scale.y = CFG.BLADE_LEN;
    this.obj.add(this.blade);

    // mag (fehér izzó vonal a penge közepén)
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    this.core = new THREE.Mesh(BLADE_GEO, coreMat);
    this.core.scale.set(0.4, CFG.BLADE_LEN, 0.4);
    this.obj.add(this.core);

    // markolat-kereszt (guard)
    const guardMat = new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true });
    this.crossguard = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.12), guardMat);
    this.obj.add(this.crossguard);

    // hegy-glow
    this.tipGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.tipGlow.scale.setScalar(0.9);
    this.tipGlow.position.y = CFG.BLADE_LEN;
    this.obj.add(this.tipGlow);

    // markolat-glow
    this.gripGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.gripGlow.scale.setScalar(0.7);
    this.obj.add(this.gripGlow);

    this._mats = [bladeMat, coreMat, guardMat];
    scene.add(this.obj);

    // padló blob-árnyék (mélység-olvashatóság)
    this.shadow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false,
    }));
    this.shadow.scale.set(1.2, 0.4, 1);
    scene.add(this.shadow);

    // --- nyomvonal (pooled additív sprite-ok) ---
    this._trailPts = [];
    this._trailSprites = [];
    for (let i = 0; i < CFG.TRAIL_LEN; i++) {
      this._trailPts.push(new THREE.Vector3());
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      sp.scale.setScalar(0.3);
      scene.add(sp);
      this._trailSprites.push(sp);
    }
    this._trailIdx = 0;
  }

  _setVisible(v) {
    this.obj.visible = v;
    this.shadow.visible = v;
    if (!v) for (const s of this._trailSprites) s.material.opacity = 0;
  }

  _setOpacity(op) {
    for (const m of this._mats) m.opacity = op;
    this.tipGlow.material.opacity = op;
    this.gripGlow.material.opacity = op * 0.7;
  }

  // frame: { wrist:{x,y}, indexTip:{x,y}, present, visible } normalizált [-1,1]
  update(frame, view, dt, nowSec) {
    if (!frame || !frame.visible) {
      this.present = false;
      this.visible = false;
      this.speed = 0;
      this._setVisible(false);
      this.wasVisible = false;
      return this.state();
    }

    const gx = frame.wrist.x * view.halfW;
    const gy = frame.wrist.y * view.halfH;
    const fx = frame.indexTip.x * view.halfW;
    const fy = frame.indexTip.y * view.halfH;

    this.guard.set(gx, gy, 0);

    // irány: csukló -> mutatóujjhegy; degenerált (behajlított) esetben tartjuk az előzőt
    const dx = fx - gx, dy = fy - gy;
    const len = Math.hypot(dx, dy);
    if (len > CFG.DIR_EPS) this.dir.set(dx / len, dy / len, 0);

    this.tip.copy(this.guard).addScaledVector(this.dir, CFG.BLADE_LEN);

    // ha most jelent meg (rejtett -> látható), VAGY most szereztük vissza grace közben
    // (a szűrő resetelt -> a simított pozíció teleportál), ne legyen sebesség-tüske
    if (!this.wasVisible || frame.justAcquired) {
      this._prevTip.copy(this.tip);
      this.speed = 0;
      for (const p of this._trailPts) p.copy(this.tip);
    }

    // hegysebesség a SIMÍTOTT pozícióból (a frame már simítva érkezik)
    const ddt = Math.max(dt, 1 / 120);
    this._vel.subVectors(this.tip, this._prevTip).multiplyScalar(1 / ddt);
    const rawSpeed = this._vel.length();
    this.speed += (rawSpeed - this.speed) * 0.5; // enyhe EMA az olvasható számért
    this._prevTip.copy(this.tip);

    // mesh elhelyezés + orientáció
    this.obj.position.set(gx, gy, this.zOffset);
    this._q.setFromUnitVectors(UP, this.dir);
    this.obj.quaternion.copy(this._q);

    // present=false (grace) esetén halványítjuk
    this._setVisible(true);
    this._setOpacity(frame.present ? 1.0 : 0.4);

    this.shadow.position.set(gx, CFG.FLOOR_Y, this.zOffset - 0.01);

    this._pushTrail(this.speed);

    this.present = frame.present;
    this.visible = true;
    this.wasVisible = true;
    return this.state();
  }

  _pushTrail(speed) {
    this._trailIdx = (this._trailIdx + 1) % CFG.TRAIL_LEN;
    this._trailPts[this._trailIdx].copy(this.tip);
    const intensity = THREE.MathUtils.clamp((speed - 2) / 14, 0, 1); // gyorsnál fényes
    for (let k = 0; k < CFG.TRAIL_LEN; k++) {
      const j = (this._trailIdx - k + CFG.TRAIL_LEN * 2) % CFG.TRAIL_LEN;
      const sp = this._trailSprites[k];
      sp.position.copy(this._trailPts[j]);
      sp.position.z = this.zOffset - 0.02;
      const recency = 1 - k / CFG.TRAIL_LEN;
      sp.material.opacity = recency * recency * 0.7 * intensity;
      sp.scale.setScalar(0.2 + recency * 0.55);
    }
  }

  state() {
    return {
      guard: this.guard,
      tip: this.tip,
      dir: this.dir,
      speed: this.speed,
      present: this.present,
      visible: this.visible,
    };
  }
}
