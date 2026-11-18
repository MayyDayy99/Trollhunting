/* ===================== Állapot-vezérlés ===================== */
function cancelDraw(){ drawing=false; charge=0; prevCharge=0; bowKick=0; bowKickRot=0; relTwang=0; shotCd=0; meleeCd=0; lmbHeld=false; powwrap.classList.remove('on','reload','ready'); if(powlabel) powlabel.textContent=''; powfill.style.width='0%'; powfill.style.background=''; nockArrow.visible=false; drawT=0; drawNockIn=1; nock.position.set(0.008,0.060,Z_TIP);
  // megszakított reload (halál/szünet) helyreállítása: nyíl nyugalmi pózba + jelzők nullára
  raspFired=swingFired=tapFired=seatFired=false; nockArrow.position.set(0.046,0.060,0.04*bowAdj.mz); nockArrow.rotation.set(0,0,0); nockArrow.scale.setScalar(1); if(nockArrow._glow) nockArrow._glow.material.opacity=0; }
function resetGame(){
  stepPhase=0; stepWeight=0; bowLag.yaw=bowLag.pitch=bowLag.x=bowLag.y=bowLag.sprint=bowLag.air=bowLag.swap=0; sprintNow=false;
  equippedBow='starter'; ownedBows.clear(); ownedBows.add('starter'); if(!coop) dressBow('starter');
  spellCd=0; spellKick=0; spellEvents.length=0; for(const q of spellFx) q.on=false;
  clearZones(); VFX.reset(); FIREBURST.reset(); POISONPOOL.reset(); DUSTPOOF.reset(); ZAPBURST.reset();   // előző futam zónái + minden élő effekt (láng, matrica, örvény, jelző, flipbook) nullára
  if(typeof BOW_SKINS!=='undefined') BOW_SKINS.sigil.g.visible=false;
  clearBossHazards(); playerMotion.x=0; playerMotion.z=0; playerMotion.ready=false;
  for(const m of monsters){ scene.remove(m.g); disposeMonster(m); } monsters.length=0;
  for(const a of arrows){ a.active=false; a.g.visible=false; }
  resetBombs(); resetAbolts(); beamTube.visible=false; player.witherT=0;   // SÁMÁN: lövedékek + nyaláb + gyengítés nullára
  cancelDraw();
  for(const k in RUN) RUN[k]=0; applyUpgrades(); closeShop(true);   // FEJLESZTÉS: per-run reset (rangok 0, statok alapra, bolt zárva)
  player.lastStandUsed=false; player.invulnT=0; eliteToSpawn=0;   // Utolsó Esély + elit-számláló vissza
  let _sx=0;   // CO-OP SPAWN-SZÓRÁS: ne essen mindenki ugyanoda (különben egymásba lógtok + a társ+íj kitakarja a pályát)
  if(coopActive()){ const _ids=coopWaitRoster.map(p=>p.id).sort(); const _i=_ids.indexOf(coopMyId);
    if(_i>=0 && _ids.length>1){ _sx=(_i-(_ids.length-1)/2)*2.6; }                                                              // roster-index -> egy sorban, egymás mellett
    else if(coopMyId){ let _h=0; for(let _k=0;_k<coopMyId.length;_k++) _h=(_h*31+coopMyId.charCodeAt(_k))|0; _sx=((((_h%5)+5)%5)-2)*1.5; } }   // fallback: id-hash eltolás, ha nincs roster
  player.pos.set(_sx,1.7,0); player.yaw=0; player.pitch=0; player.hp=player.maxHp; player.alive=true; player.vy=0; player.feet=0; player.onGround=true; player.jumpReady=true;
  setHp(player.maxHp); score=0; scoreN.textContent='0'; aliveCount=0; toSpawn=0; intermission=0;
  for(const k in STATS) STATS[k]=0; comboReset(); dashT=0; dashCd=0; dashRow.classList.add('ready'); dashFill.style.width='100%'; overT=0; bfOver.classList.remove('on'); slowT=0; fullT=0; waveDmgTaken=0; bossPending=false; bossRef=null; bossBarEl.classList.remove('on'); stormK=0; SKY_U.uStorm.value=0; FXS.tintK=0; camRoll=0; landDip=0; legendT=0; if(radarKeyEl) radarKeyEl.classList.remove('dim'); _waveShown=-1;
  resetHpOrbs();   // FÁZIS 4: élet-gömbök vissza
  if(coop) coopOnReset(); // FIX: co-op könyvelés ürítése + revive új játéknál
}
function beginPlay(){
  if(coopActive() && running) return;                                             // idempotens: welcome+room_start egy frame-ben ne indítson kétszer (halál utáni restart OK, mert running=false)
  if(coopActive() && coopInWaitRoom){ if(coop) coop.send({t:'start'}); return; }   // várószobás manuális Start -> a SZERVER szinkronizál mindenkit (nem helyi indítás)
  AUD.unlock(); applySettings(false); resetGame(); ult=0; running=true; coopStarted=true; coopHideWait(); document.body.classList.add('ingame');
  startScreen.classList.add('hide'); pauseScreen.classList.add('hide'); overScreen.classList.add('hide');
  ensureLock(); startWave(1);
  if(!window.__elHintShown && !MOBILE_INPUT){ window.__elHintShown=true; setTimeout(()=>{ if(running) toast(tr('toast.elemHint')); }, 1900); }  // felfedezhetőség: az elemi FX csak 2–5 nyíllal látszik
}
function pauseGame(){ if(shopOpen) return; if(!running) return; running=false; dragLook=false; cancelDraw(); clearKeys(); showLockHint(false); pauseScreen.classList.remove('hide');
  if(document.pointerLockElement) document.exitPointerLock(); }
