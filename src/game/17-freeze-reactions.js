/* ===== TELJES FAGY v2 — több-részes jégtömb: héj + perem + mag + jégcsapok/kristálytüskék =====
   m.iceShell = EGY Group (a handle-szerződés marad). Anyagok MEGOSZTOTTAK (ICE_MATS, sose dispose-oljuk,
   a warmup lefordítja) -> nincs shader-recompile; a geometria per-fagy épül (olcsó, merge-elt), removeIceShell dobja. */
const ICE_MATS={
  shellEncase: new THREE.MeshStandardMaterial({color:0xbfe6ff, emissive:0x6fd8ff, emissiveIntensity:0.50,
      transparent:true, opacity:0.55, flatShading:false, roughness:0.22, metalness:0, depthWrite:false}),
  shellFull:   new THREE.MeshStandardMaterial({color:0xa8dcf5, emissive:0x3fa8e0, emissiveIntensity:0.55,
      transparent:true, opacity:0.80, flatShading:false, roughness:0.15, metalness:0}),   // op>=0.78 -> tömörnek olvasható, nem szellem; telített jég-cián
  core:        new THREE.MeshStandardMaterial({color:0x6fa8cc, emissive:0x1d4a66, emissiveIntensity:0.35,
      transparent:true, opacity:0.92, flatShading:false, roughness:0.30, vertexColors:true}),   // belső jégmag: sötétebb kék tömeg -> a héj facettái kirajzolódnak rajta
  rim:         new THREE.MeshBasicMaterial({color:0x9fe8ff, transparent:true, opacity:0.50,
      side:THREE.BackSide, blending:THREE.AdditiveBlending, depthWrite:false}),   // fake-Fresnel perem: éjszakai háttéren élesen tartja a kontúrt
  cryst:       new THREE.MeshStandardMaterial({color:0x8fd8ff, emissive:0x4fc8ff, emissiveIntensity:1.25,
      transparent:true, opacity:0.92, flatShading:false, roughness:0.25, vertexColors:true})   // jégcsap/kristály: erős cián izzás, hogy a héjon is átüssön
};
function buildIceShell(m, full){
  const R=(m.bodyR/m.scale)*1.25, cy=m.bodyCY/m.scale;   // lokális (skálázatlan) egységek — m.g skálázza
  const g=new THREE.Group(); g.userData={full:!!full, born:performance.now()};
  if(!full){   // ENCASED (1-2 jég-stack): áttetszőbb héj + pár jégcsap/kristály — a troll még látszik
    const sh=new THREE.Mesh(jitter(new THREE.IcosahedronGeometry(R,1),0.09,0.07), ICE_MATS.shellEncase);
    sh.position.y=cy; sh.scale.set(1,1.35,1); g.add(sh);
    const cl=[];
    for(let i=0;i<4;i++){ const a=rand(0,6.28);
      cl.push({geo:gradTint(new THREE.ConeGeometry(rand(0.06,0.10), rand(0.30,0.55), 5),0x8fc9e8,0xffffff,-0.4,0.4),
        x:Math.cos(a)*R*0.9, y:cy-rand(0.5,0.75), z:Math.sin(a)*R*0.9, rx:Math.PI}); }   // lelógó jégcsapok (hegyük fehér)
    for(let i=0;i<3;i++){ const a=rand(0,6.28);
      cl.push({geo:gradTint(new THREE.OctahedronGeometry(0.10+Math.random()*0.05,0),0x5f88a8,0xffffff,-0.15,0.15),
        x:Math.cos(a)*R*0.9, y:cy+rand(0.2,0.6), z:Math.sin(a)*R*0.9,
        sy:1.6+Math.random()*0.6, rx:rand(-0.5,0.5), rz:rand(-0.5,0.5)}); }   // vállmagasságú kristályok
    { const cm=new THREE.Mesh(mergeGeos(cl), ICE_MATS.cryst); g.add(cm); enableBloom(cm); }   // csak a kristályok izzanak (a nagy héj-felület NEM -> nincs vakító blob)
  } else {     // TELJES FAGY: tömör jégtömb — héj + additív perem + majdnem átlátszatlan mag + kristálykoszorú
    const shGeo=jitter(new THREE.IcosahedronGeometry(R*1.12,1),0.12,0.10);
    const sh=new THREE.Mesh(shGeo, ICE_MATS.shellFull); sh.position.y=cy; sh.scale.set(1.05,1.42,1.05); sh.castShadow=true; g.add(sh);
    const rim=new THREE.Mesh(shGeo, ICE_MATS.rim); rim.position.y=cy; rim.scale.set(1.11,1.50,1.11); g.add(rim); enableBloom(rim);   // additív perem izzik (éles jég-kontúr); a héj-felület NEM
    const core=new THREE.Mesh(gradTint(jitter(new THREE.IcosahedronGeometry(R*0.7,1),0.06,0.05),0x527e9c,0xd8f0ff,-0.9,0.9), ICE_MATS.core);
    core.position.y=cy; core.scale.set(1,1.35,1); g.add(core);
    const RH=R*1.19, RV=R*1.69, cl=[], nIci=8+((Math.random()*3)|0);   // a héj fél-tengelyei: 1.12R*1.05 vízszintes, 1.12R*1.42 függőleges
    for(let i=0;i<nIci;i++){ const a=(i/nIci)*6.283+rand(-0.3,0.3), yy=cy-rand(0.55,0.85);
      const rr=RH*Math.sqrt(Math.max(0.1,1-((yy-cy)/RV)*((yy-cy)/RV)))*(1.02+Math.random()*0.12);   // a héj-felszín KÜLSŐ oldalán lógnak
      cl.push({geo:gradTint(new THREE.ConeGeometry(rand(0.06,0.11), rand(0.35,0.75), 5),0x8fc9e8,0xffffff,-0.4,0.4),
        x:Math.cos(a)*rr, y:yy, z:Math.sin(a)*rr, rx:Math.PI}); }   // jégcsap-koszorú az alsó perem alatt
    const nSp=7+((Math.random()*3)|0);
    for(let i=0;i<nSp;i++){ const a=rand(0,6.28), yy=rand(-0.5,0.6), hh=Math.sqrt(1-yy*yy);
      cl.push({geo:gradTint(new THREE.OctahedronGeometry(0.13+Math.random()*0.08,0),0x5f88a8,0xffffff,-0.2,0.2),
        x:Math.cos(a)*hh*RH*1.02, y:cy+yy*RV*1.0, z:Math.sin(a)*hh*RH*1.02,
        sy:1.7+Math.random()*0.9, rx:rand(-0.6,0.6), rz:rand(-0.6,0.6)}); }   // kiálló tüskék a héj felszínéből (shard-troll recept, jég-színben)
    { const cm=new THREE.Mesh(mergeGeos(cl), ICE_MATS.cryst); g.add(cm); enableBloom(cm); }   // csak a kristály-koszorú izzik
  }
  // FONTOS: csak a kristályok + additív perem címkézve (fentebb), a nagy héj/mag felület NEM -> éles jég-szikra, nem vakító fehér gömb
  return g;
}
function removeIceShell(m){   // csak a per-fagy geometriát dobjuk; az ICE_MATS megosztott anyagokhoz NEM nyúlunk
  if(!m.iceShell) return;
  m.g.remove(m.iceShell);
  m.iceShell.traverse(o=>{ if(o.isMesh && o.geometry) o.geometry.dispose(); });   // a rim a héj geóját osztja — dupla dispose ártalmatlan no-op
  m.iceShell=null;
}
function freezeEncase(m){ if(m.iceShell) return; m.iceShell=buildIceShell(m,false); m.g.add(m.iceShell); }
function spawnZone(kind, x, z, opts){
  opts=opts||{}; const cfg=ZONE_CFG[kind]; if(!cfg) return null;
  while(zones.length>=10){ const old=zones.shift(); if(old) freeZoneFx(old); }   // cap 10
  const yy=(kind==='gas')?Math.max(GROUND_Y+0.5,opts.y||GROUND_Y+1):GROUND_Y+0.04, r0=opts.r0||(kind==='gas'?0.4:1.0);
  const zo={ kind, fx:VFX.disc(cfg.fx), x, y:yy, z, r:r0, rMax:cfg.rMax, life:0, max:(opts.max||cfg.max), tick:0, dps:(opts.dps!=null?opts.dps:cfg.dps), el:cfg.el, baseOp:cfg.fx.alpha, tree:(opts.tree||null), ph:Math.random()*6.283 };
  // tartós talaj-nyom a zóna alatt (a korong csak az élő, kavargó réteg): dér-folt / víztükör / izzó perzselés
  if(kind==='frost') VFX.decal(x,GROUND_Y,z,cfg.rMax*1.05,0,0xbfe2f4,0.5,zo.max+2);
  else if(kind==='puddle') VFX.decal(x,GROUND_Y,z,cfg.rMax,0,0x1d3a58,0.55,zo.max+2,0x6fa8d8,0.6);
  else if(kind==='fire') VFX.decal(x,GROUND_Y,z,cfg.rMax*1.05,0,0x120805,0.7,zo.max+4,0xff6a1a,zo.max);
  zones.push(zo); return zo;
}
function freeZoneFx(c){ VFX.discFree(c.fx); c.fx=null; if(c.tree){ c.tree.onFire=false; burningCount=Math.max(0,burningCount-1); } }
function clearZones(){ for(const c of zones) freeZoneFx(c); zones.length=0; }
function igniteTree(f){
  if(f.onFire || burningCount>=6) return;            // max 6 égő fa egyszerre
  f.onFire=true; burningCount++; f.zone=spawnZone('fire', f.x, f.z, {max:8, dps:6, tree:f});
  const cy=GROUND_Y+4.2*((f.r/0.55)||1); EFX.light(f.x,cy,f.z,0xff7a3d,4,0.5);
  VFX.flame(f.x,GROUND_Y+0.3,f.z,1.3,cy*1.15,0.9,VFX.PAL.fire,1);   // belobbanás: a láng felfut a törzsön
  for(let i=0;i<14;i++) RP.spawn(f.x+rand(-0.5,0.5),GROUND_Y+rand(0.6,cy),f.z+rand(-0.5,0.5),rand(-0.8,0.8),rand(1,3),rand(-0.8,0.8),pick([0xff5a2a,0xff8a3a,0xffc24d]),rand(0.2,0.4),0.03,rand(0.6,1.2),-1.5,1.2);
}
function spawnGasCloud(x,y,z){ spawnZone('gas', x, z, {y:y}); EFX.ring(x,GROUND_Y+0.05,z,0x9fdc4a,0.4,2.2,0.5,0.7); POISONCLOUD.spawn(x,GROUND_Y,z,2.6,1.3);   // térbeli méregfelhő a régi zöld gömb helyett
  for(let i=0;i<8;i++){ const a=rand(0,6.28),s=rand(1,4); RP.spawn(x,Math.max(GROUND_Y+0.5,y),z,Math.cos(a)*s,rand(0.5,2),Math.sin(a)*s,pick([0x7e9a2e,0x9fdc4a]),rand(0.22,0.36),0.05,rand(0.5,0.9),3,1); } }
