/* ===================== CO-OP (OPT-IN: only active with ?room=CODE) =====================
   Single-player is 100% unchanged when there is no ?room — `coop` stays null and every
   hook below is gated. r128, reuses makeMonster/killMonster/addScore/arrows pool/HUD vars.
   `coop` and the coopXxx() helpers are FUNCTION-DECLARATION / var hoisted to the IIFE top,
   so the hook edits in update()/fireArrow()/collision can reference them regardless of the
   fact that this block is textually inserted after frame(). ----------------------------- */
var coop = null;                                  // the connectCoop handle (null offline)
var coopMyId = null;                              // our server-assigned player id
var coopDowned = false;                           // FIX: saját elesés egyszeri kapuzása (szerver-auth)
var coopStarted = false;                          // FIX: volt-e már Start? (Start előtt nincs szerver-szörny; szünetben viszont reconcile fut)
var coopReviveAt = 0;                             // FIX: revive türelmi idő (elavult hp=0 state ne triggereljen gameOver-t)
var coopWelcomed = false;                          // v2: volt-e már welcome? (pid mellett a stabil id-vel detektáljuk az újracsatlakozást)
var coopHost = null;                               // szerver LAN IP-je a meghívó-linkhez (welcome.host)
var coopPeers = new Map();                        // peerId -> { g, buf, has, name } avatar
var coopRemoteById = new Map();                   // server monster netId -> local monster obj (also in monsters[])
var coopWaveNum = 0;                              // last server wave (for HUD)
var coopPeerArrows = [];                          // tiny tracer pool for peer shots
// ===== VÁRÓSZOBA (szinkron start): bárki nyomhat START-ot, mindenki egyszerre indul =====
var coopWaitEl=null, coopWaitListEl=null, coopWaitCountEl=null, coopWaitCodeEl=null, coopWaitWired=false;
var coopWaitRoster=[];        // legutóbbi szerver-roster [{id,name,playing}]
var coopInWaitRoom=false;     // épp a várószoba-overlay látszik?
function coopWireWait(){ if(coopWaitWired) return; coopWaitWired=true;
  coopWaitEl=document.getElementById('coopWait'); coopWaitListEl=document.getElementById('coopWaitList');
  coopWaitCountEl=document.getElementById('coopWaitCount'); coopWaitCodeEl=document.getElementById('coopWaitCode');
  const b=document.getElementById('coopStartBtn');
  if(b) b.addEventListener('click', function(){ if(coop){ coop.send({t:'start'}); b.disabled=true; b.textContent=tr('coop.starting'); } });   // bárki indíthat; a szerver szinkronizál (NINCS helyi beginPlay)
}
function coopRenderWait(){ if(!coopWaitListEl) return;
  if(coopWaitCodeEl) coopWaitCodeEl.textContent=((coop&&coop.room)||_coopRoom||'----');
  if(coopWaitCountEl) coopWaitCountEl.textContent=String(coopWaitRoster.length||1);
  const frag=document.createDocumentFragment();
  for(const p of coopWaitRoster){ const li=document.createElement('li'); if(p.id===coopMyId) li.className='me';
    const dot=document.createElement('span'); dot.className='pd'; li.appendChild(dot);
    li.appendChild(document.createTextNode(p.id===coopMyId?tr('coop.you'):(p.name||'Archer')));
    if(p.playing){ const t=document.createElement('span'); t.className='tag'; t.textContent=tr('coop.playing'); li.appendChild(t); }
    frag.appendChild(li); }
  coopWaitListEl.replaceChildren(frag);
}
function coopShowWait(){ coopWireWait(); coopInWaitRoom=true; coopRenderWait();
  startScreen.classList.add('hide'); pauseScreen.classList.add('hide'); overScreen.classList.add('hide');
  if(coopWaitEl){ const b=document.getElementById('coopStartBtn'); if(b){ b.disabled=false; b.textContent=tr('coop.start'); } coopWaitEl.classList.remove('hide'); }
  if(document.pointerLockElement) document.exitPointerLock(); }
function coopHideWait(){ coopInWaitRoom=false; if(coopWaitEl) coopWaitEl.classList.add('hide'); }
const _coopParams = new URLSearchParams(location.search);
const _coopRoom   = _coopParams.get('room');      // null => single-player
{ const b=document.getElementById('langBtn'); if(b) b.addEventListener('click',function(e){ e.preventDefault(); e.stopPropagation(); setLang(lang==='hu'?'en':'hu', true, true); }); applyI18n(); }

function coopActive(){ return !!coop; }

/* ---- buffered entity interpolation (kills the 20Hz chase-latest jitter) ----
   Each networked entity (peer + remote monster) keeps a tiny ring of timestamped
   snapshots. We render it at (now - INTERP_DELAY_MS) by lerping between the two
   bracketing snapshots, so motion is smooth even though authority arrives @20Hz. */
const COOP_INTERP_DELAY_MS = 110;   // render ~2 ticks in the past (20Hz => 50ms/tick)
const COOP_BUF_MAX = 24;            // ~1.2s of history @20Hz; plenty for trimming
function coopNow(){ return performance.now(); }
/* push a timestamped snapshot onto an entity buffer (monotonic, trimmed) */
function coopPushSnap(buf, x, y, z, yaw){
  const t = coopNow();
  const last = buf.length ? buf[buf.length-1] : null;
  if(last && t - last.t < 1) return;            // ignore duplicate same-frame stamps
  buf.push({ t, x, y, z, yaw });
  // trim by count and by age (keep a little past the render delay)
  while(buf.length > COOP_BUF_MAX) buf.shift();
  const cutoff = t - (COOP_INTERP_DELAY_MS + 400);
  while(buf.length > 2 && buf[0].t < cutoff) buf.shift();
}
/* sample a buffer at renderTime; writes into out {x,y,z,yaw}. returns false if empty.
   yaw is lerped along the shortest arc. Falls back to newest when the buffer is short
   or the render time is outside the buffered window. */
