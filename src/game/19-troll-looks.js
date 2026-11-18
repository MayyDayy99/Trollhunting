/* ===================== LÁTVÁNY-TURBÓ: TROLL-MEGJELENÉS =====================
   (1) RIM-FÉNY: hideg holdfény-kontúr minden troll-anyagon (fresnel a fragment-shader végén) -> a sötét erdőben is
       kirajzolódik a sziluett. (2) TALÁLAT-VILLANÁS: a troll saját anyagai egy pillanatra kifehérednek (per-troll uniform).
   (3) SEBZÉS-SZÁMOK: a HP-változásból (bármilyen forrás: nyíl, DoT, reakció, co-op szerver) lebegő számok.
   (4) Előbújás-por a barlangszájnál, (5) lélek-szikrák + pont-felirat halálkor. Mind vizuál-only (SP + co-op). */
const _rimSharedU={value:0};
function _rimKey(){ return 'troll-rim'; }
function trollRimCompile(sh){
  sh.uniforms.uFlash=(this.userData&&this.userData.flashU)||_rimSharedU;
  sh.vertexShader='varying vec3 vTOP;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTOP=position;');
  sh.fragmentShader='varying vec3 vTOP;\n'+STY_NOISE+sh.fragmentShader.replace('#include <color_fragment>',
    '#include <color_fragment>\n{ float tn1=sn3(vTOP*3.1), tn2=sn3(vTOP*11.0+4.0);\n'+
    '  diffuseColor.rgb*=(0.86+0.26*tn1)*(0.95+0.10*tn2); }');   // festett bőr: lágy foltok + finom pórus, szöglet- és zajmentes
  sh.fragmentShader='uniform float uFlash;\n'+sh.fragmentShader.replace('#include <tonemapping_fragment>',
    '{ float rimK=pow(1.0-saturate(dot(normalize(vViewPosition),normal)),2.3);\n'+
    '  gl_FragColor.rgb+=vec3(0.26,0.46,0.90)*rimK*0.62*(0.35+0.65*saturate(normal.y*0.5+0.62));\n'+
    '  gl_FragColor.rgb=mix(gl_FragColor.rgb, vec3(1.7,1.55,1.3), uFlash*(0.42+0.58*rimK)); }\n#include <tonemapping_fragment>');   // találat-villanás: forró KONTÚR + enyhe kitöltés (nem lapos fehér folt -> a forma olvasható marad)
}
function applyTrollRim(m){
  const flash=[], own=new Set((m.gen&&m.gen._mats)||[]);
  m.g.traverse(o=>{ if(!o.isMesh) return; const mat=o.material; if(!mat||!mat.isMeshStandardMaterial) return;
    if(o.geometry && o.geometry.attributes.position && !o.geometry.index && !o.geometry.userData._tsm){ try{ smoothNormals(o.geometry,54); }catch(_e){} }   // indexelt primitív (gömb/henger) normáljai már simák   // AA-indie: lágy, élmegtartó árnyalás a trollokon
    if(mat.flatShading){ mat.flatShading=false; mat.needsUpdate=true; }
    if(mat.bumpMap && !mat.userData._bmp){ mat.userData._bmp=1; mat.bumpScale*=(mat.bumpMap===SKIN_N?0.22:0.35); }   // sima árnyalásnál a régi dombortérkép "filcesen" zajos volt
    if(mat.transparent) return;
    if(!mat.userData._rim){ mat.userData._rim=true; if(own.has(mat)) mat.userData.flashU={value:0};
      mat.onBeforeCompile=trollRimCompile; mat.customProgramCacheKey=_rimKey; mat.needsUpdate=true; }
    if(mat.userData.flashU && flash.indexOf(mat.userData.flashU)<0) flash.push(mat.userData.flashU); });
  m._flashU=flash; m._flashV=0;
}
function setTrollFlash(m,v){ if(!m._flashU || m._flashV===v) return; m._flashV=v; for(let i=0;i<m._flashU.length;i++) m._flashU[i].value=v; }
// SHADER-HORGONYOK: a troll-anyagok mind a 7 lehetséges program-variánsa ([térkép, dombor, csúcs-szín, kétoldalas]) egy rejtett hálón él.
// A trollok genomja véletlen -> a 7 bemelegítő próbabábu NEM fed le minden kombinációt (mérve: játék közben fordult le a hiányzó variáns, akadással).
// Így a warmup biztosan lefordítja mindet, és a programok sosem szabadulnak fel. Rajzolási költség: 0 (a csoport láthatatlan).
(function(){ const g=new THREE.Group(), geo=new THREE.BufferGeometry(); g.visible=false;
  geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(9),3)); geo.setAttribute('color',new THREE.BufferAttribute(new Float32Array(9),3));   // szín-attribútum kell: a csúcs-színes variáns kulcsa a geometriától is függ
  // ugyanez SKINNELT változatban is: a trollok összevont hálói (batchTrollMeshes) skinnelt programot használnak
  const sgeo=geo.clone(), bone=new THREE.Object3D(); g.add(bone);
  sgeo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Uint16Array(12),4));
  sgeo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(new Float32Array([1,0,0,0,1,0,0,0,1,0,0,0]),4));
  const skel=new THREE.Skeleton([bone]);
  for(const c of [[0,1,1,0],[1,1,1,0],[0,0,0,0],[0,0,1,0],[0,1,0,0],[1,1,0,0],[0,0,0,1]]){
    const mat=new THREE.MeshStandardMaterial({roughness:0.9,metalness:0,map:c[0]?MOSS_T:null,bumpMap:c[1]?(c[0]?MOSS_T:SKIN_N):null,vertexColors:!!c[2],side:c[3]?THREE.DoubleSide:THREE.FrontSide});
    mat.userData._rim=true; mat.onBeforeCompile=trollRimCompile; mat.customProgramCacheKey=_rimKey; g.add(new THREE.Mesh(geo,mat));
    const smat=mat.clone(); smat.skinning=true; smat.onBeforeCompile=trollRimCompile; smat.customProgramCacheKey=_rimKey;
    const sm=new THREE.SkinnedMesh(sgeo,smat); sm.castShadow=true; g.add(sm); sm.bind(skel); }   // castShadow: a skinnelt árnyék-mélység program is bemelegedjen (a próbabábuk az árnyék-kamerán kívül állnak)
  scene.add(g); })();

