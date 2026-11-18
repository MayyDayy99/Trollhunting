/* ===================== LÁTVÁNY-TURBÓ: KÖRNYEZET =====================
   Távoli hegylánc (mélység), sodródó talajköd-foszlányok, hold-fénypászmák, meleg fényű parázstartók a tisztás
   közepén (hideg hold <-> meleg tűz színkontraszt), pulzáló rúna-kör az oltáron. Minden olcsó: nincs új shader-pass,
   a nem-izzó áttetsző rétegek a NOBLOOM_LAYER-en vannak (a bloom-passban ki sem rajzolódnak). */
const envLinear=(hex)=>new THREE.Color(hex).convertSRGBToLinear();
/* Rétegzett hegyvonulatok (papírkivágás-szerű sziluett-rétegek, távolodva egyre halványabb = légköri perspektíva)
   + a peremerdő fenyő-csúcsos sziluettje. Sima zaj-gerinc a szögletes kúpok helyett; mind fog/tone-map nélküli síkszín. */
function ridgeRing(R, yBot, hFn, cTop, cBot, N){
  const pos=[], col=[], T=envLinear(cTop), B=envLinear(cBot);
  for(let i=0;i<N;i++){ const a0=i/N*6.283185, a1=(i+1)/N*6.283185, h0=hFn(a0,i), h1=hFn(a1,i+1), x0=Math.cos(a0)*R, z0=Math.sin(a0)*R, x1=Math.cos(a1)*R, z1=Math.sin(a1)*R;
    pos.push(x0,yBot,z0, x1,yBot,z1, x1,h1,z1,  x0,yBot,z0, x1,h1,z1, x0,h0,z0);
    col.push(B.r,B.g,B.b, B.r,B.g,B.b, T.r,T.g,T.b,  B.r,B.g,B.b, T.r,T.g,T.b, T.r,T.g,T.b); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,fog:false,toneMapped:false,side:THREE.DoubleSide})); m.frustumCulled=false; m.matrixAutoUpdate=false; return m;
}
(function farRidges(){
  const ridge=(seed,freq,h0,amp)=>(a)=>{ const x=Math.cos(a)*freq+seed, z=Math.sin(a)*freq; let n=fbm3(x,seed*0.37,z,4), n2=fbm3(x*2.7,1.3,z*2.7,3); n=1-Math.abs(n*2-1); return h0+amp*Math.pow(n,1.5)+amp*0.22*n2; };
  const far=ridgeRing(305,-14, ridge(3.1,2.4,34,92), 0x304c78, 0x1f3556, 900); far.renderOrder=-6; scene.add(far);
  const mid=ridgeRing(268,-14, ridge(9.7,3.1,20,60), 0x213a60, 0x1b2f4e, 900); mid.renderOrder=-5.5; scene.add(mid);
  const near=ridgeRing(232,-14, ridge(17.3,4.2,11,36), 0x152a48, 0x172a46, 900); near.renderOrder=-5.2; scene.add(near);
})();
(function treelineSilhouette(){
  const hF=(a,i)=>{ const tw=1-Math.abs(((i/5)%1)*2-1), id=Math.floor(i/5); return 10+6*fbm3(Math.cos(a)*5,2.2,Math.sin(a)*5,2)+8.5*Math.pow(tw,1.35)*(0.55+0.45*_h3(id,1.1,2.2)); };
  const m=ridgeRing(152,-3, hF, 0x0a1626, 0x0d1b2e, 1700); m.renderOrder=-5; scene.add(m);
})();

/* --- sodródó talajköd: nagy, lapos, lágy sprite-ok; a kamera közelében kihalványulnak (nem "csapnak arcon") --- */
const mistWisps=[];
(function(){ const N=MOBILE_INPUT?10:24;
  for(let i=0;i<N;i++){ const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0x86a6cf,transparent:true,opacity:0,depthWrite:false}));
    const w=rand(15,30); sp.scale.set(w,rand(2.6,4.6),1); sp.layers.set(NOBLOOM_LAYER);
    const o={s:sp, a:rand(0,6.283), r:rand(10,ARENA_R+14), y:rand(0.7,1.9), sp:rand(0.006,0.02)*(Math.random()<0.5?-1:1), base:rand(0.05,0.105), ph:rand(0,6.28)};
    mistWisps.push(o); scene.add(sp); } })();