function resumeGame(){ if(player.hp<=0) return; AUD.unlock(); running=true; pauseScreen.classList.add('hide'); ensureLock(); }
function gameOver(){ running=false; cancelDraw(); showLockHint(false); AUD.over();
  document.getElementById('overStat').innerHTML=tr('over.stat',{wave:wave,score:fmtPts(score)}); renderOverStats(); document.body.classList.remove('ingame'); comboReset();
  pauseScreen.classList.add('hide'); startScreen.classList.add('hide'); overScreen.classList.remove('hide'); if(document.pointerLockElement) document.exitPointerLock(); }

// ===== FEJLESZTÉS-BOLT logika =====
function fmtPts(n){ return (''+n).replace(/\B(?=(\d{3})+(?!\d))/g,' '); }   // ezres tagolás: 6 400
function pips(rank,cap){ let s=''; for(let i=0;i<cap;i++) s+= (i<rank?'●':'○'); return s; }
function renderShop(){
  renderBowShop();
  const ptsEl=document.getElementById('shopPts'); if(ptsEl) ptsEl.textContent=fmtPts(score);
  const subEl=document.getElementById('shopSub'); if(subEl) subEl.textContent=tr('shop.waveDone',{wave:wave});
  const goEl=document.getElementById('shopGoBtn'); if(goEl) goEl.textContent=tr('shop.next',{wave:wave+1});
  for(const lane of ['atk','def','mys']){
    const host=document.querySelector('.lane-cards[data-lane="'+lane+'"]'); if(!host) continue; host.innerHTML='';
    for(const d of SHOP_DEFS){
      if(d.lane!==lane) continue;
      if(d.spOnly && coop) continue;   // Maró Méreg rejtve co-opban (DoT szerver-oldali)
      const rank=RUN[d.id], maxed=rank>=d.cap, gate=d.waves?d.waves[rank]:d.minWave;
      const locked=(!maxed && gate && wave<gate), cost=maxed?0:d.costs[rank];
      const card=document.createElement('div'); card.className='upcard'+(locked?' locked':''); card.dataset.id=d.id;
      const costCls=maxed?'max':(locked?'lock':(score>=cost?'afford':'poor'));
      const costTxt=maxed?'MAX':(locked?tr('shop.locked',{wave:gate}):('−'+fmtPts(cost)));
      card.innerHTML='<div class="uc-top"><span class="uc-glyph">'+d.glyph+'</span><span class="uc-name">'+shopUpgradeName(d)+'</span></div>'
        +'<div class="uc-eff">'+shopUpgradeEff(d)+'</div>'
        +'<div class="uc-row"><span class="uc-pips">'+pips(rank,d.cap)+'</span><span class="uc-cost '+costCls+'">'+costTxt+'</span></div>';
      card.addEventListener('click',function(){ buyUpgrade(d.id); });
      host.appendChild(card);
    }
  }
}
function buyUpgrade(id){
  const d=SHOP_DEFS.find(function(x){ return x.id===id; }); if(!d) return false;
  if(!shopOpen || (coop && d.spOnly)) return false;
  if(d.waves && wave<d.waves[RUN[id]]) return false;
  if(d.minWave && wave<d.minWave) return false;   // tier-kapu: még zárolt
  const rank=RUN[id]; if(rank>=d.cap) return false;
  const cost=d.costs[rank];
  if(score<cost){   // nincs elég pont -> piros rázás, nincs hang
    const el=document.querySelector('.upcard[data-id="'+id+'"]');
    if(el){ el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
    return false;
  }
  addScore(-cost);          // ZÁRT SZABÁLY: a pontot költöd (a kijelző élőben csökken)
  RUN[id]=rank+1;
  applyUpgrades();          // RUNM + player.maxHp + STATUS_CFG dps újraszámolás
  if(id==='hp') setHp(player.hp+30);   // Edzett Bőr: az új életet azonnal gyógyítja
  if(AUD.tap) AUD.tap();
  renderShop();
  return true;
}
function openShop(){
  shopOpen=true; running=false;          // befagyasztja a futás-kötött ágakat (mozgás/spawn/AI/töltés/regen)
  cancelDraw(); clearKeys(); showLockHint(false);
  if(document.pointerLockElement) document.exitPointerLock();   // egér szabad a kattintáshoz
  renderShop();
  const sc=document.getElementById('shop'); if(sc) sc.classList.remove('hide');
}
function closeShop(silent){
  shopOpen=false;
  const sc=document.getElementById('shop'); if(sc) sc.classList.add('hide');
  if(silent) return;                     // resetGame-ben: csak elrejt, nem indít hullámot
  running=true; intermission=0; ensureLock();
  startWave(wave+1);                     // startWave újratölti a toSpawn/spawnAngles/intermission-t
}
const _shopGo=document.getElementById('shopGoBtn'); if(_shopGo) _shopGo.addEventListener('click',function(){ closeShop(false); });
document.getElementById('startBtn').addEventListener('click',beginPlay);
document.getElementById('resumeBtn').addEventListener('click',resumeGame);
document.querySelectorAll('.gfxbtn').forEach(b=> b.addEventListener('click', e=>{ e.stopPropagation(); applyGraphics(b.dataset.gfx,true); }));
// --- Főmenü-lapozó (Alapok / Elemek / Taktika): fülek + nyilak + pöttyök + ←/→ + érintés-húzás.
//     Körbejár, és teljesen független a JÁTÉK gombtól (az mindig látszik a lapok alatt).
(function(){
  const track=document.getElementById('mTrack'); if(!track) return;
  const tabs=[...document.querySelectorAll('#start .mtab')];
  const dots=[...document.querySelectorAll('#start .mdots span')];
  const N=tabs.length; let pg=0;
  function go(p){ pg=(p%N+N)%N; track.style.transform='translateX(-'+(pg*100)+'%)';
    tabs.forEach((t,i)=>t.classList.toggle('on',i===pg));
    dots.forEach((d,i)=>d.classList.toggle('on',i===pg)); }
  tabs.forEach((t,i)=>t.addEventListener('click',e=>{ e.stopPropagation(); go(i); }));
  document.getElementById('mPrev').addEventListener('click',e=>{ e.stopPropagation(); go(pg-1); });
  document.getElementById('mNext').addEventListener('click',e=>{ e.stopPropagation(); go(pg+1); });
  document.addEventListener('keydown',e=>{ const sc=document.getElementById('start');
    if(!sc || sc.classList.contains('hide')) return;
    if(e.key==='ArrowLeft') go(pg-1); else if(e.key==='ArrowRight') go(pg+1); });
  let tx=null; const vp=document.querySelector('#start .mviewport');
  vp.addEventListener('touchstart',e=>{ tx=e.touches[0].clientX; },{passive:true});
  vp.addEventListener('touchend',e=>{ if(tx===null) return; const dx=e.changedTouches[0].clientX-tx; tx=null;
    if(Math.abs(dx)>40) go(pg+(dx<0?1:-1)); },{passive:true});
})();
document.getElementById('restartBtn').addEventListener('click',beginPlay);

// --- fejlesztői/teszt-hook: csak #dev hash-sel aktív (Playwright-verifikációhoz; játékos-úton inert) ---
if(location.hash.indexOf('dev')>=0) window.__MR={ monsters, RUN, RUNM, applyUpgrades, addScore, startWave, freezeEncase, freezeFull, killMonster, openShop, applyStatus, renderer, player, damagePlayer, camera, scene, THREE, CAVES,
  BOW_DEFS, BOW_SKINS, VFX, buyBow, dressBow, buyUpgrade, castElementSpell, resolveSpell, spellEvents, updateSpells, spellTarget, hitWithSpell, sightBlocked, tacticalHeading,
  bossTick, beginBossAttack, chooseBossAttack, bossHazards, updateBossHazards, clearBossHazards, playerMotion, samplePlayerVelocity, resetGame, closeShop,
  get equippedBow(){return equippedBow}, get ownedBows(){return [...ownedBows]}, get spellCd(){return spellCd}, get coop(){return coop}, get running(){return running},
  arrows, makeMonster, disposeMonster, trollAI, update, animateMonster, motionRig, animateDeathJoints, statusAura, fxSteps, emitArrowTrail, elementalImpact, EFX, RP, SMK, coopInterp, coopRemoteById,
  fireVihar, gainUlt, tryDash, setElement, spawnMonster, STATS, SET, get combo(){return combo}, get slowT(){return slowT}, set bossPending(v){bossPending=v}, releaseDraw, startDraw, get charge(){return charge}, get USE_TROLLGEN(){return USE_TROLLGEN}, set USE_TROLLGEN(v){USE_TROLLGEN=v},
  bloomComposer, finalComposer, bloomPass,
  setBloom:(s,r,t)=>{ if(!bloomPass)return; if(s!=null)bloomPass.strength=s; if(r!=null)bloomPass.radius=r; if(t!=null)bloomPass.threshold=t; },
  setBloomOn:(v)=>{ bloomOn=!!v; },
  get bloomOn(){return bloomOn}, renderFrame, get toSpawn(){return toSpawn}, set toSpawn(v){toSpawn=v}, spawnZone, zones, elementalDeath, FIREBURST, POISONPOOL, DUSTPOOF, ZAPBURST, poisonPool, trollSpawnFx, chainLightning, skyStrike, meleeSwing, set currentElement(v){currentElement=v},
  get wave(){return wave}, get score(){return score}, get worldBatch(){return worldBatchInfo} };

