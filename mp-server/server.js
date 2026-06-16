// =============================================================================
//  Mohas Roham — CO-OP MULTIPLAYER SERVER (skeleton / scaffolding)
// =============================================================================
//
//  WHAT THIS IS
//  ------------
//  A genuinely-runnable *server skeleton* for turning the single-file archery
//  game "Mohas Roham" (first-person bow vs. waves of mossy trolls) into a
//  2–4 player CO-OP wave-survival experience: several archers share ONE arena
//  and fight the SAME wave together.
//
//  This file boots, serves the game's static files over HTTP, accepts WebSocket
//  connections, runs a room/lobby manager (create/join/leave by room code),
//  and broadcasts room state on a fixed server tick (~20 Hz). The heartbeat
//  works today. The *monster/gameplay* logic is intentionally STUBBED with
//  clear TODOs — this is prep, not finished netcode.
//
//  Single-player is untouched: the original mohas-roham.html still runs 100%
//  offline. Multiplayer is strictly OPT-IN (see net-client.js / INTEGRATION.md).
//
//
//  AUTHORITY MODEL  (read this before extending)
//  ---------------------------------------------
//  Hybrid, leaning server-authoritative for the *shared* world, client-owned
//  for *local feel*:
//
//    SERVER AUTHORITATIVE (the single source of truth, anti-cheat surface):
//      - Wave lifecycle: which wave, when it starts, how many monsters.
//      - Monster spawns: ids, spawn positions, hp, speed (server rolls them).
//      - Scoring: kills are confirmed and scored by the server.
//      - Player liveness within a room (down/revive/room game-over).
//
//    CLIENT OWNED (sent up, lightly validated, relayed to peers):
//      - Each player's own transform (pos / yaw / pitch) and hp readout.
//      - Each player's shots (arrow_fired) — fired locally for 0-latency feel.
//
//    HIT RESOLUTION (start client-told, harden later):
//      - Clients report `hit` (which monster, headshot?, claimed damage).
//      - Server validates *lightly* now (monster exists, damage within sane
//        bounds) and applies damage / awards score. TODO: re-simulate the ray
//        server-side for real anti-cheat.
//
//  Rationale: a co-op PvE game has low cheating incentive, so we optimise for
//  responsiveness (clients own their transform + shots) while keeping the parts
//  that MUST agree — waves, spawns, score — on the server so every archer sees
//  the same battle.
//
//
//  MESSAGE PROTOCOL  (JSON over WebSocket; every frame = { "t": <type>, ... })
//  --------------------------------------------------------------------------
//  Direction key:  C->S = client to server,  S->C = server to client.
//
//   C->S  join          { t:"join", room?:"ABCD", name?:"...", max?:4 }
//                         - room omitted  => server creates a fresh room.
//                         - room given    => join it (created if absent).
//   S->C  welcome        { t:"welcome", id, room, you:{...}, players:[...],
//                          wave, max, authority:"server-coop" }
//   S->C  peer_joined    { t:"peer_joined", player:{ id, name } }
//   S->C  peer_left      { t:"peer_left", id }
//
//   C->S  player_state   { t:"player_state", pos:{x,y,z}, yaw, pitch, hp, alive }
//   S->C  player_state   (relayed, server stamps `id`) — peer transforms.
//
//   S->C  spawn_wave     { t:"spawn_wave", wave, toSpawn }      (server-auth)
//   S->C  monster_state  { t:"monster_state", monsters:[ {id,pos,hp,...} ] }
//                          - sent on the tick; STUB today (empty/placeholder).
//
//   C->S  arrow_fired    { t:"arrow_fired", from:{x,y,z}, dir:{x,y,z}, power }
//   S->C  arrow_fired    (relayed, server stamps `id`) — render peer arrows.
//
//   C->S  hit            { t:"hit", monsterId, headshot:bool, dmg }
//   S->C  hit            { t:"hit", id(shooter), monsterId, headshot, dmg,
//                          killed:bool, score } — server-confirmed.
//
//   S->C  player_down    { t:"player_down", id }                (server-auth)
//   C->S  / S->C  chat   { t:"chat", id?, name?, text }
//
//   S->C  state          { t:"state", tick, wave, score, players:[...],
//                          monsters:[...] } — the ~20 Hz heartbeat/state frame.
//   S->C  error          { t:"error", code, message }
//
//  NOTE: This is a *line protocol contract*. The server currently relays the
//  client-owned messages and emits server-auth frames with placeholder monster
//  data. Wire the real simulation where the `TODO` markers are.
//
//
//  TRANSPORT / SECURITY NOTE
//  -------------------------
//  This game uses NO camera, so the getUserMedia secure-context requirement
//  (which forced HTTPS in the sibling "sword-duel" project) does NOT apply.
//    - ws:// works fine on http://localhost for development.
//    - For cross-origin / LAN / production use wss:// behind a TLS terminator
//      (nginx / Caddy / a cloud LB). Browsers also block ws:// from an https://
//      page (mixed content), so match schemes.
// =============================================================================

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { WebSocketServer } from 'ws';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---- Config (env-overridable) ----------------------------------------------
const PORT       = Number(process.env.PORT || 8080);
const HOST       = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = resolve(__dirname, 'public');
const TICK_HZ    = Number(process.env.TICK_HZ || 20);   // server tick rate
const INVITE_HOST = (process.env.HOST_IP || '').trim(); // LAN IP a megosztható meghívó-linkekhez (a localhost más gépről nem elérhető)
const MAX_PLAYERS_DEFAULT = 4;
const MAX_PLAYERS_CAP     = 4;                            // co-op hard cap
const MIN_PLAYERS         = 2;                            // co-op design minimum

