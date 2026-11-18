/* ===================== Minimap / radar ===================== */
const radarCv=document.getElementById('radar');
const RADAR_PX=160, RADAR_DPR=Math.min(devicePixelRatio||1,2);
radarCv.width=RADAR_PX*RADAR_DPR; radarCv.height=RADAR_PX*RADAR_DPR;
const rctx=radarCv.getContext('2d'); rctx.scale(RADAR_DPR,RADAR_DPR);
const R_CENTER=RADAR_PX/2, R_RIM=R_CENTER-8, R_WORLDMAX=SPAWN_R+3;
function threatCss(m){ return m && m.threat!==undefined ? '#'+m.threat.toString(16).padStart(6,'0') : '#9bd0a0'; }
// RADAR-JEL: SZÍN = ELEM (semleges = halvány kékesszürke; ugyanaz a paletta, mint az alsó elem-gombok)
function blipElCss(m){ return (m && m.el && EL[m.el]) ? EL[m.el].ui : '#c3d2ea'; }
// RADAR-JEL: FORMA = TÍPUS (csak path-t rajzol, a hívó fill+stroke; 7 kitölthető forma, hogy az elem-szín látsszon)
function blipPath(ctx,x,y,r,typeId){
  ctx.beginPath();
  switch(typeId){
    case 'scout':   ctx.moveTo(x,y-r); ctx.lineTo(x+r*0.92,y+r*0.72); ctx.lineTo(x-r*0.92,y+r*0.72); ctx.closePath(); break;   // felfelé háromszög (fürge kobold)
    case 'spitter': ctx.moveTo(x,y+r); ctx.lineTo(x+r*0.92,y-r*0.72); ctx.lineTo(x-r*0.92,y-r*0.72); ctx.closePath(); break;   // lefelé háromszög (köpködő)
    case 'brute':   { const s=r*0.9; ctx.rect(x-s,y-s,2*s,2*s); } break;                                                        // négyzet (kőbunkó)
    case 'shard':   ctx.moveTo(x,y-r); ctx.lineTo(x+r,y); ctx.lineTo(x,y+r); ctx.lineTo(x-r,y); ctx.closePath(); break;         // rombusz (kőszilánk)
    case 'shaman':  { for(let i=0;i<8;i++){ const a=-Math.PI/2+i*Math.PI/4, rad=(i%2?r*0.42:r*1.1); const qx=x+Math.cos(a)*rad, qy=y+Math.sin(a)*rad; i?ctx.lineTo(qx,qy):ctx.moveTo(qx,qy); } ctx.closePath(); } break;   // 4-ágú csillag (sámán)
    case 'wisp':    { for(let i=0;i<6;i++){ const a=-Math.PI/2+i*Math.PI/3, qx=x+Math.cos(a)*r, qy=y+Math.sin(a)*r; i?ctx.lineTo(qx,qy):ctx.moveTo(qx,qy); } ctx.closePath(); } break;   // hatszög (lidérc)
    default:        ctx.arc(x,y,r,0,6.283);   // grunt (mohás troll) + fallback: kör
  }
}
function drawRadar(t){
  if(!running){ rctx.clearRect(0,0,RADAR_PX,RADAR_PX); return; }
  const cx=R_CENTER, cy=R_CENTER; rctx.clearRect(0,0,RADAR_PX,RADAR_PX);
  const cyaw=Math.cos(player.yaw), syaw=Math.sin(player.yaw);
  const arenaR=(ARENA_R/R_WORLDMAX)*R_RIM;
  rctx.beginPath(); rctx.arc(cx,cy,arenaR,0,6.283); rctx.strokeStyle='rgba(255,210,122,.35)'; rctx.lineWidth=1.5; rctx.stroke();
  rctx.beginPath(); rctx.arc(cx,cy,R_RIM,0,6.283); rctx.strokeStyle='rgba(127,226,255,.22)'; rctx.lineWidth=1; rctx.stroke();
  // bejövő spawn-ívek
  for(let i=0;i<spawnAngles.length;i++){
    const a=spawnAngles[i], dx=Math.cos(a), dz=Math.sin(a);
    const sx=dx*cyaw-dz*syaw, sy=dx*syaw+dz*cyaw, ang=Math.atan2(sy,sx);
    const next=(i===0), pulse=0.5+0.5*Math.sin(t*6-i*0.6), span=next?0.42:0.30;
    rctx.beginPath(); rctx.arc(cx,cy,R_RIM,ang-span/2,ang+span/2); rctx.lineWidth=next?4:2.5;
    const aMul=next?(0.55+0.45*pulse):(0.25+0.35*pulse);
    rctx.strokeStyle='rgba(255,'+(next?90:150)+','+(next?60:90)+','+aMul.toFixed(3)+')'; rctx.stroke();
  }
  // szörny-pontok
  for(const mo of monsters){ if(!mo.alive && !(mo.dying>0)) continue;
    const dx=mo.g.position.x-player.pos.x, dz=mo.g.position.z-player.pos.z;
    const sx=dx*cyaw-dz*syaw, sy=dx*syaw+dz*cyaw, px=sx, py=sy;
    const wd=Math.hypot(px,py); let rr=(wd/R_WORLDMAX)*R_RIM; const clamped=rr>R_RIM; if(clamped) rr=R_RIM;
    const ux=wd>1e-4?px/wd:0, uy=wd>1e-4?py/wd:0, dxs=cx+ux*rr, dys=cy+uy*rr;
    rctx.globalAlpha=mo.dying>0?Math.max(0,1-mo.dying):1;
    const rad=mo.scale>1.05?4.2:3.4, elCss=blipElCss(mo);   // szín = ELEM, forma = TÍPUS
    if(clamped){   // peremre szorítva: a típus-forma KÖRVONALA az elem-színben (irány + elem a szélén is olvasható)
      blipPath(rctx,dxs,dys,3.0,mo.typeId); rctx.strokeStyle=elCss; rctx.lineWidth=1.7; rctx.stroke();
    } else {
      blipPath(rctx,dxs,dys,rad,mo.typeId); rctx.fillStyle=elCss; rctx.fill();
      rctx.strokeStyle='rgba(6,11,20,.72)'; rctx.lineWidth=1; rctx.stroke();   // sötét kontúr a kontrasztért a sötét radaron
      if(mo.elite){ rctx.beginPath(); rctx.arc(dxs,dys,rad+2.4,0,6.283); rctx.strokeStyle='#ffd27a'; rctx.lineWidth=1.4; rctx.stroke(); }   // elit: arany külső gyűrű
    }
    rctx.globalAlpha=1;
  }
  // játékos + nézés-ék
  rctx.beginPath(); rctx.moveTo(cx,cy); rctx.arc(cx,cy,arenaR*0.9,-Math.PI/2-0.5,-Math.PI/2+0.5); rctx.closePath();
  const wg=rctx.createRadialGradient(cx,cy,2,cx,cy,arenaR); wg.addColorStop(0,'rgba(127,226,255,.42)'); wg.addColorStop(1,'rgba(127,226,255,0)');
  rctx.fillStyle=wg; rctx.fill();
  rctx.beginPath(); rctx.arc(cx,cy,3.2,0,6.283); rctx.fillStyle='#eaf2ff'; rctx.fill(); rctx.strokeStyle='rgba(54,197,255,.9)'; rctx.lineWidth=1.4; rctx.stroke();
}

