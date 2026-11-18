/* ===================== Effektek (szikra / por / szilánk) =====================
   A régi "izzó pötty" részecskék helyett a VFX-készletet hívják (a hívási felület változatlan):
   sparks = sebesség mentén megnyúlt, pattogó SZIKRA-csíkok; gore = tömör, nem izzó TÖRMELÉK-lapkák (moha, hús, kő, föld). */
const sparks={ burst(x,y,z,n,color,spd,up){ VFX.spray(x,y,z,n,color,spd,{up:-1,lift:spd*(up||0.3),life:0.5,grav:9,drag:0.8,w:0.02,len:0.05}); } };
const gore={ burst(x,y,z,n,color,spd,up){ VFX.debris(x,y,z,n,color,spd,{up:-1,lift:spd*(up||0.3),life:0.75,grav:12,w:0.055}); } };
let shake=0;

/* ===================== Audio (generált minták + szintetizált tartalék) =====================
   A src/assets/sfx/*.mp3 mintákat (window.GAME_ASSETS.sfx = {név:[url,...]}) az első felhasználói
   gesztusnál (unlock) töltjük be és dekódoljuk. Minden metódus a mintát játssza, ha már dekódolva van;
   addig (vagy ha a dekódolás nem sikerül) a régi szintetizált hang szól. */
