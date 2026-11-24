/* ===================== Aréna / díszlet ===================== */
applyStylized(groundMat,'ground');
const groundGeo=new THREE.CircleGeometry(64,96);
groundGeo.rotateX(-Math.PI/2);   // forgatás a geometriába égetve, hogy a radialTint világ-XZ-ben dolgozzon
radialTint(groundGeo, 0xffffff, 0xb4c0b4, 64);                       // világos mohás közép -> hűvös-sötét perem
mottleTint(groundGeo, [0x33503a,0x2b4531,0x4a6b41,0x4d3d2a], 0.72);  // moha/föld foltok (a repeatelt textúra-monotónia ellen)
const ground=new THREE.Mesh(groundGeo, groundMat);
ground.position.y=GROUND_Y; ground.receiveShadow=true;
scene.add(ground);
MOSS_T.repeat.set(6,6);   // (a talaj már a GROUND_T-t használja) kevésbé sűrű ismétlés — a folt-vertexszínek adják a változatosságot
// középső kő-emelvény
/* ===== EDIT C — central altar (replaces ARENA_R-sized dais). REPLACE lines 224-225 =====
   Compact fixed-radius cairn so it does NOT balloon with ARENA_R; <0.6 high so walkable.
   Adds the cyan rune torus as the spawn-point landmark. */
// GENERÁLT MODELLEK (src/assets/props): ha a GLB megvan, a 07-troll-idol.js tölti be helyettük; nélküle a régi, kódból épített változat
const GEN_PROP=n=>!!(window.GAME_ASSETS && window.GAME_ASSETS[n]);
if(!GEN_PROP('altarDais')){
  const dais=new THREE.Mesh(vcolAttr(jitter(new THREE.CylinderGeometry(3.4,4.2,0.55,40,2),0.10,0.05),()=>[0.62,0.62,0.66]), envRock);   // AA-indie: festett, mohás kő-emelvény
  dais.position.y=-0.18; dais.receiveShadow=true; dais.castShadow=true; scene.add(dais);
}
const altarRune=mesh(new THREE.TorusGeometry(2.4,0.10,6,32),
  new THREE.MeshStandardMaterial({color:0x16414f,emissive:0x36c5ff,emissiveIntensity:1.1,roughness:.6,flatShading:false}),
  0,0.12,0);
altarRune.rotation.x=-Math.PI/2; altarRune.receiveShadow=true; scene.add(altarRune);

/* ===== EDIT C2 — terrain shape + walkable paths. INSERT immediately AFTER the altarRune block (after old line 225) =====
   (1) Rolling jittered "bog skirt" UNDER + outside the play area — vertical variety in the
       silhouette toward the treeline WITHOUT lifting the flat walk plane (it sits at y=-0.15,
       below GROUND_Y=0, so the player never stands on its jittered verts).
   (2) Flagstone worn paths: 4 flat inlaid discs radiating to the stone-circle gaps,
       flush at y=GROUND_Y+0.005 — decorative, walkable, no collision. */
const bogMossMat=std({color:0x2d4a36,roughness:1,map:MOSS_T,bumpMap:MOSS_T,bumpScale:0.09,vertexColors:true});
const skirtGeo=new THREE.CircleGeometry(150,128);
// VALÓDI függőleges hullámzás a játéktéren KÍVÜL (r>40): a lokális Z a forgatás után világ-Y.
// Sugár-kapuzva, hogy az arénán belül a sík talaj alatt maradjon.
{ const p=skirtGeo.attributes.position;
  for(let i=0;i<p.count;i++){ const r=Math.hypot(p.getX(i),p.getY(i));
    if(r>62) p.setZ(i, rand(-0.7,1.5)*Math.min(1,(r-62)/30)); }
  skirtGeo.computeVertexNormals(); }
