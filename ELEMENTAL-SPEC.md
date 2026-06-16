# Mohás Roham — Elemental Deepening: Definitive Implementation Spec

> Produced by a 12-agent research+design workflow (3 audits → 4 lens-diverse designs → judge → synthesis). All line numbers ground-truth-verified against `mohas-roham.html`, `mp-server/server.js`, `mp-server/public/net-client.js` at the time of writing (will drift as code changes).

---

## 1. OVERVIEW

### Vision
You are a forest warden loosing enchanted arrows into a night of mossy trolls. **One element is a status; two elements together is a spell.** Core loop = **read → swap → fire**: read what a troll carries (visible aura/eye-tint), swap element (keys 1–5), fire the element that *detonates* it. The glade participates — fire spreads through the treeline, ice melts into conductive puddles. Signature chain: **Ice → freeze → (fire) steam → puddle → (lightning) mega-conduction**. Charge scales potency; fast swaps bank a combo bonus; a charging **VIHAR** ultimate pre-seeds the field.

### Element identities
- **TŰZ (fire)** — escalating area-denial. Stacking DoT that spreads + ignites the forest. Detonates poison, steam-bursts ice.
- **JÉG (ice)** — control & setup. Slows, stacks to hard-freeze, leaves slippery frost and (on thaw) wet trolls. Combo enabler.
- **MÉREG (poison)** — attrition & softening. Low-burst stacking DoT + lingering gas; silences shaman heals. Becomes a bomb when ignited.
- **VILLÁM (lightning)** — burst & payoff. No DoT — hard stun that chains, *much* further through wet/clustered trolls. The detonator.

### Why element choice matters
(1) per-troll resistance/vulnerability, (2) reactions (right 2nd element = force multiplier), (3) environmental synergy (puddles/clusters/treelines multiply lightning/fire). Rewards reading the board and rotating elements.

### Key resolved decisions
- **Status model: HYBRID** — keep the single `m.statusEl/statusT/slowMul/burnAcc` primary slot (no risky multi-slot rewrite) + add `statusStacks` + independent flag-timers (`wet`, `charged`, `frozenSolid`, `lastReactT`). Delivers reactions+stacking+freeze+wet without rewriting the ~6 read sites.
- **Reactions:** fixed table resolved at the already-plumbed `elementMechanic(..., wasStatus)` chokepoint, gated by a 0.45s `lastReactT` cooldown + a `_reacted` frame-flag.
- **Environmental:** unified `zones[]` registry generalizing `gasClouds`.
- **CUT (per judges):** server-side tree-spread (server has no geometry → tree fire is client-cosmetic only); player slippery-skid + standing-in-fire self-damage (unfair); fake-momentum `_skid` vector (use honest `slowMul`); true multi-status map; hold-past-full ultimate (use dedicated key `R`).

---

## 2. MECHANICS

### 2.0 New monster fields
Add to `makeMonster` literal (SP) + mirror in server `spawnMonster`:

| Field | Init | Meaning |
|---|---|---|
| `statusStacks` | 1 | intensity of primary status (fire/poison ramp; ice→freeze threshold) |
| `wet` | 0 | seconds wet (ice-thaw/steam/puddle) — reaction + conduction |
| `charged` | 0 | seconds residual static (lightning leaves it) |
| `frozenSolid` | 0 | seconds of FULL freeze (hard CC) |
| `lastReactT` | 0 | last reaction timestamp (cooldown) |
| `resist` | from TROLL_TYPES | `{fire,ice,poison,lightning}` multipliers |

`clearStatus` resets stacks→1, frozenSolid→0; lets wet/charged decay (reaction window).

### 2.1 REACTIONS (the 5 named)
Resolved in `elementMechanic` (reaction dispatcher → else base mechanic). `wasStatus` is captured pre-hit.

