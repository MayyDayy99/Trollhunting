/* ===================== Fő ciklus ===================== */
const clock=new THREE.Clock(); let prevT=0;
const fwd=new THREE.Vector3(), right=new THREE.Vector3(), tmp=new THREE.Vector3();

function update(dt,t){
  pollGamepad(dt);   // TURBÓ: kontroller (menüben is: A/Start = indítás/folytatás)
  /* --- játékos mozgás --- */
  if(running && player.alive){
    const oldX=player.pos.x, oldZ=player.pos.z;
    fwd.set(-Math.sin(player.yaw),0,-Math.cos(player.yaw));
    right.set(Math.cos(player.yaw),0,-Math.sin(player.yaw));
    const sprinting=!!(keys['shift']||mobileSprint||padSprint);
    const sp=(sprinting?8:4.6)*RUNM.spdMul;   // FEJLESZTÉS: Fürge Láb
    let mx=0,mz=0;
    if(keys['w']) { mx+=fwd.x; mz+=fwd.z; } if(keys['s']){ mx-=fwd.x; mz-=fwd.z; }
    if(keys['d']){ mx+=right.x; mz+=right.z; } if(keys['a']){ mx-=right.x; mz-=right.z; }
    if(MOBILE_INPUT && (mobileMove.x||mobileMove.y)){ mx+=fwd.x*mobileMove.y + right.x*mobileMove.x; mz+=fwd.z*mobileMove.y + right.z*mobileMove.x; }
    if(padMX||padMY){ mx+=fwd.x*padMY + right.x*padMX; mz+=fwd.z*padMY + right.z*padMX; }   // TURBÓ: kontroller bal kar
    const len=Math.hypot(mx,mz); if(len>0){ mx/=len; mz/=len; }
    moveInX=mx; moveInZ=mz; sprintNow=sprinting && len>0 && player.onGround && dashT<=0;
    if(dashT>0){ dashT-=dt; player.pos.x+=dashX*DASH_SPEED*dt; player.pos.z+=dashZ*DASH_SPEED*dt; }   // TURBÓ: kitérés-csúszás (felülírja a járást)
    else if(len>0){ player.pos.x+=mx*sp*dt; player.pos.z+=mz*sp*dt; }
    { const strafe=len>0?(mx*right.x+mz*right.z):0; camRoll=lerp(camRoll, -strafe*0.022 - (dashT>0?(dashX*right.x+dashZ*right.z)*0.05:0), Math.min(1,dt*9)); }   // oldalazás-dőlés
    fovTarget=FOV_BASE + (sprinting&&len>0?5:0) - ((drawing&&charge>0.45)?Math.min(1,(charge-0.45)/0.55)*11:0);   // futás: tágul · célzás: szűkül (zoom)
    // szilárd ütközés (tömör akadályok kitolása) + aréna-perem — MINDIG fut, hogy a
    // beragadt/peremen-túli állapot is feloldódjon (nem csak mozgáskor)
    { const r=resolveMove(player.pos.x, player.pos.z, player.feet); player.pos.x=r.x; player.pos.z=r.z; }
    clampToBoundary();
    // ugrás + gravitáció + ráállás a megmászható objektumokra
    if((keys[' ']||mobileJump||padJump) && player.onGround && player.jumpReady){ player.vy=JUMP_V; player.onGround=false; player.jumpReady=false; }
    if(!keys[' ']&&!mobileJump&&!padJump) player.jumpReady=true;
    const wasGround=player.onGround, vyIn=player.vy;
    player.vy-=GRAV*dt; player.feet+=player.vy*dt;
    const support=groundAt(player.pos.x, player.pos.z, player.feet);
    if(wasGround && support>player.feet){ player.feet=lerp(player.feet, support, Math.min(1,dt*12)); if(support-player.feet<0.02) player.feet=support; player.vy=0; player.onGround=true; }
    else if(player.feet<=support){ player.feet=support; player.vy=0; player.onGround=true; if(!wasGround && vyIn<-5){ landDip=Math.min(0.22,-vyIn*0.014); if(vyIn<-9){ shake=Math.max(shake,0.12); if(AUD.tap) AUD.tap(); } } }   // TURBÓ: földet érés -> kamera-rogyás
    else player.onGround=false;
    if(landDip>0.001) landDip*=Math.pow(0.0008,dt); else landDip=0;
    const travelled=Math.hypot(player.pos.x-oldX,player.pos.z-oldZ);
    if(player.onGround && dashT<=0) stepPhase+=Math.min(travelled,sp*dt*1.2)*(sprinting?1.45:1.75);
    const stepTarget=player.onGround && dashT<=0 && len>0?Math.min(1,travelled/Math.max(1e-6,sp*dt)):0;
    stepWeight=lerp(stepWeight,stepTarget,1-Math.exp(-dt*12));
    player.pos.y=player.feet+1.7-landDip+Math.sin(stepPhase)*stepWeight*(sprinting?0.045:0.03);
    if(player.invulnT>0) player.invulnT-=dt;   // Utolsó Esély sérthetetlenség lecsengése
    if(RUNM.regen>0 && player.hp<player.maxHp) setHp(player.hp + RUNM.regen*dt);   // FEJLESZTÉS: Moha-gyógyulás (regen, csak futó+élő állapotban)
  }

  /* --- íj feszítés + lövés-animáció (csak futó játékban tölt) --- */
  idleT+=dt;
  if(running && shotCd>0) shotCd=Math.max(0,shotCd-dt);
  if(meleeCd>0) meleeCd=Math.max(0,meleeCd-dt);
  if(lmbHeld && !drawing && meleeCd<=0) startDraw();   // BUFFERELT FELHÚZÁS: ha a reload alatt nyomtad le a gombot, a reload végén AZONNAL indul a húzás
  // KÖZELHARC-SUHINTÁS animáció a TELJES meleeCd alatt: LE -> nagy balról-jobbra suhintás -> VISSZA (a nyíl az íj gyermeke, vele süllyed/emelkedik)
  let meleeX=0, meleeY=0, meleeRotX=0, meleeRotY=0, meleeRotZ=0;
  if(meleeCd>0 && !coop){ const k=Math.sin(Math.min(1,1-meleeCd/MELEE_CD)*Math.PI);   // GRAVITÁCIÓS KÉZ (SP): az íj csak kicsit jobbra-le billen, helyet ad a bal kéznek (nincs vágó-suhintás)
    meleeY=-0.07*k; meleeX=0.06*k; meleeRotZ=-0.14*k; if(slashArc.visible) slashArc.visible=false; }
  else if(meleeCd>0){ const mp=1-meleeCd/MELEE_CD;
    if(mp<0.18){ const e=easeOutCubic(mp/0.18);                          // LE + felhúzás balra (windup)
      meleeY=-0.18*e; meleeRotX=-0.6*e; meleeRotY=0.75*e; meleeRotZ=0.7*e; meleeX=-0.28*e; }
    else if(mp<0.52){ const s=easeInOut((mp-0.18)/0.34);                 // NAGY SUHINTÁS balról -> jobbra, FEL a kép közepébe ívelve
      meleeY=-0.18 + 0.30*Math.sin(s*Math.PI); meleeRotX=-0.6*(1-0.7*s);
      meleeRotY=lerp(0.75,-1.2,s); meleeRotZ=lerp(0.7,-1.25,s); meleeX=lerp(-0.28,0.36,s); }
    else { const r=easeOutCubic((mp-0.52)/0.48);                          // VISSZA emelkedik nyugalomba
      meleeY=lerp(-0.10,0,r); meleeRotX=lerp(-0.18,0,r); meleeRotY=lerp(-1.2,0,r); meleeRotZ=lerp(-1.25,0,r); meleeX=lerp(0.36,0,r); }
    // VÁGÁS-ÍV: fénylő ív balról jobbra söpör a képen át (jól látható "suhintás")
    if(mp>=0.1 && mp<=0.62){ const s=(mp-0.1)/0.52; slashArc.visible=true; slashArc.material.uniforms.uAlpha.value=0.95*Math.sin(s*Math.PI);
      slashArc.rotation.z=lerp(1.35,-1.35,s); slashArc.position.x=lerp(-0.24,0.24,s); const sc=lerp(0.7,1.75,s); slashArc.scale.set(sc,sc,1); }
    else slashArc.visible=false;
  }
  else if(slashArc.visible) slashArc.visible=false;
  // ÚJRATÖLTÉS present-póz delták (alapból 0; a reload-ág tölti) — a lenti bow-írásokhoz ADDITÍVAN adódnak
  let presentY=0, presentZ=0, presentRotX=0, presentRotZ=0;
  if(drawing && running){ charge=Math.min(RUNM.drawCap, charge+dt*1.5*RUNM.drawMul*(overT>0?1.9:1));
    if(charge>=RUNM.drawCap-1e-6) fullT+=dt; else fullT=0;   // TURBÓ: TÖKÉLETES-ablak (a plafon elérése utáni első 0.26 mp)
    const drawFrac=Math.min(1,charge/RUNM.drawCap);
    setRing(drawFrac, charge<MIN_CHARGE?'weak':(charge>=RUNM.drawCap-1e-6?(fullT<=0.26?'perfect':'full'):'')); powwrap.classList.add('on'); powwrap.classList.remove('reload','ready'); if(powlabel) powlabel.textContent=''; powfill.style.width=(drawFrac*100)+'%'; powfill.style.background=(charge<MIN_CHARGE?'#b5462e':''); nockArrow.visible=true; nockArrow.scale.setScalar(1);
    // NYÍL-RÁHELYEZÉS (~0.2 mp, VALÓS idő): a nyíl a tegez felől a húrhoz kerül, a VÉGE (nock)
    // a nyugalmi húrvonalra ül — és csak EZUTÁN kezd hátrafeszülni a húrral együtt (lásd pull).
    drawT+=dt; drawNockIn=Math.min(1, drawT/0.20);
    if(drawNockIn<1){ const fe=easeOutCubic(drawNockIn), gz=Z_TIP-0.775;   // gz: a nyílcsoport z-je, amikor a vég a húron van
      nockArrow.position.set(lerp(0.16,0.046,fe), lerp(-0.30,0.060,fe), lerp(gz+0.28,gz,fe));
      nockArrow.rotation.set(lerp(-0.35,0,fe), lerp(0.30,0,fe), lerp(0.5,0,fe)); }
    else { nockArrow.rotation.set(0,0,0);
      if(!seatFired){ seatFired=true; if(AUD.nock) AUD.nock(); } }   // a nyíl "bekattan" a húrra
    if(currentElement==='base' && nockArrow._glow) nockArrow._glow.material.opacity=0; animateNock(t); }
  else if(running && shotCd>0){
    // === ÍJ-ÚJRATÖLTÉS: a cooldown alatt üres, FELAJZOTT íj (csak a húr látszik) — a nyíl MAJD a húzáskor kerül a húrra ===
    const rp=Math.min(1, 1-shotCd/SHOT_CD);
    setRing(Math.min(1,1-shotCd/Math.max(0.05,lastShotCd)),'reload');
    powwrap.classList.add('on','reload'); if(powlabel) powlabel.textContent=tr('hud.reload');
    powfill.style.width=(rp*100).toFixed(0)+'%'; powfill.style.background='';
    // az íj finoman leereszkedik, majd visszaemelkedik (a várakozás olvasható gesztusa) — nyíl nélkül
    const present = rp<0.25 ? easeOutCubic(rp/0.25) : rp<0.7 ? 1 : 1-easeInOut((rp-0.7)/0.3);
    presentY=-0.012*present; presentZ=0.006*present; presentRotX=0.03*present; presentRotZ=0.03*present;
    nockArrow.visible=false;
    if(!raspFired){ raspFired=true; if(AUD.rasp) AUD.rasp(); }
    if(rp>=0.9 && !seatFired){ seatFired=true; if(AUD.nock) AUD.nock(); powwrap.classList.add('ready'); }   // felajzva, mehet a húzás
  }
  else { setRing(0); powwrap.classList.remove('on','reload','ready'); if(powlabel) powlabel.textContent=''; powfill.style.background='';
    nockArrow.scale.setScalar(1); nockArrow.rotation.set(0,0,0);
    if(nockArrow._glow && currentElement==='base') nockArrow._glow.material.opacity=0;
    nockArrow.visible = false; }   // KÉSZENLÉT: nyugalomban NINCS nyíl a húron — csak felhúzáskor úszik rá (a húr/ideg viszont mindig látszik)
  // elengedés-detektálás -> twang + FOV-rúgás + limb-snap
  if(prevCharge>0.12 && charge<=0.0001){ bowKick=1; bowKickRot=1; relTwang=0.14; camera.fov=fovTarget+5.5; camera.updateProjectionMatrix(); }
  prevCharge=charge;

  // === ÍJ-FIZIKA ===
  // NYUGALOM: a nock-pont PONTOSAN a húrvonalon (Z_TIP) ül -> a húr EGYENES vonal a két tip közt.
  // HÚZÁS: a nock-pont hátracsúszik (V-alak), a nyíl VÉGE végig a húr-ponton marad, a szárak behajlanak.
  // ELENGEDÉS: pull->0, a twang az EGYENES alaphelyzet körül lengeti ki a húrt, a szárak visszacsapnak.
  const PULL=0.30;
  const twang = (relTwang>0 ? Math.sin(relTwang*70)*0.020*relTwang*7 : 0);
  const pull  = charge*PULL*easeOutCubic(drawNockIn) + twang;   // hátrahúzás CSAK a nyíl-ráhelyezés után indul
  nock.position.set(0.008, 0.060, Z_TIP + Math.max(0,pull));
  // a nyíl VÉGE (a modellben +0.775) a húr-ponton ül és azzal együtt csúszik hátra
  if(drawing && drawNockIn>=1) nockArrow.position.set(0.046, 0.060, Z_TIP + Math.max(0,pull) - 0.775);

  // a szárak valódi behajlása húzáskor (a tipek a húr után fordulnak), elengedéskor visszacsapódnak
  let flex=Math.min(0.36, charge*0.30)*easeOutCubic(drawNockIn);
  if(bowKick>0){ flex += -bowKick*0.10*Math.cos(bowKick*11); }
  if(spellKick>0){ flex -= Math.sin(spellKick*Math.PI)*0.09; }
  limbU.rotation.x=flex; limbL.rotation.x=-flex;

  // Élő íj-díszek + varázs-feszítés szimbólum (nulla allokáció)
  { const drawRatio=drawing?Math.min(1,charge/RUNM.drawCap):0, ready=spellReady();
    if(equippedBow==='rune' && !coop){
      const sp=1.8+drawRatio*7+(ready?2.4:0);
      for(let i=0;i<BOW_SKINS.runeCrystals.length;i++){ const c=BOW_SKINS.runeCrystals[i]; c.rotation.y+=dt*sp*(i%2?-1:1); c.rotation.z=Math.sin(idleT*2.4+i)*0.18; }
      BOW_SKINS.runeGemMat.emissiveIntensity=1.45+0.65*drawRatio+(ready?0.45*Math.sin(idleT*5):0);
    } else if(equippedBow==='moss' && !coop){
      const p=0.5+0.5*Math.sin(idleT*2.8);
      BOW_SKINS.shroomCapMat.emissiveIntensity=0.95+0.55*p+0.7*drawRatio;
      for(let i=0;i<BOW_SKINS.mossHalos.length;i++) BOW_SKINS.mossHalos[i].material.opacity=0.35+0.28*p+0.25*drawRatio;
    }
    const sig=BOW_SKINS.sigil;
    if((drawing && ready && drawRatio>0.12) || spellKick>0){
      sig.g.visible=true;
      const col=EL[currentElement]&&EL[currentElement].glow||0xffffff, full=drawRatio>=0.98;
      sig.outerMat.color.setHex(full?0xfff3b8:col); sig.innerMat.color.setHex(col); sig.glow.material.color.setHex(col);
      const flare=spellKick>0?Math.sin(spellKick*Math.PI)*1.55:0;
      const sc=0.38+0.72*easeOutCubic(drawRatio)+flare*0.65+(full?0.08*Math.sin(idleT*18):0);
      sig.g.scale.setScalar(sc);
      sig.outer.rotation.z+=dt*(2.6+drawRatio*9); sig.inner.rotation.z-=dt*(4.2+drawRatio*12);
      const op=Math.min(1, drawRatio*0.85 + flare*0.9);
      sig.outerMat.opacity=op*(full?0.95:0.7); sig.innerMat.opacity=op*0.9; sig.glow.material.opacity=op*0.55;
    } else if(sig.g.visible) sig.g.visible=false;
  }

  setString();
  setCross(drawing?charge:0);

  // FOV vissza-lerp a rúgás után
  if(Math.abs(camera.fov-fovTarget)>0.05){ camera.fov=lerp(camera.fov,fovTarget,Math.min(1,dt*9)); camera.updateProjectionMatrix(); }
  else if(camera.fov!==fovTarget){ camera.fov=fovTarget; camera.updateProjectionMatrix(); }
  if(bowKick>0)  bowKick =Math.max(0, bowKick - dt*4.0);
  if(spellKick>0) spellKick=Math.max(0, spellKick - dt*3.2);
  if(relTwang>0) relTwang=Math.max(0, relTwang - dt);

  // lélegzés + sway idle-ban, töltéskor stabilizálódik és kissé behúzódik
  const steady=1-charge*0.7, sk=spellKick>0?Math.sin(spellKick*Math.PI):0;
  const aspectX=BOW_BASE_X*clamp((camera.aspect||1.6)/1.45, 0.48, 1.0);   // keskeny/álló nézetben is képen belül marad az íj
  const breath=Math.sin(idleT*1.6)*0.006*steady, sway=Math.cos(idleT*0.9)*0.004*steady;
  // --- FEGYVER-TEHETETLENSÉG (AA-érzet): az íj késve követi a nézés-fordulást, sprintnél leereszkedik, ugrásnál/érkezésnél kileng,
  //     kitérésnél bedől, elemváltásnál megpördül, lövés után előrebillen (utánlendülés). Mind kis amplitúdójú, rugózott érték -> nincs célzás-zavar.
  { const k=1-Math.exp(-dt*11), inv=dt>1e-5?1/dt:0;
    let dyaw=player.yaw-bowLag.yaw; dyaw=Math.atan2(Math.sin(dyaw),Math.cos(dyaw)); const dpit=player.pitch-bowLag.pitch;
    bowLag.yaw=player.yaw; bowLag.pitch=player.pitch;
    bowLag.x=lerp(bowLag.x, clamp(dyaw*inv*0.0075,-0.045,0.045)*steady, k);      // balra fordulsz -> az íj jobbra marad le
    bowLag.y=lerp(bowLag.y, clamp(-dpit*inv*0.0065,-0.035,0.035)*steady, k);     // felnézel -> az íj lent marad le
    const sprintT=(sprintNow && !drawing && meleeCd<=0 && running && player.alive)?1:0;
    bowLag.sprint=lerp(bowLag.sprint, sprintT, 1-Math.exp(-dt*(sprintT?7:12)));   // futás: leeresztett, bedöntött íj (húzásra azonnal visszaáll)
    bowLag.air=lerp(bowLag.air, (running && player.alive && !player.onGround)?clamp(-player.vy*0.0045,-0.03,0.035):0, 1-Math.exp(-dt*9));
    if(bowLag.swap>0) bowLag.swap=Math.max(0,bowLag.swap-dt*3.0);
  }
  const sprK=bowLag.sprint, swp=bowLag.swap>0?Math.sin(bowLag.swap*Math.PI):0, ftK=bowKick>0?bowKick*bowKick*(3-2*bowKick):0;
  const dSide=dashFxK>0?clamp(dashX*right.x+dashZ*right.z,-1,1)*dashFxK:0;
  const strain=(drawing && fullT>0.26)?Math.min(1,(fullT-0.26)*1.6):0;                                  // túl sokáig tartott teli húr: az izom megremeg
  const trX=strain*Math.sin(idleT*37)*0.0016, trY=strain*Math.cos(idleT*31)*0.0016;
  const bobK=steady*(1+sprK*1.3);   // sprintnél erősebb, ritmikus lépés-lengés
  bow.position.x=aspectX + sway + Math.cos(stepPhase*0.5)*stepWeight*0.012*bobK + bowKick*0.018 - charge*0.010 + meleeX + bowLag.x + sprK*0.035 - dSide*0.05 + trX;
  bow.position.y=BOW_BASE_Y + breath + Math.sin(stepPhase)*stepWeight*0.009*bobK - charge*0.014 - bowKick*0.022 + sk*0.032 + presentY + meleeY + bowLag.y + bowLag.air - sprK*0.125 - landDip*0.22 - swp*0.03 + ftK*0.012 + trY;
  bow.position.z=BOW_BASE_Z + charge*0.020 + bowKick*0.045 - sk*0.038 + presentZ - sprK*0.02 - swp*0.02;     // töltéskor kissé közelebb, varázslatnál előrelökődik
  bow.rotation.y=bowAdj.ry + (bowAdj.ry<0?-1:1)*charge*0.05 + meleeRotY - bowLag.x*2.2 + sprK*0.20;     // közelharc: vízszintes balról-jobbra suhintás
  bow.rotation.z=bowAdj.rz + charge*0.045 + bowKickRot*0.05*Math.sin(idleT*40) + presentRotZ + meleeRotZ - bowLag.x*3.0 + sprK*0.62 + Math.sin(stepPhase)*stepWeight*sprK*0.035 - dSide*0.55 - swp*0.55;   // közelharc-dőlés + reload-present
  bow.rotation.x=bowAdj.rx - sk*0.14 + presentRotX + meleeRotX + bowLag.y*2.4 - sprK*0.26 + landDip*0.9 - ftK*0.10 + bowLag.air*1.5;   // közelharc: le-ível + reload-present + varázslat-emelés
  if(bowKickRot>0) bowKickRot=Math.max(0, bowKickRot - dt*5.0);

  /* --- nyilak (szünetben befagynak) --- */
  if(running) for(const a of arrows){ if(!a.active) continue; try {
    if(a.stuck){ a.life+=dt; if(a.life>3){ a.active=false; a.g.visible=false; } continue; }
    a.prev.copy(a.g.position);
    a.vel.y-=GRAV*(a.gravK!=null?a.gravK:1)*dt;   // FEJLESZTÉS: húzás-plafon -> laposabb ív túlfeszítésnél
    a.g.position.addScaledVector(a.vel,dt);
    orientArrow(a);
    a.life+=dt;
    emitArrowTrail(a,dt);   // ELEM: element-colored flight trail
    // talaj
    if(a.g.position.y<=GROUND_Y+0.02){ a.g.position.y=GROUND_Y+0.02; a.stuck=true; a.life=0;
      arrowThud(a.g.position.x,GROUND_Y+0.08,a.g.position.z,a.vel.x,a.vel.z);
      if(a.el!=='base'){ const sx=a.g.position.x, sz=a.g.position.z;   // földbe állt ELEMI nyíl: FÉL sugarú területi sebzés
        if(a.el==='poison') poisonPool(sx,GROUND_Y+0.1,sz,splashR('poison')*0.5*RUNM.elemRadiusMul);   // méregtócsa = a fél sugarú sebző terület
        if(coop) coop.send({t:'splash_at', x:sx, z:sz, el:a.el, dmg:a.dmg, charge:a.charge});
        else elementalSplashAt(sx, sz, a.el, a.dmg, a.charge, false, null, 0.5*RUNM.elemRadiusMul); }   // FEJLESZTÉS: Robbanó Szív sugár-szorzó
      continue; }
    // SZILÁRD TEST (fa/kő/építmény): a nyíl beleáll, nem fúr át. A magas fedélzet/híd ALATT (y<bottom) elrepül.
    { const ax=a.g.position.x, ay=a.g.position.y, az=a.g.position.z; let solidHit=false;
      for(const s of SOLIDS){ if(s.noArrow) continue; const bot=(s.abot!=null?s.abot:(s.bottom!=null?s.bottom:GROUND_Y)), topH=(s.top!=null?s.top:GROUND_Y+3.6);
        if(ay<bot || ay>topH) continue;
        if(s.kind==='cyl'){ const ddx=ax-s.x, ddz=az-s.z; if(ddx*ddx+ddz*ddz < s.r*s.r){ solidHit=s; break; } }
        else if(ax>s.minX && ax<s.maxX && az>s.minZ && az<s.maxZ){ solidHit=s; break; } }
      if(solidHit){ arrowThud(ax,ay,az,a.vel.x,a.vel.z); a.stuck=true; a.life=0; a.vel.set(0,0,0);
        if(solidHit.iceWall){ if(a.el==='fire' && !coop) ICEWALL.burst(solidHit.iceWall, solidHit.slot, a.dmg);   // JÉGFAL: tűz-nyíl -> végigfutó gőzrobbanás
          else VFX.spray(ax,ay,az,6,[0xffffff,0xbfe9ff],5,{up:-0.2,life:0.35,grav:10,w:0.02,len:0.03}); }
        if(a.el==='poison') poisonPool(ax,ay,az,splashR('poison')*0.5*RUNM.elemRadiusMul);   // a tócsa a fa/kő tövében, a talajon
        if(a.el!=='base'){ if(coop) coop.send({t:'splash_at', x:ax, z:az, el:a.el, dmg:a.dmg, charge:a.charge}); else elementalSplashAt(ax, az, a.el, a.dmg, a.charge, false, null, 0.5*RUNM.elemRadiusMul); }   // FEJLESZTÉS: Robbanó Szív (SP; co-op sugarat a szerver birtokolja)
        continue; } }
    // szörny-találat (szakasz vs gömb, hogy ne fúrjon át)
    let hit=null, head=false, dmgMul=1;
    for(const m of monsters){ if(!m.alive) continue; if(a.hitSet.has(m)) continue;   // FEJLESZTÉS: pierce/ricochet — ugyanazt a trollt sose kétszer egy repülésben
      const c=tmp.set(m.g.position.x, m.g.position.y+m.headCY, m.g.position.z);
      if(segDist(a.prev,a.g.position,c)<m.headR){ hit=m; head=true; dmgMul=2; break; }       // FEJ ×2
      c.set(m.g.position.x, m.g.position.y+m.bodyCY, m.g.position.z);
      if(segDist(a.prev,a.g.position,c)<m.bodyR){ hit=m; dmgMul=1; break; }                   // TÖRZS ×1
      c.set(m.g.position.x, m.g.position.y+m.bodyCY*0.42, m.g.position.z);
      if(segDist(a.prev,a.g.position,c)<m.bodyR*0.72){ hit=m; dmgMul=0.6; break; }             // LÁB ×0.6 (alacsonyabb, kisebb gömb, kevesebb sebzés)
    }
    if(hit){ let dmg=a.dmg*dmgMul;
      // TROLLGEN: a nyíl BELEÁLL a trollba (a legközelebbi csonthoz kötve, vele mozog a halálig). Vizuál-only -> SP és co-op egyaránt.
      if(hit.gen && window.TrollGen && (hit.gen.stuckArrows||[]).length<8){ try{ TrollGen.stickArrow(hit.gen, a.g.position, a.vel, a.el); }catch(_e){} }
      if(head) hit._dnHead=true;
      if(RUNM.crit>0 && Math.random()<RUNM.crit){ dmg*=2; hit._dnCrit=true; const _q=a.g.position; EFX.flash(_q.x,_q.y,_q.z,0xffe7b8,0.35,1.8,0.16); }   // FEJLESZTÉS: Kritikus Lövés (×2)
      const _absorbed = a.el!=='base' && hit.el && hit.el===a.el;   // ROSSZ-ELEM BÜNTETÉS: a troll SAJÁT (innate) elemével lőve -> ELNYELI (gyógyul), nem sebződik. Motiválja a sima nyilat / ellen-elemet.
      if(coopIsRemote(hit)){ hit.hurtFlash=0.15; coopOnLocalHit(hit, head, dmg, a.el, a.charge); } // CO-OP: a szerver dönt sebzés/heal/kill felől; az absorb-tellt a 'absorb' elFx hozza
      else if(_absorbed){   // SP elnyelés: kis heal + tell, NINCS sebzés / reakció / státusz
        const _heal=Math.min(dmg*0.20, (hit.maxHp||hit.hp)-hit.hp); if(_heal>0) hit.hp=Math.min(hit.maxHp||hit.hp, hit.hp+_heal);
        hit.hurtFlash=0; absorbTell(hit, a.el); }
      else { const wasStatus=hit.statusEl; const _rz=(hit.resist&&hit.resist[a.el])?hit.resist[a.el]:1; const _dmg=dmg*(hit.frozenSolid>0?1.5:1)*_rz*(hit.elite?RUNM.eliteMul:1)*bossDamageMultiplier(hit); hit.hp-=_dmg; hit.hurtFlash=(_rz>1.3?0.3:0.15);   // törékeny ×1.5 + per-troll resist
        if(_rz<0.6){ const _q=a.g.position; for(let i=0;i<4;i++) RP.spawn(_q.x,_q.y,_q.z,rand(-1,1),rand(0,1.5),rand(-1,1),0x8a8f99,0.3,0.02,0.3,1,1); }   // ELLENÁLL: szürke sercegés (rossz elem)
        const _skip=elementMechanic(a.g.position, a.el, hit, dmg, head, wasStatus, a.charge, a.resonant); if(!_skip) applyStatus(hit, a.el, a.charge); if(head) gainUlt(2); }   // ELEM-REACT: reakció/alap + rezonancia; fejlövés tölti a VIHAR-t
      const hp=a.g.position;
      if(!_absorbed){ elementalImpact(hp, a.el, head);   // ELEM: becsapódás-burst (absorbnál KIHAGYVA -> az absorbTell hordozza a "rossz elem" olvasatot)
        const vl=a.vel.length()||1, ix=a.vel.x/vl, iy=a.vel.y/vl, iz=a.vel.z/vl;   // a találat iránya: visszafröccsenő moha-/bőrszilánkok + irányított megrándulás
        VFX.debris(hp.x,hp.y,hp.z,head?9:6,HIT_CHIPS,3.2,{up:-0.5,lift:1.2,life:0.6,grav:11,w:0.04,vx:-ix*3.4,vy:-iy*3.4,vz:-iz*3.4});
        hit._hitX=ix; hit._hitZ=iz; hit._hitK=head?1.4:1; }
      if(head) AUD.head(); else AUD.hit();
      if(head && !_absorbed) callout(tr('toast.headshot'),true);
      if(!a._counted){ a._counted=true; STATS.hits++; }
      if(!coopIsRemote(hit)) a.hitSet.add(hit);
      const _willDie=(!coopIsRemote(hit) && hit.hp<=0);
      hitMarker(_absorbed?'':(_willDie?'kill':(head?'head':'')));
      if(_willDie) killMonster(hit, head);
      let consumed = true;
      if(a.el==='base' && !coopIsRemote(hit)){
        if(a.pierceLeft>0){ a.pierceLeft--; consumed=false; sparks.burst(hp.x,hp.y,hp.z,6,0xcfd6df,4,0.3); }   // ÁTÜTÉS: átrepül, sebzi a következőt
        else if(a.ricochetLeft>0){ const nx=findRicochetTarget(a, a.g.position.x, a.g.position.y, a.g.position.z);
          if(nx){ a.ricochetLeft--; consumed=false; const sp=a.vel.length()||30;
            const tc=tmp.set(nx.g.position.x, nx.g.position.y+(nx.bodyCY||1), nx.g.position.z);
            a.vel.copy(tc).sub(a.g.position); if(a.vel.lengthSq()<1e-6) a.vel.set(0,0,-1); a.vel.normalize().multiplyScalar(sp);
            a.prev.copy(a.g.position); orientArrow(a); a.life=0; EFX.flash(hp.x,hp.y,hp.z,0xffe7b8,0.3,1.4,0.18); } }   // PATTANÁS: a legközelebbi még-nem-talált trollra fordul
      }
      if(consumed){ a.active=false; a.g.visible=false; }
    }
    if(a.life>6){ a.active=false; a.g.visible=false; }
    } catch(_e){ if(!window.__loopErr){ window.__loopErr=String((_e&&_e.stack)||_e); console.error('[update arrow-loop caught — game continues; please report this]', _e); } }
  }
  if(running) updateBombs(dt); if(running) updateWbolts(dt);   // köpködő-bombák + LIDÉRC jég-lövedékek (szünetben befagynak)
  if(running) updateAbolts(dt); updateWither(dt);   // SÁMÁN: arkán lövedékek + gyengítés-csillapodás (a nyaláb-elrejtés mindig fusson)

  /* --- szörnyek --- */
  if(running){ updateSpells(dt); updateBossHazards(dt); samplePlayerVelocity(dt); updateTactics(dt,t); }   // ELEM-TAKTIKA: jégfal, kataklizma, páncél, jelek, HUD
  if(running) applyWispAuras();   // LIDÉRC-aura frissítése a monster-loop ELŐTT (hogy a trollAI friss buffot lásson)
  aliveCount=0;
  for(let i=monsters.length-1;i>=0;i--){ const m=monsters[i]; try {
    tickDmgNum(m,dt);   // LÁTVÁNY-TURBÓ: lebegő sebzés-számok (HP-delta alapján)
    if(m.dying>0){ if(m._flashV) setTrollFlash(m,0); m.dying+=dt; const k=m.dying; const g=m.g, p=g.position; if(m.hpbar&&m.hpbar.visible) m.hpbar.visible=false;
      if(m.eyeMat && m.deathStyle!=='dissolve') m.eyeMat.emissiveIntensity=Math.max(0, 2*(1-k/1.1));   // elhaló szemfény minden stílusban
      const deathThud=(scaleMul)=>{ if(m._thudDone) return; m._thudDone=true;   // földet érés: porfelhő + por-gyűrű + rögök (egyszer)
        trollCollapseDust(m, scaleMul);
        EFX.ring(p.x,GROUND_Y+0.05,p.z,0xa8b498,0.25,1.9*m.scale*(scaleMul||1),0.35,0.5);
        for(let i2=0;i2<8;i2++) RP.spawn(p.x+rand(-0.5,0.5)*m.scale,GROUND_Y+0.1,p.z+rand(-0.5,0.5)*m.scale, rand(-1.2,1.2),rand(0.4,1.8),rand(-1.2,1.2), pick([0x8a795c,0x6f7a5a,0xa89a78]), rand(0.4,0.7),0.05, rand(0.3,0.6), 4,1); };
      switch(m.deathStyle){
        case 'topple': {
          const f=easeOutCubic(Math.min(1,k/0.9));
          const settle=(k>0.9)?Math.sin((k-0.9)*16)*0.07*Math.exp(-(k-0.9)*6):0;   // földet érés utáni rugózó megülés
          g.rotation.x=lerp(0,1.55,f)+settle; g.rotation.z=lerp(0,m.deathSpin*0.3,f); p.y=GROUND_Y-0.05*f;
          if(k>0.82) deathThud(1);
          m.head.rotation.x=lerp(0,0.9,Math.min(1,k/0.6)); m.head.rotation.z=lerp(0,m.deathSpin*0.6,Math.min(1,k/0.7));
          m.arms.L.rotation.x=lerp(0.5,1.7,f); m.arms.L.rotation.z=lerp(0,0.5,f);
          m.arms.R.rotation.x=lerp(0.5,1.7,f); m.arms.R.rotation.z=lerp(0,-0.5,f);
          m.legs.L.rotation.x=lerp(0,-0.4,f); m.legs.R.rotation.x=lerp(0,-0.5,f);
          animateDeathJoints(m,k);
          if(k>1.55){ scene.remove(g); disposeMonster(m); monsters.splice(i,1); } continue;
        }
        case 'dissolve': {
          const r=Math.min(1,k/1.4); g.position.y=GROUND_Y+r*1.4; g.rotation.y+=dt*1.2;
          const sc=m.scale*(1+r*0.35); g.scale.set(sc,sc*(1-r*0.9),sc);
          if(m.eyeMat) m.eyeMat.emissiveIntensity=lerp(2,0,r);
          if(Math.random()<0.6) gore.burst(p.x+rand(-0.4,0.4),p.y+rand(0.3,1.3),p.z+rand(-0.4,0.4),2,0x7fe2ff,2.5,0.8);
          if(Math.random()<0.7) RP.spawn(p.x+rand(-0.5,0.5),p.y+rand(0.2,1.6),p.z+rand(-0.5,0.5), rand(-0.2,0.2),rand(0.8,2.0),rand(-0.2,0.2), pick([0x9fe3ff,0xd8f4ff,0xffffff]), rand(0.35,0.6),0.03, rand(0.5,0.9), -0.5,1);   // felszálló szellem-spórák
          animateDeathJoints(m,k);
          if(k>1.5){ scene.remove(g); disposeMonster(m); monsters.splice(i,1); } continue;
        }
        case 'burst': {
          const r=Math.min(1,k/0.9), blow=easeOutCubic(r);
          m.head.position.y=lerp(m.head.position.y,2.6,dt*8); m.head.rotation.x+=dt*9; m.head.rotation.z+=dt*7;
          m.arms.L.rotation.z=lerp(0,1.6,blow); m.arms.R.rotation.z=lerp(0,-1.6,blow);
          m.arms.L.rotation.x+=dt*6; m.arms.R.rotation.x+=dt*6;
          m.legs.L.rotation.z=lerp(0,0.9,blow); m.legs.R.rotation.z=lerp(0,-0.9,blow); g.rotation.y+=dt*4;
          g.scale.setScalar(Math.max(0.0001,m.scale*(1-blow*0.95)));
          if(k<0.25 && Math.random()<0.5) gore.burst(p.x,p.y+m.bodyCY,p.z,4,0x5f9168,10,0.5);
          animateDeathJoints(m,k);
          if(k>1.1){ scene.remove(g); disposeMonster(m); monsters.splice(i,1); } continue;
        }
        case 'sink': {
          const r=easeOutCubic(Math.min(1,k/1.2)); g.position.y=GROUND_Y-r*1.7;
          const sc=m.scale*(1-r*0.5); g.scale.set(sc,sc*(1-r*0.3),sc); g.rotation.y+=dt*0.6;
          m.head.rotation.x=lerp(0,0.5,r);
          if(k<0.7 && Math.random()<0.4) gore.burst(p.x+rand(-0.3,0.3),GROUND_Y+0.1,p.z+rand(-0.3,0.3),3,0x3c5a3e,3,0.2);
          animateDeathJoints(m,k);
          if(k>1.4){ scene.remove(g); disposeMonster(m); monsters.splice(i,1); } continue;
        }
        case 'stagger': {
          if(k<0.7){ const s=easeOutBack(Math.min(1,k/0.7)); g.rotation.x=lerp(0,-0.35,s);
            p.x+=m.deathDir.x*dt*1.4; p.z+=m.deathDir.z*dt*1.4;
            m.arms.L.rotation.x=0.5+Math.sin(k*22)*0.6; m.arms.R.rotation.x=0.5-Math.sin(k*22)*0.6; m.head.rotation.z=Math.sin(k*18)*0.3;
          } else { const f=easeOutCubic(Math.min(1,(k-0.7)/0.8)); g.rotation.x=lerp(-0.35,1.5,f)+((k>1.4)?Math.sin((k-1.4)*15)*0.06*Math.exp(-(k-1.4)*6):0); p.y=GROUND_Y-0.05*f;
            if(k>1.35) deathThud(1);
            m.head.rotation.x=lerp(0,1.0,f); m.arms.L.rotation.x=lerp(0.5,1.6,f); m.arms.R.rotation.x=lerp(0.5,1.6,f);
            m.legs.L.rotation.x=lerp(0,-0.5,f); m.legs.R.rotation.x=lerp(0,-0.5,f); }
          animateDeathJoints(m,k);
          if(k>1.9){ scene.remove(g); disposeMonster(m); monsters.splice(i,1); } continue;
        }
        case 'crumple': {
          const r=easeOutCubic(Math.min(1,k/1.0)); p.y=GROUND_Y-r*0.55;
          m.legs.L.rotation.x=lerp(0,1.4,r); m.legs.R.rotation.x=lerp(0,1.4,r); g.rotation.x=lerp(0,0.95,r);
          m.head.rotation.x=lerp(0,1.1,Math.min(1,k/0.8)); m.arms.L.rotation.x=lerp(0.5,2.0,r); m.arms.R.rotation.x=lerp(0.5,2.0,r);
          const flat=Math.min(1,Math.max(0,(k-0.9)/0.5)); g.scale.set(m.scale,m.scale*(1-flat*0.35),m.scale);
          if(k>0.85) deathThud(0.8);
          animateDeathJoints(m,k);
          if(k>1.5){ scene.remove(g); disposeMonster(m); monsters.splice(i,1); } continue;
        }
        case 'split': {   // OSZTÓDÁS: a héj szétreped, a tagok kicsapódnak, a test elenyészik (a szilánkok már külön spawnoltak a killMonsterben)
          const r=Math.min(1,k/0.8), blow=easeOutCubic(r);
          m.head.position.y=lerp(m.head.position.y,2.4,dt*7); m.head.rotation.x+=dt*8; m.head.rotation.z+=dt*6;
          m.arms.L.rotation.z=lerp(0,1.7,blow); m.arms.R.rotation.z=lerp(0,-1.7,blow);
          m.legs.L.rotation.z=lerp(0,1.0,blow); m.legs.R.rotation.z=lerp(0,-1.0,blow);
          g.rotation.y+=dt*3; g.scale.setScalar(Math.max(0.0001,m.scale*(1-blow)));
          if(k<0.3&&Math.random()<0.6) gore.burst(p.x+rand(-0.4,0.4),p.y+m.bodyCY*r,p.z+rand(-0.4,0.4),3,0x6f7a72,8,0.5);
          animateDeathJoints(m,k);
          if(k>0.85){ scene.remove(g); disposeMonster(m); monsters.splice(i,1); } continue;
        }
        default: {
          g.rotation.x=lerp(0,-1.4,Math.min(1,k*2)); g.position.y=GROUND_Y-Math.min(0.5,k*0.8);
          g.scale.setScalar(m.scale*(1-Math.min(1,k*0.7)*0.5));
          animateDeathJoints(m,k);
          if(k>1.0){ scene.remove(g); disposeMonster(m); monsters.splice(i,1); } continue;
        }
      }
    }
    if(!m.alive) continue;
    aliveCount++;
    if(m.spawnArc!=null && !coopIsRemote(m)){ m.spawnArc+=dt; const a=m.spawnArc;   // OSZTÓDÁS pop-out: a szilánk kis ívben kipattan a Kőbunkó helyéből
      if(a<0.45){ const u=a/0.45, px=m.spawnFrom.x+m.spawnDir.x*(0.6+u*1.0), pz=m.spawnFrom.z+m.spawnDir.z*(0.6+u*1.0);
        m.g.position.set(px,GROUND_Y+Math.sin(u*Math.PI)*0.9,pz); m.g.rotation.y+=dt*6; if(m._crackMat) m._crackMat.opacity=0.85*(1-u); }
      else { m.g.position.y=GROUND_Y; if(m._crackMat) m._crackMat.opacity=0; m.spawnArc=null; sparks.burst(m.g.position.x,GROUND_Y+0.1,m.g.position.z,8,0x6f7a72,4,0.2); } }
    if(!coopIsRemote(m)) tickStatus(m, dt);    // ELEM: burn/poison DoT, freeze slow, shock stun, aura
    else if(m.statusEl) statusAura(m, m.statusEl, dt);   // ELEM co-op: a távoli (szerver-vezérelt) trollon is fusson az aura-vizuál
    if(!m.alive){ aliveCount--; continue; }    // ELEM: a DoT just killed it → hand over to the dying animation
    if(coopIsRemote(m)){ /* CO-OP: server owns this monster's movement/attacks; skip local AI (interpolated in coopTick) */ }
    else { if(m.gen) motionRig(m); const bossOwns=m.boss && running && bossTick(m,dt); if(!bossOwns) trollAI(m, dt, t);
      if(running && player.alive) animateMonster(m,dt); } // típus-függő mozgás/támadás (belül running&&alive gate)
    // sérülés-villanás a szemeken
    if(m.hurtFlash>0){ m.hurtFlash-=dt; const f=m.hurtFlash>0?1:0; for(const e of m.eyes) e.material.emissiveIntensity=2+f*4; setTrollFlash(m, f?Math.min(0.62,m.hurtFlash*3.6):0); }
    else { for(const e of m.eyes) e.material.emissiveIntensity=2; if(m._flashV) setTrollFlash(m,0); }
    updateHpBar(m, dt);   // fej fölötti élet-csík: billboard + szín + sebzés-linger
    } catch(_e){ if(!window.__loopErr){ window.__loopErr=String((_e&&_e.stack)||_e); console.error('[update monster-loop caught — game continues; please report this]', _e); } }
  }
  if(running) separateMonsters();   // troll-vs-troll szétválás (a torlódás/beszorulás ellen)
  if(running) updateGravHand(dt);   // GRAVITÁCIÓS KÉZ: lebegtetés / döngölés / ellökés a mozgás UTÁN (az AI ne írja felül a magasságot)

  /* --- hullám-vezérlés --- */
  if(running && !coopShouldSuppressLocalSpawner()){
    if(toSpawn>0 && aliveCount<14){ spawnTimer-=dt; if(spawnTimer<=0){ spawnMonster(); toSpawn--; spawnTimer=Math.max(0.25,1.0-wave*0.03); } }
    else if(aliveCount===0 && intermission<=0){ toast(tr('toast.waveDone',{n:wave})); addScore(50+wave*10);
      if(!coop && waveDmgTaken<=0){ const fb=60+wave*15; addScore(fb); callout(tr('ui.flawless',{n:fb}),true); }   // TURBÓ: sértetlen hullám bónusz
      if(wave%5===0 && !coop){ openShop(); } else { intermission=3; } }   // FEJLESZTÉS: bónusz ELŐSZÖR (költhető), majd 5 hullámonként bolt (csak SP); a TOVÁBB gomb indítja a köv. hullámot
    if(intermission>0){ intermission-=dt; if(intermission<=0) startWave(wave+1); }
    setTrollHud(aliveCount+toSpawn);
  }
  else if(running && coop){ setTrollHud(aliveCount); }
  if(coop) coopTick(dt); // FIX: peer-szinkron + interpoláció + sendInput szünetben/menüben/halál után is fusson

  /* --- effektek --- */
  updateElemFx(dt);
  updateDmgNums(dt);
  RP.update(dt); SMK.update(dt); EFX.update(dt); VFX.update(dt, running); FIREBURST.update(dt); POISONPOOL.update(dt); DUSTPOOF.update(dt); ZAPBURST.update(dt); POISONCLOUD.update(dt); POISONSKULL.update(dt);   // ELEM-CINEMA: gazdag additív FX-réteg + VFX-készlet léptetése
  updateUltHud();   // PLAYER: VIHAR-csík + rezonancia-ragyogás
  updateTurboHud(dt); envUltK=ult/100;
  if(arrowLightT>0){ arrowLightT-=dt; if(arrowLightT<=0) arrowLight.intensity=0; }   // repülő elemi nyíl fénye lecseng (visible marad: konstans fény-szám)
  drawRadar(t);
  updateEnv(dt,t);   // LÁTVÁNY-TURBÓ: szél, talajköd, fénypászmák, parázstartók, rúna-kör
  updateHpOrbs(dt,t);   // FÁZIS 4: lebegő élet-gömbök (pörgés/lebegés + felvétel)
  SKY_U.uTime.value=t; FXS.t=t; shootStar(dt);   // LÁTVÁNY-TURBÓ: ég-animáció (csillag-pislákolás, sarki fény, felhők) + hullócsillag
  // szentjánosbogarak
  for(let i=0;i<FCOUNT;i++){ const s=fSeed[i];
    fPos[i*3]=fBase[i*3]+Math.sin(t*s[0]+s[1])*0.4; fPos[i*3+1]=fBase[i*3+1]+Math.sin(t*s[0]*0.8+s[2])*0.3; fPos[i*3+2]=fBase[i*3+2]+Math.cos(t*s[0]+s[1])*0.4; }
  fGeo.attributes.position.needsUpdate=true;
/* ---- EDIT N+ (loop) — INSERT right AFTER the existing firefly update
        (after `fGeo.attributes.position.needsUpdate=true;`, ~line 920).
        `t` is the same elapsed-seconds value already used there. ---- */
for(let i=0;i<SCOUNT;i++){ const s=sSeed[i];
  sPos[i*3]=sBase[i*3]+Math.sin(t*s[0]+s[1])*0.7;
  sPos[i*3+1]=sBase[i*3+1]+Math.sin(t*s[0]*0.6+s[1])*0.5 + (((t*s[2])%8)/8)*0.6;
  sPos[i*3+2]=sBase[i*3+2]+Math.cos(t*s[0]*0.8+s[1])*0.7; }
sGeo.attributes.position.needsUpdate=true;
  for(const g of swayers){ g.rotation.z=Math.sin(t*1.6+g.userData.phase)*0.06; }
  // hurt vignette lecsengés
  if(parseFloat(hurtEl.style.opacity)>0) hurtEl.style.opacity=Math.max(0,parseFloat(hurtEl.style.opacity)-dt*1.2);

  /* --- kamera --- */
  applyCamera(); camera.rotation.z=camRoll;
  if(running) GHOST.update(dt);   // szellemnyíl-koszorú: a kamera végleges állásához igazítva
  nockLoopFx(t);   // nyílhegy elem-loop: a kamera végleges állása után (különben gyors fordulásnál leszakad a hegyről)
  if(running){ camera.rotation.x+=(bowKick>0?bowKick*bowKick*0.013:0)+(spellKick>0?Math.sin(spellKick*Math.PI)*0.02:0); }   // elengedés / varázslat: apró, gyorsan lecsengő visszarúgás (a nyíl ekkor már úton van)
  const menuCam=!running && !startScreen.classList.contains('hide');   // TURBÓ: a főmenü mögött lassan keringő kamera mutatja a tisztást
  if(menuCam){ const a=t*0.045+0.6; camera.position.set(Math.cos(a)*27, 6.5+Math.sin(t*0.13)*1.2, Math.sin(a)*27); camera.lookAt(0,3.2,0); }
  if(bow.visible===menuCam) bow.visible=!menuCam;
  if(shake>0.002){ const sk=SET.shake?shake:0, tt=idleT;
    // sima, zaj-szerű kamerarázás (5–10 Hz-es szinusz-keverék: nem képkockánként ugráló remegés) + enyhe oldalbillenés; a célzás irányát NEM téríti el
    const n1=Math.sin(tt*31.7)+Math.sin(tt*52.3+1.3)*0.6, n2=Math.sin(tt*27.1+2.1)+Math.sin(tt*61.9)*0.6, n3=Math.sin(tt*36.4+0.7)+Math.sin(tt*44.8+4.2)*0.6;
    camera.position.x+=n1*sk*0.20; camera.position.y+=n2*sk*0.20; camera.position.z+=n3*sk*0.12; camera.rotation.z+=n1*sk*0.022;
    shake*=Math.pow(0.0015,dt); }
}

/* szakasz(a,b) – pont(p) távolság */
function segDist(a,b,p){ const abx=b.x-a.x,aby=b.y-a.y,abz=b.z-a.z; const apx=p.x-a.x,apy=p.y-a.y,apz=p.z-a.z;
  const ab2=abx*abx+aby*aby+abz*abz; let t=ab2>1e-9?(apx*abx+apy*aby+apz*abz)/ab2:0; t=clamp(t,0,1);
  const cx=a.x+abx*t,cy=a.y+aby*t,cz=a.z+abz*t; return Math.hypot(p.x-cx,p.y-cy,p.z-cz); }

/* segédek a halál-animációkhoz */
const pick=(arr)=>arr[(Math.random()*arr.length)|0];
const easeOutCubic=(x)=>1-Math.pow(1-x,3);
const easeOutBack=(x)=>{ const c1=1.70158, c3=c1+1, u=x-1; return 1+c3*u*u*u+c1*u*u; };
const easeInOut=(x)=> x<0.5 ? 2*x*x : 1-Math.pow(-2*x+2,2)/2;

