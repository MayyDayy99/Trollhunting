/* ===================== Játékos / FPS kamera ===================== */
const player={ pos:new THREE.Vector3(0,1.7,0), yaw:0, pitch:0, hp:100, maxHp:100, alive:true, vy:0, feet:0, onGround:true, jumpReady:true, witherT:0 };   // witherT: sámán-nyaláb gyengítés (sebzés/újratöltés rontás)
camera.rotation.order='YXZ';
function applyCamera(){
  camera.position.copy(player.pos);
  camera.rotation.y=player.yaw; camera.rotation.x=player.pitch; camera.rotation.z=0;
}

/* ===================== Szilárd ütközés — feloldó/groundAt függvények (a konstansok feljebb deklarálva) ===================== */
function solidCyl(x, z, r, opts){
  SOLIDS.push({kind:'cyl', x:x, z:z, r:r, top:(opts&&opts.top)||0, bottom:(opts&&opts.bottom)||0, abot:(opts&&opts.abot!=null)?opts.abot:null, noArrow:!!(opts&&opts.noArrow), climb:!!(opts&&opts.climb), mob:!!(opts&&opts.mob)});
}
function solidBox(cx, cz, halfX, halfZ, opts){
  SOLIDS.push({kind:'box', minX:cx-halfX, maxX:cx+halfX, minZ:cz-halfZ, maxZ:cz+halfZ, abot:(opts&&opts.abot!=null)?opts.abot:null, noArrow:!!(opts&&opts.noArrow),
               top:(opts&&opts.top)||0, bottom:(opts&&opts.bottom)||0, climb:!!(opts&&opts.climb), mob:!!(opts&&opts.mob)});
}
const OVERHEAD = 2.2;   // efölötti aljú építmény (magas fedélzet/híd) ALATT a játékos/troll szabadon átmegy, csak a tetejére mászhat
// igaz, ha a játékos a tetején/fölötte áll -> nem blokkol oldalról (átléphet/ráállhat)
function _onTopOf(s, x, z, feet){
  if(s.top<=0) return false;
  // MAGAS építmény (fedélzet/híd) ALATT állva: ne blokkoljon oldalról -> a játékos átsétálhat alatta (csak a tetejére mászik fel a rámpán)
  if(s.bottom>=OVERHEAD && feet < s.bottom - STEP) return true;
  // MÁSZHATÓ test egy lépésnyin belül (top <= feet+STEP) -> SOSE blokkoljon oldalról: a játékos rálép,
  // a groundAt megemeli a lábát. (Enélkül a resolveMove kitolja a lábnyom elől, és sosem tud felmászni.)
  if(s.climb && feet >= s.top - STEP) return true;
  // különben csak akkor "tető" (nincs oldal-blokk), ha VÍZSZINTESEN fölötte van ÉS elég magasan (különben fal)
  let over;
  if(s.kind==='box') over = (x>=s.minX && x<=s.maxX && z>=s.minZ && z<=s.maxZ);
  else over = ((x-s.x)*(x-s.x)+(z-s.z)*(z-s.z)) <= s.r*s.r;
  if(!over) return false;
  return feet >= s.top;
}
// egy feloldó-passz: kitolja a pontot minden testből PLAYER_R-rel
function _resolvePass(x, z, feet){
  for(const s of SOLIDS){
    if(_onTopOf(s, x, z, feet)) continue;
    if(s.kind==='cyl'){
      const dx=x-s.x, dz=z-s.z; let d=Math.hypot(dx,dz); const R=s.r+PLAYER_R;
      if(d<R){ if(d<1e-4){ x=s.x+R; z=s.z; } else { const k=R/d; x=s.x+dx*k; z=s.z+dz*k; } }
    } else {
      const minX=s.minX-PLAYER_R, maxX=s.maxX+PLAYER_R, minZ=s.minZ-PLAYER_R, maxZ=s.maxZ+PLAYER_R;
      if(x>minX && x<maxX && z>minZ && z<maxZ){
        const pL=x-minX, pR=maxX-x, pD=z-minZ, pU=maxZ-z;
        const m=Math.min(pL,pR,pD,pU);
        if(m===pL) x=minX; else if(m===pR) x=maxX; else if(m===pD) z=minZ; else z=maxZ;
      }
    }
  }
  return {x:x, z:z};
}
// szörny-kitolás a fa/kő törzsekből (mob:true hengerek) — hogy a trollok ne menjenek át rajtuk
function pushMob(x, z, r){
  for(let pass=0; pass<2; pass++){ for(const s of SOLIDS){ if(!s.mob) continue; if(s.bottom>=OVERHEAD) continue;   // a magas fedélzet/híd ALATT a trollok átmennek (nem fal a talajon)
    if(s.kind==='cyl'){ const dx=x-s.x, dz=z-s.z; let d=Math.hypot(dx,dz); const R=s.r+r;
      if(d<R){ if(d<1e-4){ x=s.x+R; z=s.z; } else { const k=R/d; x=s.x+dx*k; z=s.z+dz*k; } } }
    else { const minX=s.minX-r, maxX=s.maxX+r, minZ=s.minZ-r, maxZ=s.maxZ+r;   // mob DOBOZ (platform/rönk): legkisebb-behatolás kitolás
      if(x>minX && x<maxX && z>minZ && z<maxZ){ const pL=x-minX, pR=maxX-x, pD=z-minZ, pU=maxZ-z; const mn=Math.min(pL,pR,pD,pU);
        if(mn===pL) x=minX; else if(mn===pR) x=maxX; else if(mn===pD) z=minZ; else z=maxZ; } } } }
  return {x:x, z:z};
}
// több passz: így nem préselhető ÁT két szomszédos test közötti résen
function resolveMove(x, z, feet){
  let r={x:x, z:z};
  for(let i=0;i<4;i++){ r=_resolvePass(r.x, r.z, feet); }
  return r;
}
// aréna-perem: sugaras visszaszorítás BOUND_R-re
function clampToBoundary(){
  const rr=Math.hypot(player.pos.x, player.pos.z);
  if(rr>BOUND_R){ const k=BOUND_R/rr; player.pos.x*=k; player.pos.z*=k; }
}
// (x,z) alatti megtámasztó magasság: a legmagasabb mászható tető a lábak + lépés-tűrés alatt
function groundAt(x,z,feet){ let s=GROUND_Y;
  for(const b of SOLIDS){
    if(!(b.climb && b.top>0)) continue;
    let inside;
    if(b.kind==='box') inside = (x>b.minX&&x<b.maxX&&z>b.minZ&&z<b.maxZ);
    else inside = ((x-b.x)*(x-b.x)+(z-b.z)*(z-b.z)) < b.r*b.r;
    if(inside && b.top<=feet+STEP && b.top>s) s=b.top;
  }
  return s; }
