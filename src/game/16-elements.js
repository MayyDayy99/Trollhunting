/* ========================= 2) ELEMI KONFIG + FÜGGVÉNYEK ========================= */
/* ===================== ELEMI NYÍLRENDSZER (Tűz / Jég / Méreg / Villám) =====================
   Troll Hunting Design System integráció. Forrás: tokens/elements.css (színek 0xRRGGBB),
   guidelines/elemental-combat-spec.md (hookok), guidelines/fx/element-fx.js (viselkedés).
   Minden elem 4 helyen jelenik meg: (1) NYÍL fej-szín + glow + nyom, (2) BECSAPÓDÁS burst,
   (3) ENEMY STATUS (DoT/lassítás/stun) + aura, (4) ELEMI HALÁL-overlay.
   A részecskéket a meglévő additív `sparks`/`gore` poolon szórjuk (= THREE.Points, AdditiveBlending). */
const EL = {   // fx: az elem TELÍTETT effekt-színe (VFX-készlet: villanás, oszlop, szikra) — a glow túl fehér lenne additív rétegekhez
  base:      { name:'ALAP',   ui:'#cfe0ff', head:0x000000, glow:0xe9f1ff, trail:0xcfe0ff, fx:0xbcd4ff },
  fire:      { name:'TŰZ',    ui:'#ff7a3d', head:0xff5a2a, glow:0xffc24d, trail:0xff7a3d, fx:0xff7a2a, status:'fire' },
  ice:       { name:'JÉG',    ui:'#7fd0ff', head:0x6fd8ff, glow:0xe2f6ff, trail:0x9fe3ff, fx:0x6fc8ff, status:'ice' },
  poison:    { name:'MÉREG',  ui:'#9fdc4a', head:0x7e9a2e, glow:0xc8e26a, trail:0x9fdc4a, fx:0x9fdc4a, status:'poison' },
  lightning: { name:'VILLÁM', ui:'#b48cff', head:0xb48cff, glow:0xffffff, trail:0xa8c8ff, fx:0xa88cff, status:'lightning' },
};
const EL_ORDER=['base','fire','ice','poison','lightning'];
// INNATE TROLL-ELEM paletta (a JÁTÉKOS EL nyíl-színeitől külön): vizuál-tint + a troll által OKOZOTT státusz. A resolveReaction is ezt olvassa (innate kombó).
const TROLL_EL = {
  fire:      { skin:0x7a2b1c, emissive:0xff5a2a, emInt:0.30, eye:0xffb04a, aura:0xff7a3d },
  ice:       { skin:0x16414f, emissive:0x36c5ff, emInt:0.30, eye:0x7fe2ff, aura:0x9fe3ff },
  poison:    { skin:0x37551f, emissive:0x9fdc4a, emInt:0.28, eye:0xc6ff4a, aura:0x9fdc4a },
  lightning: { skin:0x3a3358, emissive:0xb48cff, emInt:0.30, eye:0xc8b4ff, aura:0xc8b4ff },
};
let currentElement='base';

/* JÓZAN ALAP gameplay-számok — ITT HANGOLHATÓ:
     dur=státusz hossz (mp), dps=sebzés/mp (DoT), slow=mozgásszorzó (1=nincs),
     stun=bénítás (mp, a meglévő m.rooted mezőt használja), tint=szem-emissive státusz-szín */
const STATUS_CFG = {   // számok: src/shared/config.js (a co-op szerver is ezeket használja); a tint csak kliens-oldali
  fire:      { ...SHARED.STATUS.fire, tint:0xff6a2a },        // ÉG:    7/10/13 dmg/mp, 4 mp, stackel
  ice:       { ...SHARED.STATUS.ice, tint:0x9fd2ff },     // FAGY:  55→75% lassítás, stack≥3 → TELJES FAGY; olvadás → nedves
  poison:    { ...SHARED.STATUS.poison, tint:0x9fd24a },        // MÉREG: 4/6/8 dmg/mp, 6 mp, stackel
  lightning: { ...SHARED.STATUS.lightning, tint:0xc8b4ff }, // SOKK:  1.2 mp bénítás, töltötté tesz (charged)
};

function applyArrowVisual(a){
  a._trailAcc=0;
  const def=EL[a.el]||EL.base;
  if(a.tip&&a.tip.material){ a.tip.material.emissive.setHex(def.head); a.tip.material.emissiveIntensity=(a.el==='base')?0:1.5; a.tip.visible=(a.el!=='ice'&&a.el!=='poison'); }
  if(a.glow){ a.glow.material.color.setHex(def.glow); a.glow.material.opacity=(a.el==='base')?0:0.5; }
  buildElemHead(a);   // ELEM-PRO: visible element head on the projectile
}
function fxSteps(owner,key,dt,rate){
  const total=(owner[key]||0)+Math.max(0,dt)*rate, count=Math.floor(total+1e-8);
  owner[key]=Math.max(0,total-count);
  return Math.min(6,count); // Bound catch-up after a stalled/background frame.
}
const trailPoint=new THREE.Vector3();
const TRAIL_FX={   // szalag-csóva elemenként: [szín, fél-szélesség, hossz (mp repülés), alfa, cikcakk]
  base:[0xdfeaff,0.030,0.055,0.38,0], fire:[0xff8a2a,0.075,0.105,0.80,0], ice:[0x9fdcff,0.060,0.095,0.70,0],
  poison:[0x9fdc4a,0.065,0.095,0.70,0], lightning:[0xcdbcff,0.055,0.085,0.85,0.16] };
