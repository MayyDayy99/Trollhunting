/* ===================== Procedurális textúrák (a troll-fájlból) ===================== */
function glowTexture(){
  const c=document.createElement('canvas'); c.width=c.height=64;
  const x=c.getContext('2d');
  const g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(.35,'rgba(255,255,255,.55)'); g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g; x.fillRect(0,0,64,64);
  return new THREE.CanvasTexture(c);
}
function noiseTexture(size, blobs, light, dark){
  const c=document.createElement('canvas'); c.width=c.height=size;
  const x=c.getContext('2d');
  x.fillStyle='#808080'; x.fillRect(0,0,size,size);
  for(let i=0;i<blobs;i++){
    x.fillStyle = Math.random()<.5 ? light : dark; x.globalAlpha=.08+Math.random()*.12;
    x.beginPath(); x.arc(Math.random()*size,Math.random()*size,1+Math.random()*4,0,6.3); x.fill();
  }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(3,3); return t;
}
function mossTexture(){
  const c=document.createElement('canvas'); c.width=c.height=256;
  const x=c.getContext('2d'); x.fillStyle='#2d4a36'; x.fillRect(0,0,256,256);
  const cols=['#37603f','#2a4a32','#456b46','#26412c'];
  for(let i=0;i<900;i++){ x.fillStyle=cols[i%4]; x.globalAlpha=.4;
    x.beginPath(); x.arc(Math.random()*256,Math.random()*256,1+Math.random()*4,0,6.3); x.fill(); }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(10,10); return t;
}
const GLOW=glowTexture(), SKIN_N=noiseTexture(128,500,'#aaaaaa','#555555'), MOSS_T=mossTexture();
/* LÁTVÁNY-TURBÓ: dedikált, nagy felbontású talaj-textúra (moha-párnák, föld-foltok, apró lóhere-pöttyök, száraz szálak) */
function groundTexture(){
  const S=512, c=document.createElement('canvas'); c.width=c.height=S; const x=c.getContext('2d'); x.fillStyle='#5a8a48'; x.fillRect(0,0,S,S);
  const blob=(px,py,r,col,a)=>{ for(let ox=-S;ox<=S;ox+=S) for(let oy=-S;oy<=S;oy+=S){ if(px+ox<-r||px+ox>S+r||py+oy<-r||py+oy>S+r) continue;   // csempézhető: a szélen átlógó folt a túloldalon is megjelenik
      const g=x.createRadialGradient(px+ox,py+oy,0,px+ox,py+oy,r); g.addColorStop(0,col); g.addColorStop(1,'rgba(0,0,0,0)'); x.globalAlpha=a; x.fillStyle=g; x.beginPath(); x.arc(px+ox,py+oy,r,0,6.3); x.fill(); } };
  const P1=['#6fa04e','#4f7f40','#7fae58','#456f3a','#89b862'], P2=['#3e5f34','#35522e','#5b4a30','#4a3d28'];
  for(let i=0;i<70;i++) blob(Math.random()*S,Math.random()*S,26+Math.random()*52,P2[(Math.random()*P2.length)|0],0.34);     // nagy sötét föld/árnyék foltok
  for(let i=0;i<900;i++) blob(Math.random()*S,Math.random()*S,3+Math.random()*11,P1[(Math.random()*P1.length)|0],0.5);      // moha-párnák
  for(let i=0;i<1500;i++){ x.globalAlpha=0.5; x.fillStyle=Math.random()<0.7?'#a8cf74':'#31502c'; x.fillRect(Math.random()*S,Math.random()*S,1.5,1.5); }   // lóhere-/árnyék-pöttyök
  x.globalAlpha=0.3; x.strokeStyle='#b9c48a'; x.lineWidth=1;
  for(let i=0;i<260;i++){ const px=Math.random()*S, py=Math.random()*S, a=Math.random()*6.3, l=3+Math.random()*7; x.beginPath(); x.moveTo(px,py); x.lineTo(px+Math.cos(a)*l,py+Math.sin(a)*l); x.stroke(); }   // száraz fűszálak
  x.globalAlpha=1; const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(13,13); return t;
}
const GROUND_T=groundTexture(); GROUND_T.encoding=THREE.sRGBEncoding;
/* LÁTVÁNY-TURBÓ: SZÉL — a fű/páfrány/lomb vertex-shaderben hajladozik (nulla CPU), a fű a játékos lába elől kihajlik.
   Az instanceMatrix UTÁN, világ-térben tolunk (így a szél iránya koherens, nem pengénként forog). */