const AUD=(function(){
  let ctx=null,master=null,noise=null,vol=0.45;
  const SFX_SRC=(window.GAME_ASSETS&&window.GAME_ASSETS.sfx)||{};
  const buf={}, live={}, lastT={}, lastIdx={};   // név -> [AudioBuffer]; szóló hangok; utolsó indítás (cooldown); utolsó variáns
  function decode(ab){ return new Promise((res,rej)=>{ const p=ctx.decodeAudioData(ab,res,rej); if(p&&p.catch) p.catch(rej); }); }   // callback-forma: régi Safari is
  function loadSfx(){
    for(const name in SFX_SRC){ const list=buf[name]=[];
      for(const url of SFX_SRC[name]) fetch(url).then(r=>r.arrayBuffer()).then(decode).then(b=>{ list.push(b); }).catch(()=>{}); } }   // data: URL is működik
  function unlock(){ if(ctx){ if(ctx.state==='suspended') ctx.resume(); return; }
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return; ctx=new AC();
    master=ctx.createGain(); master.gain.value=vol; master.connect(ctx.destination);
    const len=ctx.sampleRate*0.5, b=ctx.createBuffer(1,len,ctx.sampleRate), d=b.getChannelData(0);
    for(let i=0;i<len;i++) d[i]=Math.random()*2-1; noise=b; loadSfx(); }
  // MINTA lejátszása a master-en át (így a hangerő-beállítás érvényes). o.vary: ±5% hangmagasság; o.rate: fix sebesség;
  // o.max: egyszerre szóló példányok (a legrégebbi gyorsan elhalkul); o.cd: minimális szünet két indítás közt.
  // Igazat ad, ha a minta szól (vagy a cooldown nyelte el) -> ilyenkor a szintetizált tartalék NEM szól.
  function play(name,g,o){ const list=buf[name]; if(!ctx||!list||!list.length) return false;
    o=o||{}; const t=ctx.currentTime;
    if(o.cd && lastT[name]!=null && t-lastT[name]<o.cd) return true;
    const v=live[name]||(live[name]=[]), max=o.max||3;
    while(v.length>=max){ const old=v.shift(); try{ old.g.gain.setTargetAtTime(0,t,0.012); old.s.stop(t+0.06); }catch(_e){} }
    let i=(Math.random()*list.length)|0; if(list.length>1 && i===lastIdx[name]) i=(i+1)%list.length; lastIdx[name]=i;   // ne ugyanaz a variáns kétszer egymás után
    const s=ctx.createBufferSource(), ga=ctx.createGain(); s.buffer=list[i];
    s.playbackRate.value=o.rate||(o.vary?0.95+Math.random()*0.1:1); ga.gain.value=g;
    s.connect(ga).connect(master); s.start(t);
    const rec={s,g:ga}; v.push(rec); s.onended=()=>{ const k=v.indexOf(rec); if(k>=0) v.splice(k,1); };
    lastT[name]=t; return true; }
  function stop(name,fade){ const v=live[name]; if(!ctx||!v) return; const t=ctx.currentTime;
    while(v.length){ const r=v.shift(); try{ r.g.gain.setTargetAtTime(0,t,fade||0.03); r.s.stop(t+(fade||0.03)*5); }catch(_e){} } }
  const HIT_EL={fire:'hitFire', ice:'hitIce', poison:'hitPoison', lightning:'hitLightning'};
  function tone(f,t0,dur,type,g,glide){ const o=ctx.createOscillator(),ga=ctx.createGain(); o.type=type||'sine';
    o.frequency.setValueAtTime(f,t0); if(glide) o.frequency.exponentialRampToValueAtTime(Math.max(1,glide),t0+dur);
    ga.gain.setValueAtTime(0.0001,t0); ga.gain.exponentialRampToValueAtTime(g,t0+0.006); ga.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    o.connect(ga).connect(master); o.start(t0); o.stop(t0+dur+0.02); }
  function nz(t0,dur,g,ftype,f,q){ const s=ctx.createBufferSource(); s.buffer=noise; const bi=ctx.createBiquadFilter();
    bi.type=ftype; bi.frequency.value=f; bi.Q.value=q||1; const ga=ctx.createGain();
    ga.gain.setValueAtTime(0.0001,t0); ga.gain.exponentialRampToValueAtTime(g,t0+0.005); ga.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    s.connect(bi).connect(ga).connect(master); s.start(t0); s.stop(t0+dur+0.02); }
  const ok=()=>ctx;
  return {
    unlock,
    setVol(v){ vol=v; if(master) master.gain.value=v; },
    status(){ const o={}; for(const n in SFX_SRC) o[n]=!!buf[n] && buf[n].length===SFX_SRC[n].length; return o; },   // csak olvas: {név: minden variáns dekódolva?}
    perfect(){ if(!ok())return; if(play('perfect',0.4,{max:2})) return; const t=ctx.currentTime; tone(1320,t,0.10,'sine',0.16,1760); tone(1980,t+0.05,0.14,'sine',0.12,2640); },
    dashS(){ if(!ok())return; nz(ctx.currentTime,0.22,0.16,'bandpass',1500,0.8); },
    combo(n){ if(!ok())return; const t=ctx.currentTime, f=440*Math.pow(1.122,Math.min(12,n)); tone(f,t,0.09,'triangle',0.14,f*1.5); },   // marad szintetizált: emelkedő hangmagasság
    storm(){ if(!ok())return; if(play('storm',0.7,{max:1})) return; const t=ctx.currentTime; nz(t,0.9,0.35,'lowpass',260,0.7); tone(70,t,0.9,'sawtooth',0.22,34); nz(t+0.05,0.25,0.25,'highpass',2600,0.8); },
    spell(el,rank){ if(!ok())return; const t=ctx.currentTime, g=0.18+0.04*(rank||1); stop('bowDraw');
      if(el==='fire' && play('spellFire',0.5+0.05*Math.min(4,rank||1),{max:2})) return;
      if(el==='fire'){ nz(t,0.55,g*1.2,'lowpass',420,0.9); tone(110,t,0.45,'sawtooth',g,52); tone(220,t+0.04,0.32,'triangle',g*0.7,130); }
      else if(el==='ice'){ [1046,1318,1760].forEach((f,i)=>tone(f,t+i*0.035,0.28,'sine',g*0.75,f*1.18)); nz(t,0.24,g*0.6,'highpass',3400,1.4); }
      else if(el==='poison'){ nz(t,0.5,g*0.9,'bandpass',760,2.2); tone(165,t,0.48,'triangle',g*0.8,92); }
      else { nz(t,0.35,g*1.2,'highpass',2200,0.9); tone(95,t+0.08,0.55,'sawtooth',g*1.1,38); tone(880,t,0.16,'square',g*0.6,260); }
    },
    slam(){ if(!ok())return; if(play('slam',0.7,{max:2})) return; const t=ctx.currentTime; nz(t,0.48,0.32,'lowpass',240,0.8); tone(78,t,0.45,'sawtooth',0.28,32); },
    zap(){ if(!ok())return; if(play('zap',0.6,{vary:true,max:2})) return; const t=ctx.currentTime;   // villám-égi csapás (Elemi Ébredés)
      nz(t,0.22,0.28,'highpass',2400,0.8); tone(120,t+0.02,0.5,'sawtooth',0.2,38); nz(t+0.04,0.6,0.22,'lowpass',300,0.7); },
    bowDraw(){ if(!ok())return; if(play('bowDraw',0.3,{max:1})) return; const t=ctx.currentTime;   // íj-feszítés: fa nyikorgás + húr
      nz(t,0.32,0.035,'bandpass',420,4); tone(160,t,0.3,'triangle',0.025,230); },
    bowStop(){ if(ok()) stop('bowDraw'); },   // elengedéskor a nyikorgás elhalkul
    twang(c){ if(!ok())return; const t=ctx.currentTime, k=Math.min(1.75,c||0); stop('bowDraw');
      if(play('twang',0.28+0.12*Math.min(1,k),{rate:(1.08-0.08*k)*(0.97+Math.random()*0.06),cd:0.04})) return;   // erősebb húzás -> mélyebb húr; Megosztott Lövésnél egyszer szól
      tone(220-c*40,t,0.18,'triangle',0.3,90); nz(t,0.12,0.2,'bandpass',1400,1.2); },
    whoosh(){ if(!ok())return; if(play('whoosh',0.32,{vary:true})) return; nz(ctx.currentTime,0.16,0.12,'bandpass',900,1.4); },
    rasp(){ if(!ok())return; nz(ctx.currentTime,0.13,0.06,'bandpass',650,1.1); },                                   // tegez/bőr surranás (reload start)
    tap(){ if(!ok())return; const t=ctx.currentTime; tone(420,t,0.05,'sine',0.07,260); nz(t,0.04,0.05,'highpass',2200,0.9); },   // nyél a polcon koppan
    nock(){ if(!ok())return; const t=ctx.currentTime; tone(1500,t,0.04,'square',0.10,700); nz(t,0.03,0.07,'highpass',3000,1.2); tone(240,t,0.06,'triangle',0.05,160); },   // nock bekattan + halk húr-pendülés
    heal(){ if(!ok())return; const t=ctx.currentTime; [523,659,784].forEach((f,i)=>tone(f,t+i*0.06,0.28,'sine',0.16,f*1.05)); },   // emelkedő gyógyító-csengő
    hit(){ if(!ok())return; if(play('hit',0.5,{vary:true})) return; const t=ctx.currentTime; tone(150,t,0.18,'sine',0.32,60); nz(t,0.12,0.22,'lowpass',500,0.8); },
    head(){ if(!ok())return; if(play('head',0.45,{vary:true,max:2})) return; const t=ctx.currentTime; tone(1200,t,0.16,'square',0.22,500); tone(800,t,0.2,'sine',0.18,300); },
    hitEl(el,k){ if(!ok())return; const name=HIT_EL[el]; if(!name) return; k=k||1;   // elemi becsapódás; a nyíl-találat 'hit'/'head' hangja mellé, ezért halkabb
      if(play(name,0.3*k,{vary:true})) return; const t=ctx.currentTime;
      if(el==='fire') nz(t,0.25,0.1*k,'lowpass',600,0.8);
      else if(el==='ice'){ tone(2093,t,0.12,'sine',0.06*k,2637); nz(t,0.08,0.05*k,'highpass',4000,1.2); }
      else if(el==='poison') nz(t,0.2,0.08*k,'bandpass',500,3);
      else { nz(t,0.12,0.08*k,'highpass',3000,0.9); tone(1200,t,0.06,'square',0.035*k,300); } },
    growl(){ if(!ok())return; if(play('growl',0.35,{vary:true,max:2,cd:0.3})) return; const t=ctx.currentTime; tone(90,t,0.4,'sawtooth',0.12,60); },   // gyakran hívják: max 2 egyszerre + 0,3 s szünet
    die(){ if(!ok())return; if(play('die',0.5,{vary:true})) return; const t=ctx.currentTime; tone(260,t,0.5,'sawtooth',0.22,40); nz(t,0.4,0.16,'lowpass',700,0.6); },
    hurt(){ if(!ok())return; if(play('hurt',0.5,{vary:true,max:2})) return; const t=ctx.currentTime; tone(120,t,0.3,'square',0.3,50); nz(t,0.18,0.2,'lowpass',400,0.7); },
    wave(){ if(!ok())return; if(play('wave',0.45,{max:1})) return; const t=ctx.currentTime; [392,523,659].forEach((f,i)=>tone(f,t+i*0.13,0.4,'triangle',0.28)); },
    over(){ if(!ok())return; stop('bowDraw'); if(play('over',0.5,{max:1})) return; const t=ctx.currentTime; [440,349,262].forEach((f,i)=>tone(f,t+i*0.22,0.6,'sawtooth',0.3,f*0.6)); },
  };
})();

