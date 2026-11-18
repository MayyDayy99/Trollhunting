/* ===== ?shot=1 : DEV screenshot mód — fix kameraállások + trolltípus-sor (játékmenetet nem érinti) ===== */
if(/[?&]shot=1/.test(location.search)){
  const SHOT_POSES=[
    [-6, 1.8, -2.6,  -6, 1.2, -6],   // 0: grunt/scout/brute közelről
    [0, 9, 22,      0, 1, 0],        // 1: tisztás totál
    [4, 1.7, 6,    -16, 4, -26],     // 2: fák / lombkorona / horizont
    [3, 1.8, -2.6,   3, 1.2, -6],    // 3: shaman/spitter/wisp/shard közelről
  ];
  let shotIdx=0;
  window.__nextShot=()=>{ shotIdx=(shotIdx+1)%SHOT_POSES.length; window.__shotPose=SHOT_POSES[shotIdx]; return shotIdx; };
  const bootShot=setInterval(()=>{
    const l=document.getElementById('loading');
    if(l && l.classList.contains('hide')){
      clearInterval(bootShot);
      document.querySelectorAll('.screen').forEach(e=>e.classList.add('hide'));
      const hud=document.getElementById('hud'); if(hud) hud.style.display='none';
      window.__shotErrors=[];
      for(const [i,ty] of ['grunt','scout','brute','shaman','spitter','wisp','shard'].entries()){
        try{ const m=makeMonster(ty,1.0,100,2.5); m.g.position.set(-9+i*3, GROUND_Y, -6); m.g.rotation.y=0; }catch(_e){ window.__shotErrors.push(ty+': '+_e.message); }
      }
      window.__shotPose=SHOT_POSES[0];
    }
  },50);
}