/* --- lebegő sebzés-számok (DOM-pool; világ-pozícióhoz kötve, minden frame-ben újravetítve) --- */
const DN_MAX=26, dnPool=[]; let dnLayer=null, dnOn=true;
(function(){ dnLayer=document.createElement('div'); dnLayer.id='dmgnums'; document.body.appendChild(dnLayer);
  for(let i=0;i<DN_MAX;i++){ const e=document.createElement('div'); e.className='dn'; dnLayer.appendChild(e); dnPool.push({e, t:0, life:0, p:new THREE.Vector3(), vx:0}); } })();
let _dnI=0; const _dnV=new THREE.Vector3();
function spawnDmgNum(x,y,z,txt,cls){
  if(!dnOn) return; const d=dnPool[_dnI++%DN_MAX]; d.p.set(x+rand(-0.25,0.25),y,z+rand(-0.25,0.25)); d.t=0; d.life=(cls==='pts'||cls==='head'||cls==='crit')?1.1:0.8; d.vx=rand(-26,26);
  d.e.textContent=txt; d.e.className='dn '+(cls||''); d.e.style.display='block'; }
function updateDmgNums(dt){
  const hw=innerWidth*0.5, hh=innerHeight*0.5;
  for(const d of dnPool){ if(d.life<=0) continue; d.t+=dt; const k=d.t/d.life;
    if(k>=1){ d.life=0; d.e.style.display='none'; continue; }
    _dnV.copy(d.p).project(camera);
    if(_dnV.z>1){ d.e.style.opacity='0'; continue; }
    const sx=_dnV.x*hw+hw+d.vx*k, sy=-_dnV.y*hh+hh-(46*easeOutCubic(k)), pop=k<0.14?(0.5+k/0.14*0.8):(1.3-Math.min(1,(k-0.14)/0.2)*0.3);
    d.e.style.transform='translate3d('+sx.toFixed(1)+'px,'+sy.toFixed(1)+'px,0) translate(-50%,-50%) scale('+pop.toFixed(3)+')';
    d.e.style.opacity=(k<0.65?1:1-(k-0.65)/0.35).toFixed(2); }
}
// a troll HP-változását figyeli (ugyanaz a minta, mint az updateHpBar): bármilyen forrás sebzése számot dob
function tickDmgNum(m,dt){
  if(m._dnHp==null){ m._dnHp=m.hp; m._dnAcc=0; m._dnT=0; return; }
  const d=m._dnHp-m.hp; m._dnHp=m.hp;
  if(d>0.01) m._dnAcc+=d;
  m._dnT-=dt;
  if(m._dnAcc>=1 && (m._dnT<=0 || m._dnAcc>=6 || !m.alive)){
    const p=m.g.position, big=m._dnHead||m._dnCrit;
    spawnDmgNum(p.x, p.y+(m.headCY||1.8)+0.25, p.z, String(Math.round(m._dnAcc)), m._dnHead?'head':(m._dnCrit?'crit':(m._dnAcc<6&&m.statusEl?('el-'+m.statusEl):'')));
    m._dnAcc=0; m._dnT=big?0:0.28; m._dnHead=false; m._dnCrit=false; }
}
// előbújás a barlangból: por-gomoly + rögök + rövid földgyűrű (a troll a sötétből "kitör")
// porfelhő a troll lábánál (Blender flipbook, 15-fire-burst.js): kibújás a barlangból, földet érés halálkor
function trollDust(m, k){ const p=m.g.position; DUSTPOOF.spawn(p.x, GROUND_Y, p.z, 2.6*(m.scale||1)*(k||1)); }
function trollSpawnFx(m){
  const p=m.g.position, s=m.scale||1;
  trollDust(m, 1.5);
  for(let i=0;i<3;i++) SMK.spawn(p.x+rand(-0.6,0.6)*s,GROUND_Y+rand(0.2,1.2)*s,p.z+rand(-0.6,0.6)*s, rand(-0.8,0.8),rand(0.4,1.3),rand(-0.8,0.8), pick([0x2a3038,0x39404a,0x1f242b]), 0.7*s,2.0*s, rand(0.7,1.2), -0.3,1.2, 0.5);
  VFX.debris(p.x,GROUND_Y+0.15,p.z,10,[0x8a795c,0x6f7a5a,0x5a4c3a],4.5*Math.min(1.5,s),{up:0.3,lift:2,life:0.7,grav:13,w:0.06*Math.min(1.5,s)});   // felrúgott föld- és kőrögök
  EFX.ring(p.x,GROUND_Y+0.05,p.z,0x8fa0b8,0.3,2.1*s,0.4,0.45);
}
// halál: felszálló lélek-szikrák a troll elem-/szem-színében + lebegő pont-felirat
function trollDeathFx(m, pts, headshot){
  const p=m.g.position, cy=p.y+(m.bodyCY||1), col=(m.el&&EL[m.el])?EL[m.el].fx:0x8fe0c0;
  const n=(gfxTier==='low')?5:11;
  if(m.deathStyle==='sink') trollDust(m, 0.9);   // a földbe süllyedő troll azonnal port ver (a dőlő/rogyó trollok a földet éréskor: 25-main-loop deathThud)
  for(let i=0;i<n;i++) RP.spawn(p.x+rand(-0.45,0.45),cy+rand(-0.3,0.5),p.z+rand(-0.45,0.45), rand(-0.35,0.35),rand(1.1,2.6),rand(-0.35,0.35), i%3?col:0xffffff, rand(0.14,0.28),0.02, rand(0.9,1.6), -0.6,0.9, 0.9);
  for(let i=0;i<(n>>1);i++) VFX.streak(p.x+rand(-0.4,0.4),cy+rand(-0.2,0.4),p.z+rand(-0.4,0.4),rand(-0.3,0.3),rand(2.2,4.2),rand(-0.3,0.3),col,rand(0.5,0.9),-0.5,0.6,0.014,0.09);   // felszálló lélek-csíkok
  if(pts>0) spawnDmgNum(p.x, p.y+(m.headCY||1.8)+0.7, p.z, '+'+pts, 'pts');
}
function attachHpBar(m){
  const grp = new THREE.Group();
  // a fej fölé; a troll saját skálájától FÜGGETLEN világ-méret: a csoportot 1/scale-lel ellen-skálázzuk
  grp.position.set(0, (m.headCY/m.scale) + 0.60, 0);
  grp.scale.setScalar(1/Math.max(0.3, m.scale));
  const bg = new THREE.Mesh(HPBAR_GEO, HPMAT_BG);
  bg.position.set(-HPBAR_W/2, 0, 0); bg.scale.set(HPBAR_W, 1.34, 1); bg.renderOrder = 998;
  const fill = new THREE.Mesh(HPBAR_GEO, HPMAT_HI);
  fill.position.set(-HPBAR_W/2, 0, 0.001); fill.scale.set(HPBAR_W, 1, 1); fill.renderOrder = 999;
  grp.add(bg); grp.add(fill); grp.visible = false;
  m.g.add(grp);
  m.hpbar = grp; m.hpbarFill = fill; m._hpBucket = 0; m.hpShow = 0; m._hpPrev = m.maxHp;
}
function updateHpBar(m, dt){
  const grp = m.hpbar; if(!grp) return;
  if(m.hp < m._hpPrev) m.hpShow = HPBAR_LINGER;     // sebzést kapott (bármilyen forrásból) -> mutasd
  m._hpPrev = m.hp;
  if(m.hpShow > 0) m.hpShow -= dt;
  const show = m.hpShow > 0 && m.hp > 0;
  grp.visible = show;
  if(!show) return;
  const frac = Math.max(0, Math.min(1, m.hp / (m.maxHp||1)));
  m.hpbarFill.scale.x = HPBAR_W * frac;              // bal-horgonyzott zsugorodás
  const b = frac > 0.55 ? 0 : (frac > 0.28 ? 1 : 2);
  if(b !== m._hpBucket){ m.hpbarFill.material = (b===0?HPMAT_HI:b===1?HPMAT_MID:HPMAT_LO); m._hpBucket = b; }
  _hpQ.copy(m.g.quaternion).invert(); grp.quaternion.copy(_hpQ).multiply(camera.quaternion);  // billboard: szülő-yaw kiütése
}
/* Kúposodó 2-szegmensű végtag EGY merged geometriában: felkar/comb + könyök/térd-dudor +
   alkar/lábszár + mitt-kéz (tenyér+hüvelyk+bütykök) vagy boka+lábfej-ék.
   A Group-origótól negatív Y-ban lóg (pivot változatlan), gradTint a föld felé sötétedve.
   A vertex-szín fehér körüli -> bodySkin element-átszínezésével jól komponál. */
