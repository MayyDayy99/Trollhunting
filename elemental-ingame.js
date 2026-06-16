/* ============================================================================
   elemental-ingame.js — Mohás Roham ELEMI HARCRENDSZER (a JÁTÉKBA beépített,
   tesztelt kód, kiemelve a game/mohas-roham-elemental.html buildből).
   ----------------------------------------------------------------------------
   EZ NEM a 2D demó-motor (az guidelines/fx/element-fx.js). Ez a TÉNYLEGES 3D
   Three.js rendszer, ahogy a játékban fut: 5 nyíltípus (ALAP/TŰZ/JÉG/MÉREG/
   VILLÁM), látható elem a nyíl hegyén, cinematic FX-réteg (per-részecske
   shader-points, villanások, táguló gyűrűk, valódi villám-ívek, dinamikus fény),
   enemy status (DoT/lassítás/stun) + aura, és elemi halál-overlay.

   ── CLAUDE CODE: HOGYAN ÉPÍTSD BE ──────────────────────────────────────────
   A kódot a fő játékba (mp-server/public/mohas-roham.html) kell illeszteni. A
   working build (game/mohas-roham-elemental.html) MUTATJA a pontos hookokat —
   minden módosítás // ELEM: / // ELEM-PRO: / // ELEM-CINEMA: címkével van.
   A 6 hook a fő játékban (diffeld a buildet az eredetihez):
     1) makeArrow(): a hegyhez own material-clone + glow sprite + elemHolder
        (lásd a buildben a "ELEM:" sorokat a nyíl-poolban).
     2) fireArrow(): a.el=currentElement; applyArrowVisual(a);
     3) az arrow update-ciklusban: emitArrowTrail(a);
     4) a nyíl-találatkor: elementMechanic(pos, a.el, hit, dmg, head, wasStatus)
        majd applyStatus(hit, a.el); + elementalImpact(pos, a.el, head);
     5) makeMonster(): status mezők (statusEl/statusT/slowMul/burnAcc/_eyeBase),
        és a monster-update-ben: tickStatus(m, dt); (a moveToward használja slowMul-t)
     6) killMonster(): elementalDeath(m);  + a fő loopban: RP/SMK/EFX.update(dt).
     Billentyű: 1–5 → setElement(EL_ORDER[k-1]).

   ── A HOST JÁTÉK BIZTOSÍTJA (külső függőségek) ─────────────────────────────
     THREE, scene, camera, GLOW (radial glow textúra), rand(a,b), pick(arr),
     clamp, mesh(geo,mat,x,y,z,...), GROUND_Y, monsters[], killMonster(m,head),
     coopIsRemote(m), sparks/gore (a régi Particles poolok — még használt a
     gáz-felhőnél), és a monster-mezők: m.g, m.eyes[], m.bodyCY, m.bodyR,
     m.scale, m.hp, m.alive, m.dying, m.hurtFlash, m.rooted.
     A nyíl-objektum mezői: a.el, a.tip, a.glow, a.elemHolder, a.flames, a.prev,
     a.g.position.

   ── HANGOLÁS ───────────────────────────────────────────────────────────────
     Gameplay-számok: STATUS_CFG (DoT/lassítás/stun/időtartam) + elementMechanic.
     Vizuál erőssége: makeRichPool spawn-paraméterek, elementalImpact/
     elementalDeath/statusAura részecskeszámok és méretek.
   ============================================================================ */

/* ========================= 1) CINEMATIC FX-RÉTEG ========================= */
/* ===================== ELEM-CINEMA — gazdag additív FX-réteg =====================
   A demó-kártyák szépségét hozza a játékba: per-részecske MÉRET + elhalványulás
   (shader-points), táguló lökés-GYŰRŰK, villanás-SPRITE-ok, valódi VILLÁM-ívek
   (Line) és dinamikus FÉNY. Minden elemi effekt ezen fut. */
