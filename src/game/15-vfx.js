/* ========================= 1) CINEMATIC FX-RÉTEG ========================= */
/* ===================== ELEM-CINEMA — gazdag additív FX-réteg =====================
   A demó-kártyák szépségét hozza a játékba: per-részecske MÉRET + elhalványulás
   (shader-points), táguló lökés-GYŰRŰK, villanás-SPRITE-ok, valódi VILLÁM-ívek
   (Line) és dinamikus FÉNY. Minden elemi effekt ezen fut. */
function makeRichPool(max, blending, fade, atlas){
  // FÜST-FLIPBOOK (tools/vfx/smoke_puff.*): ha van atlasz, a 'puff' részecske a kora szerinti kockát rajzolja
  // (2 változat x 16 kocka egy 8x4-es rácsban, áttűnéssel, véletlen tükrözéssel). Az 5 sávot (tus-kontúr, árnyék,
  // közép, fény, csúcsfény) a részecske saját színével árnyalja: hűvösebb árnyék, melegebb csúcsfény (holdfényes jelenet).
  const book = fade==='puff' && atlas && atlas.tex;
  const pos=new Float32Array(max*3), acol=new Float32Array(max*3), asz=new Float32Array(max), aal=new Float32Array(max);
  const vel=new Float32Array(max*3), life=new Float32Array(max), ml=new Float32Array(max);
  const s0=new Float32Array(max), s1=new Float32Array(max), grv=new Float32Array(max), drg=new Float32Array(max), amax=new Float32Array(max);
  let idx=0; const C=new THREE.Color();
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  g.setAttribute('acolor',new THREE.BufferAttribute(acol,3));
  g.setAttribute('size',new THREE.BufferAttribute(asz,1));
  g.setAttribute('alpha',new THREE.BufferAttribute(aal,1));
  const aage=book?new Float32Array(max):null, avar=book?new Float32Array(max):null;
  if(book){ g.setAttribute('aage',new THREE.BufferAttribute(aage,1)); g.setAttribute('avar',new THREE.BufferAttribute(avar,1)); }
  const mat=book ? new THREE.ShaderMaterial({
    uniforms:{ map:{value:atlas.tex} },
    vertexShader:'attribute float size; attribute float alpha; attribute vec3 acolor; attribute float aage; attribute float avar;'+
      'varying vec3 vC; varying float vA; varying float vAge; varying float vVar;'+
      'void main(){ vC=acolor; vA=alpha; vAge=aage; vVar=avar; vec4 mv=modelViewMatrix*vec4(position,1.0);'+
      'gl_PointSize=clamp(size*1.1*(300.0/-mv.z),1.0,260.0); gl_Position=projectionMatrix*mv; }',   // 1.1: a pamacs nem tölti ki teljesen a kockát, mint a puha GLOW-folt
    fragmentShader:'uniform sampler2D map; varying vec3 vC; varying float vA; varying float vAge; varying float vVar;'+
      'vec4 cell(float f, vec2 pc){ float col=mod(f,8.0), row=floor(f/8.0); return texture2D(map, vec2((col+pc.x)*0.125,(3.0-row+pc.y)*0.25)); }'+
      'void main(){ vec2 pc=vec2(gl_PointCoord.x, 1.0-gl_PointCoord.y); if(vVar>=2.0) pc.x=1.0-pc.x;'+   // tükrözés a koordinátán
      ' float base=mod(vVar,2.0)*16.0, fr=clamp(vAge,0.0,1.0)*15.0, f0=floor(fr);'+
      ' vec4 t=mix(cell(base+f0,pc), cell(base+min(f0+1.0,15.0),pc), fr-f0);'+
      ' float a=smoothstep(0.30,0.60,t.a)*min(1.0,vA*1.8); if(a<0.02) discard;'+   // a rajzolt pamacs tömörebb lehet, mint a régi puha folt: x1.8 átlátszatlanság
      ' float h=t.r; vec3 c=vC*(h<0.21?vec3(0.26,0.28,0.36):(h<0.44?vec3(0.50,0.54,0.66):(h<0.67?vec3(0.76,0.78,0.82):(h<0.89?vec3(0.95,0.95,0.94):vec3(1.06,1.04,0.98)))));'+
      ' c+=vec3(0.045,0.035,0.02)*step(0.89,h);'+   // tus-kontúr / hűvös árnyék / közép / fény / meleg csúcsfény
      ' gl_FragColor=vec4(c, a); }',
    transparent:true, blending:blending, depthWrite:false, depthTest:true }) : new THREE.ShaderMaterial({
    uniforms:{ map:{value:GLOW} },
    vertexShader:'attribute float size; attribute float alpha; attribute vec3 acolor; varying vec3 vC; varying float vA;'+
      'void main(){ vC=acolor; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.0);'+
      'gl_PointSize=clamp(size*(300.0/-mv.z),1.0,260.0); gl_Position=projectionMatrix*mv; }',
    fragmentShader:'uniform sampler2D map; varying vec3 vC; varying float vA;'+
      'void main(){ vec4 t=texture2D(map,gl_PointCoord); if(t.a<0.02)discard; gl_FragColor=vec4(vC, t.a*vA); }',
    transparent:true, blending:blending, depthWrite:false, depthTest:true });
  const pts=new THREE.Points(g,mat); pts.frustumCulled=false; scene.add(pts);
  function spawn(x,y,z, vx,vy,vz, color, size0,size1, lifeS, grav, drag, a0){
    const i=idx++%max; pos[i*3]=x;pos[i*3+1]=y;pos[i*3+2]=z; vel[i*3]=vx;vel[i*3+1]=vy;vel[i*3+2]=vz;
    C.set(color); if(fade==='add') C.convertSRGBToLinear();   // izzó részecskék: sRGB->lineáris, hogy halmozódva is telített színűek maradjanak (ne fehéredjenek ki)
    acol[i*3]=C.r;acol[i*3+1]=C.g;acol[i*3+2]=C.b;
    s0[i]=size0; s1[i]=(size1==null?size0*0.15:size1); life[i]=lifeS; ml[i]=lifeS;
    grv[i]=grav||0; drg[i]=drag||0; amax[i]=(a0==null?1:a0); asz[i]=size0; aal[i]=amax[i];
    if(book){ aage[i]=0; avar[i]=(Math.random()*4)|0; aal[i]=0; } }
  function update(dt){ let live=false;
    for(let i=0;i<max;i++){ if(life[i]<=0){ if(aal[i]!==0){aal[i]=0;asz[i]=0;live=true;} continue; }
      live=true;
      life[i]-=dt; const k=Math.max(0,life[i]/ml[i]);
      const df=Math.max(0,1-drg[i]*dt); vel[i*3]*=df; vel[i*3+2]*=df; vel[i*3+1]=vel[i*3+1]*df-grv[i]*dt;
      pos[i*3]+=vel[i*3]*dt; pos[i*3+1]+=vel[i*3+1]*dt; pos[i*3+2]+=vel[i*3+2]*dt;
      asz[i]=s1[i]+(s0[i]-s1[i])*k;
      if(book){ aage[i]=1-k; aal[i]=amax[i]*Math.min(1,(1-k)*8)*Math.min(1,k*12); }   // gyors be, a végén a kép maga maródik szét
      else aal[i]=amax[i]*(fade==='puff'?Math.sin(Math.PI*(1-k)):k); }
    if(live){ g.attributes.position.needsUpdate=true; g.attributes.size.needsUpdate=true; g.attributes.alpha.needsUpdate=true; g.attributes.acolor.needsUpdate=true; if(book) g.attributes.aage.needsUpdate=true; } }   // FPS: üresjáratban ne tölts fel buffert
  return { spawn, update, pts };
}
const RP=makeRichPool(2600, THREE.AdditiveBlending, 'add');   // izzó: parázs, szikra, dér, buborék, mágia
enableBloom(RP.pts);                                          // az additív izzó-részecskék adják a fő harci glow-t
const SMOKE_ATLAS=loadDataAtlas(window.GAME_ASSETS && window.GAME_ASSETS.smokePuff);   // Blender füstpamacs (tools/vfx)
const SMK=makeRichPool(360, THREE.NormalBlending, 'puff', SMOKE_ATLAS);    // füst: sötét, növekvő, lágy puff (NEM izzik)

/* ===================== VFX-KÉSZLET (AA-látvány) =====================
   Előre lefoglalt, shader-alapú effekt-technika — futás közben nincs geometria-/anyag-foglalás és nincs shader-fordítás:
   kamera felé forduló SZALAGOK (elágazó villám, nyíl-csóva, szikra-csíkok), lágy peremű LÖKÉSHULLÁM-gyűrűk,
   talaj-MATRICÁK (perzselés, dér, méregtócsa, repedés), zaj-erodált LÁNG és TŰZGOLYÓ, fazettás JÉGKRISTÁLY-fürtök,
   kavargó ÖRVÉNY-korong + tölcsér, FÉNYOSZLOP, csillag-VILLANÁS és jól olvasható veszély-JELZŐK.
   A shaderek egy közös, csempézhető zaj-textúrából mintavételeznek (2 olvasás / képpont), ezért mobilon is olcsók. */
