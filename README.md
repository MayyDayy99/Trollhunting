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
| **Phone / touch** | Left joystick to move · drag right side to aim · hold either **LŐ** button to draw and release to fire · **FULL** fullscreen · **FORD** landscape request · touch buttons for jump, run, dash, melee, pause, VIHAR, and arrow elements |
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

### Single-player
Just open **`mohas-roham.html`** in a modern browser (Chrome recommended).
No build, no server — Three.js loads from a CDN.

### Co-op (2–4 players, same network)
The co-op server lives in **[`mp-server/`](mp-server/)**. Start it one of two
ways, then open the printed URL and hit **QUICK PLAY** (or **CREATE** and share
the invite link).

**With Docker** (recommended — one command, isolated):
```bash
cd mp-server
docker compose up -d --build
#  →  http://localhost:8090
```

**Without Docker** (Node.js ≥ 22):
```bash
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
that touches `mohas-roham.html` (it copies the file to `index.html` and
deploys — co-op is **not** hosted here, since it needs the WebSocket server).
The build tag shown on the loading screen matches the deployed commit, so you
can always confirm you're playing the latest version.

---

## Project layout

| Path | What |
|---|---|
| `mohas-roham.html` | The entire game — one IIFE, Three.js r128 (CDN), flat-shaded low-poly. |
| `ELEMENTAL-SPEC.md` | The elemental deepening design + implementation spec. |
| `elemental-ingame.js` | Canonical elemental cinematic-FX reference (`makeRichPool`/`EFX`). |
| `mp-server/server.js` | Node `ws` co-op server (server-authoritative waves + elemental sim). |
| `mp-server/public/` | Served copy of the game, `net-client.js` (co-op glue), `index.html` lobby. |
| `mp-server/.env.example` | Template for `mp-server/.env` (`HOST_IP` for LAN invite links; the real `.env` is git-ignored). |

---

## Tech

Three.js r128 (single-file, CDN), procedural low-poly models & textures,
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