// RADAR-JELMAGYARÁZAT: egyszer felépítve. Elem = színes pötty (EL.ui, mint az elem-gombok),
// Típus = a KÖZÖS blipPath helperrel rajzolt forma (garantáltan egyezik a radar-blipekkel).
function buildRadarKey(){
  const box=document.getElementById('radarkey'); if(!box) return;
  const elItems=[['TŰZ',EL.fire.ui],['JÉG',EL.ice.ui],['MÉREG',EL.poison.ui],['VILLÁM',EL.lightning.ui],['semleges','#c3d2ea']];
  let html='<div class="rk-h">ELEM · SZÍN</div><div class="rk-el">';
  for(const [nm,c] of elItems) html+='<span><i style="background:'+c+'"></i>'+nm+'</span>';
  html+='</div><div class="rk-h">TÍPUS · FORMA</div><div class="rk-ty" id="rk-ty"></div>';
  box.innerHTML=html;
  const grid=box.querySelector('#rk-ty'), DPR=Math.min(devicePixelRatio||1,2), S=13;
  for(const id of ['grunt','scout','brute','shard','shaman','spitter','wisp']){
    const sp=document.createElement('span');
    const cv=document.createElement('canvas'); cv.width=S*DPR; cv.height=S*DPR; cv.style.width=S+'px'; cv.style.height=S+'px';
    const c=cv.getContext('2d'); c.scale(DPR,DPR);
    blipPath(c,S/2,S/2,4.4,id); c.fillStyle='#c3d2ea'; c.fill(); c.strokeStyle='rgba(6,11,20,.72)'; c.lineWidth=1; c.stroke();
    sp.appendChild(cv); sp.appendChild(document.createTextNode((TROLL_TYPES[id]&&TROLL_TYPES[id].name)||id));
    grid.appendChild(sp);
  }
}
buildRadarKey();