/* ===================== Bemenet (pointer lock + egér + WASD) =====================
   Robusztus: a pointer lock canvas-kattintásra (újra)indul + retry; lock-vesztés
   NEM pause-ol; ha a lock nem elérhető, jobbgomb-húzás = nézés. Mozgás és nézés
   minden frame-ben fut, ezért egyszerre is megy. */
const keys=Object.create(null);
let drawing=false, charge=0, locked=false;
let shotCd=0, meleeCd=0, lmbHeld=false;   // COMBAT: reload-zár + közelharc-időzítő + BAL gomb lenyomva-tartás (bufferelt felhúzás)
const SHOT_CD=0.85, MIN_CHARGE=0.18, MELEE_CD=0.55, MELEE_RANGE=3.4, MELEE_ARC=0.55, MELEE_DMG=24;   // 24: csak a legkisebb trollokat öli 1 ütésre, a többit löki
const cv=renderer.domElement;
const mobileMove={id:null,x:0,y:0,cx:0,cy:0};
let mobileSprint=false, mobileJump=false, mobileStickEl=null;

const lockHint=document.createElement('div'); lockHint.id='lockhint';
lockHint.style.cssText='position:fixed;left:50%;top:calc(50% + 78px);transform:translateX(-50%);z-index:7;'+
  'font:600 14px/1.4 -apple-system,"Segoe UI",sans-serif;color:#cfe0ff;background:rgba(8,14,28,.55);'+
  'border:1px solid rgba(180,200,240,.25);padding:7px 14px;border-radius:10px;pointer-events:none;'+
  'opacity:0;transition:opacity .2s;text-shadow:0 2px 8px rgba(0,0,0,.8);text-align:center;';
