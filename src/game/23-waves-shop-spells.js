/* ===================== Hullám-rendszer / játékállapot ===================== */
let running=false, wave=0, score=0, toSpawn=0, spawnTimer=0, aliveCount=0, intermission=0, spawnAngles=[], eliteToSpawn=0;
// ===== FEJLESZTÉS-BOLT (Kovácsműhely): 5 hullámonként a SCORE-t költve, PER-RUN (nincs mentés) =====
let shopOpen=false;
const RUN={ dmg:0, hands:0, multishot:0, hp:0, regen:0, lifesteal:0, speed:0, ult:0, dot:0,
           drawcap:0, pierce:0, ricochet:0, elemradius:0, elempower:0,
           crit:0, elite:0, orbs:0, lastchance:0, pontkov:0, vihar:0, szilank:0, awakening:0 };   // rangok
const RUNM={ dmgMul:1, drawMul:1, reloadMul:1, multishot:false, regen:0, lifesteal:0, ultMul:1, dotMul:1, spdMul:1,
             multishotN:0, drawCap:1, pierce:0, ricochet:0, elemRadiusMul:1, elemPowerMul:1,
             crit:0, eliteMul:1, orbHeal:30, orbRespawn:20, lastStand:0, scoreMul:1, viharDmg:0, shardNova:0 };   // élő szorzók