function emitArrowTrail(a,dt){
  const el=a.el, T=TRAIL_FX[el]||TRAIL_FX.base;
  if(a.flames){ for(let i=0;i<a.flames.length;i++){ const s=a.flames[i], pulse=Math.sin(a.life*22-i*1.7); s.material.opacity=0.8+pulse*0.12; s.scale.setScalar((0.32-i*0.05)*(1+pulse*0.12)); } }
  const p=a.g.position;
  if(el!=='base'){ arrowLight.visible=true; arrowLight.position.copy(p); arrowLight.color.set(EL[el].glow); arrowLight.intensity=2.0; arrowLightT=0.12; } // a repülő nyíl bevilágítja a tisztást
  // SZALAG-CSÓVA: a röppályából visszaszámolt ív a tollazat mögött (tökéletes lövésnél hosszabb/szélesebb, alap-nyílon arany)
  { const k=0.36/(a.vel.length()||1), gold=a.perfect&&el==='base';
    VFX.trail(a.ti, p.x-a.vel.x*k, p.y-a.vel.y*k, p.z-a.vel.z*k, a.vel.x, a.vel.y, a.vel.z, GRAV*(a.gravK!=null?a.gravK:1),
      Math.min(T[2]*(a.perfect?1.35:1), a.life), T[1]*(a.perfect?1.3:1), gold?0xffd27a:T[0], gold?0.7:T[3], T[4]); }
  const steps=fxSteps(a,'_trailAcc',dt,60), remainder=a._trailAcc;
  for(let step=0;step<steps;step++){
  const fraction=clamp(1-(remainder+steps-1-step)/(60*Math.max(dt,1e-6)),0,1);
  const p=trailPoint.lerpVectors(a.prev,a.g.position,fraction);
  if(a.perfect && Math.random()<0.6) RP.spawn(p.x,p.y,p.z, rand(-0.3,0.3),rand(-0.3,0.3),rand(-0.3,0.3), 0xffd27a, 0.36,0.02, 0.34, 0,1.5);   // TURBÓ: TÖKÉLETES lövés arany szikrái
  if(el==='base') continue;
  if(el==='fire'){
    RP.spawn(p.x+rand(-0.06,0.06),p.y+rand(-0.06,0.06),p.z+rand(-0.06,0.06), rand(-0.5,0.5),rand(0.6,1.6),rand(-0.5,0.5), pick([0xff5a2a,0xff8a3a,0xffc24d]), rand(0.4,0.7),0.04, rand(0.32,0.5), -2.5,1.6); // felszálló parázs
    if(Math.random()<0.35) SMK.spawn(p.x,p.y+0.05,p.z, rand(-0.2,0.2),0.5,rand(-0.2,0.2), 0x241810, 0.45,1.2, 0.65, -1,1.2, 0.34); // füst
  } else if(el==='ice'){
    if(Math.random()<0.7) RP.spawn(p.x,p.y,p.z, rand(-0.3,0.3),rand(-0.6,0.1),rand(-0.3,0.3), 0x9fe3ff, rand(0.35,0.55),0.03, rand(0.3,0.5), 3.5,1); // hulló dér
    if(Math.random()<0.3) RP.spawn(p.x,p.y,p.z, rand(-0.4,0.4),rand(-0.2,0.4),rand(-0.4,0.4), 0xffffff, 0.26,0.02, 0.3, 0,1.5); // csillám
  } else if(el==='poison'){
    if(Math.random()<0.7) RP.spawn(p.x,p.y,p.z, rand(-0.3,0.3),rand(-0.4,0.1),rand(-0.3,0.3), pick([0x7e9a2e,0x9fdc4a]), rand(0.4,0.65),0.05, rand(0.35,0.55), 2.5,1.2); // csöpögő méreg
    if(Math.random()<0.3) RP.spawn(p.x,p.y,p.z, rand(-0.2,0.2),rand(0.2,0.6),rand(-0.2,0.2), 0xc8e26a, 0.36,0.55, 0.5, -1.5,1, 0.8); // emelkedő buborék
  } else if(el==='lightning'){
    if(Math.random()<0.6) RP.spawn(p.x,p.y,p.z, rand(-0.5,0.5),rand(-0.5,0.5),rand(-0.5,0.5), 0xffffff, rand(0.3,0.5),0.02, 0.2, 0,2); // izzó mag-mote
    if(Math.random()<0.4) EFX.bolt(p.x,p.y,p.z, p.x+rand(-0.5,0.5),p.y+rand(-0.5,0.5),p.z+rand(-0.5,0.5), Math.random()<0.5?0xffffff:0xcdbcff, 0.08, 0.14, 0.03, true);   // a vesszőről leugró apró ívek
  }
  }
}
// BECSAPÓDÁS: rétegzett recept — rövid csillag-villanás, alak-adó shader (tűzgolyó / szilánkok / cseppek / ívek),
// megnyúlt szikrák, füst, fény és (talaj közelében) lökéshullám + tartós talaj-matrica. Nincs kiégett fehér folt.
function elementalImpact(pos, elKey, head){
  const x=pos.x, y=pos.y, z=pos.z, big=head?1.35:1, gy=GROUND_Y, low=(y-gy)<2.6;
  if(elKey==='base'){
    VFX.flare(x,y,z,0xcfe0ff,head?1.3:0.9,0.12);
    VFX.spray(x,y,z,head?14:9,[0xffffff,0xcfe0ff,0xffe7b8],6*big,{up:-0.3,life:0.3,grav:10,drag:1.5,w:0.014,len:0.04});
    for(let i=0;i<4;i++) RP.spawn(x,y,z,rand(-1.5,1.5),rand(0,2),rand(-1.5,1.5),0xcfe0ff,rand(0.12,0.2),0.02,rand(0.25,0.45),5,1.5);
    return; }
  if(elKey==='fire'){
    FIREBURST.spawn(x,y+0.25*big,z,3.4*big); VFX.flare(x,y,z,0xffa040,1.5*big,0.12);   // Blenderben renderelt robbanás-flipbook (15-fire-burst.js) EFX.light(x,y,z,0xff7a3d,3.0*big,0.24);
    VFX.spray(x,y,z,head?20:13,[0xffd27a,0xff8a3a,0xff5a2a],6.5*big,{up:-0.1,lift:1.2,life:0.55,grav:8,w:0.020,len:0.05});
    for(let i=0;i<6;i++) RP.spawn(x+rand(-0.3,0.3),y+rand(-0.2,0.3),z+rand(-0.3,0.3),rand(-0.8,0.8),rand(0.8,2.2),rand(-0.8,0.8),pick([0xff8a3a,0xffc24d]),rand(0.16,0.3),0.03,rand(0.5,0.9),-1.5,1.2);
    for(let i=0;i<3;i++) SMK.spawn(x+rand(-0.2,0.2),y+rand(0,0.3),z+rand(-0.2,0.2),rand(-0.5,0.5),rand(0.7,1.4),rand(-0.5,0.5),0x241710,0.5,1.7,rand(0.7,1.1),-1,1,0.4);
    if(low){ EFX.ring(x,gy+0.06,z,0xff8a3a,0.3,2.4*big,0.36,0.7); VFX.decal(x,gy,z,1.35*big,0,0x120805,0.7,9,0xff6a1a,2.2); }
  } else if(elKey==='ice'){
    VFX.flare(x,y,z,0x9fdcff,1.2*big,0.13); EFX.light(x,y,z,0x9fd0ff,2.4*big,0.2);
    VFX.spray(x,y,z,head?22:16,[0xffffff,0xbfe9ff,0x6fc4ff],7.5*big,{up:-0.3,life:0.45,grav:12,w:0.026,len:0.028});
    for(let i=0;i<6;i++) RP.spawn(x,y,z,rand(-2,2),rand(-0.5,2),rand(-2,2),pick([0x8fd4ff,0xbfe9ff]),rand(0.14,0.24),0.02,rand(0.4,0.7),3,1.2);
    for(let i=0;i<2;i++) SMK.spawn(x+rand(-0.2,0.2),y,z+rand(-0.2,0.2),rand(-0.4,0.4),rand(0.1,0.5),rand(-0.4,0.4),0xcfe8f6,0.5,1.5,rand(0.6,0.9),-0.2,1,0.28);
    if((y-gy)<0.7) VFX.crystal(x,gy-0.03,z,0.5*big,0.95*big,0.55,rand(-0.25,0.25),rand(-0.25,0.25));   // talajba csapódva jégtüske-fürt fagy ki, majd szétpattan
    else VFX.crystal(x,y-0.22,z,0.3*big,0.5*big,0.09,rand(-0.6,0.6),rand(-0.6,0.6),true);                // testen: egy pillanatra kivirágzó jégcsillag
    if(low){ EFX.ring(x,gy+0.06,z,0xbfe6ff,0.3,2.2*big,0.4,0.7); VFX.decal(x,gy,z,1.4*big,0,0xbfe2f4,0.5,8); }
  } else if(elKey==='poison'){
    poisonPool(x,y,z,splashR('poison')*RUNM.elemRadiusMul); VFX.flare(x,y,z,0x9fe04a,0.7*big,0.10); EFX.light(x,y,z,0x9fdc4a,2.0*big,0.22);   // méregtócsa a talajon, akkora, mint a sebző terület
    VFX.spray(x,y,z,head?16:11,[0xc8f26a,0x9fdc4a,0x6fae2a],5.5*big,{up:-0.1,lift:1.0,life:0.5,grav:13,w:0.028,len:0.06});
    for(let i=0;i<6;i++){ const a=rand(0,6.28), s=rand(1,4)*big; RP.spawn(x,y,z,Math.cos(a)*s,rand(1,3.5),Math.sin(a)*s,pick([0x7e9a2e,0x9fdc4a,0xc8e26a]),rand(0.18,0.3),0.05,rand(0.4,0.7),6,1.2); }
    for(let i=0;i<2;i++) SMK.spawn(x+rand(-0.2,0.2),y,z+rand(-0.2,0.2),rand(-0.4,0.4),rand(0.3,0.8),rand(-0.4,0.4),0x3f5a1e,0.5,1.5,rand(0.7,1.0),-0.4,1,0.3);
    if(low){ EFX.ring(x,gy+0.06,z,0x9fdc4a,0.3,2.0*big,0.4,0.65); VFX.decal(x,gy,z,1.3*big,0,0x2f5216,0.62,10,0xb8f25a,1.2); }
  } else if(elKey==='lightning'){
    ZAPBURST.spawn(x,y,z,2.6*big); VFX.flare(x,y,z,0xcdbcff,0.8*big,0.08); EFX.light(x,y,z,0xc8b4ff,3.4*big,0.18);   // Blenderben renderelt villám-csillag flipbook (15-fire-burst.js)
    for(let i=0;i<3;i++){ const a=rand(0,6.28), pp=Math.acos(rand(-1,1)), L=rand(0.9,2.0)*big; EFX.bolt(x,y,z, x+Math.sin(pp)*Math.cos(a)*L, y+Math.cos(pp)*L, z+Math.sin(pp)*Math.sin(a)*L, i%2?0xcdbcff:0xa98cff, rand(0.12,0.2), 0.22, 0.045, true); }
    VFX.spray(x,y,z,head?16:11,[0xffffff,0xd8ccff],11*big,{up:-0.4,life:0.2,grav:3,drag:4,w:0.013,len:0.03});
    if(low){ EFX.ring(x,gy+0.06,z,0xb48cff,0.3,2.4*big,0.32,0.75); VFX.decal(x,gy,z,1.1*big,1,0x0b0812,0.7,6,0x9a78ff,0.9); }
  }
}
// MÉREGTÓCSA: felülnézetes Blender flipbook a talajon (POISONPOOL, 15-fire-burst.js) a becsapódás ALATT, R = a valódi méreg-sugár
// (a tócsa területe ~R sugarú kör, a kifröccsenő ujjak kicsit túlnyúlnak), körben lassan felszálló alacsony mérgező pára és buborék-pukkanások.
function poisonPool(x,y,z,R,durMul){
  const gy=flipbookGround(x,y,z), lowFx=gfxTier==='low';
  POISONPOOL.spawn(x,y,z,R*2.6,durMul);
  for(let i=0,n=lowFx?3:5;i<n;i++){ const a=i/n*6.283+rand(-0.4,0.4), rr=R*rand(0.7,0.95), ca=Math.cos(a), sa=Math.sin(a);
    SMK.spawn(x+ca*rr,gy+0.18,z+sa*rr, ca*0.18,rand(0.22,0.42),sa*0.18, pick([0x5e8f22,0x4f7d1c,0x6f9f2a]), 0.45*Math.sqrt(R),1.25*Math.sqrt(R), rand(1.3,1.9), -0.1,0.9, 0.34); }
  for(let i=0,n=lowFx?3:6;i<n;i++){ const a=rand(0,6.283), rr=R*0.7*Math.sqrt(Math.random());
    RP.spawn(x+Math.cos(a)*rr,gy+0.06,z+Math.sin(a)*rr, 0,rand(0.25,0.7),0, pick([0xc8f26a,0xe2ff9a,0x9fdc4a]), rand(0.16,0.26),rand(0.45,0.6), rand(0.4,0.75), -0.3,1.2, 0.75); }
}
function applyStatus(m, elKey, charge, stacksToAdd){
  const def=EL[elKey]; if(!def||!def.status) return;          // ALAP = nincs státusz
  const st=def.status, s=STATUS_CFG[st];
  const add=(stacksToAdd!=null?stacksToAdd:((charge!=null&&charge>=0.66)?2:1));   // teli húrnál 2 stack
  const dur=s.dur*Math.min((m.resist&&m.resist[st])?m.resist[st]:1, 1.6);   // sebezhető trollon tovább tart (cap 1.6×)
  if(m.statusEl===st){                                        // ugyanaz az elem → STACK + idő-frissítés
    m.statusStacks=Math.min(s.maxStacks||1, (m.statusStacks||1)+add); m.statusT=Math.max(m.statusT, dur);
  } else {                                                    // új elem felülírja a primer slotot
    m.statusEl=st; m.statusT=dur; m.burnAcc=0; m.statusStacks=Math.min(s.maxStacks||1, add);
  }
  if(st==='ice'){ m.slowMul=Math.max(0.25, s.slow + (s.slowRamp||0)*((m.statusStacks||1)-1)); freezeEncase(m);
    if((m.statusStacks||1)>=3 || (charge!=null&&charge>=0.85)) freezeFull(m);   // TELJES FAGY
  } else if(s.slow<1){ m.slowMul=Math.min(m.slowMul||1, s.slow); }
  if(s.stun>0) m.rooted=Math.max(m.rooted||0, s.stun);        // VILLÁM bénítás a meglévő root-tal
  if(st==='lightning') m.charged=Math.max(m.charged||0, 2.0); // tölött → jég-túltöltést enged
  if(st==='ice' && m.typeId==='scout') m.dashTimer=0;         // jég megszakítja a kobold lendületét
  if(m._eyeBase==null && m.eyes&&m.eyes[0]) m._eyeBase=m.eyes[0].material.emissive.getHex();
  if(m.eyes) m.eyes.forEach(e=>e.material.emissive.setHex(s.tint));  // szem-tint a státusz színére
}
function clearStatus(m){
  if(m.statusEl==='ice') m.wet=Math.max(m.wet||0, 2.5);       // olvadás → nedves (vezeti a villámot)
  m.statusEl=null; m.statusT=0; m.slowMul=1; m.statusStacks=1; m.frozenSolid=0;
  removeIceShell(m);   // ELEM-PRO: jégburok le (Group-bejárás, megosztott anyagok maradnak)
  if(m._eyeBase!=null && m.eyes) m.eyes.forEach(e=>e.material.emissive.setHex(m._eyeBase));
  if(m._skinEmBase!=null && m.bodySkin){ m.bodySkin.emissive.setHex(m._skinEmBase.h); m.bodySkin.emissiveIntensity=m._skinEmBase.i; m._skinEmBase=null; }
}
function tickStatus(m, dt){
  if(m.wet>0) m.wet-=dt;                                      // független flag-időzítők lecsengése
  if(m.charged>0) m.charged-=dt;
  if(m.frozenSolid>0){ m.frozenSolid-=dt;
    if(m.frozenSolid<=0 && m.iceShell && m.iceShell.userData.full && m.statusEl==='ice'){ removeIceShell(m); freezeEncase(m); } }   // tömb -> vékony burok, ha a fagy-státusz még tart
  if(m.chill>0) m.chill-=dt;                                  // fagy-zóna lassítás (ideiglenes)
  if(!m.statusEl){ m.slowMul=(m.chill>0?0.55:1); return; }    // státusz nélkül: csak a fagy-zóna lassít, különben reset 1-re
  const s=STATUS_CFG[m.statusEl]; m.statusT-=dt;
  let dps=s.dps + (s.dpsRamp||0)*((m.statusStacks||1)-1);     // stack-skálázott DoT (tűz 7/10/13, méreg 4/6/8)
  if(m.resist && m.resist[m.statusEl]) dps*=m.resist[m.statusEl];   // per-troll ellenállás/sebezhetőség
  if(dps>0){ if(m.statusEl==='poison' && m.frozenSolid>0) dps*=1.3;   // FAGYOS ROTHADÁS: +30% méreg fagyott trollon
    m.burnAcc=(m.burnAcc||0)+dps*dt;                          // DoT egész sebzésre kvantálva
    if(m.burnAcc>=1){ const d=Math.floor(m.burnAcc); m.burnAcc-=d; m.hp-=d; m.hurtFlash=Math.max(m.hurtFlash,0.08);
      if(m.hp<=0 && m.alive){ killMonster(m,false); return; } } }
  let slow=(m.chill>0?0.55:1);                                // a státusz- és a fagy-zóna lassítás közül az erősebb
  if(m.statusEl==='ice') slow=Math.min(slow, Math.max(0.25, s.slow+(s.slowRamp||0)*((m.statusStacks||1)-1)));
  else if(s.slow<1) slow=Math.min(slow, s.slow);
  m.slowMul=slow;
  if(m.statusEl==='fire' && (m.statusStacks||1)>=2){ m._fireSpreadT=(m._fireSpreadT||0)-dt;   // TŰZ TERJEDÉS 2+ stacknél: ~1/mp átragad a legközelebbi trollra
    if(m._fireSpreadT<=0){ m._fireSpreadT=1.0; const sp=nearestTrolls(m.g.position.x,m.g.position.z,m,3.0,1);
      for(const tg of sp){ if(tg.statusEl!=='fire'){ const a=m.g.position, b=tg.g.position; EFX.bolt(a.x,a.y+(m.bodyCY||1),a.z,b.x,b.y+(tg.bodyCY||1),b.z,0xff9a3d,0.1,0.2); } applyStatus(tg,'fire',null,1); } } }
  statusAura(m, m.statusEl, dt);
  if(m.statusT<=0) clearStatus(m);
}
function setSkinEmissive(m,hex,inten){   // státusz-izzás a bőrön — az eredeti (innate) emissive elmentve, clearStatus visszaállítja
  if(!m.bodySkin) return;
  if(m._skinEmBase==null) m._skinEmBase={h:m.bodySkin.emissive.getHex(), i:m.bodySkin.emissiveIntensity};
  m.bodySkin.emissive.setHex(hex); m.bodySkin.emissiveIntensity=inten;
}
function statusAura(m, key, dt){
  const p=m.g.position, cy=p.y+(m.bodyCY||1), r=(m.bodyR||0.4);
  m._auraTime=(m._auraTime||0)+dt;
  const puls=0.5+0.5*Math.sin(m._auraTime*4+(m.seed||0)%31);
  if(key==='fire') setSkinEmissive(m,0xff5a2a,0.20+0.22*puls);         // izzó parázs-bőr
  else if(key==='ice') setSkinEmissive(m,0x36c5ff,0.12+0.08*puls);     // átfagyott derengés
  else if(key==='poison') setSkinEmissive(m,0x9fdc4a,0.12+0.14*puls);  // beteg zöld lüktetés
  else if(key==='lightning') setSkinEmissive(m,0xc8b4ff,0.15+0.35*Math.abs(Math.sin(m._auraTime*23)));
  if(key==='ice' && m.iceShell){
    const u=m.iceShell.userData; u.age=(u.age||0)+dt;
    const k=Math.min(1,u.age/0.28), grow=k*k*(3-2*k);
    m.iceShell.scale.set(0.94+0.06*grow,0.12+0.88*grow,0.94+0.06*grow);
  }
  if(key==='fire'){   // VALÓDI LÁNG a testen: gazdához kötött lángtest (a halmozódással nő), a részecskék már csak parázs + füst
    const st=m.statusStacks||1; VFX.hold(m, p.x, p.y, p.z, r*1.05, (m.headCY||cy*1.8)*(1.3+0.14*st), VFX.PAL.fire, 0.55+0.13*st); }
  const steps=fxSteps(m,'_auraAcc',dt,30);
  for(let step=0;step<steps;step++){
  if(key==='fire'){
    if(Math.random()<0.7) RP.spawn(p.x+rand(-r,r),cy+rand(-0.2,0.6),p.z+rand(-r,r), rand(-0.4,0.4),rand(1.4,2.8),rand(-0.4,0.4), pick([0xff8a3a,0xffc24d,0xfff1c4]), rand(0.18,0.34),0.02, rand(0.5,0.9), -1.5,1.2); // felszálló parázs
    if(Math.random()<0.22) SMK.spawn(p.x+rand(-r,r),cy+0.7,p.z+rand(-r,r), rand(-0.2,0.2),1.0,rand(-0.2,0.2), 0x20160e, 0.5,1.4, 0.8, -1,1, 0.3); // füst-pászma
  } else if(key==='ice'){
    const boost=(m.frozenSolid>0)?2:1;
    if(Math.random()<0.25*boost) RP.spawn(p.x+rand(-r,r),cy+rand(-0.3,0.5),p.z+rand(-r,r), rand(-0.2,0.2),rand(-0.3,0.2),rand(-0.2,0.2), pick([0xbfe6ff,0xe2f6ff]), rand(0.3,0.5),0.02, rand(0.5,0.9), 1,0.6); // lebegő dér
    if(Math.random()<0.09*boost) RP.spawn(p.x+rand(-r,r),cy+rand(0,0.6),p.z+rand(-r,r), 0,0,0, 0xffffff, 0.5,0.02, 0.35, 0,0); // csillám-villanás
    if(m.frozenSolid>0 && Math.random()<0.6) RP.spawn(p.x+rand(-r*1.5,r*1.5), cy+rand(0.4,1.2), p.z+rand(-r*1.5,r*1.5), rand(-0.15,0.15), rand(-0.9,-0.4), rand(-0.15,0.15), pick([0xe2f6ff,0xffffff]), 0.28,0.04, rand(0.7,1.1), 0.4,1.2); // hópehely-hullás a tömb körül
    if(Math.random()<0.05*boost) SMK.spawn(p.x+rand(-r,r),p.y+0.25,p.z+rand(-r,r), rand(-0.3,0.3),0.15,rand(-0.3,0.3), 0xcfe8f6, 0.5,1.3, 0.9, -0.1,1, 0.2); // fagyos pára a lábnál
  } else if(key==='poison'){
    if(Math.random()<0.8) RP.spawn(p.x+rand(-r,r),cy+rand(-0.2,0.3),p.z+rand(-r,r), rand(-0.15,0.15),rand(0.4,1.0),rand(-0.15,0.15), pick([0x7e9a2e,0x9fdc4a,0xc8e26a]), rand(0.35,0.6),0.5, rand(0.5,0.9), -1,1.5, 0.9); // emelkedő-pukkanó buborék
    if(Math.random()<0.3) VFX.streak(p.x+rand(-r,r),cy+0.3,p.z+rand(-r,r), rand(-0.3,0.3),-0.4,rand(-0.3,0.3), 0x9fdc4a, 0.5, 9, 0.5, 0.022, 0.07); // lecsöppenő méreg-szál
    if(Math.random()<0.10) SMK.spawn(p.x+rand(-r,r),cy+0.4,p.z+rand(-r,r), rand(-0.2,0.2),0.5,rand(-0.2,0.2), 0x3f5a1e, 0.45,1.2, 0.8, -0.4,1, 0.24); // beteg pára
  } else if(key==='lightning'){
    if(Math.random()<0.45) EFX.bolt(p.x+rand(-r,r),cy+0.6+rand(-0.2,0.2),p.z+rand(-r,r), p.x+rand(-r,r),cy-0.6+rand(-0.2,0.2),p.z+rand(-r,r), Math.random()<0.5?0xffffff:0xcdbcff, 0.09, 0.22, 0.035, true); // testen átugró ívek
    if(Math.random()<0.5) VFX.streak(p.x+rand(-r,r),cy+rand(-0.4,0.5),p.z+rand(-r,r), rand(-4,4),rand(-1,4),rand(-4,4), 0xe6dcff, 0.16, 4, 3, 0.012, 0.03); // sercegő szikra
  }
  }
}
function elementalDeath(m){
  const k=m.statusEl||m.el; if(!k) return;                    // elemi státusszal VAGY innate elemmel halt
  const p=m.g.position, bx=p.x, by=p.y+(m.bodyCY||1), bz=p.z, gy=GROUND_Y, s=clamp(m.scale||1,0.8,1.8);
  if(k==='fire'){                                             // ELHAMVAD: tűzgolyó + felcsapó lángoszlop + parázs-eső + füst + izzó perzselés
    VFX.ball(bx,by,bz,0.5*s,2.3*s,0.6,VFX.PAL.fire); VFX.flame(bx,gy,bz,0.95*s,3.4*s,0.8,VFX.PAL.fire); VFX.flare(bx,by,bz,0xffd9a0,2.6*s,0.16);
    EFX.light(bx,by,bz,0xff7a3d,5,0.5); EFX.ring(bx,gy+0.06,bz,0xff8a3a,0.5,4.2*s,0.55,0.8);
    VFX.spray(bx,by,bz,26,[0xffd27a,0xff8a3a,0xff5a2a],9*s,{up:0,lift:2,life:0.8,grav:8,w:0.024,len:0.055});
    for(let i=0;i<14;i++) RP.spawn(bx+rand(-0.6,0.6),by+rand(-0.4,0.8),bz+rand(-0.6,0.6),rand(-0.8,0.8),rand(1,3),rand(-0.8,0.8),pick([0xff8a3a,0xffc24d,0xfff1c4]),rand(0.3,0.55),0.03,rand(0.7,1.3),-1.2,1.1);
    for(let i=0;i<7;i++) SMK.spawn(bx+rand(-0.3,0.3),by+rand(0,0.4),bz+rand(-0.3,0.3),rand(-0.6,0.6),rand(1,2.2),rand(-0.6,0.6),0x20160e,0.7,2.4,rand(1,1.6),-1.2,0.8,0.45);
    VFX.decal(bx,gy,bz,2.4*s,0,0x120805,0.78,12,0xff6a1a,3.5);
  } else if(k==='ice'){                                       // SZÉTFAGY: jég-maradvány kitör és szétpattan + szilánk-eső + dér-folt
    VFX.crystal(bx,gy,bz,0.8*s,1.5*s,0.42,rand(-0.2,0.2),rand(-0.2,0.2)); VFX.flare(bx,by,bz,0xdff6ff,2.4*s,0.15);
    EFX.light(bx,by,bz,0x9fd0ff,4,0.4); EFX.ring(bx,gy+0.06,bz,0xbfe6ff,0.5,3.8*s,0.5,0.85);
    VFX.spray(bx,by,bz,30,[0xffffff,0xbfe9ff,0x8fd4ff],10*s,{up:-0.2,lift:1,life:0.6,grav:13,w:0.028,len:0.03});
    for(let i=0;i<16;i++) RP.spawn(bx,by,bz,rand(-3,3),rand(-0.5,3),rand(-3,3),pick([0xbfe9ff,0xe2f6ff,0xffffff]),rand(0.35,0.6),0.02,rand(0.5,0.9),4,0.8);
    for(let i=0;i<3;i++) SMK.spawn(bx+rand(-0.4,0.4),by-0.4,bz+rand(-0.4,0.4),rand(-0.5,0.5),rand(0.1,0.5),rand(-0.5,0.5),0xcfe8f6,0.6,2.0,rand(0.8,1.2),-0.2,1,0.3);
    VFX.decal(bx,gy,bz,2.3*s,0,0xbfe2f4,0.55,10);
  } else if(k==='poison'){                                    // ELOLVAD: méreg-fröccs + tócsa + buborék + MARADÓ gázfelhő
    poisonPool(bx,p.y,bz,ZONE_CFG.gas.rMax,1.15); VFX.flare(bx,by,bz,0xd8ff9a,1.2*s,0.12);   // a tócsa akkora, mint az ottmaradó gázfelhő EFX.light(bx,by,bz,0x9fdc4a,3.5,0.45); EFX.ring(bx,gy+0.06,bz,0x9fdc4a,0.5,3.6*s,0.65,0.7); spawnGasCloud(bx, p.y, bz);
    VFX.spray(bx,by,bz,18,[0xc8f26a,0x9fdc4a,0x6fae2a],7*s,{up:0,lift:1.5,life:0.7,grav:14,w:0.032,len:0.07});
    for(let i=0;i<18;i++){ const a=rand(0,6.28),v=rand(1.5,5); RP.spawn(bx,by,bz,Math.cos(a)*v,rand(-1,3),Math.sin(a)*v,pick([0x7e9a2e,0x9fdc4a,0xc8e26a]),rand(0.5,0.9),0.05,rand(0.5,0.9),6,1); }
    for(let i=0;i<8;i++) RP.spawn(bx+rand(-0.4,0.4),gy+0.05,bz+rand(-0.4,0.4),rand(-0.2,0.2),rand(0.5,1.2),rand(-0.2,0.2),0xc8e26a,0.5,0.7,0.7,-1,1,0.9);
    VFX.decal(bx,gy,bz,2.3*s,0,0x2f5216,0.68,12,0xb8f25a,1.6);
  } else if(k==='lightning'){                                 // ELSZENESEDIK: fényoszlop + elágazó ívvihar + korom-repedés
    VFX.column(bx,gy,bz,0.55*s,12,0xcdbcff,0.22); VFX.flare(bx,by,bz,0xffffff,3.0*s,0.13);
    EFX.light(bx,by,bz,0xc8b4ff,5.5,0.3); EFX.ring(bx,gy+0.06,bz,0xb48cff,0.5,4.0*s,0.4,0.85);
    for(let i=0;i<8;i++){ const a=rand(0,6.28),pp=Math.acos(rand(-1,1)),L=rand(1.5,3.4); EFX.bolt(bx,by,bz, bx+Math.sin(pp)*Math.cos(a)*L,Math.max(gy+0.1,by+Math.cos(pp)*L),bz+Math.sin(pp)*Math.sin(a)*L, i%2?0xcdbcff:0xffffff,rand(0.16,0.26),0.3,0.06,i>3); }
    VFX.spray(bx,by,bz,22,[0xffffff,0xd8ccff,0x9a78ff],13*s,{up:-0.3,life:0.25,grav:3,drag:4,w:0.014,len:0.03});
    VFX.decal(bx,gy,bz,2.0*s,1,0x0b0812,0.78,9,0x9a78ff,1.4);
  }
  shake=Math.max(shake,0.28); gainUlt(6);   // elemi státusszal megölt troll tölti a VIHAR-t
}