function makeRichPool(max, blending, fade){
  const pos=new Float32Array(max*3), acol=new Float32Array(max*3), asz=new Float32Array(max), aal=new Float32Array(max);
  const vel=new Float32Array(max*3), life=new Float32Array(max), ml=new Float32Array(max);
  const s0=new Float32Array(max), s1=new Float32Array(max), grv=new Float32Array(max), drg=new Float32Array(max), amax=new Float32Array(max);
  let idx=0; const C=new THREE.Color();
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  g.setAttribute('acolor',new THREE.BufferAttribute(acol,3));
  g.setAttribute('size',new THREE.BufferAttribute(asz,1));
  g.setAttribute('alpha',new THREE.BufferAttribute(aal,1));
  const mat=new THREE.ShaderMaterial({
    uniforms:{ map:{value:GLOW} },
    vertexShader:'attribute float size; attribute float alpha; attribute vec3 acolor; varying vec3 vC; varying float vA;'+
      'void main(){ vC=acolor; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.0);'+
      'gl_PointSize=clamp(size*(300.0/-mv.z),1.0,260.0); gl_Position=projectionMatrix*mv; }',
    fragmentShader:'uniform sampler2D map; varying vec3 vC; varying float vA;'+
      'void main(){ vec4 t=texture2D(map,gl_PointCoord); if(t.a<0.02)discard; gl_FragColor=vec4(vC, t.a*vA); }',
    transparent:true, blending:blending, depthWrite:false, depthTest:true });
  const pts=new THREE.Points(g,mat); pts.frustumCulled=false; scene.add(pts);
  function spawn(x,y,z, vx,vy,vz, color, size0,size1, lifeS, grav, drag, a0){
    const i=idx++%max; pos[i*3]=x;pos[i*3+1]=y;pos[i*3+2]=z; vel[i*3]=vx;vel[i*3+1]=vy;vel[i*3+2]=vz;
    C.set(color); acol[i*3]=C.r;acol[i*3+1]=C.g;acol[i*3+2]=C.b;
    s0[i]=size0; s1[i]=(size1==null?size0*0.15:size1); life[i]=lifeS; ml[i]=lifeS;
    grv[i]=grav||0; drg[i]=drag||0; amax[i]=(a0==null?1:a0); asz[i]=size0; aal[i]=amax[i]; }
  function update(dt){
    for(let i=0;i<max;i++){ if(life[i]<=0){ if(aal[i]!==0){aal[i]=0;asz[i]=0;} continue; }
      life[i]-=dt; const k=Math.max(0,life[i]/ml[i]);
      const df=Math.max(0,1-drg[i]*dt); vel[i*3]*=df; vel[i*3+2]*=df; vel[i*3+1]=vel[i*3+1]*df-grv[i]*dt;
      pos[i*3]+=vel[i*3]*dt; pos[i*3+1]+=vel[i*3+1]*dt; pos[i*3+2]+=vel[i*3+2]*dt;
      asz[i]=s1[i]+(s0[i]-s1[i])*k;
      aal[i]=amax[i]*(fade==='puff'?Math.sin(Math.PI*(1-k)):k); }
    g.attributes.position.needsUpdate=true; g.attributes.size.needsUpdate=true; g.attributes.alpha.needsUpdate=true; g.attributes.acolor.needsUpdate=true; }
  return { spawn, update };
}
const RP=makeRichPool(2600, THREE.AdditiveBlending, 'add');   // izzó: parázs, szikra, dér, buborék, mágia
const SMK=makeRichPool(360, THREE.NormalBlending, 'puff');    // füst: sötét, növekvő, lágy puff

const EFX=(function(){
  // villanás-sprite-ok (kamerára néző additív glow)
  const FN=44, fl=[]; for(let i=0;i<FN;i++){ const s=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xffffff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending})); s.visible=false; scene.add(s); fl.push({s,life:0,max:1,r0:1,r1:2,a0:1}); } let fi=0;
  function flash(x,y,z,color,r0,r1,dur,a0){ const f=fl[fi++%FN]; f.s.visible=true; f.s.position.set(x,y,z); f.s.material.color.set(color); f.r0=r0;f.r1=r1;f.life=dur;f.max=dur;f.a0=(a0==null?1:a0); f.s.scale.setScalar(r0); f.s.material.opacity=f.a0; }
  // táguló talaj-gyűrűk (lökéshullám)
  const RN=22, rg=[]; for(let i=0;i<RN;i++){ const m=new THREE.Mesh(new THREE.RingGeometry(0.82,1,40), new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending})); m.visible=false; m.rotation.x=-Math.PI/2; scene.add(m); rg.push({m,life:0,max:1,r0:1,r1:3,a0:1}); } let rgi=0;
  function ring(x,y,z,color,r0,r1,dur,a0){ const r=rg[rgi++%RN]; r.m.visible=true; r.m.position.set(x,y,z); r.m.material.color.set(color); r.r0=r0;r.r1=r1;r.life=dur;r.max=dur;r.a0=(a0==null?0.9:a0); r.m.scale.setScalar(r0); r.m.material.opacity=r.a0; }
  // villám-ívek (szaggatott additív vonal)
  const BN=18, SEG=12, bz=[]; for(let i=0;i<BN;i++){ const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array((SEG+1)*3),3)); const m=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending})); m.visible=false; m.frustumCulled=false; scene.add(m); bz.push({m,life:0,max:1}); } let bi=0;
  function bolt(ax,ay,az,bx,by,bz_,color,dur,jit){ const b=bz[bi++%BN], arr=b.m.geometry.attributes.position.array;
    for(let j=0;j<=SEG;j++){ const t=j/SEG, e=(j>0&&j<SEG)?jit:0; arr[j*3]=ax+(bx-ax)*t+rand(-e,e); arr[j*3+1]=ay+(by-ay)*t+rand(-e,e); arr[j*3+2]=az+(bz_-az)*t+rand(-e,e); }
    b.m.geometry.attributes.position.needsUpdate=true; b.m.material.color.set(color); b.m.material.opacity=1; b.life=dur; b.max=dur; b.m.visible=true; }
  // dinamikus fény (egy megosztott, villanó pontfény)
  const L=new THREE.PointLight(0xffffff,0,18,2); L.visible=false; scene.add(L); let Ll=0,Lm=1,Li=0;
  function light(x,y,z,color,intensity,dur){ L.position.set(x,y,z); L.color.set(color); L.intensity=intensity; Li=intensity; Ll=dur; Lm=dur; L.visible=true; }
  function update(dt){
    for(const f of fl){ if(f.life>0){ f.life-=dt; const k=f.life/f.max; f.s.scale.setScalar(f.r0+(f.r1-f.r0)*(1-k)); f.s.material.opacity=f.a0*k; if(f.life<=0)f.s.visible=false; } }
    for(const r of rg){ if(r.life>0){ r.life-=dt; const k=r.life/r.max; r.m.scale.setScalar(r.r0+(r.r1-r.r0)*(1-k)); r.m.material.opacity=r.a0*k; if(r.life<=0)r.m.visible=false; } }
    for(const b of bz){ if(b.life>0){ b.life-=dt; b.m.material.opacity=Math.max(0,b.life/b.max); if(b.life<=0)b.m.visible=false; } }
    if(Ll>0){ Ll-=dt; L.intensity=Li*Math.max(0,Ll/Lm); if(Ll<=0)L.visible=false; } }
  return { flash, ring, bolt, light, update };
})();
const arrowLight=new THREE.PointLight(0x88ccff,0,9,2); arrowLight.visible=false; scene.add(arrowLight); let arrowLightT=0;