/* --- hold-fénypászmák: a hold irányából a tisztásra dőlő, tengely-billboard additív sávok --- */
const moonShafts=[];
(function(){
  const c=document.createElement('canvas'); c.width=64; c.height=256; const x=c.getContext('2d'), im=x.createImageData(64,256);
  for(let j=0;j<256;j++) for(let i=0;i<64;i++){ const u=Math.abs(i/63-0.5)*2, v=j/255;
    const a=Math.pow(1-u,2.2)*Math.sin(Math.min(1,v*1.6)*Math.PI*0.5)*Math.pow(1-v,0.35); const k=(j*64+i)*4; im.data[k]=im.data[k+1]=im.data[k+2]=255; im.data[k+3]=Math.round(255*a); }
  x.putImageData(im,0,0); const tex=new THREE.CanvasTexture(c);
  const az=Math.atan2(MOON_DIR.z,MOON_DIR.x);
  for(let i=0;i<(MOBILE_INPUT?3:6);i++){ const a=az+rand(-0.55,0.55), r=rand(14,44), len=rand(46,70), wd=rand(3.5,7.5);
    const m=new THREE.Mesh(new THREE.PlaneGeometry(wd,len), new THREE.MeshBasicMaterial({map:tex,color:0x9fc4ff,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}));
    m.layers.set(NOBLOOM_LAYER); m.matrixAutoUpdate=false; m.frustumCulled=false;
    const foot=new THREE.Vector3(Math.cos(a)*r,-1,Math.sin(a)*r);
    moonShafts.push({m, c:foot.clone().addScaledVector(MOON_DIR,len*0.5), base:rand(0.035,0.07), ph:rand(0,6.28)}); scene.add(m); } })();