function coopSampleBuf(buf, renderTime, out){
  const n = buf.length;
  if(n === 0) return false;
  if(n === 1){ const s=buf[0]; out.x=s.x; out.y=s.y; out.z=s.z; out.yaw=s.yaw; return true; }
  const newest = buf[n-1];
  if(renderTime >= newest.t){ out.x=newest.x; out.y=newest.y; out.z=newest.z; out.yaw=newest.yaw; return true; }
  const oldest = buf[0];
  if(renderTime <= oldest.t){ out.x=oldest.x; out.y=oldest.y; out.z=oldest.z; out.yaw=oldest.yaw; return true; }
  // find bracketing pair a (<=renderTime) and b (>renderTime)
  let a = buf[0], b = buf[1];
  for(let i=1;i<n;i++){ if(buf[i].t >= renderTime){ b=buf[i]; a=buf[i-1]; break; } }
  const span = b.t - a.t;
  const f = span > 0 ? (renderTime - a.t)/span : 0;
  out.x = a.x + (b.x-a.x)*f;
  out.y = a.y + (b.y-a.y)*f;
  out.z = a.z + (b.z-a.z)*f;
  let dy = b.yaw - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  out.yaw = a.yaw + dy*f;
  return true;
}
const _coopSample = { x:0, y:0, z:0, yaw:0 };   // scratch, reused each sample

/* ---- in-game co-op HUD state (room code, copy-link, players, status dot) ---- */
var coopHudEl = null, coopHudRoomEl = null, coopHudPlayersEl = null, coopHudDotEl = null, coopHudCopyEl = null;
var coopConnected = false;                        // drives the status dot (open/close)

/* ---- peer ARCHER avatar: low-poly ranger (head/hood, tunic torso, 2 arms, 2 legs, held recurve bow).
   Feet at local y=0; ~1.7 tall; faces +Z. Built ONCE per peer. Reuses mesh()/existing materials only. ---- */
function coopMakePeer(id, name){
  if(coopPeers.has(id)) return coopPeers.get(id);
  const g = new THREE.Group();
  // COOP-COLOR: minden játékos kap egy megkülönböztető színt (csatlakozási sorrend szerint)
  const PCOL=[0x36c5ff,0xffd27a,0x9f6aff,0x5fd08a]; const colHex=PCOL[coopPeers.size % PCOL.length];
  const trimMat=new THREE.MeshStandardMaterial({color:colHex, emissive:colHex, emissiveIntensity:0.35, roughness:0.6});

  // --- legs: two tapered cloth shanks + boot toes, planted at y=0, hips at ~0.90 ---
  [-1,1].forEach(s=>{
    const leg = mesh(new THREE.CylinderGeometry(0.115,0.095,0.86,7), clothMat, s*0.135,0.44,0);
    leg.rotation.x = s*0.04;                                   // tiny stance splay
    g.add(leg);
    g.add(mesh(new THREE.CylinderGeometry(0.085,0.10,0.16,6), skinDark, s*0.135,0.07,0.02)); // boot ankle
    const toe = mesh(new THREE.ConeGeometry(0.10,0.22,5), skinDark, s*0.135,0.045,0.16);     // boot toe
    toe.rotation.x = Math.PI/2; g.add(toe);
  });

  // --- torso: tapered ranger tunic + a slung quarter-belt + a hooded cowl ridge on the back ---
  const torso = mesh(new THREE.CylinderGeometry(0.255,0.215,0.78,9), clothMat, 0,1.27,0);
  g.add(torso);
  g.add(mesh(new THREE.CylinderGeometry(0.265,0.265,0.10,9), skinDark, 0,1.00,0));   // waist belt
  g.add(mesh(new THREE.SphereGeometry(0.30,9,7), hairMat, 0,1.62,-0.10, 1.0,0.7,1.1)); // hood cowl over shoulders/back
  g.add(mesh(new THREE.SphereGeometry(0.20,8,6), clothMat, 0,1.58,0.02, 1.05,0.9,1.0)); // upper-chest mantle fill

  // --- head: green-skin face with a pulled-up ranger hood (hairMat) framing it ---
  g.add(mesh(new THREE.SphereGeometry(0.185,10,8), skinMat, 0,1.86,0.03));            // head/face
  g.add(mesh(new THREE.SphereGeometry(0.215,10,8), hairMat, 0,1.90,-0.04, 1.05,1.08,1.0)); // hood shell (back/top)
  g.add(mesh(new THREE.ConeGeometry(0.12,0.20,7), hairMat, 0,2.10,-0.05));            // hood peak

  // --- arms: LEFT extended forward gripping the bow; RIGHT bent back at the string (draw pose) ---
  const armL = new THREE.Group(); armL.position.set(0.235,1.55,0); g.add(armL);       // left shoulder
  armL.rotation.set(-1.15,0,0.10);                                                     // raise straight out front
  armL.add(mesh(new THREE.CylinderGeometry(0.075,0.06,0.62,6), clothMat, 0,-0.31,0));  // sleeve
  armL.add(mesh(new THREE.SphereGeometry(0.07,7,6), skinMat, 0,-0.62,0));              // bow hand

  const armR = new THREE.Group(); armR.position.set(-0.235,1.55,0); g.add(armR);       // right shoulder
  armR.rotation.set(-0.55,0.55,-0.10);                                                 // pull back toward face
  armR.add(mesh(new THREE.CylinderGeometry(0.075,0.06,0.50,6), clothMat, 0,-0.25,0));  // sleeve
  armR.add(mesh(new THREE.SphereGeometry(0.07,7,6), skinMat, 0,-0.50,0));              // string hand

  // --- bow: ONE smooth recurve stave (CatmullRom -> Tube) + a straight pale string, held upright in the LEFT hand, aimed +Z.
  //     Attached to the BODY (g) at the computed hand point — NOT to the tilted arm — so no compound rotations = clean & predictable. ---
  const bow = new THREE.Group();
  bow.position.set(0.20,1.30,0.52);          // forward left-hand grip point (chest height, out front)
  g.add(bow);
  const bowCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0,-0.46,-0.175), new THREE.Vector3(0,-0.40,-0.115), new THREE.Vector3(0,-0.22,-0.035),
    new THREE.Vector3(0, 0.00, 0.000),                                    // belly (grip) bulges toward +Z target
    new THREE.Vector3(0, 0.22,-0.035), new THREE.Vector3(0, 0.40,-0.115), new THREE.Vector3(0, 0.46,-0.175)
  ]);
  const stave = new THREE.Mesh(new THREE.TubeGeometry(bowCurve, 28, 0.018, 6, false), woodMat); stave.castShadow=true; bow.add(stave);
  bow.add(mesh(new THREE.SphereGeometry(0.024,6,5), woodDark, 0,-0.46,-0.175));   // lower nock tip
  bow.add(mesh(new THREE.SphereGeometry(0.024,6,5), woodDark, 0, 0.46,-0.175));   // upper nock tip
  bow.add(mesh(new THREE.CylinderGeometry(0.030,0.030,0.15,7), woodDark, 0,0,0.005));  // leather grip wrap at the belly
  bow.add(mesh(new THREE.CylinderGeometry(0.006,0.006,0.92,4), tuskMat, 0,0,-0.175));  // straight bowstring (nock to nock)
  bow.scale.setScalar(1.9);   // ~2x nagyobb, prominensebb íj — a grip-origó körül skálázódik, így a kézben marad

  // --- COOP-COLOR: per-player cloak trim + sash + glózó háti tegez-toll a játékos színében ---
  g.add(mesh(new THREE.CylinderGeometry(0.235,0.235,0.05,9), trimMat, 0,1.66,0));                 // színes gallér-szegély
  // mell-sash KIVÉVE — fura kék téglalapként olvasott a hason
  g.add(mesh(new THREE.CylinderGeometry(0.05,0.06,0.42,7), woodDark, -0.14,1.5,-0.22));            // háti tegez
  for(let i=0;i<3;i++){ const fl=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:colHex,transparent:true,opacity:0.85,depthWrite:false,blending:THREE.AdditiveBlending})); fl.scale.setScalar(0.12); fl.position.set(-0.14+(i-1)*0.04,1.74,-0.22); g.add(fl); }

  g.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
  scene.add(g);
  const peer = { g, name:name||'Archer', color:colHex,
                 buf:[], has:false, lastX:0, lastZ:0,
                 armR, armL, bow, armRB:[armR.rotation.x,armR.rotation.y,armR.rotation.z], armLB:[armL.rotation.x,armL.rotation.y,armL.rotation.z], drawT:0 };  // + húzás-animáció refek (kar-alap-forgatások + timer)
  coopPeers.set(id, peer);
  if(coopHudEl) coopUpdateHudPlayers();
  return peer;
}
function coopRemovePeer(id){
  const p = coopPeers.get(id); if(!p) return;
  scene.remove(p.g);
  p.g.traverse(o=>{ if(o.isMesh && o.geometry) o.geometry.dispose(); });
  coopPeers.delete(id);
  if(coopHudEl) coopUpdateHudPlayers();
}