function limbGeo(o){
  const mir=o.mirror?-1:1, tint=o.tint||[0xffffff,0x86987f];
  const parts=[
    {geo:jitter(new THREE.CylinderGeometry(o.upR0,o.upR1,o.upLen,7,2),0.012,0.008), y:-o.upLen/2},
    {geo:new THREE.IcosahedronGeometry(Math.max(o.upR1,o.loR0)*1.18,0), y:-o.upLen, z:o.bend*0.5},
    {geo:jitter(new THREE.CylinderGeometry(o.loR0,o.loR1,o.loLen,7,2),0.010,0.008), y:-o.upLen-o.loLen/2, z:o.bend, rx:o.bend*0.6}
  ];
  const y2=-o.upLen-o.loLen;
  if(o.hand==='mitt'){
    parts.push({geo:jitter(new THREE.IcosahedronGeometry(0.16,0),0.02,0.02), y:y2-0.07, z:o.bend+0.04, sx:1.05,sy:0.8,sz:1.3});   // tenyér
    parts.push({geo:new THREE.SphereGeometry(0.055,6,5), x:mir*0.13, y:y2-0.03, z:o.bend+0.10});                                   // hüvelyk
    for(let i=-1;i<=1;i++) parts.push({geo:new THREE.SphereGeometry(0.05,5,4), x:i*0.07, y:y2-0.16, z:o.bend+0.13});               // bütykök
  } else if(o.hand==='foot'){
    parts.push({geo:new THREE.CylinderGeometry(0.12,0.14,0.10,7), y:y2+0.03, z:o.bend});                                           // boka
    parts.push({geo:jitter(new THREE.IcosahedronGeometry(0.16,0),0.02,0.02), y:y2-0.04, z:o.bend+0.10, sx:1.25,sy:0.55,sz:1.6});   // lábfej-ék
  }
  return gradTint(mergeGeos(parts), tint[1], tint[0], y2-0.24, 0.06);
}
/* ===================== PROCEDURÁLIS TROLL-GENERÁTOR bekötés =====================
   A TrollGen (beágyazva a <head>-ben) a MEGJELENÉST adja; a gameplay (TROLL_TYPES:
   hp/speed/dmg szorzók, resist, AI-ágak a typeId szerint) VÁLTOZATLAN.
   Kapcsoló: USE_TROLLGEN=false -> azonnal vissza a régi kézi rigre (makeMonsterLegacy).
   Seed: SP-ben sorsolt, co-opban a szervertől jön -> minden kliens UGYANAZT a trollt építi. */