// ---- Gameplay tuning (server-authoritative monster sim) --------------------
// Mirrors the single-player pacing in mohas-roham.html so co-op feels the same.
const SPAWN_R       = 26;     // monsters spawn on a ring this far from origin
const GROUND_Y      = 0;      // monsters live on the ground plane (player y=1.7)
const MELEE_RANGE   = 2.2;    // horizontal (x,z) distance at which a troll bites
const MELEE_DMG     = 8;      // hp removed per melee connect
const MELEE_CD      = 1.0;    // seconds between a given monster's melee hits
const INTERMISSION  = 3.0;    // seconds of calm between cleared wave and next
// 5 troll types must match the client's TROLL_TYPES keys (mohas-roham.html).
const TROLL_TYPES   = ['grunt', 'scout', 'brute', 'shaman', 'spitter'];
let   monsterSeq    = 0;      // process-wide monotonic monster id source

// =============================================================================
//  STATIC FILE HANDLER  (hand-rolled — keeps deps to just `ws`)
// =============================================================================
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.map':  'application/json; charset=utf-8',
};

async function serveStatic(req, res) {
  try {
    // Map URL -> path under PUBLIC_DIR, default to index.html.
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

    // Path-traversal guard: resolved path must stay inside PUBLIC_DIR.
    const filePath = normalize(join(PUBLIC_DIR, urlPath));
    if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    const info = await stat(filePath);
    if (info.isDirectory()) { res.writeHead(403).end('Forbidden'); return; }

    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
}

// =============================================================================
//  ROOM / LOBBY MANAGER
// =============================================================================
/**
 * @typedef {Object} Player
 * @property {string}  id
 * @property {string}  name
 * @property {import('ws').WebSocket} ws
 * @property {{x:number,y:number,z:number}} pos
 * @property {number}  yaw
 * @property {number}  pitch
 * @property {number}  hp
 * @property {boolean} alive
 * @property {number}  lastSeen   epoch ms of last message (for timeout sweeps)
 */

/**
 * @typedef {Object} Room
 * @property {string} code
 * @property {number} max
 * @property {Map<string, Player>} players
 * @property {number} tick
 * @property {number} wave
 * @property {number} score        shared co-op score
 * @property {Array}  monsters      server-auth monster list (STUB for now)
 * @property {number} waveToSpawn   monsters left to spawn this wave (STUB)
 */

/** @type {Map<string, Room>} code -> Room */
const rooms = new Map();

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
function makeRoomCode() {
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += ROOM_ALPHABET[(Math.random() * ROOM_ALPHABET.length) | 0];
    }
  } while (rooms.has(code));
  return code;
}

// Pick a room for QUICK-MATCH: the "most-full but still joinable" open room
// (has at least one player AND a free slot), so quick-matchers pile into the
// same arena instead of each spawning a lonely room. If none qualifies, mint a
// fresh room and return it. `max` only influences the freshly-created room.
function pickQuickRoom(max) {
  let best = null;
  for (const room of rooms.values()) {
    const n = room.players.size;
    if (n <= 0 || n >= room.max) continue;        // empty or full -> skip
    if (!best || n > best.players.size) best = room; // prefer the fullest joinable
  }
  if (best) return best;
  const code = makeRoomCode();
  return createRoom(code, max);
}

