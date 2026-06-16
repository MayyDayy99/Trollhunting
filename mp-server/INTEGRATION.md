# Integrating co-op into `mohas-roham.html` (OPT-IN, no single-player changes)

The whole point of this scaffold is that **single-player stays the default and
keeps working offline**. Co-op is something the game *opts into* at runtime when
a room is present in the URL. The original `mohas-roham.html` is **not modified**
by this project — a copy is served from `public/` so the server has something to
host, but you make integration edits to *that copy* (or your own build) only.

## The opt-in switch: `?room=CODE`

The game decides co-op vs. single-player from the URL query string:

```
mohas-roham.html              -> single-player (current behaviour, offline)
mohas-roham.html?room=ABCD    -> co-op: connect, join room "ABCD"
mohas-roham.html?room=NEW     -> co-op: connect, let the server assign a code
```

`net-client.js` never touches the DOM or the game's globals; it only calls hooks
you pass in. So when there's no `?room`, you never even import/initialise it, and
the game runs exactly as before.

## Minimal wiring (add to the served copy of the game)

Add this near the top of the game's IIFE — it is a no-op unless `?room` exists:

```js
// ---- CO-OP OPT-IN (single-player is unaffected when ?room is absent) -------
const params  = new URLSearchParams(location.search);
const roomArg = params.get('room');           // null in single-player
let coop = null;                              // stays null offline

if (roomArg) {
  const { connectCoop } = await import('./net-client.js');
  coop = connectCoop({
    room: roomArg === 'NEW' ? undefined : roomArg,   // NEW => server assigns
    name: 'Archer',
    onWelcome: (info) => { console.log('joined room', info.room, 'as', info.id); },
    onState:   (s)    => { /* reconcile peers/monsters from server snapshot */ },
    onArrow:   (a)    => { /* render a peer's arrow: a.from, a.dir, a.power */ },
    onHit:     (h)    => { /* h.killed, h.score (server-confirmed) */ },
    onPeerJoined: (p) => { /* create an avatar for p.id */ },
    onPeerLeft:   (id)=> { /* remove avatar id */ },
  });
}
```

> If your script tag isn't a module, either add `type="module"` to it or replace
> the dynamic `import()` with a regular `<script type="module" src="net-client.js">`
> that assigns `window.connectCoop`. Don't change the single-player code paths.

Then sprinkle the send-calls into existing hooks (all are guarded by `coop &&`):

```js
// In the game loop, after the local player's transform is updated:
coop && coop.sendInput({ pos: player.pos, yaw: player.yaw,
                         pitch: player.pitch, hp: player.hp, alive: player.alive });

// Where the game fires an arrow (fireArrow):
coop && coop.sendShot({ from: start, dir: fwd, power: charge });

// Where an arrow hits a monster (after computing head/dmg):
coop && coop.sendHit({ monsterId: hit.netId, headshot: head, dmg });
```

Because every call is behind `coop &&`, removing the room from the URL instantly
returns the game to pure single-player with zero networking.

## What the server gives you back

- `onWelcome(info)` — `{ id, room, you, players, wave, score, max, tickHz, authority }`
- `onState(state)` — ~20 Hz snapshot: `{ tick, wave, score, players[], monsters[] }`.
  Use it to position peer avatars and (eventually) the shared monsters.
- `onArrow / onHit / onPeerJoined / onPeerLeft / onChat / onSpawnWave / onPlayerDown`.

## What you still have to build (gameplay, not transport)

The transport is done; the **gameplay reconciliation** is the real work:

1. Render **peer archers** (a simple capsule + bow) from `state.players`.
2. Switch monster ownership to the **server** (`state.monsters`) instead of the
   local `monsters[]` array — currently a STUB on the server (see `server.js`
   `stepWaves` TODOs). Give each monster a stable `netId` so `sendHit` can refer
   to it.
3. Suppress the local wave spawner when `coop` is active; drive waves from
   `onSpawnWave` / `state.wave` instead.
4. Share score from `state.score` rather than the local `score`.

None of the above affects single-player, which keeps using the local arrays.