/* ---- server monster reconciliation: build a real troll, tag it, share monsters[] ---- */
function coopTrollTypeId(t){ return (typeof t==='string' && TROLL_TYPES[t]) ? t : 'grunt'; }
function coopEnsureMonster(sm){
  if(!coopStarted) return null;        // FIX: Start előtt ne hozz létre szerver-szörnyet; szünetben igen
  const netId = sm.id;
  let m = coopRemoteById.get(netId);
  if(!m){
    const id = coopTrollTypeId(sm.type);
    const sc = (typeof sm.scale==='number' && sm.scale>0) ? sm.scale : ((TROLL_TYPES[id] && TROLL_TYPES[id].scaleMul) || 1.0); // típus-helyes méret (a szerver most már küld scale-t)
    const hp = (typeof sm.hp==='number') ? sm.hp : (typeof sm.maxHp==='number'?sm.maxHp:40);
    m = makeMonster(id, sc, hp, (typeof sm.speed==='number'?sm.speed:2), (sm.el!==undefined?sm.el:null), sm.seed);   // RANDOM ELEM + TROLLGEN-SEED: a szerver sorsolta (monsterView.el/.seed) -> minden kliens UGYANAZT a trollt építi
    m.coopRemote = true;            // <- collision loop reports this; AI/local-death gated by it
    m.netId = netId;
    if(typeof sm.maxHp==='number') m.maxHp = sm.maxHp;
    const p = sm.pos||{x:0,y:GROUND_Y,z:0};
    m.g.position.set(p.x, p.y!=null?p.y:GROUND_Y, p.z);
    m.coopBuf = [];                 // timestamped authority snapshots for interpolation
    m.coopYaw = m.g.rotation.y;     // smoothed facing
    monsters.push(m);               // share the SAME array the renderer/collision/radar already use
    coopRemoteById.set(netId, m);
  }
  // push the authority snapshot into the interpolation buffer + update hp
  const p = sm.pos; if(p){
    const yaw = (m.coopBuf.length ? m.coopBuf[m.coopBuf.length-1].yaw : m.g.rotation.y);
    coopPushSnap(m.coopBuf, p.x, (p.y!=null?p.y:GROUND_Y), p.z, yaw);
  }
  if(typeof sm.hp==='number') m.hp = sm.hp;
  coopApplyStatusVisual(m, sm.st);   // ELEM: szerver-státusz -> vizuális aura/szem-tint/jégburok a távoli trollon
  return m;
}
function coopReconcileMonsters(serverMons){
  if(!coopStarted) return;             // FIX: Start után mindig (szünetben is) reconcile
  const seen = new Set();
  if(Array.isArray(serverMons)) for(const sm of serverMons){ if(sm && sm.id!=null){ coopEnsureMonster(sm); seen.add(sm.id); } }
  // monsters the server dropped without an explicit kill (e.g. wave reset) -> remove quietly
  for(const [netId, m] of coopRemoteById){
    if(!seen.has(netId) && m.alive && m.dying<=0){
      const idx = monsters.indexOf(m);
      if(idx>=0){ scene.remove(m.g); disposeMonster(m); monsters.splice(idx,1); }
      coopRemoteById.delete(netId);
    }
  }
}
/* server confirmed a kill -> play the existing death anim (it auto-removes from monsters[]) */
function coopKillRemote(netId, headshot){
  const m = coopRemoteById.get(netId);
  coopRemoteById.delete(netId);
  if(m && m.alive){ const _s=score; killMonster(m, !!headshot); score=_s; scoreN.textContent=_s; } // FIX: a pontot a szerver adja, ne dupláz
}
/* ELEM co-op: a szerver `st` összefoglalójából VIZUÁLIS státusz a TÁVOLI trollon (aura/szem-tint/jégburok). A hp/DoT/AI a szerveré. */
function coopApplyStatusVisual(m, st){
  const e=(st&&st.e)||null;
  if(e!==m.statusEl){ m.statusEl=e; m.statusStacks=st?(st.s||1):1;
    if(e){ const cfg=STATUS_CFG[e]; if(m._eyeBase==null && m.eyes&&m.eyes[0]) m._eyeBase=m.eyes[0].material.emissive.getHex(); if(m.eyes&&cfg) m.eyes.forEach(x=>x.material.emissive.setHex(cfg.tint)); }
    else if(m._eyeBase!=null && m.eyes) m.eyes.forEach(x=>x.material.emissive.setHex(m._eyeBase)); }
  const frozen=!!(st&&st.f);
  if(frozen){ if(!m.iceShell || !m.iceShell.userData.full){ removeIceShell(m); m.iceShell=buildIceShell(m,true); m.g.add(m.iceShell); } }
  else if(e==='ice'){ if(!m.iceShell) freezeEncase(m); else if(m.iceShell.userData.full){ removeIceShell(m); freezeEncase(m); } }
  else if(m.iceShell) removeIceShell(m);
  m.frozenSolid=frozen?1:0;
}
/* ELEM co-op: vizuál-only reakció-villanás a megadott talajponton */
// ELNYELÉS-TELL (rossz elem): befelé-omló gyűrű + felfelé szálló motesok + 'ELNYELTE!' — másképp olvas, mint egy sebző becsapódás
function absorbTellAt(x, z, el){ const y=GROUND_Y+1.2, col=(TROLL_EL[el]&&TROLL_EL[el].aura)||0x9becff;
  EFX.ring(x, GROUND_Y+0.05, z, col, 3.2, 0.4, 0.5, 0.85);   // BEFELÉ (r0>r1) -> 'beszívás', nem terjedő sebző-gyűrű
  EFX.flash(x, y, z, col, 0.5, 2.0, 0.28, 0.9); EFX.light(x, y, z, col, 2.4, 0.22);
  for(let i=0;i<10;i++){ const a=rand(0,6.28); RP.spawn(x+Math.cos(a)*0.6, y-0.4, z+Math.sin(a)*0.6, Math.cos(a)*1.2, rand(1.5,3.0), Math.sin(a)*1.2, col, rand(0.35,0.6), 0.02, rand(0.5,0.9), -1.0, 1.4); }
  toast(tr('toast.absorb')); if(AUD.hit) AUD.hit(); }
