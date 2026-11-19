/* ===================== ELEM-TAKTIKA (csak egyjátékos) =====================
   A reakció a fő jutalom: TAC_REACT_MUL-szor erősebb, mint egy sima elemi találat. Ha a következő reakciót
   TAC_CHAIN_WIN mp-en belül MÁS elemmel váltod ki, ELEMI LÁNC épül (×1.25 / ×1.5 / ×2) + pontbónusz.
   Az elitek és a Troll Király ELEMI PÁNCÉLT kapnak (0.3× sebzés), amit csak a jelzett reakció tör át.
   Minden hullám (3.-tól) kap egy opcionális ÓMEN-feladatot. A co-op szerver a saját, régi számaival fut. */
I18N.hu.tac={ chain:'LÁNC ×{n}', armor:'ELEMI PÁNCÉL — törd át: {r} ({p})', armorBroken:'PÁNCÉL ÁTTÖRVE! +{n}',
  omen:'ÓMEN · {n}× {r} · {k}/{n} → +{p}', omenDone:'ÓMEN TELJESÍTVE! +{p}',
  cata:'KATAKLIZMA {n}%', cataReady:'KATAKLIZMA KÉSZ — TELJES HÚZÁS', cataCast:{fire:'TŰZLAVINA!',ice:'GLECCSER!',poison:'DÖGVÉSZ!',lightning:'ÉGSZAKADÁS!'},
  react:{overload:'TÚLTÖLTÉS',steam:'GŐZROBBANÁS',ignite:'MÉRGES GYÚJTÁS',galvanic:'GALVÁN PERMET',frostrot:'FAGYOS ROTHADÁS'},
  pair:{overload:'jég + villám',steam:'tűz + jég',ignite:'tűz + méreg',galvanic:'méreg + villám',frostrot:'jég + méreg'} };
I18N.en.tac={ chain:'CHAIN ×{n}', armor:'ELEMENTAL ARMOR — break it with {r} ({p})', armorBroken:'ARMOR BROKEN! +{n}',
  omen:'OMEN · {n}× {r} · {k}/{n} → +{p}', omenDone:'OMEN FULFILLED! +{p}',
  cata:'CATACLYSM {n}%', cataReady:'CATACLYSM READY — FULL DRAW', cataCast:{fire:'FIRE AVALANCHE!',ice:'GLACIER!',poison:'PLAGUE!',lightning:'SKYFALL!'},
  react:{overload:'OVERLOAD',steam:'STEAM BURST',ignite:'TOXIC IGNITION',galvanic:'GALVANIC SPRAY',frostrot:'FROZEN ROT'},
  pair:{overload:'ice + lightning',steam:'fire + ice',ignite:'fire + poison',galvanic:'poison + lightning',frostrot:'ice + poison'} };

const TAC_REACT_MUL=1.6, TAC_CHAIN_WIN=4.0, TAC_ARMOR_TAKE=0.3, CATA_FILL_S=25, CATA_REACT_ADD=0.125;
const TAC_RIDS=['overload','steam','ignite','galvanic','frostrot'];
const ARMOR_DEFS=[{rid:'overload',els:['ice','lightning']},{rid:'steam',els:['fire','ice']},{rid:'ignite',els:['fire','poison']},{rid:'galvanic',els:['poison','lightning']}];
const CHAIN={n:0,t:-99,lastEl:null,els:[],pop:0};
const CATA={charge:0,run:null,said:false};
const OMEN={rid:null,need:0,have:0,pts:0,done:true,hinted:false};
function tacNow(){ return performance.now()*0.001; }
function chainLive(){ return CHAIN.n>0 && tacNow()-CHAIN.t<TAC_CHAIN_WIN; }
function chainMulOf(n){ return n>=4?2:n===3?1.5:n===2?1.25:1; }
// a hullám SIMA trolljának alap-életereje (a spawn-görbe véletlen nélkül) — a kataklizma ehhez méri magát
function waveBaseHp(n){ return 24+n*8+Math.max(0,n-5)*3+6*Math.max(0,n-20)+0.35*Math.pow(Math.max(0,n-25),2); }
/* Egy reakció elsülésekor hívja az elementMechanic (SP). Visszaadja a reakció sebzés-szorzóját, közben
   lépteti a láncot, tölti a kataklizmát, számolja az ómen-feladatot és — ha ez a páncél kulcsa — áttöri a páncélt. */
function tacticReaction(rid, el, m){
  if(coop) return 1;
  const now=tacNow();
  if(!chainLive()){ CHAIN.n=1; CHAIN.els=[el]; CHAIN.t=now; }
  else if(el!==CHAIN.lastEl){ CHAIN.n=Math.min(4,CHAIN.n+1); CHAIN.els.push(el); if(CHAIN.els.length>4) CHAIN.els.shift(); CHAIN.t=now; }
  CHAIN.lastEl=el;   // ugyanazzal az elemmel ismételve a lánc NEM nő és az ideje sem frissül -> váltogatásra ösztönöz
  if(CHAIN.n>=2){ addScore(Math.round(20*CHAIN.n*RUNM.scoreMul)); CHAIN.pop=1; }
  if(RUN.awakening>=3) cataAdd(CATA_REACT_ADD);
  omenCount(rid);
  if(m && m.armor && m.armor.rid===rid) breakArmor(m);
  return TAC_REACT_MUL*chainMulOf(CHAIN.n);
}
/* --- ELEMI PÁNCÉL: az elit / a király minden sebzésből csak TAC_ARMOR_TAKE részt kap, amíg a jelzett reakció át nem töri.
   A hp egy getter/setter mögé kerül, így MINDEN sebzés-forrás (nyíl, zóna, lánc, vihar) automatikusan gyengül; a gyógyulás változatlan. */
function giveArmor(m){
  if(coop || !m || m.armor) return;
  const d=ARMOR_DEFS[(Math.random()*ARMOR_DEFS.length)|0];
  m.armor={rid:d.rid, els:d.els, ph:Math.random()*6.283, spark:0};
  let hp=m.hp;
  Object.defineProperty(m,'hp',{configurable:true, enumerable:true,
    get(){ return hp; },
    set(v){ const lost=hp-v; if(lost>0 && m.armor){ hp-=lost*TAC_ARMOR_TAKE; m.armor.spark=0.14; } else hp=v; }});
  if(typeof ARMOR_FX!=='undefined') ARMOR_FX.attach(m);
  if(!OMEN.hinted){ OMEN.hinted=true; toast(tr('tac.armor',{r:tr('tac.react.'+d.rid),p:tr('tac.pair.'+d.rid)})); }
}
function breakArmor(m){
  const a=m.armor; if(!a) return; m.armor=null;
  if(typeof ARMOR_FX!=='undefined') ARMOR_FX.detach(m, a);
  m.rooted=Math.max(m.rooted||0,1.4); m.hurtFlash=0.3;
  const pts=Math.round(200*RUNM.scoreMul); addScore(pts); callout(tr('tac.armorBroken',{n:pts}),true);
}
/* --- ÓMEN: hullámonként egy opcionális feladat (N× egy adott reakció) pontjutalommal --- */
function startOmen(n){
  OMEN.done=true; OMEN.rid=null; OMEN.hinted=false;
  if(!coop && n>=3){ OMEN.rid=TAC_RIDS[(Math.random()*TAC_RIDS.length)|0]; OMEN.need=Math.min(5,3+Math.floor(n/8)); OMEN.have=0;
    OMEN.pts=Math.round((150+n*20)*RUNM.scoreMul); OMEN.done=false; }
  renderOmen();
}
function omenCount(rid){
  if(OMEN.done || rid!==OMEN.rid) return;
  OMEN.have++;
  if(OMEN.have>=OMEN.need){ OMEN.done=true; addScore(OMEN.pts); callout(tr('tac.omenDone',{p:OMEN.pts}),true); }
  renderOmen();
}
function renderOmen(){
  const el=typeof document!=='undefined' && document.getElementById('omenHud'); if(!el) return;
  el.hidden=OMEN.rid==null; if(el.hidden) return;
  el.textContent=tr('tac.omen',{n:OMEN.need,r:tr('tac.react.'+OMEN.rid),k:Math.min(OMEN.have,OMEN.need),p:OMEN.pts});
  el.classList.toggle('done',OMEN.done);
}
/* --- KATAKLIZMA-töltés: magától CATA_FILL_S mp alatt telik, minden reakció +CATA_REACT_ADD --- */
function cataAdd(x){
  if(coop || RUN.awakening<3) return;
  const was=CATA.charge>=1; CATA.charge=Math.min(1,CATA.charge+x);
  if(!was && CATA.charge>=1 && !CATA.said){ CATA.said=true; callout(tr('tac.cataReady'),true); }
}
function cataReady(){ return !coop && RUN.awakening>=3 && CATA.charge>=1 && !CATA.run; }
function resetTactics(){
  CHAIN.n=0; CHAIN.t=-99; CHAIN.lastEl=null; CHAIN.els.length=0; CHAIN.pop=0;
  CATA.charge=0; CATA.run=null; CATA.said=false;
  OMEN.rid=null; OMEN.done=true; OMEN.hinted=false; renderOmen();
  if(typeof ICEWALL!=='undefined') ICEWALL.reset();
  if(typeof GHOST!=='undefined') GHOST.reset();
  if(typeof MARKS!=='undefined') MARKS.hide();
}
/* --- JÉGFAL-KÉSZLET --- */
/* ===================== JÉGFAL + GLECCSER-TÜSKÉK =====================
   Egyetlen példányosított (InstancedMesh) tüske-készlet: 2 rajzolási hívás az összes jégfalra és a kataklizma-gleccserre.
   A jégfal tüskéi exponenciálisan nőnek a fal vége felé, kb. 10 mp-ig állnak (közben ütközés-test a trolloknak és a nyílnak),
   a bennük rekedt trollok fagyva maradnak, a végén elolvadnak (pára, csöpögés, tócsa). Tűz éri -> végigfutó GŐZROBBANÁS. */
