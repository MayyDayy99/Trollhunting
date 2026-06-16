# Mohás Roham — Design System

A design system for **Mohás Roham** ("Mossy Charge") — a **first-person archery
survival game**: you are the last archer in a forest-night glade, holding off
hordes of **mossy trolls** with a charged longbow. Browser-based, **Three.js
r128**, flat-shaded, with a **2–4 player co-op** wave-survival mode (WebSocket
server). This system adds a full **elemental arrow system** (fire · ice · poison
· lightning, plus a plain arrow) on top of the shipped game.

> The original GameDev workshop also produced *Sword Duel* (a hand-tracking duel,
> now retired) and *Mohás Berci* (a cozy troll game). This system is focused on
> **Mohás Roham**; the mossy-troll world and forest-night palette are shared.

---

## Sources

- **GitHub:** `MayyDayy99/GameDev` — https://github.com/MayyDayy99/GameDev
  - `mp-server/public/mohas-roham.html` — the game (visual source of truth:
    materials, HUD CSS, arrow pool `makeArrow`/`fireArrow`, monster factory,
    waves). **A copy is imported at `mp-server/public/` in this project.**
  - `mp-server/server.js`, `net-client.js`, `INTEGRATION.md`, `README.md` — the
    co-op server, protocol, and authority model (peer archers, shared waves).
  - `ARCADE_GAME_DEV_GUIDE.md` — workshop scope.

> Explore the repo further for higher-fidelity work — the procedural glade,
> trolls, and bow tuning live in `mohas-roham.html`.

**Font substitution flag:** the game ships **system fonts only** (`-apple-system`,
`Segoe UI`, serif). This system substitutes Google Fonts to match intent —
**Chakra Petch** (HUD display), **Space Grotesk** (UI/body), **Gelasio**
(Georgia-metric serif), **JetBrains Mono**. Send brand fonts to swap them in
`tokens/fonts.css`.

---

## ⚔️ Start here: the elemental system

The headline addition. Three files carry it; read them in order:

1. **[`tokens/elements.css`](tokens/elements.css)** — the 5 palettes (core / mid /
   glow / spark / deep / light / trail + status tint), every hex from or matched
   to the game.
2. **[`guidelines/fx/element-fx.js`](guidelines/fx/element-fx.js)** — a heavily-
   commented 2D canvas particle engine implementing **arrow trail · impact burst
   · enemy status aura · death animation** per element. Its structure mirrors the
   game's 3D `THREE.Points` pipeline — it's the **port reference**.
3. **[`guidelines/elemental-combat-spec.md`](guidelines/elemental-combat-spec.md)**
   — the **Claude Code integration spec**: exactly where each effect hooks into
   `mohas-roham.html` (`makeArrow`, `fireArrow`, the hit loop, the monster
   factory, `disposeMonster`), with the visual contract for arrows, impacts,
   status, deaths, the two new trolls, and the ranger.

The animated **Elements** and **Effects** cards in the Design System tab show all
of this in motion.

---

## Content Fundamentals

- **Language is Hungarian.** Keep UI copy Hungarian: `HULLÁM 3` (Wave 3),
  `trollok: 7`, `Életerő` (Health), `pont` (points), `FEJLÖVÉS!` (Headshot!),
  `JÁTÉK ▶`. Element names: `TŰZ · JÉG · MÉREG · VILLÁM` (+ `ALAP` = plain).
- **Voice:** terse, punchy, second person. The start card addresses the lone
  archer: *"Te vagy az utolsó íjász."* Instructional copy is plain and direct.
- **Casing:** ALL-CAPS for HUD shouts (wave, toast, buttons, element labels);
  sentence case for instructions. Wide tracking on caps.
- **Emoji:** sparing in this game — mostly `▶` on buttons and `🍄`/`⚔️` flavor.
  Not used as UI controls here (unlike the cozy companion game).
- **Numbers are spectacle:** score, wave, troll count, HP, draw power are big and
  bold. Headshots read as a moment (toast + double feedback).

---

## Visual Foundations

**Color.** A near-black forest-night navy (`#0a1018` → `#141f36`) under a radial
glade gradient. Two functional accents run the whole game: **cyan** `#36c5ff`/
`#7fe2ff` is the *rune / beacon / UI* language (runes, score, charge, glow-
mushrooms, mage crystals); **orange/red** `#ff5a2a`/`#ff7a3d` is *danger* — the
trolls' glowing eyes, the hurt flash, the HP bar (which runs rust→orange→amber).
Warm **amber/gold** `#ffd27a` is torchlight, fireflies, the wave counter. Mossy
**greens** (`#6fa07a`, `#41704e`) are the trolls and flora. On top of this, the
**five elements** each own a tight ramp — see `tokens/elements.css`.

