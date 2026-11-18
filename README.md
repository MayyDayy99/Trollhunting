# Mohás Roham 🏹

A first-person **archery wave-survival** game: you're the last archer in a
forest-night glade, holding off hordes of mossy trolls with a charged longbow
and a deep **elemental arrow system**. The whole game is one self-contained HTML
file (Three.js r128, no build step), with an optional **2–4 player co-op**
server.

**▶ Play single-player: https://mayydayy99.github.io/GameDev/**

---

## Controls

| Input | Action |
|---|---|
| **Mouse** | Aim |
| **Hold Left Mouse** | Draw the bow · **release** to fire |
| **WASD** | Move · **Space** jump · **Shift** run · **Esc** pause |
| **Q** | Dash in your movement direction (backwards when standing still) with a brief moment of invulnerability |
| **Right Mouse / F** | Melee swing · **Mouse wheel** cycles the arrow element · **Tab** toggles the radar legend |
| **1–5** | Arrow element: `1` ALAP · `2` TŰZ 🔥 · `3` JÉG 🧊 · `4` MÉREG ☠️ · `5` VILLÁM ⚡ |
| **R** | VIHAR ultimate (when the meter is full) |
| **Phone / touch** | Touch anywhere on the left side for a floating joystick (push it to the edge to run) · drag the right side **or the LŐ/FIRE button itself** to aim · hold **LŐ** to draw, release to fire · **UGR / KITÉR / ÜT** jump, dash, melee · **VIHAR** fills its ring and pulses when ready · element chips at the bottom · **FULL** fullscreen. Aiming slows slightly over a troll, Android phones vibrate on hits and kills, and the HUD scales to the screen. |
| **Gamepad** | Left stick move · right stick aim · **RT** draw/release · **RB / X** melee · **A** jump · **B** dash · **Y** VIHAR · **LB / D-pad** element · **L3** sprint · **Start** pause |
| **EN / HU** | Toggle the game language between English and Hungarian (`?lang=en` / `?lang=hu` also works) |

Longer draw = stronger, faster arrow **and** stronger elemental effect.
Headshots deal double damage. Release the instant the crosshair ring turns
**gold** for a **perfect shot** (+30% damage), and chain quick kills to build a
**streak** score multiplier (up to ×2).

Mouse sensitivity, field of view, volume, invert-Y, damage numbers and screen
shake are adjustable in the **Settings** tab of the menu (and on the pause
screen); they are saved in the browser together with your best score.

Every **10th wave** is led by the **Troll King** — a giant with its own health
bar and a telegraphed ground slam (jump, dash, or back off to avoid it).
**VIHAR** now scales with the wave, triggers an element-specific field event
(full freeze, fire fields, gas clouds, a stunning lightning strike, or a
knock-back shockwave) and leaves you **overcharged** for a few seconds: faster
draw and reload, ×1.5 elemental power, and a short invulnerability window.

---

## The elemental system

**One element is a status; two elements together is a spell.** Read what a troll
already carries (aura / eye colour), swap element, and detonate it:

- 🔥 **TŰZ (fire)** — stacking burn-over-time that spreads to neighbours and sets trees alight
- 🧊 **JÉG (ice)** — slows, stacks to a full freeze, melts into wet/conductive ground
- ☠️ **MÉREG (poison)** — stacking damage-over-time + a lingering gas cloud; silences shaman heals
- ⚡ **VILLÁM (lightning)** — a hard stun that chains, much further through wet / clustered trolls

**Reactions:** 🧊+⚡ Fagytúltöltés · 🔥+🧊 Gőzrobbanás · 🔥+☠️ Mérges gyújtás ·
☠️+⚡ Galván permet · 🧊×3 Teljes fagy. Every troll type is weak or resistant to
different elements, the bow's charge scales potency, fast element-swaps grant a
**Resonance** bonus, and the **VIHAR** ultimate floods the whole field with your
equipped element. Full design + implementation notes: **[ELEMENTAL-SPEC.md](ELEMENTAL-SPEC.md)**.

---

## Run it locally

