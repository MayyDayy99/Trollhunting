# Elemental Combat — Claude Code Integration Spec

> **Audience:** Claude Code, integrating the elemental arrow system into
> `mp-server/public/mohas-roham.html` (first-person archery survival, Three.js
> r128, flat-shaded). This document is the *gameplay-agnostic visual contract*.
> The runnable reference for every behavior below is
> [`fx/element-fx.js`](./fx/element-fx.js) — a 2D port whose structure mirrors
> the game's 3D one (see its header). Colors live in
> [`../tokens/elements.css`](../tokens/elements.css).

Per the brief these are **visual** specs, but a **working reference build is
already implemented** — see below.

## ✅ Working reference build

`game/mohas-roham-elemental.html` is a **full, runnable integration** of this
system into the game (single-player). It boots clean and adds: 5 arrow types
(1–5 keys), per-element head tint + glow + flight trail, element-colored impact
bursts, enemy status (burn/freeze/poison/shock) with auras, and elemental death
flourishes. **Diff it against `mp-server/public/mohas-roham.html`** to see the
exact ~10 surgical edits (every change is tagged `// ELEM:` in the source).

The integration reuses the game's own systems — the additive `sparks`/`gore`
`Particles` pools, `killMonster`, the `m.rooted` field (for stun), `m.eyes`
materials (for status tint), and `moveToward` (for slow). No new dependencies.

**Implemented gameplay defaults** (sane starting values — tune in `STATUS_CFG`
inside the file):

| Element | Status | DoT | Slow | Stun | Duration |
|---|---|---|---|---|---|
| 🔥 Fire | burning (ÉG) | 7 dmg/s | — | — | 4.0 s |
| ❄ Ice | frozen (FAGY) | — | ×0.45 (55% slower) | — | 3.0 s |
| ☠ Poison | poisoned (MÉREG) | 4 dmg/s | ×0.85 | — | 6.0 s |
| ⚡ Lightning | shocked (SOKK) | — | — | 1.2 s | 1.2 s |
| Base | — (plain) | — | — | — | — |

The sections below remain the *contract* (where/why), so you can re-derive or
extend the build. `// TUNE:` still marks anything left intentionally open.

---

## 0. Where this plugs into the existing game

All references are to `mp-server/public/mohas-roham.html`. Hook points, in the
order an arrow's life touches them:

