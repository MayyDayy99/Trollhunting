# Mohás Roham — Co-op Multiplayer Server (skeleton)

A **prep/scaffolding** server that turns the single-file archery game
*Mohás Roham* (first-person bow vs. waves of mossy trolls, Three.js r128) into a
**2–4 player co-op wave-survival** game: several archers share one arena and
fight the same wave together.

This is a **runnable server skeleton**, not finished netcode. It:

- serves the game's static files over HTTP,
- runs a WebSocket endpoint at `/ws` with a **room/lobby manager**
  (create/join/leave by 4-char room code, max 4 players),
- runs a **~20 Hz server tick** that broadcasts a consolidated `state` frame,
- implements a documented **message protocol** and a clear **authority model**,
- **stubs** the monster/wave simulation with explicit `TODO`s.

**Single-player is 100% intact and offline.** Co-op is strictly opt-in via
`?room=CODE` (see `INTEGRATION.md`). The original `mohas-roham.html` is **not
modified**; a copy is served from `public/` only so the server has something to
host.

---

## Run locally (Node 22)

```bash
cd mp-server
npm install
npm start
```

Then open:

- **Lobby:** http://localhost:8080
- **Game (single-player):** http://localhost:8080/mohas-roham.html
- **Game (co-op):** http://localhost:8080/mohas-roham.html?room=ABCD
- **Health:** http://localhost:8080/healthz
- **WebSocket:** `ws://localhost:8080/ws`

`npm run dev` runs it with `node --watch` for auto-restart.

### Quick WS smoke test (no browser)

```bash
node --input-type=module -e "import('ws').then(({WebSocket:W})=>{const s=new W('ws://localhost:8080/ws');s.on('open',()=>s.send(JSON.stringify({t:'join',name:'tester'})));s.on('message',m=>console.log(m.toString()));});"
```

You should see `hello`, then `welcome`, then periodic `state` frames.

---

## Run via Docker

```bash
cd mp-server
docker compose up --build
```

Same URLs as above (host port `8080`). The compose file sets `restart:
unless-stopped` and a `/healthz` healthcheck (visible in `docker ps`).
Stop with `docker compose down`.

---

## Authority model

**Hybrid**, server-authoritative for the *shared* world, client-owned for
*local feel*:

| Concern | Owner | Notes |
|---|---|---|
| Wave lifecycle (which wave, when, how many) | **Server** | single source of truth |
| Monster spawns (id, pos, hp, speed) | **Server** | server rolls them (STUB now) |
| Scoring (kills confirmed/awarded) | **Server** | 100 / 150 (headshot), matches SP |
| Player liveness (down/revive/room over) | **Server** | emits `player_down` |
| Own transform (pos/yaw/pitch/hp) | **Client** | sent up, relayed to peers |
| Own shots (`arrow_fired`) | **Client** | fired locally for 0-latency feel |
| Hit resolution | **Client-told → server-validated** | server lightly validates + scores; TODO: server-side ray re-sim for real anti-cheat |

**Why:** co-op PvE has low cheating incentive, so we optimise for
responsiveness (clients own transform + shots) while keeping the parts that
*must* agree — waves, spawns, score — on the server so every archer sees the
same battle.

---

## Message protocol

JSON over WebSocket. Every frame is `{ "t": <type>, ... }`.
`C->S` = client→server, `S->C` = server→client.

| Type | Dir | Payload | Purpose |
|---|---|---|---|
| `join` | C→S | `{ room?, name?, max? }` | join (or create) a room; omit `room` to auto-create |
| `hello` | S→C | `{ message }` | greeting on connect |
| `welcome` | S→C | `{ id, room, you, players[], wave, score, max, tickHz, authority }` | join accepted + snapshot |
| `peer_joined` | S→C | `{ player:{id,name} }` | another archer joined |
| `peer_left` | S→C | `{ id }` | an archer left |
| `player_state` | C→S | `{ pos, yaw, pitch, hp, alive }` | your transform |
| `player_state` | S→C | `{ id, pos, yaw, pitch, hp, alive }` | a peer's relayed transform |
| `spawn_wave` | S→C | `{ wave, toSpawn }` | server starts a wave (authoritative) |
| `monster_state` | S→C | `{ monsters:[{id,pos,hp,...}] }` | monster snapshot (STUB) |
| `arrow_fired` | C→S | `{ from, dir, power }` | you fired |
| `arrow_fired` | S→C | `{ id, from, dir, power }` | a peer fired (render it) |
| `hit` | C→S | `{ monsterId, headshot, dmg }` | your arrow hit a monster |
| `hit` | S→C | `{ id, monsterId, headshot, dmg, killed, score }` | server-confirmed hit |
| `player_down` | S→C | `{ id }` | a player went down (authoritative) |
| `chat` | C↔S | `{ text }` / `{ id, name, text }` | text chat |
| `state` | S→C | `{ tick, wave, score, players[], monsters[] }` | ~20 Hz heartbeat/state |
| `error` | S→C | `{ code, message }` | protocol/validation errors |