// mászható doboz (mesh + szilárd test) — a régi climbBox helyett
/* AA-indie szerkezetek: az ütközők VÁLTOZATLANOK (solidBox), csak a látvány lett kidolgozott:
   lekerekített élű pallók deszka-mintával, keretes-merevítős ládák, mohás kőlapok, gerendás lépcsők. */
function crateGeo(w,h,d){
  const t=0.11, D=[0.62,0.62,0.62], items=[{geo:roundBox(w-0.07,h-0.07,d-0.07,0.02)}], beam=(bw,bh,bd,x,y,z,rx,rz)=>{ const g=roundBox(bw,bh,bd,0.025); vcolAttr(g,()=>D); items.push({geo:g,x,y,z,rx:rx||0,rz:rz||0}); };
  for(const sx of [-1,1]) for(const sz of [-1,1]) beam(t,h,t, sx*(w-t)/2,0,sz*(d-t)/2);
  for(const sy of [-1,1]){ for(const sz of [-1,1]) beam(w,t,t, 0,sy*(h-t)/2,sz*(d-t)/2); for(const sx of [-1,1]) beam(t,t,d, sx*(w-t)/2,sy*(h-t)/2,0); }
  const dg=Math.hypot(w-2*t,h-2*t);
  for(const sz of [-1,1]) beam(dg,t*0.8,t*0.5, 0,0,sz*(d-t*0.5)/2, 0, sz*Math.atan2(h-2*t,w-2*t));
  for(const sx of [-1,1]) beam(t*0.5,t*0.8,Math.hypot(d-2*t,h-2*t), sx*(w-t*0.5)/2,0,0, sx*Math.atan2(h-2*t,d-2*t), 0);
  return mergeGeos(items);
}
function climbStruct(cx,cy,cz,w,height,d,mat,vis){
  let m=null;
  if(vis!=='none'){
    if(vis==='crate'){ m=new THREE.Mesh(crateGeo(w,height,d), envWoodV); m.rotation.y=0; }
    else if(mat===rockMat || !mat) m=new THREE.Mesh(roundBox(w,height,d,0.12), envRock);
    else { m=new THREE.Mesh(roundBox(w,height,d,0.05), envWood);
      if(cy>1){ for(const s of [-1,1]){ const b=new THREE.Mesh(roundBox(w+0.5,0.2,0.22,0.04), envWood); b.position.set(0,-height/2-0.08,s*d*0.3); b.castShadow=true; m.add(b); } } }   // fedélzet: alátét-gerendák
    m.position.set(cx, cy+height/2, cz); m.castShadow=true; m.receiveShadow=true; scene.add(m);
    if(cy<0.01) contactBlob(cx,cz,Math.max(w,d)*0.95);
  }
  solidBox(cx, cz, w/2, d/2, {climb:true, top:cy+height, bottom:cy, mob:true});   // mob:true -> a trollok nem mennek át a platformon (de a magas építmény ALATT igen, lásd OVERHEAD)
  return m;
}
// fa ládák egymás mellett/tetején (ugrálós)
climbStruct(-7.0, GROUND_Y, 5.5, 1.4,0.9,1.4, woodMat,'crate');
climbStruct(-8.6, GROUND_Y, 6.2, 1.4,0.9,1.4, woodMat,'crate');
climbStruct(-7.6, GROUND_Y, 4.0, 1.4,1.8,1.4, woodMat,'crate');
// lapos kőlépcsők kifelé
climbStruct(13, GROUND_Y, 11, 2.4,0.45,2.4, rockMat);
climbStruct(16, GROUND_Y+0.45, 13, 2.4,0.5,2.4, rockMat);

