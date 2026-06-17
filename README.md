# Mohás Roham 🏹

A first-person **archery wave-survival** game: you're the last archer in a
forest-night glade, holding off hordes of mossy trolls with a charged longbow
and a deep **elemental arrow system**. The whole game is one self-contained HTML
file (Three.js r128, no build step), with an optional **2–4 player co-op**
server.

**▶ Play single-player: https://mayyday99.github.io/GameDev/**
*(works once GitHub Pages is enabled — see [GitHub Pages](#github-pages-single-player-hosting) below)*

---

## Controls

| Input | Action |
|---|---|
| **Mouse** | Aim |
| **Hold Left Mouse** | Draw the bow · **release** to fire |
| **WASD** | Move · **Space** jump · **Shift** run · **Esc** pause |
| **1–5** | Arrow element: `1` ALAP · `2` TŰZ 🔥 · `3` JÉG 🧊 · `4` MÉREG ☠️ · `5` VILLÁM ⚡ |
| **R** | VIHAR ultimate (when the meter is full) |

Longer draw = stronger, faster arrow **and** stronger elemental effect.
Headshots deal double damage.

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
other devices can't reach. Put your machine's LAN IPv4 in **[`mp-server/.env`](mp-server/.env)**:
```
HOST_IP=192.168.x.x
```
then (re)start the server — the lobby and in-game HUD will hand out
`http://192.168.x.x:PORT/...` links that work from any device on the network.

> Co-op is **server-authoritative** (waves, monster sim, elemental status,
> reactions, chains, scoring) and strictly **opt-in** via `?room=CODE`.
> Single-player behaves identically whether the server is running or not.

---

## GitHub Pages (single-player hosting)

The single-player game is auto-published to GitHub Pages by
**[`.github/workflows/pages.yml`](.github/workflows/pages.yml)** on every push
that touches `mohas-roham.html` (it copies the file to `index.html` and
deploys — co-op is **not** hosted here, since it needs the WebSocket server).

**One-time setup:** in the repo go to **Settings → Pages → Build and deployment
→ Source: _GitHub Actions_**. The next push (or a manual *Run workflow*) deploys
to the URL at the top of this README.

---

## Project layout

| Path | What |
|---|---|
| `mohas-roham.html` | The entire game — one IIFE, Three.js r128 (CDN), flat-shaded low-poly. |
| `ELEMENTAL-SPEC.md` | The elemental deepening design + implementation spec. |
| `elemental-ingame.js` | Canonical elemental cinematic-FX reference (`makeRichPool`/`EFX`). |
| `mp-server/server.js` | Node `ws` co-op server (server-authoritative waves + elemental sim). |
| `mp-server/public/` | Served copy of the game, `net-client.js` (co-op glue), `index.html` lobby. |
| `mp-server/.env` | `HOST_IP` for LAN invite links. |

---

## Tech

Three.js r128 (single-file, CDN), procedural low-poly models & textures,
additive particle / shader-point FX pools. Co-op: a dependency-light Node
(`ws`) server at ~20 Hz, buffered entity interpolation, pid+token reconnect.
