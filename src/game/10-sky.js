/* ===================== ÉG (LÁTVÁNY-TURBÓ): procedurális shader-égbolt =====================
   Egyetlen hátoldalas gömb, a kamerával utazik (skyGroup). Rétegek: zenit->horizont gradiens (a horizont = köd-szín),
   hold-oldali derengés + korona, Tejút-sáv, pislákoló csillagok, lassan hullámzó sarki fény, holdsütötte felhőfoszlányok.
   uQ=0 (ALACSONY grafika): csak gradiens + csillagok (olcsó). uStorm: a VIHAR pillanatra az elem színére festi az eget. */
skyGroup = new THREE.Group(); scene.add(skyGroup);
(function skyDome(){
  const mat=new THREE.ShaderMaterial({ uniforms:SKY_U, side:THREE.BackSide, depthWrite:false, fog:false, toneMapped:false,
    vertexShader:'varying vec3 vDir; void main(){ vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader:[
      'uniform float uTime,uQ,uStorm; uniform vec3 uMoon,uHorizon,uStormCol; varying vec3 vDir;',
      'float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }',
      'float h31(vec3 p){ p=fract(p*vec3(0.1031,0.11369,0.13787)); p+=dot(p,p.yxz+19.19); return fract((p.x+p.y)*p.z); }',
      'float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);',
      '  return mix(mix(h21(i),h21(i+vec2(1.0,0.0)),f.x), mix(h21(i+vec2(0.0,1.0)),h21(i+vec2(1.0,1.0)),f.x), f.y); }',
      'float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*vn(p); p=p*2.03+17.1; a*=0.5; } return s; }',
      'float stars(vec3 d,float sc,float thr){ vec3 p=d*sc, ip=floor(p), fp=fract(p)-0.5; float h=h31(ip);',
      '  float tw=0.62+0.38*sin(uTime*(1.2+h*3.5)+h*60.0);',
      '  return step(thr,h)*smoothstep(0.24,0.0,length(fp))*tw*(0.45+0.55*fract(h*37.0)); }',
      'void main(){',
      '  vec3 d=normalize(vDir); float h=d.y, hh=clamp(h,0.0,1.0);',
      '  vec3 zen=vec3(0.0045,0.0085,0.030), mid=vec3(0.016,0.036,0.095);',
      '  vec3 col=mix(uHorizon, mid, smoothstep(0.0,0.20,hh)); col=mix(col, zen, smoothstep(0.14,0.80,hh));',
      '  float md=max(dot(d,uMoon),0.0);',
      '  col+=vec3(0.060,0.105,0.200)*pow(md,5.0)*(1.0-0.5*smoothstep(0.0,0.6,hh));',   // hold-oldali horizont-derengés
      '  col+=vec3(0.26,0.34,0.52)*pow(md,70.0)*0.55;',                                  // korona
      '  float mw=0.0;',
      '  if(uQ>0.5){ vec3 mwn=normalize(vec3(0.35,0.5,-0.8)); mw=exp(-pow(dot(d,mwn)*3.2,2.0));',
      '    col+=vec3(0.050,0.062,0.115)*mw*fbm(d.xz*5.0+d.y*3.0)*smoothstep(0.05,0.4,hh); }',   // Tejút
      '  float st=stars(d,88.0,0.945)+stars(d,150.0,0.955)*0.6+stars(d,52.0,0.985)*1.8;',
      '  col+=vec3(0.80,0.88,1.0)*st*smoothstep(0.02,0.25,hh)*(1.0+mw*1.4)*(1.0-pow(md,30.0))*0.9;',
      '  if(uQ>0.5){',
      '    float u=atan(d.z,d.x);',
      '    float mask=smoothstep(0.38,0.68,fbm(vec2(u*1.3+uTime*0.008,3.7)))*(1.0-pow(md,2.0));',
      '    float h0=0.21+0.07*sin(u*2.0+uTime*0.05)+0.04*sin(u*5.3-uTime*0.08);',
      '    float dd=h-h0; float shape=dd<0.0 ? exp(-dd*dd/0.0010) : exp(-dd/0.19);',
      '    float rays=0.55+0.45*sin(u*46.0+fbm(vec2(u*9.0,uTime*0.10))*7.0); rays*=0.62+0.38*sin(u*13.0-uTime*0.17);',
      '    vec3 ac=mix(vec3(0.07,0.62,0.30), vec3(0.30,0.14,0.62), smoothstep(0.0,0.30,dd));',
      '    col+=ac*shape*rays*mask*0.30;',                                                // sarki fény
      '    vec2 cp=d.xz/(hh+0.18)*1.1+vec2(uTime*0.006,uTime*0.002); float n=fbm(cp);',
      '    float ca=smoothstep(0.52,0.78,n)*smoothstep(0.0,0.10,hh)*(1.0-smoothstep(0.32,0.68,hh));',
      '    vec3 cc=mix(vec3(0.010,0.018,0.040), vec3(0.11,0.15,0.24), pow(md,3.0)*0.85+0.12);',
      '    col=mix(col,cc,ca*0.6); }',                                                    // felhőfoszlányok
      '  col=mix(col,uHorizon,smoothstep(0.03,-0.06,h));',
      '  col=mix(col,uStormCol*0.10+col*(1.0+uStormCol*2.4),uStorm*0.55);',
      '  gl_FragColor=vec4(col,1.0);',
      '  #include <encodings_fragment>',
      '}'].join('\n') });
  const dome=new THREE.Mesh(new THREE.SphereGeometry(360,32,20), mat);
  dome.renderOrder=-10; dome.frustumCulled=false; skyGroup.add(dome);
})();