// Transport-free, client-safe view of a monster for the `state` frame. Drops
// server-internal sim fields (meleeCd) the client never needs.
function monsterView(m) {
  return { id: m.id, type: m.type, pos: m.pos, hp: m.hp, maxHp: m.maxHp, speed: m.speed };
}

let idCounterFallback = 0;
function makeId() {
  // crypto.randomUUID is available in Node 22; fall back just in case.
  try { return crypto.randomUUID(); }
  catch { return 'p' + (Date.now().toString(36)) + (idCounterFallback++); }
}

function createRoom(code, max) {
  /** @type {Room} */
  const room = {
    code,
    max: Math.min(Math.max(max | 0 || MAX_PLAYERS_DEFAULT, MIN_PLAYERS), MAX_PLAYERS_CAP),
    players: new Map(),
    tick: 0,
    wave: 0,
    score: 0,
    monsters: [],
    waveToSpawn: 0,   // monsters still queued to trickle in this wave
    spawnTimer: 0,    // seconds until the next queued monster appears
    waveTimer: 0,     // intermission countdown between cleared waves
    intermission: false,
  };
  rooms.set(code, room);
  log(`room created: ${code} (max ${room.max})`);
  return room;
}

function destroyRoom(room) {
  rooms.delete(room.code);
  log(`room destroyed: ${room.code}`);
}

/** Public, transport-free view of a player (safe to JSON.stringify). */
function playerView(p) {
  return { id: p.id, name: p.name, pos: p.pos, yaw: p.yaw, pitch: p.pitch, hp: p.hp, alive: p.alive };
}

/** Send a JSON message to one socket (guarded against dead sockets). */
function send(ws, obj) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

/** Broadcast to everyone in a room, optionally excluding one player id. */
function broadcast(room, obj, exceptId = null) {
  const data = JSON.stringify(obj);
  for (const p of room.players.values()) {
    if (p.id === exceptId) continue;
    if (p.ws.readyState === p.ws.OPEN) p.ws.send(data);
  }
}

// =============================================================================
//  CONNECTION + MESSAGE HANDLING
// =============================================================================
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws) => {
  // A socket has no player/room until it sends a valid `join`.
  ws._player = null;
  ws._room = null;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  send(ws, { t: 'hello', message: 'Mohas Roham co-op server. Send {t:"join"} to start.' });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); }
    catch { return send(ws, { t: 'error', code: 'bad_json', message: 'Message must be JSON.' }); }
    if (!msg || typeof msg.t !== 'string') {
      return send(ws, { t: 'error', code: 'bad_msg', message: 'Missing message type "t".' });
    }
    handleMessage(ws, msg);
  });

  ws.on('close', () => handleLeave(ws));
  ws.on('error', () => handleLeave(ws));
});

function handleMessage(ws, msg) {
  // `join` is the only message allowed before a player exists.
  if (msg.t === 'join') return handleJoin(ws, msg);

  const player = ws._player;
  const room = ws._room;
  if (!player || !room) {
    return send(ws, { t: 'error', code: 'not_joined', message: 'Send {t:"join"} first.' });
  }
  player.lastSeen = Date.now();

  switch (msg.t) {
    // ---- CLIENT-OWNED: own transform, relayed to peers --------------------
    case 'player_state': {
      if (msg.pos && typeof msg.pos.x === 'number') {
        player.pos = { x: +msg.pos.x, y: +msg.pos.y, z: +msg.pos.z };
      }
      if (typeof msg.yaw === 'number')   player.yaw = +msg.yaw;
      if (typeof msg.pitch === 'number') player.pitch = +msg.pitch;
      if (typeof msg.hp === 'number')    player.hp = clamp(+msg.hp, 0, 999);
      if (typeof msg.alive === 'boolean') player.alive = msg.alive;
      // Relay immediately for snappy peer movement (also folded into `state`).
      broadcast(room, { t: 'player_state', id: player.id, pos: player.pos,
                        yaw: player.yaw, pitch: player.pitch, hp: player.hp,
                        alive: player.alive }, player.id);
      break;
    }

    // ---- CLIENT-OWNED: shots, relayed so peers can render arrows ----------
    case 'arrow_fired': {
      broadcast(room, {
        t: 'arrow_fired', id: player.id,
        from: msg.from, dir: msg.dir, power: clamp(+msg.power || 0, 0, 1),
      }, player.id);
      break;
    }

    // ---- HIT: client-reported, server lightly validates + scores ---------
    case 'hit': {
      // TODO(netcode): re-simulate the ray server-side for real anti-cheat.
      // For now: confirm the monster exists, clamp damage, apply, award score.
      const mid = msg.monsterId;
      const m = room.monsters.find((x) => x.id === mid);
      if (!m) {
        // Monster logic is still a STUB, so most hits won't resolve yet.
        // We still relay the visual so peers see the impact spark.
        broadcast(room, { t: 'hit', id: player.id, monsterId: mid,
                          headshot: !!msg.headshot, dmg: 0, killed: false,
                          score: room.score }, null);
        break;
      }
      const dmg = clamp(+msg.dmg || 0, 0, 999);
      const headshot = !!msg.headshot;
      m.hp -= dmg;
      let killed = false;
      if (m.hp <= 0) {
        killed = true;
        room.monsters = room.monsters.filter((x) => x.id !== mid);
        room.score += headshot ? 150 : 100; // matches single-player scoring
      }
      broadcast(room, { t: 'hit', id: player.id, monsterId: mid, headshot,
                        dmg, killed, score: room.score }, null);
      break;
    }

    case 'chat': {
      const text = String(msg.text || '').slice(0, 280);
      if (text) broadcast(room, { t: 'chat', id: player.id, name: player.name, text }, null);
      break;
    }

    default:
      send(ws, { t: 'error', code: 'unknown_type', message: `Unknown message type: ${msg.t}` });
  }
}

