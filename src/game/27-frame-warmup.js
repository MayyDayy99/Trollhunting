const DEV_HOOKS=location.hash.indexOf('dev')>=0;
function frame(){
  requestAnimationFrame(frame);
  if(DEV_HOOKS && window.__mrHold) return;   // dev: külső, determinisztikus léptetés (update + renderFrame kézzel)
  const t=clock.getElapsedTime(); let dt=Math.min(t-prevT,0.05); prevT=t;
  if(slowT>0){ slowT-=dt; if(running && !coop) dt*=0.32; }   // TURBÓ: lassított felvétel (utolsó troll / VIHAR)
  update(dt,t);
  if(window.__shotPose){ const p=window.__shotPose; camera.position.set(p[0],p[1],p[2]); camera.lookAt(p[3],p[4],p[5]); }
  renderFrame();
  if(window.__shotPose){ window.__ri=renderer.info.render; window.__shotReady=true; }
}
// ELŐMELEGÍTÉS: induláskor egyszer felépítünk + kirenderelünk minden troll-típust és FX-et (az arénán kívül, a töltőképernyő mögött),
// hogy a shaderek leforduljanak és a bufferek feltöltődjenek MOST — így menet közben nincs akadás.
const WARM_HOLD=[];   // a próbabábuk NEM szabadulnak fel: az anyagaik tartják életben a lefordított shader-programokat (különben az első valódi trollnál újrafordulnának)
function warmup(done){
  const wx=120, wz=120, wy=GROUND_Y+1.5;   // messze az arénán kívül
  const loadbar=document.getElementById('loadbar'), loadingEl=document.getElementById('loading');
  const dummies=[];
  // FŐPRÓBA-kamera: a bemelegítő renderek alatt a kamera TÉNYLEG a próbabábukra + effektekre néz, így a bloom-pass és a fő-pass
  // shader-variánsai egyaránt lefordulnak (a renderer.compile csak a fő-pass variánst adja; mérve: a bloom-variáns különben játék közben fordult).
  const rehearse=()=>{ camera.position.set(wx+9,GROUND_Y+4.5,wz+17); camera.lookAt(wx+9,GROUND_Y+1.2,wz); camera.updateMatrixWorld(true); };
  // VALÓDI, fázisokra bontott előtöltés — a csík MINDEN lépése tényleges munkát jelez, lépések közt kirajzolódik:
  // 7× troll-építés -> FX-előmelegítés -> shader-fordítás (a legnehezebb lépés) -> főpróba-renderek.
  const steps=[], warmEls=['fire','ice','poison','lightning',null,'fire','ice'];
  ['grunt','scout','brute','shaman','spitter','wisp','shard'].forEach((ty,idx)=>
    steps.push(()=>{ try{ const m=makeMonster(ty,1.0,100,2.5,warmEls[idx]); m.g.position.set(wx+dummies.length*3, GROUND_Y, wz); dummies.push(m); }catch(_e){} }));
  steps.push(()=>{ try{
    EFX.flash(wx,wy,wz,0xffffff,0.6,2.5,0.3); EFX.ring(wx,GROUND_Y+0.05,wz,0xffffff,0.4,2.5,0.4,0.6); EFX.bolt(wx,wy,wz,wx+2,wy,wz,0xffffff,0.12,0.3); EFX.light(wx,wy,wz,3,0.3);
    for(const el of ['fire','ice','poison','lightning']) elementalImpact({x:wx,y:wy,z:wz}, el, true);
    FIREBURST.spawn(wx,wy,wz,3); POISONBURST.spawn(wx,wy,wz,3); DUSTPOOF.spawn(wx,GROUND_Y,wz,3); ZAPBURST.spawn(wx,wy,wz,3);   // Blender flipbookok (egy közös shader + a négy atlasz feltöltése)
    for(let i=0;i<10;i++){ RP.spawn(wx,wy,wz,rand(-2,2),rand(0,3),rand(-2,2),0xffffff,0.6,0.04,0.3,0,1); SMK.spawn(wx,wy,wz,rand(-1,1),rand(1,2),rand(-1,1),0xffffff,0.6,1,0.6,0,0.6,0.5); }
    gore.burst(wx,wy,wz,10,0x5f9168,5,0.3); sparks.burst(wx,wy,wz,10,0xffd27a,5,0.3);
    for(const k of ['gas','fire','frost','steam','puddle']) spawnZone(k,wx,wz,{});
    drawBeam(wx,wy,wz,wx+3,wy,wz,0);
    abolts[0].g.position.set(wx,wy,wz); abolts[0].g.visible=true; ebombs[0].g.position.set(wx,wy+1,wz); ebombs[0].g.visible=true;
    if(wbolts[0]){ wbolts[0].g.position.set(wx+1,wy+1,wz); wbolts[0].g.visible=true; }   // lidérc jég-lövedék
    // ELEMI NYÍL előmelegítés (ez okozta az első elemi lövés laggját): mind a 4 elem-fej + nyom + a nockolt elem-fej leforduljon MOST
    for(let i=0;i<4;i++){ const a=arrows[i]; if(!a) break; a.el=['fire','ice','poison','lightning'][i]; applyArrowVisual(a); a.g.position.set(wx-3+i,wy,wz); a.prev.copy(a.g.position); a.g.visible=true; emitArrowTrail(a,1/60); }
    { const cur=currentElement; for(const el of ['fire','ice','poison','lightning']){ currentElement=el; nockArrow.visible=true; updateNockElement(); animateNock(0); } currentElement=cur; nockArrow.visible=false; updateNockElement(); }
    if(dummies[0]) freezeEncase(dummies[0]);   // jég-burok anyagai melegedjenek be
    if(dummies[1]) freezeFull(dummies[1]); else if(dummies[0]) freezeFull(dummies[0]);   // teljes-fagy tömb (héj+perem+mag+kristály) is -> mind az 5 ICE_MATS lefordul
    if(dummies[2] && dummies[2].gen && window.TrollGen){ try{ TrollGen.stickArrow(dummies[2].gen, new THREE.Vector3(wx+6,wy,wz), new THREE.Vector3(0,0,-1), 'fire'); }catch(_e){} }
    // ÚJ 3D ÍJAK, ELEMI VARÁZSLATOK és FŐELLENSÉG-MODELLEK előmelegítése -> 0 első-használati shader-akadás
    if(typeof BOW_SKINS!=='undefined'){ for(const k in BOW_SKINS.groups) for(const g of BOW_SKINS.groups[k]) g.visible=true; BOW_SKINS.sigil.g.visible=true; }
    if(bossHazards[0] && bossHazards[1]){
      bossHazards[0].prop.geometry=_boulderGeo; bossHazards[0].prop.material=_boulderMat; bossHazards[0].prop.position.set(wx,wy,wz); bossHazards[0].prop.visible=true;
      bossHazards[1].prop.geometry=_thornGeo; bossHazards[1].prop.material=_thornMat; bossHazards[1].prop.position.set(wx+2,wy,wz); bossHazards[1].prop.visible=true;
    }
    VFX.warm();   // a teljes VFX-készlet (szalagok, gyűrűk, matricák, láng, tűzgolyó, kristály, örvény, oszlop, jelzők) látható -> a bemelegítő renderek lefordítják a shadereit
  }catch(_e){} });
  // FONTOS: a próbabábuk az arénán KÍVÜL vannak -> renderer.render() FRUSTUM-CULLINGOLNÁ őket, így a shaderük NEM fordulna le (ezt mérve igazoltam: render után 24, compile után 28 program).
  // a renderer.compile() a pozíciótól FÜGGETLENÜL lefordít minden, a scene-ben lévő anyagot -> nincs első-feltűnéskori akadás.
  // LÉNYEGES: a composer-út (közepes/magas grafika) LINEÁRIS render-célba rajzol, ami MÁS shader-variáns, mint a képernyőre fordított —
  // ezért a ténylegesen használt kimenethez fordítunk (mérve: enélkül minden troll-/effekt-anyag az első feltűnésekor fordult újra, ~40 ms akadással).
  // MINDEN rejtett objektum is látszik a bemelegítés idejére (pl. a kamerára szerelt közelharc-ív, rejtett poolok, ritka kellékek):
  // a renderer.compile és a render csak a LÁTHATÓ fát járja be, így ami rejtve vár az első használatára, az különben játék közben
  // fordulna le (mérve: a közelharc-ív shadere az első csapásnál ~200 ms akadást okozott). A takarítás pontosan ezeket rejti el újra.
  const warmShown=[];
  steps.push(()=>{ try{ scene.traverse(o=>{ if(o!==scene && !o.visible){ o.visible=true; warmShown.push(o); } }); }catch(_e){} });
  steps.push(()=>{ try{ const rt=(bloomOn && bloomAvail)?finalComposer.renderTarget1:null;
    if(rt) renderer.setRenderTarget(rt); renderer.compile(scene, camera); if(rt) renderer.setRenderTarget(null); }catch(_e){ try{ renderer.setRenderTarget(null); }catch(_e2){} } });
  // BLOOM előmelegítés: a bloom-pass shaderei (UnrealBloom mip-blur, mix, gamma) csak composer-renderkor fordulnak le
  // (a renderer.compile csak a scene-anyagokat érinti) -> egyszer lefuttatjuk a teljes bloom-utat, hogy ne legyen első-frame akadás.
  steps.push(()=>{ try{ rehearse(); const prev=bloomOn; bloomOn=true; renderFrame(); bloomOn=prev; }catch(_e){} });
  for(let k=0;k<4;k++) steps.push(()=>{ try{ rehearse(); renderFrame(); }catch(_e){} });
  let i=0;
  (function step(){
    steps[i](); i++;
    if(loadbar) loadbar.style.width=Math.round(i/steps.length*100)+'%';
    if(i<steps.length){ setTimeout(step, 0); return; }   // setTimeout (nem rAF): a csík lépések közt kirajzolódik, és fojtott rAF mellett sem ragad be a töltőképernyő
    // takarítás: a csak a bemelegítéshez felfedett objektumok újra rejtve; a próbabábuk lekerülnek a színről (de élnek tovább: WARM_HOLD), a zónák + poolok nyugalomba
    for(const o of warmShown) o.visible=false;
    for(const m of dummies){ if(m.iceShell) removeIceShell(m); scene.remove(m.g); WARM_HOLD.push(m); }
    clearZones();
    beamTube.visible=false; resetAbolts(); resetBombs(); if(wbolts[0]) wbolts[0].g.visible=false;
    for(let i2=0;i2<4;i2++){ const a=arrows[i2]; if(!a) break; a.el='base'; a.flames=null; applyArrowVisual(a); a.g.visible=false; a.active=false; }   // a felmelegítő nyilak nullára
    if(typeof BOW_SKINS!=='undefined'){ dressBow(equippedBow); BOW_SKINS.sigil.g.visible=false; }
    clearBossHazards(); VFX.reset(); FIREBURST.reset(); POISONBURST.reset(); DUSTPOOF.reset(); ZAPBURST.reset();
    if(loadingEl) loadingEl.classList.add('hide');
    done();
  })();
}
Promise.all([PROPS_READY, FIREBURST.ready, POISONBURST.ready, DUSTPOOF.ready, ZAPBURST.ready, SMOKE_ATLAS.ready]).then(() => warmup(frame));   // a generált tereptárgyak (07), a Blender flipbook- és füst-atlaszok (15) is készen legyenek, mire a shaderek lefordulnak

