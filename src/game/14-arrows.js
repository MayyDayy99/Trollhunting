/* ===================== Nyíl-lövedékek (pool) ===================== */
const GRAV=9.2;
const JUMP_V=5.2;
const arrows=[];
const arrowBandMat=std({color:0x2e8fa8, roughness:.6});   // festett jelölő-sáv a tollazat előtt (megosztott — 30 nyíl)
function makeArrow(){
  const g=new THREE.Group();
  const shaft=mesh(new THREE.CylinderGeometry(0.010,0.013,0.82,7), arrowWood,0,0,0); shaft.rotation.x=Math.PI/2; g.add(shaft);   // karcsú, hegy felé enyhén vastagodó vessző
  { const band=mesh(new THREE.CylinderGeometry(0.0135,0.0135,0.05,7), arrowBandMat,0,0,0.30); band.rotation.x=Math.PI/2; g.add(band); }
  // PENGE-FEJ: lapított 4-oldalú kúp (broadhead) + fém nyakgyűrű
  const tip=mesh(new THREE.ConeGeometry(0.052,0.16,4), metalMat.clone(),0,0,-0.46, 1,1,0.30); tip.rotation.x=-Math.PI/2; g.add(tip);  // ELEM: own material clone so the head can be tinted per element
  { const col=mesh(new THREE.CylinderGeometry(0.012,0.015,0.03,7), metalMat,0,0,-0.375); col.rotation.x=Math.PI/2; g.add(col); }
  // 3 valódi toll-lap enyhe spirál-csavarral (a doboz-fletchek helyett)
  [0,1,2].forEach(i=>{ const f=mesh(new THREE.PlaneGeometry(0.11,0.052), featherMat,0,0,0.35);
    f.rotation.y=Math.PI/2; f.rotation.z=i*(Math.PI*2/3); f.rotation.x=0.10; g.add(f); });
  { const nk=mesh(new THREE.CylinderGeometry(0.012,0.009,0.02,7), hornMat,0,0,0.415); nk.rotation.x=Math.PI/2; g.add(nk); }   // szaru-nock a végén
  // ELEM: per-arrow additive glow sprite (color/opacity set by applyArrowVisual)
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xffffff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
  glow.scale.setScalar(0.55); glow.position.set(0,0,-0.42); g.add(glow); enableBloom(glow);
  const elemHolder=new THREE.Group(); elemHolder.position.set(0,0,-0.46); g.add(elemHolder);   // ELEM-PRO: element-head decoration mount (flame/crystal/ooze/spark)
  g.visible=false; g.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
  scene.add(g);
  return { g, tip, glow, elemHolder, flames:null, el:'base', vel:new THREE.Vector3(), prev:new THREE.Vector3(),
           life:0, active:false, stuck:false, dmg:25,
           charge:0, gravK:1, pierceLeft:0, ricochetLeft:0, hitSet:new Set() };   // FEJLESZTÉS: átütés/pattanás/húzás-plafon per-repülés állapot
}
for(let i=0;i<30;i++){ const a=makeArrow(); a.ti=i; arrows.push(a); }   // ti: a nyílhoz tartozó szalag-csóva sorszáma (VFX.trail)
function fireArrow(charge, yawOff){
  const a=arrows.find(x=>!x.active) || arrows[0];
  const fwd=new THREE.Vector3(); camera.getWorldDirection(fwd);
  if(yawOff){ const _c=Math.cos(yawOff), _s=Math.sin(yawOff), _fx=fwd.x, _fz=fwd.z; fwd.x=_fx*_c-_fz*_s; fwd.z=_fx*_s+_fz*_c; fwd.normalize(); }   // FEJLESZTÉS: Megosztott Lövés — vízszintes szórás-szög
  const start=camera.position.clone().addScaledVector(fwd,0.6); start.y-=0.05;
  a.g.position.copy(start); a.prev.copy(start);
  const speed=(22+charge*30)*(perfectShot?1.12:1);
  a.vel.copy(fwd).multiplyScalar(speed);
  a.dmg=(18+charge*30)*(player.witherT>0?TROLL_TYPES.shaman.witherDmgMul:1)*RUNM.dmgMul*(perfectShot?1.3:1);   // TURBÓ: TÖKÉLETES lövés +30%   // SÁMÁN-HEX: gyengített sebzés; FEJLESZTÉS: Szakás Hegy dmg-szorzó
  a.life=0; a.active=true; a.stuck=false; a.g.visible=true;
  a.el=currentElement; a.charge=charge*(overT>0?1.5:1); a.perfect=perfectShot; a.resonant=(performance.now()*0.001-lastSwapT)<1.2; applyArrowVisual(a);   // TURBÓ: VIHAR-túltöltés alatt ×1.5 elemi erő
  if(perfectShot) EFX.flash(start.x,start.y,start.z,0xffd27a,0.25,1.4,0.18);   // ELEM: element + charge + rezonancia (gyors váltás után)
  a.gravK = 1 - 0.45*Math.max(0, charge-1); if(a.gravK<0.4) a.gravK=0.4;   // FELHÚZÁS-PLAFON: a charge>1 lapít az íven (kevesebb gravitáció), de sose lebeg
  if(a.el==='base'){ a.pierceLeft=RUNM.pierce; a.ricochetLeft=RUNM.ricochet; } else { a.pierceLeft=0; a.ricochetLeft=0; }   // ALAP-nyíl pierce/ricochet (elemi marad 1-találat + splash)
  a.hitSet.clear(); a._counted=false;
  orientArrow(a);
  AUD.twang(charge);
  coopOnShot(start, fwd, charge); // CO-OP: relay this shot to peers (no-op offline)
}
const _orientLook=new THREE.Vector3();
const HIT_CHIPS=[0x5f9168,0x3c5a3e,0x86a878,0x4a3a2a];   // találatkor lepattanó moha / bőr / kéreg
// nyíl becsapódás talajba / fába / kőbe: a lövés felé visszapattanó szilánkok + porpamacs
function arrowThud(x,y,z,vx,vz){
  VFX.debris(x,y,z,7,[0x8b7355,0x6e5a40,0xa89070],3.0,{up:0.1,lift:1.6,life:0.55,grav:12,w:0.035,vx:-vx*0.05,vz:-vz*0.05});
  SMK.spawn(x,y+0.08,z,rand(-0.3,0.3),rand(0.3,0.7),rand(-0.3,0.3),0x4a4034,0.3,0.9,0.5,-0.2,1.2,0.3);
}
function findRicochetTarget(a, fx, fy, fz){   // FEJLESZTÉS: legközelebbi ÉLŐ, még-nem-talált troll 14m-en belül (SP-only)
  let best=null, bestD=14*14;
  for(const m of monsters){
    if(!m.alive || m.dying>0) continue;
    if(a.hitSet.has(m)) continue;          // ugyanazt a trollt sose kétszer egy repülésben
    if(coopIsRemote(m)) continue;          // SP-only: szerver-vezérelt trollra nem pattan
    const dx=m.g.position.x-fx, dy=(m.g.position.y+(m.bodyCY||1))-fy, dz=m.g.position.z-fz;
    const d2=dx*dx+dy*dy+dz*dz;
    if(d2<bestD){ bestD=d2; best=m; }
  }
  return best;
}
function orientArrow(a){
  _orientLook.copy(a.g.position).add(a.vel);   // FPS: nincs per-nyíl/per-frame Vector3 allokáció
  a.g.lookAt(_orientLook);
}

