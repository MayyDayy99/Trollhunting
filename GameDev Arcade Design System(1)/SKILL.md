---
name: mohas-roham-design
description: Use this skill to generate well-branded interfaces, HUD, and elemental VFX specs for Mohás Roham — a first-person bow-and-arrow survival game vs. mossy trolls (Three.js, 2–4p co-op). Contains design guidelines, colors, type, fonts, the elemental arrow system (fire/ice/poison/lightning), HUD components, and a Claude Code integration spec.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

If creating visual artifacts (mocks, throwaway prototypes, effect references), copy assets out and create static HTML files for the user to view. If working on the actual game (`mp-server/public/mohas-roham.html`), read the rules here and follow the integration spec to become an expert in this brand.

If the user invokes this skill without other guidance, ask what they want to build or design, ask a few questions, and act as an expert designer who outputs HTML artifacts _or_ game-ready specs/code.

## The elemental system (the headline feature)
Read these three together — they ARE the spec for fire / ice / poison / lightning (+ plain) arrows:
1. `tokens/elements.css` — the 5 palettes (core/mid/glow/spark/deep/light/trail + status tint).
2. `guidelines/fx/element-fx.js` — heavily-commented 2D canvas engine (trail · impact · status aura · death) whose structure mirrors the game's 3D THREE.Points pipeline. This is the PORT REFERENCE.
3. `guidelines/elemental-combat-spec.md` — exact integration hooks into `mohas-roham.html` (makeArrow, fireArrow, the hit loop, the monster factory, disposeMonster), the new troll types, and the ranger avatar.

## Where things are
- `README.md` — brand guide: Hungarian copy, forest-night palette, cyan=UI/rune & orange=danger, glass HUD, motion.
- `styles.css` — the one stylesheet to link; `@import`s all tokens + fonts.
- `tokens/` — CSS custom properties (colors, elements, typography, spacing, effects, fonts).
- `guidelines/` — specimen cards (Colors/Type/Spacing/Brand/Elements/Effects/Characters) + the FX engine + the spec.
- `components/` — React HUD primitives on `window.GameDevArcadeDesignSystem_67abce` once `_ds_bundle.js` is loaded (`core/`: Button, IconButton, GlassPanel, Badge, Eyebrow · `hud/`: Crosshair, ChargeMeter, WaveBanner, ScorePill, ElementSelector, HealthBar, PlayerCard, StatusPip, Toast).
- `ui_kits/mohas-roham/` — the interactive first-person HUD recreation.
- `mp-server/public/` — the imported game + co-op client (read-only reference).

## Quick start
```html
<link rel="stylesheet" href="styles.css" />
<script src="_ds_bundle.js"></script>
<script>
  const { Crosshair, ChargeMeter, ElementSelector } = window.GameDevArcadeDesignSystem_67abce;
</script>
```
Build on the night gradient, keep cyan for UI/runes and orange for danger, paint HUD chrome on frosted glass, route every elemental effect through `tokens/elements.css` + `fx/element-fx.js`, and keep copy Hungarian.