function absorbTell(m, el){ m.hurtFlash=0; absorbTellAt(m.g.position.x, m.g.position.z, el); }
function reactionFxVisual(kind, x, z){ const y=GROUND_Y+1.2;   // co-op: a szerver által eldöntött reakció LÁTVÁNYA (az SP applyReaction receptjeivel azonos stílus)
  if(kind==='overload'){ VFX.column(x,GROUND_Y,z,0.8,13,0x8fb8ff,0.34); VFX.flare(x,y,z,0x9fc4ff,4.2,0.22); EFX.ring(x,GROUND_Y+0.05,z,0x9fd0ff,0.5,9,0.5,0.9); EFX.light(x,y,z,0xbfe6ff,4.5,0.3);
    VFX.spray(x,y,z,22,[0xffffff,0xbfe9ff,0xa98cff],12,{up:-0.3,life:0.4,grav:8,w:0.022,len:0.04}); VFX.decal(x,GROUND_Y,z,2.4,1,0x0a0c14,0.8,6,0x7fb4ff,1.4); shake=Math.max(shake,0.4); toast(tr('toast.overload')); }
  else if(kind==='steam'){ VFX.flare(x,y,z,0xdfeeff,3.0,0.18); VFX.spray(x,y,z,14,[0xffffff,0xcfe6ff],7,{up:0,lift:2,life:0.5,grav:10,w:0.022,len:0.05}); for(let i=0;i<14;i++) SMK.spawn(x+rand(-0.3,0.3),y,z+rand(-0.3,0.3),rand(-1,1),rand(0.5,1.6),rand(-1,1),0xdfeaf2,0.8,2.2,0.9,-0.5,0.8,0.7); toast(tr('toast.steam')); }
  else if(kind==='ignite'){ VFX.ball(x,y,z,0.6,2.6,0.55,VFX.PAL.fire); VFX.ball(x,y,z,0.4,1.5,0.4,VFX.PAL.toxic); VFX.flare(x,y,z,0xff9a3a,4.5,0.2); EFX.ring(x,GROUND_Y+0.05,z,0x9fdc4a,0.4,5.5,0.45,0.85); EFX.light(x,y,z,0xff7a3d,4.5,0.35);
    VFX.spray(x,y,z,26,[0xffd27a,0xff8a3a,0xff5a2a,0x9fdc4a],10,{up:-0.1,lift:2,life:0.7,grav:8,w:0.022,len:0.05}); VFX.decal(x,GROUND_Y,z,2.8,0,0x120805,0.75,9,0xff6a1a,2.6); shake=Math.max(shake,0.4); toast(tr('toast.ignite')); }
  else if(kind==='galvanic'){ VFX.flare(x,y,z,0xb8f25a,1.8,0.16); VFX.spray(x,y,z,10,[0x9fdc4a,0xc8f060],6,{up:-0.2,lift:1,life:0.4,grav:11,w:0.024,len:0.05}); EFX.light(x,y,z,0x9fdc4a,2.2,0.2); toast(tr('toast.galvanic')); }
  else if(kind==='frostrot'){ VFX.flare(x,y,z,0x9fdcff,1.8,0.18); EFX.ring(x,GROUND_Y+0.05,z,0x9fd2ff,0.3,2.6,0.4,0.8); }
  else if(kind==='nova'){ EFX.flash(x,GROUND_Y+2,z,0xbcd4ff,1,ARENA_R*0.8,0.5,0.4); EFX.ring(x,GROUND_Y+0.05,z,0x9fd2ff,1,ARENA_R,0.9,0.95); VFX.column(x,GROUND_Y,z,1.5,26,0xbcd4ff,0.7); VFX.flare(x,GROUND_Y+1.6,z,0xbcd4ff,7,0.3); EFX.light(x,GROUND_Y+3,z,0xffffff,9,0.7); shake=Math.max(shake,0.7); toast(tr('toast.viharPlain')); }
}
/* ELEM co-op: a szerver monster_fx eseményeinek lejátszása (reakció/lánc/zóna/elemi halál) — vizuál-only */
function coopHandleFx(fx){ if(!Array.isArray(fx)) return;
  for(const e of fx){
    if(['cast','wbolt','sbomb','beam'].includes(e.k)){
      const m=coopRemoteById.get(e.id); if(m) m._castRecoil=1;
    }
    if(e.k==='reaction'){ if(e.kind==='splash'){ const col=e.el==='fire'?0xff7a3d:e.el==='ice'?0x9fd0ff:0x9fdc4a, r=e.r||3; EFX.ring(e.x,GROUND_Y+0.05,e.z,col,0.4,r,0.4,0.7); EFX.flash(e.x,GROUND_Y+0.6,e.z,col,0.35,r*0.6,0.22); } else if(e.kind==='absorb'){ absorbTellAt(e.x, e.z, e.el); } else reactionFxVisual(e.kind, e.x, e.z); }   // ROSSZ-ELEM elnyelés tell (a szerver dönti el)
    else if(e.k==='chain' && e.from && e.to){ const c=(e.el==='poison')?0x9fdc4a:0xffffff; EFX.bolt(e.from.x,GROUND_Y+1.2,e.from.z, e.to.x,GROUND_Y+1.2,e.to.z, c, 0.16, 0.4); EFX.bolt(e.from.x,GROUND_Y+1.2,e.from.z, e.to.x,GROUND_Y+1.2,e.to.z, 0xb48cff, 0.16, 0.5); }
    else if(e.k==='zone'){ spawnZone(e.kind, e.x, e.z, {}); }
    else if(e.k==='split'){ gore.burst(e.x,GROUND_Y+1.1,e.z,26,0x6f7a72,9,0.55); gore.burst(e.x,GROUND_Y+1.1,e.z,12,0xc98a3a,7,0.6); sparks.burst(e.x,GROUND_Y+1.1,e.z,16,0xffb24d,7,0.5); EFX.ring(e.x,GROUND_Y+0.05,e.z,0xc98a3a,0.5,3.6,0.5,0.85); EFX.flash(e.x,GROUND_Y+1.0,e.z,0xffce5a,0.5,3.0,0.22); shake=Math.max(shake,0.35); }   // OSZTÓDÁS FX (a szilánkokat a monsterView hozza)
    else if(e.k==='cast' && e.from && e.to){ EFX.bolt(e.from.x,e.from.y||GROUND_Y+2,e.from.z, e.to.x,e.to.y||GROUND_Y+1.3,e.to.z, 0x6fe0ff,0.16,0.3); EFX.flash(e.from.x,e.from.y||GROUND_Y+2,e.from.z,0x6fe0ff,0.4,1.6,0.25); }   // SÁMÁN arkán lövedék (a wither/HP a szerveré)
    else if(e.k==='beam' && e.to){ let ax,ay,az; const sm=coopRemoteById.get(e.id); if(sm&&sm.staffCrystal){ const c=new THREE.Vector3(); sm.staffCrystal.getWorldPosition(c); ax=c.x;ay=c.y;az=c.z; } else if(e.from){ ax=e.from.x;ay=GROUND_Y+2.0;az=e.from.z; } else { ax=e.to.x;ay=GROUND_Y+2;az=e.to.z; } drawBeam(ax,ay,az, e.to.x,(e.to.y!=null?e.to.y:GROUND_Y+1.3),e.to.z, performance.now()*0.001); }   // SÁMÁN gyengítő-nyaláb (vizuál; a HP/wither a szerver state-ből jön)
    else if(e.k==='kill'){ const m=coopRemoteById.get(e.id); if(m){ if(e.el) m.statusEl=e.el; coopKillRemote(e.id, false); } }   // elem-igazított halál a távoli trollon
    else if(e.k==='wbolt' && e.from && e.to){ EFX.bolt(e.from.x,e.from.y,e.from.z, e.to.x,e.to.y,e.to.z, 0x9becff,0.16,0.35); EFX.flash(e.from.x,e.from.y,e.from.z,0x9becff,0.4,1.6,0.25); EFX.flash(e.to.x,e.to.y,e.to.z,0x9fd0ff,0.5,1.8,0.3); }   // LIDÉRC jég-lövedék (HP a szerveré)
    else if(e.k==='wispaura'){ EFX.ring(e.x,GROUND_Y+0.06,e.z,0x9becff,0.25,(e.r||3)*2,0.3,0.4); }   // LIDÉRC erősítő-zóna pulzus
    else if(e.k==='warn'){ const c=e.col||0xff6a3d, d=Math.min(1.2, e.dur||0.8); EFX.ring(e.x,GROUND_Y+0.06,e.z, c, 2.8, 0.5, d, 0.9); EFX.ring(e.x,GROUND_Y+0.06,e.z, 0xffffff, 1.0, 0.2, d, 0.5); EFX.light(e.x,GROUND_Y+0.4,e.z, c, 2.2, d); }   // TELEGRÁF: becsapódás-jelző (befelé húzódó gyűrű a windup alatt) -> a ranged támadás KIKERÜLHETŐ, ha ellépsz a pontról
    else if(e.k==='sbomb' && e.from && e.to){ EFX.bolt(e.from.x,e.from.y,e.from.z, e.to.x,e.to.y,e.to.z, 0x9acb3a,0.14,0.3); gore.burst(e.to.x,GROUND_Y+0.1,e.to.z,10,0x6b8f3a,4,0.4); }   // köpködő-bomba
  }
}