Full inline docs live at the top of `server.js`.

---

## Transport / security note

This game uses **no camera**, so the `getUserMedia` secure-context requirement
(which forced HTTPS in the sibling *sword-duel* project) **does not apply here**.

- `ws://` works fine on `http://localhost` for development.
- For **LAN / cross-origin / production**, put the server behind a TLS
  terminator (nginx / Caddy / cloud LB) and use **`wss://`**. Also serve the
  page over `https://` — browsers block `ws://` from an `https://` page as mixed
  content. `net-client.js` auto-picks `wss://` when the page is `https://`.

---

## Files

| Path | What |
|---|---|
| `server.js` | HTTP static server + WS room manager + 20 Hz tick. Protocol & authority docs inline. |
| `package.json` | Node 22, single dep `ws`, `npm start`. |
| `Dockerfile` | `node:22-alpine`, non-root, `EXPOSE 8080`, `/healthz` healthcheck. |
| `docker-compose.yml` | Port map, `restart: unless-stopped`, healthcheck. |
| `public/index.html` | Lobby page (create/join room → launches game with `?room=`). |
| `public/mohas-roham.html` | **Unmodified copy** of the game, hosted by the server. |
| `public/net-client.js` | Browser networking stub: `connectCoop()` + hooks. |
| `INTEGRATION.md` | How the game opts into co-op via `?room=` without touching single-player. |

---

## Done / TODO for full netcode

### Done (skeleton)
- [x] HTTP static serving (lobby + game + client stub) with path-traversal guard.
- [x] WebSocket endpoint at `/ws` with JSON line protocol.
- [x] Room/lobby manager: create/join/leave by code, max-players cap (2–4).
- [x] ~20 Hz server tick broadcasting a consolidated `state` frame (heartbeat).
- [x] Server-authoritative wave **lifecycle** plumbing (`spawn_wave` emitted).
- [x] Relay of client-owned `player_state` and `arrow_fired` to peers.
- [x] Light server-side `hit` validation + co-op scoring (100/150) when a
      monster exists.
- [x] WS ping/pong dead-socket sweep; graceful shutdown; `/healthz`.
- [x] Documented authority model + message protocol.
- [x] Dockerfile + docker-compose with healthcheck and restart policy.
- [x] Client stub (`connectCoop`) with `onWelcome/onState/sendInput/sendShot`
      and friends; auto-reconnect; input throttling.

### TODO (real netcode — mostly gameplay, not transport)
- [ ] **Server-side monster simulation** in `server.js` `stepWaves`: actually
      spawn `4 + N*2` trolls at radius 26, hp `28 + N*9`, speed
      `clamp(1.5 + N*0.12, , 4.5)`; move toward nearest living player;
      emit `monster_state`.
- [ ] **Server-side melee + `player_down`** resolution and wave-complete →
      next-wave progression.
- [ ] **Server-authoritative hit detection** (re-simulate the arrow ray
      server-side) to replace the client-told `hit` for anti-cheat.
- [ ] **Client reconciliation**: render peer archers from `state.players`;
      drive monsters from `state.monsters`; suppress the local spawner and
      use `state.wave` / `state.score` when co-op is active (see
      `INTEGRATION.md`).
- [ ] **Interpolation/extrapolation** of peer transforms (currently raw relay).
- [ ] Lobby niceties: ready-up, room list, names, host migration.
- [ ] Persistence/metrics if desired (none today — fully in-memory).
- [ ] `wss://` reverse-proxy config sample for LAN/production.