/* hold — kráteres, peremsötétedő shader-korong (billboard) + szoros mag-glow (bloom) + lágy additív haló */
const MOON_DIST=300;
const moon=new THREE.Mesh(new THREE.PlaneGeometry(30,30), new THREE.ShaderMaterial({ transparent:true, depthWrite:false, fog:false, toneMapped:false,
  vertexShader:'varying vec2 vUv; void main(){ vUv=uv*2.0-1.0; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader:[
    'varying vec2 vUv;',
    'float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }',
    'float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1.0,0.0)),f.x), mix(h21(i+vec2(0.0,1.0)),h21(i+vec2(1.0,1.0)),f.x), f.y); }',
    'void main(){ float r=length(vUv); if(r>1.0) discard;',
    '  float z=sqrt(max(0.0,1.0-r*r)); vec3 n=vec3(vUv,z);',
    '  float lit=clamp(dot(n,normalize(vec3(0.45,0.35,0.82))),0.0,1.0);',                 // enyhe fázis-árnyék (bal-alsó perem sötétebb)
    '  float maria=vn(vUv*2.3+3.1)*0.6+vn(vUv*5.7+9.0)*0.4;',
    '  float cr=0.0; for(int i=0;i<5;i++){ vec2 c=vec2(h21(vec2(float(i),1.7)),h21(vec2(float(i),7.3)))*1.3-0.65; float rr=0.07+0.11*h21(vec2(float(i),3.9));',
    '    float dd=length(vUv-c)/rr; cr+=smoothstep(1.0,0.75,dd)*0.16-smoothstep(1.15,1.0,dd)*smoothstep(0.85,1.0,dd)*0.10; }',
    '  vec3 col=mix(vec3(0.82,0.88,1.0), vec3(0.52,0.60,0.78), smoothstep(0.42,0.70,maria))-cr;',
    '  col*=0.34+0.76*pow(lit,0.8);',
    '  float a=smoothstep(1.0,0.965,r);',
    '  gl_FragColor=vec4(col*0.92,a);',
    '  #include <encodings_fragment>',
    '}'].join('\n') }));
moon.position.copy(MOON_DIR).multiplyScalar(MOON_DIST); moon.lookAt(0,0,0); moon.renderOrder=-9; skyGroup.add(moon);
const moonGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0x9db8e8,transparent:true,opacity:0.16,depthWrite:false,fog:false}));
moonGlow.scale.setScalar(58); moonGlow.position.copy(moon.position); moonGlow.renderOrder=-8; skyGroup.add(moonGlow); enableBloom(moonGlow);   // a hold-mag lágy glow-ja izzik
const moonHalo=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0x5f7fd0,transparent:true,opacity:0.16,depthWrite:false,fog:false,blending:THREE.AdditiveBlending}));
moonHalo.scale.setScalar(190); moonHalo.position.copy(moon.position); moonHalo.renderOrder=-8; skyGroup.add(moonHalo);