- **(A) FAGYTÚLTÖLTÉS / Frozen Overload** — ice+lightning. Lightning on frozen (or ice on charged): burst dmg×1.2, shatter shell, arc to ALL wet/frozen within 9u (dmg×0.6 each, chain-shatter), 1.6s stun. Cyan-white. `shake 0.5`.
- **(B) GŐZROBBANÁS / Steam Burst** — fire+ice. Thermal shock: dmg×0.9, clears fire+ice, spawns steam zone (0.3s confuse), leaves `wet=2.5`. White puff.
- **(C) MÉRGES GYÚJTÁS / Toxic Ignition** — fire+poison (the explosion). AoE dmg×1.0 + `12+3×poisonStacks` to primary, dmg×0.5 within 4.5u (charge-scaled), applies fire stacks; ignites overlapping gas clouds. Green→orange. `shake 0.45`.
- **(D) GALVÁN PERMET / Galvanic Spray** — poison+lightning. Chains through poison: 3 nearest within 8u, dmg×0.4 + poison + 0.6s stun. Lime "poison-lightning".
- **(E) TELJES FAGY / Full Freeze** — ice deepening (stacks≥2, or charge≥0.85 at stacks≥1). `frozenSolid=2.0s`, can't move/attack, **+50% damage taken** (brittle).
- **Passive FROST-ROT** — poisoned+iced takes +30% poison DoT.

**Reaction matrix:**

| Incoming ↓ / on → | burning | frozen/iced | poisoned | wet/charged |
|---|---|---|---|---|
| FIRE | +1 fire stack | STEAM BURST | TOXIC IGNITION | (wet) clear wet, burst |
| ICE | STEAM BURST | →FULL FREEZE @stacks≥3 | FROST-ROT | (charged) FROZEN OVERLOAD |
| POISON | TOXIC IGNITION | brittle: poison+slow | +1 poison stack | (charged) GALVANIC SPRAY |
| LIGHTNING | minor arc | FROZEN OVERLOAD | GALVANIC SPRAY | CONDUCTION (wet) |

### 2.2 DEEPER STATUS
Extend `STATUS_CFG` with `leaves`, `maxStacks`, `dpsRamp`/`slowRamp`.
- **Fire/poison stack** (cap 3): DoT = `(dps + dpsRamp×(stacks-1))×resist`. Fire 7/10/13, poison 4/6/8.
- **Ice deepens slow** 0.45→0.35→0.25; stacks≥3 → FULL FREEZE.
- **Lightning no stack:** refresh 1.2s stun + `charged=2.0`; each chain hop sets `charged`.
- **Fire spread:** stacks≥2 → ~1/s applies 1 fire stack to nearest troll within 3u.
- **Poison corpse cloud:** poison-status death spawns a small gas cloud.

**Per-troll resist table** (>1 vulnerable, <1 resistant):

| Type | fire | ice | poison | lightning |
|---|---|---|---|---|
| wisp (Lidérc) | 1.5 | 0.4 | 0.8 | 1.0 |
| grunt (Mohás) | 1.4 | 1.0 | 1.0 | 1.0 |
| scout (Kobold) | 1.2 | 1.3 | 0.5 | 1.2 |
| brute (Kőbunkó) | 0.5 | 0.6 | 0.9 | 1.4 |
| shaman (Sámán) | 1.0 | 1.0 | 1.3 | 1.5 |
| spitter (Köpködő) | 1.4 | 1.0 | 0.4 | 1.0 |

Identity one-liners: poison on shaman blocks heal; ice/freeze on scout cancels dash; lightning re-stun on brute. Resist tell: grey fizzle when resist<0.6, bright pulse when >1.3.

### 2.3 ENVIRONMENTAL
Generalize `gasClouds` → `zones[]` (`updateElemFx`→`updateZones`, cap 10, 0.5s tick).

| Kind | Source | Effect | Tuning |
|---|---|---|---|
| gas | poison/Galvanic | 3 dmg/0.5s + poison | r→2.2, 4.5s |
| fire | Toxic Ignition / fire ground / burning tree | 5 dmg/0.5s + fire stack | r→2.5, 5s |
| frost | ice ground/death | slowMul→0.55 + ice stack/0.8s | r→2.4, 6s |
| puddle | steam expiry / thaw | sets wet=2 — **conducts lightning** | r→2.5, 6s |
| steam | Steam Burst | 0.3s confuse | r 3.5, 1.5s |