| Game symbol (search the file) | What it does today | Elemental addition |
|---|---|---|
| material consts (`arrowWood`, `metalMat`, `featherMat`, `eyeMat`, `spitMat`, `staffMat`) | stock flat-shaded mats | clone + tint per element (don't mutate shared mats) |
| `makeArrow()` (~L907) | builds the pooled arrow group (shaft, `metalMat` tip, feathers); pool of 30 | give each arrow an `el` field + a child glow sprite + tiny `PointLight(el-light)`; attach a trail emitter |
| `fireArrow(charge)` (~L917) | speed `22+charge*30`, `dmg 18+charge*30`, `orientArrow`, `AUD.twang`, `coopOnShot` | stamp `a.el = currentElement`; apply the arrow's element visual; co-op already relays `from/dir/power` — add `el` to that payload |
| arrow update loop (per-frame, after `fireArrow`) | integrates `vel` w/ `GRAV=9.2`, segment-tests vs monsters, headshot = 2× | on hit → spawn **impact burst** (§2) in the arrow's element color, then `monster.applyStatus(a.el)` (§3) |
| `makeMonster(T)` / the monster factory (~L1040–1190) | clones mats per type (melee, **spitter** toad w/ bile, **mystic** mage w/ staff crystal); `T.eyeColor` | snapshot base colors → `m.baseTint`; add `m.applyStatus(el)`, `m.clearStatus()`, `m.statusEl`, `m.statusT` |
| monster death / `disposeMonster(m)` | frees geometry/material | run **death animation** (§4) first: base crumble + elemental override |
| the additive `THREE.Points` burst already used for impacts/dust | particle pool | reuse for trails (§1) + impacts (§2) + auras (§3); only the color set + spawn rate change per element |

**Authoring rule:** never mutate a *shared* material — `clone()` it (the game
already does `eyeMat.clone()`), tint the clone, and dispose it with the monster
(the spitter/mystic already register `m.spitMat`/`m.staffMat` for disposal —
follow that pattern for `m.statusMat`).

**Current element:** add a single `currentElement` global (`'base' | 'fire' |
'ice' | 'poison' | 'lightning'`), cycled by `1–5` keys or mouse-wheel, surfaced
in the HUD by the `ElementSelector` component (see `components/hud`). Default
`'base'` so nothing changes until the player picks an element.

---

## 1. Arrow + trail (in flight)

Reference: `drawArrow()` and the `mode:'arrow'` branch in `element-fx.js`.

- **Head/core:** retint the `metalMat` tip clone → `emissive = --el-<e>-core`,
  `emissiveIntensity ≈ 1.4`, keep `flatShading:true`. Add a child glow **sprite**
  (the game's `glowSprite` helper) tinted `--el-<e>-glow`, scale ~0.4.
- **Light:** parent a `THREE.PointLight(--el-<e>-light, 0.6, 6)` to the arrow so
  it lights the glade as it passes (fire warm, ice cold, etc.). `base` ≈ 0.2.
- **Trail:** emit ~`CFG.<e>.emit` additive points/sec from just behind the head
  (`-18` along the shaft), color picked along the **core→mid→glow→spark** ramp,
  size `~CFG.<e>.trailSize`, life 0.3–0.7 s, gravity **sign per element**
  (`CFG.<e>.grav`): fire RISES (negative), poison droops, ice/lightning ≈ 0.
- **Per-element flourish:**
  - **fire** — wide, flickering ember trail + faint smoke (`--el-fire-deep`).
  - **ice** — tight pale-cyan trail, occasional drifting frost mote.
  - **poison** — globby green trail, a few droplets fall away.
  - **lightning** — short, jittering forked arc hugging the shaft (`bolt()` in
    the ref); near-straight, almost no drop.
  - **base** — thin white-cyan streak, minimal.

---

## 2. Impact burst (on hit)

Reference: `burst()` in `element-fx.js`.

- One-shot: **26–40** additive points (fire highest) from the hit point,
  random direction, speed `40 → 60+power*90`, slight upward bias, gravity as the
  pooled dust burst, life 0.3–0.8 s, colors along the element ramp.
- Add a **1-frame flash**: a bright `--el-<e>-glow` sprite that scales up and
  fades in ~0.4 s (see `flashes[]`), plus a brief boost to the arrow's
  `PointLight` intensity.
- **Headshot:** the game already doubles damage — also **double the particle
  count** and flash size for readable feedback.
- Element-specific accents: ice throws a few angular white shards; lightning adds
  a quick ground-arc; poison leaves a small lingering splat decal; fire pushes a
  puff of smoke.

---

## 3. Enemy status aura (while afflicted)

Reference: `drawTroll()` + `emitAura()` + `statusTint()` in `element-fx.js`.

When an elemental arrow hits, set `m.statusEl = a.el` and `m.statusT = now`.
While active (`// TUNE:` duration), each frame:

1. **Tint the troll:** multiply every *non-emissive* body material color by
   `--status-<e>` (clone into `m.statusMat`, swap on the body meshes; keep eyes/
   crystal emissive as-is). Restore `m.baseTint` in `clearStatus()`.
2. **Signature emitter** (counts/dirs in `emitAura()`):
   - **burning (fire)** — orange flame licks rising off the body + a warm ground
     glow; eyes flare brighter.
   - **frozen (ice)** — translucent blue **encasement** (a slightly enlarged,
     semi-transparent ice shell over the silhouette) + slow drifting frost + a
     soft cyan halo; `// TUNE:` movement-speed multiplier < 1.
   - **poisoned (poison)** — green rising bubbles that pop + droplets dripping
     down; sickly green rim.
   - **shocked (lightning)** — white arcs jumping across the body (`bolt()`),
     crackle motes, a brief `// TUNE:` stun/twitch on the AI.
3. Stack rule: a new element **replaces** the prior status (swap tint + emitter).

---

## 4. Death animation (base + elemental override)

Reference: `runDeath()` + `deathOverride()` in `element-fx.js`. Two layers, always
play the base, then overlay the element of the killing blow (`m.statusEl` or the
arrow's `el`).

**Base crumble (every death):**
1. *Phase 1 (0–0.25 s):* hit-tint flash (`mixHitTint`) + small knockback along
   the arrow direction; the troll stays whole.
2. *Phase 2 (0.25–end ≈ 2.6 s):* detach the monster's primitive meshes into
   ~12–16 "chunks", give each an outward+down velocity (gravity ~220), fade to 0.
   (You already have the meshes from `makeMonster` — reparent to a temp group and
   animate, or spawn matched debris cubes and hide the original.)

**Elemental override (layered on the crumble):**
- **fire** — body bursts to **ash + rising flame**, then thin smoke; warm flash.
- **ice** — **shatter**: ~30 angular shards fly out once on a single frame, a
  cold flash, then they fall and fade (skip the soft crumble; pieces are shards).
- **poison** — **melt**: the silhouette slumps into a bubbling green **puddle**
  decal that spreads and sinks; bubbles keep rising for ~1 s.
- **lightning** — **char**: violent white arcs across the husk for ~0.4 s, the
  body blackens (`--el-lightning-deep` over the tint), then collapses.
- **base** — dust puffs only.

Co-op: death is cosmetic; the **server** already confirms the kill + score
(`hit` → `killed/score`). Trigger the animation from the confirmed `onHit`, not
locally, when `coop` is active (see `INTEGRATION.md`).

---

## 5. New troll types (designed — build recipes in `guidelines/troll-*.html`)

The game has **melee**, **spitter** (toad, bile projectile), **mystic** (mage,
staff crystal). Two additions, each built from the same flat-shaded primitive
vocabulary and reacting to all statuses:

- **Brute (Zúzó)** — a big, slow tank: doubled body spheres, boulder-fists,
  bark-plated shoulders, lichen `#9fb59f` armor, deep `#41704e` moss. High HP,
  shrugs off small hits (brief flinch only). Eye glow `#ff5a2a`. *Weakness flavor:*
  reads great on **fire** (charring) and **lightning** (arcs jump the plates).
- **Wisp-troll (Lidérc)** — a small, fast, half-translucent sprite-troll lit from
  within by **cyan rune light** (`#36c5ff` emissive core, `--rune-deep` body at
  low opacity). Darts in zig-zags. *Weakness flavor:* **ice** (freezes the wisp
  solid) and **poison** (the glow sickens to green).

See `guidelines/troll-brute.html` and `guidelines/troll-wisp.html` for palettes,
proportions, and a primitive-by-primitive build list.

---

## 6. Player character — the Ranger (co-op avatars)

A hooded forest ranger that fits the mossy world; needed because co-op shows
**peer archers** (`state.players` in the server protocol). Design sheet +
4-player color set in `guidelines/character-ranger.html`. Summary:

- **Silhouette:** hooded cloak, light leather, a longbow matching the in-hand bow
  (`staveWood`), a back quiver whose fletching glows the player's color.
- **Build:** capsule torso + cloak cone + hood cone + simple limbs (same
  primitive style as the trolls) — cheap to instance for 3 peers.
- **4 co-op colors** (cloak trim + quiver glow + nameplate), chosen to stay
  legible against forest-night and distinct from troll-green/eye-orange:
  P1 `--rune #36c5ff` (cyan), P2 `--gold #ffd27a` (amber),
  P3 `#9f6aff` (violet), P4 `#5fd08a` (spring green).
- Peer avatars interpolate transform from `player_state`; render a simple
  draw-back pose when `arrow_fired` arrives.

---

## 7. Integration checklist

- [ ] Add `currentElement` + 1–5 / wheel cycling + `ElementSelector` HUD.
- [ ] `makeArrow`: per-arrow `el`, glow sprite, `PointLight`, trail emitter (§1).
- [ ] `fireArrow`: stamp `el`; include `el` in `coopOnShot` payload.
- [ ] On-hit: impact burst (§2) + `monster.applyStatus(el)` (§3).
- [ ] `makeMonster`: `baseTint`, `applyStatus/clearStatus`, `statusMat` disposal.
- [ ] Death (§4): base crumble + elemental override before `disposeMonster`.
- [ ] New trolls: Brute + Wisp (§5).
- [ ] Ranger avatar + 4 co-op colors for peers (§6).
- [ ] Reuse the existing additive `THREE.Points` pool for all particles.
- [ ] Keep single-player default (`currentElement='base'`); co-op unaffected.

All colors: `tokens/elements.css` + `tokens/colors.css`. All motion/counts:
`fx/element-fx.js`. All silhouettes: the `guidelines/*.html` design sheets.