lockHint.textContent=lang==='hu'?'Kattints az egér rögzítéséhez · vagy húzd a jobb egérgombot a nézéshez':'Click to lock the mouse · or drag with right mouse button to look';
document.body.appendChild(lockHint);
function showLockHint(on){ lockHint.style.opacity=on?'1':'0'; }

const POINTERLOCK_SUPPORTED=!!cv.requestPointerLock;
let lockRetryT=null;
function requestLock(){ if(!POINTERLOCK_SUPPORTED){ showLockHint(running); return; }
  try{ const r=cv.requestPointerLock(); if(r&&typeof r.then==='function') r.catch(()=>{}); }catch(_){} }
function ensureLock(){ if(MOBILE_INPUT){ showLockHint(false); return; } if(!running||locked) return; requestLock(); clearTimeout(lockRetryT);
  lockRetryT=setTimeout(()=>{ if(running&&!locked) requestLock(); },250); }

let dragLook=false, dragBtn=-1, lastMX=0, lastMY=0;
const LOOK_S=0.0022;
const TOUCH_LOOK_X=2.35, TOUCH_LOOK_Y=1.85;
function applyLook(dx,dy,xMul,yMul){ const sv=SET.sens*(drawing?(1-0.22*Math.min(1,charge)):1)*(MOBILE_INPUT?touchAimK:1);   // célzás közben finomabb (feszítéssel arányos)
  player.yaw-=dx*LOOK_S*(xMul||1)*sv; player.pitch=clamp(player.pitch-dy*LOOK_S*(yMul||xMul||1)*sv*(SET.invY?-1:1),-1.45,1.45); }

