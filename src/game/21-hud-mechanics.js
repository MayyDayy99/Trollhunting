/* ===================== HUD ===================== */
const hpfill=document.getElementById('hpfill'), hpghost=document.getElementById('hpghost'), hpbarEl=document.getElementById('hpbar'), dmgpop=document.getElementById('dmgpop'), waveN=document.querySelector('#wave .n'),
  waveLeft=document.querySelector('#wave .left'), scoreN=document.querySelector('#score .n'),
  powwrap=document.getElementById('powwrap'), powfill=document.getElementById('powfill'), powlabel=document.getElementById('powlabel'),
  hurtEl=document.getElementById('hurt'), witherEl=document.getElementById('wither'), toastEl=document.getElementById('toast'),
  startScreen=document.getElementById('start'), pauseScreen=document.getElementById('pause'), overScreen=document.getElementById('over');
let toastT=null;
function toast(txt){ toastEl.textContent=txt; toastEl.classList.toggle('long',(''+txt).length>30); toastEl.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>toastEl.classList.remove('show'),1400); }
/* ===================== TURBÓ: HUD-segédek + új játékmechanikák =====================
   Töltés-gyűrű a célkereszt körül, találat-jelölő, sorozat (combo), sebzés-irány, főellenség-sáv, erősítés-címkék;
   KITÉRÉS (Q) rövid sérthetetlenséggel, TÖKÉLETES LÖVÉS időzítés, VIHAR-túltöltés, kontroller-támogatás, mentett rekord. */
const ringEl=document.getElementById('ring'), ringArc=ringEl.querySelector('.arc'), hitmarkEl=document.getElementById('hitmark'),
  comboEl=document.getElementById('combo'), comboX=comboEl.querySelector('.cx'), comboL=comboEl.querySelector('.cl'), comboF=comboEl.querySelector('.ctf'),
  calloutEl=document.getElementById('callout'), hpnumEl=document.getElementById('hpnum'), hpwrapEl=document.getElementById('hpwrap'), lowhpEl=document.getElementById('lowhp'),
  dashRow=document.getElementById('dashrow'), dashFill=document.getElementById('dashfill'), dashFxEl=document.getElementById('dashfx'),
  bossBarEl=document.getElementById('bossbar'), bossFill=bossBarEl.querySelector('.bf'), bfOver=document.getElementById('bfOver'), bfInv=document.getElementById('bfInv'),
  waveEl=document.getElementById('wave'), waveFill=document.querySelector('#wave .wfill'), bestEl=document.querySelector('#score .best'),
  dmgDirEls=[...document.querySelectorAll('#dmgdir i')], radarKeyEl=document.getElementById('radarkey');
let _ringCls=null, _ringOn=false;
function setRing(frac, mode){
  if(frac<=0 && !mode){ if(_ringOn){ _ringOn=false; _ringCls=null; ringEl.setAttribute('class',''); ringArc.style.strokeDasharray='0 999'; } return; }
  _ringOn=true; const cls='on '+(mode||''); if(_ringCls!==cls){ _ringCls=cls; ringEl.setAttribute('class',cls); }
  ringArc.style.strokeDasharray=(Math.max(0,Math.min(1,frac))*226.2).toFixed(1)+' 999';
}
function hitMarker(kind){ if(kind==='kill') buzz(14); hitmarkEl.className=''; void hitmarkEl.offsetWidth; hitmarkEl.className='go '+(kind||''); }
function callout(txt, gold){ calloutEl.textContent=txt; calloutEl.className=''; void calloutEl.offsetWidth; calloutEl.className='go'+(gold?' gold':''); }
let _ddI=0;
function showDmgDir(sx,sz){   // vörös ív a képernyő közepe körül, a sebzés forrásának irányában
  const dx=sx-player.pos.x, dz=sz-player.pos.z; if(dx*dx+dz*dz<0.01) return;
  const fx=-Math.sin(player.yaw), fz=-Math.cos(player.yaw), rx=Math.cos(player.yaw), rz=-Math.sin(player.yaw);
  const ang=Math.atan2(dx*rx+dz*rz, dx*fx+dz*fz), el=dmgDirEls[_ddI++%dmgDirEls.length];
  el.style.transform='rotate('+ang.toFixed(3)+'rad)';
  if(el.animate) el.animate([{opacity:0.95},{opacity:0.75,offset:0.5},{opacity:0}],{duration:1100,easing:'ease-out'});
}
function damagePlayerFrom(src, d){ const hp0=player.hp; damagePlayer(d);
  if(player.hp<hp0 && src){ const p=src.g?src.g.position:(src.position||src); if(p) showDmgDir(p.x,p.z); } }

/* --- sorozat (combo): gyors egymás utáni ölések -> pont-szorzó (csak egyjátékos; co-opban a szerver pontoz) --- */
const COMBO_WIN=4.2; let combo=0, comboT=0, comboMult=1;
function comboOnKill(headshot){
  if(coop) return 1;
  combo++; comboT=COMBO_WIN; comboMult=1+0.1*Math.min(10,combo-1);
  if(combo>STATS.bestCombo) STATS.bestCombo=combo;
  if(combo>=2){ comboEl.classList.add('on'); comboX.textContent='×'+comboMult.toFixed(1); comboL.textContent=combo+' · '+tr('ui.combo');
    comboEl.classList.remove('bump'); void comboEl.offsetWidth; comboEl.classList.add('bump');
    const si=[2,3,5,8,12].indexOf(combo); if(si>=0) callout(tr('ui.streaks')[si]+'!', si>=2); }
  return comboMult;
}
function comboReset(){ combo=0; comboT=0; comboMult=1; comboEl.classList.remove('on','bump'); }

/* --- KITÉRÉS: gyors csúszás a mozgás irányába (álló helyzetből hátra), közben rövid sérthetetlenség --- */
const DASH_CD=1.8, DASH_T=0.17, DASH_SPEED=25;
let dashT=0, dashCd=0, dashX=0, dashZ=0, dashFxK=0, moveInX=0, moveInZ=0;
function tryDash(){
  if(!running||!player.alive||dashCd>0||dashT>0) return;
  let mx=moveInX, mz=moveInZ;
  if(!mx&&!mz){ mx=Math.sin(player.yaw); mz=Math.cos(player.yaw); }   // nincs irány -> HÁTRA (az íjász elszakad a trolltól)
  dashX=mx; dashZ=mz; dashT=DASH_T; dashCd=DASH_CD; dashFxK=1;
  player.invulnT=Math.max(player.invulnT||0,0.34);
  camera.fov=fovTarget+8; camera.updateProjectionMatrix(); if(AUD.whoosh) AUD.whoosh();
  for(let i=0;i<10;i++) RP.spawn(player.pos.x+rand(-0.4,0.4),player.feet+rand(0.1,1.2),player.pos.z+rand(-0.4,0.4), -mx*rand(2,6),rand(0,1.2),-mz*rand(2,6), 0x9fe3ff, rand(0.2,0.4),0.02, rand(0.25,0.45), 0,2, 0.7);
}