- **Slippery = honest slowMul only** (no fake momentum).
- **Tree ignition (SP/client-cosmetic):** `flammables[]`; fire zone within r+0.8 ignites → tinted foliage + embers; spreads to nearest unburnt within ~4u once/1.5s. Caps: ≤6 burning, 6/wave budget.
- **Lightning conduction:** wet/puddle = preferred targets, radius 7→10u, dmg×0.9, re-conduct (cap 5 nodes); a struck troll in a puddle electrifies the whole pool.
- **Player NOT affected by zones.**

### 2.4 PLAYER-SYSTEMS
- **Charge-scaled power:** stamp `a.charge` in fireArrow. charge≥0.66 → 2 stacks; scales reaction radius/dmg, chain hops `2+floor(charge×2)`, full-charge drops zones.
- **VÁLTÓ-LENDÜLET (Resonance):** firing within 1.2s of a swap → +30% reaction dmg + bypasses reaction cooldown. Gold pulse on active chip.
- **VIHAR ultimate:** meter `ult` 0–100 (reaction +12, elem kill +6, freeze +4, headshot +2). Key **R** at full. Effect = slow expanding nova applying the equipped element at 3 stacks to every troll swept — pre-seeds the field. No arrows consumed from pool.

---

## 3–4. IMPLEMENTATION (SP + CO-OP)

**SP** — modify: `STATUS_CFG`, `TROLL_TYPES` (+resist), `makeMonster`, `applyStatus(+charge,stacks)`, `clearStatus`, `tickStatus`, `elementMechanic`→reaction dispatcher, `chainLightning` (wet/conduction), `updateElemFx`→`updateZones`, `fireArrow` (+a.charge), `setElement` (+lastSwapT), `updateElementHUD`, `trollAI` (frozenSolid gate + identity), hit handler, main loop (ult tick), keydown (R). Add: `spawnZone`+kinds, `REACTIONS`+`resolveReaction`+`applyReaction`, `freezeFull`, `buildFlammables`/`igniteTree`, `fireVihar`, `buildUltHud`/`updateUltBar`.

**CO-OP (server-authoritative)** — authority rule: **server owns status/DoT/slow/stun/reactions/chains/kills/score; client renders FX only**. Protocol: `arrow_fired`+`el`,`charge`; `hit`+`el`,`charge`; confirmed `hit`+`reaction`,`reactPos`,`hitIds[]`; **NEW `monster_fx`** frame (status/reaction/chain/zone/kill events) + new `onMonsterFx` hook wired in HTML (the existing `onMonsters` slot is routed but never fed — use an explicit new type). Server: status fields + RESIST in spawnMonster; reaction/chain resolution in hit handler (synchronous, single death authority); DoT/slow/freeze + DoT-death in stepWaves (collect dead, filter AFTER loop); `room.zones[]` (cap 8). Client maps `monster_fx` → visual-only helpers (no hp). Ult: C→S `ult{el}` validated server-side.

## 5. PERFORMANCE & RISKS
Ring caps: RP 2600 / SMK 360 / sparks 400 / gore 500 / flash 44 / ring 22 / bolt 18; ≤14 monsters, 30 arrows. Throttle sustained emitters (`Math.random()<0.3–0.5`); aura cap 2 RP/1 SMK per troll/frame. Zone cap 10 (SP)/8 (server) @0.5s. Fire spread ≤6 burning, 6/wave. Reaction cooldown 0.45s + `_reacted` flag. Co-op: single death authority, render-only client FX, server-side randomness with explicit `hitIds[]`. Add `iceShell` disposal to `disposeMonster`.

## 6. PHASED BUILD ORDER (fun-per-effort)
1. **Reaction matrix + charge power (SP)** — the 5 reactions + stacking + charge + freeze gate. *Ships the whole reaction fantasy.*
2. **Deeper status + resistances (SP)** — resist table, identity one-liners, fire spread, corpse cloud, resist tells.
3. **Environmental zones (SP)** — zones[] generalization, fire/frost/puddle/steam, tree ignition, conduction.
4. **Player systems (SP)** — Resonance swap-combo + VIHAR ultimate.
5. **Co-op parity (server-authoritative)** — the big engineering lift: server status/reactions/DoT/zones + `monster_fx` protocol + client render mapping.
6. **Co-op ultimate** — server-resolved nova.

Each phase is independently shippable and leaves the game coherent.