/* ---- per-frame interpolation of peers + remote monsters (called from coopTick) ---- */
function coopInterp(dt){
  const renderTime = coopNow() - COOP_INTERP_DELAY_MS;   // render everyone slightly in the past
  // ---- peers: sample buffered transform, keep local walk-cycle facing ----
  for(const p of coopPeers.values()){
    // HÚZÁS: lövéskor indított húz->elenged (a jobb/húr-kar hátrahúz + visszaenged; bal/íj-kar enyhén megfeszül). Bufferig-független.
    if(p.drawT>0 && p.armR){
      p.drawT=Math.max(0,p.drawT-dt);
      const DUR=0.42, t=1-p.drawT/DUR, amt=Math.sin(Math.min(1,t)*Math.PI);   // 0->1 (teljes húzás középen) ->0
      p.armR.rotation.set(p.armRB[0]-0.62*amt, p.armRB[1]+0.36*amt, p.armRB[2]);
      p.armL.rotation.set(p.armLB[0]-0.10*amt, p.armLB[1], p.armLB[2]);
      if(p.drawT===0){ p.armR.rotation.set(p.armRB[0],p.armRB[1],p.armRB[2]); p.armL.rotation.set(p.armLB[0],p.armLB[1],p.armLB[2]); }   // vissza az alap-pózba
    }
    if(!p.has || p.buf.length===0) continue;
    if(coopSampleBuf(p.buf, renderTime, _coopSample)){
      p.g.position.set(_coopSample.x, _coopSample.y, _coopSample.z);
      p.g.rotation.y = _coopSample.yaw;   // yaw already interpolated along shortest arc
    }
  }
  // ---- remote monsters: sample buffered position; face the interpolated travel dir ----
  for(const m of coopRemoteById.values()){
    if(!(m.alive && m.dying<=0 && m.coopBuf)) continue;
    if(m.gen) motionRig(m);
    const px = m.g.position.x, pz = m.g.position.z;
    if(coopSampleBuf(m.coopBuf, renderTime, _coopSample)){
      m.g.position.set(_coopSample.x, _coopSample.y, _coopSample.z);
      // face the direction we actually moved this frame (server owns motion; cosmetic)
      const dx = m.g.position.x - px, dz = m.g.position.z - pz;
      if(dx*dx+dz*dz > 1e-6){
        const target = Math.atan2(dx, dz);
        let dyaw = target - m.coopYaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
        m.coopYaw += dyaw*Math.min(1, dt*10);   // smooth the heading so it doesn't snap
        m.g.rotation.y = m.coopYaw;
      }
    }
    // gentle walk cycle so remote trolls aren't frozen statues
    if(m.gen){ animateMonster(m,dt); continue; }
    m.walkPhase += dt*Math.max(2, m.speed*2);
    const sw = Math.sin(m.walkPhase)*0.5;
    if(m.legs){ m.legs.L.rotation.x = sw; m.legs.R.rotation.x = -sw; }
  }
}