/* ========================= 2) ELEMI KONFIG + FÜGGVÉNYEK ========================= */
/* ===================== ELEMI NYÍLRENDSZER (Tűz / Jég / Méreg / Villám) =====================
   Mohás Roham Design System integráció. Forrás: tokens/elements.css (színek 0xRRGGBB),
   guidelines/elemental-combat-spec.md (hookok), guidelines/fx/element-fx.js (viselkedés).
   Minden elem 4 helyen jelenik meg: (1) NYÍL fej-szín + glow + nyom, (2) BECSAPÓDÁS burst,
   (3) ENEMY STATUS (DoT/lassítás/stun) + aura, (4) ELEMI HALÁL-overlay.
   A részecskéket a meglévő additív `sparks`/`gore` poolon szórjuk (= THREE.Points, AdditiveBlending). */
const EL = {
  base:      { name:'ALAP',   ui:'#cfe0ff', head:0x000000, glow:0xe9f1ff, trail:0xcfe0ff },
  fire:      { name:'TŰZ',    ui:'#ff7a3d', head:0xff5a2a, glow:0xffc24d, trail:0xff7a3d, status:'fire' },
  ice:       { name:'JÉG',    ui:'#7fd0ff', head:0x6fd8ff, glow:0xe2f6ff, trail:0x9fe3ff, status:'ice' },
  poison:    { name:'MÉREG',  ui:'#9fdc4a', head:0x7e9a2e, glow:0xc8e26a, trail:0x9fdc4a, status:'poison' },
  lightning: { name:'VILLÁM', ui:'#b48cff', head:0xb48cff, glow:0xffffff, trail:0xa8c8ff, status:'lightning' },
};
const EL_ORDER=['base','fire','ice','poison','lightning'];
let currentElement='base';

/* JÓZAN ALAP gameplay-számok — ITT HANGOLHATÓ:
     dur=státusz hossz (mp), dps=sebzés/mp (DoT), slow=mozgásszorzó (1=nincs),
     stun=bénítás (mp, a meglévő m.rooted mezőt használja), tint=szem-emissive státusz-szín */
const STATUS_CFG = {
  fire:      { dur:4.0, dps:7, slow:1.0,  stun:0,   tint:0xff6a2a },  // ÉG:    7 dmg/mp, 4 mp
  ice:       { dur:3.0, dps:0, slow:0.45, stun:0,   tint:0x9fd2ff },  // FAGY:  55% lassítás, 3 mp
  poison:    { dur:6.0, dps:4, slow:0.85, stun:0,   tint:0x9fd24a },  // MÉREG: 4 dmg/mp + enyhe lassítás, 6 mp
  lightning: { dur:1.2, dps:0, slow:1.0,  stun:1.2, tint:0xc8b4ff },  // SOKK:  1.2 mp bénítás
};

