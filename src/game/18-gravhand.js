/* ===================== GRAVITÁCIÓS KÉZ (a közelharc helyett, csak egyjátékos) =====================
   Jobb gomb / F: a BAL KÉZ megjelenik a kép bal alján, és háromütéses kombót varázsol
   (a következő ütés GRAV_WIN mp-en belül jön, különben újra az 1. ütés):
   1. FELEMELÉS — az előtted lévő kúpban a trollok a levegőbe emelkednek, tehetetlenül forognak,
      és a gravitációs mező közepe felé sodródnak (egy csoportba gyűlnek: reakcióhoz, kataklizmához jó)
   2. DÖNGÖLÉS — a lebegőket a földbe vágja (sebzés + bénulás; a befagyottat szétzúzza);
      ha senki sem lebeg, kisebb földrengés előtted
   3. ELLÖKÉS — messzire repíti őket; ami fába/kőbe/jégfalba csapódik, nagyot sebződik,
      amelyik egy másik trollnak repül, azt is meglöki (tűz-/méregzónába lökve megkapja az elemet)
   A kéz Blenderben modellezett, riggelt GLB (tools/vfx/left_hand.*). Ugyanaz a modell ×7 méretben, áttetsző
   VARÁZSKÉZKÉNT a célpontnál is megjelenik, és ugyanazt a mozdulatot végzi. Co-op alatt a régi közelharc marad. */