/* --- elem-választó HUD (a HUD aljára, középre; a menük z-index 10 eltakarják) --- */
let _elHud=null;
function buildElementHUD(){
  const wrap=document.createElement('div'); wrap.id='elhud';
  EL_ORDER.forEach((id,i)=>{ const def=EL[id];
    const chip=document.createElement('div'); chip.className='elc'; chip.dataset.el=id; chip.style.setProperty('--c',def.ui);
    chip.innerHTML='<span class="k">'+(i+1)+'</span><span class="gem"></span><span class="nm"></span>'; chip.querySelector('.nm').textContent=elementName(id);
    wrap.appendChild(chip); });
  document.body.appendChild(wrap); _elHud=wrap; updateElementHUD();
}
function updateElementHUD(){
  if(!_elHud) return;
  _elHud.querySelectorAll('[data-el]').forEach(chip=>chip.classList.toggle('on', chip.dataset.el===currentElement));
}
let lastSwapT=-999, ult=0, _ultBar=null;
const nockVis={ el:'base', tip:null, glow:null, elemHolder:null, flames:null, _isNock:true };
function updateNockElement(){   // a nockolt nyíl FINOMAN mutassa az elemet — a hegy LÁTSZÓDJON, ne vakítson
  const na=nockArrow; if(!na._tip) return; const def=EL[currentElement]||EL.base, base=(currentElement==='base');
  if(na._tip.material){ na._tip.material.emissive.setHex(base?0x000000:def.head); na._tip.material.emissiveIntensity=base?0:0.45; na._tip.visible=true; }   // a fém hegy mindig látszik, csak izzik
  if(na._glow){ na._glow.material.color.setHex(def.glow); na._glow.material.opacity=base?0:0.2; }
  bowInlayMat.emissive.setHex(base?0x2b4254:def.glow); bowInlayMat.emissiveIntensity=base?0.25:1.0;   // íj-berakás az elem színében
  nockVis.el=currentElement; nockVis.elemHolder=na._elemHolder; nockVis.flames=null; buildElemHead(nockVis); na._flames=nockVis.flames;   // elem-specifikus fej (megosztott, nincs dispose/new)
}
function animateNock(t){   // finom, elem-megfelelő pulzálás feszítés közben
  const na=nockArrow; if(!na._glow || currentElement==='base') return;
  na._glow.material.opacity=0.2*(0.6+0.4*Math.sin(t*7));
  if(na._flames) for(let i=0;i<na._flames.length;i++){ const sp=na._flames[i]; if(sp.material) sp.material.opacity=0.4+0.35*Math.abs(Math.sin(t*12+i)); }
}
const _swV=new THREE.Vector3();
function elementSwapFx(id){   // elemváltás: az íj megpördül, a markolat előtt az új elem színében szikra-koszorú villan
  if(!running || id==='base') return;
  camera.getWorldDirection(_swV); const col=EL[id].fx, rx=Math.cos(player.yaw), rz=-Math.sin(player.yaw);
  const x=camera.position.x+_swV.x*0.8+rx*0.24, y=camera.position.y+_swV.y*0.8-0.13, z=camera.position.z+_swV.z*0.8+rz*0.24;
  VFX.flare(x,y,z,col,0.45,0.22);
  for(let i=0;i<8;i++){ const a=i*0.785+rand(0,0.5), c=Math.cos(a)*1.5;
    VFX.streak(x,y,z, rx*c+_swV.x*0.5, Math.sin(a)*1.5+0.4, rz*c+_swV.z*0.5, col, rand(0.18,0.3), 3, 2.5, 0.007, 0.06); }
}
function setElement(id){ if(!EL[id]) return; if(id!==currentElement){ bowLag.swap=1; elementSwapFx(id); } currentElement=id; lastSwapT=performance.now()*0.001; updateElementHUD(); updateNockElement(); updateMobileElementButtons(); }   // PLAYER: rezonancia-ablak nyílik váltáskor + nock frissül
function gainUlt(n){ ult=Math.min(100, ult+n*RUNM.ultMul); }   // FEJLESZTÉS: Vihar-Vezeték (ult-töltés szorzó; a 100-as plafon marad)
function buildUltHud(){
  const w=document.createElement('div'); w.id='ulthud'; w.innerHTML='<div id="ultlab"></div><div class="ut"><div class="ub"></div></div>';
  document.body.appendChild(w); _ultBar=w.querySelector('.ub'); _ultWrap=w; _ultLab=w.querySelector('#ultlab'); _ultLab.textContent=tr('hud.ult');
}
let _mUlt=null, _ultLab=null, _ultWrap=null, _ultChip=null, _ultChipEl=null, _ultRes=null, _lastUlt=-1, _lastElHud=null;
function updateUltHud(){
  if(!_ultBar) return; const def=EL[currentElement]||EL.base;
  // chip rezonancia-ragyogás: osztály-váltás csak állapotváltozáskor (nincs per-frame stílus-írás / querySelector)
  if(_elHud){ if(_ultChipEl!==currentElement){ if(_ultChip) _ultChip.classList.remove('res'); _ultChip=_elHud.querySelector('[data-el="'+currentElement+'"]'); _ultChipEl=currentElement; _ultRes=null; }
    if(_ultChip){ const res=(performance.now()*0.001-lastSwapT)<1.2; if(res!==_ultRes){ _ultRes=res; _ultChip.classList.toggle('res',res); } } }
  if(ult===_lastUlt && currentElement===_lastElHud) return;   // a sáv + címke csak változáskor
  _lastUlt=ult; _lastElHud=currentElement; const full=ult>=100;
  _ultBar.style.width=Math.min(100,ult)+'%'; _ultBar.style.background=full?'linear-gradient(90deg,#ffd27a,#fff)':('linear-gradient(90deg,'+def.ui+'88,'+def.ui+')');
  if(_ultWrap) _ultWrap.classList.toggle('full',full);
  if(MOBILE_INPUT){ if(!_mUlt) _mUlt=document.getElementById('mobileUlt'); if(_mUlt){ _mUlt.style.setProperty('--ult',Math.min(100,ult).toFixed(0)); _mUlt.style.setProperty('--ec',def.ui); if(_mUlt.classList.contains('ready')!==full){ _mUlt.classList.toggle('ready',full); if(full) buzz([20,40,20]); } } }
  if(_ultLab) _ultLab.textContent=full?tr('hud.ultReady'):tr('hud.ult');
}
function fireVihar(){   // VIHAR ultimate — TURBÓ: hullámmal skálázódó csapás + elem-specifikus pálya-esemény + játékos-TÚLTÖLTÉS
  if(ult<100 || !running) return; ult=0; const el=currentElement, def=EL[el]||EL.base; const px=player.pos.x, pz=player.pos.z;
  // közös (SP + co-op) játékos-oldal: égbolt-villanás, túltöltés (gyors húzás/töltés + ×1.5 elemi erő), rövid sérthetetlenség
  stormK=1; SKY_U.uStormCol.value.setHex(def.glow); gradePass&&gradePass.uniforms.uTint.value.setHex(def.glow);
  overT=7; player.invulnT=Math.max(player.invulnT||0,1.6); slowT=Math.max(slowT,0.45);
  if(AUD.storm) AUD.storm(); callout(tr('ui.vihar2'),true);
  if(coop){ coop.send({t:'ult', el:el}); toast(tr('toast.vihar',{element:elementName(el)})); if(AUD.head)AUD.head(); return; }   // co-op: a szerver alkalmazza + broadcastolja a nova-t mindenkinek
  // VIHAR-kitörés a játékosnál: fényoszlop + kettős lökéshullám + izzó repedés-háló a lába alatt (a képernyőt NEM mossa fehérre)
  EFX.flash(px,GROUND_Y+2,pz, def.fx, 1, ARENA_R*0.8, 0.5, 0.4); EFX.ring(px,GROUND_Y+0.05,pz, def.fx, 1, ARENA_R, 0.9, 0.95); EFX.ring(px,GROUND_Y+0.08,pz, 0xffffff, 0.5, ARENA_R*0.7, 0.6, 0.6); EFX.light(px,GROUND_Y+3,pz, def.glow, 9, 0.7);
  VFX.column(px,GROUND_Y,pz,1.5,26,def.fx,0.7); VFX.flare(px,GROUND_Y+1.6,pz,def.fx,7,0.3); VFX.decal(px,GROUND_Y,pz,4.2,1,0x0c0a10,0.85,7,def.fx,2.6);
  VFX.spray(px,GROUND_Y+0.4,pz,30,def.fx,14,{up:0.1,lift:3,life:0.7,grav:9,w:0.022,len:0.06});
  shake=Math.max(shake,0.8); if(AUD.head)AUD.head(); toast(tr('toast.vihar',{element:elementName(el)}));
  setHp(player.hp+player.maxHp*0.10);
  const vd=14+wave*3+(RUNM.viharDmg||0); let zn=0, bolts=0;   // a csapás a hullámmal nő -> késői hullámokban is számít
  const tgs=monsters.filter(o=>o.alive && !(o.dying>0) && !coopIsRemote(o));
  for(const o of tgs){ o.hurtFlash=0.3; const b=o.g.position, by=b.y+(o.bodyCY||1);
    if(bolts++<12){ VFX.bolt(b.x+rand(-3,3),34,b.z+rand(-3,3), b.x,by,b.z, def.fx, 0.3, 1.0, 0.2);   // égből lecsapó, elágazó villám minden trollra + elem-specifikus kitörés
      VFX.flare(b.x,by,b.z,def.fx,2.4,0.2); VFX.ring(b.x,GROUND_Y+0.06,b.z,def.fx,0.3,2.6,0.4,0.7);
      if(el==='fire') VFX.flame(b.x,GROUND_Y,b.z,1.1,4.2,0.9,VFX.PAL.fire,1);
      else if(el==='ice') VFX.crystal(b.x,GROUND_Y-0.04,b.z,0.9,2.4,0.7,rand(-0.2,0.2),rand(-0.2,0.2));
      else if(el==='poison') VFX.ball(b.x,by,b.z,0.4,1.7,0.5,VFX.PAL.toxic);
      else if(el==='lightning') VFX.column(b.x,GROUND_Y,b.z,0.5,20,def.fx,0.4);
      else VFX.debris(b.x,GROUND_Y+0.2,b.z,8,[0xc9b48f,0x8f7d62],6,{up:0.4,lift:3,life:0.8,w:0.07}); }
    VFX.spray(b.x,by,b.z,8,def.fx,7,{up:-0.2,lift:1.5,life:0.45,grav:6,w:0.02,len:0.05});
    let dmg=vd;
    if(el==='base'){ dmg*=2.2; const dx=b.x-px, dz=b.z-pz, d=Math.hypot(dx,dz)||1, kb=(o.boss?1.5:5)/Math.max(0.7,o.scale||1); b.x+=dx/d*kb; b.z+=dz/d*kb; o.rooted=Math.max(o.rooted||0,0.8); }   // ALAP: lökéshullám + dupla sebzés
    else { applyStatus(o, el, null, 3);
      if(el==='ice'){ if(!o.boss) freezeFull(o); }                                            // JÉG: mindenki teljes fagy
      else if(el==='fire'){ if(zn++<5) spawnZone('fire', b.x, b.z); }                         // TŰZ: lángmezők a trollok alatt
      else if(el==='poison'){ if(zn++<5) spawnZone('gas', b.x, b.z); }                        // MÉREG: tartós gázfelhők
      else if(el==='lightning'){ dmg*=1.6; o.rooted=Math.max(o.rooted||0,1.5); } }           // VILLÁM: erősebb csapás + bénítás
    o.hp-=dmg;
    if(o.hp<=0&&o.alive) killMonster(o,false); }
}

