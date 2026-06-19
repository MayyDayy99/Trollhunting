// =============================================================================
//  net-client.js — Mohas Roham CO-OP networking stub (vanilla browser module)
// =============================================================================
//
//  A dependency-free, build-free ES module. Drop it next to the game and import
//  it ONLY when multiplayer is opted in (e.g. URL has ?room=ABCD). It connects
//  to the server's /ws endpoint, joins a room, and exposes a small hook surface
//  the game can wire into without changing single-player defaults.
//
//  USAGE (see INTEGRATION.md for the opt-in pattern):
//
//    import { connectCoop } from './net-client.js';
//
//    const net = connectCoop({
//      room: 'ABCD',            // optional; omit to have the server create one
//      name: 'Archer1',
//      // url: 'wss://host/ws', // optional; auto-derived from page origin
//      onWelcome: (info)  => { /* info.id, info.room, info.players, info.max */ },
//      onState:   (state) => { /* {tick,wave,score,players,monsters} @ ~20Hz */ },
//      onPeerJoined: (p)  => {},
//      onPeerLeft:   (id) => {},
//      onArrow:   (a)     => { /* peer fired: {id,from,dir,power} */ },
//      onHit:     (h)     => { /* server-confirmed hit/kill/score */ },
//      onChat:    (c)     => {},
//      onClose:   ()      => {},
//    });
//
//    // Pump these from the game loop / event handlers:
//    net.sendInput({ pos, yaw, pitch, hp, alive });     // your transform
//    net.sendShot({ from, dir, power });                // when you fire
//    net.sendHit({ monsterId, headshot, dmg });         // when your arrow hits
//    net.sendChat('hello');
//
//  The module NEVER touches the DOM or the game's globals — it only calls the
//  hooks you provide. That keeps single-player completely unaffected.
// =============================================================================

/**
 * Derive the WebSocket URL from the current page origin.
 * http(s)://host[:port]/...  ->  ws(s)://host[:port]/ws
 * Uses wss:// automatically when the page is served over https://.
 */
function defaultWsUrl() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}

/**
 * Connect to the co-op server and join a room.
 * @param {Object} opts
 * @returns {{
 *   sendInput: (s:object)=>void,
 *   sendShot:  (s:object)=>void,
 *   sendHit:   (h:object)=>void,
 *   sendChat:  (text:string)=>void,
 *   send:      (obj:object)=>void,
 *   close:     ()=>void,
 *   isOpen:    ()=>boolean,
 *   get id():  string|null,
 *   get room():string|null,
 * }}
 */
