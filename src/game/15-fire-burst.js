/* ===================== BLENDER FLIPBOOK-EFFEKTEK (stilizált, Blenderben renderelt) =====================
   Forrás: tools/vfx/*.blend + *.py (Blender 5.3, headless render). Az atlaszok ADATOT tárolnak, nem színt:
   4x4 kocka, RGB = sáv (5 szint: 0.10 / 0.32 / 0.54 / 0.76 / 1.00), A = lefedettség (a végén szétmaródik).
   A színt a shader adja effektenként a saját 5 színű palettájából, így kemény, rajzfilmes sávok maradnak.
   - makeFlipbook(): EGY instanced háló effektenként (1 rajzolási hívás), kamera felé forduló lapok, két kocka közt áttűnéssel.
   - Mind a négy effekt UGYANAZT a shadert használja (a paletta, a sáv-átlátszóság, a bloom-súly és az áttűnés
     uniform) -> egyetlen lefordított program; a bemelegítés (27-frame-warmup.js) egyszer lefordítja.
   - Bloom-passban csak a megadott sávok adnak fényt (BLOOM_PASS_U); ha egyik sem izzik (por), a háló a bloom-passból kimarad.
   - frustumCulled=false, az inaktív példányok a vágótéren kívülre kerülnek; üresjáratban a háló rejtve (0 rajzolás).
   - A tükrözés a textúra-koordinátán történik (a pozíció tükrözése megfordítaná a körüljárást -> hátlap-eldobás, láthatatlan lap). */
// Közös betöltő a Blenderben renderelt ADAT-atlaszokhoz (flipbookok, füstpamacs): lineáris textúra + "kész" ígéret.
// A bemelegítés (27-frame-warmup.js) ezekre az ígéretekre vár, hogy a textúrák a töltőképernyő alatt feltöltődjenek.
function loadDataAtlas(url){
  if(!url) return { tex:null, ready:Promise.resolve() };
  let tex; const ready=new Promise(r=>{ tex=new THREE.TextureLoader().load(url, ()=>r(), undefined, ()=>r()); });
  tex.encoding=THREE.LinearEncoding;   // adat (sáv + lefedettség), nem sRGB szín
  return { tex, ready };
}
/* o: { url, palette:[5 sRGB hex: sáv 0..4], bandAlpha:[5], glow:[5 bloom-súly], dur (mp), max (példány),
        frames=16, grid=4, rot (± véletlen forgatás, rad), lift (a középpont ennyi×méret magasan: talajon ülő effekt),
        lerp (true = két kocka közt áttűnés, false = kemény vágás), order (renderOrder) }
   spawn(x,y,z,size[,durMul[,front]]) — size = a lap oldalhossza világegységben; front = ennyivel a kamera felé tolva
   (vízszintesen), hogy egy test közepén indított effektet ne takarjon el a test eleje. */
