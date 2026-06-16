// ============================================================================
// ui.js — DOM HUD overlay (életcsíkok, idő, countdown, bannerek, kéz-állapot,
// sérülés-villanás). A Three.js-től függetlenül, gs pillanatképből renderel.
// Nagy kijelzőre méretezve (style.css), erős kontraszt.
// ============================================================================

import { CFG, P1, P2, STATE } from './config.js';

const COLNAME = { [P1]: '#36c5ff', [P2]: '#ff7a3d' };

export class UI {
  constructor() {
    this.el = {
      p1hpFill: document.getElementById('p1hpFill'),
      p2hpFill: document.getElementById('p2hpFill'),
      p1hpNum: document.getElementById('p1hpNum'),
      p2hpNum: document.getElementById('p2hpNum'),
      p1status: document.getElementById('p1status'),
      p2status: document.getElementById('p2status'),
      timer: document.getElementById('timer'),
      center: document.getElementById('center'),
      sub: document.getElementById('centerSub'),
      stats: document.getElementById('stats'),
      flashP1: document.getElementById('flashP1'),
      flashP2: document.getElementById('flashP2'),
    };
    this.flash = { [P1]: 0, [P2]: 0 };
  }

  render(gs, dt) {
    // --- életcsíkok ---
    this._hp(this.el.p1hpFill, this.el.p1hpNum, gs[P1].hp, gs[P1].invuln);
    this._hp(this.el.p2hpFill, this.el.p2hpNum, gs[P2].hp, gs[P2].invuln);

    // --- idő ---
    if (gs.suddenDeath) {
      this.el.timer.textContent = 'HIRTELEN HALÁL';
      this.el.timer.classList.add('sudden');
    } else {
      this.el.timer.textContent = this._fmt(gs.timer);
      this.el.timer.classList.toggle('low', gs.state === STATE.FIGHTING && gs.timer <= 10);
      this.el.timer.classList.remove('sudden');
    }

    // --- kéz-állapot oldalanként ---
    this._status(this.el.p1status, gs[P1], 'J1');
    this._status(this.el.p2status, gs[P2], 'J2');

    // --- közép banner az állapot szerint ---
    this._center(gs);

    // --- események: sérülés-villanás ---
    for (const ev of gs.events) {
      if (ev.type === 'hit') this.flash[ev.defender] = 0.55;
      if (ev.type === 'ko' && ev.loser) this.flash[ev.loser] = 0.8;
    }
    this.flash[P1] = Math.max(0, this.flash[P1] - dt * 2.2);
    this.flash[P2] = Math.max(0, this.flash[P2] - dt * 2.2);
    this.el.flashP1.style.opacity = this.flash[P1].toFixed(3);
    this.el.flashP2.style.opacity = this.flash[P2].toFixed(3);
  }

  _hp(fill, num, hp, invuln) {
    const pct = Math.max(0, Math.min(100, (hp / CFG.MAX_HP) * 100));
    fill.style.width = pct + '%';
    num.textContent = Math.ceil(hp);
    fill.classList.toggle('blink', invuln);
  }

  _fmt(sec) {
    const s = Math.ceil(sec);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ':' + String(r).padStart(2, '0');
  }

  _status(el, ps, label) {
    if (!ps.visible) {
      el.textContent = label + ' — mutasd a kezed ✋';
      el.className = 'status lost';
    } else if (!ps.present) {
      el.textContent = label + ' — tartsd a kezed';
      el.className = 'status grace';
    } else {
      el.textContent = '';
      el.className = 'status';
    }
  }

  _center(gs) {
    const c = this.el.center, sub = this.el.sub, stats = this.el.stats;
    c.className = 'center';
    stats.textContent = '';
    switch (gs.state) {
      case STATE.WAITING:
        c.textContent = 'SWORD DUEL';
        c.classList.add('title');
        sub.textContent = 'Álljatok a kamera elé és emeljétek fel a kezeteket! ✋  ✋';
        break;
      case STATE.COUNTDOWN: {
        const n = Math.ceil(gs.countdown);
        c.textContent = n >= 1 ? String(n) : 'HARC!';
        c.classList.add('count');
        sub.textContent = '';
        break;
      }
      case STATE.FIGHTING:
        c.textContent = '';
        sub.textContent = '';
        break;
      case STATE.ROUND_OVER:
        c.textContent = gs.reason === 'KO' ? 'K.O.!' : gs.reason === 'DRAW' ? 'DÖNTETLEN' : 'IDŐ!';
        c.classList.add('ko');
        sub.textContent = '';
        break;
      case STATE.VICTORY: {
        if (gs.winner) {
          const name = gs.winner === P1 ? 'JÁTÉKOS 1' : 'JÁTÉKOS 2';
          c.textContent = name + ' GYŐZ!';
          c.style.color = COLNAME[gs.winner];
          c.classList.add('win');
          const w = gs[gs.winner];
          stats.textContent = `Találatok: ${w.hits}  ·  Okozott sebzés: ${Math.round(w.dmgDealt)}`;
        } else {
          c.textContent = 'DÖNTETLEN';
          c.classList.add('win');
          c.style.color = '#e9d9ae';
        }
        sub.textContent = 'A visszavágóhoz emeljétek fel újra a kezeteket';
        break;
      }
    }
    if (gs.state !== STATE.VICTORY) c.style.color = '';
  }
}