gradTint(skirtGeo, 0x5f7663, 0xffffff, -0.7, 1.4, undefined, 'z');   // mélyedések sötétebbek — "nedves láp" mélységjel
const bogSkirt=new THREE.Mesh(skirtGeo, bogMossMat);
bogSkirt.rotation.x=-Math.PI/2; bogSkirt.position.y=-0.15; bogSkirt.receiveShadow=true; bogSkirt.renderOrder=-1;
// (a régi láp-szoknyát a dombos külső táj váltotta — lásd hillH)
/* kitaposott ösvények lépőkövei: a talaj-shader föld-sávjaiba süllyesztett lapos, vésett kövek (1 drawcall) */
(function(){ const N=44, im=new THREE.InstancedMesh(ROCK_GEOS[1], envRock, N), m=new THREE.Matrix4(), q=new THREE.Quaternion(), s=new THREE.Vector3(), p=new THREE.Vector3(), e=new THREE.Euler(); let i=0;
  for(let k=0;k<4;k++){ const ang=k*Math.PI/2+Math.PI/4; for(let j=0;j<11;j++){ const d=6.5+j*4.2+rand(-0.8,0.8), w=rand(0.55,1.0);
      p.set(Math.cos(ang)*d+rand(-0.9,0.9), GROUND_Y-0.02, Math.sin(ang)*d+rand(-0.9,0.9)); e.set(0,rand(0,6.28),0); q.setFromEuler(e); s.set(w,0.16,w*rand(0.8,1.2)); m.compose(p,q,s); im.setMatrixAt(i++,m); } }
  im.instanceMatrix.needsUpdate=true; im.receiveShadow=true; im.castShadow=false; im.frustumCulled=false; scene.add(im); })();
/* dombos külső táj a sziklafalon túl: lágy, zaj-alapú hullámzás (a fák/sziklák a hillH() magasságára ülnek) */
function hillH(x,z){ const r=Math.hypot(x,z); if(r<64) return 0; const k=clamp((r-64)/40,0,1); return k*k*(3-2*k)*(0.8+6.2*fbm3(x*0.028+3.1,0.5,z*0.028+7.7,3)); }
(function(){ const g=new THREE.RingGeometry(62.5,215,140,16); g.rotateX(-Math.PI/2); const p=g.attributes.position;
  for(let i=0;i<p.count;i++) p.setY(i, hillH(p.getX(i),p.getZ(i))-0.05);
  g.computeVertexNormals(); vcolAttr(g,(x,y,z)=>{ const k=0.62+0.05*y; return [k,k,k]; });
  { const uv=g.attributes.uv; for(let i=0;i<p.count;i++) uv.setXY(i, p.getX(i)/128+0.5, p.getZ(i)/128+0.5); }   // a belső talajjal azonos textúra-lépték
  const m=new THREE.Mesh(g, groundMat); m.receiveShadow=false; m.frustumCulled=false; scene.add(m); })();

