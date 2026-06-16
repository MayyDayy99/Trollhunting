// ============================================================================
// game.js — állapotgép + szabályok. Fogadja a kard-állapotokat, lefuttatja az
// ütközést, alkalmazza a sebzést/cooldownt, dönt az átmenetekről.
// update(swords, dt, nowSec) -> gs pillanatkép (a scene/ui ebből dolgozik).
// ============================================================================

import { CFG, P1, P2, STATE } from './config.js';
import { resolve } from './collision.js';

const SPEED_SANITY = 80; // ennél nagyobb hegysebesség = követési hiba, eldobjuk

function newPlayer() {
  return { hp: CFG.MAX_HP, invuln: 0, cooldown: 0, hits: 0, dmgDealt: 0 };
}

export class Game {
  constructor() {
    this.players = { [P1]: newPlayer(), [P2]: newPlayer() };
    this.state = STATE.WAITING;
    this.timer = CFG.MATCH_SEC;
    this.countdown = CFG.COUNTDOWN_SEC;
    this.stateTime = 0;
    this.bothFrames = 0;
    this.clashLock = 0;
    this.suddenDeath = false;
    this.winner = null;
    this.reason = null;
    this._lastTick = 0;
    this._swords = null;
  }

  _resetMatch() {
    this.players[P1] = newPlayer();
    this.players[P2] = newPlayer();
    this.timer = CFG.MATCH_SEC;
    this.suddenDeath = false;
    this.winner = null;
    this.reason = null;
    this.clashLock = 0;
  }

  _damage(speed) {
    const t = (speed - CFG.HIT_SPEED) / (CFG.REF_SPEED - CFG.HIT_SPEED);
    const d = CFG.DMG_BASE * t;
    return Math.round(Math.min(CFG.MAX_DMG, Math.max(CFG.MIN_DMG, d)));
  }

  _applyHit(att, def, info, events) {
    if (info.speed > SPEED_SANITY) return; // glitch elleni védelem
    const dmg = this._damage(info.speed);
    const dp = this.players[def];
    dp.hp = Math.max(0, dp.hp - dmg);
    const ap = this.players[att];
    ap.hits++; ap.dmgDealt += dmg;
    dp.invuln = CFG.INVULN;
    ap.cooldown = CFG.ATTACK_COOLDOWN;
    events.push({ type: 'hit', attacker: att, defender: def, pos: info.pos, damage: dmg });
  }

  _endRound(reason, events) {
    this.reason = reason;
    if (reason === 'DRAW') {
      this.winner = null;
    } else if (reason === 'KO') {
      this.winner = this.players[P1].hp > 0 ? P1 : P2;
    } else { // TIMEOUT
      this.winner = this.players[P1].hp >= this.players[P2].hp ? P1 : P2;
    }
    if (reason === 'KO' && this.winner) {
      const loser = this.winner === P1 ? P2 : P1;
      const pos = this._swords[loser].guard.clone();
      events.push({ type: 'ko', loser, winner: this.winner, pos });
    } else if (reason === 'DRAW') {
      // dupla-KO / döntetlen: semleges robbanás a két kéz felénél
      const pos = this._swords[P1].guard.clone().add(this._swords[P2].guard).multiplyScalar(0.5);
      events.push({ type: 'ko', loser: null, winner: null, pos });
    }
    this.state = STATE.ROUND_OVER;
    this.stateTime = 0;
  }

  update(swords, dt, nowSec) {
    this._swords = swords;
    const events = [];
    const s1 = swords[P1], s2 = swords[P2];

    // időzítők csökkentése (állapottól függetlenül)
    for (const id of [P1, P2]) {
      const p = this.players[id];
      if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
      if (p.cooldown > 0) p.cooldown = Math.max(0, p.cooldown - dt);
    }
    if (this.clashLock > 0) this.clashLock = Math.max(0, this.clashLock - dt);

    switch (this.state) {
      case STATE.WAITING: {
        this.winner = null; this.reason = null;
        if (s1.present && s2.present) this.bothFrames++;
        else this.bothFrames = 0;
        if (this.bothFrames >= CFG.CALIB_FRAMES) {
          this._resetMatch();
          this.state = STATE.COUNTDOWN;
          this.countdown = CFG.COUNTDOWN_SEC;
          this._lastTick = Math.ceil(CFG.COUNTDOWN_SEC) + 1;
        }
        break;
      }

      case STATE.COUNTDOWN: {
        if (!s1.visible || !s2.visible) { // valaki teljesen eltűnt
          this.state = STATE.WAITING;
          this.bothFrames = 0;
          break;
        }
        this.countdown -= dt;
        const tick = Math.ceil(this.countdown);
        if (tick !== this._lastTick && tick >= 1) {
          this._lastTick = tick;
          events.push({ type: 'countTick', n: tick });
        }
        if (this.countdown <= 0) {
          this.state = STATE.FIGHTING;
          events.push({ type: 'fightStart' });
        }
        break;
      }

      case STATE.FIGHTING: {
        if (!this.suddenDeath) this.timer -= dt;

        const res = resolve(s1, s2);
        if (res.clash) {
          this.clashLock = CFG.CLASH_LOCKOUT;
          events.push({ type: 'clash', pos: res.clash.pos });
        } else if (this.clashLock <= 0) {
          if (res.p1HitsP2 && this.players[P1].cooldown <= 0 && this.players[P2].invuln <= 0) {
            this._applyHit(P1, P2, res.p1HitsP2, events);
          }
          if (res.p2HitsP1 && this.players[P2].cooldown <= 0 && this.players[P1].invuln <= 0) {
            this._applyHit(P2, P1, res.p2HitsP1, events);
          }
        }

        const dead1 = this.players[P1].hp <= 0;
        const dead2 = this.players[P2].hp <= 0;
        if (dead1 || dead2) {
          // egyidejű dupla-KO = döntetlen (szimmetrikus), nem P2 győzelme
          this._endRound(dead1 && dead2 ? 'DRAW' : 'KO', events);
        } else if (this.timer <= 0 && !this.suddenDeath) {
          if (this.players[P1].hp !== this.players[P2].hp) {
            this._endRound('TIMEOUT', events);
          } else if (CFG.DRAW_ALLOWED) {
            this._endRound('DRAW', events);
          } else {
            this.suddenDeath = true; // döntetlen -> hirtelen halál
            this.timer = 0;
          }
        }
        break;
      }

      case STATE.ROUND_OVER: {
        this.stateTime += dt;
        if (this.stateTime >= CFG.FREEZE_SEC) {
          this.state = STATE.VICTORY;
          this.stateTime = 0;
          events.push({ type: 'victory', winner: this.winner });
        }
        break;
      }

      case STATE.VICTORY: {
        this.stateTime += dt;
        if (this.stateTime >= CFG.VICTORY_SEC) {
          this.state = STATE.WAITING;
          this.bothFrames = 0;
        }
        break;
      }
    }

    return {
      state: this.state,
      timer: Math.max(0, this.timer),
      countdown: Math.max(0, this.countdown),
      suddenDeath: this.suddenDeath,
      reason: this.reason,
      winner: this.winner,
      [P1]: this._playerSnap(P1, s1),
      [P2]: this._playerSnap(P2, s2),
      events,
    };
  }

  _playerSnap(id, sword) {
    const p = this.players[id];
    return {
      hp: p.hp,
      hits: p.hits,
      dmgDealt: p.dmgDealt,
      present: sword.present,
      visible: sword.visible,
      invuln: p.invuln > 0,
    };
  }
}
