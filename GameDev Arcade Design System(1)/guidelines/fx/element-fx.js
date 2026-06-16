/* ============================================================================
   element-fx.js — Mohás Roham elemental VFX reference engine (2D canvas)
   ----------------------------------------------------------------------------
   PURPOSE (two jobs):
     1. Drive the animated specimen cards in the Design System tab.
     2. Be the PORTING REFERENCE for Claude Code. This is a 2D additive particle
        system whose structure deliberately mirrors the game's existing 3D one:
          · our `Particle{x,y,vx,vy,life,...}`  ≈  THREE.Points attributes
          · ctx.globalCompositeOperation='lighter'  ≈  THREE.AdditiveBlending
          · per-element COLOR ramp + spawn rates    ≈  what you feed the 3D pool
        Where the 3D mapping is non-obvious, look for  // → THREE:  comments.

   THE GAME ALREADY HAS:
     · an arrow pool (`makeArrow`/`fireArrow`, 30 arrows, gravity GRAV=9.2),
     · an additive THREE.Points burst (dust/sparks) used on impacts,
     · per-monster materials you can `.clone()` and tint (see `eyeMat.clone()`).
   So to ship an element you mostly: pick the COLORS below, attach a TRAIL emitter
   to the live arrow, fire an IMPACT burst on hit, and paint a STATUS aura while
   the troll is afflicted. Each of those four is implemented here.

   API:
     const fx = ElementFX.create(canvas, { element:'fire', mode:'arrow' });
     fx.stop();                       // cancel the RAF loop
   element: 'base' | 'fire' | 'ice' | 'poison' | 'lightning'
   mode:    'arrow' | 'impact' | 'aura' | 'death'
   ============================================================================ */