export function connectCoop(opts = {}) {
  const url = opts.url || defaultWsUrl();
  const hooks = {
    onWelcome:    opts.onWelcome    || (() => {}),
    onState:      opts.onState      || (() => {}),
    onPeerJoined: opts.onPeerJoined || (() => {}),
    onPeerLeft:   opts.onPeerLeft   || (() => {}),
    onArrow:      opts.onArrow      || (() => {}),
    onHit:        opts.onHit        || (() => {}),
    onChat:       opts.onChat       || (() => {}),
    onSpawnWave:  opts.onSpawnWave  || (() => {}),
    onPlayerDown: opts.onPlayerDown || (() => {}),
    onRoomState:  opts.onRoomState  || (() => {}),   // FEJLESZTÉS: várószoba-roster + fázis
    onRoomStart:  opts.onRoomStart  || (() => {}),   // FEJLESZTÉS: szinkron 'go' -> beginPlay()
    onError:      opts.onError      || ((e) => console.warn('[coop] error', e)),
    onOpen:       opts.onOpen       || (() => {}),
    onClose:      opts.onClose      || (() => {}),
  };

  let ws = null;
  let selfId = null;
  let roomCode = opts.room || null;
  let joined = false;
  let closedByUser = false;
  let selfToken = null;       // private reclaim token from welcome (anti-hijack)
  let reconnectTimer = null;  // pending auto-reconnect timer (cancellable)

  // ---- outbound throttle for player_state -----------------------------------
  // The game loop runs at ~60 fps; we don't need to flood the socket with
  // transform updates. Cap to ~20/s to match the server tick.
  let lastInputSent = 0;
  const INPUT_MIN_INTERVAL_MS = 50;

  function open() {
    if (closedByUser) return;
    ws = new WebSocket(url);

    ws.addEventListener('open', () => {
      // Send our join request as soon as the socket is open.
      send({ t: 'join', room: roomCode || undefined, name: opts.name || 'Archer', max: opts.max, pid: selfId || undefined, token: selfToken || undefined }); // pid+token = duplikátum-mentes, biztonságos újracsatlakozás
      hooks.onOpen();
    });

    ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      route(msg);
    });

    ws.addEventListener('close', () => {
      joined = false;
      hooks.onClose();
      // Auto-reconnect unless the user closed us on purpose (cancellable).
      if (!closedByUser && reconnectTimer === null) {
        reconnectTimer = setTimeout(() => { reconnectTimer = null; open(); }, 1500);
      }
    });

    ws.addEventListener('error', (e) => hooks.onError({ code: 'socket', message: String(e?.message || 'ws error') }));
  }

  function route(msg) {
    switch (msg.t) {
      case 'hello':       /* server greeting; join already sent on open */ break;
      case 'welcome':
        selfId = msg.id; if (msg.token) selfToken = msg.token; roomCode = msg.room; joined = true;
        hooks.onWelcome(msg);
        break;
      case 'state':        hooks.onState(msg); break;
      case 'peer_joined':  hooks.onPeerJoined(msg.player); break;
      case 'peer_left':    hooks.onPeerLeft(msg.id); break;
      case 'player_state': // a single peer's relayed transform (between ticks).
                           // The consolidated `state` frame also carries all
                           // players, so onPeerState is an optional fast-path.
                           if (opts.onPeerState) opts.onPeerState(msg);
                           break;
      case 'arrow_fired':  hooks.onArrow(msg); break;
      case 'hit':          hooks.onHit(msg); break;
      case 'spawn_wave':   hooks.onSpawnWave(msg); break;
      case 'monster_state':if (opts.onMonsters) opts.onMonsters(msg.monsters); break;
      case 'monster_fx':   if (opts.onMonsterFx) opts.onMonsterFx(msg.fx); break;   // ELEM: render-only FX (reactions/chains/zones/elemi halál)
      case 'player_down':  hooks.onPlayerDown(msg.id); break;
      case 'chat':         hooks.onChat(msg); break;
      case 'room_state':   hooks.onRoomState(msg); break;   // FEJLESZTÉS: várószoba roster+fázis
      case 'room_start':   hooks.onRoomStart(msg); break;   // FEJLESZTÉS: szinkron start
      case 'error':        hooks.onError(msg); break;
      default:             /* unknown / future message types ignored */ break;
    }
  }

  function send(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  }

  // ---- public send helpers --------------------------------------------------
  function sendInput(state) {
    const now = performance.now();
    if (now - lastInputSent < INPUT_MIN_INTERVAL_MS) return;
    lastInputSent = now;
    const _msg = { t: 'player_state', pos: state.pos, yaw: state.yaw, pitch: state.pitch };
    if (typeof state.hp === 'number')      _msg.hp = state.hp;       // omit => server keeps its (melee) value
    if (typeof state.alive === 'boolean')  _msg.alive = state.alive;
    send(_msg);
  }

  function sendShot(shot) {
    send({ t: 'arrow_fired', from: shot.from, dir: shot.dir, power: shot.power, el: shot.el, charge: shot.charge });
  }

  function sendHit(hit) {
    send({ t: 'hit', monsterId: hit.monsterId, headshot: !!hit.headshot, dmg: hit.dmg, el: hit.el, charge: hit.charge, mul: hit.mul });
  }

  function sendChat(text) {
    send({ t: 'chat', text: String(text || '') });
  }

  function sendStart() {   // FEJLESZTÉS: várószoba START — bárki indíthat, a szerver szinkronizál
    send({ t: 'start' });
  }

  function close() {
    closedByUser = true;
    if (reconnectTimer !== null) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (ws) try { ws.close(); } catch { /* ignore */ }
  }

  open();

  return {
    sendInput, sendShot, sendHit, sendChat, sendStart, send, close,
    isOpen: () => !!ws && ws.readyState === WebSocket.OPEN && joined,
    get id() { return selfId; },
    get room() { return roomCode; },
  };
}

export default { connectCoop };