/* --- parázstartók (4 db az oltár körül) + EGY meleg, pislákoló pontfény a tisztás közepén --- */
const braziers=[];
const hearthLight=new THREE.PointLight(0xff9448, 0.9, 36, 2); hearthLight.position.set(0,4.6,0); scene.add(hearthLight);
(function(){
  const flameMatA=new THREE.MeshBasicMaterial({color:0xff6a1e,transparent:true,opacity:0.7,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});
  const flameMatB=new THREE.MeshBasicMaterial({color:0xffa838,transparent:true,opacity:0.7,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});
  const coalMat=new THREE.MeshStandardMaterial({color:0x2a140a,emissive:0xff5a1a,emissiveIntensity:1.6,roughness:.9,flatShading:false});
  const ironMat=std({color:0x23262e,roughness:.55,metalness:.6});
  const FL=new THREE.ConeGeometry(0.2,0.75,6,1); FL.translate(0,0.375,0);
  for(let i=0;i<4;i++){ const a=0.39+i*Math.PI/2, x=Math.cos(a)*8.0, z=Math.sin(a)*8.0;
    const g=new THREE.Group(); g.position.set(x,GROUND_Y,z); g.rotation.y=rand(0,6.28);
    const ped=jitter(new THREE.CylinderGeometry(0.26,0.44,1.0,7,2),0.07,0.04); gradTint(ped,0x6a7080,0xffffff,-0.5,0.5);
    const pm=new THREE.Mesh(ped,envRock); pm.position.y=0.5; pm.castShadow=true; pm.receiveShadow=true; g.add(pm);
    const bowl=mesh(new THREE.CylinderGeometry(0.58,0.30,0.30,8,1), ironMat, 0,1.13,0); g.add(bowl);
    const coals=mesh(new THREE.CylinderGeometry(0.48,0.48,0.06,8), coalMat, 0,1.27,0); coals.castShadow=false; g.add(coals); enableBloom(coals);
    const fl=[]; for(let k=0;k<3;k++){ const f=new THREE.Mesh(FL, k===2?flameMatB:flameMatA); f.position.set(rand(-0.16,0.16),1.28,rand(-0.16,0.16)); f.userData={ph:rand(0,6.28),s:k===2?0.62:rand(0.85,1.15)}; g.add(f); fl.push(f); enableBloom(f); }
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xff9a4a,transparent:true,opacity:0.5,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));
    glow.scale.setScalar(2.6); glow.position.y=1.7; g.add(glow); enableBloom(glow);
    const pool=new THREE.Mesh(new THREE.CircleGeometry(5.2,24), new THREE.MeshBasicMaterial({map:GLOW,color:0xff8a3c,transparent:true,opacity:0.2,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
    pool.rotation.x=-Math.PI/2; pool.position.y=0.035; pool.layers.set(NOBLOOM_LAYER); g.add(pool);
    scene.add(g); solidCyl(x,z,0.5,{mob:true}); braziers.push({x,z,fl,glow,pool,ph:rand(0,6.28),emb:rand(0,0.3)}); }
})();

/* --- rúna-kör az oltáron: forgó, lélegző cián pecsét (a VIHAR töltöttségével erősödik) --- */
const runeSeal=(function(){
  const c=document.createElement('canvas'); c.width=c.height=512; const x=c.getContext('2d'); x.translate(256,256); x.strokeStyle='#fff'; x.lineCap='round';
  x.lineWidth=5; x.beginPath(); x.arc(0,0,236,0,6.283); x.stroke();
  x.lineWidth=2; x.beginPath(); x.arc(0,0,214,0,6.283); x.stroke(); x.beginPath(); x.arc(0,0,150,0,6.283); x.stroke();
  x.lineWidth=3; x.beginPath(); for(let i=0;i<=6;i++){ const a=i*2*(Math.PI*2/6)+0.26, px=Math.cos(a)*150, py=Math.sin(a)*150; if(i) x.lineTo(px,py); else x.moveTo(px,py); } x.stroke();   // két egymásba forgatott háromszög
  x.beginPath(); for(let i=0;i<=6;i++){ const a=i*2*(Math.PI*2/6)+0.26+Math.PI/3, px=Math.cos(a)*150, py=Math.sin(a)*150; if(i) x.lineTo(px,py); else x.moveTo(px,py); } x.stroke();
  let _rs=77; const R=()=>{ _rs=(_rs*1664525+1013904223)>>>0; return _rs/4294967296; };   // determinisztikus rovás-jelek a két gyűrű közt
  for(let i=0;i<16;i++){ x.save(); x.rotate(i*6.283/16); x.translate(0,-182); x.lineWidth=4; x.beginPath();
    let px=(R()-0.5)*14, py=-14; x.moveTo(px,py); for(let k=0;k<3+((R()*3)|0);k++){ px=(R()-0.5)*26; py+=6+R()*9; x.lineTo(px,Math.min(15,py)); } x.stroke(); x.restore(); }
  const tex=new THREE.CanvasTexture(c);
  const m=new THREE.Mesh(new THREE.CircleGeometry(3.25,48), new THREE.MeshBasicMaterial({map:tex,color:0x36c5ff,transparent:true,opacity:0.55,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,polygonOffset:true,polygonOffsetFactor:-2}));
  m.rotation.x=-Math.PI/2; m.position.y=0.17; scene.add(m); enableBloom(m); return m;
})();

const _shX=new THREE.Vector3(), _shZ=new THREE.Vector3(), _shM=new THREE.Matrix4();
let envUltK=0;   // 0..1: a VIHAR-sáv töltöttsége (az update() írja) -> a rúna-kör fényereje
function updateEnv(dt,t){
  WIND_U.uWind.value=t; WIND_U.uPlayer.value.set(player.pos.x, player.feet, player.pos.z);
  const cx=camera.position.x, cy=camera.position.y, cz=camera.position.z;
  for(const w of mistWisps){ w.a+=w.sp*dt; const x=Math.cos(w.a)*w.r, z=Math.sin(w.a)*w.r; w.s.position.set(x, w.y+Math.sin(t*0.3+w.ph)*0.25, z);
    const d=Math.hypot(x-cx,z-cz); w.s.material.opacity=w.base*clamp((d-4)/9,0,1)*(0.75+0.25*Math.sin(t*0.4+w.ph)); }
  for(const s of moonShafts){   // tengely-billboard: a sáv hossztengelye a hold-irány, a lapja a kamera felé fordul
    _shZ.set(cx-s.c.x,cy-s.c.y,cz-s.c.z); _shX.crossVectors(MOON_DIR,_shZ).normalize(); _shZ.crossVectors(_shX,MOON_DIR);
    _shM.makeBasis(_shX,MOON_DIR,_shZ); _shM.setPosition(s.c); s.m.matrix.copy(_shM); s.m.matrixWorldNeedsUpdate=true;
    s.m.material.opacity=s.base*(0.7+0.3*Math.sin(t*0.5+s.ph)); }
  let fsum=0;
  for(const b of braziers){ const f=0.86+0.10*Math.sin(t*11+b.ph)+0.07*Math.sin(t*17.3+b.ph*2.1)+0.05*Math.sin(t*29+b.ph); fsum+=f;
    for(const m of b.fl){ const u=m.userData, k=0.8+0.3*Math.sin(t*9+u.ph)+0.18*Math.sin(t*23+u.ph*1.7); m.scale.set(u.s*(1.1-0.2*k),u.s*k,u.s*(1.1-0.2*k)); m.rotation.y=t*3+u.ph; }
    b.glow.material.opacity=0.42*f; b.glow.scale.setScalar(2.4+0.5*f); b.pool.material.opacity=0.2*f;
    b.emb-=dt; if(b.emb<=0 && gfxTier!=='low'){ b.emb=rand(0.10,0.34);   // felszálló parázs
      RP.spawn(b.x+rand(-0.2,0.2),1.5,b.z+rand(-0.2,0.2), rand(-0.3,0.3),rand(0.9,2.2),rand(-0.3,0.3), Math.random()<0.5?0xffb347:0xff7a3d, rand(0.08,0.16),0.01, rand(0.9,1.8), -0.25,0.4,0.9); } }
  hearthLight.intensity=0.9*(fsum/braziers.length);
  runeSeal.rotation.z=t*0.07; runeSeal.material.opacity=(0.34+0.10*Math.sin(t*1.3))*(1+envUltK*1.3);
}