addEventListener('keydown',e=>{ const k=e.key.toLowerCase(); keys[k]=true;
  if('12345'.includes(k)) setElement(EL_ORDER[+k-1]);   // ELEM: 1–5 switch arrow element
  if(k==='escape'&&running) pauseGame();
  else if(k==='b'){ bowTune=!bowTune; bowTuneEl.style.display=bowTune?'block':'none'; if(bowTune) applyBowAdj(); }
  else if(k==='r'){ if(running) fireVihar(); }   // VIHAR ultimate
  else if(k==='q'){ tryDash(); }                    // TURBÓ: kitérés
  else if(k==='f'){ if(running) meleeSwing(); }     // TURBÓ: közelharc billentyűről is
  else if(k==='tab'){ if(running){ e.preventDefault(); if(radarKeyEl) radarKeyEl.classList.toggle('dim'); legendT=99; } }
  else if(bowTune){ const A=bowAdj;
    if(k==='j') A.ry-=0.05; else if(k==='l') A.ry+=0.05;
    else if(k==='i') A.rx-=0.05; else if(k==='k') A.rx+=0.05;
    else if(k==='u') A.rz-=0.05; else if(k==='o') A.rz+=0.05;
    else if(k==='n') A.s=Math.max(0.2,A.s-0.04); else if(k==='m') A.s+=0.04;
    else if(k==='p') A.mx=-A.mx;
    else if(k==='z') A.mz=-A.mz;
    applyBowAdj(); }
});
addEventListener('keyup',e=>{ keys[e.key.toLowerCase()]=false; });
// ELEM: egér-GÖRGŐVEL is váltható az elem (le = következő, fel = előző; körbe)
addEventListener('wheel',e=>{ if(!running) return; const n=EL_ORDER.length, i=EL_ORDER.indexOf(currentElement); setElement(EL_ORDER[(((i<0?0:i)+(e.deltaY>0?1:-1))%n+n)%n]); e.preventDefault(); }, {passive:false});
let uiScale=1;   // mobil UI-lépték (--u): alacsony/keskeny telefonon kisebb gombok és HUD
function setUiScale(){ uiScale=clamp(Math.min(innerHeight/430, innerWidth/880),0.70,1.08); document.documentElement.style.setProperty('--u',uiScale.toFixed(3)); }
setUiScale(); addEventListener('resize',setUiScale);
function buzz(ms){ if(MOBILE_INPUT && navigator.vibrate){ try{ navigator.vibrate(ms); }catch(_e){} } }   // rezgő visszajelzés (Android)
let touchAimK=1;   // célzás-lassítás érintésen, ha troll van a célkereszt alatt
function updateMobileStick(){ if(mobileStickEl){ const r=36*uiScale; mobileStickEl.style.transform='translate(calc(-50% + '+(mobileMove.x*r).toFixed(1)+'px),calc(-50% + '+(-mobileMove.y*r).toFixed(1)+'px))'; } }
function resetMobileInput(){ mobileMove.id=null; mobileMove.x=0; mobileMove.y=0; mobileSprint=false; mobileJump=false; updateMobileStick(); document.querySelectorAll('.mobile-btn.on').forEach(b=>b.classList.remove('on')); }
function clearKeys(){ for(const k in keys) keys[k]=false; resetMobileInput(); } // FIX: minden lenyomott billentyű elengedése (blur/pause -> nincs beragadt mozgás)

document.addEventListener('pointerlockchange',()=>{ locked=(document.pointerLockElement===cv); showLockHint(running&&!locked&&!dragLook); });
document.addEventListener('pointerlockerror',()=>{ locked=false; showLockHint(running&&!dragLook); });

addEventListener('mousemove',e=>{
  if(locked){ applyLook(e.movementX,e.movementY); }
  else if(dragLook&&running){ applyLook(e.clientX-lastMX,e.clientY-lastMY); lastMX=e.clientX; lastMY=e.clientY; }
});

