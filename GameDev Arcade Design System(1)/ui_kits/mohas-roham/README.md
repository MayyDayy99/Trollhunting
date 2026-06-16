# Mohás Roham — UI Kit

A faithful recreation of the **Mohás Roham** in-game first-person HUD: a bow-and-
arrow wave-survival game against hordes of mossy trolls, with elemental arrows
and 2–4 player co-op. Composes the design-system HUD primitives over a forest-
night glade, and drives troll status with the elemental FX engine.

## Run
Open `index.html`. Loads `styles.css` + `_ds_bundle.js` from the project root and
`guidelines/fx/element-fx.js` for the canvas troll/aura rendering.

## What's on screen
- **WaveBanner** (top-center) — "HULLÁM 3" + remaining troll count.
- **ScorePill** (top-right) — cyan score.
- **Crosshair** (center) — expands as you draw; tinted to the equipped element.
- **ChargeMeter** (bottom-center) — appears while drawing.
- **HealthBar** (bottom-left) — "Életerő".
- **ElementSelector** (bottom-center) — ALAP/TŰZ/JÉG/MÉREG/VILLÁM.
- **PlayerCard** list (top-left) — the 4 co-op archers (one downed).
- **Trolls** — canvas sprites that take an elemental **StatusPip** + aura when hit.

## Interactions (demo)
- **Hold** the scene to draw the bow (crosshair spreads, charge fills); **release**
  to loose — the nearest troll takes the equipped element's status + damage.
- **1–5** keys (or click the selector) switch element.
- Headshot-strength shots pop a **FEJLÖVÉS!** toast.

## Files
- `index.html` — mounts `window.RohamKit`.
- `screens.jsx` — `RohamKit`, `Troll`, `TrollSprite`.

## Notes
- The real game renders a full Three.js glade + procedural trolls + physical
  arrows. Here the 3D is **suggested**; the FX engine
  (`guidelines/fx/element-fx.js`) provides the elemental auras/death and is the
  porting reference. See `guidelines/elemental-combat-spec.md` for integration.