function handleJoin(ws, msg) {
  if (ws._player) {
    return send(ws, { t: 'error', code: 'already_joined', message: 'You already joined a room.' });
  }

  const name = String(msg.name || 'Archer').slice(0, 24);
  // Optional stable client id so a dropped client can RECLAIM its slot on
  // reconnect (no duplicate player, no peer_left/peer_joined flicker).
  const pid = (typeof msg.pid === 'string' ? msg.pid : '').slice(0, 64) || null;

  // Resolve / create the room. Three paths:
  //   quick:true            -> matchmake into an open room (or a fresh one)
  //   room given            -> join it (created if absent)
  //   nothing               -> server creates a fresh room
  let room, code;
  const wantQuick = msg.quick === true || msg.quick === 1 || msg.quick === 'true';
  let reqCode = (typeof msg.room === 'string' ? msg.room : '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  if (reqCode) {
    code = reqCode;
    room = rooms.get(code) || createRoom(code, msg.max);
  } else if (wantQuick) {
    room = pickQuickRoom(msg.max);
    code = room.code;
  } else {
    code = makeRoomCode();
    room = createRoom(code, msg.max);
  }

  // ---- Reconnect reclaim: same room, same pid -> reuse the existing player.
  let player = pid ? room.players.get(pid) : null;
  if (player) {
    // Tear down the stale socket (if any) WITHOUT firing handleLeave's
    // peer_left/destroyRoom, then bind this fresh socket to the same player.
    const old = player.ws;
    if (old && old !== ws) {
      old._player = null; old._room = null;
      try { old.terminate(); } catch { /* ignore */ }
    }
    player.ws = ws;
    player.name = name;
    player.lastSeen = Date.now();
    if (player.hp <= 0) { player.hp = 100; player.alive = true; } // revive on rejoin
    ws._player = player;
    ws._room = room;
    log(`rejoin: ${player.name} (${player.id}) -> room ${code} [${room.players.size}/${room.max}]`);
  } else {
    // Fresh player. Enforce capacity only for genuinely new joins.
    if (room.players.size >= room.max) {
      return send(ws, { t: 'error', code: 'room_full', message: `Room ${code} is full (${room.max}).` });
    }
    /** @type {Player} */
    player = {
      id: pid || makeId(),   // honor client-supplied stable id when present
      name,
      ws,
      pos: { x: 0, y: 1.7, z: 0 },
      yaw: 0, pitch: 0,
      hp: 100, alive: true,
      lastSeen: Date.now(),
    };
    room.players.set(player.id, player);
    ws._player = player;
    ws._room = room;
    log(`join: ${player.name} (${player.id}) -> room ${code} [${room.players.size}/${room.max}]`);
    // Tell everyone else (only for brand-new players, not reclaims).
    broadcast(room, { t: 'peer_joined', player: { id: player.id, name: player.name } }, player.id);
  }

  // Welcome (or re-welcome) this socket with the full current snapshot so a
  // reconnecting client fully resyncs room/wave/score/peers in one frame.
  send(ws, {
    t: 'welcome',
    id: player.id,
    room: code,
    you: playerView(player),
    players: [...room.players.values()].map(playerView),
    monsters: room.monsters.map(monsterView),
    host: INVITE_HOST,
    wave: room.wave,
    score: room.score,
    max: room.max,
    tickHz: TICK_HZ,
    authority: 'server-coop',
  });
}