Troll locomotion uses articulated hips, knees, ankles, elbows and wrists, with
distance-driven strides and blended idle poses in both single-player and co-op.
Single-player melee clips follow the existing damage timing; casting, hit recoil
and death joint relaxation add follow-through without changing combat rules.
Elemental trails and status/zone particles use timed emission budgets, with
eased shockwaves, flickering lightning and growing ice shells.

Tests (after `npm install`):

- `npm test` — animation and combat regressions plus the single-file build check.
- `npm run build && npm run test:e2e` — a scripted playthrough of the built game in
  headless Edge/Chrome (waves, every element, the Forge, spells, freezes, the
  Troll King, VIHAR, dash, melee). It fails on page errors, on shaders compiled
  after the loading-screen warm-up (each is a visible hitch) and on runaway
  geometry growth. `node tests/e2e/run-scenario.mjs --gpu --profile spell,boss`
  prints per-phase frame times and CPU profiles.

### Single-player combat progression

The Forge now sells three bow variants alongside the starting Hunting Bow.
Ownership lasts for the current run; switching between owned bows is free, but
only possible in the Forge. Bow bonuses replace one another rather than stacking.

| Bow | Unlock / price | Identity |
| --- | --- | --- |
| Bone Recurve | Wave 5 / 1,000 points | Heavy hits, faster draw/reload, one extra base-arrow pierce |
| Living Bough | Wave 10 / 2,600 points | Fast draw/reload, an extra spread arrow, shorter spell cooldown |
| Runebow | Wave 15 / 4,200 points | Highest damage and stronger/faster-recharging spells; slower reload |

**Elemental Awakening** has three ranks, available at waves 5/10/15 for
800/1,600/2,800 points. With a rank purchased, fully drawing an elemental bow
automatically casts its signature spell when ready: advancing flame eruptions,
a frost-spire fan, a pulling poison vortex, or a lightning strike with chained
arcs. Higher ranks expand the actual patterns, coverage and pulse/chain counts.
Base shots, partial draws and releases during cooldown still fire arrows.
The same hold/release controls work on mouse, touch and gamepad; the HUD shows
the equipped bow and spell readiness. Spells retain absorption, resistances,
freeze vulnerability and elemental reactions, and their primary areas respect
solid cover. Visuals and delayed attacks use bounded pools/queues.

Single-player trolls now use stable flanking sides, limited movement prediction
and cover-aware ranged positioning. The Troll King has three health-based
phases, locked-direction charges, marked rockfalls, jumpable slams and later-phase
area denial. Warnings precede damage; attacks leave recovery windows granting
50% more direct arrow, spell and melee damage. Boss health is lower than the
former slam-only version. No new wave limit or ending is introduced.

These combat/progression changes are **single-player only**. The mirrored co-op
client keeps server-authoritative weapons, upgrades and enemy combat unchanged;
the new bow shop and Awakening card are hidden there.