/* hullócsillag: ritkán egy vékony fénycsík húz át az égen (skyGroup-ban, a kamerával utazik) */
const shootStar=(function(){
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));
  const ln=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xdfeaff,transparent:true,opacity:0,fog:false,depthWrite:false,blending:THREE.AdditiveBlending}));
  ln.frustumCulled=false; ln.renderOrder=-7; skyGroup.add(ln); enableBloom(ln);
  let t=-1, next=rand(6,14); const a=new THREE.Vector3(), v=new THREE.Vector3();
  return function(dt){
    if(t<0){ next-=dt; if(next<=0){ t=0; const az=rand(0,6.283), el=rand(0.35,0.9);
        a.set(Math.cos(az)*Math.cos(el),Math.sin(el),Math.sin(az)*Math.cos(el)).multiplyScalar(320);
        v.set(rand(-1,1),rand(-0.55,-0.2),rand(-1,1)).normalize().multiplyScalar(rand(170,260)); } return; }
    t+=dt; const k=t/0.9, p=g.attributes.position.array;
    p[0]=a.x+v.x*t; p[1]=a.y+v.y*t; p[2]=a.z+v.z*t; const tl=Math.min(t,0.28);
    p[3]=a.x+v.x*(t-tl); p[4]=a.y+v.y*(t-tl); p[5]=a.z+v.z*(t-tl); g.attributes.position.needsUpdate=true;
    ln.material.opacity=Math.sin(Math.min(1,k)*Math.PI)*0.9;
    if(k>=1){ t=-1; next=rand(9,24); ln.material.opacity=0; } };
})();

/* distant tree-line silhouette: a ring of dark low cones at r~140 sitting on
   the fog wall, giving the horizon a ragged forest edge. fog:false so they
   read as a flat far backdrop; flatShading for the low-poly silhouette. */

/* ---- EDIT L+ (fireflies) — REPLACE lines 272-277.
        90 fireflies over the whole glade. ---- */
const FCOUNT=90, fBase=new Float32Array(FCOUNT*3), fPos=new Float32Array(FCOUNT*3), fSeed=[];
for(let i=0;i<FCOUNT;i++){ const a=rand(0,6.28), r=rand(4,ARENA_R+10);
  fBase[i*3]=Math.cos(a)*r; fBase[i*3+1]=rand(0.5,4.5); fBase[i*3+2]=Math.sin(a)*r;
  fSeed.push([rand(0.4,1.1), rand(0,6.28), rand(0,6.28)]); }
const fGeo=new THREE.BufferGeometry(); fGeo.setAttribute('position',new THREE.BufferAttribute(fPos,3));
scene.add(new THREE.Points(fGeo,new THREE.PointsMaterial({map:GLOW,color:0xffd27a,size:0.22,sizeAttenuation:true,transparent:true,opacity:0.95,blending:THREE.AdditiveBlending,depthWrite:false})));

/* ---- EDIT M+ (NEW — bog-spores + ground-mist) — INSERT immediately
        after the firefly block above (still inside scene setup). These
        obey fog (in-world volume). The spores drift; SCOUNT entries are
        animated in the loop (see EDIT N). ---- */
const SCOUNT=120, sBase=new Float32Array(SCOUNT*3), sPos=new Float32Array(SCOUNT*3), sSeed=[];
for(let i=0;i<SCOUNT;i++){ const a=rand(0,6.28), r=rand(2,ARENA_R+12);
  sBase[i*3]=Math.cos(a)*r; sBase[i*3+1]=rand(0.3,6); sBase[i*3+2]=Math.sin(a)*r;
  sSeed.push([rand(0.08,0.25), rand(0,6.28), rand(0.2,0.6)]); }
const sGeo=new THREE.BufferGeometry(); sGeo.setAttribute('position',new THREE.BufferAttribute(sPos,3));
scene.add(new THREE.Points(sGeo,new THREE.PointsMaterial({map:GLOW,color:0x7fb8d8,size:0.13,sizeAttenuation:true,transparent:true,opacity:0.5,blending:THREE.AdditiveBlending,depthWrite:false})));
// faint additive ground-mist disc hugging the moss (reads as low fog band)
const mist=mesh(new THREE.CircleGeometry(120,48), new THREE.MeshBasicMaterial({map:GLOW,color:0x2b3f5e,transparent:true,opacity:0.07,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}), 0, GROUND_Y+0.06, 0);
mist.rotation.x=-Math.PI/2; mist.castShadow=false; mist.receiveShadow=false; scene.add(mist);