/* --- VIHAR-túltöltés + időlassítás + főellenség --- */
let overT=0, slowT=0, fullT=0, perfectShot=false, waveDmgTaken=0, bossPending=false, bossRef=null, stormK=0, legendT=0, fovTarget=SET.fov, camRoll=0, landDip=0, lastShotCd=1;
const SLAM_R=9;
const playerMotion={x:0,z:0,px:0,pz:0,ready:false};
function samplePlayerVelocity(dt){
  if(coop || dt<=0) return;
  const p=player.pos, s=playerMotion;
  if(s.ready){
    const k=1-Math.exp(-dt*8);
    s.x=lerp(s.x,clamp((p.x-s.px)/dt,-10,10),k);
    s.z=lerp(s.z,clamp((p.z-s.pz)/dt,-10,10),k);
  }
  s.px=p.x;s.pz=p.z;s.ready=true;
}
const bossHazards=[];
const _boulderGeo=(typeof BOSS_PROP_GEOS!=='undefined')?BOSS_PROP_GEOS.boulder:new THREE.ConeGeometry(0.6,1,5);
const _thornGeo=(typeof BOSS_PROP_GEOS!=='undefined')?BOSS_PROP_GEOS.thorns:_boulderGeo;
const _boulderMat=std({color:0xa8967c,roughness:0.9,vertexColors:true});
const _thornMat=std({color:0x9e7d43,emissive:0x2e1f08,emissiveIntensity:0.25,roughness:0.82,vertexColors:true});
// a veszély-jelzőt a VFX-készlet rajzolja (h.i = a jelző-pool indexe: feltöltődő kör / előre futó nyilas sáv); itt csak a kellék (szikla / tövis) él
for(let i=0;i<18;i++){
  const prop=new THREE.Mesh(_boulderGeo,_boulderMat); prop.visible=false; scene.add(prop);
  bossHazards.push({i,prop,active:false});
}
const HAZ_DUST=[0xc9b48f,0x8f7d62,0x5e5244];
function freeHazard(h){ h.active=false; VFX.teleOff(h.i); if(h.prop) h.prop.visible=false; }
function clearBossHazards(owner, pendingOnly){
  for(const h of bossHazards) if((!owner || h.owner===owner) && (!pendingOnly || h.delay>0)) freeHazard(h);
}
function bossHazard(owner,kind,x,z,r,delay,life,y){
  const h=bossHazards.find(h=>!h.active);
  if(!h) return;
  Object.assign(h,{owner,kind,x,z,r,delay,maxDelay:delay,life,maxLife:life,tick:0,fxAcc:0,active:true,y:y==null?GROUND_Y:y});
  if(kind!=='charge') VFX.tele(h.i,false,x,h.y+0.07,z,r,r,0,kind==='roots'?0xd6a24a:0xff5a36);
  if(h.prop){
    if(kind==='rocks'){
      h.prop.geometry=_boulderGeo; h.prop.material=_boulderMat;
      const bs=r*0.56; h.prop.position.set(x,h.y+13.5,z); h.prop.scale.set(bs,bs,bs); h.prop.rotation.set(rand(0,6),rand(0,6),0); h.prop.visible=true;
    } else if(kind==='roots'){
      h.prop.geometry=_thornGeo; h.prop.material=_thornMat;
      h.prop.position.set(x,h.y,z); h.prop.scale.set(r*0.72,0.01,r*0.72); h.prop.rotation.set(0,rand(0,6.28),0); h.prop.visible=false;
    } else h.prop.visible=false;
  }
  return h;
}
function updateBossHazards(dt){
  if(coop) return;
  for(const h of bossHazards){
    if(!h.active) continue;
    if(!h.owner.alive || ((h.owner.frozenSolid>0 || h.owner.rooted>0) && h.delay>0)){ freeHazard(h); continue; }
    if(h.delay>0){
      h.delay-=dt;
      const prog=1-Math.max(0,h.delay)/Math.max(0.01,h.maxDelay);
      const pulse=0.5+0.5*Math.sin(prog*prog*40);   // egyre szaporább lüktetés: a becsapódás pillanata "érezhető"
      VFX.teleSet(h.i,prog,Math.min(1,h.maxDelay>0?(h.maxDelay-h.delay)/0.18:1)*(0.6+0.4*pulse*prog));
      if(h.kind==='rocks' && h.prop){
        h.prop.position.y=h.y+0.45+13.0*(1-prog*prog);
        h.prop.rotation.x+=dt*5.5; h.prop.rotation.z+=dt*3.8;
        h.fxAcc+=dt*26;   // a zuhanó szikla porcsíkot húz
        while(h.fxAcc>=1){ h.fxAcc-=1; SMK.spawn(h.x+rand(-0.3,0.3),h.prop.position.y+0.5,h.z+rand(-0.3,0.3),rand(-0.3,0.3),rand(0.5,1.5),rand(-0.3,0.3),0x4a4034,0.5,h.r*0.55,0.45,-0.3,1,0.3); }
      } else if(h.kind==='roots'){
        h.fxAcc+=dt*16;   // a föld megmozdul: felszálló por + kipattanó rögök
        while(h.fxAcc>=1){ h.fxAcc-=1; const a=rand(0,6.28), rr=rand(0.2,h.r*0.85);
          RP.spawn(h.x+Math.cos(a)*rr,h.y+0.08,h.z+Math.sin(a)*rr, 0,rand(0.8,2.0),0, 0x9b7a42, 0.28,0.04,0.3, 3,1);
          if(Math.random()<0.4) VFX.chip(h.x+Math.cos(a)*rr,h.y+0.05,h.z+Math.sin(a)*rr,rand(-1,1),rand(2,4.5),rand(-1,1),pick(HAZ_DUST),0.5,12,0.05); }
      }
      if(h.delay>0) continue;
      VFX.teleSet(h.i,1,1,h.kind==='roots'?0xe2b25a:0xff402a);
      if(h.kind==='charge'){ freeHazard(h); continue; }
      if(h.kind==='slam'){
        // FÖLDRENGETŐ: kettős lökéshullám + izzó repedés-háló + szétrepülő törmelék + körben felcsapó porfal
        VFX.ring(h.x,h.y+0.07,h.z,0xff8a4a,0.9,SLAM_R,0.52,0.95);
        VFX.ring(h.x,h.y+0.09,h.z,0xffd9a0,0.5,SLAM_R*0.78,0.66,0.8);
        VFX.decal(h.x,h.y,h.z,SLAM_R*0.72,1,0x100a06,0.9,7,0xff7a2a,2.6);
        VFX.flare(h.x,h.y+1.0,h.z,0xff9a4a,6,0.24);
        for(let i=0;i<8;i++){ const a=i/8*6.283+rand(0,0.6), rr=rand(1.2,SLAM_R*0.7), ca=Math.cos(a), sa=Math.sin(a);   // körben felszakadó föld: kő- és rög-törmelék
          VFX.debris(h.x+ca*rr,h.y+0.2,h.z+sa*rr,5,HAZ_DUST,6,{up:0.5,lift:3.5,life:1.0,grav:14,w:0.09,vx:ca*3.5,vz:sa*3.5}); }
        VFX.spray(h.x,h.y+0.3,h.z,16,[0xffc27a,0xff8a3a],11,{up:0.15,lift:2,life:0.5,grav:10,w:0.02,len:0.05});
        if(EFX.light) EFX.light(h.x,h.y+2.0,h.z,0xff9a4a,6,0.4);
        for(let i=0;i<14;i++){ const a=i/14*6.283+rand(-0.2,0.2), rr=SLAM_R*rand(0.35,0.95);
          SMK.spawn(h.x+Math.cos(a)*rr,h.y+0.3,h.z+Math.sin(a)*rr, Math.cos(a)*rand(1.5,3.5),rand(0.8,2.0),Math.sin(a)*rand(1.5,3.5), pick([0x4a4034,0x5e5244]), 0.7,rand(2.2,3.4),rand(0.8,1.3),-0.3,1.2,0.4); }
        if(typeof shake==='number') shake=Math.max(shake,0.88);
        if(AUD.slam) AUD.slam(); else if(AUD.die) AUD.die();
      } else if(h.kind==='rocks'){
        if(h.prop) h.prop.visible=false;
        // SZIKLA-becsapódás: lökésgyűrű + kráter-repedés + szétfröccsenő kőszilánk + porfelhő
        VFX.ring(h.x,h.y+0.06,h.z,0xffa868,0.3,h.r*1.25,0.4,0.85);
        VFX.decal(h.x,h.y,h.z,h.r*1.1,1,0x120d08,0.85,6,0xff8a3a,1.2);
        VFX.flare(h.x,h.y+0.4,h.z,0xff9a4a,h.r*1.6,0.18);
        VFX.debris(h.x,h.y+0.25,h.z,20,HAZ_DUST,9,{up:0.25,lift:2.5,life:0.9,grav:14,w:0.085});
        for(let i=0;i<4;i++) SMK.spawn(h.x+rand(-0.6,0.6),h.y+0.3,h.z+rand(-0.6,0.6),rand(-1.6,1.6),rand(0.6,1.6),rand(-1.6,1.6),0x3a3228,0.6,h.r*rand(0.9,1.3),rand(0.6,0.9),-0.4,1.2,0.4);
        if(typeof shake==='number') shake=Math.max(shake,0.28);
        if(AUD.slam) AUD.slam();
      } else if(h.kind==='roots'){
        if(h.prop){ h.prop.visible=true; h.prop.scale.set(h.r*0.72,0.05,h.r*0.72); }
        // TÖVIS-kitörés: felszakadó föld (repedés + rögök) + gyökér-por
        VFX.ring(h.x,h.y+0.06,h.z,0xd6a24a,0.3,h.r*1.1,0.42,0.8);
        VFX.decal(h.x,h.y,h.z,h.r*1.05,1,0x16100a,0.85,h.life+2.5);
        VFX.debris(h.x,h.y+0.15,h.z,16,[0x9b7a42,0x6e5a34,0x5a7a36],7,{up:0.4,lift:2,life:0.8,grav:13,w:0.07});
        SMK.spawn(h.x,h.y+0.3,h.z,0,0.8,0,0x3d3222,0.55,h.r*1.1,0.7,-0.4,1,0.36);
      }
    }
    if(h.kind==='roots' && h.prop && h.prop.visible){
      const age=h.maxLife-h.life, grow=Math.min(1,age/0.18), sink=Math.min(1,Math.max(0,h.life)/0.32);
      const hy=grow*grow*(3-2*grow)*sink*1.18;
      h.prop.scale.set(h.r*0.72,Math.max(0.01,hy),h.r*0.72);
      h.prop.rotation.y+=dt*0.55;
    }
    h.tick-=dt;
    if(h.tick<=0){
      h.tick=h.kind==='roots'?0.7:10;
      const vertical=player.feet-h.y, safeJump=h.kind==='slam' && vertical>0.6;
      if(!safeJump && Math.abs(vertical)<(h.kind==='rocks'?3:1.6) && Math.hypot(player.pos.x-h.x,player.pos.z-h.z)<h.r+0.3){
        const damage=meleeBase()*(h.kind==='roots'?0.55:h.kind==='slam'?1.5:1.1);
        damagePlayerFrom(h.owner,damage);
      }
    }
    h.life-=dt; VFX.teleSet(h.i,h.kind==='roots'?0:1,(h.kind==='roots'?0.6:0.85)*Math.min(1,Math.max(0,h.life)/0.3));
    if(h.life<=0) freeHazard(h);
  }
}
function chooseBossAttack(m,d){
  const phase=m.hp/m.maxHp<=0.35?3:m.hp/m.maxHp<=0.7?2:1;
  if(d<6) return 'slam';
  if(phase>=2 && (m.bossAttacks||0)%3===2) return 'roots';
  return (m.bossAttacks||0)%2===0 && d<24?'charge':'rocks';
}
function beginBossAttack(m,kind){
  const p=m.g.position, phase=m.bossPhase||1;
  const target={x:player.pos.x+playerMotion.x*0.35,z:player.pos.z+playerMotion.z*0.35};
  const s=m.bossState={kind,t:0,wind:kind==='charge'?1.05:kind==='slam'?1.1:1.25,hit:false,target,fxAcc:0};
  m.atkPhase=0;m.atkKind=null;m.lungeBase=null;m._preRaise=0;
  callout(tr('combat.'+kind),true); if(AUD.growl) AUD.growl();
  if(kind==='charge'){
    const dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz)||1;
    s.fx=dx/d;s.fz=dz/d;s.distance=Math.min(19,d+2);s.travelled=0;s.duration=s.distance/20;
    const h=bossHazard(m,'charge',p.x+s.fx*s.distance*0.5,p.z+s.fz*s.distance*0.5,1.5,s.wind,0);
    if(h) VFX.tele(h.i,true,h.x,h.y+0.07,h.z,1.4,(s.distance+2.8)*0.5,Math.atan2(-s.fx,-s.fz),0xff5a36);   // roham-sáv: a nyilak a roham irányába futnak
  } else if(kind==='slam') bossHazard(m,'slam',p.x,p.z,SLAM_R,s.wind,0.3);
  else if(kind==='rocks'){
    for(let i=0;i<phase+1;i++){
      const x=target.x+playerMotion.x*i*0.18,z=target.z+playerMotion.z*i*0.18;
      bossHazard(m,'rocks',x+(i%2?2:-2),z,2.1,s.wind+i*0.28,0.25,player.feet);
    }
  } else {
    const a=Math.atan2(target.z-p.z,target.x-p.x), count=phase===3?5:3;
    for(let i=0;i<count;i++){
      const angle=a+(i-(count-1)/2)*0.65;
      bossHazard(m,'roots',p.x+Math.cos(angle)*9,p.z+Math.sin(angle)*9,2.2,s.wind,3.8);
    }
  }
}
const _bSegA=new THREE.Vector3(), _bSegB=new THREE.Vector3(), _bSegP=new THREE.Vector3();
function bossTick(m,dt){
  if(coop || !running || !player.alive) return false;
  const phase=m.hp/m.maxHp<=0.35?3:m.hp/m.maxHp<=0.7?2:1;
  if(phase!==m.bossPhase){ m.bossPhase=phase; callout(tr('combat.phase',{n:phase}),true); }
  let s=m.bossState;
  if(m.frozenSolid>0 || m.rooted>0){
    if(m.rooted>0) m.rooted=Math.max(0,m.rooted-dt);
    if(m.lungeBase){ m.g.position.x=m.lungeBase.x;m.g.position.z=m.lungeBase.z;m.lungeBase=null; }
    m.atkPhase=0;m.atkKind=null;m._preRaise=0;
    if(s && s.kind==='recover'){
      s.t+=dt;
      if(s.t>=s.duration){ m.bossState=null;m.bossCd=phase===3?0.65:1.2; }
      return true;
    }
    clearBossHazards(m, true); m.bossState=null; m.bossCd=Math.max(m.bossCd||0, 1.1);
    return true;
  }
  const p=m.g.position, d=Math.hypot(player.pos.x-p.x,player.pos.z-p.z);
  if(!s){
    if(m.atkPhase>0) return false;
    m.bossCd=(m.bossCd==null?2:m.bossCd)-dt;
    if(m.bossCd<=0){ beginBossAttack(m,chooseBossAttack(m,d));s=m.bossState; }
    else return false;
  }
  s.t+=dt;
  if(s.kind==='recover'){
    s.fxAcc=(s.fxAcc||0)+dt*8;
    while(s.fxAcc>=1){ s.fxAcc-=1;
      RP.spawn(p.x+rand(-0.9,0.9),p.y+(m.bodyCY||2)*1.15,p.z+rand(-0.9,0.9), rand(-0.6,0.6),rand(0.8,1.8),rand(-0.6,0.6), 0xffd27a, 0.32,0.03,0.45, -0.5,1); }
    if(s.t>=s.duration){ m.bossState=null;m.bossCd=phase===3?0.65:1.2; }
    return true;
  }
  const targetYaw=s.kind==='charge'?Math.atan2(s.fx,s.fz):Math.atan2(s.target.x-p.x,s.target.z-p.z);
  const turn=targetYaw-m.g.rotation.y;m.g.rotation.y+=Math.atan2(Math.sin(turn),Math.cos(turn))*(1-Math.exp(-dt*10));
  if(s.t<s.wind){
    if(s.kind==='charge'){
      s.fxAcc=(s.fxAcc||0)+dt*12;
      while(s.fxAcc>=1){ s.fxAcc-=1;
        RP.spawn(p.x-s.fx*0.6+rand(-0.5,0.5),GROUND_Y+0.12,p.z-s.fz*0.6+rand(-0.5,0.5), -s.fx*rand(2,4.5),rand(0.6,2.0),-s.fz*rand(2,4.5), 0xa89a78, 0.36,0.04,0.4, 5,1); }
    }
    return true;
  }
  if(s.kind==='charge'){
    const step=Math.min(20*dt,s.distance-s.travelled), ox=p.x,oz=p.z;
    const next=pushMob(p.x+s.fx*step,p.z+s.fz*step,(m.bodyR||1)*0.65);p.x=next.x;p.z=next.z;
    s.travelled+=step;
    s.fxAcc=(s.fxAcc||0)+step*0.65;
    while(s.fxAcc>=1){ s.fxAcc-=1;   // minden döngő lépés: porgyűrű + talaj-repedés + hátrafröccsenő rögök
      VFX.ring(p.x,GROUND_Y+0.05,p.z,0xc7a779,0.4,2.4,0.3,0.45);
      VFX.decal(p.x,GROUND_Y,p.z,1.5,1,0x14100a,0.7,5);
      VFX.debris(p.x,GROUND_Y+0.15,p.z,7,HAZ_DUST,5,{up:0.3,lift:1.5,life:0.7,grav:13,w:0.07,vx:-s.fx*3,vz:-s.fz*3});
      SMK.spawn(p.x-s.fx*0.8,GROUND_Y+0.4,p.z-s.fz*0.8,-s.fx*1.5,0.8,-s.fz*1.5,0x4a4034,0.6,2.2,0.7,-0.3,1.2,0.36);
      if(typeof shake==='number' && d<14) shake=Math.max(shake,0.16);
    }
    _bSegA.set(ox,0,oz); _bSegB.set(p.x,0,p.z); _bSegP.set(player.pos.x,0,player.pos.z);
    if(!s.hit && segDist(_bSegA,_bSegB,_bSegP)<1.6 &&
      player.feet<p.y+2.6){ damagePlayerFrom(m,meleeBase()*1.4);s.hit=true; }
    if(s.travelled<s.distance && Math.hypot(p.x-ox,p.z-oz)>step*0.3 && s.t<s.wind+s.duration+0.1) return true;
  }
  if(s.kind!=='charge' && s.t<s.wind+(s.kind==='rocks'?phase*0.28:0.15)) return true;
  m.bossAttacks=(m.bossAttacks||0)+1;
  m.bossState={kind:'recover',t:0,duration:phase===3?1.15:1.7,fxAcc:0};
  callout(tr('combat.exposed'),true);return true;
}
let _mDash=null, _aimV=null, _bossNameEl=null, _bossNameTxt='';
function updateTurboHud(dt){
  updateArsenalHud();
  if(MOBILE_INPUT){
    if(!_mDash) _mDash=document.getElementById('mobileDash');
    if(_mDash && _mDash.classList.contains('cd')!==(dashCd>0)) _mDash.classList.toggle('cd',dashCd>0);
    // célzás-lassítás: ha egy troll teste a célkereszt közelében van, a húzás érzékenysége ~45%-kal csökken (finom ráhúzás)
    let k=1; if(running){ if(!_aimV) _aimV=new THREE.Vector3(); camera.getWorldDirection(_aimV);
      for(const m of monsters){ if(!m.alive) continue; const p=m.g.position, dx=p.x-camera.position.x, dy=p.y+(m.bodyCY||1)-camera.position.y, dz=p.z-camera.position.z, d=Math.hypot(dx,dy,dz)||1;
        if(d<45 && (dx*_aimV.x+dy*_aimV.y+dz*_aimV.z)/d > Math.cos(Math.max(0.035,(m.bodyR||0.6)/d*1.6))){ k=0.55; break; } } }
    touchAimK=lerp(touchAimK,k,Math.min(1,dt*10));
  }
  // sorozat-időzítő
  if(combo>0 && running){ comboT-=dt; if(comboT<=0) comboReset(); else if(combo>=2) comboF.style.transform='scaleX('+(comboT/COMBO_WIN).toFixed(3)+')'; }
  // kitérés
  if(dashCd>0){ if(running) dashCd=Math.max(0,dashCd-dt); dashFill.style.width=((1-dashCd/DASH_CD)*100).toFixed(0)+'%'; if(dashRow.classList.contains('ready')) dashRow.classList.remove('ready'); if(dashCd<=0){ dashRow.classList.add('ready'); dashFill.style.width='100%'; } }
  if(dashFxK>0){ dashFxK=Math.max(0,dashFxK-dt*3.2); dashFxEl.style.opacity=(dashFxK*0.9).toFixed(2); }
  // erősítések
  if(overT>0){ if(running) overT-=dt; bfOver.textContent=tr('ui.over',{n:Math.max(0,overT).toFixed(1)}); bfOver.classList.add('on'); if(overT<=0) bfOver.classList.remove('on'); }
  if(player.invulnT>0.4){ bfInv.textContent=tr('ui.inv',{n:player.invulnT.toFixed(1)}); bfInv.classList.add('on'); } else if(bfInv.classList.contains('on')) bfInv.classList.remove('on');
  // főellenség
  if(bossRef){ if(!bossRef.alive){ bossRef=null; _bossNameTxt=''; bossBarEl.classList.remove('on'); } else {
    bossFill.style.width=(Math.max(0,bossRef.hp/(bossRef.maxHp||1))*100).toFixed(1)+'%';
    if(!_bossNameEl) _bossNameEl=bossBarEl.querySelector('.bn');
    const lbl=bossRef.bossState&&bossRef.bossState.kind==='recover'?tr('combat.exposed'):tr('combat.phase',{n:bossRef.bossPhase||1});
    if(_bossNameEl && lbl!==_bossNameTxt){ _bossNameTxt=lbl; _bossNameEl.textContent=lbl; }
  } }
  // VIHAR ég-villanás lecsengése + záró-pass paraméterek
  if(stormK>0){ stormK=Math.max(0,stormK-dt*0.9); SKY_U.uStorm.value=stormK; FXS.tintK=stormK*0.55; }
  const ho=parseFloat(hurtEl.style.opacity)||0; FXS.hurt=Math.max(ho*0.8, dashFxK*0.5);
  FXS.focus=lerp(FXS.focus, (drawing&&running)?Math.min(1,charge):0, Math.min(1,dt*8));
  FXS.lowHp=(player.alive && player.hp<player.maxHp*0.3)?1:0;
  if(running){ STATS.time+=dt; legendT+=dt; if(legendT>26 && legendT-dt<=26 && radarKeyEl) radarKeyEl.classList.add('dim'); }
}

