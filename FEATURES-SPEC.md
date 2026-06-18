# Mohás Roham — Feature Batch Implementation Spec

> Produced by a 7-agent research+design+perf-audit workflow, verified against the real code. Phased by impact × cheapness × dependency. Headless verification: drive `update(dt,t)`/functions + assert on state (preview rAF is paused, screenshots time out); co-op via an in-process `ws` client. Line numbers are approximate — re-locate each anchor before editing.

## PHASE 0 — Performance quick wins (zero gameplay change)
- **0.1 Trees stop casting shadows** (biggest win): in `tree()`, after `scene.add(g)`, `g.traverse(o=>{ o.castShadow=false; })`. Keep receiveShadow. ~68 trees × ~10 meshes were rendered in the shadow pass.
- **0.2 Trolls cast shadows only on silhouette parts**: in `makeMonster` the `g.traverse` sets `castShadow=true` on every submesh; change default to `castShadow=false; receiveShadow=true`, then after `T.build(m)`+`embellishTroll(m)` re-enable casting only on torso, `m.head`, the 4 limb roots.
- **0.3 Particle pools skip uploads when idle**: in `makeRichPool.update` (RP/SMK) and `Particles.update` (sparks/gore), track `let live=false` set true when a slot has `life>0`, and only set the `needsUpdate=true` lines `if(live)`.
- **0.4 `orientArrow` scratch vector**: hoist `const _look=new THREE.Vector3()`; `_look.copy(a.g.position).add(a.vel); a.g.lookAt(_look)`.
- **0.5 `updateUltHud`**: cache `#ultlab` + the chip elements once; early-out when `ult`/`currentElement` unchanged.
- **0.6 eye-flash loops**: replace the two per-monster `m.eyes.forEach(...)` with `for(const e of m.eyes)`.
- Renderer already sane (pixelRatio capped 1.5, PCF, 1024² shadow). Don't change shadow frustum/size.

## PHASE 1 — Combat feel: fire-rate/reload gate + melee (RMB=bow, LMB=melee)
- State: `shotCd=0; SHOT_CD=0.85; MIN_CHARGE=0.18; meleeCd=0; meleeAnim=0; MELEE_CD=0.55; MELEE_RANGE=3.4; MELEE_ARC=0.55; MELEE_DMG=55`.
- `startDraw()` gated by `shotCd<=0`. mousedown: LMB→`meleeSwing()`, RMB→`startDraw()` (RMB also drags-look in no-lock fallback). mouseup: only RMB fires, `if(charge>=MIN_CHARGE){ fireArrow(charge); shotCd=SHOT_CD; }`.
- Tick `shotCd`/`meleeCd`/`meleeAnim` in the draw-ramp block; recolor `#powfill` (armed/under-charged/reloading).
- `meleeSwing()`: frontal-arc nearest troll (dot vs `player.yaw` > 1-MELEE_ARC, dist<MELEE_RANGE), brittle ×1.5, resist['base'], knockback, gore/sparks, AUD.whoosh+hit, `killMonster`. head=`player.pitch>0.35`. Co-op: `coopIsRemote` → `coopOnLocalHit(m,head,MELEE_DMG,'base',0)` (server already consumes the hit envelope — no server change).
- Slash anim on `bow` via `meleeAnim`. `cancelDraw()` resets the timers.

