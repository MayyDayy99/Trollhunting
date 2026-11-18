/* ===================== Bloom (szelektív fény-izzás) =====================
   Két-composeres, layer-alapú szelektív bloom: csak a BLOOM_LAYER-re jelölt
   objektumok izzanak (tűz, jég-kristály, varázs, izzó szemek, torkolattűz…).
   A címkézetlen dolgok (HP-sáv, füst, terep, hold-haló) a bloom-passban
   feketék -> nem izzanak. `low` grafikán teljesen kimarad (renderFrame sima ág).
   r128 buktató: a composer NEM alkalmaz sRGB-t a lineáris targetekre, ezért a
   záró GammaCorrectionShader végzi a lineáris->sRGB kimenetet (az ACES tone-map
   viszont már a material-shaderben lefut a target-ekbe is, ezért az marad). */
const BLOOM_LAYER = 1;
const NOBLOOM_LAYER = 2;   // LÁTVÁNY-TURBÓ: nagy áttetsző rétegek (köd, fénypászma, fény-tócsa) — a bloom-passban KIHAGYVA (különben fekete takaró-lapok lennének)
const bloomLayer  = new THREE.Layers(); bloomLayer.set(BLOOM_LAYER);
const enableBloom = (o)=>{ if(o) o.traverse(c=>c.layers.enable(BLOOM_LAYER)); };  // rekurzív; .enable (NEM .set): a 0-s layer maradjon meg
let bloomOn = false;                                              // applyGraphics állítja

const _darkMat  = new THREE.MeshBasicMaterial({color:0x000000});  // megosztott, egyszer lefordul
const _darkMatSkin = new THREE.MeshBasicMaterial({color:0x000000, skinning:true});   // az összevont (skinnelt) troll-hálókhoz: a takaró-forma is mozogjon
const BLOOM_PASS_U = {value:0};                                   // 1 a bloom-pass alatt: a VFX-shaderek ilyenkor CSAK az izzó részüket adják ki (pl. jégkristály pereme)
const _darkStack = [];                                            // páros verem [obj, mat, ...] -> nincs uuid-kulcs, nincs delete, nincs 2. scene.traverse!
function _darken(o){ const m=o.material; if(m && !bloomLayer.test(o.layers)){ _darkStack.push(o, m); o.material=o.isSkinnedMesh?_darkMatSkin:_darkMat; } }
function _restoreAll(){ for(let i=_darkStack.length-2;i>=0;i-=2) _darkStack[i].material=_darkStack[i+1]; _darkStack.length=0; }