function startDraw(){ if(running&&player.alive&&shotCd<=0){ drawing=true; charge=0; fullT=0; drawT=0; drawNockIn=0; raspFired=swingFired=tapFired=seatFired=false; if(AUD.bowDraw) AUD.bowDraw(); } }   // reload alatt nem lehet újrahúzni; feszítés-nyikorgás
function releaseDraw(){
  lmbHeld=false;
  if(drawing){ if(AUD.bowStop) AUD.bowStop(); if(charge>=MIN_CHARGE){ perfectShot=(charge>=RUNM.drawCap-1e-6 && fullT<=0.26); STATS.shots++;
      if(perfectShot){ callout(tr('ui.perfect'),true); if(AUD.perfect) AUD.perfect(); gainUlt(1.5); cross.classList.remove('perfect'); void cross.offsetWidth; cross.classList.add('perfect'); }
      if(!castElementSpell(charge)){ fireArrow(charge); for(let k=1;k<=RUNM.multishotN;k++){ fireArrow(charge, (((k+1)>>1)*((k&1)?1:-1))*0.09); } }
      shotCd=SHOT_CD*(player.witherT>0?TROLL_TYPES.shaman.witherReloadMul:1)*RUNM.reloadMul*(overT>0?0.45:1); lastShotCd=shotCd; perfectShot=false; raspFired=swingFired=tapFired=seatFired=false; } drawing=false; charge=0; fullT=0; powwrap.classList.remove('on'); }   // FEJLESZTÉS: Megosztott Lövés (+N nyíl, szórás) + Fürge Kéz (reload-szorzó)   // min. töltés alatt nem lő; lövés után reload-anim (HEX: lassabb újratöltés)
}
function meleeSwing(){   // bal gomb: gyors közelharc-csapás a néző-kúpban (panic mid-reload)
  if(!(running&&player.alive) || meleeCd>0) return;
  meleeCd=MELEE_CD; if(AUD.whoosh) AUD.whoosh();
  slashArc.material.uniforms.uColor.value.setHex(EL[currentElement].fx).convertSRGBToLinear();   // a vágás-ív a kiválasztott elem színében
  const fx=-Math.sin(player.yaw), fz=-Math.cos(player.yaw);
  let best=null, bestD=1e9;
  for(const m of monsters){ if(!m.alive||m.dying>0) continue;
    const dx=m.g.position.x-player.pos.x, dz=m.g.position.z-player.pos.z, d=Math.hypot(dx,dz);
    if(d>MELEE_RANGE+(m.bodyR||0.5)) continue;
    if((dx*fx+dz*fz)/(d||1) < 1-MELEE_ARC) continue;   // csak a néző-kúpban (±~56°)
    if(d<bestD){ bestD=d; best=m; } }
  if(!best) return; const m=best, head=(player.pitch>0.35);
  if(coopIsRemote(m)){ m.hurtFlash=0.2; coopOnLocalHit(m, head, MELEE_DMG, currentElement, 0.25, 0.25); return; }   // co-op: szerver-hiteles; az elemet is átküldjük NEGYED erővel (mul=0.25)
  const rz=(m.resist&&m.resist['base'])?m.resist['base']:1;
  m.hp -= MELEE_DMG*(m.frozenSolid>0?1.5:1)*rz*bossDamageMultiplier(m); m.hurtFlash=0.2;
  const dx=m.g.position.x-player.pos.x, dz=m.g.position.z-player.pos.z, d=Math.hypot(dx,dz)||1;
  const kb=1.6/Math.max(0.6,m.scale||1); m.g.position.x+=(dx/d)*kb; m.g.position.z+=(dz/d)*kb;   // visszalökés (a könnyebb/kisebb trollok messzebb repülnek)
  const b=m.g.position, by=b.y+(m.bodyCY||1);
  gore.burst(b.x,by,b.z, 12, 0x4a6a3a, 5, 0.7); sparks.burst(b.x,by,b.z, 7, 0xffe7b8, 4, 0.35);
  shake=Math.max(shake,0.18); if(AUD.hit) AUD.hit();
  // ELEMI ÜTÉS: a kiválasztott elem hatása NEGYED erővel (a nyílhoz képest) — reakció/splash + státusz
  if(currentElement!=='base'){ const _sk=elementMechanic(m.g.position, currentElement, m, MELEE_DMG*0.25, head, m.statusEl, 0.25, false); if(!_sk) applyStatus(m, currentElement, 0); elementalImpact(m.g.position, currentElement, head); }
  if(m.hp<=0 && m.alive) killMonster(m, head);
}
cv.addEventListener('mousedown',e=>{
  if(!running) return;
  if(!locked){
    if(e.button===2||!POINTERLOCK_SUPPORTED){ dragLook=true; dragBtn=e.button; lastMX=e.clientX; lastMY=e.clientY; showLockHint(false); }
    else ensureLock();
    if(e.button===0){ lmbHeld=true; startDraw(); }    // BAL = íj feszítés (lenyomva-tartás bufferelődik)
    if(e.button===2) meleeSwing();   // JOBB = közelharc
    e.preventDefault(); return;
  }
  if(e.button===0){ lmbHeld=true; startDraw(); }
  if(e.button===2) meleeSwing();
});
cv.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('mouseup',e=>{
  if(e.button===dragBtn){ dragLook=false; dragBtn=-1; showLockHint(running&&!locked); } // csak a kezdő gomb állítja le a nézést
  if(e.button!==0) return;   // BAL gomb lő
  releaseDraw();
});
addEventListener('blur',()=>{ dragLook=false; dragBtn=-1; clearKeys(); if(running) pauseGame(); });
cv.addEventListener('click',()=>{ if(running&&!locked) ensureLock(); });