(function (global) {
  'use strict';

  /* ── PER-ELEMENT CONFIG ────────────────────────────────────────────────────
     Colors mirror tokens/elements.css 1:1 (core, mid, glow, spark, deep, light).
     `grav` is downward accel (px/s²) for that element's particles — fire RISES
     (negative), poison droops (positive), ice/lightning ~weightless.
     `emit` is trail particles/second while an arrow flies.
     // → THREE: feed `light` to a small THREE.PointLight parented to the arrow. */
  const CFG = {
    base: {
      core: '#bfc6d2', mid: '#8a6a40', glow: '#e9f1ff', spark: '#cfe0ff', deep: '#5a5f6b',
      light: '#cfe0ff', grav: 40, emit: 90, trailSize: 2.2, spread: 0.18, arrowTint: '#cfe0ff',
    },
    fire: {
      core: '#ff5a2a', mid: '#ff9a3d', glow: '#ffc24d', spark: '#fff1c4', deep: '#2a1c14',
      light: '#ff7a3d', grav: -130, emit: 150, trailSize: 3.4, spread: 0.5, arrowTint: '#ff7a3d',
    },
    ice: {
      core: '#6fd8ff', mid: '#a9e8ff', glow: '#e2f6ff', spark: '#ffffff', deep: '#2a6fd0',
      light: '#7fd0ff', grav: 18, emit: 110, trailSize: 2.6, spread: 0.3, arrowTint: '#a9e8ff',
    },
    poison: {
      core: '#7e9a2e', mid: '#9fdc4a', glow: '#c8e26a', spark: '#d8ee8a', deep: '#4d6b1e',
      light: '#9fdc4a', grav: 60, emit: 95, trailSize: 3.0, spread: 0.42, arrowTint: '#9fdc4a',
    },
    lightning: {
      core: '#b48cff', mid: '#a8c8ff', glow: '#ffffff', spark: '#d8e6ff', deep: '#5a3fb0',
      light: '#b48cff', grav: 0, emit: 120, trailSize: 2.4, spread: 0.6, arrowTint: '#c8b4ff',
    },
  };

  /* small helpers ----------------------------------------------------------- */
  const rand = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;

  /* ── PARTICLE POOL ──────────────────────────────────────────────────────────
     One flat array, recycled. // → THREE: this is exactly a THREE.Points buffer
     (position[], color[], life[]) — same fields, same update math, just 3D. */
  class Pool {
    constructor(max) {
      this.max = max; this.p = [];
      for (let i = 0; i < max; i++) this.p.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, col: '#fff' });
      this.i = 0;
    }
    spawn(x, y, vx, vy, life, size, col) {
      const o = this.p[this.i = (this.i + 1) % this.max];
      o.x = x; o.y = y; o.vx = vx; o.vy = vy; o.life = life; o.max = life; o.size = size; o.col = col;
    }
    update(dt, grav) {
      for (const o of this.p) {
        if (o.life <= 0) continue;
        o.life -= dt;
        o.vy += grav * dt;          // gravity (sign set per element)
        o.x += o.vx * dt; o.y += o.vy * dt;
      }
    }
    draw(ctx) {
      // additive draw: bright cores stack into hot whites where they overlap.
      ctx.globalCompositeOperation = 'lighter';
      for (const o of this.p) {
        if (o.life <= 0) continue;
        const k = o.life / o.max;            // 1 → 0 over lifetime (fade + shrink)
        ctx.globalAlpha = Math.max(0, k);
        ctx.fillStyle = o.col;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.size * (0.4 + k * 0.6), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /* pick a color along the element's hot→cool ramp by `t` (0..1) ------------- */
  function ramp(c, t) {
    // core (hot) → mid → glow → spark (brightest). Cheap 4-stop pick.
    if (t < 0.34) return c.core;
    if (t < 0.6) return c.mid;
    if (t < 0.85) return c.glow;
    return c.spark;
  }

  /* ── TROLL SILHOUETTE ───────────────────────────────────────────────────────
     A schematic mossy troll for the aura/death cards (NOT final art — the game
     builds the troll from Three.js primitives; this is just a stand-in to show
     the effect ON something). Glowing orange eyes per the real eyeMat. */
  function drawTroll(ctx, cx, cy, s, tint, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    const body = tint || '#5b8a68';
    // body blob
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, 6 * s, 30 * s, 34 * s, 0, 0, TAU); ctx.fill();
    // head
    ctx.beginPath(); ctx.ellipse(0, -26 * s, 22 * s, 20 * s, 0, 0, TAU); ctx.fill();
    // shoulders / arms
    ctx.beginPath(); ctx.ellipse(-30 * s, 2 * s, 11 * s, 16 * s, 0.3, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(30 * s, 2 * s, 11 * s, 16 * s, -0.3, 0, TAU); ctx.fill();
    // moss patches (darker)
    ctx.fillStyle = '#41704e';
    ctx.beginPath(); ctx.ellipse(-8 * s, -30 * s, 9 * s, 6 * s, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(12 * s, 10 * s, 10 * s, 7 * s, 0.4, 0, TAU); ctx.fill();
    // tusks
    ctx.fillStyle = '#f2e9d8';
    ctx.beginPath(); ctx.moveTo(-7 * s, -18 * s); ctx.lineTo(-3 * s, -10 * s); ctx.lineTo(-10 * s, -14 * s); ctx.fill();
    ctx.beginPath(); ctx.moveTo(7 * s, -18 * s); ctx.lineTo(3 * s, -10 * s); ctx.lineTo(10 * s, -14 * s); ctx.fill();
    // glowing eyes (emissive #ff5a2a) — additive
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#ff7a3d';
    [-8, 8].forEach((ex) => {
      const g = ctx.createRadialGradient(ex * s, -28 * s, 0, ex * s, -28 * s, 7 * s);
      g.addColorStop(0, '#ffd0a0'); g.addColorStop(0.4, '#ff5a2a'); g.addColorStop(1, 'rgba(255,90,42,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(ex * s, -28 * s, 7 * s, 0, TAU); ctx.fill();
    });
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  /* soft radial glow disc (impact flash / status halo) ---------------------- */
  function glow(ctx, x, y, r, col, a) {
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  /* jagged electric arc between two points (lightning only) ----------------- */
  function bolt(ctx, x1, y1, x2, y2, segs, jitter, col, width) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = col; ctx.lineWidth = width; ctx.lineCap = 'round';
    ctx.shadowColor = col; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(x1, y1);
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      ctx.lineTo(x1 + (x2 - x1) * t + rand(-jitter, jitter), y1 + (y2 - y1) * t + rand(-jitter, jitter));
    }
    ctx.lineTo(x2, y2); ctx.stroke();
    ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'source-over';
  }

  /* ── RUNNER ──────────────────────────────────────────────────────────────── */
  function create(canvas, opts) {
    const element = (opts && opts.element) || 'fire';
    const mode = (opts && opts.mode) || 'arrow';
    const c = CFG[element] || CFG.fire;
    const ctx = canvas.getContext('2d');

    // DPR-correct sizing from the element's CSS box.
    let W = 0, H = 0;
    function resize() {
      const dpr = Math.min(global.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    global.addEventListener('resize', resize);

    const pool = new Pool(420);
    let raf = 0, prev = performance.now(), t = 0;

    /* ARROW state: flies left→right, emits a trail, detonates, repeats. */
    const arrow = { x: -40, y: H * 0.5, vx: 230, ang: 0, flying: true, exploded: false };
    function resetArrow() { arrow.x = -40; arrow.y = H * (0.42 + Math.random() * 0.16); arrow.flying = true; arrow.exploded = false; }

    /* IMPACT burst: core→spark sparks thrown radially with gravity + a flash.
       // → THREE: identical to the game's dust burst — n points, random dir,
       // speed*(0.4..1.3), color by ramp(t); add a 1-frame PointLight flash. */
    function burst(x, y, n, power) {
      glow(ctx, x, y, 36 + power * 18, c.glow, 0.5);     // muzzle flash (drawn live below via flashes[])
      for (let i = 0; i < n; i++) {
        const a = rand(0, TAU), sp = rand(40, 60 + power * 90);
        pool.spawn(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 20, rand(0.3, 0.8), rand(1.6, 4.2) * (c.trailSize / 3), ramp(c, Math.random()));
      }
    }
    const flashes = []; // {x,y,r,life,max}

    /* AURA emit: element-specific signature painted on the troll each frame. */
    function emitAura(cx, cy, s) {
      if (element === 'fire') {
        // flames lick UPWARD off the body
        for (let i = 0; i < 3; i++) pool.spawn(cx + rand(-26, 26) * s, cy + rand(-10, 30) * s, rand(-12, 12), rand(-90, -150), rand(0.35, 0.7), rand(2, 4), ramp(c, Math.random()));
      } else if (element === 'ice') {
        // slow frost crystals drift + cling
        for (let i = 0; i < 2; i++) pool.spawn(cx + rand(-30, 30) * s, cy + rand(-30, 30) * s, rand(-8, 8), rand(-6, 16), rand(0.6, 1.1), rand(1.6, 3), ramp(c, Math.random()));
      } else if (element === 'poison') {
        // bubbles rise + pop, droplets drip
        if (Math.random() < 0.7) pool.spawn(cx + rand(-26, 26) * s, cy + rand(0, 28) * s, rand(-6, 6), rand(-30, -60), rand(0.5, 1.0), rand(2, 4.5), ramp(c, Math.random()));
        if (Math.random() < 0.4) pool.spawn(cx + rand(-22, 22) * s, cy + 30 * s, rand(-4, 4), rand(20, 50), rand(0.4, 0.8), rand(1.5, 2.6), c.mid);
      } else if (element === 'lightning') {
        // crackle motes; arcs handled separately in the draw step
        for (let i = 0; i < 2; i++) pool.spawn(cx + rand(-30, 30) * s, cy + rand(-30, 30) * s, rand(-30, 30), rand(-30, 30), rand(0.15, 0.4), rand(1.4, 2.6), ramp(c, Math.random()));
      } else {
        for (let i = 0; i < 1; i++) pool.spawn(cx + rand(-26, 26) * s, cy + rand(-26, 26) * s, rand(-10, 10), rand(-20, 6), rand(0.4, 0.8), rand(1.6, 2.6), ramp(c, Math.random()));
      }
    }

    /* DEATH state: a troll dissolves. BASE = break into falling chunks; each
       element OVERRIDES with its signature (fire ash, ice shatter, poison melt,
       lightning char). Loops. */
    const death = { t: 0, dur: 2.6, chunks: [] };
    function seedDeath() {
      death.t = 0; death.chunks.length = 0;
      // chunk the silhouette into ~14 pieces that fall/scatter
      for (let i = 0; i < 14; i++) {
        death.chunks.push({
          ox: rand(-26, 26), oy: rand(-44, 30), r: rand(4, 11),
          vx: rand(-40, 40), vy: rand(-60, 10), rot: rand(0, TAU), col: Math.random() < 0.7 ? '#5b8a68' : '#41704e',
        });
      }
    }
    if (mode === 'death') seedDeath();

    let impactTimer = 0;

    function frame(now) {
      const dt = Math.min((now - prev) / 1000, 0.05); prev = now; t += dt;

      // clear with a faint trail-persistence wash (motion blur feel)
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(10,16,24,0.16)';
      ctx.fillRect(0, 0, W, H);

      if (mode === 'arrow') {
        if (arrow.flying) {
          arrow.x += arrow.vx * dt;
          // emit trail: spawn `emit` particles/sec along the shaft tail
          const n = Math.max(1, Math.round(c.emit * dt));
          for (let i = 0; i < n; i++) {
            const back = i / n;
            pool.spawn(arrow.x - 18 - back * 10, arrow.y + rand(-3, 3),
              rand(-30, -90) - arrow.vx * 0.04, rand(-1, 1) * c.spread * 120,
              rand(0.3, 0.7), rand(2.0, 4.2) * (c.trailSize / 2.6), ramp(c, Math.random()));
          }
          if (element === 'lightning' && Math.random() < 0.5) {
            // forked crackle hugging the shaft
            bolt(ctx, arrow.x - 4, arrow.y, arrow.x - 26, arrow.y + rand(-10, 10), 5, 5, c.glow, 1.4);
          }
          // draw the arrow itself (shaft + element-tinted head)
          drawArrow(ctx, arrow.x, arrow.y, c);
          if (arrow.x > W * 0.78) { arrow.flying = false; burst(arrow.x, arrow.y, element === 'fire' ? 40 : 30, 1.3); flashes.push({ x: arrow.x, y: arrow.y, r: 6, max: 0.4, life: 0.4 }); }
        }
        if (!arrow.flying) { impactTimer += dt; if (impactTimer > 0.7) { impactTimer = 0; resetArrow(); } }
      } else if (mode === 'impact') {
        impactTimer += dt;
        if (impactTimer > 1.1) { impactTimer = 0; burst(W * 0.5, H * 0.5, 40, 1.4); flashes.push({ x: W * 0.5, y: H * 0.5, r: 8, max: 0.4, life: 0.4 }); }
      } else if (mode === 'aura') {
        const cx = W * 0.5, cy = H * 0.52, s = Math.min(W, H) / 130;
        // tint the troll with the element's status color, gently pulsing
        drawTroll(ctx, cx, cy, s, statusTint(element), 1);
        emitAura(cx, cy - 4, s);
        if (element === 'ice') glow(ctx, cx, cy, 60 * s, c.glow, 0.10 + 0.04 * Math.sin(t * 3));
        if (element === 'lightning' && Math.random() < 0.25) {
          // arc jumping across the body
          bolt(ctx, cx + rand(-30, 30) * s, cy - 30 * s, cx + rand(-30, 30) * s, cy + 30 * s, 7, 9, c.glow, 1.6);
        }
        if (element === 'fire') glow(ctx, cx, cy + 6 * s, 56 * s, c.mid, 0.10);
      } else if (mode === 'death') {
        runDeath(dt);
      }

      // draw + update flashes
      for (const f of flashes) { if (f.life > 0) { f.life -= dt; glow(ctx, f.x, f.y, f.r + (1 - f.life / f.max) * 40, c.glow, 0.6 * (f.life / f.max)); } }

      pool.update(dt, c.grav);
      pool.draw(ctx);

      raf = global.requestAnimationFrame(frame);
    }

    /* DEATH renderer (kept separate for clarity) ----------------------------- */
    function runDeath(dt) {
      death.t += dt;
      const cx = W * 0.5, cy = H * 0.52, s = Math.min(W, H) / 130;
      const p = death.t / death.dur;                 // 0..1 progress
      if (p >= 1) { seedDeath(); }                    // loop

      // Phase 1 (0–0.25): the troll reacts (flash + tint), still whole.
      if (p < 0.25) {
        const hit = 1 - p / 0.25;
        drawTroll(ctx, cx, cy, s, mixHitTint(element, hit), 1);
        glow(ctx, cx, cy, 50 * s, statusTint(element), 0.25 * hit);
      } else {
        // Phase 2 (0.25–1): BASE break-up + elemental override.
        const q = (p - 0.25) / 0.75;                  // 0..1 within dissolve
        // base chunks fall/scatter and fade
        ctx.globalAlpha = 1 - q;
        for (const ch of death.chunks) {
          ch.vy += 220 * dt;                          // gravity on chunks
          const x = cx + ch.ox * s + ch.vx * q * 0.8;
          const y = cy + ch.oy * s + ch.vy * q * 0.5;
          ctx.fillStyle = ch.col;
          ctx.beginPath(); ctx.arc(x, y, ch.r * s * (1 - q * 0.4), 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
        // elemental override layered on top of the crumble
        deathOverride(element, cx, cy, s, q, dt);
      }
    }

    /* each element's signature death flourish -------------------------------- */
    function deathOverride(e, cx, cy, s, q, dt) {
      if (e === 'fire') {
        // burst to ash + rising flame, then smoke
        for (let i = 0; i < 4; i++) pool.spawn(cx + rand(-26, 26) * s, cy + rand(-20, 20) * s, rand(-20, 20), rand(-120, -200), rand(0.4, 0.9), rand(2, 5), ramp(c, Math.random()));
        if (q < 0.3) glow(ctx, cx, cy, 70 * s, c.mid, 0.4 * (1 - q / 0.3));
      } else if (e === 'ice') {
        // SHATTER: angular shards fly out once, then settle
        if (q < 0.12) for (let i = 0; i < 30; i++) { const a = rand(0, TAU), sp = rand(80, 220); pool.spawn(cx, cy, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.5, 1.0), rand(2, 4), Math.random() < 0.5 ? c.glow : c.spark); }
        glow(ctx, cx, cy, 50 * s, c.core, 0.3 * (1 - q));
      } else if (e === 'poison') {
        // MELT: body slumps into a bubbling green puddle
        const puddleR = (24 + q * 40) * s;
        glow(ctx, cx, cy + 28 * s, puddleR, c.deep, 0.5);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = c.mid; ctx.globalAlpha = 0.5 * (1 - q * 0.4);
        ctx.beginPath(); ctx.ellipse(cx, cy + 30 * s, puddleR, puddleR * 0.32, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        if (Math.random() < 0.6) pool.spawn(cx + rand(-1, 1) * puddleR, cy + 30 * s, rand(-6, 6), rand(-30, -70), rand(0.4, 0.8), rand(2, 3.5), c.glow);
      } else if (e === 'lightning') {
        // CHAR + violent arcs, then collapse to a charred husk
        if (q < 0.4 && Math.random() < 0.6) bolt(ctx, cx + rand(-20, 20) * s, cy - 36 * s, cx + rand(-20, 20) * s, cy + 30 * s, 8, 12, c.glow, 2);
        for (let i = 0; i < 2; i++) pool.spawn(cx + rand(-24, 24) * s, cy + rand(-24, 24) * s, rand(-40, 40), rand(-40, 40), rand(0.15, 0.4), rand(1.5, 3), ramp(c, Math.random()));
      } else {
        // BASE: just dust puffs as it crumbles
        if (Math.random() < 0.5) pool.spawn(cx + rand(-24, 24) * s, cy + rand(-10, 26) * s, rand(-20, 20), rand(-10, -40), rand(0.4, 0.8), rand(2, 3.5), c.spark);
      }
    }

    /* draw an element-tinted arrow (shaft + broadhead + feather) ------------- */
    function drawArrow(ctx, x, y, c) {
      ctx.save();
      ctx.translate(x, y);
      // shaft
      ctx.strokeStyle = '#8a6a40'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(8, 0); ctx.stroke();
      // red fletching
      ctx.strokeStyle = '#d64b3a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-32, -5); ctx.moveTo(-26, 0); ctx.lineTo(-32, 5); ctx.stroke();
      // broadhead — element-tinted + glowing
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(12, 0, 0, 12, 0, 12);
      g.addColorStop(0, c.glow); g.addColorStop(0.5, c.arrowTint); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(12, 0, 12, 0, TAU); ctx.fill();
      ctx.fillStyle = c.core; ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath(); ctx.moveTo(4, -4); ctx.lineTo(16, 0); ctx.lineTo(4, 4); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    function stop() { global.cancelAnimationFrame(raf); global.removeEventListener('resize', resize); }
    raf = global.requestAnimationFrame(frame);
    return { stop };
  }

  /* status tint per element (used by aura/death) — mirrors --status-<e> ------ */
  function statusTint(e) {
    return ({ fire: '#a85a3a', ice: '#7fb6d8', poison: '#6f8a3a', lightning: '#8a7ac8', base: '#5b8a68' })[e] || '#5b8a68';
  }
  // brief hit tint (brighter flash of the status color) for the hit reaction.
  function mixHitTint(e, k) {
    return ({ fire: '#ff8a4a', ice: '#bfe6ff', poison: '#c8e26a', lightning: '#d8c8ff', base: '#cfe0ff' })[e] || '#cfe0ff';
  }

  global.ElementFX = { create, CFG, statusTint };
})(window);