function makeFlipbook(o){
  const N=o.max||14, FRAMES=o.frames||16, GRID=o.grid||4, DUR=o.dur||0.6, ROT=(o.rot==null?0.22:o.rot), LIFT=o.lift||0;
  const { tex, ready } = loadDataAtlas(o.url);
  if(!tex) return { ready, spawn(){}, update(){}, reset(){} };

  const base=new THREE.PlaneGeometry(1,1), geo=new THREE.InstancedBufferGeometry();
  geo.index=base.index; geo.setAttribute('position',base.attributes.position); geo.setAttribute('uv',base.attributes.uv);
  const P=new Float32Array(N*3), D=new Float32Array(N*4);   // D: [életkor 0..1 (<0 = inaktív), méret, forgatás, tükrözés ±1]
  for(let i=0;i<N;i++) D[i*4]=-1;
  const aPos=new THREE.InstancedBufferAttribute(P,3).setUsage(THREE.DynamicDrawUsage);
  const aData=new THREE.InstancedBufferAttribute(D,4).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aPos',aPos); geo.setAttribute('aData',aData); geo.instanceCount=N;
  const lin=h=>new THREE.Color(h).convertSRGBToLinear(), pal=o.palette, ba=o.bandAlpha||[1,1,1,1,1], gl=o.glow||[0,0,0,0,0];
  const G=GRID.toFixed(1), INV=(1/GRID).toFixed(6), LAST=(FRAMES-1).toFixed(1);
  const mat=new THREE.ShaderMaterial({
    uniforms:{ uMap:{value:tex}, uBloom:BLOOM_PASS_U, uLerp:{value:o.lerp===false?0:1},
      uC0:{value:lin(pal[0])}, uC1:{value:lin(pal[1])}, uC2:{value:lin(pal[2])}, uC3:{value:lin(pal[3])}, uC4:{value:lin(pal[4])},
      uA:{value:new THREE.Vector4(ba[0],ba[1],ba[2],ba[3])}, uA4:{value:ba[4]}, uG:{value:new THREE.Vector4(gl[0],gl[1],gl[2],gl[3])}, uG4:{value:gl[4]} },
    vertexShader:'attribute vec3 aPos; attribute vec4 aData; varying vec2 vUv; varying float vT;'+
      'void main(){ vT=aData.x; vUv=vec2(aData.w<0.0?1.0-uv.x:uv.x, uv.y); if(aData.x<0.0){ gl_Position=vec4(2.0,2.0,2.0,1.0); return; }'+
      ' vec3 r=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]), u=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);'+
      ' float c=cos(aData.z), s=sin(aData.z); vec2 p=position.xy;'+
      ' p=vec2(c*p.x-s*p.y, s*p.x+c*p.y)*aData.y;'+
      ' gl_Position=projectionMatrix*viewMatrix*vec4(aPos+r*p.x+u*p.y,1.0); }',
    fragmentShader:'uniform sampler2D uMap; uniform float uBloom,uLerp,uA4,uG4; uniform vec3 uC0,uC1,uC2,uC3,uC4; uniform vec4 uA,uG; varying vec2 vUv; varying float vT;'+
      'vec4 cell(float f){ float col=mod(f,'+G+'), row=floor(f/'+G+'); return texture2D(uMap, vec2((col+vUv.x)*'+INV+', ('+(GRID-1).toFixed(1)+'-row+vUv.y)*'+INV+')); }'+
      'void main(){ float fr=clamp(vT,0.0,1.0)*'+LAST+', f0=floor(fr);'+
      ' vec4 t=mix(cell(f0), cell(min(f0+1.0,'+LAST+')), (fr-f0)*uLerp); float h=t.r, a=smoothstep(0.30,0.60,t.a);'+
      ' if(a<0.01) discard;'+
      ' vec3 col; float k, g;'+   // sáv -> szín, átlátszóság-szorzó, bloom-súly
      ' if(h<0.21){ col=uC0; k=uA.x; g=uG.x; } else if(h<0.43){ col=uC1; k=uA.y; g=uG.y; } else if(h<0.65){ col=uC2; k=uA.z; g=uG.z; }'+
      ' else if(h<0.87){ col=uC3; k=uA.w; g=uG.w; } else { col=uC4; k=uA4; g=uG4; }'+
      ' a*=k*(1.0-smoothstep(0.9,1.0,vT));'+
      ' if(uBloom>0.5){ col*=g; a*=step(0.01,g); }'+   // bloom: csak az izzó sávok, mérsékelten (ne égjen ki fehérre)
      ' gl_FragColor=vec4(col,a);'+
      '\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}',
    transparent:true, depthWrite:false, blending:THREE.NormalBlending,
  });
  const mesh=new THREE.Mesh(geo,mat); mesh.frustumCulled=false; mesh.renderOrder=o.order||3; mesh.visible=false;
  if(gl.some(v=>v>0)) enableBloom(mesh); else mesh.layers.set(NOBLOOM_LAYER);   // nem izzó effekt: a bloom-pass nem rajzolja (különben fekete takaró-lap lenne)
  scene.add(mesh);

  const dur=new Float32Array(N); let next=0, live=false;
  function spawn(x,y,z,size,durMul,front){
    const i=next++%N, o4=i*4;
    if(front){ const dx=camera.position.x-x, dz=camera.position.z-z, d=Math.hypot(dx,dz); if(d>1e-3){ const k=Math.min(front,d*0.5)/d; x+=dx*k; z+=dz*k; } }
    P[i*3]=x; P[i*3+1]=y+LIFT*size; P[i*3+2]=z;
    D[o4]=0; D[o4+1]=size; D[o4+2]=rand(-ROT,ROT); D[o4+3]=Math.random()<0.5?-1:1;
    dur[i]=DUR*(0.85+0.3*Math.min(size/6,1))*(durMul||1);   // a nagyobb effekt kicsit tovább él
    aPos.needsUpdate=true; aData.needsUpdate=true; live=true; mesh.visible=true;
  }
  function update(dt){
    if(!live) return; let any=false;
    for(let i=0;i<N;i++){ const o4=i*4; if(D[o4]<0) continue; D[o4]+=dt/dur[i]; if(D[o4]>1) D[o4]=-1; else any=true; }
    aData.needsUpdate=true; live=any; mesh.visible=any;
  }
  function reset(){ for(let i=0;i<N;i++) D[i*4]=-1; aData.needsUpdate=true; live=false; mesh.visible=false; }
  return { ready, spawn, update, reset, mesh };
}
const GA=window.GAME_ASSETS||{};
// TŰZ-ROBBANÁS (tools/vfx/fire_burst.*): füst, vörös, narancs, sárga, fehér mag; csak a sárga/fehér mag izzik
const FIREBURST=makeFlipbook({ url:GA.fireBurst, max:14, dur:0.62, rot:0.22, order:3,
  palette:[0x2b211c,0xd42408,0xff8420,0xffc24d,0xffeaa8], bandAlpha:[0.82,1,1,1,1], glow:[0,0,0,0.3,0.7] });