// === FÁZIS 4: VERTIKÁLIS BEJÁRHATÓSÁG — két kilátó-fedélzet + lombhíd köztük (a trollok nem tudnak felmászni) ===
// emelkedő palló-rámpa: `steps` palló +RISE-onként, (dx,dz) irányban lépve (GAP<W -> átfedés, így felsétálható)
// LÁTVÁNY: valódi falépcső — lekerekített járólapok két ferde pofagerendán (az ütköző-dobozok a régiek, láthatatlanok).
function rampUp(x0, z0, dx, dz, steps, mat, posts){
  const RISE=0.45, GAP=1.0, W=2.0, H=0.5;     // RISE<=STEP(0.55) -> minden lépcső felléphető; átfedés = W-GAP = 1.0
  const alongX=(dx!==0), TREAD=alongX?roundBox(1.14,0.13,W,0.04):roundBox(W,0.13,1.14,0.04), TOP=roundBox(W,0.13,W,0.04);
  for(let i=0;i<steps;i++){ const cx=x0+dx*GAP*i, cz=z0+dz*GAP*i; climbStruct(cx, RISE*i, cz, W, H, W, mat, 'none');
    const last=(i===steps-1), t=new THREE.Mesh(last?TOP:TREAD, envWood);
    t.position.set(cx-(last?0:dx*0.45), RISE*i+H-0.065, cz-(last?0:dz*0.45)); t.rotation.y=rand(-0.012,0.012); t.castShadow=true; t.receiveShadow=true; scene.add(t); }
  const L=Math.hypot((steps-1)*GAP,(steps-1)*RISE)+1.5, th=Math.atan2(RISE,GAP), mx=x0+dx*GAP*(steps-1)/2-dx*0.3, mz=z0+dz*GAP*(steps-1)/2-dz*0.3, my=RISE*(steps-1)/2+H-0.36;
  for(const s of [-1,1]){ const b=new THREE.Mesh(alongX?roundBox(L,0.3,0.15,0.04):roundBox(0.15,0.3,L,0.04), envWood);
    b.position.set(mx+(alongX?0:s*0.86), my, mz+(alongX?s*0.86:0)); if(alongX) b.rotation.z=th*dx; else b.rotation.x=-th*dz; b.castShadow=true; scene.add(b); }
  if(posts){ for(let k=3;k<steps;k+=3){ const px=x0+dx*GAP*k, pz=z0+dz*GAP*k, h=RISE*k+0.2;
      for(const s of [-1,1]){ const p=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.12,h,7), envWood); p.position.set(px+(alongX?0:s*0.86), h/2, pz+(alongX?s*0.86:0)); p.castShadow=true; scene.add(p); } } }
  return { x:x0+dx*GAP*(steps-1), z:z0+dz*GAP*(steps-1), top:RISE*(steps-1)+H };   // a legfelső lépcső teteje
}
// A-kilátó: rámpa (26,9)->(19,9) felfelé, majd fedélzet (18,9) tető=4.1
rampUp(27, 9, -1, 0, 9, woodMat, true);   // FIX: 9 lépcső 27-ről -> a felső lépcsők (3.65 @ x20, 4.1 @ x19) a deck PLAYER_R-falzónáján KÍVÜL/átfedésben vannak, így nem akad el a deck előtt
const DECK_A = climbStruct(18, GROUND_Y+3.6, 9, 3.4, 0.5, 3.4, woodMat);   // tető 4.1 (a 9. lépcső teteje már 4.1 -> sík átlépés a deckre)
// B-kilátó: rámpa (8,26)->(8,19) felfelé, majd fedélzet (8,18) tető=4.1
rampUp(8, 27, 0, -1, 9, woodMat, true);   // FIX: ld. DECK_A — 9 lépcső 27-ről, hogy a deck előtt ne akadjon el
const DECK_B = climbStruct(8, GROUND_Y+3.6, 18, 3.4, 0.5, 3.4, woodMat);
// KÖTÉL-PALLÓ FÜGGŐHÍD-ÉPÍTŐ: belógó oldalkötelek + korlát + keresztpallók + tartókötelek + végoszlopok.
// A járható ütközés a pallók alatt enyhén belóg (STEP-tűréssel végigsétálható), a látvány egy igazi rope-bridge.
// Lejtős hidat is tud (atop != btop) — a belógás a fesztávval nő, a palló-lépcsők STEP alatt maradnak.
const plankMat=std({color:0x835a32, roughness:.82, bumpMap:SKIN_N, bumpScale:0.015});   // meleg palló-fa
const ropeMat =std({color:0x5e4326, roughness:.96});      // sodrott kötél
const postMat =std({color:0x6e4a2c, roughness:.9});       // végoszlop / tartóláb
function buildRopeBridge(ax,az,atop, bx,bz,btop){
  // PEREM-HORGONY: a hívó a fedélzet-KÖZÉPPONTOKAT adja át, de a híd minden eleme (palló, kötél,
  // végoszlop) a fedélzet SZÉLÉNÉL horgonyzik (E behúzás) -> a kötelek az oszlopoknál érnek véget,
  // és semmi nem lóg át a fedélzet fölött / nem végződik a levegőben.
  { const fx=bx-ax, fz=bz-az, fs=Math.hypot(fx,fz), E=1.55;
    ax+=fx/fs*E; az+=fz/fs*E; bx-=fx/fs*E; bz-=fz/fs*E; }
  const dxb=bx-ax, dzb=bz-az, span=Math.hypot(dxb,dzb);
  const ux=dxb/span, uz=dzb/span, qx=-uz, qz=ux;           // hossz- és keresztirány
  const yaw=Math.atan2(ux,uz);                              // pallók forgatása a hossztengelyre
  const HALF=1.05, SAG=Math.max(0.42, span*0.031), N=Math.max(9, Math.round(span/1.05));   // fél-szélesség, belógás, palló-szám
  const yAt=(t)=> atop+(btop-atop)*t - Math.sin(Math.PI*t)*SAG;   // lineáris lejtés + katenár-belógás (0 a végeken)
  const SEG=Math.max(14, Math.round(span*0.55));            // kötél-mintavétel a fesztávhoz igazítva
  const PLK=roundBox(HALF*2+0.1,0.12,0.46,0.03);
  const tubeFromPts=(pts,r,mat)=>{ const c=new THREE.CatmullRomCurve3(pts); const t=new THREE.Mesh(new THREE.TubeGeometry(c,Math.max(22,SEG*2),r,5,false),mat); t.castShadow=true; scene.add(t); };
  // 1) KERESZTPALLÓK + collision (keskeny lécek réssel, a belógást követve)
  for(let k=0;k<N;k++){ const t=(k+0.5)/N, cx=ax+dxb*t, cz=az+dzb*t, cy=yAt(t);
    const plank=mesh(PLK, envWood, cx, cy-0.06, cz); plank.rotation.y=yaw+rand(-0.05,0.05); plank.rotation.z=rand(-0.035,0.035); scene.add(plank);   // léc KERESZTBEN (szélesség=kereszt, mélység=0.46 a járásirányban)
    solidBox(cx, cz, 0.95, 0.95, {climb:true, top:cy, bottom:GROUND_Y+2.6, mob:true, abot:cy-0.3});   // abot: a NYÍL csak a palló vastagságában áll meg (alatta szabadon elrepül — nincs láthatatlan fal)   // ÁTFEDŐ négyzet-ütközők -> folytonos járófelület a diagonális hídon (nincs rés); bottom>=OVERHEAD -> a trollok ALATTA átmennek
  }
  // 2) OLDALKÖTELEK: deck-szintű (a pallók pereme) + korlát (járószint+0.95), mindkét oldalon, belógással
  for(let s=-1;s<=1;s+=2){ for(const lvl of [0.0,0.95]){ const pts=[];
    for(let i=0;i<=SEG;i++){ const t=i/SEG; pts.push(new THREE.Vector3(ax+dxb*t+qx*s*HALF, yAt(t)+lvl, az+dzb*t+qz*s*HALF)); }
    tubeFromPts(pts, lvl>0?0.035:0.05, ropeMat); } }
  // 3) FÜGGŐLEGES TARTÓKÖTELEK (korlát -> palló) néhány osztásnál
  for(let s=-1;s<=1;s+=2){ for(let k=1;k<N;k+=2){ const t=k/N, bxp=ax+dxb*t+qx*s*HALF, bzp=az+dzb*t+qz*s*HALF, yb=yAt(t);
    tubeFromPts([new THREE.Vector3(bxp,yb,bzp), new THREE.Vector3(bxp,yb+0.95,bzp)], 0.025, ropeMat); } }
  // 4) VÉGOSZLOPOK a két fedélzeten (a korlát-kötelek lehorgonyzása)
  for(const D of [{x:ax,z:az,top:atop},{x:bx,z:bz,top:btop}]){ for(let s=-1;s<=1;s+=2){ const cx=D.x+qx*s*HALF, cz=D.z+qz*s*HALF;
    const post=mesh(new THREE.CylinderGeometry(0.085,0.11,1.6,9), envWood, cx, D.top+0.4, cz); scene.add(post);
    post.add(mesh(new THREE.SphereGeometry(0.13,10,8), envWood, 0,0.85,0)); } }
  // 5) KORLÁT-ÜTKÖZŐ (láthatatlan, collision-only): sűrű poszt-sor a két él mentén, a látható korlátnál picit kijjebb,
  //    hogy a tested a kötélnél fogjon meg -> nem esel le, bátran szaladhatsz/lőhetsz. NEM mászható (groundAt kihagyja -> nem állsz rá),
  //    bottom>=OVERHEAD -> a magas híd ALATT a játékos/troll szabadon átmegy a talajon.
  { const RAIL=HALF+0.15, M=Math.max(20, Math.round(span*1.6)); for(let s=-1;s<=1;s+=2){ for(let i=0;i<=M;i++){ const t=0.03+0.94*(i/M);
    solidCyl(ax+dxb*t+qx*s*RAIL, az+dzb*t+qz*s*RAIL, 0.18, {top:Math.max(atop,btop)+1.5, bottom:GROUND_Y+2.6, noArrow:true}); } } }   // láthatatlan korlát: csak a játékost tartja, a nyilat nem
}
buildRopeBridge(18,9,GROUND_Y+4.1, 8,18,GROUND_Y+4.1);   // A<->B kilátóhíd (az eredeti lombhíd)