const ICEWALL=(function(){
  const CAP=256, LIFE=10, MELT=1.8, RISE=0.22, GEO_R=0.2;
  const geo=(function(){
    // fazettás, hatszögű főtüske + három kisebb, kifelé dőlő mellékkristály; sötétkék tövétől fehér csúcsig színátmenet
    const V=(x,y)=>new THREE.Vector2(x,y);
    const spike=(h,r)=>gradTint(new THREE.LatheGeometry([V(r*0.88,0),V(r,h*0.1),V(r*0.62,h*0.5),V(r*0.2,h*0.88),V(0.0001,h)],6),0x0b356c,0xe2f6ff,0,h,1.7);   // mélykék tő, csak a csúcs fehér
    const g=mergeGeos([{geo:spike(1.0,GEO_R)},
      {geo:spike(0.62,0.12), x:0.15, z:0.05, rz:-0.44, rx:0.1},
      {geo:spike(0.48,0.10), x:-0.12, z:-0.11, rz:0.36, rx:-0.38},
      {geo:spike(0.34,0.08), x:0.02, z:0.17, rx:0.55}]);
    g.computeVertexNormals(); return g; })();   // nem indexelt -> lapos fazetták
  const bodyMat=new THREE.MeshStandardMaterial({vertexColors:true, color:0xffffff, emissive:0x1a64b0, emissiveIntensity:0.5,
    roughness:0.06, metalness:0.18, transparent:true, opacity:0.86, flatShading:true});
  const rimMat=new THREE.MeshBasicMaterial({color:0x7fd6ff, transparent:true, opacity:0.3, side:THREE.BackSide, blending:THREE.AdditiveBlending, depthWrite:false});
  // 3 tüske-változat (Blenderben modellezett, tools/vfx/ice_spikes.*), mindegyik egy test- + egy perem-háló (összesen max. 6 rajzolási hívás);
  // a GLB betöltéséig (vagy ha nincs) a fenti, kódban épített tüske áll be mindháromba
  const KINDS=[0,1,2].map(()=>{ const body=new THREE.InstancedMesh(geo,bodyMat,CAP), rim=new THREE.InstancedMesh(geo,rimMat,CAP);
    for(const m of [body,rim]){ m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count=0; m.frustumCulled=false; m.renderOrder=4; scene.add(m); }
    enableBloom(rim); return {body,rim,n:0}; });
  const ready=(function(){ const url=window.GAME_ASSETS && window.GAME_ASSETS.iceSpikes; if(!url || !THREE.GLTFLoader) return Promise.resolve();
    return new Promise(res=>{ new THREE.GLTFLoader().load(url, gltf=>{ try{
        ['IceSpikeA','IceSpikeB','IceSpikeC'].forEach((nm,k)=>{ const o=gltf.scene.getObjectByName(nm); if(!o || !o.geometry) return;
          const g=o.geometry.clone(), c=g.getAttribute('color');
          if(c){ const div=c.normalized?(c.array instanceof Uint16Array?65535:(c.array instanceof Uint8Array?255:1)):1, a=new Float32Array(c.count*3);   // RGBA -> RGB (ugyanaz a shader-változat, mint a kódos tüskéé)
            for(let i=0;i<c.count;i++){ a[i*3]=c.getX(i)/div; a[i*3+1]=c.getY(i)/div; a[i*3+2]=c.getZ(i)/div; } g.setAttribute('color',new THREE.BufferAttribute(a,3)); }
          KINDS[k].body.geometry=g; KINDS[k].rim.geometry=g; });
      }catch(_e){} res(); }, undefined, ()=>res()); }); })();
  const S=[]; for(let i=0;i<CAP;i++) S.push({on:false,i, x:0,z:0,h:1,r:0.3,ry:0,tx:0,tz:0, delay:0,age:0,state:0,k:0, wall:null,solid:null,glacier:false,main:false,final:false,burstT:-1,life:0});
  const walls=[], dummy=new THREE.Object3D(); dummy.rotation.order='XZY';
  function alloc(glacier){
    for(const s of S) if(!s.on) return s;
    let best=null; for(const s of S) if(s.on && s.glacier && (!best || s.age>best.age)) best=s;   // betelt: a legrégebbi gleccser-tüske adja át a helyét
    if(best && !glacier){ free(best); return best; }
    return null;
  }
  function addSolid(s){ s.solid={kind:'cyl', x:s.x, z:s.z, r:s.r*0.92, top:GROUND_Y+s.h*0.9, bottom:0, abot:null, noArrow:false, climb:false, mob:true, iceWall:s.wall, slot:s}; SOLIDS.push(s.solid); }
  function dropSolid(s){ if(!s.solid) return; const k=SOLIDS.indexOf(s.solid); if(k>=0) SOLIDS.splice(k,1); s.solid=null; }
  function free(s){ dropSolid(s); s.on=false; s.wall=null; s.state=0; s.burstT=-1; }
  // fal: tüskék listája {x,z,h,r,delay,tiltX,tiltZ,main,final}; onRise(slot) a sebzést intézi (varázslat-kód)
  function spawnWall(spikes, opt){
    while(walls.filter(w=>!w.ending).length>=3){ const old=walls.find(w=>!w.ending); meltWall(old,0.6); }
    const w={slots:[], t:0, life:LIFE, ending:false, burst:false, frozen:new Set(), onRise:opt&&opt.onRise, fxT:0};
    for(const k of spikes){ const s=alloc(false); if(!s) break;
      Object.assign(s,{on:true,x:k.x,z:k.z,h:k.h,r:k.r,ry:Math.random()*6.283,tx:k.tiltX||0,tz:k.tiltZ||0,delay:k.delay||0,age:0,state:0,k:0,
        wall:w,glacier:false,main:!!k.main,final:!!k.final,burstT:-1,life:LIFE}); w.slots.push(s); }
    walls.push(w); return w;
  }
  function glacier(x,z,h,r,delay,life){ const s=alloc(true); if(!s) return;
    Object.assign(s,{on:true,x,z,h,r,ry:Math.random()*6.283,tx:rand(-0.25,0.25),tz:rand(-0.25,0.25),delay:delay||0,age:0,state:0,k:0,wall:null,glacier:true,main:true,final:false,burstT:-1,life:life||2.6}); }
  function meltWall(w,dur){ if(!w || w.ending) return; w.ending=true; for(const s of w.slots) if(s.on && s.state<3){ if(s.state===0){ free(s); continue; } s.state=3; s.age=0; s.meltDur=dur||MELT; } }
  function releaseFrozen(w, shatter){
    for(const m of w.frozen){ if(m._iceWall!==w) continue; m._iceWall=null; if(m.alive) shatterShell(m); }   // olvadáskor is kipattan a jégből (nem marad beragadt jégtömb)
    w.frozen.clear();
  }
  function freezeIn(s){
    for(const m of nearestTrolls(s.x,s.z,null,s.r+0.3,6)){ if(!m.alive || m.dying>0) continue;
      if(m.boss || m.elite){ m.chill=Math.max(m.chill||0,3); m.slowMul=Math.min(m.slowMul||1,0.45); continue; }   // a nagyok csak lelassulnak
      freezeFull(m); m.frozenSolid=Math.max(m.frozenSolid||0, s.wall.life-s.wall.t+0.15); m._iceWall=s.wall; s.wall.frozen.add(m); }
  }
  function riseFx(s){
    const y=GROUND_Y;
    if(s.main || s.glacier){ VFX.spray(s.x,y+0.25,s.z,s.glacier?5:7,[0xffffff,0xbfe9ff,0x8fd4ff],5+s.h,{up:0.15,life:0.45,grav:12,w:0.022,len:0.03});
      if(s.i%2===0) SMK.spawn(s.x+rand(-0.3,0.3),y+0.2,s.z+rand(-0.3,0.3),rand(-0.4,0.4),0.25,rand(-0.4,0.4),0xd6ecf8,0.6,s.r*3.2,1.1,-0.1,1,0.28); }
    if(!s.glacier && s.main && s.i%3===0) VFX.decal(s.x,GROUND_Y,s.z,s.r*2.6+0.6,0,0xd2ecfa,0.55,LIFE+1);
    if(s.final){ VFX.flare(s.x,y+s.h*0.8,s.z,0xdff4ff,2.2+s.h*0.4,0.24); VFX.ring(s.x,y+0.05,s.z,0xbfe6ff,0.3,s.r*4,0.45,0.8); if(EFX.light) EFX.light(s.x,y+s.h*0.6,s.z,0x8fd8ff,3.8,0.3); }
  }
  function shatterFx(s, hot){
    const y=GROUND_Y+s.h*0.45;
    VFX.debris(s.x,y,s.z,hot?6:9,[0xbfe9ff,0xe8f8ff,0x8fd4ff],5.5+s.h,{up:-0.2,lift:1.6,life:0.75,grav:13,w:0.06+s.r*0.05});
    VFX.spray(s.x,y,s.z,hot?8:6,hot?[0xffffff,0xe8f0ff]:[0xffffff,0xbfe9ff],7,{up:0,lift:1.5,life:0.45,grav:10,w:0.022,len:0.04});
    if(hot){ for(let i=0;i<2;i++) SMK.spawn(s.x+rand(-0.4,0.4),GROUND_Y+rand(0.2,s.h*0.6),s.z+rand(-0.4,0.4),rand(-1.2,1.2),rand(0.8,2.2),rand(-1.2,1.2),0xe6eff6,0.9,2.4+s.h*0.4,rand(0.9,1.4),-0.6,0.8,0.62);
      if(s.i%2===0) VFX.flare(s.x,y,s.z,0xf2f8ff,1.6+s.h*0.5,0.16); }
  }
  // GŐZROBBANÁS: a tűz-találat pontjától kétfelé végigfutó robbanás-sor; a bennfagyott trollok ×1.5, a közelben állók ×0.6
  function burst(w, from, dmg){
    if(!w || w.burst) return; w.burst=true; w.ending=true;
    for(const s of w.slots) if(s.on && s.wall===w && s.state===0) free(s);   // a még ki sem tört tüskék már nem nőnek ki
    const live=w.slots.filter(s=>s.on && s.wall===w && s.state>=1 && s.state<4); if(!live.length) return;
    const o=from&&from.on?from:live[0];
    for(const s of live){ s.burstT=Math.hypot(s.x-o.x,s.z-o.z)*0.028; s.state=4; }
    const mul=(typeof tacticReaction==='function')?tacticReaction('steam','fire',null):1; STATS.reacts++;
    w.burstDmg=dmg*2.2*mul; w.burstHit=new Set();
    spawnZone('steam',o.x,o.z); const mid=live[(live.length/2)|0]; spawnZone('steam',mid.x,mid.z); spawnZone('puddle',mid.x,mid.z);
    VFX.flare(o.x,GROUND_Y+1.4,o.z,0xffffff,5,0.24); EFX.ring(o.x,GROUND_Y+0.05,o.z,0xe8f0ff,0.4,6,0.5,0.85); if(EFX.light) EFX.light(o.x,GROUND_Y+1.6,o.z,0xdfeeff,6,0.4);
    shake=Math.max(shake,0.45); toast(tr('toast.steam')); if(AUD.head) AUD.head();
  }
  function burstSpike(s){
    const w=s.wall; shatterFx(s,true);
    for(const m of nearestTrolls(s.x,s.z,null,s.r+1.5,6)){ if(!m.alive || w.burstHit.has(m)) continue; w.burstHit.add(m);
      const inWall=m._iceWall===w, d=w.burstDmg*(inWall?1.5:0.6)*(m.elite?RUNM.eliteMul:1)*bossDamageMultiplier(m);
      if(inWall){ m._iceWall=null; shatterShell(m); }
      if(m.statusEl==='ice'||m.statusEl==='fire') clearStatus(m);
      m.hp-=d; m.hurtFlash=0.25; m.wet=Math.max(m.wet||0,3); m.rooted=Math.max(m.rooted||0,0.5);
      if(m.hp<=0 && m.alive) killMonster(m,false); }
    free(s);
  }
  // tűz-varázslat / tűz-zóna ért a falhoz: a legközelebbi tüskéből indul a gőzrobbanás
  function fireAt(x,z,r,dmg){
    for(const w of walls){ if(w.burst) continue; let best=null, bd=1e9;
      for(const s of w.slots){ if(!s.on || s.state<1 || s.state>3) continue; const d=Math.hypot(s.x-x,s.z-z)-s.r; if(d<r && d<bd){ bd=d; best=s; } }
      if(best) burst(w,best,dmg); }
  }
  function update(dt){
    for(const K of KINDS) K.n=0;
    for(const s of S){ if(!s.on) continue; s.age+=dt;
      if(s.state===0){ s.delay-=dt; if(s.delay<=0){ s.state=1; s.age=0; riseFx(s);
          if(s.wall){ if(s.wall.onRise) s.wall.onRise(s); freezeIn(s); addSolid(s); } } }   // előbb sebez + fagyaszt, CSAK utána lesz ütközés-test (különben a saját tüskéje takarná a célt)
      if(s.state===1){ s.k=easeOutBack(Math.min(1,s.age/RISE)); if(s.age>=RISE){ s.state=2; s.age=0; s.k=1; } }
      else if(s.state===2){ s.k=1;
        if(s.glacier && s.age>=s.life){ shatterFx(s,false); free(s); continue; } }
      else if(s.state===3){ const md=s.meltDur||MELT, u=Math.min(1,s.age/md); s.k=1-u*0.85;
        if(Math.random()<dt*6*s.r) RP.spawn(s.x+rand(-s.r,s.r)*0.6,GROUND_Y+s.h*s.k*rand(0.3,0.9),s.z+rand(-s.r,s.r)*0.6,0,rand(-0.3,0),0,0xbfe6ff,rand(0.12,0.2),0.02,rand(0.4,0.7),9,1,0.8);   // olvadás: csöpögés
        if(s.main && Math.random()<dt*1.4) SMK.spawn(s.x,GROUND_Y+s.h*s.k*0.6,s.z,rand(-0.3,0.3),0.5,rand(-0.3,0.3),0xe2eef6,0.5,s.r*2.4,1.2,-0.3,1,0.24);
        if(s.solid) s.solid.top=GROUND_Y+s.h*s.k*0.9;
        if(u>=1){ free(s); continue; } }
      else if(s.state===4){ s.burstT-=dt; if(s.burstT<=0){ burstSpike(s); continue; } }
      if(s.state===0) continue;
      const K=KINDS[s.i%3];
      const sx=s.r/GEO_R*(s.state===3?0.75+0.25*s.k:Math.min(1,0.55+0.45*s.k)), sy=s.h*Math.max(0.01,s.k);
      dummy.position.set(s.x,GROUND_Y-0.04-(s.state===3?s.h*0.12*(1-s.k):0),s.z); dummy.rotation.set(s.tx,s.ry,s.tz); dummy.scale.set(sx,sy,sx); dummy.updateMatrix();
      K.body.setMatrixAt(K.n,dummy.matrix);
      dummy.scale.set(sx*1.08,sy*1.04,sx*1.08); dummy.updateMatrix(); K.rim.setMatrixAt(K.n,dummy.matrix); K.n++;
    }
    for(const K of KINDS){ K.body.count=K.rim.count=K.n; K.body.instanceMatrix.needsUpdate=true; K.rim.instanceMatrix.needsUpdate=true; }
    for(let i=walls.length-1;i>=0;i--){ const w=walls[i]; w.t+=dt;
      if(!w.ending && w.t>=w.life-MELT) meltWall(w,MELT);
      for(const m of w.frozen){   // a falban rekedt troll addig marad fagyva, amíg a fal áll (a jég-státusz sem fut le alatta)
        if(m._iceWall!==w) continue;
        if(!m.alive || !(m.frozenSolid>0)){ m._iceWall=null; w.frozen.delete(m); continue; }   // reakció / túltöltés kiszabadította
        if(m.statusEl==='ice') m.statusT=Math.max(m.statusT||0,0.4); }
      if(!w.ending){ w.fxT-=dt; if(w.fxT<=0){ w.fxT=0.12; const s=w.slots[(Math.random()*w.slots.length)|0];   // élő fal: csillanás + talaj menti hideg pára
          if(s && s.on && s.state===2){ RP.spawn(s.x+rand(-s.r,s.r)*0.5,GROUND_Y+s.h*rand(0.4,0.95),s.z+rand(-s.r,s.r)*0.5,0,0.05,0,0xeaf8ff,rand(0.18,0.3),0.02,0.35,0,1,0.9);
            if(Math.random()<0.4) SMK.spawn(s.x+rand(-0.5,0.5),GROUND_Y+0.15,s.z+rand(-0.5,0.5),rand(-0.3,0.3),0.08,rand(-0.3,0.3),0xd6ecf8,0.5,1.8,1.4,-0.05,1,0.2); } } }
      if(!w.slots.some(s=>s.on && s.wall===w)){ if(!w.burst){ const mid=w.slots[(w.slots.length/2)|0]; if(mid) spawnZone('puddle',mid.x,mid.z); }
        releaseFrozen(w, w.burst); walls.splice(i,1); }
    }
  }
  function reset(){ for(const s of S) if(s.on) free(s); for(const w of walls) releaseFrozen(w,false); walls.length=0; for(const K of KINDS) K.body.count=K.rim.count=0; }
  function warm(x,z){ for(let i=0;i<3;i++) Object.assign(S[i],{on:true,x:x+i,z,h:2,r:0.6,ry:0,tx:0,tz:0,delay:0,age:0,state:2,k:1,wall:null,glacier:true,main:false,final:false,burstT:-1,life:999}); update(0); }
  function wallCount(){ return walls.length; }
  return { spawnWall, glacier, fireAt, burst, update, reset, warm, wallCount, ready };
})();
/* --- ELEMI PÁNCÉL látványa: kétszínű, áramló Fresnel-burok az elit/király körül (4 megosztott anyag, a bemelegítés lefordítja) --- */
const ARMOR_FX=(function(){
  const T={value:0};
  const VS='varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vY=position.y; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalMatrix*normal; vV=-mv.xyz; gl_Position=projectionMatrix*mv; }';
  const FS='uniform vec3 uA,uB; uniform float uT; varying vec3 vN; varying vec3 vV; varying float vY;'+
    'void main(){ float fr=pow(1.0-abs(dot(normalize(vN),normalize(vV))),2.2); float band=0.5+0.5*sin(vY*9.0-uT*3.0);'+
    ' vec3 c=mix(uA,uB,smoothstep(-0.6,0.6,vY+0.25*sin(uT*1.7))); gl_FragColor=vec4(c*(0.35+fr*1.6),(0.06+fr*0.75)*(0.6+0.4*band));'+
    '\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}';
  const geo=new THREE.IcosahedronGeometry(1,2), mats={}, warmG=new THREE.Group();
  for(const d of ARMOR_DEFS){ mats[d.rid]=new THREE.ShaderMaterial({uniforms:{uA:{value:new THREE.Color(EL[d.els[0]].fx)},uB:{value:new THREE.Color(EL[d.els[1]].fx)},uT:T},
      vertexShader:VS, fragmentShader:FS, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending});
    const wm=new THREE.Mesh(geo,mats[d.rid]); wm.visible=false; warmG.add(wm); }
  warmG.position.set(0,-50,0); scene.add(warmG);   // rejtett példányok: a bemelegítés ezeket is lefordítja
  function attach(m){ const a=m.armor; if(!a) return; const sh=new THREE.Mesh(geo,mats[a.rid]); const R=(m.bodyR/m.scale)*1.5;
    sh.position.y=m.bodyCY/m.scale; sh.scale.set(R,R*1.35,R); sh.renderOrder=6; enableBloom(sh); m.g.add(sh); m.armorShell=sh; }
  function detach(m,a){
    if(m.armorShell){ m.g.remove(m.armorShell); m.armorShell=null; }
    const p=m.g.position, cy=p.y+(m.bodyCY||1), cA=EL[a.els[0]].fx, cB=EL[a.els[1]].fx;
    VFX.flare(p.x,cy,p.z,0xffffff,5.5,0.26); VFX.spray(p.x,cy,p.z,18,[cA,0xffffff],11,{up:-0.2,lift:1.5,life:0.6,grav:8,w:0.026,len:0.05});
    VFX.spray(p.x,cy,p.z,18,[cB,0xffffff],9,{up:-0.2,lift:1.5,life:0.6,grav:8,w:0.026,len:0.05});
    VFX.debris(p.x,cy,p.z,14,[cA,cB,0xffffff],7,{up:-0.3,lift:1.6,life:0.8,grav:12,w:0.06});
    EFX.ring(p.x,GROUND_Y+0.05,p.z,cA,0.5,7,0.5,0.9); EFX.ring(p.x,GROUND_Y+0.08,p.z,cB,0.4,4.5,0.42,0.7); if(EFX.light) EFX.light(p.x,cy,p.z,cA,6,0.4);
    shake=Math.max(shake,0.55); if(AUD.head) AUD.head();
  }
  function update(dt){ T.value+=dt;
    for(const m of monsters){ if(!m.armor || !m.alive) continue; const a=m.armor;
      if(a.spark>0){ a.spark-=dt; if(Math.random()<0.5){ const p=m.g.position, R=(m.bodyR||0.8)*1.5, ang=Math.random()*6.283;   // páncél-találat: lepattanó, elemszínű szikra
          RP.spawn(p.x+Math.cos(ang)*R,p.y+(m.bodyCY||1)+rand(-0.4,0.6),p.z+Math.sin(ang)*R,Math.cos(ang)*2,rand(0.5,2),Math.sin(ang)*2,EL[a.els[(Math.random()*2)|0]].fx,0.3,0.03,0.3,3,1); } }
      if(m.armorShell){ const k=1+0.04*Math.sin(T.value*4+a.ph); m.armorShell.scale.y=m.armorShell.scale.x*1.35*k; } }
  }
  return { attach, detach, update };
})();
/* --- ELEMI JELEK a trollok feje fölött: nagy rombusz = felvitt státusz, kicsi = a troll saját (innate) eleme, keringő pár = páncél-kulcs --- */
const MARKS=(function(){
  const tex=(function(){ const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d');
    const dia=(r)=>{ g.beginPath(); g.moveTo(32,32-r); g.lineTo(32+r*0.8,32); g.lineTo(32,32+r); g.lineTo(32-r*0.8,32); g.closePath(); };
    dia(30); g.fillStyle='rgba(18,14,24,0.9)'; g.fill();                       // sötét keret: világos háttér előtt is kiolvasható
    dia(24); g.fillStyle='#ffffff'; g.fill();                                  // a csúcs-szín helye (vertexColor szorozza)
    dia(11); g.fillStyle='rgba(255,255,255,1)'; g.fill();
    const t=new THREE.CanvasTexture(c); return t; })();
  function layer(N,size){ const pos=new Float32Array(N*3), col=new Float32Array(N*3), g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setAttribute('color',new THREE.BufferAttribute(col,3)); g.setDrawRange(0,0);
    const p=new THREE.Points(g,new THREE.PointsMaterial({size,map:tex,vertexColors:true,transparent:true,alphaTest:0.05,depthWrite:false,sizeAttenuation:true}));
    p.frustumCulled=false; p.renderOrder=7; scene.add(p); return {N,pos,col,g,p,n:0}; }
  const big=layer(96,0.72), small=layer(64,0.44), C=new THREE.Color(), cols={};
  for(const k of ['fire','ice','poison','lightning']) cols[k]=new THREE.Color(EL[k].fx);
  function put(L,x,y,z,c){ if(L.n>=L.N) return; const i=L.n++*3; L.pos[i]=x; L.pos[i+1]=y; L.pos[i+2]=z; L.col[i]=c.r; L.col[i+1]=c.g; L.col[i+2]=c.b; }
  function update(t){
    big.n=0; small.n=0;
    if(!coop) for(const m of monsters){ if(!m.alive || m.dying>0) continue;
      const p=m.g.position, y=p.y+(m.headCY||m.bodyCY*1.6)+0.55+Math.sin(t*3+(m.seed||0))*0.06;
      if(m.armor){ const a=m.armor, R=0.75+m.bodyR*0.3; for(let k=0;k<2;k++){ const ang=t*2.2+a.ph+k*3.1416; put(big,p.x+Math.cos(ang)*R,y+0.15,p.z+Math.sin(ang)*R,cols[a.els[k]]); } }
      const st=m.statusEl, inn=m.el;
      if(st && cols[st]){ C.copy(cols[st]).multiplyScalar(0.85+0.15*Math.sin(t*6)); put(big,p.x,y,p.z,C); }
      if(inn && cols[inn] && inn!==st) put(small,p.x+(st?0.42:0),y-(st?0.12:0),p.z,cols[inn]); }
    for(const L of [big,small]){ L.g.setDrawRange(0,L.n); L.g.attributes.position.needsUpdate=true; L.g.attributes.color.needsUpdate=true; }
  }
  function hide(){ big.n=small.n=0; big.g.setDrawRange(0,0); small.g.setDrawRange(0,0); }
  function warm(x,y,z){ put(big,x,y,z,cols.fire); put(small,x+1,y,z,cols.ice); big.g.setDrawRange(0,1); small.g.setDrawRange(0,1); }
  return { update, hide, warm };
})();
/* ===================== KATAKLIZMA (Elemi ébredés III.) =====================
   Előtted kitáguló front: 120°-os, 50 m mély cikk (a pálya kb. negyede), legalább 3-as elemi láncnál 180°, 56 m (kb. a fele).
   Sebzés: a hullám sima trolljának életereje ×1.2 -> a kicsik elhullanak, a nagyok/elitek/király nagyot kapnak és megtántorodnak. */