const VFX=(function(){
  const U_TIME={value:0}, C=new THREE.Color();
  // a készlet MINDEN színe sRGB-hexként értendő: lineárisra váltva a tónus-leképezés után is telített marad (nem fakul pasztellre)
  function lin(c){ return C.set(c).convertSRGBToLinear(); }
  const TONE='\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n';
  const PAL={ fire:{core:0xffeaa8,mid:0xff8420,edge:0xd42408}, toxic:{core:0xeaffa8,mid:0x8fe034,edge:0x2a8a18},
              frost:{core:0xffffff,mid:0x9fdcff,edge:0x2a6ad0}, arc:{core:0xffffff,mid:0xcdbcff,edge:0x6a48e0} };
  const lowFx=()=>gfxTier==='low';
  // csempézhető zaj: 3 oktáv, mindegyik ELFORGATOTT rácson (egész együtthatós forgatás -> a csempézhetőség megmarad) -> nincs tengely-irányú "kockásság"
  const NOISE=(function(){ const S=128, d=new Uint8Array(S*S*4);
    const octs=[[4,0.5,2,1],[8,0.3,2,-1],[16,0.2,1,1]].map(o=>{ const g=new Float32Array(o[0]*o[0]); for(let i=0;i<g.length;i++) g[i]=Math.random(); return {per:o[0],amp:o[1],a:o[2],b:o[3],g}; });
    for(let y=0;y<S;y++) for(let x=0;x<S;x++){ let v=0;
      for(const o of octs){ const u=x/S, w=y/S, fx=(o.a*u+o.b*w)*o.per, fy=(-o.b*u+o.a*w)*o.per, xf=Math.floor(fx), yf=Math.floor(fy), P=o.per;
        const x0=((xf%P)+P)%P, y0=((yf%P)+P)%P, x1=(x0+1)%P, y1=(y0+1)%P; let tx=fx-xf, ty=fy-yf; tx=tx*tx*(3-2*tx); ty=ty*ty*(3-2*ty);
        const a=o.g[y0*P+x0], b=o.g[y0*P+x1], c=o.g[y1*P+x0], e=o.g[y1*P+x1]; v+=o.amp*(a+(b-a)*tx+(c-a)*ty+(a-b-c+e)*tx*ty); }
      const k=(y*S+x)*4, q=Math.max(0,Math.min(255,Math.round(((v-0.5)*1.7+0.5)*255))); d[k]=d[k+1]=d[k+2]=q; d[k+3]=255; }
    const t=new THREE.DataTexture(d,S,S,THREE.RGBAFormat); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.magFilter=t.minFilter=THREE.LinearFilter; t.needsUpdate=true; return t; })();
  // csillanás-textúra: apró, feszes mag + vékony, hosszú sugarak (nem puha folt) -> bloom mellett is "szikra-villanás", nem kiégett paca
  const STAR=(function(){ const S=128, c=document.createElement('canvas'); c.width=c.height=S; const x=c.getContext('2d'); x.translate(S/2,S/2);
    const g=x.createRadialGradient(0,0,0,0,0,S*0.5); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.05,'rgba(255,255,255,0.75)'); g.addColorStop(0.13,'rgba(255,255,255,0.22)'); g.addColorStop(0.32,'rgba(255,255,255,0.05)'); g.addColorStop(1,'rgba(255,255,255,0)');
    x.fillStyle=g; x.beginPath(); x.arc(0,0,S*0.5,0,6.3); x.fill(); x.globalCompositeOperation='lighter';
    for(let k=0;k<4;k++){ x.save(); x.rotate(k*Math.PI/4); const len=(k%2?0.5:1)*S*0.5, wd=(k%2?1.2:2.0);
      const lg=x.createLinearGradient(-len,0,len,0); lg.addColorStop(0,'rgba(255,255,255,0)'); lg.addColorStop(0.5,'rgba(255,255,255,0.9)'); lg.addColorStop(1,'rgba(255,255,255,0)');
      x.fillStyle=lg; x.beginPath(); x.moveTo(-len,0); x.quadraticCurveTo(0,-wd,len,0); x.quadraticCurveTo(0,wd,-len,0); x.fill(); x.restore(); }
    return new THREE.CanvasTexture(c); })();
  function shader(vs,fs,uniforms,opt){ return new THREE.ShaderMaterial(Object.assign({uniforms,vertexShader:vs,fragmentShader:fs,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide},opt||{})); }
  // "hibrid" keverés a tömör tűz-/méreg-testekhez: előszorzott szín + részleges takarás -> világos háttér előtt sem ég ki fehérre, a színe telített marad
  const HYB={blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor};
  function pooled(m,order){ m.visible=false; m.frustumCulled=false; m.renderOrder=order||5; scene.add(m); return m; }
  // a paletta-színeket sRGB->lineárisra váltjuk: így a tónus-leképezés után is telített narancs/vörös marad (különben sárgásra fakulna)
  function setPal(u,p){ u.uCore.value.setHex(p.core).convertSRGBToLinear(); u.uMid.value.setHex(p.mid).convertSRGBToLinear(); u.uEdge.value.setHex(p.edge).convertSRGBToLinear(); }
  const VS_UV='varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
  const VS_NV='varying vec3 vN; varying vec3 vV; varying vec2 vUv; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalMatrix*normal; vV=-mv.xyz; gl_Position=projectionMatrix*mv; }';

  /* --- 1) SZALAGOK: kamera felé forduló sávok típusonként EGY közös geometriában (1 rajzolás / típus) --- */
  const VS_RIB='attribute vec4 rgba; varying vec4 vC; varying vec2 vUv; void main(){ vC=rgba; vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
  const FS_RIB='uniform float uCore; varying vec4 vC; varying vec2 vUv; void main(){ float d=abs(vUv.y*2.0-1.0); float glow=pow(max(0.0,1.0-d),2.2); float core=smoothstep(0.34,0.04,d)*uCore;'+
    ' gl_FragColor=vec4(vC.rgb*glow*1.5+mix(vC.rgb,vec3(1.0),0.6)*core*1.3,clamp(glow+core,0.0,1.0)*vC.a);'+TONE+'}';
  function ribbons(N,P,core,solidFs){   // solidFs: tömör (normál keverésű, nem izzó) változat — törmelék-lapkákhoz
    const VN=N*P*2, pos=new Float32Array(VN*3), col=new Float32Array(VN*4), uv=new Float32Array(VN*2), idx=new Uint16Array(N*(P-1)*6);
    for(let n=0;n<N;n++) for(let p=0;p<P;p++){ const v=(n*P+p)*2; uv[v*2]=p/(P-1); uv[v*2+1]=0; uv[v*2+2]=p/(P-1); uv[v*2+3]=1;
      if(p<P-1){ const q=(n*(P-1)+p)*6; idx[q]=v; idx[q+1]=v+1; idx[q+2]=v+2; idx[q+3]=v+1; idx[q+4]=v+3; idx[q+5]=v+2; } }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setAttribute('rgba',new THREE.BufferAttribute(col,4)); g.setAttribute('uv',new THREE.BufferAttribute(uv,2)); g.setIndex(new THREE.BufferAttribute(idx,1));
    const mesh=pooled(new THREE.Mesh(g,solidFs?shader(VS_RIB,solidFs,{},{blending:THREE.NormalBlending}):shader(VS_RIB,FS_RIB,{uCore:{value:core}})),solidFs?4:6);
    if(solidFs) mesh.layers.set(NOBLOOM_LAYER); else enableBloom(mesh);
    return {N,P,pos,col,g,mesh,dirty:false};
  }
  // egy szalag kiírása: pts = P pont (xyz); w0/w1 = fél-szélesség, a0/a1 = alfa a fejnél / a végnél
  function writeRibbon(R,n,pts,w0,w1,r,g,b,a0,a1){
    const P=R.P, pos=R.pos, col=R.col, cx=camera.position.x, cy=camera.position.y, cz=camera.position.z; let sx=0, sy=1, sz=0;
    for(let p=0;p<P;p++){ const i=p*3, i0=(p>0?p-1:0)*3, i1=(p<P-1?p+1:P-1)*3;
      const tx=pts[i1]-pts[i0], ty=pts[i1+1]-pts[i0+1], tz=pts[i1+2]-pts[i0+2], vx=cx-pts[i], vy=cy-pts[i+1], vz=cz-pts[i+2];
      const nx=ty*vz-tz*vy, ny=tz*vx-tx*vz, nz=tx*vy-ty*vx, l=Math.hypot(nx,ny,nz);
      if(l>1e-6){ sx=nx/l; sy=ny/l; sz=nz/l; }
      const f=p/(P-1), w=w0+(w1-w0)*f, a=a0+(a1-a0)*f, v=(n*P+p)*2, k=v*3, c=v*4;
      pos[k]=pts[i]-sx*w; pos[k+1]=pts[i+1]-sy*w; pos[k+2]=pts[i+2]-sz*w; pos[k+3]=pts[i]+sx*w; pos[k+4]=pts[i+1]+sy*w; pos[k+5]=pts[i+2]+sz*w;
      col[c]=r; col[c+1]=g; col[c+2]=b; col[c+3]=a; col[c+4]=r; col[c+5]=g; col[c+6]=b; col[c+7]=a; }
    R.dirty=true;
  }
  function hideRibbon(R,n){ const P=R.P, col=R.col; for(let p=0;p<P;p++){ const c=(n*P+p)*8; col[c+3]=0; col[c+7]=0; } R.dirty=true; }
  function flushRibbons(R,live){ R.mesh.visible=live>0; if(R.dirty){ R.g.attributes.position.needsUpdate=true; R.g.attributes.rgba.needsUpdate=true; R.dirty=false; } }

  // 1a) VILLÁM: Brown-híd alakú (természetesen kanyargó) ív, elágazásokkal, 22 Hz-es remegéssel
  const BOLT_N=48, BOLT_P=13, BR=ribbons(BOLT_N,BOLT_P,1.0), bolts=[], _bu=new Float32Array(BOLT_P), _bv=new Float32Array(BOLT_P); let boltI=0;
  for(let i=0;i<BOLT_N;i++) bolts.push({life:0,max:1,base:new Float32Array(BOLT_P*3),pts:new Float32Array(BOLT_P*3),w:0.1,r:1,g:1,b:1,jit:0.1,tick:-1,fl:1});
  function bolt(ax,ay,az,bx,by,bz,color,dur,jit,width,noBranch){
    const b=bolts[boltI++%BOLT_N], P=BOLT_P, dx=bx-ax, dy=by-ay, dz=bz-az, len=Math.hypot(dx,dy,dz)||0.001, ix=dx/len, iy=dy/len, iz=dz/len;
    let ux, uy, uz; if(Math.abs(iy)>0.9){ ux=0; uy=iz; uz=-iy; } else { ux=-iz; uy=0; uz=ix; }
    const ul=Math.hypot(ux,uy,uz)||1; ux/=ul; uy/=ul; uz/=ul; const vx=iy*uz-iz*uy, vy=iz*ux-ix*uz, vz=ix*uy-iy*ux;
    let su=0, sv=0; _bu[0]=_bv[0]=0; for(let i=1;i<P;i++){ su+=rand(-1,1); sv+=rand(-1,1); _bu[i]=su; _bv[i]=sv; }
    const e=(jit||0)*0.85;
    for(let i=0;i<P;i++){ const t=i/(P-1), ou=(_bu[i]-su*t)*e, ov=(_bv[i]-sv*t)*e, k=i*3;
      b.base[k]=ax+dx*t+ux*ou+vx*ov; b.base[k+1]=ay+dy*t+uy*ou+vy*ov; b.base[k+2]=az+dz*t+uz*ou+vz*ov; }
    lin(color); b.r=C.r; b.g=C.g; b.b=C.b; b.jit=jit||0; b.life=b.max=dur; b.tick=-1; b.w=width||clamp(0.05+len*0.008,0.05,0.30);
    if(!noBranch && len>4){ const nb=len>12?3:(len>7?2:1), bw=b.w*0.55;
      for(let q=0;q<nb;q++){ const i=(2+Math.floor(Math.random()*(P-5)))*3, bl=len*rand(0.16,0.30), ru=rand(-1,1), rv=rand(-1,1);
        const fx=ix*0.6+(ux*ru+vx*rv)*0.8, fy=iy*0.6+(uy*ru+vy*rv)*0.8, fz=iz*0.6+(uz*ru+vz*rv)*0.8, fl=Math.hypot(fx,fy,fz)||1, ox=b.base[i], oy=b.base[i+1], oz=b.base[i+2];
        bolt(ox,oy,oz, ox+fx/fl*bl, oy+fy/fl*bl, oz+fz/fl*bl, color, dur*0.8, (jit||0)*0.55, bw, true); } }
  }
  function updBolts(dt){ let live=0;
    for(let n=0;n<BOLT_N;n++){ const b=bolts[n]; if(b.life<=0) continue;
      b.life-=dt; if(b.life<=0){ hideRibbon(BR,n); continue; }
      live++; const k=b.life/b.max, tick=Math.floor((b.max-b.life)*22);
      if(tick!==b.tick){ b.tick=tick; b.fl=0.72+0.28*Math.random(); const e=b.jit*0.26*k, P=BOLT_P;
        for(let i=0;i<P;i++){ const q=i*3, s=(i===0||i===P-1)?0:e; b.pts[q]=b.base[q]+rand(-s,s); b.pts[q+1]=b.base[q+1]+rand(-s,s); b.pts[q+2]=b.base[q+2]+rand(-s,s); } }
      const a=Math.pow(k,0.55)*b.fl; writeRibbon(BR,n,b.pts,b.w,b.w*0.5,b.r,b.g,b.b,a,a*0.8); }
    flushRibbons(BR,live);
  }
  // 1b) NYÍL-CSÓVA: a röppályából visszaszámolt ív (nem kell előzmény-puffer); ha a nyíl megáll, a csóva utoléri és elhal
  const TR_N=30, TR_P=10, TR=ribbons(TR_N,TR_P,0.5), trails=[], _tp=new Float32Array(TR_P*3);
  for(let i=0;i<TR_N;i++) trails.push({on:false,fade:0,x:0,y:0,z:0,vx:0,vy:0,vz:0,g:0,span:0,w:0.05,r:1,gc:1,b:1,a:0.6,zig:0});
  function trail(i,x,y,z,vx,vy,vz,grav,span,w,color,alpha,zig){ const t=trails[i]; if(!t) return;
    t.on=true; t.fade=1; t.x=x; t.y=y; t.z=z; t.vx=vx; t.vy=vy; t.vz=vz; t.g=grav; t.span=span; t.w=w; lin(color); t.r=C.r; t.gc=C.g; t.b=C.b; t.a=alpha; t.zig=zig||0; }
  function updTrails(dt){ let live=0;
    for(let n=0;n<TR_N;n++){ const t=trails[n];
      if(!t.on){ if(t.fade<=0) continue; t.fade-=dt*7; if(t.fade<=0){ t.fade=0; hideRibbon(TR,n); continue; } }
      live++; const k=t.on?1:t.fade, span=t.span*k;
      for(let p=0;p<TR_P;p++){ const f=p/(TR_P-1), tau=span*f, q=p*3, zz=t.zig*f;
        _tp[q]=t.x-t.vx*tau+(zz?rand(-zz,zz):0); _tp[q+1]=t.y-t.vy*tau-0.5*t.g*tau*tau+(zz?rand(-zz,zz):0); _tp[q+2]=t.z-t.vz*tau+(zz?rand(-zz,zz):0); }
      writeRibbon(TR,n,_tp,t.w,t.w*0.12,t.r,t.gc,t.b,t.a*k,0);
      t.on=false; }   // a repülő nyíl minden képkockán újra bejelenti; ami elmarad, az kifakul
    flushRibbons(TR,live);
  }
  // 1c) SZIKRA-CSÍKOK: sebesség mentén megnyúlt, talajról visszapattanó szikrák / szilánkok / cseppek
  const ST_N=280, SR=ribbons(ST_N,2,0.8), st=[], _sp=new Float32Array(6); let stI=0;
  for(let i=0;i<ST_N;i++) st.push({life:0,max:1,x:0,y:0,z:0,vx:0,vy:0,vz:0,g:0,d:0,w:0.02,len:0.05,r:1,gc:1,b:1});
  function streak(x,y,z,vx,vy,vz,color,life,grav,drag,w,len){ const s=st[stI++%ST_N]; s.x=x; s.y=y; s.z=z; s.vx=vx; s.vy=vy; s.vz=vz; s.life=s.max=life; s.g=grav||0; s.d=drag||0; s.w=w||0.02; s.len=len||0.05; lin(color); s.r=C.r; s.gc=C.g; s.b=C.b; }
  function spray(x,y,z,n,color,speed,o){ o=o||{}; if(lowFx()) n=Math.ceil(n*0.6); const up=o.up==null?-0.4:o.up, multi=Array.isArray(color);
    for(let i=0;i<n;i++){ const a=Math.random()*6.283, cy=up+Math.random()*(1-up), s=Math.sqrt(Math.max(0,1-cy*cy)), v=speed*(0.4+0.6*Math.random());
      streak(x,y,z,Math.cos(a)*s*v,cy*v+(o.lift||0),Math.sin(a)*s*v,multi?color[(Math.random()*color.length)|0]:color,(o.life||0.4)*(0.6+0.8*Math.random()),o.grav==null?9:o.grav,o.drag==null?1.2:o.drag,o.w||0.018,o.len||0.045); } }
  function updStreaks(dt){ let live=0;
    for(let n=0;n<ST_N;n++){ const s=st[n]; if(s.life<=0) continue; s.life-=dt; if(s.life<=0){ hideRibbon(SR,n); continue; }
      live++; const df=Math.max(0,1-s.d*dt); s.vx*=df; s.vz*=df; s.vy=s.vy*df-s.g*dt; s.x+=s.vx*dt; s.y+=s.vy*dt; s.z+=s.vz*dt;
      if(s.y<GROUND_Y+0.02 && s.vy<0){ s.y=GROUND_Y+0.02; s.vy*=-0.35; s.vx*=0.6; s.vz*=0.6; }   // pattan a talajon
      _sp[0]=s.x; _sp[1]=s.y; _sp[2]=s.z; _sp[3]=s.x-s.vx*s.len; _sp[4]=s.y-s.vy*s.len; _sp[5]=s.z-s.vz*s.len;
      writeRibbon(SR,n,_sp,s.w,s.w*0.3,s.r,s.gc,s.b,Math.min(1,s.life/s.max*2.2),0); }
    flushRibbons(SR,live);
  }
  // 1d) TÖRMELÉK: tömör, NEM izzó lapkák (kő, föld, moha, kéreg) — a sebességük mentén megnyúlnak, a talajon pattannak, majd elfogynak
  const FS_CHIP='varying vec4 vC; varying vec2 vUv; void main(){ float d=abs(vUv.y*2.0-1.0), e=abs(vUv.x*2.0-1.0); float a=smoothstep(1.0,0.80,d+e*e*0.55);'+
    ' gl_FragColor=vec4(vC.rgb*(0.62+0.55*(1.0-d)),a*vC.a);'+TONE+'}';
  const CH_N=220, CR=ribbons(CH_N,2,0,FS_CHIP), ch=[], _cp=new Float32Array(6); let chI=0;
  for(let i=0;i<CH_N;i++) ch.push({life:0,max:1,x:0,y:0,z:0,vx:0,vy:0,vz:0,g:12,w:0.05,r:1,gc:1,b:1});
  function chip(x,y,z,vx,vy,vz,color,life,grav,w){ const s=ch[chI++%CH_N]; s.x=x; s.y=y; s.z=z; s.vx=vx; s.vy=vy; s.vz=vz; s.life=s.max=life; s.g=grav==null?12:grav; s.w=w||0.05; lin(color); s.r=C.r; s.gc=C.g; s.b=C.b; }
  // o: {up: a szórás-kúp alja (−1 = teljes gömb), lift: plusz felhajtás, life, grav, w, vx/vy/vz: irányított lökés (pl. a találat iránya)}
  function debris(x,y,z,n,color,speed,o){ o=o||{}; if(lowFx()) n=Math.ceil(n*0.6); const up=o.up==null?-0.2:o.up, multi=Array.isArray(color), bx=o.vx||0, by=(o.vy||0)+(o.lift||0), bz=o.vz||0;
    for(let i=0;i<n;i++){ const a=Math.random()*6.283, cy=up+Math.random()*(1-up), s=Math.sqrt(Math.max(0,1-cy*cy)), v=speed*(0.35+0.65*Math.random());
      chip(x,y,z,Math.cos(a)*s*v+bx,cy*v+by,Math.sin(a)*s*v+bz,multi?color[(Math.random()*color.length)|0]:color,(o.life||0.7)*(0.6+0.8*Math.random()),o.grav,(o.w||0.05)*(0.55+0.9*Math.random())); } }
  function updChips(dt){ let live=0;
    for(let n=0;n<CH_N;n++){ const s=ch[n]; if(s.life<=0) continue; s.life-=dt; if(s.life<=0){ hideRibbon(CR,n); continue; }
      live++; s.vy-=s.g*dt; s.x+=s.vx*dt; s.y+=s.vy*dt; s.z+=s.vz*dt;
      if(s.y<GROUND_Y+0.03 && s.vy<0){ s.y=GROUND_Y+0.03; s.vy*=-0.3; s.vx*=0.55; s.vz*=0.55; }
      const sp=Math.hypot(s.vx,s.vy,s.vz), L=Math.max(s.w*1.5,sp*0.028), k=sp>0.05?L/sp:0, al=Math.min(1,s.life/s.max*3.2);
      _cp[0]=s.x; _cp[1]=s.y; _cp[2]=s.z; _cp[3]=s.x-s.vx*k; _cp[4]=s.y-(k?s.vy*k:-L); _cp[5]=s.z-s.vz*k;
      writeRibbon(CR,n,_cp,s.w,s.w*0.75,s.r,s.gc,s.b,al,al); }
    flushRibbons(CR,live);
  }

  /* --- 2) LÖKÉSHULLÁM-GYŰRŰ: éles külső front + lágy, zajjal megtört belső uszály (a külső perem = a megadott sugár) --- */
  const VS_RING='varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
  const FS_RING='uniform sampler2D uNoise; uniform vec3 uColor; uniform float uAlpha,uSeed; varying vec2 vP;'+
    'void main(){ float t=clamp((length(vP)-0.5)*2.0,0.0,1.0); float n=texture2D(uNoise,vec2(atan(vP.y,vP.x)/6.2832*4.0+uSeed,uSeed*2.7)).r;'+
    ' float front=smoothstep(1.0,0.93,t)*smoothstep(0.62,0.97,t); float tail=t*t*t*0.5;'+
    ' gl_FragColor=vec4(uColor*(1.0+front*1.1),(front*(0.7+0.6*n)+tail*(0.45+0.9*n))*uAlpha);'+TONE+'}';
  const RING_N=30, rings=[]; let ringI=0;
  { const geo=new THREE.RingGeometry(0.5,1,56,1);
    for(let i=0;i<RING_N;i++){ const mat=shader(VS_RING,FS_RING,{uNoise:{value:NOISE},uColor:{value:new THREE.Color()},uAlpha:{value:0},uSeed:{value:Math.random()*7}});
      const m=pooled(new THREE.Mesh(geo,mat),4); m.rotation.x=-Math.PI/2; enableBloom(m); rings.push({m,u:mat.uniforms,life:0,max:1,r0:1,r1:2,a0:1}); } }
  function ring(x,y,z,color,r0,r1,dur,a0){ const r=rings[ringI++%RING_N]; r.m.visible=true; r.m.position.set(x,y,z); r.u.uColor.value.set(color).convertSRGBToLinear(); r.u.uSeed.value=Math.random()*7;
    r.r0=r0; r.r1=r1; r.life=r.max=dur; r.a0=(a0==null?0.9:a0); r.m.scale.setScalar(r0); r.u.uAlpha.value=r.a0; }
  function updRings(dt){ for(const r of rings){ if(r.life<=0) continue; r.life-=dt; if(r.life<=0){ r.m.visible=false; continue; }
      const k=r.life/r.max; r.m.scale.setScalar(r.r0+(r.r1-r.r0)*(1-k*k)); r.u.uAlpha.value=r.a0*k*Math.sqrt(k); } }

  /* --- 3) TALAJ-MATRICA: uKind 0 = szabálytalan folt (perzselés / dér / méregtócsa), 1 = sugaras repedés; az izzás (parázs) külön cseng le --- */
  const VS_DEC='varying vec2 vUv; varying float vD; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.0); vD=-mv.z; gl_Position=projectionMatrix*mv; }';
  const FS_DEC='uniform sampler2D uNoise; uniform vec3 uCol,uGlow,uFogC; uniform float uAlpha,uSeed,uKind,uGlowK,uTime; varying vec2 vUv; varying float vD;'+
    'float h1(float n){ return fract(sin(n*91.3458)*47453.5453); }'+
    'void main(){ vec2 p=vUv*2.0-1.0; float r=length(p); if(r>1.0) discard; float ang=atan(p.y,p.x);'+
    ' float n=texture2D(uNoise,vUv*1.3+uSeed).r; float n2=texture2D(uNoise,vUv*3.7-uSeed*1.7).r;'+
    ' float blot=(1.0-smoothstep(0.50+n*0.34,0.66+n*0.34,r))*(0.62+0.38*n2);'+
    ' float q=ang/6.2832*9.0+(n-0.5)*0.7+uSeed; float s=abs(fract(q)-0.5)*2.0; float L=0.5+0.5*h1(floor(q)+uSeed*13.0);'+
    ' float crack=smoothstep(mix(0.20,0.035,r),0.0,s)*smoothstep(L,L-0.2,r);'+
    ' float ringc=smoothstep(0.05,0.0,abs(r-0.36-0.10*n))*0.8; float crater=(1.0-smoothstep(0.0,0.26,r))*0.75;'+
    ' float m=mix(blot,clamp(max(max(crack,ringc),crater),0.0,1.0),uKind);'+
    ' float hot=clamp(mix(blot*smoothstep(0.52,0.80,n2),max(crack,ringc),uKind)*uGlowK*(0.75+0.25*sin(uTime*9.0+n*20.0)),0.0,1.0);'+
    ' gl_FragColor=vec4(mix(uCol,uGlow*2.2,hot),clamp(m*uAlpha+hot*0.5,0.0,1.0));'+TONE+' gl_FragColor.rgb=mix(gl_FragColor.rgb,uFogC,smoothstep(38.0,150.0,vD)); }';
  const DEC_N=28, decals=[];
  { const geo=new THREE.PlaneGeometry(2,2); geo.rotateX(-Math.PI/2);
    for(let i=0;i<DEC_N;i++){ const mat=shader(VS_DEC,FS_DEC,{uNoise:{value:NOISE},uCol:{value:new THREE.Color()},uGlow:{value:new THREE.Color()},uFogC:{value:scene.fog.color},uAlpha:{value:0},uSeed:{value:0},uKind:{value:0},uGlowK:{value:0},uTime:U_TIME},
        {blending:THREE.NormalBlending,side:THREE.FrontSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
      const m=pooled(new THREE.Mesh(geo,mat),1); m.layers.set(NOBLOOM_LAYER); decals.push({m,u:mat.uniforms,life:0,max:1,a0:1,glowT:0,i}); } }
  // szabad matrica, vagy ha nincs: a leginkább kifakult (legkevesebb hátralévő idejű) -> telített harcban sem "pattan el" friss nyom
  function decal(x,y,z,r,kind,color,alpha,life,glowColor,glowT){ let d=decals[0]; for(const q of decals){ if(q.life<=0){ d=q; break; } if(q.life<d.life) d=q; }
    d.m.visible=true; d.m.position.set(x,y+0.02+d.i*0.0015,z); d.m.rotation.y=Math.random()*6.283; d.m.scale.set(r,1,r);
    d.u.uCol.value.set(color).convertSRGBToLinear(); d.u.uKind.value=kind; d.u.uSeed.value=Math.random()*9; d.life=d.max=life; d.a0=alpha; d.glowT=glowT||0; d.u.uGlow.value.set(glowColor==null?0:glowColor).convertSRGBToLinear(); d.u.uGlowK.value=glowT?1:0; d.u.uAlpha.value=0; }
  function updDecals(dt){ for(const d of decals){ if(d.life<=0) continue; d.life-=dt; if(d.life<=0){ d.m.visible=false; continue; }
      const age=d.max-d.life; d.u.uAlpha.value=d.a0*Math.min(1,age/0.12)*Math.min(1,d.life/(d.max*0.4)); d.u.uGlowK.value=d.glowT>0?Math.pow(Math.max(0,1-age/d.glowT),1.6):0; } }

  /* --- 4) LÁNG: zaj-erodált, felfelé áramló lángtest — kitörés (flame) VAGY gazdához kötött, életben tartott láng (hold) --- */
  const VS_FLAME='uniform float uTime,uSeed; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vec3 p=position; float h=uv.y; p.x+=sin(uTime*6.3+h*5.0+uSeed)*0.10*h; p.z+=cos(uTime*5.1+h*4.0+uSeed*1.7)*0.10*h;'+
    ' vec4 mv=modelViewMatrix*vec4(p,1.0); vN=normalMatrix*normal; vV=-mv.xyz; gl_Position=projectionMatrix*mv; }';
  const FS_FLAME='uniform sampler2D uNoise; uniform float uTime,uSeed,uAlpha,uBurn,uBloom; uniform vec3 uCore,uMid,uEdge; varying vec2 vUv; varying vec3 vN; varying vec3 vV;'+
    'void main(){ float n=texture2D(uNoise,vec2(vUv.x*2.0+uSeed,vUv.y*0.5-uTime*1.1)).r*0.6+texture2D(uNoise,vec2(vUv.x*5.0-uSeed,vUv.y*1.2-uTime*2.0)).r*0.4;'+
    ' float f=n*1.25+(1.0-vUv.y)*0.95-0.80-vUv.y*0.30-uBurn*1.7; float face=abs(dot(normalize(vN),normalize(vV)));'+   // face: a henger-sziluett pereme lágyan elhal -> térfogat-hatás, nem "kúp-héj"
    ' float a=smoothstep(0.0,0.32,f)*smoothstep(0.0,0.08,vUv.y)*smoothstep(0.02,0.55,face)*(0.5+0.5*(1.0-vUv.y)); float heat=clamp(f*0.9,0.0,1.0);'+
    ' vec3 c=mix(uEdge,uMid,smoothstep(0.0,0.36,heat)); c=mix(c,uCore,smoothstep(0.52,0.95,heat)); c*=0.9+0.7*heat; float al=a*uAlpha; gl_FragColor=vec4(c*(1.0-0.5*uBloom)*al,al*0.85);'+TONE+'}';
  const FL_N=40, flames=[]; let flI=0;
  { const geo=new THREE.CylinderGeometry(0.5,1,1,18,5,true); geo.translate(0,0.5,0);
    for(let i=0;i<FL_N;i++){ const mat=shader(VS_FLAME,FS_FLAME,{uNoise:{value:NOISE},uTime:U_TIME,uSeed:{value:Math.random()*9},uAlpha:{value:1},uBurn:{value:0},uBloom:BLOOM_PASS_U,uCore:{value:new THREE.Color()},uMid:{value:new THREE.Color()},uEdge:{value:new THREE.Color()}},HYB);
      const m=pooled(new THREE.Mesh(geo,mat),5); enableBloom(m); flames.push({m,u:mat.uniforms,st:0,age:0,max:1,r:1,h:1,a:1,keep:0,die:0,owner:null}); } }
  function freeFlame(){ for(let i=0;i<FL_N;i++){ const f=flames[(flI+i)%FL_N]; if(f.st===0){ flI=(flI+i+1)%FL_N; return f; } }
    const f=flames[flI]; flI=(flI+1)%FL_N; if(f.owner){ if(f.owner._vfl===f) f.owner._vfl=null; f.owner=null; } return f; }
  function flame(x,y,z,r,h,dur,pal,alpha){ const f=freeFlame(); f.st=1; f.age=0; f.max=dur; f.r=r; f.h=h; f.a=alpha==null?1:alpha; f.owner=null;
    setPal(f.u,pal||PAL.fire); f.u.uSeed.value=Math.random()*9; f.u.uBurn.value=0; f.u.uAlpha.value=f.a; f.m.position.set(x,y,z); f.m.scale.set(r*0.6,0.01,r*0.6); f.m.visible=true; }
  function hold(owner,x,y,z,r,h,pal,alpha){ let f=owner._vfl;
    if(!f || f.owner!==owner || f.st===0){ f=freeFlame(); f.owner=owner; owner._vfl=f; f.st=2; f.age=0; setPal(f.u,pal||PAL.fire); f.u.uSeed.value=Math.random()*9; f.u.uAlpha.value=0; f.m.visible=true; }
    else if(f.st===3) f.st=2;
    f.keep=0.25; f.r=r; f.h=h; f.a=alpha==null?1:alpha; f.m.position.set(x,y,z); }
  function updFlames(dt,run){ for(const f of flames){ if(f.st===0) continue; f.age+=dt;
      if(f.st===1){ const k=f.age/f.max; if(k>=1){ f.st=0; f.m.visible=false; continue; }
        const rise=easeOutBack(Math.min(1,f.age/0.14)), w=f.r*(0.62+0.38*Math.min(1,rise)); f.m.scale.set(w,f.h*rise,w); f.u.uBurn.value=k<0.5?0:Math.pow((k-0.5)/0.5,1.6); }
      else if(f.st===2){ const g=Math.min(1,f.age/0.3); f.m.scale.set(f.r,f.h*(0.35+0.65*g),f.r); f.u.uBurn.value=0.25*(1-g); f.u.uAlpha.value=f.a*g; if(run){ f.keep-=dt; if(f.keep<=0){ f.st=3; f.die=0; } } }
      else { f.die+=dt; const k=f.die/0.4; if(k>=1){ f.st=0; f.m.visible=false; if(f.owner){ if(f.owner._vfl===f) f.owner._vfl=null; f.owner=null; } continue; } f.u.uBurn.value=k; } } }

  /* --- 5) TŰZGOLYÓ: táguló, a széleitől befelé felszakadó robbanás-gömb --- */
  const FS_BALL='uniform sampler2D uNoise; uniform float uTime,uSeed,uAlpha,uBurn,uBloom; uniform vec3 uCore,uMid,uEdge; varying vec3 vN; varying vec3 vV; varying vec2 vUv;'+
    'void main(){ float fr=clamp(dot(normalize(vN),normalize(vV)),0.0,1.0);'+
    ' float n=texture2D(uNoise,vUv*vec2(3.0,2.0)+vec2(uSeed,-uTime*0.5)).r*0.65+texture2D(uNoise,vUv*vec2(6.0,4.0)-vec2(uSeed,uTime*0.9)).r*0.35;'+
    ' float f=fr*1.05+n*0.95-0.70-uBurn*1.75; float a=smoothstep(0.0,0.30,f); float heat=clamp(f*0.95,0.0,1.0);'+
    ' vec3 c=mix(uEdge,uMid,smoothstep(0.0,0.38,heat)); c=mix(c,uCore,smoothstep(0.58,1.0,heat)); c*=0.9+0.7*heat; float al=a*uAlpha*0.92; gl_FragColor=vec4(c*(1.0-0.5*uBloom)*al,al*0.8);'+TONE+'}';
  const BALL_N=10, balls=[]; let ballI=0;
  { const geo=new THREE.SphereGeometry(1,18,12);
    for(let i=0;i<BALL_N;i++){ const mat=shader(VS_NV,FS_BALL,{uNoise:{value:NOISE},uTime:U_TIME,uSeed:{value:0},uAlpha:{value:1},uBurn:{value:0},uBloom:BLOOM_PASS_U,uCore:{value:new THREE.Color()},uMid:{value:new THREE.Color()},uEdge:{value:new THREE.Color()}},Object.assign({side:THREE.FrontSide},HYB));
      const m=pooled(new THREE.Mesh(geo,mat),5); enableBloom(m); balls.push({m,u:mat.uniforms,age:0,max:0,r0:1,r1:2}); } }
  function ball(x,y,z,r0,r1,dur,pal){ const b=balls[ballI++%BALL_N]; b.age=0; b.max=dur; b.r0=r0; b.r1=r1; setPal(b.u,pal||PAL.fire); b.u.uSeed.value=Math.random()*9; b.u.uBurn.value=0; b.u.uAlpha.value=1;
    b.m.position.set(x,y,z); b.m.rotation.set(Math.random()*6,Math.random()*6,0); b.m.scale.setScalar(r0); b.m.visible=true; }
  function updBalls(dt){ for(const b of balls){ if(b.max<=0) continue; b.age+=dt; const k=b.age/b.max; if(k>=1){ b.max=0; b.m.visible=false; continue; }
      b.m.scale.setScalar(b.r0+(b.r1-b.r0)*(1-Math.pow(1-k,3))); b.u.uBurn.value=Math.pow(k,1.3); } }

  /* --- 6) JÉGKRISTÁLY-FÜRT: fazettás hatszög-tüskék; Fresnel-perem + csillanás; kitör, megáll, majd szilánkokra pattan --- */
  const VS_ICE='varying vec3 vN; varying vec3 vV; varying vec3 vC; void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalMatrix*normal; vV=-mv.xyz; gl_Position=projectionMatrix*mv; }';
  const FS_ICE='uniform float uAlpha,uGlow,uBloom; uniform vec3 uTint; varying vec3 vN; varying vec3 vV; varying vec3 vC;'+
    'void main(){ vec3 n=normalize(vN); if(!gl_FrontFacing) n=-n; vec3 v=normalize(vV); float fr=pow(1.0-clamp(dot(n,v),0.0,1.0),2.4);'+
    ' vec3 L=normalize(vec3(0.35,0.85,0.4)); float dif=0.5+0.5*dot(n,L); float spec=pow(max(dot(reflect(-L,n),v),0.0),28.0);'+
    ' vec3 base=mix(vec3(0.02,0.19,0.44),vec3(0.30,0.76,1.0),dif)*vC; vec3 rim=vec3(0.66,0.92,1.0)*fr*1.1+vec3(spec)+uTint*uGlow;'+
    ' gl_FragColor=vec4(mix(base+rim,rim*0.5,uBloom),clamp(0.72+fr*0.4+spec,0.0,1.0)*uAlpha);'+TONE+'}';
  const crystalGeo=(function(){
    const spike=(h,rad)=>gradTint(new THREE.LatheGeometry([new THREE.Vector2(0.0001,h),new THREE.Vector2(rad*0.82,h*0.72),new THREE.Vector2(rad,0)],6),0x2f6fa8,0xffffff,0,h,0.9);
    const it=[{geo:spike(1.0,0.20)}];
    for(const s of [[0.22,0.62,0.13,0.50],[2.1,0.52,0.11,0.42],[4.0,0.70,0.12,0.36],[5.2,0.40,0.09,0.55]])   // [irány, magasság, sugár, kidőlés]
      it.push({geo:spike(s[1],s[2]), x:Math.cos(s[0])*0.13, z:Math.sin(s[0])*0.13, rz:-Math.cos(s[0])*s[3], rx:Math.sin(s[0])*s[3]});
    const g=mergeGeos(it); g.computeVertexNormals(); return g; })();   // nem indexelt -> a normál-újraszámolás LAPOS fazettákat ad
  const CR_N=32, crystals=[]; let crI=0;
  for(let i=0;i<CR_N;i++){ const mat=shader(VS_ICE,FS_ICE,{uAlpha:{value:1},uGlow:{value:0},uTint:{value:new THREE.Color(0.55,0.85,1.0)},uBloom:BLOOM_PASS_U},{blending:THREE.NormalBlending,depthWrite:true,vertexColors:true});
    const m=pooled(new THREE.Mesh(crystalGeo,mat),5); m.rotation.order='XZY'; enableBloom(m); crystals.push({m,u:mat.uniforms,st:0,age:0,max:1,r:1,h:1,q:false}); }
  function crystal(x,y,z,r,h,dur,tiltX,tiltZ,quiet){ const c=crystals[crI++%CR_N]; c.st=1; c.age=0; c.max=dur; c.r=r; c.h=h; c.q=!!quiet;
    c.m.position.set(x,y,z); c.m.rotation.set(tiltX||0,Math.random()*6.283,tiltZ||0); c.m.scale.set(r*0.5,0.01,r*0.5); c.u.uAlpha.value=1; c.u.uGlow.value=0.9; c.m.visible=true; }
  function updCrystals(dt){ for(const c of crystals){ if(c.st===0) continue; c.age+=dt;
      if(c.st===1){ const rise=easeOutBack(Math.min(1,c.age/0.17)), w=c.r*(0.5+0.5*Math.min(1,c.age/0.11)); c.m.scale.set(w,c.h*rise,w); c.u.uGlow.value=Math.max(0,1-c.age/0.28)*0.9;
        if(c.age>=c.max){ c.st=2; c.age=0; const p=c.m.position;
          if(!c.q){ spray(p.x,p.y+c.h*0.45,p.z,10,[0xffffff,0xbfe9ff,0x8fd4ff],6.5,{up:-0.2,life:0.42,grav:12,w:0.024,len:0.03}); flare(p.x,p.y+c.h*0.6,p.z,0x9fdcff,c.h*0.8,0.14); } } }
      else { const k=c.age/0.14; if(k>=1){ c.st=0; c.m.visible=false; continue; } const w=c.r*(1+0.14*k); c.m.scale.set(w,c.h*(1+0.06*k),w); c.u.uAlpha.value=1-k; c.u.uGlow.value=0.6*(1-k); } } }

  /* --- 7) ÖRVÉNY-KORONG (zónák + méregörvény) és TÖLCSÉR --- uBlob: 0 = csíkos örvény-karok, 1 = gomolygó felhő-foltok */
  const FS_SWIRL='uniform sampler2D uNoise; uniform float uTime,uSeed,uAlpha,uSwirl,uSpeed,uSoft,uBlob,uBloom; uniform vec3 uColA,uColB,uCore; varying vec2 vUv;'+
    'void main(){ vec2 p=vUv*2.0-1.0; float r=length(p); if(r>1.0) discard; float sw=atan(p.y,p.x)/6.2832+uTime*uSpeed+(1.0-r)*uSwirl;'+
    ' float n=texture2D(uNoise,vec2(sw*3.0+uSeed,r*1.2-uTime*0.30)).r; float n2=texture2D(uNoise,vec2(sw*6.0-uSeed,r*2.4+uTime*0.21)).r;'+
    ' float cs=cos(uTime*uSpeed*2.0), sn=sin(uTime*uSpeed*2.0); vec2 q=vec2(p.x*cs-p.y*sn,p.x*sn+p.y*cs);'+
    ' float nb=texture2D(uNoise,q*0.42+uSeed).r*0.65+texture2D(uNoise,vec2(q.y,-q.x)*0.95-uSeed-uTime*0.02).r*0.35;'+
    ' float arms=mix(smoothstep(0.36,0.74,n*0.6+n2*0.4),smoothstep(0.34,0.70,nb),uBlob); float edge=smoothstep(1.0,1.0-uSoft,r)*mix(1.0,smoothstep(0.10,0.55,nb+0.6*(1.0-r)),uBlob); float core=smoothstep(0.45,0.0,r);'+
    ' gl_FragColor=vec4((mix(uColA,uColB,arms)+uCore*core*0.5)*(1.0-0.5*uBloom),((0.22+0.78*arms)+core*0.25)*edge*uAlpha);'+TONE+'}';
  const DISC_N=14, discs=[];
  { const geo=new THREE.PlaneGeometry(2,2); geo.rotateX(-Math.PI/2);
    for(let i=0;i<DISC_N;i++){ const mat=shader(VS_UV,FS_SWIRL,{uNoise:{value:NOISE},uTime:U_TIME,uSeed:{value:0},uAlpha:{value:0},uSwirl:{value:2},uSpeed:{value:0.1},uSoft:{value:0.35},uBlob:{value:0},uBloom:BLOOM_PASS_U,uColA:{value:new THREE.Color()},uColB:{value:new THREE.Color()},uCore:{value:new THREE.Color()}},{side:THREE.FrontSide});
      discs.push({m:pooled(new THREE.Mesh(geo,mat),2),u:mat.uniforms,used:false}); } }
  function disc(cfg){ let d=null; for(const q of discs){ if(!q.used){ d=q; break; } } if(!d) return null; d.used=true; const u=d.u;
    u.uColA.value.setHex(cfg.a).convertSRGBToLinear(); u.uColB.value.setHex(cfg.b).convertSRGBToLinear(); u.uCore.value.setHex(cfg.core||0).convertSRGBToLinear(); u.uSwirl.value=cfg.swirl; u.uSpeed.value=cfg.speed; u.uSoft.value=cfg.soft||0.35; u.uBlob.value=cfg.blob||0; u.uSeed.value=Math.random()*9; u.uAlpha.value=0;
    d.m.material.blending=cfg.add?THREE.AdditiveBlending:THREE.NormalBlending; d.m.layers.set(cfg.add?0:NOBLOOM_LAYER); if(cfg.add) d.m.layers.enable(BLOOM_LAYER); d.m.visible=true; return d; }
  function discSet(d,x,y,z,r,alpha){ if(!d) return; d.m.position.set(x,y,z); d.m.scale.set(r,1,r); d.u.uAlpha.value=alpha; }
  function discFree(d){ if(d){ d.used=false; d.m.visible=false; } }
  const VS_FUN='uniform float uTime; varying vec2 vUv; void main(){ vUv=uv; vec3 p=position; float h=uv.y; p.x+=sin(uTime*3.1+h*6.0)*0.14*h; p.z+=cos(uTime*2.6+h*5.0)*0.14*h; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }';
  const FS_FUN='uniform sampler2D uNoise; uniform float uTime,uSeed,uAlpha,uBloom; uniform vec3 uColA,uColB; varying vec2 vUv;'+
    'void main(){ float sw=vUv.x+vUv.y*0.9+uTime*0.85; float n=texture2D(uNoise,vec2(sw*3.0+uSeed,vUv.y*1.1-uTime*0.55)).r; float n2=texture2D(uNoise,vec2(sw*6.0-uSeed,vUv.y*2.3-uTime*0.9)).r;'+
    ' float s=smoothstep(0.40,0.78,n*0.6+n2*0.4); float env=smoothstep(1.0,0.62,vUv.y)*smoothstep(0.0,0.10,vUv.y);'+
    ' float al=(0.10+0.90*s)*env*uAlpha; gl_FragColor=vec4(mix(uColA,uColB,s)*(1.0-0.5*uBloom)*al,al*0.45);'+TONE+'}';
  const VX_N=6, vort=[]; let vxI=0;   // 6: a II. rangú méregörvény 3 mellék-örvényt is nyit
  { const geo=new THREE.CylinderGeometry(1,0.2,1,24,8,true); geo.translate(0,0.5,0);
    for(let i=0;i<VX_N;i++){ const mat=shader(VS_FUN,FS_FUN,{uNoise:{value:NOISE},uTime:U_TIME,uSeed:{value:Math.random()*9},uAlpha:{value:0},uBloom:BLOOM_PASS_U,uColA:{value:new THREE.Color(0x3f9a1c).convertSRGBToLinear()},uColB:{value:new THREE.Color(0xc4f86a).convertSRGBToLinear()}},HYB);
      const m=pooled(new THREE.Mesh(geo,mat),5); enableBloom(m); vort.push({m,u:mat.uniforms,d:null,age:0,max:0,r:1,h:1,x:0,z:0,acc:0}); } }
  function vortex(x,z,r,dur,h){ const v=vort[vxI++%VX_N]; discFree(v.d); v.d=disc({a:0x123509,b:0x8fd03a,core:0xd8ff8a,add:true,swirl:4.2,speed:0.42,soft:0.3});
    v.age=0; v.max=dur; v.r=r; v.h=h; v.x=x; v.z=z; v.acc=0; v.m.position.set(x,GROUND_Y+0.05,z); v.m.visible=true; }
  function updVortex(dt){ for(const v of vort){ if(v.max<=0) continue; v.age+=dt;
      if(v.age>=v.max){ v.max=0; v.m.visible=false; discFree(v.d); v.d=null; continue; }
      const env=Math.min(1,v.age/0.25)*Math.min(1,(v.max-v.age)/0.4); discSet(v.d,v.x,GROUND_Y+0.06,v.z,v.r,0.7*env);
      v.m.scale.set(v.r*0.52,v.h*(0.55+0.45*env),v.r*0.52); v.m.rotation.y+=dt*2.4; v.u.uAlpha.value=0.55*env;
      v.acc+=dt*(lowFx()?12:26);
      while(v.acc>=1){ v.acc-=1; const a=Math.random()*6.283, rr=v.r*rand(0.35,1.0), ca=Math.cos(a), sa=Math.sin(a);   // befelé-felfelé csavarodó spórák
        RP.spawn(v.x+ca*rr,GROUND_Y+0.15,v.z+sa*rr, -ca*2.2-sa*3.0,rand(0.8,2.4),-sa*2.2+ca*3.0, Math.random()<0.5?0xb8f25a:0x7ecb3a, 0.34,0.05,0.5,-0.9,1.3); } } }

  /* --- 8) FÉNYOSZLOP + CSILLAG-VILLANÁS --- */
  const FS_COL='uniform sampler2D uNoise; uniform float uTime,uAlpha,uSeed,uBloom; uniform vec3 uColor; varying vec3 vN; varying vec3 vV; varying vec2 vUv;'+
    'void main(){ float fr=abs(dot(normalize(vN),normalize(vV))); float n=texture2D(uNoise,vec2(vUv.x*2.0+uSeed,vUv.y*0.6+uTime*2.4)).r;'+
    ' gl_FragColor=vec4(mix(uColor,vec3(1.0),pow(fr,9.0)*0.75)*(1.0-0.5*uBloom),pow(fr,2.2)*(0.35+0.65*n)*smoothstep(1.0,0.5,vUv.y)*uAlpha*0.75);'+TONE+'}';
  const COL_N=5, cols=[]; let colI=0;
  { const geo=new THREE.CylinderGeometry(1,1,1,16,1,true); geo.translate(0,0.5,0);
    for(let i=0;i<COL_N;i++){ const mat=shader(VS_NV,FS_COL,{uNoise:{value:NOISE},uTime:U_TIME,uSeed:{value:Math.random()*9},uAlpha:{value:0},uBloom:BLOOM_PASS_U,uColor:{value:new THREE.Color()}});
      const m=pooled(new THREE.Mesh(geo,mat),5); enableBloom(m); cols.push({m,u:mat.uniforms,age:0,max:0,r:1,h:1}); } }
  function column(x,y,z,r,h,color,dur){ const c=cols[colI++%COL_N]; c.age=0; c.max=dur; c.r=r; c.h=h; c.u.uColor.value.set(color).convertSRGBToLinear(); c.u.uAlpha.value=0; c.m.position.set(x,y,z); c.m.scale.set(r,h,r); c.m.visible=true; }
  function updCols(dt){ for(const c of cols){ if(c.max<=0) continue; c.age+=dt; const k=c.age/c.max; if(k>=1){ c.max=0; c.m.visible=false; continue; }
      const w=c.r*(1-0.55*k); c.m.scale.set(w,c.h,w); c.u.uAlpha.value=(k<0.12?k/0.12:Math.pow(1-(k-0.12)/0.88,1.5)); } }
  const FLR_N=16, flares=[]; let flrI=0;
  for(let i=0;i<FLR_N;i++){ const s=new THREE.Sprite(new THREE.SpriteMaterial({map:STAR,color:0xffffff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
    s.visible=false; scene.add(s); enableBloom(s); flares.push({s,age:0,max:0,size:1}); }
  function flare(x,y,z,color,size,dur,rot){ const f=flares[flrI++%FLR_N]; f.age=0; f.max=dur; f.size=size; f.s.position.set(x,y,z); f.s.material.color.set(color).convertSRGBToLinear(); f.s.material.rotation=(rot==null?rand(-0.4,0.4):rot); f.s.material.opacity=1; f.s.scale.setScalar(size*0.35); f.s.visible=true; }
  function updFlares(dt){ for(const f of flares){ if(f.max<=0) continue; f.age+=dt; const k=f.age/f.max; if(k>=1){ f.max=0; f.s.visible=false; continue; }
      f.s.scale.setScalar(f.size*(0.35+0.65*easeOutCubic(Math.min(1,k*3)))*(1-0.3*k)); f.s.material.opacity=(1-k)*(1-k); } }

  /* --- 9) VESZÉLY-JELZŐ (főellenség): kör = perem + forgó szaggatott gyűrű + feltöltődő belső; sáv = szegély + előre futó nyilak --- */
  const FS_TELE='uniform float uTime,uAlpha,uFill,uLane,uLen; uniform vec3 uColor; varying vec2 vUv;'+
    'void main(){ float a=0.0; float hot=0.0;'+
    ' if(uLane<0.5){ vec2 p=vUv*2.0-1.0; float r=length(p); if(r>1.0) discard;'+
    '  float rim=smoothstep(0.925,0.96,r)*smoothstep(1.0,0.985,r); float dash=step(0.5,fract(atan(p.y,p.x)/6.2832*16.0+uTime*0.3));'+
    '  float inner=smoothstep(0.80,0.82,r)*smoothstep(0.86,0.84,r)*dash*0.55; float on=step(0.002,uFill);'+
    '  hot=smoothstep(0.05,0.0,abs(r-uFill))*on*step(uFill,0.999); a=rim+inner+smoothstep(uFill,uFill-0.035,r)*on*(0.16+0.07*sin(uTime*13.0))+hot*0.8; }'+
    ' else { float x=abs(vUv.x*2.0-1.0); float edge=smoothstep(0.86,0.90,x)*smoothstep(1.0,0.97,x); float ch=fract(vUv.y*uLen*0.42-uTime*1.5+x*0.55);'+
    '  float chev=smoothstep(0.0,0.06,ch)*smoothstep(0.34,0.24,ch)*(1.0-smoothstep(0.80,0.88,x)); float fillA=step(vUv.y,uFill);'+
    '  a=(edge*0.9+chev*(0.20+0.30*fillA)+fillA*0.10)*smoothstep(0.0,0.03,vUv.y)*smoothstep(1.0,0.90,vUv.y); }'+
    ' gl_FragColor=vec4(uColor*(1.0+hot),a*uAlpha);'+TONE+'}';
  const TELE_N=18, teles=[];
  { const geo=new THREE.PlaneGeometry(2,2); geo.rotateX(-Math.PI/2);
    for(let i=0;i<TELE_N;i++){ const mat=shader(VS_UV,FS_TELE,{uTime:U_TIME,uAlpha:{value:0},uFill:{value:0},uLane:{value:0},uLen:{value:1},uColor:{value:new THREE.Color()}},{side:THREE.FrontSide});
      const m=pooled(new THREE.Mesh(geo,mat),3); enableBloom(m); teles.push({m,u:mat.uniforms}); } }
  // sáv-módban a kitöltés és a nyilak a helyi -Z felé futnak: rotY = atan2(-fx,-fz)
  function tele(i,lane,x,y,z,sx,sz,rotY,color){ const t=teles[i]; if(!t) return; t.m.position.set(x,y,z); t.m.scale.set(sx,1,sz); t.m.rotation.y=rotY||0;
    t.u.uLane.value=lane?1:0; t.u.uLen.value=sz*2; t.u.uColor.value.set(color).convertSRGBToLinear(); t.u.uFill.value=0; t.u.uAlpha.value=0; t.m.visible=true; }
  function teleSet(i,fill,alpha,color){ const t=teles[i]; if(!t) return; t.u.uFill.value=fill; t.u.uAlpha.value=alpha; if(color!=null) t.u.uColor.value.set(color).convertSRGBToLinear(); }
  function teleOff(i){ const t=teles[i]; if(t) t.m.visible=false; }

  function update(dt,run){ U_TIME.value+=dt; updBolts(dt); updTrails(dt); updStreaks(dt); updChips(dt); updRings(dt); updDecals(dt); updFlames(dt,run); updBalls(dt); updCrystals(dt); updVortex(dt); updCols(dt); updFlares(dt); }
  function reset(){
    for(const b of bolts) b.life=0; for(const t of trails){ t.on=false; t.fade=0; } for(const s of st) s.life=0; for(const s of ch) s.life=0;
    for(const R of [BR,TR,SR,CR]){ R.col.fill(0); R.dirty=true; R.mesh.visible=false; }
    for(const r of rings){ r.life=0; r.m.visible=false; } for(const d of decals){ d.life=0; d.m.visible=false; }
    for(const f of flames){ f.st=0; f.m.visible=false; if(f.owner){ f.owner._vfl=null; f.owner=null; } }
    for(const b of balls){ b.max=0; b.m.visible=false; } for(const c of crystals){ c.st=0; c.m.visible=false; }
    for(const v of vort){ v.max=0; v.m.visible=false; discFree(v.d); v.d=null; } for(const d of discs){ d.used=false; d.m.visible=false; }
    for(const c of cols){ c.max=0; c.m.visible=false; } for(const f of flares){ f.max=0; f.s.visible=false; } for(const t of teles) t.m.visible=false;
  }
  // előmelegítés: minden pool-elem látható (alfa 0) -> a warmup renderei lefordítják az összes VFX-shadert
  function warm(){ for(const R of [BR,TR,SR,CR]) R.mesh.visible=true;
    for(const a of [rings,decals,flames,balls,crystals,discs,vort,cols,teles]) for(const o of a){ o.m.visible=true; if(o.u.uAlpha) o.u.uAlpha.value=0; }
    for(const f of flares){ f.s.visible=true; f.s.material.opacity=0; } }
  return { PAL, bolt, trail, streak, spray, chip, debris, ring, decal, flame, hold, ball, crystal, disc, discSet, discFree, vortex, column, flare, tele, teleSet, teleOff, update, reset, warm };
})();

const EFX=(function(){
  // villanás-sprite-ok (kamerára néző additív glow)
  const FN=44, fl=[]; for(let i=0;i<FN;i++){ const s=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xffffff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending})); s.visible=false; scene.add(s); enableBloom(s); fl.push({s,life:0,max:1,r0:1,r1:2,a0:1}); } let fi=0;
  function flash(x,y,z,color,r0,r1,dur,a0){ const f=fl[fi++%FN]; f.s.visible=true; f.s.position.set(x,y,z); f.s.material.color.set(color).convertSRGBToLinear(); f.r0=r0;f.r1=r1;f.life=dur;f.max=dur;f.a0=(a0==null?1:a0); f.s.scale.setScalar(r0); f.s.material.opacity=f.a0*0.7; }   // szín sRGB->lineáris: telített fény-pamacs, nem fehér folt
  // a lökéshullám-gyűrűk és a villám-ívek a VFX-készlet szalag/shader-technikáját használják (azonos hívási felület)
  const ring=VFX.ring, bolt=VFX.bolt;
  // dinamikus fény (egy megosztott, villanó pontfény)
  const L=new THREE.PointLight(0xffffff,0,18,2); L.visible=true; scene.add(L); let Ll=0,Lm=1,Li=0;   // MINDIG visible: a fény-szám konstans marad -> nincs shader-újrafordítás játék közben (intenzitás-kapuzás)
  function light(x,y,z,color,intensity,dur){ L.position.set(x,y,z); L.color.set(color); L.intensity=intensity; Li=intensity; Ll=dur; Lm=dur; L.visible=true; }
  function update(dt){
    for(const f of fl){ if(f.life>0){ f.life-=dt; const k=Math.max(0,f.life/f.max); f.s.scale.setScalar(f.r0+(f.r1-f.r0)*(1-k*k*k)); f.s.material.opacity=f.a0*k*k*0.7; if(f.life<=0)f.s.visible=false; } }
    if(Ll>0){ Ll-=dt; L.intensity=Li*Math.max(0,Ll/Lm); if(Ll<=0)L.intensity=0; } }
  return { flash, ring, bolt, light, update };
})();
const arrowLight=new THREE.PointLight(0x88ccff,0,9,2); arrowLight.visible=true; scene.add(arrowLight); let arrowLightT=0;   // MINDIG visible (konstans fény-szám), intenzitással kapuzva