let flammables=[];   // ELEM-ENV: gyúlékony fák (tűz-zóna gyújtja/terjed); korán deklarálva, mert a tree() a világ-építésnél hívódik
function tree(x,z,s){
  s=s||1; const r=Math.hypot(x,z), y=GROUND_Y+hillH(x,z), far=r>BOUND_R+6;
  const g=new THREE.Group(); g.position.set(x,y-(far?0.25:0),z); g.rotation.y=rand(0,6.283);
  const cast=r<BOUND_R-2;   // TELJESÍTMÉNY: csak a tisztáson belüli fák vetnek árnyékot
  if(Math.random()<(far?0.62:(r>BOUND_R?0.28:0.10))){   // FENYŐ: főleg a peremen túl (változatos erdő-sziluett)
    g.scale.set(s*rand(0.95,1.2), s*rand(1.15,1.5), s*rand(0.95,1.2));
    const c=new THREE.Mesh(pickGeo(CONIFER_GEOS), coniferMat); c.castShadow=cast; c.receiveShadow=true; g.add(c); if(cast) treeCasters.push(c);
  } else {
    g.scale.set(s, s*rand(0.92,1.12), s);
    const K=pickGeo(TREE_KIT);
    const trunk=new THREE.Mesh(K.trunk, envBark); trunk.castShadow=cast; trunk.receiveShadow=true; g.add(trunk);
    const canopy=new THREE.Mesh(K.can.puff, canopyMat); canopy.castShadow=cast; canopy.receiveShadow=true; g.add(canopy);
    if(!far || r<90){ const cards=new THREE.Mesh(K.can.cards, leafCardMat); cards.castShadow=false; cards.receiveShadow=false; cards.layers.set(NOBLOOM_LAYER); g.add(cards); }
    if(cast) treeCasters.push(trunk,canopy);
  }
  scene.add(g);
  if(r<BOUND_R+4) contactBlob(x,z,1.5*s);
  // ÜTKÖZŐ: változatlan lábnyom (a törzs ~0.5 sugarú a tövénél)
  solidCyl(x, z, 0.55*s, {mob:true});
  flammables.push({x:x, z:z, r:0.55*s, g:g, onFire:false, zone:null});   // ELEM-ENV: a tűz felgyújthatja
  return g;
}
const ROCK_SPOTS=[];   // generált mohás kő esetén csak a helyeket gyűjtjük; a 07-troll-idol.js egy instanced hálóba rakja őket
function rock(x,z,r){
  const sy=r*rand(0.95,1.25), sx=r*rand(1.05,1.3), sz=r*rand(1.05,1.3), ry=rand(0,6.283), y=GROUND_Y+hillH(x,z);
  let m=null;
  if(GEN_PROP('mossRock')) ROCK_SPOTS.push({x, y:y+sy*0.5-0.06, z, sx, sy, sz, ry});   // ugyanaz a hely/méret, mint a kódból épített kőé
  else { m=new THREE.Mesh(pickGeo(ROCK_GEOS), envRock); m.scale.set(sx, sy, sz); m.position.set(x, y+sy*0.5-0.06, z); m.rotation.y=ry;
    m.castShadow=true; m.receiveShadow=true; scene.add(m); }
  if(Math.hypot(x,z)<BOUND_R+4) contactBlob(x,z,r*1.9);
  // ÜTKÖZŐ: MINDEN kő mászható-tetőként regisztrál (rá lehet ugrani, ha eléred a tetejét), és átmenni egyiken sem lehet (mob)
  solidCyl(x, z, r*0.9, {top:GROUND_Y+r*0.78, climb:true, mob:true});
  return m; }
const swayers=[];
const MUSH_STEM=(function(){ const g=new THREE.CylinderGeometry(0.075,0.12,0.44,12,4,true), p=g.attributes.position; for(let i=0;i<p.count;i++){ const y=p.getY(i), t=(y+0.22)/0.44; p.setX(i,p.getX(i)*(1+0.18*Math.sin(t*3.1))+0.03*t*t); p.setZ(i,p.getZ(i)*(1+0.18*Math.sin(t*3.1))); } p.needsUpdate=true; g.translate(0,0.22,0); g.computeVertexNormals(); return g; })();
const MUSH_CAP=(function(){ const g=new THREE.SphereGeometry(0.3,22,10,0,6.28,0,Math.PI/2), p=g.attributes.position;   // perem enyhén lekunkorodik
  for(let i=0;i<p.count;i++){ const y=p.getY(i); if(y<0.06){ const k=1-y/0.06; p.setY(i,y-0.035*k); } } g.computeVertexNormals();
  vcolAttr(g,(x,y,z)=>{ const spot=vnoise3(x*14+3,y*14,z*14)>0.7 && y>0.05; return spot?[1.0,0.97,0.9]:[0.77,0.27,0.24]; }); return g; })();