function castCataclysm(el, px, pz, fx, fz, arrowDmg){
  const wide=chainLive() && CHAIN.n>=3;
  CATA.charge=0; CATA.said=false;
  CATA.run={el, ox:px, oz:pz, ang:Math.atan2(fz,fx), half:wide?Math.PI/2:Math.PI/3, depth:wide?56:50, front:4.5, speed:38,
    dmg:1.2*waveBaseHp(wave)*RUNM.elemPowerMul, arrowDmg, hit:new Set(), tick:0, k:0, t:0};
  callout(tr('tac.cataCast.'+el)+(wide?' ×2':''),true);
  slowT=Math.max(slowT,0.5); shake=Math.max(shake,0.6);
  const col=EL[el].fx; EFX.flash(px+fx*6,GROUND_Y+2,pz+fz*6,col,0.6,9,0.4,0.35);   // a villanás előtted, nem a szemedbe if(EFX.light) EFX.light(px,GROUND_Y+3,pz,col,9,0.6);
  if(AUD.spell) AUD.spell(el,3);
}
function cataHit(R, m){
  const el=R.el; let dmg=R.dmg*(el==='ice'?0.85:1);
  if(m.el===el) dmg*=0.5;   // saját elemű troll: fél sebzés, de NEM gyógyul (kataklizma)
  dmg*=(m.elite?RUNM.eliteMul:1)*bossDamageMultiplier(m)*(m.frozenSolid>0?1.5:1);
  m.hp-=dmg; m.hurtFlash=0.3;
  const p=m.g.position;
  if(m.armor){ elementMechanic({x:p.x,y:p.y+(m.bodyCY||1),z:p.z}, el, m, R.arrowDmg, false, m.statusEl, 1, true, true); }   // a páncél kulcs-reakciója itt is áttörhet
  if(m.hp<=0 && m.alive){ killMonster(m,false); return; }
  if(m.el!==el) applyStatus(m, el, 1, el==='poison'?3:2);
  if(el==='ice' && !m.boss && !m.elite) freezeFull(m);
  if(el==='lightning'){ m.charged=Math.max(m.charged||0,2); VFX.bolt(p.x+rand(-1.5,1.5),GROUND_Y+15,p.z+rand(-1.5,1.5),p.x,p.y+(m.bodyCY||1),p.z,0xcdbcff,0.24,0.4,0.1); }
  if(el==='poison' && !m.boss){ const k=0.35, cx=R.ox+Math.cos(R.ang)*Math.hypot(p.x-R.ox,p.z-R.oz), cz=R.oz+Math.sin(R.ang)*Math.hypot(p.x-R.ox,p.z-R.oz);
    const nx=pushMob(lerp(p.x,cx,k),lerp(p.z,cz,k),(m.bodyR||0.5)*0.9); p.x=nx.x; p.z=nx.z; }   // a méregköd a sáv közepe felé sodor
  if(m.boss || m.elite || m.typeId==='brute') m.rooted=Math.max(m.rooted||0,1.0);
}
function cataFxAt(R, x, z, k){
  const y=GROUND_Y, el=R.el;
  if(el==='fire'){
    VFX.flame(x,y,z,rand(1.5,2.3),rand(4,6.5),0.85,VFX.PAL.fire,1);
    if(k%2===0) FIREBURST.spawn(x,y+1.3,z,rand(3.2,4.4));
    for(let i=0;i<3;i++) RP.spawn(x+rand(-1,1),y+rand(0.5,3),z+rand(-1,1),rand(-1,1),rand(2,4.5),rand(-1,1),pick([0xff8a3a,0xffc24d,0xfff1c4]),rand(0.18,0.32),0.02,rand(0.6,1.1),-1.2,1.1);
    if(k%3===0) VFX.decal(x,GROUND_Y,z,2.6,1,0x120805,0.8,9,0xff6a1a,3.5);
  } else if(el==='ice'){
    ICEWALL.glacier(x,z,rand(1.4,3.4),rand(0.5,0.85),0,rand(2.2,2.8));
    if(k%2===0) ICEWALL.glacier(x+rand(-1.6,1.6),z+rand(-1.6,1.6),rand(0.8,1.8),rand(0.35,0.55),0.05,rand(2.2,2.8));
    VFX.spray(x,y+0.3,z,6,[0xffffff,0xbfe9ff,0x8fd4ff],7,{up:0.15,life:0.5,grav:12,w:0.022,len:0.03});
    if(k%3===0){ SMK.spawn(x,y+0.3,z,rand(-0.5,0.5),0.3,rand(-0.5,0.5),0xd6ecf8,0.8,3.2,1.4,-0.1,1,0.32); VFX.decal(x,GROUND_Y,z,2.4,0,0xd2ecfa,0.55,6); }
  } else if(el==='poison'){
    for(let i=0;i<3;i++) SMK.spawn(x+rand(-1.5,1.5),y+rand(0.4,2.2),z+rand(-1.5,1.5),rand(-0.8,0.8),rand(0.4,1.1),rand(-0.8,0.8),pick([0x7fbf2e,0x8fd03a,0x6fae2a]),1.4,rand(5,7),rand(1.8,2.6),-0.2,0.85,0.58);   // gomolygó, világító méregköd
    if(k%2===0) POISONPOOL.spawn(x,y+0.1,z,rand(5,7),1.4);
    for(let i=0;i<6;i++) RP.spawn(x+rand(-2,2),y+rand(0.2,1.5),z+rand(-2,2),rand(-0.4,0.4),rand(0.6,1.8),rand(-0.4,0.4),pick([0xc8f26a,0xe2ff9a,0x9fdc4a]),rand(0.26,0.42),0.3,rand(0.8,1.3),-0.6,1.2,0.9);
    if(k%4===0 && EFX.light) EFX.light(x,y+1.5,z,0x9fdc4a,4,0.5);
  } else {
    if(k%2===0) skyStrike(x,z,1.25);
    else { VFX.bolt(x+rand(-3,3),y+16,z+rand(-3,3),x,y+0.1,z,0xd8ccff,0.22,0.4,0.09); VFX.flare(x,y+0.5,z,0xe8e0ff,2,0.14); }
  }
}
function updateCata(dt){
  const R=CATA.run; if(!R) return;
  R.t+=dt; const prev=R.front; R.front=Math.min(R.depth,R.front+R.speed*dt);
  for(const m of monsters){ if(!m.alive || m.dying>0 || coopIsRemote(m) || R.hit.has(m)) continue;
    const dx=m.g.position.x-R.ox, dz=m.g.position.z-R.oz, d=Math.hypot(dx,dz);
    if(d>R.front+(m.bodyR||0.5)) continue;
    let da=Math.atan2(dz,dx)-R.ang; da=Math.atan2(Math.sin(da),Math.cos(da));
    if(Math.abs(da)>R.half+Math.min(0.4,(m.bodyR||0.5)/Math.max(1,d))) continue;
    R.hit.add(m); cataHit(R,m); }
  R.tick-=dt;
  if(R.tick<=0 && R.front<R.depth){ R.tick=0.07;
    { const col=EL[R.el].fx, cnt=Math.min(64,Math.round(R.front*R.half*2/1.1));   // a front IZZÓ VONALA: végigsöprő elemszínű perem a talajon
      for(let i=0;i<cnt;i++){ const a=R.ang+lerp(-R.half,R.half,(i+Math.random())/cnt), ca=Math.cos(a), sa=Math.sin(a);
        RP.spawn(R.ox+ca*R.front,GROUND_Y+0.18,R.oz+sa*R.front, ca*4,rand(0.3,1.4),sa*4, col, rand(0.4,0.65),0.06,rand(0.3,0.45),0,1,0.95); } }
    const n=Math.max(2,Math.min(gfxTier==='low'?5:9,Math.round(R.front*R.half*2/6)));   // alacsony grafikán kevesebb front-pont
    for(let i=0;i<n;i++){ const a=R.ang+lerp(-R.half,R.half,(i+Math.random())/n), rr=R.front-rand(0,2.5);
      if(rr>=6) cataFxAt(R,R.ox+Math.cos(a)*rr,R.oz+Math.sin(a)*rr,R.k++); }   // a játékos 6 m-es körzete szabad marad (nem vakít el)
    if(R.k%6===0 && EFX.light){ const a=R.ang; EFX.light(R.ox+Math.cos(a)*R.front,GROUND_Y+3,R.oz+Math.sin(a)*R.front,EL[R.el].fx,7,0.35); }
    shake=Math.max(shake,0.22); }
  if(R.front>=R.depth && prev<R.depth){   // a front végigért: záró hullám + maradandó zónák
    const zk=R.el==='fire'?'fire':R.el==='poison'?'gas':R.el==='ice'?'frost':null;
    for(let i=0;i<3;i++){ const a=R.ang+(i-1)*R.half*0.6, rr=R.depth*0.45;
      const x=R.ox+Math.cos(a)*rr, z=R.oz+Math.sin(a)*rr;
      if(zk) spawnZone(zk,x,z,zk==='gas'?{y:GROUND_Y+1}:{});
      if(R.el==='lightning') skyStrike(x,z,1.6); }
    shake=Math.max(shake,0.5); CATA.run=null; }
}
/* --- REAKCIÓ-ROBBANÁSOK: minden reakciónak saját, messziről felismerhető „aláírása” (a régi látvány mellé) ---
   túltöltés = ibolya villám-csillag + kifelé repülő jégkristály-koszorú + talajon szétfutó ívek
   gőz      = fehér gőzgomba: felfelé csapó oszlop + gyűrűben kiáramló gőz + forró cseppek
   gyújtás  = mérges tűzgolyó: Blender tűz-robbanás zöld maggal + zöld-narancs szikraeső
   galván   = zöld villám-ívek a talajon + méregfröccs
   rothadás = jégkristály-gyűrű zöld méregpárában (+ méreg-koponya, ha van atlasz) */