/* --- kontroller (standard mapping): bal kar mozgás, jobb kar nézés, RT feszít/lő, RB/X üt, A ugrik, B kitér, Y VIHAR, LB / d-pad elem --- */
let padMX=0, padMY=0, padJump=false, padSprint=false, _padPrev=[], padSeen=false;
function pollGamepad(dt){
  const gps=(navigator.getGamepads?navigator.getGamepads():[])||[]; let g=null;
  for(let i=0;i<gps.length;i++){ const x=gps[i]; if(x&&x.connected&&x.buttons&&x.buttons.length>=10){ g=x; break; } }
  if(!g){ padMX=padMY=0; padJump=false; padSprint=false; return; }
  const dz=(v)=>{ v=v||0; return Math.abs(v)<0.17?0:(v-Math.sign(v)*0.17)/0.83; };
  const B=(i)=>!!(g.buttons[i]&&(g.buttons[i].pressed||g.buttons[i].value>0.5)), E=(i)=>B(i)&&!_padPrev[i], R=(i)=>!B(i)&&_padPrev[i];
  if(!running){ padMX=padMY=0; padJump=false;
    if(E(0)||E(9)){ if(shopOpen) closeShop(false); else if(!pauseScreen.classList.contains('hide')) resumeGame(); else if(!startScreen.classList.contains('hide')||!overScreen.classList.contains('hide')) beginPlay(); }
  } else {
    padSeen=true; padMX=dz(g.axes[0]); padMY=-dz(g.axes[1]);
    const lx=dz(g.axes[2]), ly=dz(g.axes[3]);
    if(lx||ly) applyLook(lx*Math.abs(lx)*dt*1250, ly*Math.abs(ly)*dt*950);
    padJump=B(0); if(E(10)) padSprint=!padSprint; if(!padMX&&!padMY) padSprint=false;
    if(E(7)){ lmbHeld=true; startDraw(); } if(R(7)) releaseDraw();
    if(E(5)||E(2)||E(6)) meleeSwing();
    if(E(1)) tryDash();
    if(E(3)) fireVihar();
    if(E(4)||E(14)||E(15)){ const n=EL_ORDER.length, i=EL_ORDER.indexOf(currentElement), d=E(14)?-1:1; setElement(EL_ORDER[((i+d)%n+n)%n]); }
    if(E(9)) pauseGame();
  }
  for(let i=0;i<g.buttons.length;i++) _padPrev[i]=B(i);
}