// === ÓRIÁSFÁK + LOMBHÁZ-HÁLÓZAT — 4 hatalmas fa magas fedélzettel, felfutó palló-rámpával, kötélhidakkal összekötve ===
// A "mocsaras action-játék" vertikalitás: földi rámpa -> 7.7-es lombház-fedélzet -> hidak a fák és a kilátók között.
const GIANT_KIT={ trunk:makeTrunkGeo(77.7,17,1.25), can:makeCanopy(53.1, 10, 2.9, 16.4, 3.7, GEO_DETAIL) };
function giantTree(x,z){
  const g=new THREE.Group(); g.position.set(x,GROUND_Y,z); g.rotation.y=rand(0,6.283);
  // sodort, tőben szétterülő óriás-törzs ágakkal + gyökerekkel; puha, levél-kártyás lombkorona magasan
  const trunk=new THREE.Mesh(GIANT_KIT.trunk, envBark); trunk.castShadow=true; trunk.receiveShadow=true; g.add(trunk);
  const canopy=new THREE.Mesh(GIANT_KIT.can.puff, canopyMat); canopy.castShadow=true; canopy.receiveShadow=true; g.add(canopy);
  const cards=new THREE.Mesh(GIANT_KIT.can.cards, leafCardMat); cards.castShadow=false; g.add(cards);
  treeCasters.push(canopy);
  scene.add(g); contactBlob(x,z,5.2);
  solidCyl(x, z, 1.9, {mob:true});                                        // vaskos törzs-ütköző (teljes magasság)
  flammables.push({x:x, z:z, r:1.9, g:g, onFire:false, zone:null});       // ELEM-ENV: az óriásfa is gyújtható
  return g;
}
// lombház: óriásfa + oldalára rakott fedélzet (tető 7.7) + hosszú felfutó rámpa a fedélzet-tengelyre merőlegesen.
// (dx,dz) a rámpa iránya; a fedélzet oldalirányban (n = side*(-dz,dx)) 2.9-re a törzstől -> a rámpa a törzs MELLETT fut el.
// side (+1/-1): melyik merőleges oldalra kerüljön a fedélzet — így a rámpa és a kifutó híd NEM keresztezheti egymást.
function treehouse(x,z,dx,dz,side){
  giantTree(x,z);
  side=side||1;
  const nx=-dz*side, nz=dx*side, dcx=x+nx*2.9, dcz=z+nz*2.9;
  climbStruct(dcx, GROUND_Y+7.2, dcz, 3.6, 0.5, 3.6, woodMat);            // fedélzet, tető=7.7 == a rámpa legfelső pallójával -> SIMA átlépés
  const dp=mesh(new THREE.CylinderGeometry(0.3,0.42,7.2,10), envWood, dcx, GROUND_Y+3.6, dcz); contactBlob(dcx,dcz,1.2);
  dp.castShadow=true; scene.add(dp);
  solidCyl(dcx, dcz, 0.35, {top:GROUND_Y+7.15, climb:true, mob:true});    // fedélzet-tartóoszlop — climb: a fedélzeten állva (feet>=top-STEP) NEM blokkol oldalról; a földről (feet 0) fal marad
  // 17-palló rámpa: teteje 7.7 == fedélzet-tető -> sík átlépés; RISE=0.45<=STEP -> VÉGIGFUTHATÓ, nem akaszt lépcsőfok
  const r0x=dcx-dx*17, r0z=dcz-dz*17;
  rampUp(r0x, r0z, dx, dz, 17, woodMat);
  // tartólábak minden 4. pallónál — tetejük a palló ALJA alá limitálva, így a felfutást nem akasztják meg
  for(let k=3;k<17;k+=4){ const px=r0x+dx*k, pz=r0z+dz*k, h=0.45*k;
    const p=mesh(new THREE.CylinderGeometry(0.13,0.18,h,8), envWood, px, GROUND_Y+h/2, pz);
    p.castShadow=true; scene.add(p);
    solidCyl(px, pz, 0.22, {top:GROUND_Y+h-0.05, climb:true, mob:true}); }   // climb: a rámpán felfelé (feet a palló tetején > oszlop-tető-STEP) nem akaszt; a földről fal
  return {x:dcx, z:dcz, top:GROUND_Y+7.7};
}
const TH1=treehouse( 40, -8,  0, 1);   // kelet — fedélzet (37.1,-8), rámpa délről (z -25 -> -9)
const TH2=treehouse( 24,-24,  1, 0);   // délkelet — fedélzet (24,-21.1), rámpa nyugatról (x 7 -> 23)
const TH3=treehouse(-34,-18,  0,1,-1); // délnyugat — fedélzet (-31.1,-18), rámpa DÉLRŐL (z -35 -> -19): a TH4-híd északra indul, így nem keresztezik egymást
const TH4=treehouse(-20, 24, -1, 0);   // északnyugat — fedélzet (-20,21.1), rámpa keletről (x -3 -> -19)
buildRopeBridge(TH2.x,TH2.z,TH2.top, TH1.x,TH1.z,TH1.top);      // TH2 <-> TH1
buildRopeBridge(TH1.x,TH1.z,TH1.top, 18,9,GROUND_Y+4.1);        // TH1 <-> A-kilátó (LEJTŐS híd 7.8 -> 4.1)
buildRopeBridge(TH3.x,TH3.z,TH3.top, TH4.x,TH4.z,TH4.top);      // TH3 <-> TH4 (hosszú nyugati átkelő)
// hero-landmark testek (csak az arénán belüliek; pozíciók a buildLandmarks placement-jeiből)
solidCyl(11.555, 7.905, 1.55, {});      // oldWell
solidCyl(-7.329, 8.203, 0.95, {});      // cairnShrine
solidCyl(-15.971, -15.131, 1.6, {});    // brokenPillars #1
solidCyl(3.73, -19.649, 1.6, {});       // brokenPillars #2
solidCyl(-13.85, 10.49, 1.0, {});       // fallenTree rönk-szegmens
solidCyl(-16.27, 7.69, 1.0, {});        // fallenTree rönk (közép)
solidCyl(-18.69, 4.89, 1.0, {});        // fallenTree rönk-szegmens
solidCyl(-12.61, 11.93, 1.8, {});       // fallenTree gyökérlabda