function reactFx(id, px, py, pz){
  const y=GROUND_Y;
  if(id==='overload'){
    ZAPBURST.spawn(px,py,pz,5.2,1.3); EFX.flash(px,py,pz,0xb9a4ff,0.7,5,0.3);
    for(let i=0;i<8;i++){ const a=i/8*6.283+rand(-0.2,0.2), ca=Math.cos(a), sa=Math.sin(a), rr=rand(0.8,1.6);
      VFX.crystal(px+ca*rr,y-0.03,pz+sa*rr,rand(0.3,0.5),rand(0.7,1.3),0.5+rand(0,0.2),sa*0.6,-ca*0.6,true);
      VFX.bolt(px,y+0.15,pz, px+ca*rand(3,5),y+0.08,pz+sa*rand(3,5), i%2?0xcdbcff:0x9fd0ff, 0.3, 0.25, 0.04, true); }
    VFX.debris(px,py,pz,18,[0xbfe9ff,0xe8f8ff,0xb9a4ff],10,{up:-0.2,lift:2,life:0.8,grav:12,w:0.07});
  } else if(id==='steam'){
    VFX.column(px,y,pz,1.1,7,0xffffff,0.45);
    for(let i=0;i<16;i++){ const a=i/16*6.283, ca=Math.cos(a), sa=Math.sin(a);
      SMK.spawn(px+ca*0.6,y+rand(0.3,0.9),pz+sa*0.6, ca*rand(2.5,4),rand(0.3,1),sa*rand(2.5,4), 0xeef4f8,1.0,rand(2.2,3),rand(0.9,1.3),-0.4,0.7,0.65); }
    for(let i=0;i<8;i++) SMK.spawn(px+rand(-0.4,0.4),py+rand(0.5,2.5),pz+rand(-0.4,0.4),rand(-0.4,0.4),rand(2,3.5),rand(-0.4,0.4),0xf4f8fb,1.2,rand(2.6,3.4),rand(1,1.5),-0.8,0.8,0.6);
    EFX.ring(px,y+0.06,pz,0xffffff,0.5,5.5,0.5,0.8); VFX.flare(px,py+0.6,pz,0xffffff,4.5,0.22);
  } else if(id==='ignite'){
    FIREBURST.spawn(px,py+0.4,pz,6.2,1.1); VFX.ball(px,py,pz,0.25,1.4,0.5,VFX.PAL.toxic);
    for(let i=0;i<14;i++) VFX.streak(px,py,pz, rand(-6,6),rand(2,8),rand(-6,6), i%3?0xffb347:0x9fdc4a, rand(0.3,0.6), 9, 1, 0.025, 0.08);
  } else if(id==='galvanic'){
    for(let i=0;i<6;i++){ const a=i/6*6.283+rand(-0.3,0.3), rr=rand(2.5,4.5);
      VFX.bolt(px,y+0.2,pz, px+Math.cos(a)*rr,y+0.06,pz+Math.sin(a)*rr, i%2?0x9fe04a:0xd8ff8a, 0.32, 0.22, 0.04, true); }
    POISONPOOL.spawn(px,y+0.1,pz,3.2,0.9); VFX.flare(px,py,pz,0xc8f26a,3,0.2);
    VFX.spray(px,py,pz,16,[0x9fdc4a,0xc8f060,0xffffff],8,{up:-0.1,lift:1.5,life:0.5,grav:10,w:0.024,len:0.05});
  } else if(id==='frostrot'){
    for(let i=0;i<5;i++){ const a=i/5*6.283+rand(-0.3,0.3), ca=Math.cos(a), sa=Math.sin(a);
      VFX.crystal(px+ca*0.9,y-0.03,pz+sa*0.9,0.35,rand(0.7,1.1),1.2,sa*0.5,-ca*0.5,true); }
    for(let i=0;i<6;i++) SMK.spawn(px+rand(-0.6,0.6),y+rand(0.2,0.8),pz+rand(-0.6,0.6),rand(-0.3,0.3),0.2,rand(-0.3,0.3),pick([0x6f9f2a,0x8fbf3a]),0.8,2.2,1.4,-0.1,1,0.4);
    EFX.ring(px,y+0.06,pz,0x9fdc4a,0.3,3,0.45,0.7);
  }
  if(typeof POISONSKULL!=='undefined' && (id==='frostrot' || id==='galvanic' || id==='ignite')) POISONSKULL.spawn(px,py+0.9,pz,1.1);
}
/* --- KATAKLIZMA KÉSZ: az íj berakása az elem színében lüktet, és elemszínű szikrák szállnak fel a vesszőkről --- */
const _bowP=new THREE.Vector3(), _camUp=new THREE.Vector3(); let _cataGlow=false, _cataAcc=0;
const CATA_BOW_AURA=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xffffff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
CATA_BOW_AURA.scale.set(0.42,1.25,1); CATA_BOW_AURA.visible=false; bow.add(CATA_BOW_AURA);   // lüktető, elemszínű fényudvar az íj mentén (a kezdő íjon nincs izzó berakás)
function updateCataBowGlow(dt,t){
  const on=!coop && running && player.alive && RUN.awakening>=3 && CATA.charge>=1;
  if(!on){ if(_cataGlow){ _cataGlow=false; CATA_BOW_AURA.visible=false; updateNockElement(); } return; }
  _cataGlow=true; const col=EL[currentElement].fx;
  CATA_BOW_AURA.visible=true; CATA_BOW_AURA.material.color.setHex(col); CATA_BOW_AURA.material.opacity=0.28+0.22*Math.abs(Math.sin(t*4.5));
  bowInlayMat.emissive.setHex(col); bowInlayMat.emissiveIntensity=1.6+1.6*Math.abs(Math.sin(t*4.5));
  bow.getWorldPosition(_bowP); _camUp.set(0,1,0).applyQuaternion(camera.quaternion);
  _cataAcc+=dt*40;
  while(_cataAcc>=1){ _cataAcc-=1; const u=rand(-0.5,0.5);
    RP.spawn(_bowP.x+_camUp.x*u+rand(-0.03,0.03),_bowP.y+_camUp.y*u,_bowP.z+_camUp.z*u+rand(-0.03,0.03), playerMotion.x+rand(-0.1,0.1),rand(0.25,0.6),playerMotion.z+rand(-0.1,0.1), col, rand(0.025,0.045),0.004,rand(0.35,0.6),-0.4,1,0.95); }
}
/* ===================== ALAP-NYÍL ÉBREDÉS: NYÍLKOSZORÚ · NYÍLESŐ · NYÍLVIHAR =====================
   A sima nyíl is kap ébredést (a rangok itt is halmozódnak):
   I.  teljes húzáskor 10 lebegő SZELLEMNYÍL kering a célkereszt körül; elengedéskor a rendes nyíllal EGYÜTT kirepülnek a cél felé
   II. + NYÍLESŐ: a célpont köré 30 nyíl zúdul az égből
   III.+ NYÍLVIHAR, ha a kataklizma-töltés megtelt: 5 mp-ig másodpercenként 10 nyíl a koszorúból oda, ahová éppen célzol
   A szellemnyilak EGYETLEN példányosított hálót használnak (1 rajzolási hívás), saját röppályával és találat-vizsgálattal. */