## PHASE 2 — Troll HP bars + wave/wisp balance + co-op HP bug
- **2.1 HP bars**: ONE shared `HPBAR_GEO` (PlaneGeometry(1,0.12) translated +0.5 x = left-anchored) + 4 shared `MeshBasicMaterial` (bg/hi/mid/lo, depthTest:false, fog:false, toneMapped:false). `attachHpBar(m)`: Group under `m.g` at `y=(m.headCY/m.scale)+0.55`, bg+fill quads, hidden until damaged. Per-frame in the living-monster loop: `grp.quaternion.copy(camera.quaternion)`, update fill `scale.x`, swap material only when `frac` changed, show-on-damage linger. **disposeMonster guard:** `if(o.geometry && o.geometry!==HPBAR_GEO) o.geometry.dispose()`. Co-op: free (built via makeMonster; monsterView carries hp/maxHp).
- **2.2 Wave scaling (gentle)**: client `spawnMonster`: `baseHp=24+wave*8+max(0,wave-5)*3`, `baseSp=(1.5+wave*0.10)*rand(.85,1.15)`, `baseSc=rand(.85,1.15)*(1+wave*0.012)`. **Server bug fix:** server applies NO per-type muls → add `TYPE_STATS` table (copy EXACT hpMul/speedMul/speedCap from client TROLL_TYPES) and apply in server `spawnMonster` with the same baseHp/baseSp formula.
- **2.3 Wisp fix**: client `pickTrollType` wisp weight `w>=4 ? clamp(1.2+(w-4)*0.45,0,4.5):0`. **Server bug:** `TROLL_TYPES` array missing `'wisp'` + `rollTrollType` has no wisp row → co-op never spawns wisp. Add `'wisp'` to the array + the weighted row.

## PHASE 3 — Elemental "where it glows, it hurts"
- **3.1 Edge-aware select**: client `nearestTrolls` `if(d-(o.bodyR||0.4)<radius)`; server `elNearest` `if(d-0.7<radius)`.
- **3.2 Align radii**: ignite damage radius `R`→`R*1.3` (matches green ring), both files; overload visible ring r1 6→9 (damage already 9); gas announce ring 3.0→2.2 (matches rMax).
- **3.3 Impact splash** `elementalSplash(hit,el,dmg,charge,head)`: fire 3.6 / ice 3.0 / poison 2.6 / lightning 0; frac 0.30/0.22/0.20, ×1.5 head, ≤4 targets. Call only on non-reaction path (`_skip===false` && `a.el!=='base'`). Fold the bespoke base-fire branch into it.
- **3.4 Co-op**: mirror 3.1–3.3 server-side (identical radii). Fix server zone-DoT hole: add `room.zones[]` + `stepZones(room,dt)` (gas dps3/rMax2.2, fire dps5/rMax2.5, 0.5s tick, applyServerStatus + reapDead).

## PHASE 4 — World traversal: tree-platforms + canopy bridge + HP-pickup orbs
- Physics: PLAYER_R 0.42, STEP 0.55, jump budget ~1.47 → ≤0.55 walk, ≤1.47 one hop. Every plank = `climbStruct(...)` (registers `solidBox{climb,top,mob:true}`).
- **4.1** Watchtower spiral at (18,9) (8 planks +0.45 each, deck top≈4.1); stone+plank ladder at (8,18) (deck≈4.1); ~9 overlapping planks bridging A↔B at top≈4.1 (mob:true → trolls can't follow). Push `[18,9,3.0]`,`[8,18,3.0]` into KEEP_CLEAR before the GROVES loops.
- **4.2 HP orbs** (warm green/amber, distinct from cyan decor): `makeHpOrb(x,z)`+`hpOrbs[]`, 4 placements (one on deck A). Per-frame: bob/spin, 1.6 pickup radius, heal 30 via `setHp` (skip at full HP), EFX/RP pop, `AUD.heal`, toast, 20s respawn. Reset all on `startWave`/`resetGame`. Co-op: local-player heal, no server change.

## PHASE 5 — Caves as spawn points (user-requested; synth deferred it as separate)
- ~5 opaque cave structures around the ring (dark interior, can't see in). `spawnMonster` picks a cave + spawns at its mouth + brief emerge walk (replace the SPAWN_R ring spawn). Player can't enter (solid, `solidCyl` no mob = player-only barrier), trolls exit. Server: shared cave position list; spawn from caves. Build on the Phase-2.2 cleaned `spawnMonster`.

## Notes
- No wire-protocol change in any phase (monsterView already carries hp/maxHp/st; melee reuses the `hit` envelope).
- Files: `mohas-roham.html` (all), `mp-server/server.js` (Phases 2,3,5).
- **Must verify before commit:** exact per-type `hpMul/speedMul/speedCap` from the client `TROLL_TYPES` table when filling server `TYPE_STATS`.