function freezeFull(m){
  const fresh=!(m.frozenSolid>0); m.frozenSolid=Math.max(m.frozenSolid||0, 2.0);
  if(!m.iceShell || !m.iceShell.userData.full){ removeIceShell(m); m.iceShell=buildIceShell(m,true); m.g.add(m.iceShell); }
  if(fresh){ gainUlt(4);
    const p=m.g.position, cy=p.y+(m.bodyCY||1);   // belépő "bezáródás" FX: dér-lökés + csillanás + a tömb körül kifagyó jégtüskék
    VFX.flare(p.x,cy,p.z,0x9fdcff,2.6,0.2); EFX.ring(p.x,GROUND_Y+0.05,p.z,0x9fd2ff,0.4,2.6,0.45,0.85); EFX.light(p.x,cy,p.z,0x9fd0ff,3.2,0.25);
    VFX.spray(p.x,cy,p.z,16,[0xffffff,0xbfe9ff,0x6fc4ff],7,{up:-0.3,life:0.4,grav:10,w:0.024,len:0.03});
    for(let i=0;i<3;i++){ const a=i*2.094+rand(0,1), rr=(m.bodyR||0.5)*1.25; VFX.crystal(p.x+Math.cos(a)*rr,GROUND_Y-0.03,p.z+Math.sin(a)*rr,0.42,0.9,1.6,Math.sin(a)*0.5,-Math.cos(a)*0.5,true); }
    spawnZone('frost', p.x, p.z, {max:2.5});   // talaj-dér a tömb alatt (~frozenSolid időtartam)
  }
}
function shatterShell(m){
  if(m.iceShell){ const p=m.g.position, cy=p.y+(m.bodyCY||1);   // kilépő szilánk-pukkanás: szétrepülő jégdarabok (tömör lapkák) + csillogó szilánk-szikrák
    VFX.flare(p.x,cy,p.z,0x9fdcff,2.0,0.16);
    VFX.debris(p.x,cy,p.z,14,[0xbfe9ff,0xe8f8ff,0x8fd4ff],6.5,{up:-0.3,lift:1.5,life:0.8,grav:13,w:0.07});
    VFX.spray(p.x,cy,p.z,12,[0xffffff,0xbfe9ff],8,{up:-0.3,life:0.4,grav:11,w:0.022,len:0.03});
    removeIceShell(m); }
  m.frozenSolid=0;
}
/* ELEM-REACT: melyik reakció sül el, ha `el` nyíl csapódik a `m` állapotú trollba (pre-hit állapot) */
function resolveReaction(el, m){
  const innate=m.el||null;   // INNATE: a troll saját eleme állandó "státusz-forrás" -> tűz nyíl jeges trollra = gőz, előzetes nyíl nélkül is
  const iced=(m.statusEl==='ice'||m.frozenSolid>0||innate==='ice'), burning=(m.statusEl==='fire'||innate==='fire'), poisoned=(m.statusEl==='poison'||innate==='poison');
  const wet=(m.wet>0), charged=(m.charged>0||innate==='lightning');
  if(el==='lightning'){ if(iced) return 'overload'; if(poisoned||charged) return 'galvanic'; }
  else if(el==='ice'){ if(burning) return 'steam'; if(charged) return 'overload'; if(poisoned) return 'frostrot'; }
  else if(el==='fire'){ if(iced) return 'steam'; if(poisoned) return 'ignite'; }
  else if(el==='poison'){ if(burning) return 'ignite'; if(charged) return 'galvanic'; }
  return null;
}
/* visszaad: true ha a hívó NE alkalmazza utána az alap applyStatus(a.el)-t (a reakció maga kezeli a státuszt) */
function applyReaction(id, pos, hit, dmg, charge){
  const px=pos.x, py=pos.y, pz=pos.z; charge=(charge==null?0.5:charge); STATS.reacts++;
  if(typeof reactFx==='function') reactFx(id, px, py, pz);   // reakciónként saját „aláírás”-robbanás (17-tactics.js)
  if(id==='overload'){                                        // FAGYTÚLTÖLTÉS — jég+villám
    hit.hp-=dmg*1.2; hit.hurtFlash=0.2; shatterShell(hit); hit.rooted=Math.max(hit.rooted||0,1.6);
    // a fagyott troll "kisül": fényoszlop + kettős lökéshullám + jégszilánk-vihar + kékes repedés a talajon
    VFX.column(px,GROUND_Y,pz,0.8,13,0x8fb8ff,0.34); VFX.flare(px,py,pz,0x9fc4ff,4.2,0.22); EFX.ring(px,GROUND_Y+0.05,pz,0x9fd0ff,0.5,9,0.5,0.9); EFX.ring(px,GROUND_Y+0.07,pz,0xffffff,0.3,4.5,0.32,0.6); EFX.light(px,py,pz,0xbfe6ff,4.5,0.3);   // gyűrű 6->9: a sebző sugárhoz igazítva
    VFX.spray(px,py,pz,22,[0xffffff,0xbfe9ff,0xa98cff],12,{up:-0.3,life:0.4,grav:8,w:0.022,len:0.04}); VFX.decal(px,GROUND_Y,pz,2.4,1,0x0a0c14,0.8,6,0x7fb4ff,1.4);
    const near=nearestTrolls(hit.g.position.x,hit.g.position.z,hit,9,4);
    for(const tg of near){ const b=tg.g.position, by=b.y+(tg.bodyCY||1);
      VFX.bolt(px,py,pz,b.x,by,b.z,0xa8b4ff,0.2,0.55); VFX.flare(b.x,by,b.z,0x9fc4ff,1.6,0.16);
      tg.hp-=dmg*0.6; tg.hurtFlash=0.15; tg.rooted=Math.max(tg.rooted||0,1.6); if(tg.iceShell) shatterShell(tg);
      VFX.spray(b.x,by,b.z,7,[0xbfe9ff,0xffffff],6,{up:-0.3,life:0.3,grav:8,w:0.018,len:0.035});
      if(tg.hp<=0&&tg.alive) killMonster(tg,false); }
    shake=Math.max(shake,0.5); toast(tr('toast.overload')); if(AUD.head)AUD.head();
  } else if(id==='steam'){                                    // GŐZROBBANÁS — tűz+jég
    hit.hp-=dmg*0.9; hit.hurtFlash=0.18; if(hit.statusEl==='fire'||hit.statusEl==='ice') clearStatus(hit); hit.frozenSolid=0; hit.wet=Math.max(hit.wet||0,2.5); spawnZone('steam', hit.g.position.x, hit.g.position.z); spawnZone('puddle', hit.g.position.x, hit.g.position.z);
    VFX.flare(px,py,pz,0xdfeeff,3.0,0.18); EFX.ring(px,GROUND_Y+0.05,pz,0xe8f0ff,0.4,3.4,0.4,0.8);
    VFX.spray(px,py,pz,14,[0xffffff,0xcfe6ff],7,{up:0,lift:2,life:0.5,grav:10,w:0.022,len:0.05});   // szétfröccsenő forró cseppek
    for(let i=0;i<18;i++) SMK.spawn(px+rand(-0.3,0.3),py+rand(0,0.5),pz+rand(-0.3,0.3),rand(-1,1),rand(0.5,1.6),rand(-1,1),0xdfeaf2,0.8,2.2,rand(0.7,1.2),-0.5,0.8,0.7);
    const near=nearestTrolls(hit.g.position.x,hit.g.position.z,hit,3.5,3); for(const tg of near) tg.rooted=Math.max(tg.rooted||0,0.3);
    shake=Math.max(shake,0.2); toast(tr('toast.steam')); if(AUD.hit)AUD.hit(); return true;   // ne tegyen rá újra tüzet
  } else if(id==='ignite'){                                   // MÉRGES GYÚJTÁS — tűz+méreg
    const stacks=hit.statusStacks||1, R=4.5*1.3*(0.75+0.5*charge); hit.hp-=dmg*1.0 + (12+3*stacks); hit.hurtFlash=0.2;   // a sebző R most a zöld gyűrűig ér (egyetlen ×1.3 szorzó, itt)
    // a méreggőz BEROBBAN: zöld mag körül felfúvódó tűzgolyó + lökéshullám + szikra-eső + perzselt talaj
    VFX.ball(px,py,pz,R*0.12,R*0.5,0.55,VFX.PAL.fire); VFX.ball(px,py,pz,R*0.08,R*0.3,0.4,VFX.PAL.toxic); VFX.flare(px,py,pz,0xff9a3a,R*0.9,0.2);
    EFX.ring(px,GROUND_Y+0.05,pz,0x9fdc4a,0.4,R,0.45,0.85); EFX.light(px,py,pz,0xff7a3d,4.5,0.35);   // gyűrű = R (= sebző sugár)
    VFX.spray(px,py,pz,26,[0xffd27a,0xff8a3a,0xff5a2a,0x9fdc4a],10,{up:-0.1,lift:2,life:0.7,grav:8,w:0.022,len:0.05}); VFX.decal(px,GROUND_Y,pz,R*0.55,0,0x120805,0.75,9,0xff6a1a,2.6);
    for(let i=0;i<10;i++){ const a=rand(0,6.28),sp=rand(1,4); RP.spawn(px,py,pz,Math.cos(a)*sp,rand(1,4),Math.sin(a)*sp,pick([0xff8a3a,0xffc24d,0x9fdc4a]),rand(0.2,0.36),0.03,rand(0.6,1.1),-1.5,1.3); }
    for(let i=0;i<6;i++) SMK.spawn(px+rand(-0.3,0.3),py,pz+rand(-0.3,0.3),rand(-0.6,0.6),rand(1,2),rand(-0.6,0.6),0x281a10,0.7,2,rand(0.8,1.3),-1,0.8,0.5);
    const near=nearestTrolls(hit.g.position.x,hit.g.position.z,hit,R,6); for(const tg of near){ tg.hp-=dmg*0.5; tg.hurtFlash=0.15; applyStatus(tg,'fire',null,1); if(tg.hp<=0&&tg.alive) killMonster(tg,false); }
    spawnZone('fire', hit.g.position.x, hit.g.position.z); shake=Math.max(shake,0.45); toast(tr('toast.ignite')); if(AUD.head)AUD.head();
  } else if(id==='galvanic'){                                 // GALVÁN PERMET — méreg+villám
    hit.hp-=dmg*0.5; hit.hurtFlash=0.15; const near=nearestTrolls(hit.g.position.x,hit.g.position.z,hit,8,3); let prev=hit;
    VFX.flare(px,py,pz,0xb8f25a,1.8,0.16);
    for(const tg of near){ const a=prev.g.position, ay=a.y+(prev.bodyCY||1), b=tg.g.position, by=b.y+(tg.bodyCY||1);
      VFX.bolt(a.x,ay,a.z,b.x,by,b.z,0x9fe04a,0.2,0.45); VFX.flare(b.x,by,b.z,0xb8f25a,1.4,0.16);
      VFX.spray(b.x,by,b.z,7,[0x9fdc4a,0xc8f060],5,{up:-0.2,lift:1,life:0.4,grav:11,w:0.024,len:0.05});
      tg.hp-=dmg*0.4; tg.hurtFlash=0.12; tg.rooted=Math.max(tg.rooted||0,0.6); applyStatus(tg,'poison',null,1); if(tg.hp<=0&&tg.alive) killMonster(tg,false); prev=tg; }
    shake=Math.max(shake,0.2); toast(tr('toast.galvanic'));
  } else if(id==='frostrot'){                                 // FAGYOS ROTHADÁS — jég méregre: tartsd a mérget, fagyaszd be
    freezeEncase(hit); hit.frozenSolid=Math.max(hit.frozenSolid||0,1.2); hit.slowMul=Math.min(hit.slowMul||1,0.35);
    VFX.flare(px,py,pz,0x9fdcff,1.8,0.18); EFX.ring(px,GROUND_Y+0.05,pz,0x9fd2ff,0.3,2.6,0.4,0.8);
    VFX.spray(px,py,pz,10,[0xbfe9ff,0x9fdc4a],5,{up:-0.3,life:0.4,grav:10,w:0.022,len:0.03}); toast(tr('toast.rot')); return true;   // ne írja felül a mérget jéggel
  }
  return false;
}
// a becsapódási AoE alap-sugara elemenként (a villám LÁNCOL, nem splashel -> 0); a látvány (pl. a méregtócsa) is ezt használja
function splashR(el){ return el==='fire'?3.6 : el==='ice'?3.0 : el==='poison'?2.6 : 0; }
// "AHOL IZZIK, OTT SEBEZ": kis becsapódási AoE. A látható gyűrű sugara == a sebző sugár. radMul: fél területre a földbe-állt nyílhoz.
function elementalSplashAt(px, pz, el, dmg, charge, head, exclude, radMul){
  const R = splashR(el) * (radMul||1);
  if(R<=0) return;
  const frac = (el==='fire'?0.30 : el==='ice'?0.22 : 0.20) * (head?1.5:1);
  const col = el==='fire'?0xff7a3d : el==='ice'?0x9fd0ff : 0x9fdc4a;
  EFX.ring(px,GROUND_Y+0.05,pz,col,0.4,R,0.4,0.7);                 // a látható gyűrű = a sebző sugár
  EFX.flash(px,GROUND_Y+0.6,pz,col,0.35,R*0.6,0.22);
  for(const tg of nearestTrolls(px,pz,exclude,R,4)){              // exclude=hit (találatnál) -> az elsődleges célt nem sebzi duplán
    const by=tg.g.position.y+(tg.bodyCY||1);
    tg.hp-=dmg*frac*RUNM.elemPowerMul; tg.hurtFlash=0.12; applyStatus(tg,el,null,1);   // FEJLESZTÉS: Őselem erő-szorzó
    for(let i=0;i<4;i++) RP.spawn(tg.g.position.x,by,tg.g.position.z,rand(-2,2),rand(0,3),rand(-2,2),col,0.5,0.04,0.4,(el==='fire'?-1:1),1.1);
    if(tg.hp<=0&&tg.alive) killMonster(tg,false);
  }
}
function elementalSplash(hit, el, dmg, charge, head){ elementalSplashAt(hit.g.position.x, hit.g.position.z, el, dmg, charge, head, hit, RUNM.elemRadiusMul); }   // teljes sugarú, a találat-célt kihagyva; FEJLESZTÉS: Robbanó Szív
function reactionFromInnateOnly(el, m){ const sv=m.el; m.el=null; const r=resolveReaction(el, m); m.el=sv; return r===null; }   // igaz, ha a reakciót CSAK az innate elem váltotta ki (nem applied státusz)
function elementMechanic(pos, el, hit, dmg, head, wasStatus, charge, resonant, preciseArea){
  const now=performance.now()*0.001;
  if(el!=='base'){
    const onCd=((now-(hit.lastReactT||-999))<0.45) && !resonant;
    let rid=onCd?null:resolveReaction(el, hit);
    if(rid){
      const innateOnly=reactionFromInnateOnly(el, hit);
      if(innateOnly && (now-(hit.lastInnateReactT||-999))<2.5){ rid=null; }   // PARITY-KRITIKUS: innate-only reakció a 2.5s hűtésen -> elnyomva, esik az alap-mechanikára (kliens=szerver azonos)
      else { hit.lastReactT=now; if(innateOnly) hit.lastInnateReactT=now; gainUlt(innateOnly?6:12);
        const tm=(typeof tacticReaction==='function')?tacticReaction(rid, el, hit):1;   // ELEM-TAKTIKA (SP): reakció-jutalom × elemi lánc; lánc/töltés/ómen/páncél-törés
        return applyReaction(rid, pos, hit, dmg*(resonant?1.3:1)*tm, charge); }   // reakció helyettesíti az alap-mechanikát + tölti a VIHAR-t (innate-only: kevesebb ult)
    }
  }
  if(preciseArea) return false;
  // --- alap (reakció nélküli) per-elem mechanika ---
  if(el!=='base') elementalSplash(hit, el, dmg, charge, head);    // becsapódási AoE — EGYETLEN splash-hívás (dupla-splash guard: a régi tűz-ág megszűnt)
  if(el==='poison') spawnGasCloud(pos.x,pos.y,pos.z);             // méreg: a splash MELLETT marad a talaj-gázfelhő (DoT)
  else if(el==='lightning') chainLightning(hit,dmg);             // villám: lánc (splash sugara 0, nincs átfedés)
  return false;
}
function updateElemFx(dt){   // ELEM-ENV: zóna-léptetés (gáz/tűz/fagy/tócsa/gőz) + tűz-terjedés a fákra
  for(let i=_poisonQ.length-1;i>=0;i--){ const q=_poisonQ[i]; q.t-=dt; if(q.t<=0){ _poisonQ.splice(i,1); poisonMounds(q.x,q.gy,q.z,q.R,q.n,q.d); } }   // a méregtócsa újra felbugyog
  for(let i=zones.length-1;i>=0;i--){ const c=zones[i]; c.life+=dt; c.tick-=dt; c.r=Math.min(c.rMax, c.r+dt*0.9);
    const env=Math.min(1,c.life/0.22)*Math.max(0,1-c.life/c.max), grow=Math.min(1,env*2);
    VFX.discSet(c.fx,c.x,GROUND_Y+0.045,c.z,c.r,c.baseOp*Math.min(1,env*1.6));
    if(c.kind==='fire'){   // lángnyelvek a zónában: 3 gazdához kötött láng kering lassan (égő fán a törzsön is felkúszik)
      const o=c._fl||(c._fl=[{},{},{}]);
      for(let k=0;k<3;k++){ const a=c.ph+k*2.094+c.life*0.35, rr=c.r*0.48;
        VFX.hold(o[k], c.x+Math.cos(a)*rr, GROUND_Y, c.z+Math.sin(a)*rr, c.r*0.42, (1.1+0.5*Math.sin(c.life*3+k*2))*grow, VFX.PAL.fire, 0.85); }
      if(c.tree) VFX.hold(c._tf||(c._tf={}), c.x, GROUND_Y+0.4, c.z, 1.0, 4.6*grow, VFX.PAL.fire, 0.8);
    }
    const steps=fxSteps(c,'_fxAcc',dt,30);
    for(let step=0;step<steps;step++){
    if(c.kind==='gas'){ if(Math.random()<(gfxTier==='low'?0.012:0.026)) POISONCLOUD.spawn(c.x+rand(-c.r,c.r)*0.7,GROUND_Y,c.z+rand(-c.r,c.r)*0.7,rand(1.1,1.7),1.25);   // a gázzóna egész élete alatt felfelé gomolyog (nem lapos korong)
      if(Math.random()<0.14) SMK.spawn(c.x+rand(-c.r,c.r)*0.7,c.y+rand(-0.3,0.3),c.z+rand(-c.r,c.r)*0.7,rand(-0.3,0.3),rand(0.2,0.6),rand(-0.3,0.3),pick([0x3f5a1e,0x4f6e24]),0.6,1.9,rand(0.9,1.4),-0.3,0.8,0.3);   // gomolygó méreg-pára
      if(Math.random()<0.35) RP.spawn(c.x+rand(-c.r,c.r),GROUND_Y+0.1,c.z+rand(-c.r,c.r),rand(-0.2,0.2),rand(0.5,1.3),rand(-0.2,0.2),pick([0x9fdc4a,0xc8e26a]),rand(0.2,0.36),0.3,rand(0.6,1.0),-0.8,1.2,0.8); }   // felszálló spórák
    else if(c.kind==='fire'){ if(Math.random()<0.5) RP.spawn(c.x+rand(-c.r,c.r),c.y+0.1,c.z+rand(-c.r,c.r),rand(-0.3,0.3),rand(1.2,2.8),rand(-0.3,0.3),pick([0xff8a3a,0xffc24d,0xfff1c4]),rand(0.18,0.34),0.02,rand(0.5,0.9),-1.5,1.2);
      if(Math.random()<0.10) SMK.spawn(c.x+rand(-c.r,c.r)*0.6,c.y+1.2,c.z+rand(-c.r,c.r)*0.6,rand(-0.3,0.3),rand(0.8,1.4),rand(-0.3,0.3),0x20160e,0.55,1.7,rand(0.8,1.2),-0.8,1,0.3);
      if(c.tree && Math.random()<0.5){ const cy=GROUND_Y+rand(2,4.5); RP.spawn(c.x+rand(-0.6,0.6),cy,c.z+rand(-0.6,0.6),rand(-0.5,0.5),rand(0.5,2),rand(-0.5,0.5),pick([0xff7a3d,0xffc24d]),rand(0.3,0.6),0.04,rand(0.5,1),-1,1.1); } }   // korona-parázs
    else if(c.kind==='frost'){ if(Math.random()<0.3) RP.spawn(c.x+rand(-c.r,c.r),c.y+rand(0,0.4),c.z+rand(-c.r,c.r),rand(-0.2,0.2),rand(-0.2,0.3),rand(-0.2,0.2),0xbfe6ff,0.3,0.02,0.5,1,0.6);
      if(Math.random()<0.05) SMK.spawn(c.x+rand(-c.r,c.r)*0.7,c.y+0.2,c.z+rand(-c.r,c.r)*0.7,rand(-0.3,0.3),0.12,rand(-0.3,0.3),0xcfe8f6,0.6,1.6,1.1,-0.1,1,0.2); }   // talaj menti fagyos pára
    else if(c.kind==='steam'){ if(Math.random()<0.6) SMK.spawn(c.x+rand(-c.r,c.r),c.y+rand(0,0.6),c.z+rand(-c.r,c.r),rand(-0.4,0.4),rand(0.4,1.2),rand(-0.4,0.4),0xdfeaf2,0.6,1.4,0.7,-0.4,0.8,0.5); }
    }
    if(c.tick<=0){ c.tick=0.5;
      for(const o of monsters){ if(!o.alive||o.dying>0||coopIsRemote(o)) continue; if(Math.hypot(o.g.position.x-c.x,o.g.position.z-c.z)-Math.min(o.bodyR||0.4,0.7)>=c.r) continue;
        if(c.kind==='gas'){ o.hp-=c.dps; o.hurtFlash=0.1; applyStatus(o,'poison',null,1); }
        else if(c.kind==='fire'){ o.hp-=c.dps; o.hurtFlash=0.1; applyStatus(o,'fire',null,1); }
        else if(c.kind==='frost'){ o.chill=Math.max(o.chill||0,0.7); o.wet=Math.max(o.wet||0,1.0); }
        else if(c.kind==='puddle'){ o.wet=Math.max(o.wet||0,2.0); }
        else if(c.kind==='steam'){ o.rooted=Math.max(o.rooted||0,0.3); }
        if(o.hp<=0&&o.alive) killMonster(o,false); }
      if(c.kind==='fire'){ for(const f of flammables){ if(!f.onFire && Math.hypot(f.x-c.x,f.z-c.z)<c.r+0.8) igniteTree(f); } }   // tűz átterjed a közeli fákra
    }
    if(c.life>=c.max){ freeZoneFx(c); zones.splice(i,1); } }
}