const capMatV=std({color:0xffffff,roughness:.6,vertexColors:true});
function mushroom(x,z,sc,glow){ const g=new THREE.Group(); g.position.set(x,GROUND_Y,z); g.scale.setScalar(sc);
  g.add(mesh(MUSH_STEM, glow?std({color:0xbfe8ef}):stemMat,0,0,0));
  { const cap=mesh(MUSH_CAP, glow?glowCapM:capMatV,0.03,0.42,0,1,0.72,1); cap.rotation.z=rand(-0.15,0.15); g.add(cap); if(glow) enableBloom(cap); }
  if(glow){ const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0x7fe2ff,transparent:true,opacity:0.5,depthWrite:false}));
    sp.scale.setScalar(0.9); sp.position.y=0.5; g.add(sp); enableBloom(sp); }
  g.userData.phase=Math.random()*6.28; swayers.push(g); scene.add(g); }

  /* ---- megalit kőkör (henge) az aréna peremén: vésett, felfelé keskenyedő menhirek körben ---- */
  /* Az upright kövek a BOUND_R-en kívül, sűrűn körben. Mindegyik álló kő ütközőt kap, így a perem fizikailag is zárt. */
  const N_STONE=34, RING=BOUND_R+3.0; const STONE=makeMenhirGeo(4.2, 1.7,5.6,1.15);
  const stoneIM=new THREE.InstancedMesh(STONE, envRock, N_STONE); stoneIM.castShadow=true; stoneIM.receiveShadow=true;
  const _sm=new THREE.Matrix4(), _sq=new THREE.Quaternion(), _ss=new THREE.Vector3(), _sp=new THREE.Vector3(), _se=new THREE.Euler();
  for(let i=0;i<N_STONE;i++){ const a=(i/N_STONE)*6.283 + rand(-0.04,0.04), r=RING+rand(-0.6,1.2); const fallen=Math.random()<0.12; const h=rand(0.95,1.35);
    _se.set(fallen?Math.PI/2*rand(.7,1):(Math.random()-0.5)*0.10, a+rand(-0.2,0.2)+Math.PI/2, (Math.random()-0.5)*0.12);
    _sp.set(Math.cos(a)*r, fallen?0.5:2.4*h, Math.sin(a)*r); _sq.setFromEuler(_se); _ss.set(rand(0.95,1.4),h,rand(0.95,1.4));
    _sm.compose(_sp,_sq,_ss); stoneIM.setMatrixAt(i,_sm); contactBlob(Math.cos(a)*r,Math.sin(a)*r,2.2);
    // ütköző csak az álló köveknek (a ledőltek lapos díszek); cyl a hengeres lábnyomra
    if(!fallen) solidCyl(Math.cos(a)*r, Math.sin(a)*r, 0.95); }
  stoneIM.instanceMatrix.needsUpdate=true; scene.add(stoneIM);
  /* ---- folytonos MOHÁS SZIKLAFAL-gyűrű a kövek mögött: nagy vésett sziklák (a moha-tetőt a kő-shader adja) ---- */
  const N_WALL=60, WALLR=BOUND_R+6.0;
  const WALLG=makeRockGeo(41.3, GEO_DETAIL, 12);
  const wallIM=new THREE.InstancedMesh(WALLG, envRock, N_WALL); wallIM.castShadow=true; wallIM.receiveShadow=true;
  const _wm=new THREE.Matrix4(), _wq=new THREE.Quaternion(), _wp=new THREE.Vector3(), _we=new THREE.Euler(), _wsv=new THREE.Vector3();
  for(let i=0;i<N_WALL;i++){ const a=(i/N_WALL)*6.283 + rand(-0.02,0.02), r=WALLR+rand(-1.2,1.2), sc=rand(3.3,5.2);
    _we.set(rand(-0.25,0.25),rand(0,6.28),rand(-0.25,0.25)); _wq.setFromEuler(_we);
    _wp.set(Math.cos(a)*r, GROUND_Y+sc*rand(0.28,0.5), Math.sin(a)*r); _wsv.set(sc,sc*rand(1.0,1.5),sc);
    _wm.compose(_wp,_wq,_wsv); wallIM.setMatrixAt(i,_wm); }
  wallIM.instanceMatrix.needsUpdate=true; scene.add(wallIM);

