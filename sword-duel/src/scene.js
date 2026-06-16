// ============================================================================
// scene.js — Three.js jelenet: ortho kamera (lineáris leképezés), neon kardok,
// szikra-részecskék, screen shake. Birtokolja a 2 Sword példányt és a VFX-et.
// A háttér átlátszó (a CSS gradiens látszik át), a kardok additív neon-glow-val.
// ============================================================================

import * as THREE from 'three';
import { CFG, P1, P2 } from './config.js';
import { Sword, makeGlowTexture } from './sword.js';

// részecske-pool egyetlen THREE.Points-szal (additív, vertex-színek)
class Particles {
  constructor(scene, glowTex, max = 260) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.base = [];
    this.idx = 0;
    for (let i = 0; i < max; i++) this.base.push([1, 1, 1]);

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const m = new THREE.PointsMaterial({
      size: 0.4, map: glowTex, vertexColors: true, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, sizeAttenuation: true,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this._c = new THREE.Color();
  }

  burst(x, y, z, n, color, speed = 6, upward = 0.3) {
    this._c.set(color);
    for (let k = 0; k < n; k++) {
      const i = this.idx++ % this.max;
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.9);
      this.vel[i * 3] = Math.cos(a) * sp;
      this.vel[i * 3 + 1] = Math.sin(a) * sp + speed * upward;
      this.vel[i * 3 + 2] = 0;
      const ml = 0.4 + Math.random() * 0.5;
      this.life[i] = ml; this.maxLife[i] = ml;
      this.base[i][0] = this._c.r; this.base[i][1] = this._c.g; this.base[i][2] = this._c.b;
    }
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0;
        continue;
      }
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= 7 * dt; // gravitáció
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      const b = this.base[i];
      this.col[i * 3] = b[0] * k; this.col[i * 3 + 1] = b[1] * k; this.col[i * 3 + 2] = b[2] * k;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

export class GameScene {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0); // átlátszó

    this.scene = new THREE.Scene();
    this.view = { halfW: 8, halfH: CFG.WY };

    this.camera = new THREE.OrthographicCamera(-8, 8, CFG.WY, -CFG.WY, 0.1, 100);
    this.camera.position.set(0, 0, 20);
    this.camera.lookAt(0, 0, 0);
    this._camBase = new THREE.Vector3(0, 0, 20);

    // padló-vonal (enyhe aréna-jelzés)
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x2a3a5e, transparent: true, opacity: 0.5 });
    this.floor = new THREE.Mesh(new THREE.BoxGeometry(40, 0.06, 1), floorMat);
    this.floor.position.set(0, CFG.FLOOR_Y - 0.2, -1);
    this.scene.add(this.floor);

    const glowTex = makeGlowTexture();
    this.glowTex = glowTex;

    this.swords = {
      [P1]: new Sword(this.scene, CFG.P1_COLOR, +CFG.SWORD_Z_OFFSET, glowTex),
      [P2]: new Sword(this.scene, CFG.P2_COLOR, -CFG.SWORD_Z_OFFSET, glowTex),
    };

    this.particles = new Particles(this.scene, glowTex);

    this.shake = 0;
    this.resize();
  }

  resize() {
    // h>=1 / w>=1: ha 0 (rejtett tab / minimalizált ablak), az aspect NaN lenne
    // -> a kardok X-koordinátája NaN -> nem renderelnének. Ezt megelőzzük.
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const aspect = w / h;
    this.view.halfH = CFG.WY;
    this.view.halfW = CFG.WY * aspect;
    this.camera.left = -this.view.halfW;
    this.camera.right = this.view.halfW;
    this.camera.top = this.view.halfH;
    this.camera.bottom = -this.view.halfH;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // tracking: { p1, p2, rawCount } -> { p1:state, p2:state }
  updateSwords(tracking, dt, nowSec) {
    return {
      [P1]: this.swords[P1].update(tracking[P1], this.view, dt, nowSec),
      [P2]: this.swords[P2].update(tracking[P2], this.view, dt, nowSec),
    };
  }

  // gs.events alapján VFX
  applyEvents(gs) {
    for (const ev of gs.events) {
      if (ev.type === 'clash') {
        this.particles.burst(ev.pos.x, ev.pos.y, 0.2, 22, 0xfff0cf, 9, 0.2);
        this.shake = Math.max(this.shake, 0.18);
      } else if (ev.type === 'hit') {
        const color = ev.defender === P1 ? CFG.P1_COLOR : CFG.P2_COLOR;
        this.particles.burst(ev.pos.x, ev.pos.y, 0.2, 18 + Math.floor(ev.damage), color, 8, 0.3);
        this.shake = Math.max(this.shake, 0.08 + ev.damage * 0.006);
      } else if (ev.type === 'ko') {
        const color = ev.loser === null ? 0xffffff : ev.loser === P1 ? CFG.P1_COLOR : CFG.P2_COLOR;
        this.particles.burst(ev.pos.x, ev.pos.y, 0.2, 60, color, 12, 0.4);
        this.particles.burst(ev.pos.x, ev.pos.y, 0.2, 30, 0xffffff, 14, 0.4);
        this.shake = Math.max(this.shake, 0.45);
      }
    }
  }

  render(dt) {
    this.particles.update(dt);

    // screen shake
    if (this.shake > 0.001) {
      this.camera.position.set(
        this._camBase.x + (Math.random() - 0.5) * this.shake,
        this._camBase.y + (Math.random() - 0.5) * this.shake,
        this._camBase.z,
      );
      this.shake *= Math.pow(0.02, dt); // gyors lecsengés
    } else {
      this.camera.position.copy(this._camBase);
    }

    this.renderer.render(this.scene, this.camera);
  }
}