function applyArrowVisual(a){
  const def=EL[a.el]||EL.base;
  if(a.tip&&a.tip.material){ a.tip.material.emissive.setHex(def.head); a.tip.material.emissiveIntensity=(a.el==='base')?0:1.5; a.tip.visible=(a.el!=='ice'&&a.el!=='poison'); }
  if(a.glow){ a.glow.material.color.setHex(def.glow); a.glow.material.opacity=(a.el==='base')?0:0.5; }
  buildElemHead(a);   // ELEM-PRO: visible element head on the projectile
}
function emitArrowTrail(a){
  const p=a.g.position, el=a.el;
  if(a.flames){ for(let i=0;i<a.flames.length;i++){ const s=a.flames[i]; s.material.opacity=0.7+Math.random()*0.3; s.scale.setScalar((0.32-i*0.05)*(0.85+Math.random()*0.3)); } } // láng-pislogás a hegyen
  if(el!=='base'){ arrowLight.visible=true; arrowLight.position.copy(p); arrowLight.color.set(EL[el].glow); arrowLight.intensity=2.0; arrowLightT=0.12; } // a repülő nyíl bevilágítja a tisztást
  if(el==='base'){ if(Math.random()<0.5) RP.spawn(p.x,p.y,p.z, rand(-0.4,0.4),rand(-0.4,0.4),rand(-0.4,0.4), 0xcfe0ff, 0.32,0.02, 0.28, 0,2); return; }
  if(el==='fire'){
    for(let i=0;i<2;i++) RP.spawn(p.x+rand(-0.06,0.06),p.y+rand(-0.06,0.06),p.z+rand(-0.06,0.06), rand(-0.5,0.5),rand(0.6,1.6),rand(-0.5,0.5), pick([0xff5a2a,0xff8a3a,0xffc24d]), rand(0.5,0.85),0.04, rand(0.32,0.5), -2.5,1.6); // felszálló parázs
    if(Math.random()<0.55) SMK.spawn(p.x,p.y+0.05,p.z, rand(-0.2,0.2),0.5,rand(-0.2,0.2), 0x241810, 0.5,1.3, 0.7, -1,1.2, 0.4); // füst
  } else if(el==='ice'){
    RP.spawn(p.x,p.y,p.z, rand(-0.3,0.3),rand(-0.6,0.1),rand(-0.3,0.3), 0x9fe3ff, rand(0.4,0.6),0.03, rand(0.3,0.5), 3.5,1); // hulló dér
    if(Math.random()<0.5) RP.spawn(p.x,p.y,p.z, rand(-0.4,0.4),rand(-0.2,0.4),rand(-0.4,0.4), 0xffffff, 0.28,0.02, 0.3, 0,1.5); // csillám
  } else if(el==='poison'){
    RP.spawn(p.x,p.y,p.z, rand(-0.3,0.3),rand(-0.4,0.1),rand(-0.3,0.3), pick([0x7e9a2e,0x9fdc4a]), rand(0.45,0.7),0.05, rand(0.35,0.55), 2.5,1.2); // csöpögő méreg
    if(Math.random()<0.4) RP.spawn(p.x,p.y,p.z, rand(-0.2,0.2),rand(0.2,0.6),rand(-0.2,0.2), 0xc8e26a, 0.4,0.6, 0.5, -1.5,1, 0.8); // emelkedő buborék
  } else if(el==='lightning'){
    RP.spawn(p.x,p.y,p.z, rand(-0.5,0.5),rand(-0.5,0.5),rand(-0.5,0.5), 0xffffff, rand(0.35,0.6),0.02, 0.22, 0,2); // izzó mag-mote
    if(Math.random()<0.8) EFX.bolt(a.prev.x,a.prev.y,a.prev.z, p.x,p.y,p.z, pick([0xffffff,0xc8e6ff,0xb48cff]), 0.09, 0.12); // cikázó ív a nyom mentén
  }
}
function elementalImpact(pos, elKey, head){
  const x=pos.x,y=pos.y,z=pos.z, big=head?1.5:1;
  if(elKey==='base'){ EFX.flash(x,y,z,0xcfe0ff,0.3,1.0*big,0.18); for(let i=0;i<(head?16:10);i++){ const a=rand(0,6.28),pp=Math.acos(rand(-1,1)),s=rand(2,5)*big; RP.spawn(x,y,z,Math.sin(pp)*Math.cos(a)*s,Math.cos(pp)*s,Math.sin(pp)*Math.sin(a)*s,0xcfe0ff,rand(0.3,0.5),0.02,rand(0.3,0.6),6,1.5); } return; }
  if(elKey==='fire'){
    EFX.flash(x,y,z,0xffb24d,0.6,3.2*big,0.28); EFX.light(x,y,z,0xff7a3d,3.2*big,0.22); EFX.ring(x,y,z,0xff7a3d,0.4,3.6*big,0.4,0.8);
    for(let i=0;i<(head?34:22);i++){ const a=rand(0,6.28),pp=Math.acos(rand(-1,1)),s=rand(2,7)*big; RP.spawn(x,y,z,Math.sin(pp)*Math.cos(a)*s,Math.abs(Math.cos(pp)*s)+rand(0,2),Math.sin(pp)*Math.sin(a)*s,pick([0xff5a2a,0xff8a3a,0xffc24d,0xfff1c4]),rand(0.45,0.9),0.04,rand(0.4,0.8),-1.5,1.4); }
    for(let i=0;i<5;i++) SMK.spawn(x,y+rand(0,0.3),z,rand(-0.6,0.6),rand(0.6,1.4),rand(-0.6,0.6),0x281a10,0.6,1.8,rand(0.7,1.1),-1,1,0.45);
  } else if(elKey==='ice'){
    EFX.flash(x,y,z,0xe2f6ff,0.5,2.8*big,0.24); EFX.light(x,y,z,0x9fd0ff,2.6*big,0.2); EFX.ring(x,y,z,0xbfe6ff,0.3,3.0*big,0.42,0.9);
    for(let i=0;i<(head?30:20);i++){ const a=rand(0,6.28),pp=Math.acos(rand(-1,1)),s=rand(3,8)*big; RP.spawn(x,y,z,Math.sin(pp)*Math.cos(a)*s,Math.cos(pp)*s,Math.sin(pp)*Math.sin(a)*s,pick([0x9fe3ff,0xe2f6ff,0xffffff]),rand(0.4,0.7),0.03,rand(0.4,0.7),5,0.8); }
  } else if(elKey==='poison'){
    EFX.flash(x,y,z,0xc8e26a,0.5,2.4*big,0.26); EFX.light(x,y,z,0x9fdc4a,2.2*big,0.22); EFX.ring(x,y,z,0x9fdc4a,0.3,2.6*big,0.4,0.8);
    for(let i=0;i<(head?24:16);i++){ const a=rand(0,6.28),s=rand(2,6)*big; RP.spawn(x,y,z,Math.cos(a)*s,rand(1,4),Math.sin(a)*s,pick([0x7e9a2e,0x9fdc4a,0xc8e26a]),rand(0.5,0.8),0.05,rand(0.4,0.7),4,1.2); }
  } else if(elKey==='lightning'){
    EFX.flash(x,y,z,0xffffff,0.4,3.0*big,0.16); EFX.light(x,y,z,0xc8b4ff,3.6*big,0.18); EFX.ring(x,y,z,0xb48cff,0.3,3.2*big,0.34,0.9);
    for(let i=0;i<5;i++){ const a=rand(0,6.28),pp=Math.acos(rand(-1,1)),L=rand(1.2,2.6); EFX.bolt(x,y,z, x+Math.sin(pp)*Math.cos(a)*L, y+Math.cos(pp)*L, z+Math.sin(pp)*Math.sin(a)*L, pick([0xffffff,0xc8e6ff,0xb48cff]),0.14,0.18); }
    for(let i=0;i<(head?22:14);i++){ const a=rand(0,6.28),pp=Math.acos(rand(-1,1)),s=rand(4,9)*big; RP.spawn(x,y,z,Math.sin(pp)*Math.cos(a)*s,Math.cos(pp)*s,Math.sin(pp)*Math.sin(a)*s,pick([0xffffff,0xd8e6ff]),rand(0.3,0.5),0.02,rand(0.2,0.4),1,2); }
  }
}
function applyStatus(m, elKey){
  const def=EL[elKey]; if(!def||!def.status) return;          // ALAP = nincs státusz
  const s=STATUS_CFG[def.status];
  m.statusEl=def.status; m.statusT=s.dur; m.burnAcc=0;
  if(s.slow<1) m.slowMul=s.slow;
  if(s.stun>0) m.rooted=Math.max(m.rooted||0, s.stun);         // VILLÁM bénítás a meglévő root-tal
  if(def.status==='ice') freezeEncase(m);                      // ELEM-PRO: látható jégburok
  if(m._eyeBase==null && m.eyes&&m.eyes[0]) m._eyeBase=m.eyes[0].material.emissive.getHex();
  if(m.eyes) m.eyes.forEach(e=>e.material.emissive.setHex(s.tint));  // szem-tint a státusz színére
}
function clearStatus(m){
  m.statusEl=null; m.statusT=0; m.slowMul=1;
  if(m.iceShell){ m.g.remove(m.iceShell); m.iceShell.geometry.dispose(); m.iceShell.material.dispose(); m.iceShell=null; }  // ELEM-PRO: jégburok le
  if(m._eyeBase!=null && m.eyes) m.eyes.forEach(e=>e.material.emissive.setHex(m._eyeBase));
}
function tickStatus(m, dt){
  if(!m.statusEl) return;
  const s=STATUS_CFG[m.statusEl]; m.statusT-=dt;
  if(s.dps>0){ m.burnAcc=(m.burnAcc||0)+s.dps*dt;            // DoT egész sebzésre kvantálva
    if(m.burnAcc>=1){ const d=Math.floor(m.burnAcc); m.burnAcc-=d; m.hp-=d; m.hurtFlash=Math.max(m.hurtFlash,0.08);
      if(m.hp<=0 && m.alive){ killMonster(m,false); return; } } }
  if(s.slow<1) m.slowMul=s.slow;                              // lassítás frissítése (AI olvassa)
  statusAura(m, m.statusEl);
  if(m.statusT<=0) clearStatus(m);
}
function statusAura(m, key){
  const p=m.g.position, cy=p.y+(m.bodyCY||1), r=(m.bodyR||0.4);
  if(key==='fire'){
    for(let i=0;i<2;i++) RP.spawn(p.x+rand(-r,r),cy+rand(-0.2,0.5),p.z+rand(-r,r), rand(-0.3,0.3),rand(1.2,2.4),rand(-0.3,0.3), pick([0xff5a2a,0xff8a3a,0xffc24d]), rand(0.4,0.7),0.04, rand(0.4,0.7), -2,1.5); // lobogó láng
    if(Math.random()<0.3) SMK.spawn(p.x+rand(-r,r),cy+0.4,p.z+rand(-r,r), rand(-0.2,0.2),1.0,rand(-0.2,0.2), 0x20160e, 0.5,1.4, 0.8, -1,1, 0.35); // füst-pászma
  } else if(key==='ice'){
    if(m.iceShell){ const t=performance.now()*0.004; m.iceShell.material.opacity=0.36+0.12*Math.sin(t); } // burok-csillámlás
    if(Math.random()<0.5) RP.spawn(p.x+rand(-r,r),cy+rand(-0.3,0.5),p.z+rand(-r,r), rand(-0.2,0.2),rand(-0.3,0.2),rand(-0.2,0.2), pick([0xbfe6ff,0xe2f6ff]), rand(0.3,0.5),0.02, rand(0.5,0.9), 1,0.6); // lebegő dér
    if(Math.random()<0.18) RP.spawn(p.x+rand(-r,r),cy+rand(0,0.6),p.z+rand(-r,r), 0,0,0, 0xffffff, 0.5,0.02, 0.35, 0,0); // csillám-villanás
  } else if(key==='poison'){
    if(Math.random()<0.8) RP.spawn(p.x+rand(-r,r),cy+rand(-0.2,0.3),p.z+rand(-r,r), rand(-0.15,0.15),rand(0.4,1.0),rand(-0.15,0.15), pick([0x7e9a2e,0x9fdc4a,0xc8e26a]), rand(0.35,0.6),0.5, rand(0.5,0.9), -1,1.5, 0.9); // emelkedő-pukkanó buborék
    if(Math.random()<0.3) RP.spawn(p.x+rand(-r,r),cy+0.3,p.z+rand(-r,r), rand(-0.1,0.1),-0.6,rand(-0.1,0.1), 0x7e9a2e, 0.4,0.05, 0.5, 2,1); // csöpögés
  } else if(key==='lightning'){
    if(Math.random()<0.4) EFX.bolt(p.x+rand(-r,r),cy+0.5+rand(-0.2,0.2),p.z+rand(-r,r), p.x+rand(-r,r),cy-0.5+rand(-0.2,0.2),p.z+rand(-r,r), pick([0xffffff,0xc8e6ff]), 0.08, 0.1); // testen átugró ívek
    if(Math.random()<0.7) RP.spawn(p.x+rand(-r,r),cy+rand(-0.4,0.5),p.z+rand(-r,r), rand(-0.6,0.6),rand(-0.6,0.6),rand(-0.6,0.6), 0xffffff, rand(0.3,0.5),0.02, 0.2, 0,1); // sercegő mote
  }
}
function elementalDeath(m){
  if(!m.statusEl) return;                                     // csak ha elemi státusszal halt
  const p=m.g.position, bx=p.x, by=p.y+(m.bodyCY||1), bz=p.z, gy=GROUND_Y+0.05, k=m.statusEl;
  if(k==='fire'){                                             // ELHAMVAD: robbanás + parázs + füstoszlop + perzselt gyűrű
    EFX.flash(bx,by,bz,0xffc24d,0.8,4.5,0.4); EFX.light(bx,by,bz,0xff7a3d,5,0.5); EFX.ring(bx,gy,bz,0xff7a3d,0.5,4.5,0.6,0.8);
    for(let i=0;i<40;i++){ const a=rand(0,6.28),pp=Math.acos(rand(-1,1)),s=rand(2,8); RP.spawn(bx,by,bz,Math.sin(pp)*Math.cos(a)*s,Math.abs(Math.cos(pp)*s)+rand(0,3),Math.sin(pp)*Math.sin(a)*s,pick([0xff5a2a,0xff8a3a,0xffc24d,0xfff1c4]),rand(0.5,1.0),0.04,rand(0.5,1.0),-1.5,1.3); }
    for(let i=0;i<10;i++) SMK.spawn(bx+rand(-0.3,0.3),by+rand(0,0.4),bz+rand(-0.3,0.3),rand(-0.6,0.6),rand(1,2.2),rand(-0.6,0.6),0x20160e,0.7,2.4,rand(1,1.6),-1.2,0.8,0.5);
  } else if(k==='ice'){                                       // SZÉTFAGY: szilánk-robbanás + dér-gyűrű
    EFX.flash(bx,by,bz,0xe2f6ff,0.7,4.0,0.3); EFX.light(bx,by,bz,0x9fd0ff,4,0.4); EFX.ring(bx,gy,bz,0xbfe6ff,0.5,4.0,0.5,0.9);
    for(let i=0;i<46;i++){ const a=rand(0,6.28),pp=Math.acos(rand(-1,1)),s=rand(4,11); RP.spawn(bx,by,bz,Math.sin(pp)*Math.cos(a)*s,Math.cos(pp)*s+rand(0,2),Math.sin(pp)*Math.sin(a)*s,pick([0x9fe3ff,0xe2f6ff,0xffffff,0x7fd0ff]),rand(0.45,0.9),0.02,rand(0.5,0.9),6,0.5); }
  } else if(k==='poison'){                                    // ELOLVAD: zöld kitörés + tócsa-gyűrű + buborék
    EFX.flash(bx,by,bz,0x9fdc4a,0.6,3.4,0.34); EFX.light(bx,by,bz,0x9fdc4a,3.5,0.45); EFX.ring(bx,gy,bz,0x9fdc4a,0.5,3.8,0.7,0.7);
    for(let i=0;i<30;i++){ const a=rand(0,6.28),s=rand(1.5,5); RP.spawn(bx,by,bz,Math.cos(a)*s,rand(-1,3),Math.sin(a)*s,pick([0x7e9a2e,0x9fdc4a,0xc8e26a]),rand(0.5,0.9),0.05,rand(0.5,0.9),5,1); }
    for(let i=0;i<8;i++) RP.spawn(bx+rand(-0.4,0.4),gy,bz+rand(-0.4,0.4),rand(-0.2,0.2),rand(0.5,1.2),rand(-0.2,0.2),0xc8e26a,0.5,0.7,0.7,-1,1,0.9);
  } else if(k==='lightning'){                                 // ELSZENESEDIK: ívvihar + fehér villanás + korom
    EFX.flash(bx,by,bz,0xffffff,0.6,4.2,0.2); EFX.light(bx,by,bz,0xc8b4ff,5.5,0.3); EFX.ring(bx,gy,bz,0xb48cff,0.5,4.2,0.4,0.9);
    for(let i=0;i<8;i++){ const a=rand(0,6.28),pp=Math.acos(rand(-1,1)),L=rand(1.5,3.2); EFX.bolt(bx,by,bz, bx+Math.sin(pp)*Math.cos(a)*L,by+Math.cos(pp)*L,bz+Math.sin(pp)*Math.sin(a)*L, pick([0xffffff,0xc8e6ff,0xb48cff]),0.16,0.22); }
    for(let i=0;i<26;i++){ const a=rand(0,6.28),pp=Math.acos(rand(-1,1)),s=rand(3,9); RP.spawn(bx,by,bz,Math.sin(pp)*Math.cos(a)*s,Math.cos(pp)*s,Math.sin(pp)*Math.sin(a)*s,pick([0xffffff,0xd8e6ff,0x5a3fb0]),rand(0.35,0.6),0.02,rand(0.3,0.6),3,1.5); }
  }
  shake=Math.max(shake,0.28);
}

