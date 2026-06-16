// ============================================================================
// collision.js — tiszta geometria. Nincs állapot, csak eseményeket ad vissza.
// Minden a z=0 síkon (2.5D), THREE.Vector3-mal (z-t 0-nak vesszük a matekhoz).
// ============================================================================

import * as THREE from 'three';
import { CFG } from './config.js';

// Pont -> szakasz távolság négyzete + a legközelebbi pont a szakaszon.
function closestPtPointSegment(p, a, b, out) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const apx = p.x - a.x, apy = p.y - a.y, apz = p.z - a.z;
  const abLen2 = abx * abx + aby * aby + abz * abz;
  let t = abLen2 > 1e-9 ? (apx * abx + apy * aby + apz * abz) / abLen2 : 0;
  t = Math.max(0, Math.min(1, t));
  out.set(a.x + abx * t, a.y + aby * t, a.z + abz * t);
  return out;
}

export function segmentPointDistance(a, b, p) {
  const c = closestPtPointSegment(p, a, b, _tmp1);
  return Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z);
}

// Szakasz-szakasz legkisebb távolság + a legközelebbi pontok felezője.
// Ericson, Real-Time Collision Detection alapján.
export function segmentSegmentDistance(p1, q1, p2, q2, midOut) {
  const d1 = _v(q1.x - p1.x, q1.y - p1.y, q1.z - p1.z); // szakasz1 iránya
  const d2 = _v(q2.x - p2.x, q2.y - p2.y, q2.z - p2.z); // szakasz2 iránya
  const r = _v(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z);
  const a = dot(d1, d1);
  const e = dot(d2, d2);
  const f = dot(d2, r);

  let s, t;
  const EPS = 1e-9;
  if (a <= EPS && e <= EPS) {
    s = 0; t = 0;
  } else if (a <= EPS) {
    s = 0;
    t = clamp01(f / e);
  } else {
    const c = dot(d1, r);
    if (e <= EPS) {
      t = 0;
      s = clamp01(-c / a);
    } else {
      const b = dot(d1, d2);
      const denom = a * e - b * b;
      s = denom > EPS ? clamp01((b * f - c * e) / denom) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp01(-c / a); }
      else if (t > 1) { t = 1; s = clamp01((b - c) / a); }
    }
  }

  const c1x = p1.x + d1.x * s, c1y = p1.y + d1.y * s, c1z = p1.z + d1.z * s;
  const c2x = p2.x + d2.x * t, c2y = p2.y + d2.y * t, c2z = p2.z + d2.z * t;
  if (midOut) midOut.set((c1x + c2x) * 0.5, (c1y + c2y) * 0.5, (c1z + c2z) * 0.5);
  return Math.hypot(c1x - c2x, c1y - c2y, c1z - c2z);
}

// --- segédek ---
const _tmp1 = new THREE.Vector3();
const _midTmp = new THREE.Vector3();
function _v(x, y, z) { return { x, y, z }; }
function dot(u, v) { return u.x * v.x + u.y * v.y + u.z * v.z; }
function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

// ----------------------------------------------------------------------------
// resolve — pusztán geometria + sebesség alapú detektálás.
// A zár / sérthetetlenség / cooldown / sebzés a game.js dolga.
// swordState = { guard:Vec3, tip:Vec3, speed:Number, present:Bool }
// Visszaad: { clash:{pos}|null, p1HitsP2:{pos,speed}|null, p2HitsP1:{pos,speed}|null }
// ----------------------------------------------------------------------------
export function resolve(s1, s2) {
  const result = { clash: null, p1HitsP2: null, p2HitsP1: null };
  if (!s1.present || !s2.present) return result;

  // 1) Pengeváltás (blokk) — a két HEGY ér össze (szándékos hárítás).
  // FONTOS: NEM teljes penge-szakasz alapú, különben az egymással szembe tartott
  // pengék (amik végig fednék egymást) mindig blokkolnának, és sosem lenne találat.
  const tdx = s1.tip.x - s2.tip.x, tdy = s1.tip.y - s2.tip.y;
  const tipDist = Math.hypot(tdx, tdy);
  if (tipDist < CFG.CLASH_R) {
    _midTmp.set((s1.tip.x + s2.tip.x) * 0.5, (s1.tip.y + s2.tip.y) * 0.5, 0);
    result.clash = { pos: _midTmp.clone() };
    return result; // blokk esetén ebben a frame-ben nincs találat
  }

  // 2) Találat: a támadó pengéje a védő sebezhető gömbjébe ér, elég gyorsan.
  const d1 = segmentPointDistance(s1.guard, s1.tip, s2.guard); // P1 pengéje vs P2 keze
  if (d1 < CFG.HURT_R && s1.speed > CFG.HIT_SPEED) {
    result.p1HitsP2 = { pos: s2.guard.clone(), speed: s1.speed };
  }
  const d2 = segmentPointDistance(s2.guard, s2.tip, s1.guard); // P2 pengéje vs P1 keze
  if (d2 < CFG.HURT_R && s2.speed > CFG.HIT_SPEED) {
    result.p2HitsP1 = { pos: s1.guard.clone(), speed: s2.speed };
  }
  return result;
}
