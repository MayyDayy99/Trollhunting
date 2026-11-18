/* ===================== TŰZ-ROBBANÁS FLIPBOOK (Blenderben renderelt, stilizált) =====================
   Forrás: tools/vfx/fire_burst.blend + fire_burst.py (Blender 5.3, headless render). Az atlasz ADAT, nem szín:
   4x4 kocka, RGB = hő-sáv (5 szint: füst, vörös, narancs, sárga, fehér mag), A = lefedettség (a végén szétmaródik).
   A színt a shader adja a játék tűzpalettájából, így kemény, rajzfilmes sávok maradnak.
   - EGY instanced háló minden robbanásra (1 rajzolási hívás), kamera felé forduló lapok, két kocka közt áttűnéssel.
   - Bloom-passban csak a sárga/fehér mag ad fényt (BLOOM_PASS_U), a füst nem.
   - Mindig "látható" (frustumCulled=false, az inaktív példányok a vágótéren kívülre kerülnek), így a bemelegítés
     lefordítja a shaderét és feltölti a textúráját; FIREBURST.ready-re a bemelegítés vár (27-frame-warmup.js). */
// Közös betöltő a Blenderben renderelt ADAT-atlaszokhoz (tűz-robbanás, füstpamacs): lineáris textúra + "kész" ígéret.
// A bemelegítés (27-frame-warmup.js) ezekre az ígéretekre vár, hogy a textúrák a töltőképernyő alatt feltöltődjenek.
function loadDataAtlas(url){
  if(!url) return { tex:null, ready:Promise.resolve() };
  let tex; const ready=new Promise(r=>{ tex=new THREE.TextureLoader().load(url, ()=>r(), undefined, ()=>r()); });
  tex.encoding=THREE.LinearEncoding;   // adat (sáv + lefedettség), nem sRGB szín
  return { tex, ready };
}
const FIREBURST=(function(){
  const N=14, FRAMES=16, DUR=0.62;
  const { tex, ready } = loadDataAtlas(window.GAME_ASSETS && window.GAME_ASSETS.fireBurst);
  if(!tex) return { ready, spawn(){}, update(){}, reset(){} };

  const base=new THREE.PlaneGeometry(1,1), geo=new THREE.InstancedBufferGeometry();
  geo.index=base.index; geo.setAttribute('position',base.attributes.position); geo.setAttribute('uv',base.attributes.uv);
  const P=new Float32Array(N*3), D=new Float32Array(N*4);   // D: [életkor 0..1 (<0 = inaktív), méret, forgatás, tükrözés ±1]
  for(let i=0;i<N;i++) D[i*4]=-1;
  const aPos=new THREE.InstancedBufferAttribute(P,3).setUsage(THREE.DynamicDrawUsage);
  const aData=new THREE.InstancedBufferAttribute(D,4).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aPos',aPos); geo.setAttribute('aData',aData); geo.instanceCount=N;
  const lin=h=>new THREE.Color(h).convertSRGBToLinear();
  const mat=new THREE.ShaderMaterial({
    uniforms:{ uMap:{value:tex}, uBloom:BLOOM_PASS_U,
      uSmoke:{value:lin(0x2b211c)}, uRed:{value:lin(0xd42408)}, uOrange:{value:lin(0xff8420)}, uYellow:{value:lin(0xffc24d)}, uCore:{value:lin(0xffeaa8)} },
    vertexShader:'attribute vec3 aPos; attribute vec4 aData; varying vec2 vUv; varying float vT;'+
      // tükrözés a textúra-koordinátán (a pozíció tükrözése megfordítaná a körüljárást -> hátlap-eldobás, láthatatlan robbanás)
      'void main(){ vT=aData.x; vUv=vec2(aData.w<0.0?1.0-uv.x:uv.x, uv.y); if(aData.x<0.0){ gl_Position=vec4(2.0,2.0,2.0,1.0); return; }'+
      ' vec3 r=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]), u=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);'+
      ' float c=cos(aData.z), s=sin(aData.z); vec2 p=position.xy;'+
      ' p=vec2(c*p.x-s*p.y, s*p.x+c*p.y)*aData.y;'+
      ' gl_Position=projectionMatrix*viewMatrix*vec4(aPos+r*p.x+u*p.y,1.0); }',
    fragmentShader:'uniform sampler2D uMap; uniform float uBloom; uniform vec3 uSmoke,uRed,uOrange,uYellow,uCore; varying vec2 vUv; varying float vT;'+
      'vec4 cell(float f){ float col=mod(f,4.0), row=floor(f/4.0); return texture2D(uMap, vec2((col+vUv.x)*0.25, (3.0-row+vUv.y)*0.25)); }'+
      'void main(){ float fr=clamp(vT,0.0,1.0)*'+(FRAMES-1)+'.0, f0=floor(fr);'+
      ' vec4 t=mix(cell(f0), cell(min(f0+1.0,'+(FRAMES-1)+'.0)), fr-f0); float h=t.r, a=smoothstep(0.30,0.60,t.a);'+
      ' if(a<0.01) discard;'+
      ' vec3 col=h<0.21?uSmoke:(h<0.43?uRed:(h<0.65?uOrange:(h<0.87?uYellow:uCore)));'+
      ' a*=(h<0.21?0.82:1.0)*(1.0-smoothstep(0.9,1.0,vT));'+
      ' if(uBloom>0.5){ float g=0.7*step(0.87,h)+0.3*step(0.65,h)*(1.0-step(0.87,h)); col*=g; a*=step(0.01,g); }'+   // bloom: csak a sárga/fehér mag, mérsékelten (ne égjen ki fehérre)
      ' gl_FragColor=vec4(col,a);'+
      '\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}',
    transparent:true, depthWrite:false, blending:THREE.NormalBlending,
  });
  const mesh=new THREE.Mesh(geo,mat); mesh.frustumCulled=false; mesh.renderOrder=3; enableBloom(mesh); scene.add(mesh);

  const dur=new Float32Array(N); let next=0, live=false;
  function spawn(x,y,z,size){
    const i=next++%N, o=i*4;
    P[i*3]=x; P[i*3+1]=y; P[i*3+2]=z;
    D[o]=0; D[o+1]=size; D[o+2]=rand(-0.22,0.22); D[o+3]=Math.random()<0.5?-1:1;
    dur[i]=DUR*(0.85+0.3*Math.min(size/6,1));   // a nagyobb robbanás kicsit tovább él
    aPos.needsUpdate=true; aData.needsUpdate=true; live=true;
  }
  function update(dt){
    if(!live) return; let any=false;
    for(let i=0;i<N;i++){ const o=i*4; if(D[o]<0) continue; D[o]+=dt/dur[i]; if(D[o]>1) D[o]=-1; else any=true; }
    aData.needsUpdate=true; live=any;
  }
  function reset(){ for(let i=0;i<N;i++) D[i*4]=-1; aData.needsUpdate=true; live=false; }
  return { ready, spawn, update, reset, mesh };
})();