const WIND_U={ uWind:{value:0}, uPlayer:{value:new THREE.Vector3(0,-99,0)} };
function applyWind(mat, kind){
  const amp = kind==='canopy' ? '0.042' : (kind==='fern' ? '0.20' : '0.34');
  const hgt = kind==='canopy' ? 'clamp(transformed.y-3.1,0.0,3.6)' : 'max(0.0,transformed.y)';
  const pw  = kind==='canopy' ? 'hgt' : 'hgt*hgt';
  mat.onBeforeCompile=function(sh){ sh.uniforms.uWind=WIND_U.uWind; sh.uniforms.uPlayer=WIND_U.uPlayer;
    sh.fragmentShader='#undef DOUBLE_SIDED\n'+sh.fragmentShader;   // kétoldalas lapok (fű, levél-kártya): a hátoldal NE fordítsa meg a normált (különben fekete pengék)
    sh.vertexShader='uniform float uWind; uniform vec3 uPlayer;\n'+sh.vertexShader.replace('#include <project_vertex>',
      'vec4 mvPosition = vec4( transformed, 1.0 );\n#ifdef USE_INSTANCING\n mvPosition = instanceMatrix * mvPosition;\n#endif\n'+
      '{ vec4 wp4 = modelMatrix * mvPosition; float hgt = '+hgt+'; float ph = wp4.x*0.31 + wp4.z*0.23;\n'+
      '  float sw = sin(uWind*1.5+ph)*0.6 + sin(uWind*2.6+ph*1.9)*0.28 + sin(uWind*0.6+ph*0.31)*0.45;\n'+
      '  float k = '+pw+' * '+amp+';\n  mvPosition.x += sw*k; mvPosition.z += sw*k*0.6;\n'+
      (kind==='canopy' ? '' :
      '  vec2 pv = wp4.xz - uPlayer.xz; float pd = length(pv) + 0.0001; float pk = smoothstep(1.7,0.25,pd) * step(abs(uPlayer.y - wp4.y), 1.2);\n'+
      '  mvPosition.xz += (pv/pd) * pk * hgt * 0.75; mvPosition.y -= pk * hgt * 0.35;\n')+
      '}\nmvPosition = modelViewMatrix * mvPosition;\ngl_Position = projectionMatrix * mvPosition;'); };
  mat.customProgramCacheKey=function(){ return 'wind-'+kind; };
  return mat;
}
// A canvas-textúra sRGB-ben készül — enélkül a moha kimosottan (lineárisként értelmezve) jelenik meg.
// Bump-használatkor ugyanez a textúra lineáris marad (a bump magasságtérkép, nem szín).
MOSS_T.encoding=THREE.sRGBEncoding;
MOSS_T.anisotropy=renderer.capabilities.getMaxAnisotropy();

/* ===================== Fények ===================== */
/* ---- EDIT J+ (lighting ranges) — REPLACE lines 178-185 (the whole
        "Fények" block). Colors deliberately UNCHANGED; only ranges/frustum
        grow, plus one extra cool ground-bounce hemisphere for depth. ---- */
scene.add(new THREE.HemisphereLight(0x6583d8, 0x2a3a22, 0.60));
const key=new THREE.DirectionalLight(0xc8d8ff,1.15); key.position.set(34,60,26);
key.castShadow=true; key.shadow.mapSize.set(1024,1024); // FPS: feleakkora árnyék-textúra
key.shadow.camera.left=-64; key.shadow.camera.right=64; key.shadow.camera.top=64; key.shadow.camera.bottom=-64;
key.shadow.camera.near=1; key.shadow.camera.far=160; key.shadow.bias=-0.0005; key.shadow.normalBias=0.03;
scene.add(key);
const rim=new THREE.DirectionalLight(0x9fd8ff,0.5); rim.position.set(-24,28,-44); scene.add(rim);
const moonFill=new THREE.PointLight(0x88aaff,0.4,120,2); moonFill.position.set(-40,30,-60); scene.add(moonFill);

/* ===================== Grafikai fokozatok (ALACSONY/KÖZEPES/MAGAS) ===================== */
const GFX_KEY='mr_gfx';
let gfxTier=(function(){ try{ return localStorage.getItem(GFX_KEY)||(MOBILE_INPUT?'low':'high'); }catch(_e){ return MOBILE_INPUT?'low':'high'; } })();
function applyGraphics(tier, save){
  const T={ low:   {pr:1.0,  soft:false, sm:1024, bloom:false},
            medium:{pr:1.5,  soft:false, sm:1024, bloom:true },
            high:  {pr:1.5,  soft:true,  sm:2048, bloom:true } }[tier];
  if(!T) return;
  const mobilePr={low:1.0, medium:1.15, high:1.25}[tier];
  gfxTier=tier;
  renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE_INPUT ? mobilePr : T.pr));
  renderer.setSize(innerWidth, innerHeight);
  bloomOn = !!T.bloom && bloomAvail;           // low (v. hiányzó addon): nincs bloom -> sima render (nincs FPS-regresszió)
  syncFogColor(); SKY_U.uQ.value=(tier==='low')?0:1; syncGrassCount(); syncTreeShadows();
  if(bloomAvail){ bloomPass.strength = (tier==='high') ? 0.9 : 0.6;
    const _ms=(tier==='high')?4:0;   // élsimítás: csak MAGAS fokozaton (4x MSAA) — közepesen a kitöltési sebesség fontosabb
    [finalComposer.renderTarget1, finalComposer.renderTarget2].forEach(rt=>{ if(rt && rt.isWebGLMultisampleRenderTarget) rt.samples=_ms; });
    bloomSize(); }   // az új pixelRatio/méret átvitele a composerekre
  const wantType=T.soft?THREE.PCFSoftShadowMap:THREE.PCFShadowMap;
  if(renderer.shadowMap.type!==wantType || key.shadow.mapSize.x!==T.sm){
    renderer.shadowMap.type=wantType;
    key.shadow.mapSize.set(T.sm,T.sm);
    if(key.shadow.map){ key.shadow.map.dispose(); key.shadow.map=null; } renderer.shadowMap.needsUpdate=true;   // új méretű árnyéktextúra kikényszerítése
    scene.traverse(o=>{ const mm=o.material; if(!mm) return; (Array.isArray(mm)?mm:[mm]).forEach(x=>x.needsUpdate=true); });   // shader-újrafordítás az új árnyéktípushoz
  }
  if(save){ try{ localStorage.setItem(GFX_KEY,tier); }catch(_e){} }
  document.querySelectorAll('.gfxbtn').forEach(b=>b.classList.toggle('on', b.dataset.gfx===tier));
}
applyGraphics(gfxTier,false);
// resize-kezelő (eddig hiányzott: átméretezéskor torzult a kép)
addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  bloomSize();
});