function handleLeave(ws) {
  const player = ws._player;
  const room = ws._room;
  ws._player = null;
  ws._room = null;
  if (!player || !room) return;

  room.players.delete(player.id);
  log(`leave: ${player.name} (${player.id}) <- room ${room.code} [${room.players.size}/${room.max}]`);
  broadcast(room, { t: 'peer_left', id: player.id }, null);

  if (room.players.size === 0) destroyRoom(room);
}

// =============================================================================
//  SERVER TICK  (~20 Hz)  — heartbeat + state broadcast
// =============================================================================
//  This is the authoritative drumbeat. Today it:
//    - advances each room's tick counter,
//    - drives a PLACEHOLDER wave/monster simulation (see stepWaves),
//    - broadcasts a consolidated `state` frame to every player.
//  Wire the real monster AI / collision / wave pacing where marked TODO.
const TICK_MS = Math.round(1000 / TICK_HZ);

// Roll a troll type: mostly 'grunt', sprinkle the other four for variety,
// gated by wave so harder types appear later (mirrors the client's intent).
function rollTrollType(wave) {
  const table = [
    ['grunt',   Math.max(2.0, 6 - wave * 0.25)],
    ['scout',   wave >= 1 ? clamp(1.5 + wave * 0.35, 0, 6) : 0],
    ['brute',   wave >= 3 ? clamp((wave - 2) * 0.55, 0, 4) : 0],
    ['shaman',  wave >= 4 ? clamp((wave - 3) * 0.3, 0, 1.6) : 0],
    ['spitter', wave >= 2 ? clamp((wave - 1) * 0.45, 0, 4) : 0],
  ];
  let total = 0;
  for (const e of table) total += e[1];
  if (total <= 0) return 'grunt';
  let r = Math.random() * total;
  for (const e of table) { r -= e[1]; if (r <= 0) return e[0]; }
  return 'grunt';
}

// Spawn ONE monster for the room's current wave at a random point on the ring.
// Returns a PLAIN object (no ws / no circular refs) safe to JSON.stringify in
// the `state` frame. Server owns id/pos/hp/type/speed.
function spawnMonster(room) {
  const N = room.wave;
  const a = Math.random() * Math.PI * 2;
  const r = SPAWN_R + (Math.random() * 5 - 2); // SPAWN_R-2 .. SPAWN_R+3
  const hp = 28 + N * 9;
  const speed = clamp(1.5 + N * 0.12, 1.5, 4.5);
  const m = {
    id: 'm' + (monsterSeq++).toString(36),
    type: rollTrollType(N),
    pos: { x: Math.cos(a) * r, y: GROUND_Y, z: Math.sin(a) * r },
    hp,
    maxHp: hp,
    speed,
    meleeCd: 0, // per-monster melee cooldown (seconds remaining)
  };
  room.monsters.push(m);
  return m;
}

// Begin a wave: queue (4 + N*2) monsters to trickle in, announce it to peers.
function startWave(room, n) {
  room.wave = n;
  room.waveToSpawn = 4 + n * 2;
  room.spawnTimer = 0;       // first monster appears on the next tick
  room.intermission = false;
  room.waveTimer = 0;
  broadcast(room, { t: 'spawn_wave', wave: room.wave, toSpawn: room.waveToSpawn });
  log(`room ${room.code}: spawn_wave ${room.wave} (toSpawn ${room.waveToSpawn})`);
}