/* HUD from server authority (score + wave) */
function coopApplyHud(s){
  if(typeof s.score==='number'){ score = s.score; scoreN.textContent = score; }
  if(typeof s.wave==='number' && s.wave!==coopWaveNum){ coopWaveNum = s.wave; wave = s.wave; setWaveHud(s.wave); }
}

/* peer arrow tracer (reuse a tiny pool, brief lifetime) */
function coopShowPeerArrow(a){
  if(!a || !a.from || !a.dir) return;
  let tr = coopPeerArrows.find(x=>!x.active);
  if(!tr){ const g = mesh(new THREE.CylinderGeometry(0.012,0.012,0.7,5), tuskMat, 0,0,0); g.rotation.x=Math.PI/2; const wrap=new THREE.Group(); wrap.add(g); scene.add(wrap); tr={wrap, active:false, life:0}; coopPeerArrows.push(tr); }
  tr.wrap.position.set(a.from.x, a.from.y, a.from.z);
  tr.wrap.lookAt(a.from.x+a.dir.x, a.from.y+a.dir.y, a.from.z+a.dir.z);
  tr.wrap.visible=true; tr.active=true; tr.life=0; tr.el=a.el;
  tr.vx=a.dir.x; tr.vy=a.dir.y; tr.vz=a.dir.z; tr.sp=(22+ (a.power||0)*30);
  sparks.burst(a.from.x,a.from.y,a.from.z,4, (a.el&&a.el!=='base'&&EL[a.el])?EL[a.el].glow:0xffd27a, 4, 0.25);
  const _pr = (a.id!=null) ? coopPeers.get(a.id) : null; if(_pr) _pr.drawT = 0.42;   // HÚZÁS: a lövő társon indul a húz->elenged animáció
}
function coopUpdatePeerArrows(dt){
  for(const tr of coopPeerArrows){ if(!tr.active) continue;
    tr.life+=dt; const s=tr.sp*dt;
    tr.wrap.position.x+=tr.vx*s; tr.wrap.position.y+=tr.vy*s; tr.wrap.position.z+=tr.vz*s;
    if(tr.el && tr.el!=='base' && EL[tr.el]){ const p=tr.wrap.position; RP.spawn(p.x,p.y,p.z, rand(-0.3,0.3),rand(-0.3,0.3),rand(-0.3,0.3), EL[tr.el].trail, 0.3,0.02,0.25, 0,1.5); }   // ELEM: társ-nyíl elemi nyoma
    if(tr.life>0.9){ tr.active=false; tr.wrap.visible=false; }
  }
}

/* called once per frame from the loop (see hookEdit) */
function coopTick(dt){
  if(!coop) return;
  coopInterp(dt);
  coopUpdatePeerArrows(dt);
  // throttled inside net-client (~20Hz)
  coop.sendInput({ pos:{x:player.pos.x,y:player.pos.y,z:player.pos.z}, yaw:player.yaw, pitch:player.pitch }); // FIX: hp/alive-t a szerver vezeti (közelharc) -> nincs tug-of-war
}

/* --- hook helpers called from the gated edits in fireArrow / collision --- */
function coopOnShot(start, fwd, charge){ if(coop) coop.sendShot({ from:{x:start.x,y:start.y,z:start.z}, dir:{x:fwd.x,y:fwd.y,z:fwd.z}, power:charge, el:currentElement, charge:charge }); }   // ELEM: az elemet+töltést is átküldjük
function coopOnLocalHit(hit, head, dmg, el, charge, mul){ if(coop && hit && hit.coopRemote && hit.netId!=null) coop.sendHit({ monsterId:hit.netId, headshot:head, dmg:dmg, el:el, charge:charge, mul:mul }); }   // mul: elemi-hatás szorzó (nyíl=1, ütés=0.25)
/* true when the LOCAL spawner / local kill / local AI must be suppressed for this monster */
function coopShouldSuppressLocalSpawner(){ return !!coop; }
function coopIsRemote(m){ return !!(coop && m && m.coopRemote); }