/* --- elem-választó HUD (a HUD aljára, középre; a menük z-index 10 eltakarják) --- */
let _elHud=null;
function buildElementHUD(){
  const wrap=document.createElement('div'); wrap.id='elhud';
  wrap.style.cssText='position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:6;display:flex;gap:6px;pointer-events:none;font-family:-apple-system,\'Segoe UI\',sans-serif';
  EL_ORDER.forEach((id,i)=>{ const def=EL[id];
    const chip=document.createElement('div'); chip.dataset.el=id;
    chip.style.cssText='display:flex;flex-direction:column;align-items:center;gap:3px;padding:5px 9px;border-radius:10px;background:rgba(14,22,40,.6);border:1px solid rgba(180,200,240,.18);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);transition:all .12s';
    const sw=document.createElement('div'); sw.style.cssText='width:22px;height:5px;border-radius:3px;background:'+def.ui;
    const lab=document.createElement('div'); lab.textContent=(i+1)+' '+def.name; lab.style.cssText='font:700 9px/1 inherit;letter-spacing:.04em;color:#9db4d6';
    chip.appendChild(sw); chip.appendChild(lab); wrap.appendChild(chip); });
  document.body.appendChild(wrap); _elHud=wrap; updateElementHUD();
}
function updateElementHUD(){
  if(!_elHud) return;
  _elHud.querySelectorAll('[data-el]').forEach(chip=>{ const id=chip.dataset.el, on=(id===currentElement), def=EL[id];
    chip.style.background=on?'rgba(40,58,96,.8)':'rgba(14,22,40,.6)';
    chip.style.borderColor=on?def.ui:'rgba(180,200,240,.18)';
    chip.style.boxShadow=on?('0 0 14px '+def.ui+'66'):'none';
    chip.querySelector('div:last-child').style.color=on?def.ui:'#9db4d6'; });
}
function setElement(id){ if(!EL[id]) return; currentElement=id; updateElementHUD(); }

