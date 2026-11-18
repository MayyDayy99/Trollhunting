// Gameplay numbers that the browser game AND the co-op server (mp-server/server.js) must agree on.
// Pure data, no imports: the game reads it as `SHARED` (see vite.config.js), the server imports it.
// Change a value here and both sides change together.

// Troll caves: angle around the clearing (radians) and distance from the centre.
export const R_CAVE = 52.5;
export const CAVE_ANGS = [0.5, 1.4, 2.3, 3.2, 4.1, 5.0, 5.9];

// Share of trolls that spawn without an element (the rest get a random element).
export const EL_NULL_CHANCE = 0.20;

// Status effects per element (the client adds its own tint colours on top).
export const STATUS = {
  fire:      { dur: 4.0, dps: 7, slow: 1.0,  stun: 0,   maxStacks: 3, dpsRamp: 3,       leaves: '' },
  ice:       { dur: 3.0, dps: 0, slow: 0.45, stun: 0,   maxStacks: 3, slowRamp: -0.10,  leaves: 'wet' },
  poison:    { dur: 6.0, dps: 4, slow: 0.85, stun: 0,   maxStacks: 3, dpsRamp: 2,       leaves: '' },
  lightning: { dur: 1.2, dps: 0, slow: 1.0,  stun: 1.2, maxStacks: 1,                   leaves: 'charged' },
};

// Per troll type: size / health / speed multipliers, elemental damage taken, innate element.
// (`speedCap` is NOT shared yet: the client was retuned ~25% faster and the server kept the old caps.)
export const TROLL_BASE = {
  wisp:    { el: 'ice',       scaleMul: 0.95, hpMul: 0.8,  speedMul: 1.2,  resist: { fire: 1.0, ice: 0.35, poison: 0.8, lightning: 1.0 } },
  grunt:   { el: null,        scaleMul: 1.00, hpMul: 1.0,  speedMul: 1.0,  resist: { fire: 1.4, ice: 1.0,  poison: 1.0, lightning: 1.0 } },
  scout:   { el: 'fire',      scaleMul: 0.62, hpMul: 0.45, speedMul: 2.1,  resist: { fire: 1.2, ice: 1.3,  poison: 0.5, lightning: 1.2 } },
  brute:   { el: 'lightning', scaleMul: 1.70, hpMul: 3.4,  speedMul: 0.55, resist: { fire: 0.5, ice: 0.6,  poison: 0.9, lightning: 1.4 } },
  shaman:  { el: null,        scaleMul: 1.05, hpMul: 1.3,  speedMul: 0.8,  resist: { fire: 1.0, ice: 1.0,  poison: 1.3, lightning: 1.5 } },
  spitter: { el: 'poison',    scaleMul: 1.05, hpMul: 0.9,  speedMul: 0.7,  resist: { fire: 1.4, ice: 1.0,  poison: 0.4, lightning: 1.0 } },
  shard:   { el: null,        scaleMul: 0.62, hpMul: 0.9,  speedMul: 1.15, resist: { fire: 0.6, ice: 0.7,  poison: 0.9, lightning: 1.3 } },
};

// The same entries as TROLL_TYPES expects them: `el` only where a type has one.
export function trollBase(type) {
  const { el, ...rest } = TROLL_BASE[type];
  return el ? { el, ...rest } : rest;
}