/* --- reset hook: a resetGame() hívja új játék / újrakezdés előtt (szellem-bug + revive) --- */
function coopOnReset(){
  if(!coop) return;
  coopRemoteById.clear();              // a meshek már törölve a resetGame ciklusban; csak a könyvelés ürül
  coopDowned = false;
  coopReviveAt = coopNow();            // FIX: türelmi idő egy elavult hp=0 state ellen
  // a szerver-autoritatív liveness miatt külön 'respawn' üzenettel élesztünk újra
  coop.send({ t:'respawn' });
}

/* ---- in-game co-op HUD: room code, copy-invite, players list, status dot ---- */
function coopBuildHud(){
  if(coopHudEl) return;                          // built once
  const css = document.createElement('style');
  css.textContent =
    '#coopHud{position:fixed;top:14px;left:14px;z-index:50;min-width:184px;padding:10px 12px;border-radius:12px;'+
    'background:rgba(10,16,30,.74);border:1px solid rgba(180,200,240,.22);box-shadow:0 8px 26px rgba(0,0,0,.45);'+
    'font:600 12px/1.4 -apple-system,"Segoe UI",sans-serif;color:#e9f1ff;backdrop-filter:blur(6px);pointer-events:auto;}'+
    '#coopHud .ch{display:flex;align-items:center;gap:7px;margin-bottom:7px;}'+
    '#coopHud .dot{width:9px;height:9px;border-radius:50%;background:#ffce5a;box-shadow:0 0 8px rgba(255,206,90,.8);flex:none;}'+
    '#coopHud .dot.on{background:#4be08a;box-shadow:0 0 8px rgba(75,224,138,.9);}'+
    '#coopHud .code{font:900 16px/1 inherit;letter-spacing:.18em;color:#7fe2ff;}'+
    '#coopHud .lbl{color:#8fa6c9;text-transform:uppercase;letter-spacing:.12em;font-size:10px;}'+
    '#coopHud button{margin:2px 0 8px;width:100%;padding:7px 8px;border:none;border-radius:8px;cursor:pointer;'+
    'font:800 11px/1 inherit;color:#061018;background:linear-gradient(90deg,#5fe0ff,#36c5ff);}'+
    '#coopHud button:active{transform:scale(.97);}'+
    '#coopHud ul{list-style:none;margin:0;padding:0;}'+
    '#coopHud li{display:flex;align-items:center;gap:6px;padding:2px 0;color:#c3d4f0;}'+
    '#coopHud li .pd{width:6px;height:6px;border-radius:50%;background:#5fe0ff;flex:none;}'+
    '#coopHud li.me .pd{background:#ffd27a;} #coopHud li.me{color:#ffe9c0;}';
  document.head.appendChild(css);
  const el = document.createElement('div'); el.id='coopHud';
  el.innerHTML =
    '<div class="ch"><span class="dot" id="coopDot"></span><span class="code" id="coopCode">----</span></div>'+
    '<button id="coopCopy">'+tr('coop.copy')+'</button>'+
    '<div class="lbl">'+tr('coop.players')+'</div><ul id="coopPlayers"></ul>';
  document.body.appendChild(el);
  coopHudEl = el;
  coopHudDotEl = el.querySelector('#coopDot');
  coopHudRoomEl = el.querySelector('#coopCode');
  coopHudCopyEl = el.querySelector('#coopCopy');
  coopHudPlayersEl = el.querySelector('#coopPlayers');
  coopHudCopyEl.addEventListener('click', coopCopyInvite);
}
function coopInviteUrl(){
  const code = (coop && coop.room) || _coopRoom || '';
  const u = new URL('./mohas-roham.html', location.href);
  if(coopHost) u.hostname=coopHost; // localhost -> LAN IP (a port marad)
  if(code) u.searchParams.set('room', code);
  u.searchParams.set('lang', lang);
  return u.toString();
}
function coopCopyInvite(){
  const url = coopInviteUrl();
  const done = ()=>{ if(coopHudCopyEl){ const t=coopHudCopyEl.textContent; coopHudCopyEl.textContent=tr('coop.copied'); setTimeout(()=>{ if(coopHudCopyEl) coopHudCopyEl.textContent=t; },1200); } };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(url).then(done).catch(()=>coopCopyFallback(url, done));
  } else coopCopyFallback(url, done);
}
function coopCopyFallback(url, done){
  try{ const ta=document.createElement('textarea'); ta.value=url; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); done(); }
  catch{ toast('Invite: '+url); }
}
function coopSetStatus(connected){
  coopConnected = !!connected;
  if(coopHudDotEl){ coopHudDotEl.classList.toggle('on', coopConnected); coopHudDotEl.title = coopConnected ? tr('coop.connected') : tr('coop.reconnecting'); }
}
function coopUpdateHudRoom(){
  if(coopHudRoomEl) coopHudRoomEl.textContent = ((coop && coop.room) || _coopRoom || '----');
}
function coopUpdateHudPlayers(){
  if(!coopHudPlayersEl) return;
  const frag = document.createDocumentFragment();
  const me = document.createElement('li'); me.className='me';
  me.innerHTML = '<span class="pd"></span>'; me.appendChild(document.createTextNode(tr('coop.you')));
  frag.appendChild(me);
  for(const p of coopPeers.values()){
    const li = document.createElement('li');
    li.innerHTML = '<span class="pd"></span>'; li.appendChild(document.createTextNode(p.name||'Archer'));
    frag.appendChild(li);
  }
  coopHudPlayersEl.replaceChildren(frag);
}
/* ---- reconnect resync: rebuild peer/monster bookkeeping from a fresh welcome ----
   Clears any avatar/monster the new snapshot doesn't mention so reconnects can't
   leave stale duplicates, then recreates from the welcome's player list. */
function coopResync(info){
  const livePeerIds = new Set();
  if(Array.isArray(info.players)) for(const p of info.players){ if(p.id!==coopMyId) livePeerIds.add(p.id); }
  // drop peers no longer present (and any avatar that would otherwise duplicate)
  for(const id of [...coopPeers.keys()]){ if(!livePeerIds.has(id)) coopRemovePeer(id); }
  // drop all remote monsters; the next state frame re-creates the current ones
  for(const [netId, m] of coopRemoteById){
    const idx = monsters.indexOf(m);
    if(idx>=0){ scene.remove(m.g); disposeMonster(m); monsters.splice(idx,1); }
  }
  coopRemoteById.clear();
  // (re)create avatars for everyone still here (coopMakePeer is idempotent)
  if(Array.isArray(info.players)) for(const p of info.players){ if(p.id!==coopMyId) coopMakePeer(p.id, p.name); }
  coopUpdateHudRoom();
  coopUpdateHudPlayers();
}