### Single-player
Play it at **[trollhunting.maydayprod.app](https://trollhunting.maydayprod.app)**, or build it yourself
(Node.js ≥ 22):

```bash
npm install
npm run dev      # → http://localhost:5175/mohas-roham.html (live reload, source maps)
npm run build    # → dist/mohas-roham.html — ONE self-contained file, opens from disk too
```

`dist/mohas-roham.html` is generated (not in git); the root `mohas-roham.html` is
only the source entry page and does not run on its own.

### Co-op (2–4 players, same network)
The co-op server lives in **[`mp-server/`](mp-server/)**. Start it one of two
ways, then open the printed URL and hit **QUICK PLAY** (or **CREATE** and share
the invite link).

**With Docker** (recommended — one command, isolated; the image builds the game itself):
```bash
cd mp-server
docker compose up -d --build
#  →  http://localhost:8090
```

**Without Docker** (Node.js ≥ 22):
```bash
npm install && npm run build:mp   # builds the game into mp-server/public/
cd mp-server
npm install
npm start
#  →  http://localhost:8080      (change it with  PORT=8090 npm start)
```

**Playing with friends on your LAN.** Invite links default to `localhost`, which
other devices can't reach. Copy **[`mp-server/.env.example`](mp-server/.env.example)**
to `mp-server/.env` and put your machine's LAN IPv4 in it:
```
HOST_IP=192.168.x.x
```
then (re)start the server — the lobby and in-game HUD will hand out
`http://192.168.x.x:PORT/...` links that work from any device on the network.
(`mp-server/.env` is git-ignored since it's machine-specific.)

> Co-op is **server-authoritative** (waves, monster sim, elemental status,
> reactions, chains, scoring) and strictly **opt-in** via `?room=CODE`.
> Single-player behaves identically whether the server is running or not.

---

## GitHub Pages (single-player hosting)

The single-player game auto-publishes to GitHub Pages via
**[`.github/workflows/pages.yml`](.github/workflows/pages.yml)** on every push
to `main` that touches the game (`mohas-roham.html`, `src/`, the build config):
it runs the tests, builds `dist/mohas-roham.html`, publishes it as `index.html`
— co-op is **not** hosted here, since it needs the WebSocket server.
Pull requests run the tests and the browser playthrough
([`.github/workflows/test.yml`](.github/workflows/test.yml)).
The build tag shown on the loading screen matches the deployed commit, so you
can always confirm you're playing the latest version.

---

## Project layout

| Path | What |
|---|---|
| `mohas-roham.html` | Source entry page: markup + one module script (`src/main.js`). |
| `src/game/` | The game, split by area; the files share one scope and run in file-name order ([`src/game/README.md`](src/game/README.md)). |
| `src/trollgen/` | Procedural troll generator (same one-scope scheme). |
| `src/styles/` | Stylesheets (HUD, Forge, menus, mobile). |
| `src/shared/config.js` | Gameplay numbers shared with the co-op server (caves, status effects, troll stats). |
| `src/three-setup.js` | three.js r128 + post-processing add-ons (+ `GLTFLoader`) as `window.THREE`. |
| `src/assets/props/` | AI-generated, game-optimized 3D props (`.glb`, inlined into the build) and how they were made ([README](src/assets/props/README.md)). |
| `tools/props/` | Offline prop pipeline: `optimize.mjs` (simplify, WebP textures, rune glow map), `render.mjs` (preview), `to-webp.mjs`. Own `package.json`, not part of the game build. |
| `src/assets/vfx/`, `tools/vfx/` | Blender-made effects: the fire-burst flipbook atlas and its `.blend` + headless build/render script ([README](tools/vfx/README.md)). |
| `build/concat-modules.js` | Vite plugin that joins a folder into one module (with source maps). |
| `tests/` | Unit tests, build test, `e2e/` browser playthrough + performance probe. |
| `ELEMENTAL-SPEC.md` | The elemental deepening design + implementation spec. |
| `elemental-ingame.js` | Canonical elemental cinematic-FX reference (`makeRichPool`/`EFX`). |
| `mp-server/server.js` | Node `ws` co-op server (server-authoritative waves + elemental sim). |
| `mp-server/public/` | `net-client.js` (co-op glue), `index.html` lobby; the built game is copied in by `npm run build:mp` / the Docker build. |
| `mp-server/.env.example` | Template for `mp-server/.env` (`HOST_IP` for LAN invite links; the real `.env` is git-ignored). |

---

## Tech

Three.js r128 (bundled by Vite into one file), procedural low-poly models & textures,
additive particle / shader-point FX pools. The look is built from a procedural
shader sky (stars, aurora, clouds, cratered moon), a custom filmic tone curve,
selective bloom plus a single final grade pass (4× MSAA on the high tier),
wind-animated instanced grass and canopies, drifting ground mist, moon shafts,
warm braziers against the cool moonlight, and rim-lit trolls.

The models are built procedurally at load time with a stylized, hand-made
look instead of raw primitives: smooth shading with crease-preserving normals,
chiselled boulders and tapered menhirs, sculpted trunks with roots and
branches under soft leaf-card canopies, conifers, bevelled planks and
braced crates, fluted pillars, layered mountain ridges, contact shadows under
props, and world-space painted materials (mossy rock, grooved bark, wood
grain, worn dirt paths in the ground). Trolls are generated with higher
tessellation (rounded limbs, bevelled brow plates) and a painted, mottled skin
shader; grass blades are curved, mushrooms spotted, litter leaf-shaped. Co-op: a dependency-light Node
(`ws`) server at ~20 Hz, buffered entity interpolation, pid+token reconnect.