// === FÁZIS 5: BARLANGOK — troll-spawnpontok az aréna peremén. Tömör (a JÁTÉKOS nem mehet be), de mob NÉLKÜL -> a trollok kisétálnak. ===
const envRockDark=applyStylized(std({color:0x555c6c,roughness:.97,vertexColors:true,emissive:0x10151f,emissiveIntensity:0.5}),'rock');
const CAVE_GEO=makeRockGeo(88.8, GEO_DETAIL, 11);
function buildCave(c){
  const g=new THREE.Group(); g.position.set(c.x, GROUND_Y, c.z); g.rotation.y=Math.atan2(-c.x,-c.z);   // a száj a központ felé néz (local +z)
  const rk=(geo,x,y,z,sx,sy,sz,ry)=>{ const m=new THREE.Mesh(geo,envRockDark); m.position.set(x,y,z); m.scale.set(sx,sy,sz); m.rotation.y=ry||0; m.castShadow=true; m.receiveShadow=true; g.add(m); };
  rk(CAVE_GEO, 0,1.15,-0.1, 3.1,2.9,3.0, rand(0,6.28));                                   // fő szikla-tömb
  g.add(mesh(new THREE.SphereGeometry(1.3,20,14), caveMouthMat, 0,1.05,1.75, 1,1.15,1.05));   // fekete üreg-száj (nem látni be)
  rk(ROCK_GEOS[2], -1.75,0.75,1.5, 1.0,1.55,0.95, 0.4); rk(ROCK_GEOS[4], 1.75,0.8,1.5, 1.0,1.65,0.95, 2.2); rk(ROCK_GEOS[0], 0,2.45,1.35, 1.9,0.7,1.0, 1.1);   // száj-keret: két oldalkő + szemöldök
  rk(ROCK_GEOS[3], -2.9,0.45,0.9, 0.8,0.7,0.8, 3.0); rk(ROCK_GEOS[5], 2.8,0.4,1.1, 0.7,0.6,0.75, 5.0);
  scene.add(g); contactBlob(c.x,c.z,5.0);
  solidCyl(c.x, c.z, 1.9, {top:GROUND_Y+2.8});   // PLAYER-fal (nincs climb -> nem mászható; nincs mob -> a trollok átsétálnak)
}
for(const c of CAVES) buildCave(c);
// landmarkok + parázstartók talaj-kontakt foltjai, majd az összes folt EGY instanced mesh-be
[[11.55,7.9,2.6],[-7.3,8.2,1.9],[-15.9,-15.2,3.2],[3.7,-19.6,3.2],[-13.85,10.49,2.2],[-16.27,7.69,2.2],[-18.69,4.89,2.2],[-12.61,11.93,2.8]].forEach(b=>contactBlob(b[0],b[1],b[2]));
for(const b of braziers) contactBlob(b.x,b.z,1.3);
buildContactBlobs();
_treeCastRef=treeCasters; syncTreeShadows();