I18N.hu.tac.base={ring:'NYÍLKOSZORÚ',rain:'NYÍLESŐ',storm:'NYÍLVIHAR!'};
I18N.en.tac.base={ring:'ARROW HALO',rain:'ARROW RAIN',storm:'ARROW STORM!'};
const GHOST=(function(){
  const CAP=128, RING_N=10, SPEED=58;
  const geo=(function(){   // +Z felé mutató, egyszerűsített nyíl: vessző + széles hegy + tollazat; a hegy fényesebb
    const shaft=gradTint(new THREE.CylinderGeometry(0.011,0.011,0.78,5),0x8a5a1c,0xd9a441,-0.39,0.39,1);   // mélyarany vessző -> a bloomban sem ég ki fehérre
    const tip=gradTint(new THREE.ConeGeometry(0.05,0.17,4),0xffcf6a,0xfff2c8,-0.08,0.08,1);
    const fl=gradTint(new THREE.PlaneGeometry(0.1,0.05),0x9c4f14,0xe0913a,-0.025,0.025,1);
    const g=mergeGeos([{geo:shaft,rx:Math.PI/2},{geo:tip,z:0.46,rx:Math.PI/2},{geo:fl,z:-0.34,ry:Math.PI/2},{geo:fl,z:-0.34,ry:Math.PI/2,rz:Math.PI/2}]);
    g.computeVertexNormals(); return g; })();
  const mat=new THREE.MeshBasicMaterial({vertexColors:true, transparent:true, opacity:0.88, side:THREE.DoubleSide});
  const mesh=new THREE.InstancedMesh(geo,mat,CAP); mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.count=0; mesh.frustumCulled=false; mesh.renderOrder=5;
  enableBloom(mesh); scene.add(mesh);
  const A=[]; for(let i=0;i<CAP;i++) A.push({st:0, pos:new THREE.Vector3(), prev:new THREE.Vector3(), vel:new THREE.Vector3(), life:0, delay:0, dmg:0, k:1});
  const dummy=new THREE.Object3D(), _f=new THREE.Vector3(), _r=new THREE.Vector3(), _u=new THREE.Vector3(), _c=new THREE.Vector3(), _t=new THREE.Vector3(), _q=new THREE.Vector3(), _aim=new THREE.Vector3();
  let ringK=0, ringRot=0, stormT=0, stormAcc=0, stormDmg=0, stormSlot=0, hitMarkT=0;
  function free(){ for(const a of A) if(a.st===0) return a; let best=null; for(const a of A) if(a.st===3 && (!best || a.life>best.life)) best=a; return best; }   // betelt: a legrégebbi beállt nyíl adja át a helyét
  // a célpont: az első troll a nézési sugár mentén (60 m-ig), különben a talaj / 40 m előre
  function aimPoint(out){
    camera.getWorldDirection(_f); const o=camera.position; let found=false, bd=60;
    for(const m of monsters){ if(!m.alive || m.dying>0 || coopIsRemote(m)) continue;
      _c.set(m.g.position.x,m.g.position.y+(m.bodyCY||1),m.g.position.z); const along=_q.copy(_c).sub(o).dot(_f);
      if(along<1.5 || along>bd) continue; _t.copy(o).addScaledVector(_f,along); if(_t.distanceTo(_c)<(m.bodyR||0.6)+0.4){ bd=along; out.copy(_c); found=true; } }
    if(found) return out;
    let d=40; if(_f.y<-0.02) d=clamp((GROUND_Y-o.y)/_f.y,3,60);
    return out.copy(o).addScaledVector(_f,d);
  }
  function ringPos(i, out){   // a célkereszt körüli koszorú i. helye (világtérben, a kamerához kötve)
    camera.getWorldDirection(_f); _r.set(1,0,0).applyQuaternion(camera.quaternion); _u.set(0,1,0).applyQuaternion(camera.quaternion);
    const a=ringRot+i/RING_N*6.283, rr=0.52+0.04*Math.sin(ringRot*3+i), bob=0.02*Math.sin(ringRot*5+i*1.7);
    return out.copy(camera.position).addScaledVector(_f,1.7).addScaledVector(_r,Math.cos(a)*rr).addScaledVector(_u,Math.sin(a)*rr*0.75+bob-0.03);
  }
  function shoot(from, to, dmg, spread, speed){
    const a=free(); if(!a) return; a.st=2; a.pos.copy(from); a.prev.copy(from); a.life=0; a.dmg=dmg; a.k=1;
    _t.copy(to); if(spread){ _t.x+=rand(-spread,spread); _t.y+=rand(-spread*0.4,spread*0.4); _t.z+=rand(-spread,spread); }
    a.vel.copy(_t).sub(from).normalize().multiplyScalar(speed||SPEED);
  }
  // I: a koszorú 10 nyila a célpont felé (a rendes nyíllal egy pillanatban)
  function launchRing(target, dmg){
    const T=target.clone();
    for(let i=0;i<RING_N;i++){ ringPos(i,_c); const from=_c.clone(); shoot(from,T,dmg,0.7); VFX.flare(from.x,from.y,from.z,0xffe7b8,0.25,0.12); }
    ringK=0;
  }
  // II: nyíleső a célpont köré (az égből, a játékos felől enyhe szögben), jelölő arany gyűrűvel
  function rain(tx,tz,dmg,n){
    const px=player.pos.x, pz=player.pos.z, dx=tx-px, dz=tz-pz, dl=Math.hypot(dx,dz)||1;
    VFX.ring(tx,GROUND_Y+0.06,tz,0xffd27a,5.5,0.4,0.5,0.8); EFX.ring(tx,GROUND_Y+0.05,tz,0xffe7b8,0.4,5.5,0.6,0.6);
    const near=nearestTrolls(tx,tz,null,6.5,12);   // a nyilak kétharmada a kör trolljaira zúdul (kis szórással), a többi a környékre
    for(let i=0;i<n;i++){ const a=free(); if(!a) return; let gx, gz; const h=rand(15,19);
      if(near.length && i%3!==0){ const m=near[(Math.random()*near.length)|0]; gx=m.g.position.x+rand(-0.5,0.5); gz=m.g.position.z+rand(-0.5,0.5); }
      else { const ang=rand(0,6.283), rr=5.5*Math.sqrt(Math.random()); gx=tx+Math.cos(ang)*rr; gz=tz+Math.sin(ang)*rr; }
      a.st=4; a.delay=0.25+i*(1.1/n); a.pos.set(gx-dx/dl*h*0.35, GROUND_Y+h, gz-dz/dl*h*0.35); a.prev.copy(a.pos); a.dmg=dmg; a.life=0; a.k=1;
      a.vel.set(gx,GROUND_Y,gz).sub(a.pos).normalize().multiplyScalar(40); }
  }
  function storm(dur,dmg){ stormT=dur; stormAcc=0; stormDmg=dmg; }
  function hitTest(a){
    for(const m of monsters){ if(!m.alive || m.dying>0 || coopIsRemote(m)) continue;
      const gp=m.g.position; let head=false, mul=0;
      _c.set(gp.x,gp.y+(m.headCY||1.6),gp.z); if(segDist(a.prev,a.pos,_c)<(m.headR||0.4)){ head=true; mul=2; }
      else { _c.set(gp.x,gp.y+(m.bodyCY||1),gp.z); if(segDist(a.prev,a.pos,_c)<(m.bodyR||0.6)) mul=1;
        else { _c.set(gp.x,gp.y+(m.bodyCY||1)*0.42,gp.z); if(segDist(a.prev,a.pos,_c)<(m.bodyR||0.6)*0.72) mul=0.6; } }
      if(!mul) continue;
      let d=a.dmg*mul*(m.frozenSolid>0?1.5:1)*(m.elite?RUNM.eliteMul:1)*bossDamageMultiplier(m);
      if(RUNM.crit>0 && Math.random()<RUNM.crit){ d*=2; m._dnCrit=true; }
      if(head) m._dnHead=true;
      m.hp-=d; m.hurtFlash=0.15; sparks.burst(a.pos.x,a.pos.y,a.pos.z,5,0xffe7b8,4,0.3);
      if(hitMarkT<=0){ hitMarkT=0.06; hitMarker(m.hp<=0?'kill':(head?'head':'')); if(AUD.hit) AUD.hit(); }
      if(m.hp<=0 && m.alive) killMonster(m,head);
      return true; }
    return false;
  }
  function update(dt){
    hitMarkT-=dt;
    const ringOn=!coop && running && player.alive && currentElement==='base' && RUN.awakening>0 && ((drawing && spellCd<=0) || stormT>0);
    ringK=ringOn?Math.min(1,ringK+dt*(stormT>0?4:1.4*Math.max(0.4,charge/RUNM.drawCap))):Math.max(0,ringK-dt*4);
    ringRot+=dt*(stormT>0?3.2:0.7);
    if(stormT>0){ stormT-=dt; stormAcc+=dt*10;
      while(stormAcc>=1){ stormAcc-=1; ringPos(stormSlot++%RING_N,_c); const from=_c.clone(); aimPoint(_aim); shoot(from,_aim,stormDmg,0.6); VFX.flare(from.x,from.y,from.z,0xffe7b8,0.22,0.1); if(AUD.twang && stormSlot%3===0) AUD.twang(0.7); } }
    let n=0;
    if(ringK>0.01){ camera.getWorldDirection(_f); aimPoint(_aim);
      for(let i=0;i<RING_N && n<CAP;i++){ ringPos(i,_c); dummy.position.copy(_c); _t.copy(_aim).sub(_c).normalize().add(_f).add(_c); dummy.lookAt(_t); dummy.scale.setScalar(ringK*0.7); dummy.updateMatrix(); mesh.setMatrixAt(n++,dummy.matrix); } }
    for(const a of A){ if(a.st===0) continue;
      if(a.st===4){ a.delay-=dt; if(a.delay>0) continue; a.st=2; }
      if(a.st===2){ a.life+=dt; a.prev.copy(a.pos); a.vel.y-=GRAV*0.3*dt; a.pos.addScaledVector(a.vel,dt);
        if(Math.random()<0.4) VFX.streak(a.prev.x,a.prev.y,a.prev.z, -a.vel.x*0.02,-a.vel.y*0.02,-a.vel.z*0.02, 0xffd27a, 0.14,0,2,0.012,0.4);
        if(hitTest(a)){ a.st=0; continue; }
        if(a.pos.y<=GROUND_Y+0.02){ a.pos.y=GROUND_Y+0.02; a.st=3; a.life=0; VFX.spray(a.pos.x,a.pos.y+0.05,a.pos.z,4,[0xffe7b8,0x8b7355],3,{up:0.2,life:0.35,grav:10,w:0.02,len:0.03}); }
        else if(a.life>3){ a.st=0; continue; } }
      else if(a.st===3){ a.life+=dt; a.k=1-Math.max(0,(a.life-0.9)/0.5); if(a.k<=0){ a.st=0; continue; } }
      if(n>=CAP) continue;
      dummy.position.copy(a.pos); dummy.lookAt(_t.copy(a.pos).add(a.vel)); dummy.scale.setScalar(a.k); dummy.updateMatrix(); mesh.setMatrixAt(n++,dummy.matrix); }
    mesh.count=n; mesh.instanceMatrix.needsUpdate=true;
  }
  function reset(){ for(const a of A) a.st=0; ringK=0; stormT=0; mesh.count=0; }
  function warm(x,y,z){ dummy.position.set(x,y,z); dummy.rotation.set(0,0,0); dummy.scale.setScalar(1); dummy.updateMatrix(); mesh.setMatrixAt(0,dummy.matrix); mesh.count=1; mesh.instanceMatrix.needsUpdate=true; }
  function stormLeft(){ return Math.max(0,stormT); }
  return { aimPoint, launchRing, rain, storm, update, reset, warm, stormLeft };
})();
function baseSpellReady(){ return !coop && running && player.alive && RUN.awakening>0 && currentElement==='base' && spellCd<=0; }
// teljes húzásnál a rendes nyíl MELLÉ (a hívó a sima nyilat is kilövi); igazat ad, ha elsült
function castBaseSpell(draw){
  if(!baseSpellReady() || draw<RUNM.drawCap*0.98) return false;
  const rank=RUN.awakening, weapon=activeBow();
  const dmg=(18+draw*30)*RUNM.dmgMul*weapon.spell*(perfectShot?1.3:1)*(player.witherT>0?TROLL_TYPES.shaman.witherDmgMul:1);
  spellCd=Math.max(2.2,7-rank-weapon.cooldown);
  const P=GHOST.aimPoint(new THREE.Vector3());
  GHOST.launchRing(P, dmg*0.55);                                     // I
  let name=tr('tac.base.ring');
  if(rank>=2){ GHOST.rain(P.x,P.z,dmg*0.5,30); name+=' + '+tr('tac.base.rain'); }   // II
  if(rank>=3 && cataReady()){ CATA.charge=0; CATA.said=false; GHOST.storm(5,dmg*0.5); name=tr('tac.base.storm'); slowT=Math.max(slowT,0.3); }   // III
  callout(name+' · '+tr('combat.rank',{n:rank}),true);
  bowKick=1; spellKick=1; buzz(35);
  return true;
}
/* --- HUD: lánc a célkereszt alatt, kataklizma-töltés az arzenál fölött --- */
let _tacHudEls=null, _tacHudKey='';
function updateTacticsHud(){
  if(!_tacHudEls){ const ch=document.getElementById('chainHud'), ca=document.getElementById('cataHud'); if(!ch||!ca) return;
    _tacHudEls={ch, chMul:ch.querySelector('b'), chPips:ch.querySelector('.pips'), chT:ch.querySelector('.t i'), ca, caLbl:ca.querySelector('span'), caFill:ca.querySelector('.bar i')}; }
  const H=_tacHudEls, live=!coop && running && chainLive() && CHAIN.n>=1;
  H.ch.hidden=!live;
  if(live){ const key=CHAIN.n+'|'+CHAIN.els.join(',');
    if(key!==_tacHudKey){ _tacHudKey=key; H.chMul.textContent=CHAIN.n>=2?tr('tac.chain',{n:chainMulOf(CHAIN.n)}):'';
      H.chPips.innerHTML=CHAIN.els.map(e=>'<i style="color:#'+(EL[e].fx>>>0).toString(16).padStart(6,'0')+';background:currentColor"></i>').join(''); }
    H.chT.style.width=Math.max(0,100*(1-(tacNow()-CHAIN.t)/TAC_CHAIN_WIN)).toFixed(1)+'%';
    if(CHAIN.pop){ CHAIN.pop=0; H.ch.classList.remove('pop'); void H.ch.offsetWidth; H.ch.classList.add('pop'); } }
  const showCa=!coop && running && player.alive && RUN.awakening>=3;
  H.ca.hidden=!showCa;
  if(showCa){ const full=CATA.charge>=1; H.ca.classList.toggle('full',full);
    H.caLbl.textContent=full?tr('tac.cataReady'):tr('tac.cata',{n:Math.floor(CATA.charge*100)}); H.caFill.style.width=(CATA.charge*100).toFixed(1)+'%'; }
}
function updateTactics(dt, t){
  if(!coop && running && RUN.awakening>=3 && !CATA.run) cataAdd(dt/CATA_FILL_S);
  updateCata(dt);
  ICEWALL.update(dt);
  ARMOR_FX.update(dt);
  MARKS.update(t);
  updateCataBowGlow(dt,t);
  GHOST.update(dt);
  updateTacticsHud();
}
