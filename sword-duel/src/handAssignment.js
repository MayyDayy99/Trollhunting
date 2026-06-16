// ============================================================================
// handAssignment.js — egy kameráról érkező 0..N kéz hozzárendelése a 2 slothoz.
// P1 = bal oldali játékos, P2 = jobb oldali. NEM a MediaPipe handedness alapján
// (az két ember mellett megbízhatatlan), hanem vízszintes pozíció + frame-közi
// legközelebbi-szomszéd követés + grace (rövid elvesztés tűrése).
// Bemenet: normalizált+tükrözött kezek [{wrist:{x,y}, indexTip:{x,y}, score}].
// Kimenet: [slotP1, slotP2] — present (most követve), visible (present || grace).
// ============================================================================

import { CFG, P1, P2 } from './config.js';

function dist2(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export class HandAssigner {
  constructor(cfg = CFG) {
    this.cfg = cfg;
    this.slots = [
      this._newSlot(P1, -1, { x: -0.5, y: 0 }),
      this._newSlot(P2, +1, { x: 0.5, y: 0 }),
    ];
  }

  _newSlot(id, side, pos) {
    return {
      id, side,
      wrist: { x: pos.x, y: pos.y },
      indexTip: { x: pos.x, y: pos.y },
      score: 0,
      present: false,    // most ténylegesen követve (csak ekkor támadhat)
      visible: false,    // present || grace-ablak (ekkor még rajzoljuk)
      missing: 9999,     // hány frame óta nincs meg
      hasHistory: false, // volt-e már valódi pozíciója
      justAcquired: false, // most szereztük vissza (szűrő-reset jelzés)
      _matched: false,
    };
  }

  _apply(slot, hand) {
    slot.justAcquired = slot.missing > 0 || !slot.hasHistory;
    slot.wrist.x = hand.wrist.x; slot.wrist.y = hand.wrist.y;
    slot.indexTip.x = hand.indexTip.x; slot.indexTip.y = hand.indexTip.y;
    slot.score = hand.score;
    slot._matched = true;
  }

  assign(hands) {
    const cfg = this.cfg, slots = this.slots;
    const used = new Array(hands.length).fill(false);
    for (const s of slots) { s._matched = false; s.justAcquired = false; }

    // 1) Aktív slotok követése: legkisebb távolságú élek előbb (helyes 2x2 esetén is).
    const r2 = cfg.MATCH_RADIUS * cfg.MATCH_RADIUS;
    const pairs = [];
    for (let si = 0; si < 2; si++) {
      const s = slots[si];
      if (!(s.hasHistory && s.missing <= cfg.GRACE_FRAMES)) continue;
      for (let hi = 0; hi < hands.length; hi++) {
        pairs.push({ si, hi, d: dist2(hands[hi].wrist, s.wrist) });
      }
    }
    pairs.sort((a, b) => a.d - b.d);
    for (const p of pairs) {
      if (slots[p.si]._matched || used[p.hi]) continue;
      if (p.d <= r2) { this._apply(slots[p.si], hands[p.hi]); used[p.hi] = true; }
    }

    // 2) Akvizíció: maradék kezek -> üres slotok, x-sorrend szerint (bal->P1).
    const freeSlots = slots.filter((s) => !s._matched);
    const freeHands = [];
    for (let hi = 0; hi < hands.length; hi++) if (!used[hi]) freeHands.push(hands[hi]);
    if (freeSlots.length && freeHands.length) {
      freeHands.sort((a, b) => a.wrist.x - b.wrist.x);
      freeSlots.sort((a, b) => a.side - b.side); // P1 (-1) előbb
      const n = Math.min(freeSlots.length, freeHands.length);
      for (let k = 0; k < n; k++) this._apply(freeSlots[k], freeHands[k]);
    }

    // 3) Véglegesítés: present / missing / visible / grace.
    for (const s of slots) {
      if (s._matched) {
        s.present = true; s.visible = true; s.missing = 0; s.hasHistory = true;
      } else {
        s.present = false; s.missing++;
        s.visible = s.hasHistory && s.missing <= cfg.GRACE_FRAMES;
        if (s.missing > cfg.GRACE_FRAMES) s.hasHistory = false;
      }
    }
    return [slots[0], slots[1]];
  }
}