I18N.hu.tac.grav={lift:'FELEMELÉS',slam:'DÖNGÖLÉS!',push:'ELLÖKÉS!'};
I18N.en.tac.grav={lift:'LIFT',slam:'SLAM!',push:'PUSH!'};
const GRAV_WIN=1.6, GRAV_COL=0xa98cff;
const GHAND={stage:0, lastT:-99, clock:0, lifted:new Set(), knocked:new Set()};   // clock: játékidő (lassításban / szünetben a kombó-ablak is áll)
// a kombó következő ütése (1..3) a legutóbbi ütés ideje alapján
function gravNextStage(now){ return (GHAND.stage>0 && GHAND.stage<3 && now-GHAND.lastT<GRAV_WIN) ? GHAND.stage+1 : 1; }
function gravDmg(){ return MELEE_DMG*(1+wave*0.08)*RUNM.dmgMul; }
/* --- a kéz: nézet-kéz (kamerán) + óriás varázskéz (a világban); a GLB két külön példányban töltődik be --- */
const GRAVHAND=(function(){
  const url=window.GAME_ASSETS && window.GAME_ASSETS.leftHand;
  const VIEW_REST=new THREE.Vector3(-0.27,-0.25,-0.44), VIEW_HIDE=new THREE.Vector3(-0.36,-0.62,-0.38);
  const view={root:new THREE.Group(), mixer:null, actions:{}, cur:null, k:0, show:0};
  const ghost={root:new THREE.Group(), mixer:null, actions:{}, cur:null, a:0, life:0, max:0, mats:[], from:new THREE.Vector3(), to:new THREE.Vector3()};
  view.root.visible=false; ghost.root.visible=false;
  camera.add(view.root); scene.add(ghost.root);
  const skinMat=new THREE.MeshStandardMaterial({vertexColors:true, color:0xffffff, roughness:0.72, metalness:0, skinning:true});
  const runeMat=new THREE.MeshBasicMaterial({color:GRAV_COL, skinning:true});
  const ghostMat=new THREE.MeshBasicMaterial({color:0x6f52f0, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false, skinning:true});
  const ghostRune=new THREE.MeshBasicMaterial({color:0xe6dcff, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false, skinning:true});
  function setup(gltf, isGhost){
    const sc=gltf.scene, H=isGhost?ghost:view;
    sc.traverse(o=>{ if(!o.isMesh) return; o.frustumCulled=false; o.castShadow=false;
      const rune=/rune/i.test(o.name), c=o.geometry && o.geometry.getAttribute('color');
      if(c && c.itemSize===4){ const div=c.normalized?(c.array instanceof Uint16Array?65535:(c.array instanceof Uint8Array?255:1)):1, a=new Float32Array(c.count*3);   // RGBA -> RGB: a többi vertex-színes anyaggal azonos shader-változat
        for(let i=0;i<c.count;i++){ a[i*3]=c.getX(i)/div; a[i*3+1]=c.getY(i)/div; a[i*3+2]=c.getZ(i)/div; } o.geometry.setAttribute('color',new THREE.BufferAttribute(a,3)); }
      o.material=isGhost?(rune?ghostRune:ghostMat):(rune?runeMat:skinMat);
      if(rune || isGhost) enableBloom(o);
      o.renderOrder=isGhost?6:8; });
    H.root.add(sc); H.mixer=new THREE.AnimationMixer(sc);
    for(const clip of gltf.animations){ const a=H.mixer.clipAction(clip); if(clip.name!=='Idle'){ a.setLoop(THREE.LoopOnce,1); a.clampWhenFinished=true; } H.actions[clip.name]=a; }
    if(H.actions.Idle){ H.actions.Idle.play(); H.cur=H.actions.Idle; }
  }
  const ready=(!url || !THREE.GLTFLoader) ? Promise.resolve() : Promise.all([0,1].map(i=>new Promise(res=>{
    new THREE.GLTFLoader().load(url, gltf=>{ try{ setup(gltf, i===1); }catch(_e){} res(); }, undefined, ()=>res()); })));
  view.root.position.copy(VIEW_HIDE); view.root.rotation.set(0.32,-0.32,0.12);   // ujjak előre, kicsit felfelé és a kép közepe felé
  function play(H, name){ const a=H.actions[name]; if(!a) return; if(H.cur && H.cur!==a) H.cur.fadeOut(0.06); a.reset().fadeIn(0.05).play(); H.cur=a; }
  // nézet-kéz: becsúszik a kép bal aljára, elvégzi a mozdulatot, kicsit kitart, majd visszacsúszik
  function gesture(name){ view.show=0.95; play(view,name); }
  // varázskéz: a célpontnál from -> to úton, áttetszőn, a játékos irányába fordulva
  function spectral(name, from, to, yaw, dur, scale){
    ghost.from.copy(from); ghost.to.copy(to); ghost.life=0; ghost.max=dur; ghost.root.rotation.set(0,yaw,0); ghost.root.scale.setScalar(scale||7);
    ghost.root.position.copy(from); ghost.root.visible=true; play(ghost,name);
  }
  function update(dt){
    if(view.mixer) view.mixer.update(dt);
    view.show=Math.max(0,view.show-dt); const want=view.show>0?1:0;
    view.k+= (want-view.k)*(1-Math.exp(-dt*(want?22:9)));
    view.root.visible=view.k>0.01; view.root.position.lerpVectors(VIEW_HIDE,VIEW_REST,view.k);
    if(ghost.root.visible){ ghost.life+=dt; const u=Math.min(1,ghost.life/ghost.max);
      if(ghost.mixer) ghost.mixer.update(dt);
      ghost.root.position.lerpVectors(ghost.from,ghost.to,1-Math.pow(1-Math.min(1,u*1.6),3));
      const env=Math.min(1,ghost.life/0.12)*Math.min(1,(ghost.max-ghost.life)/0.35);
      ghostMat.opacity=0.24*env; ghostRune.opacity=0.75*env;
      if(u>=1){ ghost.root.visible=false; } }
  }
  function reset(){ view.show=0; view.k=0; view.root.visible=false; ghost.root.visible=false; }
  function warm(){ view.root.visible=true; ghost.root.visible=true; ghostMat.opacity=0.4; ghostRune.opacity=0.8; ghost.root.position.set(120,GROUND_Y+1,124); }
  return { ready, gesture, spectral, update, reset, warm };
})();
const _gvF=new THREE.Vector3(), _gvA=new THREE.Vector3(), _gvB=new THREE.Vector3();
function gravCone(range, cosMin, max){   // trollok a nézési kúpban, közelebbiek előre
  const fx=-Math.sin(player.yaw), fz=-Math.cos(player.yaw), out=[];
  for(const m of monsters){ if(!m.alive || m.dying>0 || coopIsRemote(m)) continue;
    const dx=m.g.position.x-player.pos.x, dz=m.g.position.z-player.pos.z, d=Math.hypot(dx,dz);
    if(d>range+(m.bodyR||0.5) || d<0.01) continue; if((dx*fx+dz*fz)/d<cosMin) continue;
    if(sightBlocked(player.pos.x,GROUND_Y+0.9,player.pos.z,m.g.position.x,GROUND_Y+0.9,m.g.position.z)) continue;
    out.push([d,m]); }
  out.sort((a,b)=>a[0]-b[0]); return {list:out.slice(0,max).map(e=>e[1]), fx, fz};
}
function gravHit(m, dmg, head){
  dmg*=(m.frozenSolid>0?1.5:1)*(m.elite?RUNM.eliteMul:1)*bossDamageMultiplier(m);
  m.hp-=dmg; m.hurtFlash=0.22;
  if(currentElement!=='base' && m.el!==currentElement) applyStatus(m, currentElement, 0);   // a kiválasztott elem negyed erővel ráragad (zónába / reakcióhoz)
  if(m.hp<=0 && m.alive){ killMonster(m, !!head); return true; }
  return false;
}
// 1. FELEMELÉS
function gravLift(){
  const {list, fx, fz}=gravCone(7.5,0.72,6), cx=player.pos.x+fx*4.5, cz=player.pos.z+fz*4.5, dmg=gravDmg()*0.4;
  GRAVHAND.spectral('Lift', _gvA.set(cx-fx*0.8,GROUND_Y-1.6,cz-fz*0.8), _gvB.set(cx-fx*0.8,GROUND_Y-0.2,cz-fz*0.8), player.yaw, 1.15, 9);   // a karom a csoport alatt emelkedik
  EFX.ring(cx,GROUND_Y+0.05,cz,GRAV_COL,0.5,4.2,0.6,0.85); VFX.ring(cx,GROUND_Y+0.06,cz,0xd8ccff,4.2,0.5,0.7,0.6);
  VFX.debris(cx,GROUND_Y+0.1,cz,16,[0x6e665c,0x8a8f99,0x5a4a3a],3,{up:0.9,lift:5,life:1.1,grav:-1.5,w:0.07});
  for(let i=0;i<24;i++){ const a=rand(0,6.283), r=rand(0.5,4); RP.spawn(cx+Math.cos(a)*r,GROUND_Y+0.1,cz+Math.sin(a)*r,0,rand(1.5,3.5),0,pick([GRAV_COL,0xd8ccff,0x7f6aff]),rand(0.18,0.32),0.04,rand(0.7,1.2),-0.5,1,0.9); }
  if(EFX.light) EFX.light(cx,GROUND_Y+1.5,cz,GRAV_COL,5,0.5);
  for(const m of list){
    if(gravHit(m,dmg)) continue;
    if(m.boss){ m.rooted=Math.max(m.rooted||0,0.4); continue; }   // a király túl nehéz: csak megtántorodik
    const el=!!m.elite; m.grav={t:0, dur:el?0.9:1.45, h:(el?1.3:2.2)*(0.85+0.3*Math.random()), spin:rand(-3,3), cx, cz, y0:m.g.position.y};
    m.rooted=Math.max(m.rooted||0,m.grav.dur+0.1); GHAND.lifted.add(m); }
  callout(tr('tac.grav.lift'),true); shake=Math.max(shake,0.18); if(AUD.whoosh) AUD.whoosh();
}
// 2. DÖNGÖLÉS
function gravSlam(){
  const lifted=[...GHAND.lifted].filter(m=>m.alive && m.grav), dmg=gravDmg()*2.0;
  let cx, cz;
  if(lifted.length){ cx=0; cz=0; for(const m of lifted){ cx+=m.g.position.x; cz+=m.g.position.z; } cx/=lifted.length; cz/=lifted.length; }
  else { const fx=-Math.sin(player.yaw), fz=-Math.cos(player.yaw); cx=player.pos.x+fx*4.5; cz=player.pos.z+fz*4.5; }
  { const fx=-Math.sin(player.yaw), fz=-Math.cos(player.yaw); GRAVHAND.spectral('Slam', _gvA.set(cx-fx*0.8,GROUND_Y+5.2,cz-fz*0.8), _gvB.set(cx-fx*0.8,GROUND_Y+2.0,cz-fz*0.8), player.yaw, 0.9, 9); }   // felülről lecsapó tenyér
  const hitSet=new Set(); GHAND.slamHitSet=hitSet;
  const quake=(x,z,r,mul)=>{ DUSTPOOF.spawn(x,GROUND_Y,z,r*1.3); VFX.decal(x,GROUND_Y,z,r*0.45,1,0x1a1410,0.85,8,GRAV_COL,1.2);
    EFX.ring(x,GROUND_Y+0.05,z,0xd8ccff,0.4,r,0.45,0.9); VFX.debris(x,GROUND_Y+0.2,z,12,[0x6e665c,0x8a8f99,0x5a4a3a],6,{up:0.4,lift:3,life:0.8,grav:12,w:0.08});
    for(const m of nearestTrolls(x,z,null,r,8)){ if(hitSet.has(m) || !m.alive) continue; hitSet.add(m); if(m.grav) continue;
      m.rooted=Math.max(m.rooted||0,0.6); gravHit(m,dmg*mul); } };
  for(const m of lifted){ m.grav.slam=0.12; m.grav.dmg=dmg*(1+0.15*m.grav.h); }   // a magasból lecsapódás nagyobbat üt (a becsapódást az update intézi)
  if(!lifted.length) quake(cx,cz,3.5,0.7);
  GHAND.slamQuake=quake;
  callout(tr('tac.grav.slam'),true); shake=Math.max(shake,0.35); if(AUD.whoosh) AUD.whoosh();
}
// 3. ELLÖKÉS
function gravPush(){
  const {list, fx, fz}=gravCone(8,0.55,8), dmg=gravDmg()*1.2;
  GRAVHAND.spectral('Push', _gvA.set(player.pos.x+fx*2.6,GROUND_Y+0.8,player.pos.z+fz*2.6), _gvB.set(player.pos.x+fx*4.4,GROUND_Y+0.8,player.pos.z+fz*4.4), player.yaw, 0.8, 8);   // előre toló nyitott tenyér
  for(let i=0;i<22;i++){ const a=rand(-0.6,0.6), ca=Math.cos(a), sa=Math.sin(a), dx=fx*ca-fz*sa, dz=fz*ca+fx*sa, sp=rand(14,24);   // lökéshullám-csíkok előre
    VFX.streak(player.pos.x+dx*1.2,GROUND_Y+rand(0.3,2),player.pos.z+dz*1.2, dx*sp,rand(-0.5,0.5),dz*sp, i%2?0xd8ccff:GRAV_COL, rand(0.25,0.4),0,1.5,0.03,0.12); }
  EFX.ring(player.pos.x+fx*2,GROUND_Y+0.05,player.pos.z+fz*2,GRAV_COL,0.5,5,0.4,0.8);
  for(const m of list){
    const dx=m.g.position.x-player.pos.x, dz=m.g.position.z-player.pos.z, d=Math.hypot(dx,dz)||1;
    if(gravHit(m,dmg)) continue;
    const mass=m.boss?6:(m.elite?2.2:Math.max(0.7,(m.scale||1)));
    m.knock={vx:dx/d*24/Math.sqrt(mass), vz:dz/d*24/Math.sqrt(mass), t:0, dur:0.55, hit:new Set(), y0:m.g.position.y};
    m.rooted=Math.max(m.rooted||0,0.7); GHAND.knocked.add(m); }
  callout(tr('tac.grav.push'),true); shake=Math.max(shake,0.3); if(AUD.whoosh) AUD.whoosh();
}
// a jobb gomb / F: SP-ben a gravitációs kombó, co-op-ban a régi közelharc
function gravStrike(){
  const now=GHAND.clock, st=gravNextStage(now);
  GHAND.stage=st; GHAND.lastT=now; meleeCd=MELEE_CD;
  GRAVHAND.gesture(st===1?'Lift':(st===2?'Slam':'Push'));
  if(st===1) gravLift(); else if(st===2) gravSlam(); else gravPush();
}
const _gvP=new THREE.Vector3();
function updateGravHand(dt){
  GHAND.clock+=dt; GRAVHAND.update(dt);
  for(const m of GHAND.lifted){ const g=m.grav; if(!m.alive || !g){ GHAND.lifted.delete(m); if(m.alive){ m.g.rotation.x=0; m.g.rotation.z=0; } continue; }
    const p=m.g.position;
    if(g.slam!=null){ g.slam-=dt; const k=Math.max(0,g.slam/0.12); p.y=GROUND_Y+g.h*k*k;
      if(g.slam<=0){ p.y=GROUND_Y; m.grav=null; GHAND.lifted.delete(m); m.g.rotation.x=0; m.g.rotation.z=0;
        const shatter=m.frozenSolid>0; if(shatter){ shatterShell(m); }
        m.rooted=Math.max(m.rooted||0,1.2);
        if(GHAND.slamHitSet) GHAND.slamHitSet.add(m);   // a lecsapódó troll a saját földrengését nem kapja meg még egyszer
        if(GHAND.slamQuake) GHAND.slamQuake(p.x,p.z,2.6,0.5);
        gravHit(m,g.dmg*(shatter?2:1)); shake=Math.max(shake,0.5); }
      continue; }
    g.t+=dt; const u=g.t/g.dur;
    if(u>=1){ p.y=GROUND_Y; m.grav=null; GHAND.lifted.delete(m); m.g.rotation.x=0; m.g.rotation.z=0; DUSTPOOF.spawn(p.x,GROUND_Y,p.z,2.2); continue; }   // lejárt: visszahuppan
    const rise=Math.min(1,u*4), fall=u>0.85?(u-0.85)/0.15:0;
    p.y=GROUND_Y+g.h*(1-Math.pow(1-rise,3))*(1-fall*fall)+Math.sin(g.t*5)*0.08;
    const pull=dt*1.6; p.x+=(g.cx-p.x)*Math.min(1,pull*0.5); p.z+=(g.cz-p.z)*Math.min(1,pull*0.5);   // a mező közepe felé sodródnak
    m.g.rotation.y+=g.spin*dt; m.g.rotation.x=Math.sin(g.t*2.3)*0.35; m.g.rotation.z=Math.cos(g.t*1.9)*0.3;
    if(Math.random()<dt*14) RP.spawn(p.x+rand(-0.5,0.5),p.y+rand(0,1.5),p.z+rand(-0.5,0.5),0,rand(0.3,0.9),0,pick([GRAV_COL,0xd8ccff]),rand(0.16,0.26),0.03,0.6,-0.3,1,0.85);
  }
  for(const m of GHAND.knocked){ const k=m.knock; if(!m.alive || !k){ GHAND.knocked.delete(m); continue; }
    k.t+=dt; const u=k.t/k.dur, p=m.g.position, sp=Math.max(0,1-u);
    const ox=p.x, oz=p.z, nx=p.x+k.vx*sp*dt, nz=p.z+k.vz*sp*dt, r=(m.bodyR||0.5)*0.9;
    const res=pushMob(nx,nz,r); p.x=res.x; p.z=res.z; p.y=GROUND_Y+Math.sin(Math.min(1,u)*Math.PI)*0.7;
    m.g.rotation.x=-0.5*Math.sin(Math.min(1,u)*Math.PI);
    if(Math.random()<0.6) RP.spawn(p.x,p.y+0.6,p.z,0,0.3,0,GRAV_COL,0.22,0.04,0.35,0,1,0.8);
    const blocked=Math.hypot(res.x-nx,res.z-nz)>0.05;
    if(blocked && !k.wall){ k.wall=true;   // fába/kőbe/jégfalba csapódott
      let ice=false; for(const s of SOLIDS){ if(s.iceWall && Math.hypot(s.x-p.x,s.z-p.z)<s.r+r+0.3){ ice=true; break; } }
      DUSTPOOF.spawn(p.x,GROUND_Y,p.z,2.6); VFX.debris(p.x,p.y+1,p.z,10,ice?[0xbfe9ff,0xe8f8ff,0x8fd4ff]:[0x6e665c,0x8a8f99],6,{up:0,lift:2,life:0.7,grav:12,w:0.07});
      if(ice) shatterShell(m);
      if(gravHit(m,gravDmg()*(ice?2.0:1.5))){ GHAND.knocked.delete(m); continue; }
      k.t=Math.max(k.t,k.dur*0.8); m.rooted=Math.max(m.rooted||0,1.0); shake=Math.max(shake,0.3); }
    for(const o of nearestTrolls(p.x,p.z,m,r+0.9,4)){ if(k.hit.has(o) || o.boss) continue; k.hit.add(o);   // tekézés: a repülő troll meglöki, akit eltalál
      gravHit(o,gravDmg()*0.6); const dx=o.g.position.x-p.x, dz=o.g.position.z-p.z, d=Math.hypot(dx,dz)||1;
      if(o.alive && !o.knock){ o.knock={vx:dx/d*9,vz:dz/d*9,t:0,dur:0.35,hit:new Set([m])}; o.rooted=Math.max(o.rooted||0,0.5); GHAND.knocked.add(o); } }
    if(u>=1){ p.y=GROUND_Y; m.g.rotation.x=0; m.knock=null; GHAND.knocked.delete(m); }
  }
}
function resetGravHand(){ GHAND.stage=0; GHAND.lastT=-99;
  for(const m of GHAND.lifted){ m.grav=null; } for(const m of GHAND.knocked){ m.knock=null; } GHAND.lifted.clear(); GHAND.knocked.clear(); GRAVHAND.reset(); }