/* ===================== ELEM-PRO: látható nyilak + elem-logika =====================
   Minden elem saját mechanikát kap (nem csak szín): tűz=DoT+terjedés, jég=fagy/szilánk,
   méreg=megmaradó gázfelhő, villám=lánc. A nyil hegyén látható az elem (buildElemHead). */
let gasClouds=[];
function buildElemHead(a){
  const h=a.elemHolder; if(!h) return;
  while(h.children.length){ const c=h.children.pop(); if(c.geometry)c.geometry.dispose(); if(c.material&&c.material.dispose)c.material.dispose(); h.remove(c); }
  a.flames=null; const el=a.el;
  if(el==='fire'){ a.flames=[]; for(let i=0;i<3;i++){ const s=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:(i?0xff7a3d:0xffe08a),transparent:true,opacity:0.9,depthWrite:false,blending:THREE.AdditiveBlending})); s.scale.setScalar(0.34-i*0.06); s.position.set(0,0.02+i*0.03,-0.04); h.add(s); a.flames.push(s); } }
  else if(el==='ice'){ const cr=new THREE.Mesh(new THREE.OctahedronGeometry(0.075,0), new THREE.MeshStandardMaterial({color:0x9fe3ff,emissive:0x6fd8ff,emissiveIntensity:1.2,transparent:true,opacity:0.85,flatShading:true,roughness:0.3})); cr.position.set(0,0,-0.02); cr.scale.set(1,1,1.6); h.add(cr); const s=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xe2f6ff,transparent:true,opacity:0.55,depthWrite:false,blending:THREE.AdditiveBlending})); s.scale.setScalar(0.3); h.add(s); }
  else if(el==='poison'){ const blob=new THREE.Mesh(new THREE.SphereGeometry(0.06,8,6), new THREE.MeshStandardMaterial({color:0x9fdc4a,emissive:0x7e9a2e,emissiveIntensity:0.9,transparent:true,opacity:0.92,flatShading:true,roughness:0.4})); blob.position.set(0,-0.01,-0.02); blob.scale.set(1,1.4,1); h.add(blob); const s=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xc8e26a,transparent:true,opacity:0.5,depthWrite:false,blending:THREE.AdditiveBlending})); s.scale.setScalar(0.26); h.add(s); }
  else if(el==='lightning'){ const core=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xffffff,transparent:true,opacity:0.95,depthWrite:false,blending:THREE.AdditiveBlending})); core.scale.setScalar(0.32); h.add(core); const v=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xb48cff,transparent:true,opacity:0.7,depthWrite:false,blending:THREE.AdditiveBlending})); v.scale.setScalar(0.5); h.add(v); }
}
function arcSpark(from,to,color,n){ const k=n*5; for(let i=0;i<k;i++){ const t=i/k; sparks.burst(from.x+(to.x-from.x)*t+rand(-0.15,0.15), from.y+(to.y-from.y)*t+rand(-0.15,0.15), from.z+(to.z-from.z)*t+rand(-0.15,0.15), 1, color, 0.2, 0); } }
function nearestTrolls(x,z,exclude,radius,max){ const out=[]; for(const o of monsters){ if(!o.alive||o.dying>0||o===exclude||coopIsRemote(o)) continue; const d=Math.hypot(o.g.position.x-x,o.g.position.z-z); if(d<radius) out.push([d,o]); } out.sort((a,b)=>a[0]-b[0]); return out.slice(0,max).map(e=>e[1]); }
function chainLightning(hit,dmg){ const targets=nearestTrolls(hit.g.position.x,hit.g.position.z,hit,7,2); let prev=hit; for(const tg of targets){ const a=prev.g.position.clone(); a.y+=prev.bodyCY||1; const b=tg.g.position.clone(); b.y+=tg.bodyCY||1; EFX.bolt(a.x,a.y,a.z,b.x,b.y,b.z,0xffffff,0.16,0.3); EFX.bolt(a.x,a.y,a.z,b.x,b.y,b.z,0xb48cff,0.16,0.5); EFX.flash(b.x,b.y,b.z,0xc8e6ff,0.4,1.8,0.2); EFX.light(b.x,b.y,b.z,0xc8b4ff,2.4,0.18); for(let i=0;i<8;i++) RP.spawn(b.x,b.y,b.z,rand(-3,3),rand(-2,3),rand(-3,3),0xffffff,0.4,0.02,0.3,2,1.5); tg.hp-=dmg*0.5; tg.hurtFlash=0.15; applyStatus(tg,'lightning'); if(tg.hp<=0&&tg.alive) killMonster(tg,false); prev=tg; } shake=Math.max(shake,0.12); }
function freezeEncase(m){ if(m.iceShell) return; const r=(m.bodyR/m.scale)*1.25; const sh=new THREE.Mesh(new THREE.IcosahedronGeometry(r,0), new THREE.MeshStandardMaterial({color:0xbfe6ff,emissive:0x6fd8ff,emissiveIntensity:0.5,transparent:true,opacity:0.42,flatShading:true,roughness:0.2})); sh.position.y=m.bodyCY/m.scale; sh.scale.set(1,1.35,1); m.g.add(sh); m.iceShell=sh; }
function spawnGasCloud(x,y,z){ const mat=new THREE.MeshBasicMaterial({color:0x9fdc4a,transparent:true,opacity:0.24,depthWrite:false}); const mm=new THREE.Mesh(new THREE.SphereGeometry(1,12,10),mat); const yy=Math.max(GROUND_Y+0.5,y); mm.position.set(x,yy,z); mm.scale.setScalar(0.4); scene.add(mm); gasClouds.push({m:mm,x,y:yy,z,r:0.4,life:0,max:4.5,tick:0}); EFX.ring(x,GROUND_Y+0.05,z,0x9fdc4a,0.4,3.0,0.5,0.7); for(let i=0;i<14;i++){ const a=rand(0,6.28),s=rand(1,4); RP.spawn(x,yy,z,Math.cos(a)*s,rand(0.5,2),Math.sin(a)*s,pick([0x7e9a2e,0x9fdc4a]),rand(0.5,0.8),0.05,rand(0.5,0.9),3,1); } }
function elementMechanic(pos, el, hit, dmg, head, wasStatus){
  if(el==='fire'){ const near=nearestTrolls(hit.g.position.x,hit.g.position.z,hit,3.5,1); for(const tg of near){ const a=hit.g.position.clone(); a.y+=hit.bodyCY||1; const b=tg.g.position.clone(); b.y+=tg.bodyCY||1; EFX.bolt(a.x,a.y,a.z,b.x,b.y,b.z,0xff9a3d,0.12,0.25); for(let i=0;i<6;i++) RP.spawn(b.x,b.y,b.z,rand(-2,2),rand(0,3),rand(-2,2),pick([0xff5a2a,0xffc24d]),0.5,0.04,0.4,-1,1.2); tg.hp-=dmg*0.3; tg.hurtFlash=0.12; applyStatus(tg,'fire'); if(tg.hp<=0&&tg.alive) killMonster(tg,false); } }
  else if(el==='ice'){ if(wasStatus==='ice'){ hit.hp-=dmg*0.6; EFX.flash(pos.x,pos.y,pos.z,0xffffff,0.6,3.6,0.3); EFX.light(pos.x,pos.y,pos.z,0x9fd0ff,3.5,0.3); for(let i=0;i<40;i++){ const a=rand(0,6.28),pp=Math.acos(rand(-1,1)),s=rand(5,12); RP.spawn(pos.x,pos.y,pos.z,Math.sin(pp)*Math.cos(a)*s,Math.cos(pp)*s,Math.sin(pp)*Math.sin(a)*s,pick([0x9fe3ff,0xe2f6ff,0xffffff]),rand(0.5,0.9),0.02,rand(0.4,0.8),6,0.5); } shake=Math.max(shake,0.2); if(hit.iceShell){ hit.g.remove(hit.iceShell); hit.iceShell.geometry.dispose(); hit.iceShell.material.dispose(); hit.iceShell=null; } if(hit.hp<=0&&hit.alive){ killMonster(hit,false); } } }
  else if(el==='poison'){ spawnGasCloud(pos.x,pos.y,pos.z); }
  else if(el==='lightning'){ chainLightning(hit,dmg); }
}
function updateElemFx(dt){
  for(let i=gasClouds.length-1;i>=0;i--){ const c=gasClouds[i]; c.life+=dt; c.tick-=dt; c.r=Math.min(2.2,c.r+dt*0.9); c.m.scale.setScalar(c.r); c.m.material.opacity=0.26*(1-c.life/c.max);
    if(Math.random()<0.5) sparks.burst(c.x+rand(-c.r,c.r),c.y+rand(-0.2,0.6),c.z+rand(-c.r,c.r),1,pick([0x7e9a2e,0x9fdc4a]),0.5,0.6);
    if(c.tick<=0){ c.tick=0.5; for(const o of monsters){ if(!o.alive||o.dying>0||coopIsRemote(o)) continue; if(Math.hypot(o.g.position.x-c.x,o.g.position.z-c.z)<c.r){ o.hp-=3; o.hurtFlash=0.1; applyStatus(o,'poison'); if(o.hp<=0&&o.alive) killMonster(o,false); } } }
    if(c.life>=c.max){ scene.remove(c.m); c.m.geometry.dispose(); c.m.material.dispose(); gasClouds.splice(i,1); } }
}