/* --- beállítások (érzékenység / látószög / hangerő / kapcsolók) --- */
function applySettings(save){
  FOV_BASE=SET.fov; fovTarget=SET.fov; if(!running){ camera.fov=SET.fov; camera.updateProjectionMatrix(); }
  if(AUD.setVol) AUD.setVol(SET.vol/100*0.9); dnOn=!!SET.dmgNums;
  document.querySelectorAll('[data-set]').forEach(inp=>{ const k=inp.dataset.set; if(document.activeElement!==inp) inp.value=SET[k]; });
  document.querySelectorAll('[data-setv]').forEach(b=>{ const k=b.dataset.setv; b.textContent=(k==='sens')?SET.sens.toFixed(2)+'×':(k==='fov'?SET.fov+'°':SET.vol+'%'); });
  document.querySelectorAll('[data-tog]').forEach(b=>b.classList.toggle('on', !!SET[b.dataset.tog]));
  if(save) saveJSON(SET_KEY,SET);
}
document.querySelectorAll('[data-set]').forEach(inp=>{ inp.addEventListener('input',e=>{ e.stopPropagation(); SET[inp.dataset.set]=+inp.value; applySettings(true); }); inp.addEventListener('click',e=>e.stopPropagation()); });
document.querySelectorAll('[data-tog]').forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); SET[b.dataset.tog]=!SET[b.dataset.tog]; applySettings(true); }));
function showBest(){ if(bestEl) bestEl.textContent=BEST.score>0?tr('ui.best',{n:fmtPts(BEST.score)}):''; }
function renderOverStats(){
  const acc=STATS.shots>0?Math.round(Math.min(1,STATS.hits/STATS.shots)*100):0, mm=Math.floor(STATS.time/60), ss=Math.floor(STATS.time%60);
  const cells=[[STATS.kills,'statKills'],[STATS.heads,'statHead'],[acc+'%','statAcc'],[STATS.bestCombo,'statCombo'],[mm+':'+(ss<10?'0':'')+ss,'statTime'],[STATS.reacts,'statReact']];
  const grid=document.getElementById('overGrid'); if(grid) grid.innerHTML=cells.map(c=>'<div><b>'+c[0]+'</b><span>'+tr('ui.'+c[1])+'</span></div>').join('');
  const rec=document.getElementById('overRec'), isRec=(!coop && score>BEST.score && score>0);
  if(isRec){ BEST.score=score; BEST.wave=wave; saveJSON(BEST_KEY,BEST); }
  if(rec){ rec.classList.toggle('hide',!isRec); rec.textContent=tr('ui.newRec'); }
  showBest();
}
function setText(sel, txt){ const el=document.querySelector(sel); if(el) el.textContent=txt; }
function setHtml(sel, html){ const el=document.querySelector(sel); if(el) el.innerHTML=html; }
let _waveMax=0, _trollShown=null, _waveShown=-1;
function setWaveHud(n){ if(waveN) waveN.textContent=tr('hud.wave',{n:n}); _trollShown=null;
  if(n!==_waveShown){ _waveShown=n; _waveMax=0; if(waveEl){ waveEl.classList.remove('pulse'); void waveEl.offsetWidth; waveEl.classList.add('pulse'); } } }