/* --- connect (only if ?room present) --- */
function coopConnect(){
  if(!_coopRoom || coop) return;
  const connectCoop = window.__coopConnect;
  if(!connectCoop){ console.warn('[coop] connectCoop unavailable; staying single-player'); return; }
  startScreen.classList.add('hide');   // FEJLESZTÉS: co-opban a várószoba veszi át a #start helyét (a welcome-ig se villanjon a sima Start)
  coop = connectCoop({
    room: _coopRoom==='NEW' ? undefined : _coopRoom,
    name: 'Archer',
    onWelcome: (info)=>{ const reconnected = coopWelcomed; coopWelcomed=true; coopMyId=info.id; coopHost=info.host||coopHost; coopResync(info); if(typeof info.wave==='number') coopWaveNum=info.wave; coopSetStatus(true); toast((reconnected?tr('coop.reconnect'):'CO-OP: ')+info.room);
      if(Array.isArray(info.players)) coopWaitRoster=info.players.map(p=>({id:p.id,name:p.name,playing:!!p.playing}));
      if(!coopStarted && !running){ if(info.phase==='playing'){ coopHideWait(); beginPlay(); } else { coopShowWait(); } }   // FÁZIS-KAPU: 'lobby'->várószoba; 'playing'->late-join EGYBŐL beginPlay (különben üres aréna/láthatatlan troll)
    }, // v2: pid -> stabil id, ezért coopWelcomed-del detektálunk
    onState: (s)=>{
      coopApplyHud(s);
      if(Array.isArray(s.players)) for(const pv of s.players){
        if(pv.id===coopMyId){ // FIX: a saját HP-t a szerver vezeti (közelharc-sebzés) -> HUD + elesés
          if(typeof pv.hp==='number' && coopNow()-coopReviveAt>1500){ const before=player.hp; setHp(pv.hp);
            if(pv.hp<before) playerHurtFX(before-pv.hp); // co-op: a szerver-vezérelt sérülés is látványos
            if(pv.hp<=0 && !coopDowned){ coopDowned=true; player.alive=false; gameOver(); } }
          if(typeof pv.witherT==='number') player.witherT=pv.witherT;   // SÁMÁN-HEX: a szerver vezeti a gyengítést co-opban (a sebzés/újratöltés-szorzó így hiteles)
          continue; }
        const peer = coopMakePeer(pv.id, pv.name);
        if(pv.pos){
          const yaw = (typeof pv.yaw==='number') ? pv.yaw + Math.PI : (peer.buf.length?peer.buf[peer.buf.length-1].yaw:0); // server yaw -> face roughly correct
          coopPushSnap(peer.buf, pv.pos.x, (pv.pos.y!=null?pv.pos.y:1.7)-1.7, pv.pos.z, yaw);   // FIX: az avatar origója a LÁBÁNÁL van -> a kamera-magasságot (1.7) kell levonni, hogy a földön álljon (nem lebeg)
          peer.has=true;
        }
      }
      coopReconcileMonsters(s.monsters);
      if(coopHudEl) coopUpdateHudPlayers();
    },
    onPeerJoined: (p)=>{ if(p && p.id!==coopMyId){ coopMakePeer(p.id, p.name); coopUpdateHudPlayers(); } },
    onPeerLeft:   (id)=>{ coopRemovePeer(id); coopUpdateHudPlayers(); },
    onArrow:      (a)=>{ coopShowPeerArrow(a); },
    onHit:        (h)=>{ if(typeof h.score==='number'){ score=h.score; scoreN.textContent=score; }
                         if(h.id!==coopMyId && !h.absorbed && h.el && h.el!=='base' && h.reactPos) elementalImpact({x:h.reactPos.x,y:GROUND_Y+1.2,z:h.reactPos.z}, h.el, h.headshot);   // társ találatának elemi becsapódása (absorbnál KIHAGYVA -> az 'absorb' elFx hozza a tellt)
                         if(h.killed && h.monsterId!=null){ const rm=coopRemoteById.get(h.monsterId); if(rm && h.el && h.el!=='base') rm.statusEl=h.el; coopKillRemote(h.monsterId, h.headshot); } },
    onMonsterFx:  (fx)=>{ coopHandleFx(fx); },   // ELEM: szerver reakció/lánc/zóna/elemi-halál FX
    onSpawnWave:  (w)=>{ if(typeof w.wave==='number'){ coopWaveNum=w.wave; wave=w.wave; setWaveHud(w.wave); AUD.wave(); toast(tr('toast.wave',{n:w.wave})); } },
    onPlayerDown: (id)=>{ if(id===coopMyId && !coopDowned){ coopDowned=true; player.alive=false; gameOver(); } }, // FIX: szerver-vezérelt elesés
    onRoomState: (rs)=>{ if(Array.isArray(rs.players)) coopWaitRoster=rs.players.map(p=>({id:p.id,name:p.name,playing:!!p.playing}));
      if(coopInWaitRoom) coopRenderWait();
      if(rs.phase==='lobby' && !running){ coopStarted=false; coopDowned=false; coopShowWait(); } },   // futam vége (mind meghalt) -> vissza a várószobába, újra-STARTolható
    onRoomStart: ()=>{ coopHideWait(); beginPlay(); },   // SZINKRON 'go': minden várakozó egyszerre kezd (beginPlay guard-olt -> egyszer fut)
    onOpen:       ()=>{ /* socket up; "connected" is confirmed on welcome (re-join in flight) */ },
    onClose:      ()=>{ coopSetStatus(false); /* net-client auto-reconnects; welcome re-greens the dot */ },
  });
  // Build the in-game co-op HUD once (room code + copy-invite + players + status dot).
  coopBuildHud(); coopUpdateHudRoom(); coopUpdateHudPlayers(); coopSetStatus(false);
  // In co-op the server owns spawns/waves; clear any local spawn intent so nothing local fires.
  toSpawn = 0; spawnAngles = [];
}
// connect now if the module already resolved, else once it signals ready (module scripts defer)
if(window.__coopConnect !== undefined) coopConnect();
window.addEventListener('coop-net-ready', coopConnect, { once:true });
/* ===================== /CO-OP ===================== */