// Nearest LIVING player to a point (x,z), or null if none are alive.
function nearestLivingPlayer(room, x, z) {
  let best = null, bestD = Infinity;
  for (const p of room.players.values()) {
    if (!p.alive || p.hp <= 0) continue;
    const dx = p.pos.x - x, dz = p.pos.z - z;
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

// Real server-authoritative wave + monster simulation (co-op).
function stepWaves(room, dt) {
  // Nothing to simulate until someone is in the room.
  if (room.players.size === 0) return;

  // ---- Wave lifecycle ----------------------------------------------------
  if (room.wave === 0) {
    // Kick off wave 1 as soon as the room has a player.
    startWave(room, 1);
  } else if (room.waveToSpawn === 0 && room.monsters.length === 0) {
    // Wave cleared: brief intermission, then advance to the next wave.
    if (!room.intermission) {
      room.intermission = true;
      room.waveTimer = INTERMISSION;
    } else {
      room.waveTimer -= dt;
      if (room.waveTimer <= 0) startWave(room, room.wave + 1);
    }
  }

  // ---- Trickle spawns over time (don't dump the whole wave at once) -------
  if (room.waveToSpawn > 0 && room.monsters.length < 14) {
    room.spawnTimer -= dt;
    if (room.spawnTimer <= 0) {
      spawnMonster(room);
      room.waveToSpawn--;
      room.spawnTimer = Math.max(0.25, 1.0 - room.wave * 0.03);
    }
  }

  // ---- Monster movement + melee (co-op aggro on nearest living player) ----
  for (const m of room.monsters) {
    if (m.meleeCd > 0) m.meleeCd -= dt;
    const target = nearestLivingPlayer(room, m.pos.x, m.pos.z);
    if (!target) continue; // everyone is down; trolls idle
    const dx = target.pos.x - m.pos.x;
    const dz = target.pos.z - m.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > MELEE_RANGE) {
      // Walk toward the target on the ground plane.
      const step = Math.min(m.speed * dt, dist);
      m.pos.x += (dx / dist) * step;
      m.pos.z += (dz / dist) * step;
    } else if (m.meleeCd <= 0) {
      // In range: bite. Server owns melee damage to players.
      m.meleeCd = MELEE_CD;
      target.hp = clamp(target.hp - MELEE_DMG, 0, 999);
      if (target.hp <= 0 && target.alive) {
        target.alive = false;
        broadcast(room, { t: 'player_down', id: target.id });
        log(`room ${room.code}: player_down ${target.name} (${target.id})`);
      }
    }
  }
}

function tickAll() {
  const dt = TICK_MS / 1000;
  for (const room of rooms.values()) {
    room.tick++;
    stepWaves(room, dt);

    // Consolidated heartbeat/state frame — always sent so clients can detect
    // liveness and reconcile peer transforms even between event messages.
    broadcast(room, {
      t: 'state',
      tick: room.tick,
      wave: room.wave,
      score: room.score,
      players: [...room.players.values()].map(playerView),
      monsters: room.monsters.map(monsterView), // client-safe view (no meleeCd)
    });
  }
}

setInterval(tickAll, TICK_MS);

// ---- Heartbeat / dead-socket sweep (WebSocket ping every 30s) --------------
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch { /* ignore */ }
  }
}, 30000);

// =============================================================================
//  HTTP SERVER + WS UPGRADE + HEALTHCHECK
// =============================================================================
const server = http.createServer((req, res) => {
  // QUICK-MATCH: lobby fetches this, reads {room}, then launches ?room=CODE so the
  // player SEES and can share the code. Returns an OPEN room's code, or a fresh
  // (uncreated) code — the room is created lazily on the WS join, so an HTTP probe
  // that never connects leaves no empty-room litter.
  const reqPath = (req.url || '').split('?')[0];
  if (reqPath === '/api/host') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ host: INVITE_HOST }));
    return;
  }
  if (reqPath === '/api/quickroom') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
    let best = null;
    for (const room of rooms.values()) { const n = room.players.size; if (n > 0 && n < room.max && (!best || n > best.players.size)) best = room; }
    const code = best ? best.code : makeRoomCode();
    res.end(JSON.stringify({ room: code, host: INVITE_HOST, players: best ? best.players.size : 0, max: best ? best.max : MAX_PLAYERS_DEFAULT }));
    return;
  }

  // Lightweight health endpoint for Docker / load balancers.
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size,
      players: [...rooms.values()].reduce((n, r) => n + r.players.size, 0),
      uptime: process.uptime() }));
    return;
  }
  serveStatic(req, res);
});

// Upgrade HTTP -> WebSocket on the /ws path.
server.on('upgrade', (req, socket, head) => {
  const { url } = req;
  if (url && url.split('?')[0] === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

server.listen(PORT, HOST, () => {
  log(`HTTP + WS listening on http://${HOST}:${PORT}  (ws path: /ws, tick ${TICK_HZ}Hz)`);
  log(`Static root: ${PUBLIC_DIR}`);
  log(`Health: http://localhost:${PORT}/healthz`);
});

// ---- tiny helpers ----------------------------------------------------------
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function log(...a) { console.log(`[${new Date().toISOString()}]`, ...a); }

// Graceful shutdown so `docker compose down` is clean.
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    log(`${sig} received, shutting down.`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  });
}