function setTrollHud(n){   // csak változáskor ír a DOM-ba; a csík a hullám hátralévő trolljait mutatja; szünetben visszaszámlálás
  const key=(intermission>0 && !coop) ? 'i'+Math.ceil(intermission) : n;
  if(key===_trollShown) return; _trollShown=key;
  if(n>_waveMax) _waveMax=n;
  if(waveLeft) waveLeft.textContent=(typeof key==='string') ? tr('ui.next',{n:Math.ceil(intermission)}) : tr('hud.trolls',{n:n});
  if(waveFill) waveFill.style.width=(_waveMax>0?Math.min(100,n/_waveMax*100):0).toFixed(0)+'%';
}
function elementName(id){ return tr('elements.'+id); }
function shopUpgradeName(d){ if(d.id==='awakening') return tr('combat.mastery'); const x=I18N[lang].shop.upgrades[d.id]; return x ? x[0] : d.hu; }
function shopUpgradeEff(d){ if(d.id==='awakening') return tr('combat.masteryEff'); const x=I18N[lang].shop.upgrades[d.id]; return x ? x[1] : d.eff; }
function setLang(next, save, announce){
  lang=(next==='hu')?'hu':'en';
  document.documentElement.lang=lang;
  if(save){ try{ localStorage.setItem(LANG_KEY,lang); }catch(_e){} }
  applyI18n();
  if(announce) toast(tr('langToast'));
}
function applyI18n(){
  document.title=tr('title');
  const langBtn=document.getElementById('langBtn');
  if(langBtn){ langBtn.textContent=tr('langButton'); langBtn.setAttribute('aria-label',tr('langAria')); }
  setText('#score small', tr('hud.score'));
  setText('#hpwrap .lab', tr('hud.hp'));
  setWaveHud(wave||1); setTrollHud((aliveCount||0)+(toSpawn||0));
  setText('#loading .ltitle', tr('loading.main'));
  setText('#loading .lsub', tr('loading.sub'));
  setText('#start .eyebrow', tr('menu.eyebrow'));
  setText('#start .tagline', tr('menu.tagline'));
  document.querySelectorAll('#start .mtab').forEach((b,i)=>{ b.textContent=tr('menu.tabs')[i]||tr('ui.tabSet'); });
  const prev=document.getElementById('mPrev'), next=document.getElementById('mNext');
  if(prev) prev.setAttribute('aria-label',tr('menu.prev'));
  if(next) next.setAttribute('aria-label',tr('menu.next'));
  const pages=document.querySelectorAll('#mTrack .mpage');
  if(pages[0]) pages[0].innerHTML=tr('menu.basics');
  if(pages[1]) pages[1].innerHTML=tr('menu.elements')+(!coop?'<div class="mtip">'+tr('combat.hint')+'</div>':'');
  if(pages[2]) pages[2].innerHTML=tr('menu.tactics')+'<div class="mtip">'+tr('ui.tipPerfect')+'</div>';
  { const g2=pages[0]&&pages[0].querySelector('.mgrid2'); if(g2) g2.insertAdjacentHTML('beforeend',tr('ui.extraKeys')); }
  document.querySelectorAll('[data-i18n]').forEach(e=>{ e.textContent=tr(e.dataset.i18n); });
  setText('#dashrow .dk', MOBILE_INPUT?tr('ui.dash'):tr('ui.dashKey')); setText('#mobileDash', tr('ui.mobDash')); setText('#mobileMove .runhint', tr('ui.runHint')); setText('#bossbar .bn', tr('ui.boss'));
  if(combo>=2) comboL.textContent=combo+' · '+tr('ui.combo'); showBest(); applySettings(false); _trollShown=null;
  document.querySelectorAll('.gfxlab,.gfx-h').forEach(e=>e.textContent=tr('menu.graphics'));
  document.querySelectorAll('.gfxbtn[data-gfx="low"]').forEach(e=>e.textContent=tr('menu.low'));
  document.querySelectorAll('.gfxbtn[data-gfx="medium"]').forEach(e=>e.textContent=tr('menu.medium'));
  document.querySelectorAll('.gfxbtn[data-gfx="high"]').forEach(e=>e.textContent=tr('menu.high'));
  setText('#startBtn', tr('menu.start'));
  setText('#pause .eyebrow', tr('pause.eyebrow'));
  setText('#pause h1', tr('pause.title'));
  setText('#pause p', tr('pause.hint'));
  setText('#resumeBtn', tr('pause.resume'));
  setText('#shop .shop-title', tr('shop.title'));
  setHtml('#shop .shop-pts', tr('shop.points')+': <span id="shopPts">'+fmtPts(score||0)+'</span>');
  setText('#shop .lane-atk .lane-h', tr('shop.lanes.atk'));
  setText('#shop .lane-def .lane-h', tr('shop.lanes.def'));
  setText('#shop .lane-mys .lane-h', tr('shop.lanes.mys'));
  setText('#shop .shop-foot', tr('shop.foot'));
  setText('#over .eyebrow', tr('over.eyebrow'));
  setText('#over h1', tr('over.title'));
  setText('#restartBtn', tr('over.restart'));
  const overStat=document.getElementById('overStat'); if(overStat) overStat.innerHTML=tr('over.stat',{wave:wave||0,score:score||0});
  setText('#coopWait .eyebrow', tr('coop.waitEyebrow'));
  setText('#coopWait h1', tr('coop.waitTitle'));
  const coopP=document.querySelector('#coopWait p'); if(coopP){ coopP.innerHTML=tr('coop.room')+' <b id="coopWaitCode" style="color:#7fe2ff;letter-spacing:.18em">'+(((coop&&coop.room)||_coopRoom)||'----')+'</b>'; coopWaitCodeEl=document.getElementById('coopWaitCode'); }
  setText('#coopWait .keys', tr('coop.startTogether'));
  const team=document.querySelector('#coopWait .brief-h'); if(team){ team.innerHTML=tr('coop.team')+' (<span id="coopWaitCount">'+(coopWaitRoster.length||1)+'</span>)'; coopWaitCountEl=document.getElementById('coopWaitCount'); }
  setText('#coopStartBtn', tr('coop.start'));
  setText('#coopWait .brief-hint', tr('coop.together'));
  setText('#mobileShoot', tr('mobile.shoot'));
  setText('#mobileShootAlt', tr('mobile.shoot'));
  setText('#mobileMelee', tr('mobile.melee'));
  setText('#mobileJump', tr('mobile.jump'));
  setText('#mobileSprint', tr('mobile.sprint'));
  setText('#mobileUlt', tr('mobile.ult'));
  setText('#mobileFullscreen', tr('mobile.fullscreen'));
  setText('#mobileRotate', tr('mobile.rotate'));
  setText('#rotateHint', tr('mobile.rotateHint'));
  const mAlt=document.getElementById('mobileShootAlt'); if(mAlt) mAlt.setAttribute('aria-label',tr('mobile.shootAltAria'));
  const mPause=document.getElementById('mobilePause'); if(mPause) mPause.setAttribute('aria-label',tr('mobile.pauseAria'));
  const mFull=document.getElementById('mobileFullscreen'); if(mFull) mFull.setAttribute('aria-label',tr('mobile.fullscreenAria'));
  const mRot=document.getElementById('mobileRotate'); if(mRot) mRot.setAttribute('aria-label',tr('mobile.rotateAria'));
  const short={hu:{base:'ALAP',fire:'TŰZ',ice:'JÉG',poison:'MÉR',lightning:'VILL'},en:{base:'BASE',fire:'FIRE',ice:'ICE',poison:'TOX',lightning:'BOLT'}}[lang];
  document.querySelectorAll('.mobile-el').forEach(b=>{ b.textContent=short[b.dataset.el]||elementName(b.dataset.el); b.setAttribute('aria-label',elementName(b.dataset.el)); });
  if(_elHud) _elHud.querySelectorAll('[data-el]').forEach(chip=>{ const lab=chip.querySelector('.nm'); if(lab) lab.textContent=elementName(chip.dataset.el); });
  if(lockHint) lockHint.textContent=lang==='hu'?'Kattints az egér rögzítéséhez · vagy húzd a jobb egérgombot a nézéshez':'Click to lock the mouse · or drag with right mouse button to look';
  if(_ultLab){ _lastUlt=-1; updateUltHud(); }
  if(shopOpen) renderShop(); else { const sub=document.getElementById('shopSub'); if(sub) sub.textContent=tr('shop.waveDone',{wave:wave||5}); const go=document.getElementById('shopGoBtn'); if(go) go.textContent=tr('shop.next',{wave:(wave||5)+1}); }
  if(coopInWaitRoom) coopRenderWait();
  if(coopHudEl){ if(coopHudCopyEl) coopHudCopyEl.textContent=tr('coop.copy'); const lbl=coopHudEl.querySelector('.lbl'); if(lbl) lbl.textContent=tr('coop.players'); coopUpdateHudPlayers(); coopSetStatus(coopConnected); }
}
// célkereszt vonalak
const cross=document.getElementById('cross');
['t','b','l','r'].forEach(d=>{ const e=document.createElement('div'); e.className='ln '+d; cross.appendChild(e); });
function setCross(spread){ // spread 0..1 (feszítéskor szétnyílik)
  const off=6+spread*18, L=10;
  const set=(sel,css)=>{ const el=cross.querySelector(sel); Object.assign(el.style,css); };
  cross.querySelectorAll('.ln').forEach(e=>{ e.style.width=e.style.height=''; });
  setCross_one('.t',{left:'50%',top:'50%',width:'2px',height:L+'px',transform:`translate(-50%,calc(-50% - ${off+L/2}px))`});
  setCross_one('.b',{left:'50%',top:'50%',width:'2px',height:L+'px',transform:`translate(-50%,calc(-50% + ${off+L/2}px))`});
  setCross_one('.l',{left:'50%',top:'50%',width:L+'px',height:'2px',transform:`translate(calc(-50% - ${off+L/2}px),-50%)`});
  setCross_one('.r',{left:'50%',top:'50%',width:L+'px',height:'2px',transform:`translate(calc(-50% + ${off+L/2}px),-50%)`});
}
function setCross_one(sel,css){ Object.assign(cross.querySelector(sel).style,css); }
setCross(0);