**Type.** Angular display (Chakra Petch) for HUD shouts; clean Space Grotesk for
body/labels; Gelasio serif for occasional aged/lore accents; JetBrains Mono for
debug/numeric. HUD sizes are fluid `clamp()` (the game targets big screens).

**Backgrounds.** Always the night gradient with a **radial vignette** and a red
**hurt vignette** on damage. The 3D canvas shows through translucent HUD chrome.
Fireflies, a moon, bog-spores, and ground-mist add life — no flat or photographic
backgrounds.

**Surfaces & glass.** HUD chrome and the start/pause/over cards are **frosted
glass**: `rgba(14,22,40,0.6)`, `backdrop-filter: blur`, cool hairline border
`rgba(180,200,240,0.18–0.25)`. Cards round to **22px**, buttons/chips to **14px**,
pills to **999px**. Bars (HP, charge) round to **8px** with a 2px frame.

**Glows.** Emissive everything: runes, crystals, eyes, and arrows glow via
additive light. The CTA button glows cyan; element FX cast a colored
`PointLight`; health/charge fills carry inner gradients. Big text gets a heavy
legibility shadow.

**Motion.** Snappy. The crosshair **expands** with draw; the charge meter fades
in; toasts **pop** (`scale .6→1`); hits **flash**; deaths crumble then resolve
into an elemental flourish; the camera shakes on big impacts. Press = the brand's
shrink-and-brighten. Avoid slow decorative loops on foreground HUD.

**Hover / press / states.** Hover `brightness(1.1)`; press `scale(0.92)` +
brighten; glass deepens its fill on press; disabled desaturates; active controls
get a brighter rim + element glow.

**Imagery vibe.** Cool, dark, neon-lit glade with warm amber firelight; flat-
shaded low-poly; glowing, grainless, high-contrast.

---

## Iconography

- **No icon font / no SVG icon set ships.** The HUD is built from CSS shapes (the
  crosshair, bars, radar) and **canvas** (trolls, FX). Unicode `▶` `·` and a
  little flavor emoji (`🍄` `⚔️`) appear, but emoji are **not** used as controls
  in this game.
- **No logo file** — the wordmark is **type-built**: `MOHÁS ROHAM` in the cyan→
  white→amber title gradient with a small arrow motif (see `brand-wordmark.html`).
- The **elements** read by **color + gradient + a short Hungarian label**, never a
  cartoon icon — keep that discipline (`ElementSelector`).
- Need utility UI icons the game lacks? Substitute a CDN set with a matching feel
  (e.g. [Lucide](https://lucide.dev), 2px stroke) and **flag the substitution**.

---

## Index / Manifest

**Root**
- `styles.css` — entry point; `@import`s every token + font file.
- `README.md` — this guide · `SKILL.md` — Agent-Skills wrapper.
- `mp-server/public/` — imported game + co-op client (read-only reference).

**`tokens/`** — `fonts`, `colors` (world palette), **`elements`** (5 elemental
sets), `typography`, `spacing`, `effects`.

**`guidelines/`** — foundation + game specimens:
- Colors (world, accents, ink, greens, glass, semantic), Type, Spacing, Brand.
- **Elements** — `colors-elements`, `elements-arrows` (animated).
- **Effects** (animated) — `elements-impacts`, `elements-status`, `elements-death`.
- **Characters** — `character-ranger`, `troll-existing`, `troll-brute`, `troll-wisp`.
- **`fx/element-fx.js`** — the FX engine · **`elemental-combat-spec.md`** — the
  Claude Code handoff.

**`components/`** — `window.GameDevArcadeDesignSystem_67abce`:
- `core/` — `Button`, `IconButton`, `GlassPanel`, `Badge` (elemental tones), `Eyebrow`
- `hud/` — `Crosshair`, `ChargeMeter`, `WaveBanner`, `ScorePill`,
  `ElementSelector`, `HealthBar`, `PlayerCard`, `StatusPip`, `Toast`

**`ui_kits/mohas-roham/`** — the interactive first-person HUD (waves, charge,
elements, co-op, troll status).

---

## Using it

```html
<link rel="stylesheet" href="styles.css" />
<script src="_ds_bundle.js"></script>
<script>
  const { Crosshair, ChargeMeter, ElementSelector, HealthBar } =
    window.GameDevArcadeDesignSystem_67abce;
</script>
```

Build on the night gradient, keep cyan for UI/runes and orange for danger, paint
HUD chrome on frosted glass — and route every elemental effect through
`tokens/elements.css` + `fx/element-fx.js` so the game stays consistent.