// 21 kártya, Brotato-mintájú tier-kapuzással (minWave): 1. bolt = alap-tier, H10 = szorzó-tier, H15 = finisher-tier.
// Katalógus-össz ~178k pont; a fókuszált build (~119k) a ~25. hullámra kész — a TELJES katalógus egy futamban nem megvehető.
const SHOP_DEFS=[
  {id:'awakening',hu:'Elemi ébredés',lane:'mys',glyph:'✷',eff:'Teljes húzáskor elemi varázslat',cap:3,costs:[800,1600,2800],waves:[5,10,15],spOnly:true},
  // ATK
  {id:'dmg',       hu:'Szakás Hegy',      lane:'atk', glyph:'➳', eff:'+15% nyíl-sebzés',          cap:6, costs:[800,1400,2200,3400,5000,7200]},
  {id:'hands',     hu:'Fürge Kéz',        lane:'atk', glyph:'➤', eff:'+15% húzás, -10% töltés',   cap:5, costs:[700,1300,2100,3200,4600]},
  {id:'crit',      hu:'Kritikus Lövés',   lane:'atk', glyph:'✧', eff:'+8% esély / rang: a nyíl ×2 sebzést üt', cap:3, costs:[1500,2600,4200]},
  {id:'drawcap',   hu:'Mély Feszítés',    lane:'atk', glyph:'⟱', eff:'+25% max-felhúzás: keményebb, laposabb, távolabb', cap:3, costs:[1700,3000,4800], minWave:10},
  {id:'multishot', hu:'Megosztott Lövés', lane:'atk', glyph:'✸', eff:'+1 nyíl lövésenként (szórás)', cap:3, costs:[2600,4600,7400], minWave:10},
  {id:'pierce',    hu:'Áttörő Hegy',      lane:'atk', glyph:'➹', eff:'az ALAP nyíl átüt +1 trollon /rang', cap:3, costs:[2200,3800,5800], minWave:10},
  {id:'elite',     hu:'Elit-Vadász',      lane:'atk', glyph:'⚔', eff:'+20% sebzés / rang az ELIT trollok ellen', cap:3, costs:[1800,3000,4400], minWave:10},
  {id:'ricochet',  hu:'Pattanó Nyíl',     lane:'atk', glyph:'↻', eff:'az ALAP nyíl a legközelebbi trollra pattan +1× /rang', cap:2, costs:[2800,4800], minWave:15},
  // DEF
  {id:'hp',        hu:'Edzett Bőr',       lane:'def', glyph:'♥', eff:'+30 max élet (gyógyít is)', cap:5, costs:[500,900,1400,2100,3100]},
  {id:'regen',     hu:'Moha-gyógyulás',   lane:'def', glyph:'✚', eff:'+1.2 élet / mp',            cap:4, costs:[600,1100,1800,2800]},
  {id:'speed',     hu:'Fürge Láb',        lane:'def', glyph:'➜', eff:'+8% mozgás-sebesség',       cap:4, costs:[600,1050,1700,2700]},
  {id:'orbs',      hu:'Gyógyító Gömbök',  lane:'def', glyph:'❋', eff:'élet-gömb +20 gyógyítás és 6mp-cel gyorsabb újraéledés / rang', cap:2, costs:[900,1600]},
  {id:'lifesteal', hu:'Életfaló',         lane:'def', glyph:'✦', eff:'ölés gyógyít +4 / fej +8',  cap:3, costs:[1400,2400,3800], minWave:10},
  {id:'lastchance',hu:'Utolsó Esély',     lane:'def', glyph:'⭐', eff:'1×/futam: a halálos ütést 1 élettel túléled + 2s sérthetetlenség', cap:1, costs:[3500], minWave:15},
  // MYS
  {id:'ult',       hu:'Vihar-Vezeték',    lane:'mys', glyph:'⚡', eff:'+30% VIHAR-töltés',         cap:4, costs:[600,1100,1800,2800]},
  {id:'pontkov',   hu:'Pontkovács',       lane:'mys', glyph:'❂', eff:'+10% pont / rang minden ölésből', cap:3, costs:[1000,1800,3000], spOnly:true},
  {id:'dot',       hu:'Maró Méreg',       lane:'mys', glyph:'☠', eff:'+40% tűz/méreg DoT',        cap:3, costs:[1100,2000,3200], spOnly:true, minWave:10},
  {id:'elemradius',hu:'Robbanó Szív',     lane:'mys', glyph:'◎', eff:'+30% elemi AoE-sugár',     cap:3, costs:[1500,2600,4000], spOnly:true, minWave:10},
  {id:'elempower', hu:'Őselem',           lane:'mys', glyph:'✷', eff:'+20% elemi erő (sebzés+státusz)', cap:3, costs:[1800,3000,4800], spOnly:true, minWave:15},
  {id:'vihar',     hu:'Vihar-Mester',     lane:'mys', glyph:'☈', eff:'a VIHAR csapás-sebzése 8 → 35 → 62', cap:2, costs:[2400,4000], spOnly:true, minWave:15},
  {id:'szilank',   hu:'Szilánk-vihar',    lane:'mys', glyph:'❄', eff:'a FAGYOTT troll halálakor jég-robbanás sebzi a környezőket (2. rang: bármely jeges trollra)', cap:2, costs:[3600,5800], spOnly:true, minWave:15},
];
const BOW_DEFS={
  starter:{cost:0,wave:0,dmg:1,draw:1,reload:1,extra:0,pierce:0,spell:1,cooldown:0},
  bone:{cost:1000,wave:5,dmg:1.35,draw:1.15,reload:0.9,extra:0,pierce:1,spell:1,cooldown:0},
  moss:{cost:2600,wave:10,dmg:1.2,draw:1.45,reload:0.72,extra:1,pierce:0,spell:1,cooldown:1},
  rune:{cost:4200,wave:15,dmg:1.65,draw:1.05,reload:1.05,extra:0,pierce:0,spell:1.35,cooldown:1.5}
};
let equippedBow='starter', spellCd=0, spellKick=0;
const ownedBows=new Set(['starter']);
function activeBow(){ return BOW_DEFS[coop?'starter':equippedBow]; }
function dressBow(id){
  const palette=TrollGen.BOWS[id];
  staveWood.color.setHex(id==='bone'?0xe8dcc4:id==='moss'?0x4d3b27:id==='rune'?0x1e1922:(palette?palette.limb:0x8a5a2b));
  backWood.color.setHex(id==='bone'?0xf7efde:id==='moss'?0x76a34f:id==='rune'?0x4d7a96:0xc79a5e);
  gripLeather.color.setHex(id==='bone'?0x442b1d:id==='moss'?0x3e5624:id==='rune'?0x152232:(palette?palette.wrap:0x2a1a12));
  heartWood.color.setHex(id==='rune'?0x0d1522:id==='bone'?0x9e8462:id==='moss'?0x2a3b20:0x4d2f17);
  hornMat.color.setHex(id==='bone'?0xf2e7d0:id==='rune'?0x18324a:0x2c1c10);
  if(typeof BOW_SKINS!=='undefined'){
    for(const k in BOW_SKINS.groups){ const on=(!coop && k===id); for(const g of BOW_SKINS.groups[k]) g.visible=on; }
  }
}
function buyBow(id){
  const def=BOW_DEFS[id];
  if(coop || !shopOpen || !def) return false;
  if(!ownedBows.has(id)){
    if(wave<def.wave || score<def.cost) return false;
    addScore(-def.cost); ownedBows.add(id);
  }
  equippedBow=id; dressBow(id); applyUpgrades(); renderShop(); if(AUD.nock) AUD.nock();
  return true;
}
function renderBowShop(){
  const host=document.getElementById('forgeBows'); host.replaceChildren(); host.hidden=!!coop;
  if(coop) return;
  const label=document.createElement('div');label.className='forge-label';label.textContent=tr('combat.bow');host.appendChild(label);
  for(const [id,def] of Object.entries(BOW_DEFS)){
    const b=document.createElement('button'), owned=ownedBows.has(id), locked=wave<def.wave;
    b.type='button'; b.className=equippedBow===id?'active':'';
    b.disabled=equippedBow===id || (!owned && (locked || score<def.cost));
    b.innerHTML='<b>'+tr('combat.bows.'+id)[0]+'</b><small>'+tr('combat.bows.'+id)[1]+'</small><strong>'+
      (equippedBow===id?tr('combat.equipped'):owned?tr('combat.equip'):locked?tr('shop.locked',{wave:def.wave}):fmtPts(def.cost))+'</strong>';
    b.addEventListener('click',()=>buyBow(id)); host.appendChild(b);
  }
}
function applyUpgrades(){
  const weapon=activeBow();
  RUNM.dmgMul    = 1 + 0.15*RUN.dmg;
  RUNM.drawMul   = 1 + 0.15*RUN.hands;
  RUNM.reloadMul = Math.max(0.70, 1 - 0.10*RUN.hands);   // padló: a reload sose < ~0.6s
  RUNM.multishot = RUN.multishot>0;
  RUNM.multishotN= RUN.multishot;                 // 0..3 EXTRA nyíl (szórás-legyező)
  RUNM.regen     = 1.2*RUN.regen;
  RUNM.lifesteal = RUN.lifesteal;
  RUNM.spdMul    = 1 + 0.08*RUN.speed;
  RUNM.ultMul    = 1 + 0.30*RUN.ult;
  RUNM.dotMul    = 1 + 0.40*RUN.dot;
  RUNM.drawCap   = 1 + 0.25*RUN.drawcap;          // töltés-plafon: 1.0 / 1.25 / 1.50 / 1.75
  RUNM.pierce    = RUN.pierce;                     // ALAP-nyíl átütések száma
  RUNM.ricochet  = RUN.ricochet;                   // ALAP-nyíl pattanások száma
  RUNM.elemRadiusMul = 1 + 0.30*RUN.elemradius;    // Robbanó Szív
  RUNM.elemPowerMul  = 1 + 0.20*RUN.elempower;     // Őselem (splash-frac + státusz-dps)
  RUNM.crit      = 0.08*RUN.crit;                  // Kritikus Lövés: esély a ×2-re
  RUNM.eliteMul  = 1 + 0.20*RUN.elite;             // Elit-Vadász
  RUNM.orbHeal   = 30 + 20*RUN.orbs;               // Gyógyító Gömbök (SP)
  RUNM.orbRespawn= Math.max(8, 20 - 6*RUN.orbs);
  RUNM.lastStand = RUN.lastchance;                 // Utolsó Esély
  RUNM.scoreMul  = 1 + 0.10*RUN.pontkov;           // Pontkovács
  RUNM.viharDmg  = 27*RUN.vihar;                   // Vihar-Mester: 8 -> 35 -> 62
  RUNM.shardNova = RUN.szilank;                    // Szilánk-vihar
  player.maxHp   = 100 + 30*RUN.hp;
  STATUS_CFG.fire.dps   = 7 * RUNM.dotMul * RUNM.elemPowerMul;
  STATUS_CFG.poison.dps = 4 * RUNM.dotMul * RUNM.elemPowerMul;
  RUNM.dmgMul*=weapon.dmg; RUNM.drawMul*=weapon.draw; RUNM.reloadMul*=weapon.reload;
  RUNM.multishotN+=weapon.extra; RUNM.pierce+=weapon.pierce;
}
function sightBlocked(ax,ay,az,bx,by,bz){
  const dx=bx-ax, dy=by-ay, dz=bz-az;
  const left=Math.min(ax,bx),right=Math.max(ax,bx),back=Math.min(az,bz),front=Math.max(az,bz);
  for(const s of SOLIDS){
    if(s.noArrow) continue;
    const minY=s.abot!=null?s.abot:(s.bottom||GROUND_Y), maxY=s.top!=null?s.top:GROUND_Y+3.6;
    if(Math.max(ay,by)<minY || Math.min(ay,by)>maxY) continue;
    const minX=s.kind==='box'?s.minX:s.x-s.r,maxX=s.kind==='box'?s.maxX:s.x+s.r;
    const minZ=s.kind==='box'?s.minZ:s.z-s.r,maxZ=s.kind==='box'?s.maxZ:s.z+s.r;
    if(maxX<left || minX>right || maxZ<back || minZ>front) continue;
    let lo=0, hi=1;
    const clip=(p,v,min,max)=>{
      if(Math.abs(v)<1e-8) return p>=min && p<=max;
      let a=(min-p)/v, b=(max-p)/v; if(a>b){ const t=a;a=b;b=t; }
      lo=Math.max(lo,a); hi=Math.min(hi,b); return lo<=hi;
    };
    if(!clip(ay,dy,minY,maxY)) continue;
    if(s.kind==='box'){
      if(clip(ax,dx,minX,maxX) && clip(az,dz,minZ,maxZ) && hi>0.01 && lo<0.99) return true;
    } else {
      const den=dx*dx+dz*dz, t=clamp(den?((s.x-ax)*dx+(s.z-az)*dz)/den:0,lo,hi);
      if(Math.hypot(ax+dx*t-s.x,az+dz*t-s.z)<s.r && hi>0.01 && lo<0.99) return true;
    }
  }
  return false;
}
const spellEvents=[];
// késleltetett, csak-látvány ütemek (mellék-villámcsapások, utórobbanások): előre lefoglalt sor -> nincs futás közbeni foglalás
const spellFx=[]; for(let i=0;i<12;i++) spellFx.push({on:false,t:0,x:0,z:0,s:1});
function laterStrike(delay,x,z,s){ for(const q of spellFx){ if(!q.on){ q.on=true; q.t=delay; q.x=x; q.z=z; q.s=s; return; } } }
// égből lecsapó villám: fényoszlop + vastag, elágazó ív + becsapódási csillag + lökésgyűrű + izzó repedés + szétpattanó szikrák
function skyStrike(x,z,s){
  const y=GROUND_Y;
  VFX.column(x,y,z,0.42*s,17,0xcdbcff,0.30);
  VFX.bolt(x+rand(-1.6,1.6)*s,y+17,z+rand(-1.6,1.6)*s, x,y+0.05,z, 0xcdbcff,0.30,0.6*s,0.11+0.10*s);
  VFX.flare(x,y+0.45,z,0xe8e0ff,3.4*s,0.22);
  VFX.ring(x,y+0.06,z,0xcdbcff,0.3,2.3*s,0.34,0.85);
  VFX.decal(x,y,z,1.5*s,1,0x0c0a14,0.85,5,0xb9a4ff,1.5);
  VFX.spray(x,y+0.15,z,Math.round(12*s),[0xffffff,0xd8ccff,0xa98cff],9*s,{up:0.05,life:0.42,grav:14,w:0.02,len:0.05});
}
function spellReady(){ return !coop && running && player.alive && RUN.awakening>0 && currentElement!=='base' && spellCd<=0; }
const _spDir=new THREE.Vector3(), _spEnd=new THREE.Vector3(), _spCtr=new THREE.Vector3(), _spSub=new THREE.Vector3(), _spOut=new THREE.Vector3();
function spellTarget(){
  camera.getWorldDirection(_spDir);
  const range=26, start=camera.position;
  _spEnd.set(start.x,start.y,start.z).addScaledVector(_spDir,range);
  let distance=_spDir.y< -0.02?clamp((GROUND_Y-start.y)/_spDir.y,2,range):18;
  let best=distance;
  for(const m of monsters){
    if(!m.alive || coopIsRemote(m)) continue;
    _spCtr.set(m.g.position.x,m.g.position.y+m.bodyCY,m.g.position.z);
    const along=_spSub.set(_spCtr.x,_spCtr.y,_spCtr.z).sub(start).dot(_spDir);
    if(along>1 && along<range && segDist(start,_spEnd,_spCtr)<m.bodyR+0.5 && along<best){ best=along; distance=along; }
  }
  const target=_spOut.set(start.x,start.y,start.z).addScaledVector(_spDir,distance);
  target.y=GROUND_Y;
  // Ground eruptions cannot be placed through a trunk or building.
  for(let n=1;n<=Math.ceil(distance*2);n++){
    const t=Math.min(1,n/(distance*2)), px=lerp(start.x,target.x,t), pz=lerp(start.z,target.z,t);
    if(sightBlocked(start.x,GROUND_Y+0.8,start.z,px,GROUND_Y+0.8,pz)){
      const f=Math.max(0,(n-2)/(distance*2)); target.x=lerp(start.x,target.x,f);target.z=lerp(start.z,target.z,f);break;
    }
  }
  return target;
}
function queueSpell(e){
  if(spellEvents.length>=64) spellEvents.shift();
  spellEvents.push(e);
}
function castElementSpell(draw){
  if(!spellReady() || draw<RUNM.drawCap*0.98) return false;
  const rank=RUN.awakening, el=currentElement, weapon=activeBow(), target=spellTarget();
  const tx=target.x, tz=target.z;
  const dmg=(18+draw*30)*RUNM.dmgMul*RUNM.elemPowerMul*weapon.spell*(perfectShot?1.3:1)*
    (player.witherT>0?TROLL_TYPES.shaman.witherDmgMul:1);
  spellCd=Math.max(2.2,7-rank-weapon.cooldown);
  const shared=new Set(), counter={hit:false}, px=player.pos.x, pz=player.pos.z;
  const vx=tx-px, vz=tz-pz, dist=Math.hypot(vx,vz)||1, fx=vx/dist, fz=vz/dist;
  if(el==='fire'||el==='ice'){
    const steps=2+rank, lanes=(el==='ice'&&rank>=2)||(el==='fire'&&rank>=3)?[-1,0,1]:[0];
    for(let i=0;i<steps;i++){
      const start=Math.min(2.5,dist), d=lerp(start,Math.min(18,dist),i/(steps-1));
      const width=(el==='fire'?1.7+rank*0.45:1.3+rank*0.2)*RUNM.elemRadiusMul;
      for(const lane of lanes){
        const x=px+fx*d-fz*lane*1.6, z=pz+fz*d+fx*lane*1.6;
        if(sightBlocked(px,GROUND_Y+0.8,pz,x,GROUND_Y+0.8,z)) continue;
        queueSpell({el,x,z,r:width,dmg:dmg*(0.9+rank*0.15),delay:i*0.09,rank,shared,counter,fx,fz,lane,final:i===steps-1&&lane===0});
      }
    }
  } else if(el==='poison'){
    const pulses=3+rank, rad=(2.5+rank*0.65)*RUNM.elemRadiusMul;
    VFX.vortex(tx,tz,rad,(pulses-1)*0.4+0.75,2.6+rank*0.7);
    for(let i=0;i<pulses;i++) queueSpell({el,x:tx,z:tz,r:rad,dmg:dmg*0.28,delay:i*0.4,rank,counter,final:i===pulses-1});
  } else {
    const rad=(2.4+rank*0.55)*RUNM.elemRadiusMul;
    queueSpell({el,x:tx,z:tz,r:rad,dmg:dmg*1.25,delay:0.22,rank,counter});
    // előjel: összehúzódó célgyűrű + halvány vezetőcsatorna az égből + a talajról felszálló töltés-szikrák
    VFX.ring(tx,GROUND_Y+0.07,tz,0xb9a4ff,rad,0.3,0.22,0.9);
    VFX.column(tx,GROUND_Y,tz,0.22,17,0x9f8cf0,0.24);
    VFX.bolt(tx+rand(-2,2),GROUND_Y+16,tz+rand(-2,2),tx,GROUND_Y+0.2,tz,0x8f7ae0,0.2,0.5,0.045,true);
    for(let i=0;i<10;i++){ const a=rand(0,6.28), rr=rand(0.2,rad*0.85);
      VFX.streak(tx+Math.cos(a)*rr,GROUND_Y+0.1,tz+Math.sin(a)*rr, 0,rand(3,7),0, 0xd8ccff, 0.26,-2,0.8,0.016,0.07); }
  }
  // varázs-indítás az íjnál: elem-színű csillagvillanás a húr előtt + a cél felé kilövellő szikrák
  { const col=EL[el].fx, mx=camera.position.x+_spDir.x*1.5, my=camera.position.y+_spDir.y*1.5-0.12, mz=camera.position.z+_spDir.z*1.5;
    VFX.flare(mx,my,mz,col,1.5+rank*0.25,0.26);
    for(let i=0;i<8+rank*2;i++) VFX.streak(mx,my,mz, _spDir.x*rand(9,20)+rand(-2.5,2.5),_spDir.y*rand(9,20)+rand(-1.5,3),_spDir.z*rand(9,20)+rand(-2.5,2.5), col, rand(0.2,0.4),6,1.6,0.018,0.05); }
  callout(tr('combat.spell.'+el)+' · '+tr('combat.rank',{n:rank}),true);
  bowKick=1; bowKickRot=1; spellKick=1; relTwang=0.18;
  if(AUD.spell) AUD.spell(el,rank); else if(AUD.twang) AUD.twang(draw);
  buzz(45);
  return true;
}
function bossDamageMultiplier(m){ return m.boss && m.bossState && m.bossState.kind==='recover'?1.5:1; }
function hitWithSpell(m,e,mul){
  if(!m.alive || coopIsRemote(m)) return;
  if(m.el===e.el){ m.hp=Math.min(m.maxHp,m.hp+e.dmg*mul*0.20); absorbTell(m,e.el); return; }
  const resist=m.resist&&m.resist[e.el]||1;
  const dmg=e.dmg*mul*resist*(m.frozenSolid>0?1.5:1)*(m.elite?RUNM.eliteMul:1)*bossDamageMultiplier(m);
  m.hp-=dmg;
  m.hurtFlash=0.22;
  const pos={x:m.g.position.x,y:m.g.position.y+m.bodyCY,z:m.g.position.z};
  if(!elementMechanic(pos,e.el,m,dmg,false,m.statusEl,1,false,true)) applyStatus(m,e.el,1,e.el==='ice'?e.rank:1);
  if(m.hp<=0 && m.alive) killMonster(m,false);
}
function resolveSpell(e){
  const y=GROUND_Y+0.1, main=!e.lane, P=VFX.PAL;   // main: a középső sáv (a szélső sávok könnyebb látványt kapnak -> nem fogy ki az effekt-készlet)
  if(e.el==='fire'){
    // LÁNGHULLÁM: a talajból kitörő tűzoszlop + táguló tűzgolyó + izzó repedés + szikra-eső + utófüst
    const h=1.5+e.rank*0.62;
    VFX.flame(e.x,GROUND_Y,e.z,e.r*(main?0.62:0.5),h*(main?1.95:1.5),0.68,P.fire,1);
    if(main){
      for(let i=0;i<2;i++){ const a=rand(0,6.28)+i*3.14;
        VFX.flame(e.x+Math.cos(a)*e.r*0.52,GROUND_Y,e.z+Math.sin(a)*e.r*0.52,e.r*0.36,h*rand(0.9,1.2),0.52,P.fire,0.9); }
      if(e.final) VFX.ball(e.x,y+0.5,e.z,e.r*0.3,e.r*1.05,0.5,P.fire);   // a hullám vége: záró robbanás
      VFX.ring(e.x,y,e.z,0xff7a2a,0.3,e.r*(e.final?1.7:1.25),0.44,e.final?0.75:0.45);
      VFX.decal(e.x,GROUND_Y,e.z,e.r*1.15,1,0x0f0704,0.85,6,0xff6a1a,2.4);
      if(EFX.light) EFX.light(e.x,y+1.4,e.z,0xff7a3d,3.2+e.rank*0.7,0.26);
      if(e.final){ VFX.flare(e.x,y+0.9,e.z,0xff9a3a,e.r*2.0,0.22); if(typeof shake==='number') shake=Math.max(shake,0.16+e.rank*0.05); }
    }
    VFX.spray(e.x,y+0.2,e.z,main?12:6,[0xffe9a8,0xffa63d,0xff5a1a],7.5,{up:0.35,lift:2.5,life:0.6,grav:8,w:0.02,len:0.05});
    for(let i=0;i<(main?5:2);i++){ const a=rand(0,6.28), sp=rand(0.4,1.6);
      RP.spawn(e.x+Math.cos(a)*e.r*0.4,y+rand(0.4,h),e.z+Math.sin(a)*e.r*0.4, Math.cos(a)*sp,rand(1.6,3.6),Math.sin(a)*sp, pick([0xff8a3a,0xffc24d,0xfff1c4]), rand(0.16,0.3),0.02,rand(0.6,1.1),-1.2,1.1); }
    SMK.spawn(e.x,y+h*0.9,e.z,rand(-0.4,0.4),1.5,rand(-0.4,0.4),0x241610,0.6,e.r*1.1,0.9,-0.9,1,0.36);
    if(e.final && e.rank>=2 && typeof spawnZone==='function') spawnZone('fire',e.x,e.z,{});
  } else if(e.el==='ice'){
    // JÉGTÖVISEK: a hullám irányába dőlő kristályfürt tör ki, megáll, majd szilánkokra pattan; alatta dér-folt, körülötte fagyos pára
    const h=1.55+e.rank*0.62, tiltX=(e.fz||0)*0.26, tiltZ=-(e.fx||0)*0.26;
    VFX.crystal(e.x,GROUND_Y-0.04,e.z,e.r*(main?1.0:0.78),h*(main?1.25:1.0),0.9+rand(0,0.2),tiltX,tiltZ,false);
    if(main){
      const a=rand(0,6.28);
      VFX.crystal(e.x+Math.cos(a)*e.r*0.5,GROUND_Y-0.04,e.z+Math.sin(a)*e.r*0.5,e.r*0.62,h*0.7,0.78+rand(0,0.2),tiltX+Math.sin(a)*0.3,tiltZ-Math.cos(a)*0.3,true);
      VFX.ring(e.x,y,e.z,0xbfe6ff,0.25,e.r*1.25,0.46,0.8);
      VFX.decal(e.x,GROUND_Y,e.z,e.r*1.25,0,0xd2ecfa,0.6,6);
      VFX.flare(e.x,y+h*1.1,e.z,0xdff4ff,1.6+e.rank*0.3,0.2);
      if(EFX.light) EFX.light(e.x,y+1.2,e.z,0x8fd8ff,2.8+e.rank*0.6,0.24);
    }
    VFX.spray(e.x,y+0.3,e.z,main?10:5,[0xffffff,0xbfe9ff,0x8fd4ff],6.5,{up:0.1,life:0.45,grav:13,w:0.022,len:0.03});
    SMK.spawn(e.x+rand(-0.4,0.4),y+0.25,e.z+rand(-0.4,0.4),rand(-0.5,0.5),0.3,rand(-0.5,0.5),0xcfe8f6,0.5,e.r*1.3,0.9,-0.1,1,0.26);
    if(e.final && e.rank>=3 && typeof spawnZone==='function') spawnZone('frost',e.x,e.z,{});
  } else if(e.el==='poison'){
    // MÉREGÖRVÉNY-lüktetés: befelé húzó gyűrű + középre csavarodó spóra-csíkok + felbuggyanó méregbuborék
    VFX.ring(e.x,y,e.z,0x9fdc4a,e.r,0.3,0.4,0.7);
    VFX.ball(e.x,y+0.5,e.z,0.3,e.r*0.38,0.32,P.toxic);
    for(let i=0;i<12;i++){ const a=i/12*6.283+rand(0,0.5), ca=Math.cos(a), sa=Math.sin(a);
      VFX.streak(e.x+ca*e.r*0.95,y+rand(0.1,0.6),e.z+sa*e.r*0.95, -ca*5.2-sa*3.4,rand(0.6,2.2),-sa*5.2+ca*3.4, pick([0x7ecb3a,0xb8f25a,0xe2ff9a]), rand(0.3,0.5),-1,1.0,0.02,0.07); }
    SMK.spawn(e.x+rand(-0.5,0.5),y+0.45,e.z+rand(-0.5,0.5),0,0.55,0,0x3c5a1c,0.55,e.r*1.15,0.8,-0.5,1,0.3);
    if(e.final){   // az örvény összeomlik: méregrobbanás, szétfröccsenő cseppek, maradandó tócsa + gázfelhő
      VFX.ball(e.x,y+0.6,e.z,e.r*0.25,e.r*0.9,0.5,P.toxic);
      VFX.ring(e.x,y+0.04,e.z,0xd8ff7a,0.3,e.r*1.3,0.52,0.85);
      VFX.flare(e.x,y+0.8,e.z,0xd8ff9a,e.r*1.5,0.22);
      VFX.spray(e.x,y+0.4,e.z,18,[0x9fdc4a,0xc8f060,0x5fae2a],8,{up:0.2,lift:2,life:0.7,grav:11,w:0.028,len:0.05});
      VFX.decal(e.x,GROUND_Y,e.z,e.r*1.1,0,0x1c330d,0.72,8,0x9fdc4a,3.5);
      if(EFX.light) EFX.light(e.x,y+1.2,e.z,0x9fdc4a,3.5,0.3);
      if(typeof spawnZone==='function') spawnZone('gas',e.x,e.z,{});
    }
  } else {
    // VIHARCSAPÁS: fő villám az égből + a talajon szétfutó ívek + (2. rangtól) késleltetett mellékcsapások
    skyStrike(e.x,e.z,1.5);
    VFX.bolt(e.x+rand(-2.5,2.5),y+17,e.z+rand(-2.5,2.5),e.x,y+0.1,e.z,0xffffff,0.24,0.75,0.12);
    VFX.ring(e.x,y+0.04,e.z,0xffffff,0.3,e.r*1.15,0.4,0.9);
    for(let b=0;b<5+e.rank*2;b++){ const a=b/(5+e.rank*2)*6.283+rand(-0.3,0.3), rr=e.r*rand(0.6,1.1);
      VFX.bolt(e.x,y+0.2,e.z, e.x+Math.cos(a)*rr,y+0.06,e.z+Math.sin(a)*rr, b%2?0xd8ccff:0xa98cff, rand(0.22,0.36), 0.28, 0.045, true); }
    if(e.rank>=2){ for(let b=0;b<e.rank;b++){ const a=b/e.rank*6.283+rand(0,2), rr=e.r*rand(0.6,0.85);
      laterStrike(0.09+b*0.08,e.x+Math.cos(a)*rr,e.z+Math.sin(a)*rr,0.75); } }
    if(EFX.light) EFX.light(e.x,y+2.5,e.z,0xc8b4ff,6.5+e.rank*1.2,0.36);
    if(typeof shake==='number') shake=Math.max(shake,0.32+e.rank*0.09);
  }
  const near=nearestTrolls(e.x,e.z,null,e.r,14);
  let strikes=0, prev={x:e.x,y:y+8,z:e.z}, hit=false;
  for(const m of near){
    if(m.g.position.y>GROUND_Y+3.5 || sightBlocked(e.x,y+0.8,e.z,m.g.position.x,y+0.8,m.g.position.z)) continue;
    if(e.shared && e.shared.has(m)) continue;
    if(e.shared) e.shared.add(m);
    if(e.el==='poison' && !m.boss && m.frozenSolid<=0){
      const p=m.g.position, k=0.12+e.rank*0.06;
      const next=pushMob(lerp(p.x,e.x,k),lerp(p.z,e.z,k),m.bodyR*0.9); p.x=next.x;p.z=next.z;
    }
    if(e.el==='lightning'){
      VFX.bolt(prev.x,prev.y,prev.z,m.g.position.x,m.g.position.y+m.bodyCY,m.g.position.z,0xcdbcff,0.28,0.45);
      VFX.flare(m.g.position.x,m.g.position.y+m.bodyCY,m.g.position.z,0xe8e0ff,1.6,0.18);
      prev={x:m.g.position.x,y:m.g.position.y+m.bodyCY,z:m.g.position.z}; strikes++;
    }
    hitWithSpell(m,e,1); hit=true;
  }
  if(e.el==='lightning'){
    for(const m of nearestTrolls(e.x,e.z,null,6+e.rank*2,12)){
      if(near.includes(m) || strikes>=2+e.rank) continue;
      if(sightBlocked(prev.x,prev.y,prev.z,m.g.position.x,m.g.position.y+m.bodyCY,m.g.position.z)) continue;
      VFX.bolt(prev.x,prev.y,prev.z,m.g.position.x,m.g.position.y+m.bodyCY,m.g.position.z,0xb9a4ff,0.26,0.4);
      VFX.flare(m.g.position.x,m.g.position.y+m.bodyCY,m.g.position.z,0xd8ccff,1.4,0.18);
      VFX.spray(m.g.position.x,m.g.position.y+m.bodyCY,m.g.position.z,6,[0xffffff,0xd8ccff],6,{up:-0.3,life:0.3,grav:10,w:0.016,len:0.05});
      prev={x:m.g.position.x,y:m.g.position.y+m.bodyCY,z:m.g.position.z};
      hitWithSpell(m,e,0.55); strikes++; hit=true;
    }
  }
  if(hit && !e.counter.hit){ STATS.hits++; e.counter.hit=true; }
}
function updateSpells(dt){
  if(coop) return;
  spellCd=Math.max(0,spellCd-dt);
  for(let i=spellEvents.length-1;i>=0;i--){
    const e=spellEvents[i]; e.delay-=dt;
    if(e.delay<=0){ spellEvents.splice(i,1); resolveSpell(e); }
  }
  for(const q of spellFx){ if(!q.on) continue; q.t-=dt;
    if(q.t<=0){ q.on=false; skyStrike(q.x,q.z,q.s); if(AUD.zap) AUD.zap(); if(typeof shake==='number') shake=Math.max(shake,0.14); } }
}
let arsenalText='';
function updateArsenalHud(){
  const el=document.getElementById('arsenalHud');
  el.hidden=!!coop || !running || !player.alive;
  if(el.hidden) return;
  const status=RUN.awakening>0 && currentElement!=='base'?' · '+tr('combat.rank',{n:RUN.awakening})+' · '+
    (spellCd<=0?tr('combat.ready'):tr('combat.cooldown',{n:Math.ceil(spellCd)})):'';
  const text=tr('combat.bows.'+equippedBow)[0]+status;
  if(text!==arsenalText){ arsenalText=text; el.textContent=text; }
}
function startWave(n){
  wave=n; toSpawn=4+n*2; spawnTimer=0; intermission=0;
  eliteToSpawn=(n%5===0 && !coop) ? 2+Math.floor(n/10) : 0;   // ELIT HULLÁM minden 5.-en (SP-only, mint a bolt): w5:2, w10:3, w15:3, w20:4...
  bossPending=(n%10===0 && !coop); if(bossPending){ toSpawn++; eliteToSpawn=Math.max(0,eliteToSpawn-1); }   // TURBÓ: minden 10. hullám élén a TROLL KIRÁLY (SP)
  waveDmgTaken=0;
  spawnAngles=[]; for(let i=0;i<toSpawn;i++) spawnAngles.push(CAVES[(Math.random()*CAVES.length)|0].ang); // FÁZIS 5: barlang-irányok a radar-előrejelzéshez
  setWaveHud(n); AUD.wave(); toast(bossPending?tr('ui.bossWave',{n:n}):(eliteToSpawn?tr('toast.eliteWave',{n:n,count:eliteToSpawn}):tr('toast.wave',{n:n})));
  resetHpOrbs();   // FÁZIS 4: minden hullám frissíti az élet-gömböket (fenntartás)
}
function pickTrollType(){
  const w=wave, haveShaman=monsters.some(m=>m.alive && m.typeId==='shaman');
  const table=[
    ['grunt',   Math.max(2.0, 6 - w*0.25)],
    ['scout',   w>=1 ? clamp(1.5 + w*0.35, 0, 6) : 0],
    ['brute',   w>=2 ? clamp((w-1)*0.5, 0, 4) : 0],   // villám-elemi előrehozva w>=2-re (minden elem megjelenjen)
    ['shaman',  w>=4 ? (haveShaman?0.15:clamp((w-3)*0.3,0,1.6)) : 0],
    ['spitter', w>=2 ? clamp((w-1)*0.45, 0, 4) : 0],
    ['wisp',    w>=2 ? clamp(1.0+(w-1)*0.55, 0, 5) : 0],   // Lidérc gyakoribb (eddig ~5%, most ~14% w2-n) — hogy tényleg lásd
  ];
  let total=0; for(const e of table) total+=e[1];
  if(total<=0) return 'grunt';
  let r=Math.random()*total;
  for(const e of table){ r-=e[1]; if(r<=0) return e[0]; }
  return 'grunt';
}
// RANDOM ELEM: spawnonként sorsolt innate elem, a TÍPUSTÓL FÜGGETLENÜL (a Lidérc marad jég-identitás; sámán/szilánk semleges)
const EL_NULL_CHANCE = SHARED.EL_NULL_CHANCE;   // hány hányad legyen SEMLEGES (base) troll; közös a co-op szerverrel: src/shared/config.js
function rollMonsterEl(id){ return Math.random()<EL_NULL_CHANCE ? null : EL_ORDER[1+((Math.random()*4)|0)]; }   // FEJLESZTÉS: TELJESEN random elem MINDEN típusra (nincs wisp=jég / spitter=méreg rögzítés)
function spawnMonster(){
  const ca=(spawnAngles.length ? spawnAngles.shift() : CAVES[(Math.random()*CAVES.length)|0].ang);
  let cave=CAVES[0], bd=9; for(const c of CAVES){ let dd=Math.abs(c.ang-ca); if(dd>Math.PI) dd=2*Math.PI-dd; if(dd<bd){ bd=dd; cave=c; } }   // a popolt szöghöz tartozó barlang
  const isBoss=bossPending; if(isBoss) bossPending=false;   // TURBÓ: a főellenség a hullám LEGELSŐ trollja
  const isElite=(!isBoss && eliteToSpawn>0); if(isElite) eliteToSpawn--;   // az elitek a hullám ELEJÉN jönnek
  let id=isBoss?'brute':pickTrollType();
  if(isElite && !(id==='grunt'||id==='brute'||id==='spitter'||id==='wisp')) id=pick(['grunt','grunt','brute','spitter','wisp']);   // elit sámán/kobold kizárva (frusztráló)
  const T=TROLL_TYPES[id];
  // GÖRBE: lineáris a futam alatt + enyhe rásegítés w20 után + négyzetes fal a w25-ös erő-csúcs után (endless mód) — SP-tükör; a co-op HP-t az mp-server/server.js sorsolja (régi képlet)!
  const baseSc=rand(0.85,1.15)*(1+wave*0.012), baseHp=24+wave*8+Math.max(0,wave-5)*3+6*Math.max(0,wave-20)+0.35*Math.pow(Math.max(0,wave-25),2), baseSp=(1.9+wave*0.12)*rand(0.85,1.15);
  const sc=baseSc*T.scaleMul*(isBoss?1.9:(isElite?1.3:1)), hp=Math.round(baseHp*T.hpMul*(isBoss?4.5:(isElite?2.8:1))), sp=Math.min(baseSp*T.speedMul*(isBoss?0.9:1), T.speedCap);   // elit: nagyobb + szívósabb, de NEM gyorsabb (kite-olható)
  const m=makeMonster(id, sc, hp, sp, rollMonsterEl(id));
  if(isElite){ m.elite=true; m.dmgMul*=1.5;   // elit: ×1.5 sebzés + arany aura + izzóbb szem
    const aura=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xffd27a,transparent:true,opacity:0.6,depthWrite:false,blending:THREE.AdditiveBlending}));
    aura.scale.setScalar(2.6*(m.scale||1)); aura.position.y=(m.bodyCY||1.1); m.g.add(aura); m.eliteAura=aura;
    if(m.eyes) m.eyes.forEach(e=>e.material.emissiveIntensity=(e.material.emissiveIntensity||1)*1.5); }
  if(isBoss){ m.boss=true; m.elite=true; m.noSplit=true; m.dmgMul*=1.6; bossRef=m;
    const aura=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xff9a3d,transparent:true,opacity:0.7,depthWrite:false,blending:THREE.AdditiveBlending}));
    aura.scale.setScalar(3.0); aura.position.y=(m.bodyCY||1.1)/(m.scale||1); m.g.add(aura); m.eliteAura=aura;   // a csoport már skálázott -> itt NEM szorzunk újra
    if(m.eyes) m.eyes.forEach(e=>e.material.emissiveIntensity=(e.material.emissiveIntensity||1)*1.8);
    const bn=bossBarEl.querySelector('.bn'); if(bn) bn.textContent=tr('ui.boss'); bossFill.style.width='100%'; bossBarEl.classList.add('on'); shake=Math.max(shake,0.5); }
  const inx=-cave.x/R_CAVE, inz=-cave.z/R_CAVE;   // befelé (központ felé) egységvektor
  m.g.position.set(cave.x + inx*2.4 + rand(-0.9,0.9), GROUND_Y, cave.z + inz*2.4 + rand(-0.9,0.9));   // a barlang szája előtt bújik elő, majd befelé indul
  monsters.push(m); aliveCount++; trollSpawnFx(m);
  if(id==='wisp'){ sparks.burst(m.g.position.x, GROUND_Y+1.0, m.g.position.z, 16, 0x9becff, 5, 0.7); if(!window.__wispSeen){ window.__wispSeen=1; toast(tr('toast.wisp')); } }   // LIDÉRC TELEGRÁF: cián felvillanás + egyszeri figyelmeztetés
  if(Math.random()<0.5 && AUD.growl) AUD.growl();
}
// HP-csík + "kárnyom" szellem-csík: a fehér sáv az ELŐZŐ értéken marad, majd lassan lecsorog az újra -> a veszteség jól látszik
let _hpShown=-1, _hpMaxShown=-1;
function setHp(n){
  n=Math.max(0, Math.min(player.maxHp, n)); const prev=player.hp; player.hp=n;
  const pct=(n/player.maxHp*100)+'%';
  if(hpfill) hpfill.style.width=pct;
  { const hi=Math.ceil(n); if(hi!==_hpShown||player.maxHp!==_hpMaxShown){ _hpShown=hi; _hpMaxShown=player.maxHp; hpnumEl.innerHTML=hi+'<span>/'+player.maxHp+'</span>';
      const low=(n>0 && n<player.maxHp*0.3); hpwrapEl.classList.toggle('low',low); lowhpEl.classList.toggle('on',low); } }
  if(hpghost){ if(n>=prev){ hpghost.style.transition='none'; hpghost.style.width=pct; void hpghost.offsetWidth; hpghost.style.transition=''; } else { hpghost.style.width=pct; } }
}