/* ===================== ELEM-PRO: látható nyilak + elem-logika =====================
   Minden elem saját mechanikát kap (nem csak szín): tűz=DoT+terjedés, jég=fagy/szilánk,
   méreg=megmaradó gázfelhő, villám=lánc. A nyil hegyén látható az elem (buildElemHead). */
let zones=[], burningCount=0;   // ELEM-ENV: egységes zóna-registry (gáz/tűz/fagy/tócsa/gőz), max 10
// fx: a zóna talaj-korongjának örvény-shader beállítása (VFX.disc) — a játékszabály-mezők (rMax/max/dps/el) változatlanok
const ZONE_CFG={
  gas:    { rMax:2.2, max:4.5, dps:3, el:'poison', fx:{a:0x2a6418,b:0x9ede48,core:0,add:false,swirl:1.2,speed:0.07,soft:0.5,blob:1,alpha:0.8} },
  fire:   { rMax:2.5, max:5.0, dps:5, el:'fire',   fx:{a:0xb02a08,b:0xff9a30,core:0xffd080,add:true,swirl:1.4,speed:0.18,soft:0.5,blob:0.6,alpha:0.5} },
  frost:  { rMax:2.4, max:6.0, dps:0, el:'ice',    fx:{a:0x6fb4e4,b:0xeaf8ff,core:0,add:false,swirl:0.5,speed:0.015,soft:0.35,blob:1,alpha:0.55} },
  puddle: { rMax:2.5, max:6.0, dps:0, el:null,     fx:{a:0x173a5c,b:0x5f9ed0,core:0,add:false,swirl:0.3,speed:0.02,soft:0.3,blob:0.35,alpha:0.6} },
  steam:  { rMax:3.5, max:1.5, dps:0, el:null,     fx:{a:0x8fa6b8,b:0xffffff,core:0,add:true,swirl:1.8,speed:0.14,soft:0.6,blob:1,alpha:0.22} }
};
const ELEM_HEAD_RES=(function(){
  const iceGeo=new THREE.OctahedronGeometry(0.075,0), poisonGeo=new THREE.SphereGeometry(0.06,8,6);
  const iceMat=new THREE.MeshStandardMaterial({color:0x9fe3ff,emissive:0x6fd8ff,emissiveIntensity:1.2,transparent:true,opacity:0.85,flatShading:false,roughness:0.3});
  const poisonMat=new THREE.MeshStandardMaterial({color:0x9fdc4a,emissive:0x7e9a2e,emissiveIntensity:0.9,transparent:true,opacity:0.92,flatShading:false,roughness:0.4});
  return { iceGeo, poisonGeo, iceMat, poisonMat };
})();
function buildElemHead(a){
  const h=a.elemHolder; if(!h) return;
  const el=a.el, dim=!!a._isNock;
  if(!h._byEl){
    const groups={}, flames=[];
    const sp=(col,op,sc)=>{ const s=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:col,transparent:true,opacity:op*(dim?0.5:1),depthWrite:false,blending:THREE.AdditiveBlending})); s.scale.setScalar(sc); enableBloom(s); return s; };
    const fg=new THREE.Group();
    for(let i=0;i<3;i++){ const s=sp(i?0xff7a3d:0xffe08a,0.9,0.34-i*0.06); s.position.set(0,0.02+i*0.03,-0.04); fg.add(s); flames.push(s); }
    groups.fire=fg;
    const ig=new THREE.Group(), cr=new THREE.Mesh(ELEM_HEAD_RES.iceGeo, dim?ELEM_HEAD_RES.iceMat.clone():ELEM_HEAD_RES.iceMat);
    if(dim) cr.material.opacity*=0.5;
    cr.position.set(0,0,-0.02); cr.scale.set(1,1,1.6); enableBloom(cr); ig.add(cr); ig.add(sp(0xe2f6ff,0.55,0.3));
    groups.ice=ig;
    const pg=new THREE.Group(), blob=new THREE.Mesh(ELEM_HEAD_RES.poisonGeo, dim?ELEM_HEAD_RES.poisonMat.clone():ELEM_HEAD_RES.poisonMat);
    if(dim) blob.material.opacity*=0.5;
    blob.position.set(0,-0.01,-0.02); blob.scale.set(1,1.4,1); enableBloom(blob); pg.add(blob); pg.add(sp(0xc8e26a,0.5,0.26));
    groups.poison=pg;
    const lg=new THREE.Group(); lg.add(sp(0xffffff,0.95,0.32)); lg.add(sp(0xb48cff,0.7,0.5));
    groups.lightning=lg;
    for(const k in groups){ groups[k].visible=false; h.add(groups[k]); }
    h._byEl=groups; h._flames=flames;
  }
  for(const k in h._byEl) h._byEl[k].visible=(k===el);
  a.flames=(el==='fire')?h._flames:null;
}
function arcSpark(from,to,color,n){ const k=n*5; for(let i=0;i<k;i++){ const t=i/k; sparks.burst(from.x+(to.x-from.x)*t+rand(-0.15,0.15), from.y+(to.y-from.y)*t+rand(-0.15,0.15), from.z+(to.z-from.z)*t+rand(-0.15,0.15), 1, color, 0.2, 0); } }
function nearestTrolls(x,z,exclude,radius,max){ const out=[]; for(const o of monsters){ if(!o.alive||o.dying>0||o===exclude||coopIsRemote(o)) continue; const d=Math.hypot(o.g.position.x-x,o.g.position.z-z); if(d-Math.min(o.bodyR||0.4,0.7)<radius) out.push([d,o]); } out.sort((a,b)=>a[0]-b[0]); return out.slice(0,max).map(e=>e[1]); }   // él-tudatos (a test széle számít), de a bónusz 0.7-re sapkázva, hogy a nagy AoE ne tarolja az arénát
function chainLightning(hit,dmg){   // ELEM-ENV: nedves/tócsa-trollok vezetik → nagyobb hatótáv + több csomópont + erősebb ív
  const hx=hit.g.position.x, hz=hit.g.position.z;
  const anyWet=monsters.some(o=>o.alive&&o.dying<=0&&!coopIsRemote(o)&&o.wet>0&&Math.hypot(o.g.position.x-hx,o.g.position.z-hz)<10);
  const radius=anyWet?10:7, maxNodes=anyWet?5:3;
  const cand=nearestTrolls(hx,hz,hit,radius,5); cand.sort((a,b)=>((b.wet>0)-(a.wet>0)));   // nedves trollok előnyben
  let prev=hit, nodes=1;
  for(const tg of cand){ if(nodes>=maxNodes) break;
    const a=prev.g.position, ay=a.y+(prev.bodyCY||1), b=tg.g.position, by=b.y+(tg.bodyCY||1);
    VFX.bolt(a.x,ay,a.z,b.x,by,b.z,0xb9a4ff,0.2,0.45); ZAPBURST.spawn(b.x,by,b.z,2.1,1,(tg.bodyR||0.5)+0.15); EFX.light(b.x,by,b.z,0xc8b4ff,2.4,0.18);   // csomópont: villám-csillag a test kamera felőli oldalán
    VFX.spray(b.x,by,b.z,8,[0xffffff,0xd8ccff],8,{up:-0.4,life:0.22,grav:3,drag:4,w:0.014,len:0.03});
    tg.hp-=dmg*(tg.wet>0?0.9:0.5); tg.hurtFlash=0.15; applyStatus(tg,'lightning'); if(tg.hp<=0&&tg.alive) killMonster(tg,false); prev=tg; nodes++; }
  shake=Math.max(shake,0.12);
}
