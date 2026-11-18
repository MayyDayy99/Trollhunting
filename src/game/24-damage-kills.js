/* ===== FÁZIS 4: ÉLET-GÖMBÖK (gyógyító pickup — meleg zöld, megkülönböztethető a kék dísztől; co-opban helyi gyógyulás) ===== */
const hpOrbs=[];
const ORB_GEO=new THREE.IcosahedronGeometry(0.30,0);
const ORB_MAT=new THREE.MeshStandardMaterial({color:0x6fdf7a, emissive:0x37c259, emissiveIntensity:0.9, flatShading:false, roughness:0.35, metalness:0});
const ORB_HEAL=30, ORB_R=1.6, ORB_RESPAWN=20;
function makeHpOrb(x,z,baseY){
  const g=new THREE.Group(); g.position.set(x, baseY, z);
  const core=new THREE.Mesh(ORB_GEO, ORB_MAT); core.position.y=1.0; g.add(core);
  const cm=new THREE.MeshBasicMaterial({color:0xeafff0});                  // gyógyító "+" jel
  core.add(mesh(new THREE.BoxGeometry(0.26,0.085,0.085), cm, 0,0,0));
  core.add(mesh(new THREE.BoxGeometry(0.085,0.26,0.085), cm, 0,0,0));
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0x9fff8f,transparent:true,opacity:0.7,depthWrite:false,blending:THREE.AdditiveBlending}));
  glow.scale.setScalar(1.3); glow.position.y=1.0; g.add(glow);
  scene.add(g);
  const orb={ g, core, x, z, baseY, phase:Math.random()*6.28, alive:true, respawn:0 };
  hpOrbs.push(orb); return orb;
}
makeHpOrb(6,2,GROUND_Y); makeHpOrb(-6,-3,GROUND_Y); makeHpOrb(2,-9,GROUND_Y); makeHpOrb(18,9,GROUND_Y+4.1);   // egy a kilátó-fedélzeten (a mászás jutalma)
function resetHpOrbs(){ for(const o of hpOrbs){ o.alive=true; o.respawn=0; o.g.visible=true; } }
function updateHpOrbs(dt,t){
  for(const o of hpOrbs){
    if(o.alive){
      o.g.position.y = o.baseY + Math.sin(t*2+o.phase)*0.14;        // lebegés
      o.core.rotation.y += dt*1.3; o.core.rotation.x += dt*0.5;     // pörgés
      if(running && player.alive && player.hp < player.maxHp){
        const dx=player.pos.x-o.x, dz=player.pos.z-o.z;
        if(Math.hypot(dx,dz) < ORB_R && Math.abs(player.feet-o.baseY) < 2.2){
          if(coopActive()){ if(coop) coop.sendHeal(ORB_HEAL); } else setHp(player.hp + RUNM.orbHeal);   // FIX: co-opban szerver-hiteles gyógyulás; SP-ben a Gyógyító Gömbök fejlesztés skálázza
          o.alive=false; o.respawn=(coopActive()?ORB_RESPAWN:RUNM.orbRespawn); o.g.visible=false;
          const oy=o.baseY+1.0;
          EFX.ring(o.x,o.baseY+0.05,o.z,0x6fff8f,0.4,2.0,0.5,0.85); EFX.flash(o.x,oy,o.z,0x9fff9f,0.5,2.2,0.3); EFX.light(o.x,oy,o.z,0x6fff8f,3.5,0.4);
          for(let i=0;i<22;i++){ const a=rand(0,6.28),s=rand(1,3.5); RP.spawn(o.x,oy,o.z,Math.cos(a)*s,rand(1,3),Math.sin(a)*s,pick([0x7fff9f,0xcaffd0,0xffffff]),rand(0.5,0.9),0.04,rand(0.5,0.9),-0.5,1.2); }
          if(AUD.heal) AUD.heal(); toast(tr('toast.heal',{n:(coopActive()?ORB_HEAL:RUNM.orbHeal)}));
        }
      }
    } else { o.respawn-=dt; if(o.respawn<=0){ o.alive=true; o.g.visible=true; EFX.ring(o.x,o.baseY+0.05,o.z,0x6fff8f,0.3,1.2,0.4,0.6); } }   // 20s után visszatér
  }
}
// LÁTVÁNYOS sérülés-visszajelzés: erős vörös flash + kamera-rázás + HP-csík villanás + lebegő kár-szám + hang
function playerHurtFX(amount){
  const a=Math.max(1, Math.round(amount));
  if(hurtEl) hurtEl.style.opacity=Math.min(0.96, 0.5 + a*0.045);
  shake=Math.max(shake, 0.55 + Math.min(a,40)*0.012);
  if(hpbarEl){ hpbarEl.classList.remove('hit'); void hpbarEl.offsetWidth; hpbarEl.classList.add('hit'); }
  if(dmgpop){ dmgpop.textContent='-'+a; dmgpop.classList.remove('show'); void dmgpop.offsetWidth; dmgpop.classList.add('show'); }
  if(AUD.hurt) AUD.hurt();
  buzz(a>=15?45:25);
}
function damagePlayer(d){
  if(player.invulnT>0) return;   // Utolsó Esély: rövid sérthetetlenség
  const before=player.hp;
  if(player.hp-d<=0 && RUNM.lastStand && !player.lastStandUsed && player.alive){   // FEJLESZTÉS: Utolsó Esély (1x/futam)
    player.lastStandUsed=true; player.invulnT=2.0; setHp(1); playerHurtFX(before-1);
    shake=Math.max(shake,0.8); toast(tr('toast.lastChance'));
    EFX.ring(player.pos.x,GROUND_Y+0.05,player.pos.z,0xffd27a,0.5,5.0,0.6,0.9); EFX.light(player.pos.x,player.pos.y,player.pos.z,0xffd27a,5,0.5);
    return; }
  setHp(player.hp-d);
  if(player.hp<before){ playerHurtFX(before-player.hp); waveDmgTaken+=before-player.hp; }
  if(player.hp<=0 && player.alive){ player.alive=false; gameOver(); }
}
function addScore(n){ score+=n; scoreN.textContent=fmtPts(score); scoreN.classList.remove('bump'); void scoreN.offsetWidth; scoreN.classList.add('bump'); }
// GÖRBE: melee alap-sebzés — w20 után meredekebb, hogy a kimaxolt build ellen is maradjon halál-veszély (~4-6 ütés)
function meleeBase(){ return 10 + wave*0.6 + 0.5*Math.max(0, wave-20); }
// FEJLESZTÉS: Szilánk-vihar — a fagyott troll halála jég-novát robbant (kis AoE + jég-státusz; lánc-nova max 3 mélységig)
function iceNova(src, depth){
  const p=src.g.position, R=4.0*RUNM.elemRadiusMul, py=p.y+(src.bodyCY||1);
  // SZILÁNK-VIHAR: a fagyott test szétrobban — kifelé dőlő jégtüske-koszorú fagy ki körülötte, szilánk-esővel
  VFX.flare(p.x,py,p.z,0x9fdcff,3.6,0.2); EFX.ring(p.x,GROUND_Y+0.05,p.z,0x9fd2ff,0.5,R,0.5,0.9); EFX.light(p.x,py,p.z,0x9fd0ff,4,0.35);
  for(let i=0;i<5;i++){ const a=i*1.2566+rand(0,0.6), rr=R*rand(0.3,0.5); VFX.crystal(p.x+Math.cos(a)*rr,GROUND_Y-0.04,p.z+Math.sin(a)*rr,0.6,rand(1.2,1.9),rand(0.35,0.55),Math.sin(a)*0.55,-Math.cos(a)*0.55,i>2); }
  VFX.spray(p.x,py,p.z,24,[0xffffff,0xbfe9ff,0x6fc4ff],11,{up:-0.2,lift:1,life:0.5,grav:12,w:0.026,len:0.03});
  VFX.debris(p.x,py,p.z,10,[0xbfe9ff,0xe8f8ff],7,{up:-0.2,lift:1.5,life:0.8,grav:13,w:0.07});
  const dmg=30+0.2*(src.maxHp||40);
  for(const tg of nearestTrolls(p.x,p.z,src,R,6)){ if(!tg.alive||tg.dying>0) continue;
    tg.hurtFlash=0.2; tg.hp-=dmg; applyStatus(tg,'ice',null,RUNM.shardNova>=2?2:1);
    if(tg.hp<=0 && tg.alive){ tg._novaDepth=(depth||1)+1; killMonster(tg,false); } }
  shake=Math.max(shake,0.25); gainUlt(2);
}
// NAGY TROLL OSZTÓDÁS: a Kőbunkó halálkor 2 kisebb Kőszilánkra esik szét (a szilánkok noSplit -> nincs végtelen kaszkád)
function spawnSplitShards(parent){
  const px=parent.g.position.x, pz=parent.g.position.z;
  const baseSc=parent.scale*0.6, baseHp=Math.max(8,Math.round(parent.maxHp*0.22));
  const baseSp=Math.min((parent.speed/(TROLL_TYPES.brute.speedMul||0.55))*TROLL_TYPES.shard.speedMul, TROLL_TYPES.shard.speedCap);
  let count=(wave>10)?4:2;   // FEJLESZTÉS: 10. hullám után 4 szilánk (egyébként 2)
  const CAP=20; const live=monsters.filter(x=>x.alive).length; if(CAP-live < count) count=Math.max(0, Math.min(count, CAP-live));   // monster-cap a perf-hez
  for(let i=0;i<count;i++){ const ang=(i/Math.max(1,count))*Math.PI*2 + rand(-0.25,0.25);
    const s=makeMonster('shard', baseSc, baseHp, baseSp); s.noSplit=true;
    s.g.position.set(px+Math.cos(ang)*0.6, GROUND_Y, pz+Math.sin(ang)*0.6);
    s.spawnArc=0.0001; s.spawnFrom={x:px,z:pz}; s.spawnDir={x:Math.cos(ang),z:Math.sin(ang)}; s.hurtFlash=0.2;
    monsters.push(s); aliveCount++;   // a manuális aliveCount++ kell: így egy utolsó brute DoT-halála nem vált ki idő előtti "hullám teljesítve"-t
  }
  if(AUD.growl) AUD.growl();
}
function killMonster(m, headshot){
  m.alive=false; m.dying=0.001;
  if(m.gen){
    m._deathPose=motionRig(m).nodes.map(n=>n.rotation.clone());
    m._deathPelvis=m.pelvis.position.clone();
    m._deathElbows={L:m.elbows.L.rotation.x,R:m.elbows.R.rotation.x};
    m._deathKnees={L:m.knees.L.rotation.x,R:m.knees.R.rotation.x};
    m._deathWrists={L:m.fists.L.rotation.x,R:m.fists.R.rotation.x};
  }
  // TÁMADÁS-safety: ha lengés közben halt meg, a lunge-pozíciót + a póz-csontokat tiszta alapra állítjuk, hogy a halál-animáció ne ragadjon be
  if(m.lungeBase){ m.g.position.x=m.lungeBase.x; m.g.position.z=m.lungeBase.z; m.lungeBase=null; }
  m.atkPhase=0; m.atkKind=null; m.atkHit=false; if(m.torso) m.torso.rotation.set(0,0,0); if(m.head) m.head.rotation.x=0; m.g.scale.set(m.scale,m.scale,m.scale);
  const willSplit=(m.typeId==='brute' && !m.noSplit);   // Kőbunkó -> szétesik
  if(willSplit && !coopIsRemote(m)) spawnSplitShards(m);
  const p=m.g.position;
  let dx=p.x-player.pos.x, dz=p.z-player.pos.z; const dl=Math.hypot(dx,dz)||1; dx/=dl; dz/=dl;
  m.deathDir={x:dx,z:dz}; m.deathSpin=rand(-1,1);
  // halál-stílus: típus → fejlövés → véletlen
  let style;
  const big=(m.maxHp>=60);
  if(headshot && Math.random()<0.7){ style='burst'; }
  else if(m.typeId){
    switch(m.typeId){
      case 'brute':   style=Math.random()<0.5?'burst':'topple'; break;
      case 'shaman':  style='dissolve'; break;
      case 'spitter': style=Math.random()<0.6?'sink':'dissolve'; break;
      case 'scout':   style=Math.random()<0.6?'sink':'stagger'; break;
      default:        style=pick(['topple','stagger','crumple','topple']); break;
    }
  } else { style=(big&&Math.random()<0.4)?'burst':pick(['topple','dissolve','sink','stagger','crumple']); }
  if(willSplit) style='split';   // a szétesés felülír minden más stílust
  m.deathStyle=style;
  const bx=p.x, by=p.y+m.bodyCY, bz=p.z; AUD.die();
  switch(style){
    case 'burst': gore.burst(bx,by,bz,headshot?40:30,0x5f9168,11,0.5); gore.burst(bx,by,bz,14,0x9ec089,9,0.6); sparks.burst(bx,by,bz,18,0xffd27a,8,0.5); shake=Math.max(shake,headshot?0.45:0.34); if(headshot)AUD.head(); break;
    case 'dissolve': gore.burst(bx,by,bz,16,0x7fe2ff,4,0.7); sparks.burst(bx,by,bz,12,0x36c5ff,3,0.8); shake=Math.max(shake,0.12); AUD.growl(); break;
    case 'sink': gore.burst(bx,p.y+0.1,bz,18,0x3c5a3e,4,0.25); shake=Math.max(shake,0.16); break;
    case 'split': gore.burst(bx,by,bz,26,0x6f7a72,9,0.55); gore.burst(bx,by,bz,12,0xc98a3a,7,0.6); sparks.burst(bx,by,bz,16,0xffb24d,7,0.5); EFX.ring(bx,GROUND_Y+0.05,bz,0xc98a3a,0.5,3.6,0.5,0.85); EFX.flash(bx,by,bz,0xffce5a,0.5,3.0,0.22); shake=Math.max(shake,0.4); break;
    default: gore.burst(bx,by,bz,24,0x5f9168,6,0.4); gore.burst(bx,by,bz,10,0x2c4636,5,0.3); shake=Math.max(shake,0.18); break;
  }
  const wasFrozen=(m.frozenSolid>0), wasIced=(m.statusEl==='ice'||!!m.iceShell);   // Szilánk-vihar: a shatterShell nullázza -> ELŐTTE mentjük
  if(m.iceShell) shatterShell(m);   // fagyott troll: a jégburok szétpattan, hogy LÁTSZÓDJON a halál-animáció
  elementalDeath(m);   // ELEM: element-keyed death flourish (ash / shatter / melt / char)
  if(!coop && RUNM.shardNova>0 && (wasFrozen || (RUNM.shardNova>=2 && wasIced)) && (m._novaDepth||1)<=3) iceNova(m, m._novaDepth||1);   // FEJLESZTÉS: Szilánk-vihar (lánc max 3 mélységig)
  // TURBÓ: sorozat-szorzó (SP) + statisztika + lélek-szikrák/pont-felirat + főellenség-jutalom + utolsó-troll lassítás
  STATS.kills++; if(headshot) STATS.heads++;
  const _cm=comboOnKill(headshot); if(_cm>1 && AUD.combo) AUD.combo(combo);
  if(m.boss){ const bb=Math.round(1500*RUNM.scoreMul); addScore(bb); toast(tr('ui.bossDown',{n:bb})); shake=Math.max(shake,0.9); stormK=Math.max(stormK,0.6); SKY_U.uStormCol.value.setHex(0xffb347);
    // a TROLL KIRÁLY bukása: arany fényoszlop + óriás lökéshullám + izzó repedés-háló + szikra- és törmelék-eső
    EFX.flash(bx,by,bz,0xffc24d,1,9,0.6,0.6); EFX.ring(bx,GROUND_Y+0.06,bz,0xffd27a,1,14,0.9,1); EFX.ring(bx,GROUND_Y+0.08,bz,0xffffff,0.5,8,0.6,0.6); gainUlt(40);
    VFX.column(bx,GROUND_Y,bz,2.2,24,0xffc24d,1.0); VFX.flare(bx,by,bz,0xffc24d,9,0.4); VFX.decal(bx,GROUND_Y,bz,6,1,0x120a06,0.9,10,0xffa23a,4);
    VFX.spray(bx,by,bz,40,[0xffe7b8,0xffc24d,0xff8a3a],14,{up:0,lift:3,life:1.0,grav:7,w:0.026,len:0.06}); VFX.debris(bx,by,bz,24,[0x8f7d62,0x5f9168,0x5e5244],9,{up:0,lift:3,life:1.1,w:0.09}); }
  else if(m.elite){ const eb=Math.round(300*RUNM.scoreMul); addScore(eb); toast(tr('toast.eliteDown',{n:eb})); }
  if(m.typeId==='shaman'){ addScore(Math.round(60*RUNM.scoreMul)); callout(tr('toast.shamanDown'),true); }
  const _pts=Math.round((headshot?150:(m.typeId==='shard'?40:100))*RUNM.scoreMul*_cm);
  addScore(_pts);
  try{ trollDeathFx(m, coop?0:_pts, headshot); }catch(_e){}
  if(!coop && toSpawn<=0 && !monsters.some(o=>o.alive)) slowT=0.6;   // a hullám UTOLSÓ trollja: rövid lassított felvétel   // GAZDASÁG: a szilánk (brute-osztódás) csak 40 pont — különben a split rejtett bevétele 100%-olhatóvá tenné a katalógust
  if(RUNM.lifesteal>0) setHp(player.hp + (headshot?8:4)*RUNM.lifesteal);   // FEJLESZTÉS: Életfaló (ölés gyógyít, fej dupla)
}