// GRACEFUL FALLBACK: ha a bloom-addonok (jsdelivr) NEM töltöttek be, a játék sima renderrel fut tovább (nincs összeomlás).
const bloomAvail = !!(THREE.EffectComposer && THREE.RenderPass && THREE.ShaderPass && THREE.UnrealBloomPass && THREE.GammaCorrectionShader);
let bloomComposer=null, finalComposer=null, bloomPass=null, gradePass=null;
if(bloomAvail){
  // bloom-only composer (offscreen): a feketített jelenetet rendereli, kiszedi+elmossa a fényes részeket
  bloomComposer = new THREE.EffectComposer(renderer);
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(new THREE.RenderPass(scene, camera));
  bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.9, 0.5, 0.0);
  bloomComposer.addPass(bloomPass);

  // final composer: teljes jelenet (WebGL2-n 4x MSAA targetbe -> nincs lépcsős él) + EGYETLEN záró pass:
  // additív bloom + szín-grade (hideg árnyék / meleg csúcsfény) + vignetta + finom kromatikus szél + filmzaj + sRGB kimenet.
  let _msRT=null;
  try{ if(renderer.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget){
    const _sz=renderer.getSize(new THREE.Vector2()); _msRT=new THREE.WebGLMultisampleRenderTarget(_sz.x,_sz.y,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat}); _msRT.samples=4; } }catch(_e){ _msRT=null; }
  finalComposer = _msRT ? new THREE.EffectComposer(renderer,_msRT) : new THREE.EffectComposer(renderer);
  finalComposer.addPass(new THREE.RenderPass(scene, camera));
  gradePass = new THREE.ShaderPass(new THREE.ShaderMaterial({
    uniforms:{ baseTexture:{value:null}, bloomTexture:{value:bloomComposer.renderTarget2.texture},
               uTime:{value:0}, uBloom:{value:1}, uHurt:{value:0}, uFocus:{value:0}, uTint:{value:new THREE.Color(0,0,0)}, uTintK:{value:0}, uLowHp:{value:0} },
    vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader:[
      'uniform sampler2D baseTexture; uniform sampler2D bloomTexture; uniform float uTime,uBloom,uHurt,uFocus,uTintK,uLowHp; uniform vec3 uTint; varying vec2 vUv;',
      'float gh(vec2 p){ p=fract(p*vec2(443.897,441.423)); p+=dot(p,p.yx+19.19); return fract((p.x+p.y)*p.x); }',
      'void main(){',
      '  vec2 c=vUv-0.5; float r2=dot(c,c);',
      '  float ca=(0.0007+uHurt*0.0075+uFocus*0.0009)*r2*3.0;',                       // kromatikus szél: csak a kép peremén, sebzéskor erősebb
      '  vec3 col=vec3(texture2D(baseTexture,vUv+c*ca).r, texture2D(baseTexture,vUv).g, texture2D(baseTexture,vUv-c*ca).b);',
      '  col+=texture2D(bloomTexture,vUv).rgb*uBloom;',
      '  float l=dot(col,vec3(0.2126,0.7152,0.0722));',
      '  col*=mix(vec3(0.90,0.98,1.12), vec3(1.07,1.01,0.93), smoothstep(0.02,0.55,l));',   // split-tone: hideg árnyék, meleg csúcsfény
      '  col=mix(col, vec3(l)*vec3(1.25,0.55,0.50), uLowHp*0.35*smoothstep(0.08,0.4,r2));',   // alacsony élet: a perem vörösesre fakul
      '  col=mix(col, col*(0.55+uTint*1.25)+uTint*0.035, uTintK);',                          // VIHAR / elem-villanás színezés
      '  col*=1.0-smoothstep(0.10,0.62,r2)*(0.42+uFocus*0.30);',                    // vignetta (célzáskor szűkül)
      '  col=mix(col*12.92, 1.055*pow(max(col,vec3(0.0)),vec3(1.0/2.4))-0.055, step(0.0031308,col));',   // lineáris -> sRGB
      '  col+=(gh(vUv*vec2(1920.0,1080.0)+fract(uTime)*71.0)-0.5)*0.022;',            // filmzaj (a sávosodást is feltöri)
      '  gl_FragColor=vec4(col,1.0); }'
    ].join('\n')
  }), 'baseTexture');
  gradePass.renderToScreen = true;
  finalComposer.addPass(gradePass);
} else { console.warn('[bloom] postprocessing addonok nem töltöttek be -> sima render (nincs izzás)'); }

function bloomSize(){
  if(!bloomAvail) return;
  const pr = renderer.getPixelRatio();
  bloomComposer.setPixelRatio(pr*0.5); finalComposer.setPixelRatio(pr);   // TELJESÍTMÉNY: a (mosott) bloom-forrás fél felbontáson
  bloomComposer.setSize(innerWidth, innerHeight);
  finalComposer.setSize(innerWidth, innerHeight);
}
bloomSize();

// egyetlen belépési pont: a frame() és a warmup is ezt hívja
const _blackBG = new THREE.Color(0x000000);
const FXS={ hurt:0, focus:0, tintK:0, lowHp:0, t:0 };   // a záró grade-pass élő paraméterei (update() írja)
let _shadowTick=0;
function renderFrame(){
  if(skyGroup) skyGroup.position.copy(camera.position);   // az ég a kamerával utazik (nincs parallaxis)
  // árnyéktérkép: minden 2. képkockán (a fény iránya fix, így nincs "úszás"; a mozgó trollok árnyéka 1 képkockát késhet)
  const _shadowNow = ((_shadowTick++)&1)===0;
  if(!bloomOn || !bloomAvail){ renderer.shadowMap.needsUpdate=_shadowNow; renderer.render(scene, camera); return; }
  { const u=gradePass.uniforms; u.uTime.value=FXS.t; u.uHurt.value=FXS.hurt; u.uFocus.value=FXS.focus; u.uTintK.value=FXS.tintK; u.uLowHp.value=FXS.lowHp; }
  // A bloom-passban FEKETE háttér + fog KI kell: különben a navy ég/köd (küszöb 0.0 mellett)
  // beszűrődne a bloomba és az egész képet feltúlvilágítaná. Csak a címkézett fény-források izzanak.
  const _bg=scene.background, _fog=scene.fog;
  scene.background=_blackBG; scene.fog=null;
  scene.traverse(_darken);
  camera.layers.disable(NOBLOOM_LAYER);
  BLOOM_PASS_U.value=1;
  bloomComposer.render();
  BLOOM_PASS_U.value=0;
  camera.layers.enable(NOBLOOM_LAYER);
  _restoreAll();
  scene.background=_bg; scene.fog=_fog;
  renderer.shadowMap.needsUpdate=_shadowNow;   // CSAK a fő-passban (a feketített bloom-pass árnyékot nem használ)
  finalComposer.render();
}