function updateMobileElementButtons(){
  document.querySelectorAll('.mobile-el').forEach(b=>b.classList.toggle('on', b.dataset.el===currentElement));
}
function bindMobileHold(btn, down, up){
  if(!btn) return;
  const clear=(e)=>{ btn.classList.remove('on'); if(up) up(e); };
  btn.addEventListener('pointerdown',e=>{ e.preventDefault(); e.stopPropagation(); btn.setPointerCapture(e.pointerId); btn.classList.add('on'); down(e); });
  btn.addEventListener('pointerup',e=>{ e.preventDefault(); e.stopPropagation(); clear(e); });
  btn.addEventListener('pointercancel',e=>{ e.preventDefault(); e.stopPropagation(); clear(e); });
  btn.addEventListener('lostpointercapture',clear);
}
function fullscreenEl(){ return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null; }
async function requestGameFullscreen(){
  const el=document.documentElement;
  const fn=el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  if(!fn){ toast(tr('toast.fsUnsupported')); return false; }
  try{ const r=fn.call(el); if(r&&typeof r.then==='function') await r; return true; }
  catch(_e){ toast(tr('toast.fsDenied')); return false; }
}
async function exitGameFullscreen(){
  const fn=document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
  if(!fn) return false;
  try{ const r=fn.call(document); if(r&&typeof r.then==='function') await r; return true; }
  catch(_e){ return false; }
}
function updateFullscreenButton(){
  const b=document.getElementById('mobileFullscreen');
  if(b) b.classList.toggle('on', !!fullscreenEl());
}
async function toggleGameFullscreen(){
  if(fullscreenEl()) await exitGameFullscreen();
  else await requestGameFullscreen();
  updateFullscreenButton();
}
async function requestLandscapeMode(){
  await requestGameFullscreen();
  try{
    if(screen.orientation && screen.orientation.lock){
      await screen.orientation.lock('landscape');
      toast(tr('toast.landscapeRequested'));
      return;
    }
  } catch(_e) {}
  toast(tr('toast.rotatePhone'));
}
function initMobileControls(){
  if(!MOBILE_INPUT) return;
  mobileStickEl=document.getElementById('mobileStick');
  const movePad=document.getElementById('mobileMove'), lookPad=document.getElementById('mobileLook');
  const prevent=e=>{ e.preventDefault(); e.stopPropagation(); };
  // LEBEGŐ JOYSTICK: a bal zónában ott jelenik meg, ahol a hüvelykujj leér; a szélig tolva automatikusan fut
  const moveZone=document.getElementById('mobileMoveZone');
  if(movePad && moveZone){
    const R=()=>64*uiScale, LIM=()=>52*uiScale;
    const updateMove=(e)=>{
      const dx=e.clientX-mobileMove.cx, dy=e.clientY-mobileMove.cy, lim=LIM(), d=Math.hypot(dx,dy), k=d>lim?lim/d:1;
      mobileMove.x=clamp((dx*k)/lim,-1,1); mobileMove.y=clamp((-dy*k)/lim,-1,1); updateMobileStick();
      const run=Math.hypot(mobileMove.x,mobileMove.y)>0.94; if(run!==mobileSprint){ mobileSprint=run; mobileStickEl.classList.toggle('sprint',run); movePad.classList.toggle('run',run); }
    };
    const endMove=e=>{ if(e.pointerId!==mobileMove.id) return; prevent(e); mobileMove.id=null; mobileMove.x=0; mobileMove.y=0; mobileSprint=false; updateMobileStick();
      movePad.classList.remove('active','run'); mobileStickEl.classList.remove('sprint'); movePad.style.left=''; movePad.style.top=''; movePad.style.bottom=''; };
    moveZone.addEventListener('pointerdown',e=>{ if(mobileMove.id!==null) return; prevent(e); mobileMove.id=e.pointerId;
      const r=R(), zr=moveZone.getBoundingClientRect(), cx=clamp(e.clientX, zr.left+r+6, zr.right-r), cy=clamp(e.clientY, zr.top+r, innerHeight-r-8);
      mobileMove.cx=cx; mobileMove.cy=cy; movePad.style.left=(cx-r)+'px'; movePad.style.top=(cy-r)+'px'; movePad.style.bottom='auto'; movePad.classList.add('active');
      moveZone.setPointerCapture(e.pointerId); updateMove(e); });
    moveZone.addEventListener('pointermove',e=>{ if(e.pointerId===mobileMove.id){ prevent(e); updateMove(e); } });
    moveZone.addEventListener('pointerup',endMove); moveZone.addEventListener('pointercancel',endMove); moveZone.addEventListener('lostpointercapture',endMove);
  }
  if(lookPad){
    let lookId=null, lx=0, ly=0;
    lookPad.addEventListener('pointerdown',e=>{ if(lookId!==null) return; prevent(e); lookId=e.pointerId; lx=e.clientX; ly=e.clientY; lookPad.setPointerCapture(e.pointerId); });
    lookPad.addEventListener('pointermove',e=>{ if(e.pointerId!==lookId) return; prevent(e); applyLook(e.clientX-lx,e.clientY-ly,TOUCH_LOOK_X,TOUCH_LOOK_Y); lx=e.clientX; ly=e.clientY; });
    const endLook=e=>{ if(e.pointerId===lookId){ prevent(e); lookId=null; } };
    lookPad.addEventListener('pointerup',endLook); lookPad.addEventListener('pointercancel',endLook);
  }
  { const sb=document.getElementById('mobileShoot'); let fid=null, fx=0, fy=0;   // LŐ: nyomva feszít, elengedve lő — és közben HÚZÁSSAL célozni is lehet róla
    bindMobileHold(sb,(e)=>{ fid=e.pointerId; fx=e.clientX; fy=e.clientY; sb.classList.add('drawing'); if(running){ lmbHeld=true; startDraw(); } },()=>{ fid=null; sb.classList.remove('drawing'); releaseDraw(); });
    sb.addEventListener('pointermove',e=>{ if(e.pointerId!==fid) return; e.preventDefault(); applyLook(e.clientX-fx,e.clientY-fy,TOUCH_LOOK_X,TOUCH_LOOK_Y); fx=e.clientX; fy=e.clientY; }); }
  bindMobileHold(document.getElementById('mobileShootAlt'),()=>{ if(running){ lmbHeld=true; startDraw(); } },()=>releaseDraw());
  bindMobileHold(document.getElementById('mobileMelee'),()=>meleeSwing());
  bindMobileHold(document.getElementById('mobileJump'),()=>{ mobileJump=true; },()=>{ mobileJump=false; });
  bindMobileHold(document.getElementById('mobileSprint'),()=>{ mobileSprint=true; },()=>{ mobileSprint=false; });
  bindMobileHold(document.getElementById('mobileDash'),()=>tryDash());
  bindMobileHold(document.getElementById('mobileUlt'),()=>{ if(running) fireVihar(); });
  bindMobileHold(document.getElementById('mobilePause'),()=>{ if(running) pauseGame(); });
  const fullBtn=document.getElementById('mobileFullscreen'), rotateBtn=document.getElementById('mobileRotate');
  if(fullBtn) fullBtn.addEventListener('pointerdown',e=>{ prevent(e); toggleGameFullscreen(); });
  if(rotateBtn) rotateBtn.addEventListener('pointerdown',e=>{ prevent(e); requestLandscapeMode(); });
  document.addEventListener('fullscreenchange', updateFullscreenButton);
  document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
  document.querySelectorAll('.mobile-el').forEach(b=>{ if(EL[b.dataset.el]) b.style.setProperty('--c',EL[b.dataset.el].ui); b.addEventListener('pointerdown',e=>{ prevent(e); setElement(b.dataset.el); buzz(8); }); });
  updateMobileElementButtons();
  updateFullscreenButton();
}
initMobileControls();