// MÉREG-FRÖCCS (tools/vfx/poison_splash.*): sötét perem, mélyzöld, közép, világos, nedves csúcsfény; a csúcsfény halványan izzik
const POISONBURST=makeFlipbook({ url:GA.poisonSplash, max:12, dur:0.74, rot:0.12, order:3,
  palette:[0x17300a,0x3c7a12,0x78c21e,0xb6ec44,0xeaffae], bandAlpha:[1,1,1,1,1], glow:[0,0,0,0.10,0.42] });
// PORFELHŐ (tools/vfx/dust_poof.*): földszínű, holdfényhez visszafogott sávok (a tus-kontúr alig sötétebb az árnyéknál, hogy ne kőhalomnak hasson), kissé áttetsző; nem izzik; a talajon ül (lift)
const DUSTPOOF=makeFlipbook({ url:GA.dustPoof, max:18, dur:0.95, rot:0.04, lift:0.34, order:2,
  palette:[0x463e35,0x5b5348,0x726958,0x8a7f6b,0xa1957f], bandAlpha:[0.80,0.84,0.86,0.86,0.86], glow:[0,0,0,0,0] });
// VILLÁM-CSILLAG (tools/vfx/zap_burst.*): sötét perem, ibolya, cián, világoscián, fehér mag; kemény vágás (pattogó szikra), csak a mag + belső sugarak izzanak
const ZAPBURST=makeFlipbook({ url:GA.zapBurst, max:16, dur:0.36, rot:3.1416, lerp:false, order:4,
  palette:[0x261060,0x6a46f0,0x4fb2ff,0xc2efff,0xffffff], bandAlpha:[1,1,1,1,1], glow:[0,0,0,0.30,0.85] });