var USE_TROLLGEN = true;
function makeMonster(type, scale, hp, speed, el, seed){
  if(!(USE_TROLLGEN && window.TrollGen)) return makeMonsterLegacy(type, scale, hp, speed, el);
  try { return makeMonsterGen(type, scale, hp, speed, el, seed); }
  catch(e){ console.warn('[TrollGen] build hiba -> legacy rig:', e && e.message); return makeMonsterLegacy(type, scale, hp, speed, el); }
}
const TROLL_BLOB_GEO=new THREE.CircleGeometry(1,20).rotateX(-Math.PI/2);
const TROLL_BLOB_MAT=new THREE.MeshBasicMaterial({map:GLOW,color:0x020508,transparent:true,opacity:0.55,depthWrite:false,fog:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
function makeMonsterGen(type, scale, hp, speed, el, seed){
  let T;
  if(typeof type==='string' && TROLL_TYPES[type]) T=TROLL_TYPES[type];
  else { speed=hp; hp=scale; scale=type; T=TROLL_TYPES.grunt; }
  const sd = (seed==null) ? ((Math.random()*0xffffffff)>>>0) : (seed>>>0);
  const G   = TrollGen.describe(sd, { caste:T.id, el:(el!==undefined?el:(T.el||null)), tier:'normal' });
  const gen = withHiResGeo(()=>TrollGen.build(G));   // AA-indie: részletesebb, lekerekített troll-geometria
  const g   = gen.g;
  g.scale.setScalar(scale);                       // a hullám-skálázás a genom-méret FÖLÉ jön (gameplay-méret)
  scene.add(g);

  const m={ g, legs:gen.legs, arms:gen.arms, head:gen.head, torso:gen.torso, eyes:gen.eyes||[],
    eyeMat:gen.eyeMat, bodySkin:gen.bodySkin, hp, maxHp:hp, speed, walkPhase:Math.random()*6.28,
    alive:true, dying:0, atkCd:0.6, hurtFlash:0, scale,
    atkPhase:0, atkT:0, atkDur:0, atkHit:false, atkKind:null, lungeBase:null,
    // TALÁLAT-GÖMBÖK: a gen.bodyR/bodyCY MÁR tartalmazza a genom-skálát, a g.scale-t viszont a gameplay-skálára ÍRJUK FELÜL
    // -> a genom-skálával normalizálni KELL, különben a gömb duplán skálázódik (a szilánké a látható troll harmada volt: a nyíl átment rajta).
    bodyR:((gen.bodyR||0.85)/(gen.scale||1))*scale, bodyCY:((gen.bodyCY||1.1)/(gen.scale||1))*scale,
    headCY:((gen.headCY||1.95)/(gen.scale||1))*scale, headR:((gen.headR||0.42)/(gen.scale||1))*scale,
    type:T, typeId:T.id, threat:T.threat, dmgMul:T.dmgMul||1,
    dashCd:0, dashTimer:0, healTimer:0, rangedTimer:0, rooted:0,
    statusEl:null, statusT:0, slowMul:1, burnAcc:0, _eyeBase:null,
    statusStacks:1, wet:0, charged:0, frozenSolid:0, chill:0, lastReactT:-999, lastInnateReactT:-999, _fireSpreadT:0, resist:(T.resist||null),
    knees:gen.knees, ankles:gen.ankles, elbows:gen.elbows, fists:gen.fists, jaw:gen.jaw, pelvis:gen.pelvis, torsoIn:gen.torsoIn,
    genome:G, gen, seed:sd };
  // ---- per-típus HOOK-ok: a játék AI-ja ezeket `if(m.X)` őrrel olvassa, így ami hiányzik, az csak kimarad ----
  if(gen.weapon){
    m._club = gen.weapon;                                        // grunt/brute csukló-billentés handle (a fegyver a fists-en ül)
    m._weaponRest=gen.weapon.rotation.clone();
    if(gen.weapon.userData && gen.weapon.userData.crystal) m.staffCrystal = gen.weapon.userData.crystal;   // SÁMÁN: nyaláb/varázslat kiindulópont + pulzus
  }
  if(T.id==='shaman'){ m.healTimer=rand(1.5,3.0); m.auraPulse=0; m.castTimer=rand(1.2,2.6); m.casting=0; m.beaming=false; m.beamAcc=0; }   // sámán AI-óra (a régi T.build állította)
  if(T.id==='spitter'){ m.rangedTimer=rand(0.8,2.0); }
  m.el = (el!==undefined) ? el : (T.el||null);                   // a TrollGen már beépítette az elem-vizuált (tint+aura) a genomból
  // FEJLÖVÉS-GÖMB a VALÓDI fejhez: a genom bodyCY/headCY becslése a kis kasztoknál (scout/shard) elcsúszott,
  // ezért a fej tényleges világ-magasságából számolunk (a legacy rig is így tett).
  try{ g.updateMatrixWorld(true);
    const _hp=new THREE.Vector3(); gen.head.getWorldPosition(_hp);
    const _hb=new THREE.Box3().setFromObject(gen.head);
    m.headCY = _hp.y - g.position.y;                                  // fej-közép a troll gyökeréhez képest (világ-skálán)
    m.headR  = Math.max(0.22, Math.min((_hb.max.y-_hb.min.y), (_hb.max.x-_hb.min.x))*0.45);
  }catch(_e){}
  // FPS: csak a sziluett vessen árnyékot
  g.traverse(o=>{ if(o.isMesh) o.castShadow=false; });
  if(gfxTier==='high') [gen.torso, gen.head, gen.legs&&gen.legs.L, gen.legs&&gen.legs.R, gen.arms&&gen.arms.L, gen.arms&&gen.arms.R]
    .forEach(p=>{ if(p) p.traverse(o=>{ if(o.isMesh) o.castShadow=true; }); });
  { const blob=new THREE.Mesh(TROLL_BLOB_GEO, TROLL_BLOB_MAT); blob.position.y=0.03; blob.scale.setScalar(Math.max(0.6,(gen.bodyR||0.8)/(gen.scale||1)*1.25)); blob.layers.set(NOBLOOM_LAYER); blob.renderOrder=-1; g.add(blob); }   // puha talp-árnyék (minden fokozaton; olcsó)
  attachHpBar(m);
  try{ applyTrollRim(m); }catch(_e){}   // LÁTVÁNY-TURBÓ: rim-fény + találat-villanás uniformok
  try{ batchTrollMeshes(m); }catch(e){ console.warn('[troll batch] kimarad:', e && e.message); }   // FPS: ~100 -> ~25 rajzolási hívás / troll
  return m;
}
/* FPS — DRAW-CALL ÖSSZEVONÁS (merev "skinneléssel"). Egy generált troll ~80-110 külön hálóból állt; mindegyik külön rajzolási
   hívás a fő-, a bloom- és az árnyék-passban (15 trollnál ~1300 háló: a képkocka CPU-idejének nagyja uniform-feltöltés volt).
   Itt a troll NEM animált levél-hálóit anyagonként EGY SkinnedMesh-sé fűzzük: minden csúcs 1.0 súllyal a saját ízületéhez
   (a régi szülőjéhez) kötődik, az ízületek a csontok. Így a mozgás pontosan ugyanaz, mint eddig (az ízületek ugyanúgy forognak),
   csak trollonként ~10 rajzolási hívással.
   Érintetlen marad: minden ízület és minden objektum, amire az m / m.gen mezői hivatkoznak (fej, törzs, áll, végtagok, ököl,
   fegyver, szemek, HP-csík...), valamint az az anyag, amelyet egy külön maradó háló is használ.
   r128: egy anyag NEM lehet egyszerre skinnelt és sima hálón (anyagonként egy program él) -> a megosztott könyvtár-anyagokat
   trollonként klónozzuk; a saját (m.gen._mats) anyagokat csak akkor skinneljük, ha a troll MINDEN ilyen hálója összevonható. */
const _TB_MAPS=['map','bumpMap','normalMap','roughnessMap','metalnessMap','emissiveMap','alphaMap','aoMap','lightMap','displacementMap'];
const _tbInvRoot=new THREE.Matrix4(), _tbM=new THREE.Matrix4();
function _tbSkinMat(src, own, m){
  if(own) { src.skinning=true; return src; }
  const c=src.clone(); c.skinning=true;
  if(src.onBeforeCompile) c.onBeforeCompile=src.onBeforeCompile;
  if(src.customProgramCacheKey) c.customProgramCacheKey=src.customProgramCacheKey;
  c.userData=src.userData;   // azonos (rim-)beállítás; villanás-uniformot csak a saját anyagok hordoznak
  (m._batchMats||(m._batchMats=[])).push(c);
  return c;
}
function _tbAttrs(mat){   // a merged geometriának ezek az attribútumai kellenek (a többit az anyag nem olvassa)
  const n=['position'];
  if(!mat.isMeshBasicMaterial) n.push('normal');
  if(mat.vertexColors) n.push('color');
  if(_TB_MAPS.some(k=>mat[k])) n.push('uv');
  return n;
}
function batchTrollMeshes(m){
  // csont-textúra nélkül (régi mobil GPU) ~100 csont nem férne el a vertex-uniformokban -> ott marad a régi, háló-per-rész rajzolás
  if(!renderer.capabilities.floatVertexTextures) return;
  if(window.__noTrollBatch && location.hash.indexOf('dev')>=0) return;   // fejlesztői A/B-mérés: #dev + window.__noTrollBatch=true -> régi rajzolás
  // ownMats: anyagok, amikre a troll mezői hivatkoznak (bodySkin: elem-tint, villanás...) + a generátor saját anyagai —
  // trollonkéntiek, ezért helyben skinneljük őket (klón esetén egy későbbi módosítás nem érné el az összevont hálót)
  const ownMats=new Set((m.gen&&m.gen._mats)||[]);
  const collect=(v,d)=>{
    if(!v || typeof v!=='object' || d>4 || v.isObject3D || v.isBufferGeometry || v.isTexture) return;
    if(v.isMaterial){ ownMats.add(v); return; }
    if(Array.isArray(v)){ for(const x of v) collect(x,d+1); return; }
    for(const k in v) collect(v[k],d+1);
  };
  for(const k in m) if(k!=='g' && k!=='type' && k!=='genome') collect(m[k],0);
  if(m.gen) for(const k in m.gen) if(k!=='g' && k!=='genome') collect(m.gen[k],0);
  const skip=new Set(); if(m.hpbar) m.hpbar.traverse(o=>skip.add(o));
  const groups=new Map(), defaultOBR=THREE.Object3D.prototype.onBeforeRender, matUse=new Map(), matOk=new Map();
  m.g.updateMatrixWorld(true);
  m.g.traverse(o=>{
    if(!o.isMesh) return;
    const mat=o.material; matUse.set(mat,(matUse.get(mat)||0)+1);
    if(skip.has(o) || o.isSkinnedMesh || o.isInstancedMesh || !mat || Array.isArray(mat) || mat.skinning || mat.transparent) return;
    if(!(mat.isMeshStandardMaterial || mat.isMeshBasicMaterial || mat.isMeshLambertMaterial || mat.isMeshPhongMaterial)) return;
    const geo=o.geometry;   // (egy anyagnál a geometry.groups nem számít: a three az egészet rajzolja)
    if(!geo || !geo.isBufferGeometry || !geo.attributes.position || o.onBeforeRender!==defaultOBR || (o.layers.mask & ~3)) return;
    if(geo.morphAttributes && Object.keys(geo.morphAttributes).length) return;
    if(Object.values(geo.attributes).some(a=>a.isInterleavedBufferAttribute)) return;
    for(let p=o; p && p!==m.g; p=p.parent) if(!p.visible) return;   // rejtett rész (pl. a lidérc lába) marad, ahogy van
    const key=mat.uuid+'|'+o.castShadow+'|'+o.receiveShadow+'|'+o.renderOrder+'|'+o.layers.mask;
    let gr=groups.get(key); if(!gr) groups.set(key, gr={mat, list:[]});
    gr.list.push(o); matOk.set(mat,(matOk.get(mat)||0)+1);
  });
  // saját anyag csak akkor skinnelhető helyben, ha a troll MINDEN ilyen anyagú hálója összevonható (különben a külön maradó
  // sima háló is skinnelt programmal rajzolódna — r128-ban anyagonként egy program él)
  const merge=[...groups.values()].filter(gr=>(gr.list.length>=2 || matOk.get(gr.mat)>=2) && (!ownMats.has(gr.mat) || matUse.get(gr.mat)===matOk.get(gr.mat)));
  if(!merge.length) return;
  // CSONTOK = maguk az eredeti hálók: a jelenet-gráfban maradnak (animáció, hivatkozások, beálló nyilak változatlanok),
  // csak a rétegüket kapcsoljuk le, így egyik pass (fő, bloom, árnyék) sem rajzolja őket külön
  const bones=[], boneIdx=new Map();
  for(const gr of merge) for(const o of gr.list){ boneIdx.set(o, bones.length); bones.push(o); }
  const skeleton=new THREE.Skeleton(bones);   // inverzek a MOSTANI (építéskori) pózból
  _tbInvRoot.copy(m.g.matrixWorld).invert();
  const skinMats=new Map();
  let merged=0;
  for(const gr of merge){
    const geo=_tbMerge(gr.list, _tbAttrs(gr.mat), boneIdx);
    if(!skinMats.has(gr.mat)) skinMats.set(gr.mat, _tbSkinMat(gr.mat, ownMats.has(gr.mat), m));
    const sm=new THREE.SkinnedMesh(geo, skinMats.get(gr.mat));
    const first=gr.list[0];
    sm.castShadow=first.castShadow; sm.receiveShadow=first.receiveShadow; sm.renderOrder=first.renderOrder; sm.layers.mask=first.layers.mask;
    sm.userData._trollBatch=gr.list.length;
    m.g.add(sm); sm.bind(skeleton);   // bindMatrix = a troll gyökere (az sm identitásként ül rajta)
    for(const o of gr.list){ o.layers.disableAll(); merged++; }
  }
  m._skeleton=skeleton; m._batched=merged;
}
const _tbN=new THREE.Matrix3();
function _tbMerge(meshes, names, boneIdx){
  // Indexelt Float32 kimenet, közvetlen tömb-matekkal (a spawn-költség miatt: ez minden troll építésekor lefut).
  // A hiányzó attribútum alapértéket kap (szín: fehér, uv: 0, normál: számolt), így eltérő felépítésű részek is egy hálóba férnek.
  const wantN=names.indexOf('normal')>=0, wantC=names.indexOf('color')>=0, wantU=names.indexOf('uv')>=0;
  let vTot=0, iTot=0;
  const geos=meshes.map(o=>{ let g=o.geometry;
    if(wantN && !g.attributes.normal){ g=g.clone(); g.computeVertexNormals(); }
    vTot+=g.attributes.position.count; iTot+=g.index?g.index.count:g.attributes.position.count; return g; });
  const P=new Float32Array(vTot*3), Nn=wantN?new Float32Array(vTot*3):null, C=wantC?new Float32Array(vTot*3):null, U=wantU?new Float32Array(vTot*2):null;
  const SI=new Uint16Array(vTot*4), SW=new Float32Array(vTot*4), I=new (vTot>65535?Uint32Array:Uint16Array)(iTot);
  let vo=0, io=0;
  for(let mi=0;mi<meshes.length;mi++){
    const o=meshes[mi], g=geos[mi], pa=g.attributes.position, n=pa.count, b=boneIdx.get(o);
    _tbM.multiplyMatrices(_tbInvRoot, o.matrixWorld);   // a háló csúcsai a troll-gyökér terébe (építéskori póz)
    const e=_tbM.elements, flip=_tbM.determinant()<0;   // tükrözött rész: a háromszög-körüljárást is meg kell fordítani
    for(let k=0;k<n;k++){ const x=pa.getX(k), y=pa.getY(k), z=pa.getZ(k), d=(vo+k)*3;
      P[d]=e[0]*x+e[4]*y+e[8]*z+e[12]; P[d+1]=e[1]*x+e[5]*y+e[9]*z+e[13]; P[d+2]=e[2]*x+e[6]*y+e[10]*z+e[14]; }
    if(wantN){ _tbN.getNormalMatrix(_tbM); const q=_tbN.elements, na=g.attributes.normal;
      for(let k=0;k<n;k++){ const x=na.getX(k), y=na.getY(k), z=na.getZ(k), d=(vo+k)*3;
        let nx=q[0]*x+q[3]*y+q[6]*z, ny=q[1]*x+q[4]*y+q[7]*z, nz=q[2]*x+q[5]*y+q[8]*z; const l=Math.hypot(nx,ny,nz)||1;
        Nn[d]=nx/l; Nn[d+1]=ny/l; Nn[d+2]=nz/l; } }
    if(wantC){ const ca=g.attributes.color;
      if(ca) for(let k=0;k<n;k++){ const d=(vo+k)*3; C[d]=ca.getX(k); C[d+1]=ca.getY(k); C[d+2]=ca.getZ(k); }
      else C.fill(1,vo*3,(vo+n)*3); }
    if(wantU){ const ua=g.attributes.uv; if(ua) for(let k=0;k<n;k++){ const d=(vo+k)*2; U[d]=ua.getX(k); U[d+1]=ua.getY(k); } }
    for(let k=0;k<n;k++){ SI[(vo+k)*4]=b; SW[(vo+k)*4]=1; }
    if(g.index){ const ia=g.index.array, ic=ia.length; for(let k=0;k<ic;k++) I[io+k]=ia[k]+vo;
      if(flip) for(let k=0;k+2<ic;k+=3){ const t=I[io+k+1]; I[io+k+1]=I[io+k+2]; I[io+k+2]=t; } io+=ic; }
    else { for(let k=0;k<n;k+=3){ I[io+k]=vo+k; I[io+k+1]=vo+k+(flip?2:1); I[io+k+2]=vo+k+(flip?1:2); } io+=n; }
    vo+=n;
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P,3));
  if(wantN) geo.setAttribute('normal', new THREE.BufferAttribute(Nn,3));
  if(wantC) geo.setAttribute('color', new THREE.BufferAttribute(C,3));
  if(wantU) geo.setAttribute('uv', new THREE.BufferAttribute(U,2));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI,4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW,4));
  geo.setIndex(new THREE.BufferAttribute(I,1));
  geo.userData._tsm=1;   // a normálok már simítva (applyTrollRim)
  geo.computeBoundingSphere();
  geo.boundingSphere.radius*=1.35;   // a végtagok mozognak: a nyugalmi gömb köré tartalék, hogy a frustum-culling ne vágja le
  return geo;
}
function makeMonsterLegacy(type, scale, hp, speed, el){
  let T;
  if(typeof type==='string' && TROLL_TYPES[type]) T=TROLL_TYPES[type];
  else { speed=hp; hp=scale; scale=type; T=TROLL_TYPES.grunt; }

  const g=new THREE.Group(); g.scale.setScalar(scale);

  /* per-monster cloned materials (disposed in disposeMonster) */
  const bodySkin = std({color:(T.skin!==undefined)?T.skin:0x6b9c6e, bumpMap:SKIN_N, bumpScale:0.018, vertexColors:true});
  // vertexColors:true -> minden bodySkin-es mesh színattribútumot igényel; a build végi biztonsági pass fehérrel pótolja
  const myEye = eyeMat.clone();
  if(T.eyeColor!==undefined) myEye.emissive=new THREE.Color(T.eyeColor);
  const eyeGlowCol = (T.eyeColor!==undefined) ? T.eyeColor : 0xff7a3d;

  /* per-type silhouette levers (read from TROLL_TYPES; safe defaults) */
  const postureLean = (T.postureLean!==undefined) ? T.postureLean : 0.0;   // forward spine lean (rad)
  const shoulderW   = (T.shoulderW   !==undefined) ? T.shoulderW   : 1.0;   // arm-spread mult
  const torsoW      = (T.torsoW      !==undefined) ? T.torsoW      : 1.0;   // belly width mult
  const neckLen     = (T.neckLen     !==undefined) ? T.neckLen     : 0.0;   // raises head group
  const tuskScale   = (T.tuskScale   !==undefined) ? T.tuskScale   : 1.0;
  const earLen      = (T.earLen      !==undefined) ? T.earLen      : 0.34;
  const noTusks     = !!T.noTusks;

  /* ---------- LEGS (hips y0.62, rotate.x for walk) ---------- */
  /* comb+térd+lábszár+boka+lábfej EGY merged mesh-ben (limbGeo) + karom-ujjak */
  const legs={};
  [-1,1].forEach(s=>{
    const leg=new THREE.Group(); leg.position.set(s*0.22*torsoW, 0.62, 0);
    leg.add(mesh(limbGeo({upLen:0.34,upR0:0.21,upR1:0.16,loLen:0.26,loR0:0.15,loR1:0.115,bend:0.045,hand:'foot'}), bodySkin, 0,0,0));
    const toes=[]; [-1,0,1].forEach(i=> toes.push({geo:new THREE.ConeGeometry(0.05,0.14,5), x:i*0.085, y:-0.60, z:0.28, rx:1.2}));
    leg.add(mesh(mergeGeos(toes), tuskMat, 0,0,0));   // 3 előre néző karom a lábfej-ék orrán
    leg.add(mesh(jitter(new THREE.IcosahedronGeometry(0.13,0),0.03,0.03), mossMat, s*0.05,-0.10,-0.10)); // mossy knee clump
    g.add(leg); legs[s<0?'L':'R']=leg;
  });

  /* ---------- TORSO (belly + chest + mossy back) ---------- */
  const torso=new THREE.Group(); torso.rotation.x=postureLean; g.add(torso);
  // big rounded belly — icosa finom jitterrel; hát/has kéttónus (hát hűvös-sötét, has világos)
  const bellyGeo=jitter(new THREE.IcosahedronGeometry(0.6,1),0.025,0.02);
  gradTint(bellyGeo, 0x90a48f, 0xffffff, -0.62, 0.62, 1.0, 'z');
  mottleTint(bellyGeo, [0xffffff,0xe4eede,0xd2e2cc,0xf2f6ea], 0.35);   // szerves bőr-foltok a lapokon
  torso.add(mesh(bellyGeo, bodySkin, 0,1.05,0, 1.0*torsoW,0.95,0.85));
  // pale under-belly / chest plate (family belly motif) — krém hotspot a közepén
  const plateGeo=radialTint(new THREE.SphereGeometry(0.44,11,8), 0xffffff, 0xcfc6ae, 0.5);
  torso.add(mesh(plateGeo, bellyMat, 0,0.96,0.30, 1.0*torsoW,0.9,0.6));
  // upper chest / trapezius — felfelé-hátra húzott púp (görnyedt sziluett)
  const chestGeo=jitter(new THREE.IcosahedronGeometry(0.46,1),0.03,0.02);
  gradTint(chestGeo, 0x8d9f8c, 0xffffff, -0.5, 0.5, 1.0, 'z');
  mottleTint(chestGeo, [0xffffff,0xe4eede,0xd2e2cc], 0.4);
  torso.add(mesh(chestGeo, bodySkin, 0,1.46,-0.06, 1.08*shoulderW,0.82,0.85));
  // collar / throat
  torso.add(mesh(new THREE.CylinderGeometry(0.17,0.24,0.18,8), bodySkin, 0,1.74+neckLen*0.5,0.0));
  // MOSS crust on back + shoulders — EGY merge-elt mesh az 5 külön dodeka helyett
  const mossCrust=[[0.40,1.42,-0.16,0.24],[-0.40,1.36,-0.18,0.22],[0,1.02,-0.42,0.26],[0.22,1.66,-0.20,0.16],[-0.20,1.60,-0.22,0.15]]
    .map(p=>({geo:gradTint(jitter(new THREE.IcosahedronGeometry(p[3],0),p[3]*0.25,p[3]*0.2),0x7e9276,0xffffff,-p[3],p[3]), x:p[0],y:p[1],z:p[2], sy:0.7}));
  torso.add(mesh(mergeGeos(mossCrust), mossMatV, 0,0,0));

  /* ---------- ARMS (shoulders y1.5, rotate.x walk/attack, rotate.z death) ---------- */
  const arms={};
  /* felkar+könyök+alkar+mitt-kéz EGY merged mesh-ben; a volt skinDark ököl sötétebb vertex-szín */
  [-1,1].forEach(s=>{
    const arm=new THREE.Group(); arm.position.set(s*0.5*shoulderW, 1.5, 0);
    arm.add(mesh(limbGeo({upLen:0.42,upR0:0.15,upR1:0.12,loLen:0.34,loR0:0.13,loR1:0.10,bend:0.05,hand:'mitt',mirror:s<0,tint:[0xffffff,0x7d8f7d]}), bodySkin, 0,0,0));
    arm.add(mesh(jitter(new THREE.IcosahedronGeometry(0.11,0),0.03,0.03), mossMat, 0,-0.02,-0.04));   // mossy shoulder cap
    arm.rotation.x=0.5; g.add(arm); arms[s<0?'L':'R']=arm;
  });

  /* ---------- HEAD (group at y1.95, +neckLen) ---------- */
  const head=new THREE.Group(); head.position.set(0, 1.95+neckLen, 0.05); g.add(head);
  // cranium — icosa a sima UV-gömb helyett (faceted, de a tömeg marad ~r0.38 -> headR hiteles)
  head.add(mesh(jitter(new THREE.IcosahedronGeometry(0.38,1),0.02,0.018), bodySkin, 0,0,0, 1,0.92,1));
  // mossy scalp cap (kisebb, feljebb — nem nyeli el a homlokot)
  head.add(mesh(new THREE.SphereGeometry(0.28,9,7), mossMat, 0,0.20,-0.10, 1.15,0.6,1.0));
  // heavy brow ridge — szögletes bőr-párkány, ami tényleg beárnyékolja a szemeket
  { const brow=mesh(jitter(new THREE.BoxGeometry(0.50,0.11,0.18,2,1,1),0.03,0.02), bodySkin, 0,0.16,0.21); brow.rotation.x=0.15; head.add(brow); }
  // snout / muzzle — icosa
  head.add(mesh(jitter(new THREE.IcosahedronGeometry(0.18,1),0.015,0.012), bodySkin, 0,-0.06,0.34, 1.1,0.9,1.3));
  // nostrils
  [-1,1].forEach(s=> head.add(mesh(new THREE.SphereGeometry(0.035,6,5), skinDark, s*0.06,-0.02,0.50)));

  /* eyes: cloned-eyeMat spheres (keep `myEye` so frame-902 flash works) + additive glow */
  const eyes=[];
  [-1,1].forEach(s=>{
    const e=mesh(new THREE.SphereGeometry(0.07,8,7), myEye, s*0.15,0.05,0.30); head.add(e); eyes.push(e); enableBloom(e);
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:eyeGlowCol,transparent:true,opacity:0.6,depthWrite:false,blending:THREE.AdditiveBlending}));
    sp.scale.setScalar(0.32); sp.position.set(s*0.15,0.05,0.34); head.add(sp); enableBloom(sp);
  });

  /* lower jaw + tooth row (family teeth motif) — lapított icosa, kissé előretolva */
  head.add(mesh(jitter(new THREE.IcosahedronGeometry(0.16,1),0.012,0.01), bodySkin, 0,-0.21,0.31, 1.2,0.65,1.05)); // jaw
  [-2,-1,0,1,2].forEach(i=>{
    const t=mesh(new THREE.ConeGeometry(0.035,0.10,4), tuskMat, i*0.07,-0.10,0.40); t.rotation.x=Math.PI; head.add(t);
  });
  // up-tusks (scaled per type; scout has none)
  if(!noTusks){
    [-1,1].forEach(s=>{
      const t=mesh(new THREE.ConeGeometry(0.05,0.20*tuskScale,5), tuskMat, s*0.13,-0.10,0.30);
      t.rotation.x=-0.35; t.rotation.z=s*0.12; head.add(t);
    });
  }
  // ears (length is a silhouette lever)
  [-1,1].forEach(s=>{
    const ear=mesh(new THREE.ConeGeometry(0.10,earLen,6), bodySkin, s*0.40,0.06,-0.02);
    ear.rotation.z=-s*1.3; ear.rotation.x=-0.2; head.add(ear);
  });

  g.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
  scene.add(g);

  const m={ g, legs, arms, head, torso, eyes, eyeMat:myEye, bodySkin, hp, maxHp:hp, speed, walkPhase:Math.random()*6.28,
    alive:true, dying:0, atkCd:0.6, hurtFlash:0, scale,
    atkPhase:0, atkT:0, atkDur:0, atkHit:false, atkKind:null, lungeBase:null,   // TÁMADÁS-óra: 3-fázisú attack-clock állapota
    bodyR:0.85*scale, bodyCY:1.1*scale, headCY:1.95*scale, headR:0.42*scale,
    type:T, typeId:T.id, threat:T.threat, dmgMul:T.dmgMul||1,
    dashCd:0, dashTimer:0, healTimer:0, rangedTimer:0, rooted:0,
    statusEl:null, statusT:0, slowMul:1, burnAcc:0, _eyeBase:null,
    statusStacks:1, wet:0, charged:0, frozenSolid:0, chill:0, lastReactT:-999, lastInnateReactT:-999, _fireSpreadT:0, resist:(T.resist||null) };   // ELEM: status + reaction fields
  if(T.build) T.build(m);
  embellishTroll(m);   // REDESIGN: gazdagabb részlet-pass (moha/zuzmó/tüskék/spórák/szőr) minden trollon
  m.el = (el!==undefined) ? el : (T.el||null);   // RANDOM ELEM: spawnonként sorsolt elem (a típustól FÜGGETLEN); co-opban a szervertől jön
  elementSkin(m);      // INNATE ELEM: tint + aura az m.el alapján
  // vertexColors-os bodySkin: minden színattribútum nélküli mesh fehér attribútumot kap (a szorzás semleges eleme)
  g.traverse(o=>{ if(o.isMesh && o.material===bodySkin && !o.geometry.attributes.color){
    const n=o.geometry.attributes.position.count;
    o.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n*3).fill(1),3)); } });
  // FPS: a sok submesh (alaprig + díszítések) közül CSAK a sziluett vessen árnyékot -> 3-4× kevesebb árnyék-mesh
  g.traverse(o=>{ if(o.isMesh) o.castShadow=false; });
  [torso, head, legs.L, legs.R, arms.L, arms.R].forEach(p=>{ if(p) p.traverse(o=>{ if(o.isMesh) o.castShadow=true; }); });
  m.headCY=m.head.position.y*scale; m.headR=0.42*scale*(m.head.scale.x||1); // fejlövés-gömb a valós fejhez
  attachHpBar(m);   // fej fölötti élet-csík (sebzéskor jelenik meg; co-op trolloknak is ingyen jön)
  return m;
}
function disposeMonster(m){
  m.g.traverse(o=>{ if(o.isMesh && o.geometry && o.geometry!==HPBAR_GEO && o.geometry!==TROLL_BLOB_GEO) o.geometry.dispose(); if(o.isSprite && o.material) o.material.dispose(); });
  if(m.eyeMat) m.eyeMat.dispose();
  if(m.bodySkin && m.bodySkin!==skinMat) m.bodySkin.dispose();
  if(m.aura && m.aura.material) m.aura.material.dispose();
  if(m.staffMat) m.staffMat.dispose();
  if(m.spitMat) m.spitMat.dispose();
  if(m.wispFaceMat) m.wispFaceMat.dispose();   // a wisp csont-arc klónja (a wispGlow sprite-okat a g.traverse takarítja)
  if(m._crackMat) m._crackMat.dispose();   // szilánk repedés-anyag (klónozott Mesh-anyag, a sprite-traverzál nem fogja)
  // TROLLGEN: a generátor per-troll anyagai (bodySkin/eyeMat/mossMat + minden own()-olt) — a SHARED TrollGen.M-et SOSEM szabad diszponálni
  if(m.gen && m.gen._mats) m.gen._mats.forEach(x=>{ if(x && x.dispose && x!==m.bodySkin && x!==m.eyeMat) x.dispose(); });
  // összevont (skinnelt) hálók: a csont-textúra és a trollonként klónozott könyvtár-anyagok
  if(m._skeleton){ m._skeleton.dispose(); m._skeleton=null; }
  if(m._batchMats){ m._batchMats.forEach(x=>x.dispose()); m._batchMats=null; }
}

