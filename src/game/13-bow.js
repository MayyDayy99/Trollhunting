/* ===================== Íj (kamerára szerelt ranger-longbow nézet-modell) ===================== */
const bow=new THREE.Group();
// Jobb oldalt, enyhén megdöntve; a belső él (belly) a játékos felé fordul, így a D-ív látszik.
bow.position.set(0.34,-0.26,-0.62); // állás/tükrözés: BOW_PRESETS + B gomb (lásd lent)
camera.add(bow); scene.add(camera);

/* --- anyagok: meleg, csiszolt fa + szaru + bőr --- */
const staveWood = std({color:0x8a5a2b, roughness:.38, metalness:.04, bumpMap:SKIN_N, bumpScale:0.010}); // csiszolt juhar/dió has-fa
const heartWood = std({color:0x4d2f17, roughness:.46, metalness:.02, bumpMap:SKIN_N, bumpScale:0.012}); // sötét gesztfa-mag
const backWood  = std({color:0xc79a5e, roughness:.44, metalness:.03}); // világos szijács-csík a háton (rim-fény)
const hornMat   = std({color:0x2c1c10, roughness:.30, metalness:.18}); // polírozott szaru-nock
const gripLeather=std({color:0x2a1a12, roughness:.92, bumpMap:SKIN_N, bumpScale:0.016}); // tooled bőr-fogás
const stringMat = new THREE.MeshBasicMaterial({color:0xf2f5ff});
const servingMat= std({color:0xc7d2ec, roughness:.5, metalness:.25}); // nock-pont tekercselés

/* --- a teljes íj-stave fél-profilja (a markolattól a tipig), Z = előre-hajlás (belly) --- */
const HALF=0.50;                 // fél-magasság (magas longbow sziluett)
// pontok: [x(oldal), y(fel), z(előre)] — a longbow finom egyszeres D-íve, a tip enyhén előre fordul
/* KONVENCIÓ: lokális +Z = a JÁTÉKOS (húr) felé, -Z = a CÉL felé.
   Felajzott íj: a két tip a HÚRVONALON ül (z=+0.100) — nyugalomban a húr EGYENES közöttük.
   A stave a markolat körül hajlik a legelőrébb (a húrtól legtávolabb) = fesztáv (brace height). */
const limbProfile=[
  [0.000, 0.000, 0.008],        // markolat-tő
  [0.006, 0.120,-0.016],
  [0.011, 0.245,-0.036],        // a has legmélyebb előre-hajlása (a húrtól legtávolabb)
  [0.015, 0.360,-0.026],
  [0.016, 0.450, 0.020],
  [0.012, 0.500, 0.074],        // tip felé elvékonyodik és visszaível a húrvonalra
  [0.008, 0.512, 0.100]         // tip / nock-pont — PONTOSAN a húrvonalon
];
const TIP_U=[0.008, 0.512, 0.100], TIP_L=[0.008,-0.512, 0.100];
const Z_TIP=0.100;              // a nyugalmi (felajzott) húrvonal z-je — a húr nyugalomban ezen fut, EGYENESEN

function staveTube(pts, r0, r1){
  const curve=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(p[0],p[1],p[2])));
  curve.curveType='catmullrom'; curve.tension=0.5;
  // sugár-tapér: a markolatnál vastag, a tipnél vékony — tubularSegments mentén kézzel skálázzuk
  const g=new THREE.TubeGeometry(curve, 40, 1, 10, false);
  const pos=g.attributes.position, N=g.parameters.tubularSegments+1, R=g.parameters.radialSegments+1;
  const center=new THREE.Vector3();
  for(let i=0;i<N;i++){
    const t=i/(N-1), rad=lerp(r0,r1,t)* (1 + 0.12*Math.sin(t*Math.PI)); // enyhe középső duzzanat
    center.copy(curve.getPointAt(t));
    for(let j=0;j<R;j++){ const k=i*R+j;
      const vx=pos.getX(k)-center.x, vy=pos.getY(k)-center.y, vz=pos.getZ(k)-center.z;
      pos.setXYZ(k, center.x+vx*rad, center.y+vy*rad, center.z+vz*rad);
    }
  }
  g.computeVertexNormals(); return g;
}

// két végtag-csoport, a markolat közelében forgatható pivottal (flex-animációhoz)
const limbU=new THREE.Group(); limbU.position.set(0, 0.045,0); bow.add(limbU);
const limbL=new THREE.Group(); limbL.position.set(0,-0.045,0); bow.add(limbL);

function buildLimb(grp, sign){
  const pts=limbProfile.map(p=>[p[0], sign*p[1], p[2]]);
  // fő has-fa (vastag tő -> vékony tip)
  const main=new THREE.Mesh(staveTube(pts,0.030,0.0085), staveWood); main.castShadow=true; grp.add(main);
  // sötét geszt-mag a has belsejében — kétszínű mélység
  const heartPts=pts.map(p=>[p[0], p[1], p[2]+0.006]);
  const heart=new THREE.Mesh(staveTube(heartPts,0.018,0.004), heartWood); grp.add(heart);
  // világos szijács-csík a háton (a tip felé) — elkapja a perem-fényt
  const backPts=pts.slice(1).map(p=>[p[0], p[1], p[2]-0.010]);
  const back=new THREE.Mesh(staveTube(backPts,0.009,0.003), backWood); grp.add(back);
  // szaru-nock a végén (kis polírozott kúp)
  const tip=pts[pts.length-1];
  const nockHorn=mesh(new THREE.CylinderGeometry(0.0055,0.010,0.040,8), hornMat, tip[0], tip[1], tip[2]);
  nockHorn.lookAt(new THREE.Vector3(pts[pts.length-2][0],pts[pts.length-2][1],pts[pts.length-2][2]));
  nockHorn.castShadow=true; grp.add(nockHorn);
  // a húr-bevágás (kis él) a nock orrán
  grp.add(mesh(new THREE.SphereGeometry(0.006,8,6), hornMat, tip[0], tip[1], tip[2]-0.004));
}
buildLimb(limbU, 1); buildLimb(limbL, -1);

/* --- karcsú, ívelt riser (markolat-váz) + bőr-fogás + nyíl-polc — nem "duci henger" ---
   Vékony, lapos-oldalú riser, ami a markolatnál enyhén kiöblösödik, a végtagok felé elvékonyodik. */
const riserCore=mesh(new THREE.CylinderGeometry(0.017,0.017,0.235,12), staveWood, 0,0,-0.006);
riserCore.scale.set(0.82,1,1.35);            // keskeny oldalt, kissé mély elöl-hátul (lapos lencse-szelvény, nem kör)
riserCore.castShadow=true; bow.add(riserCore);
// a riser a végtagokba olvad: két rövid kúp a tetején/alján
[[1,0.16],[-1,0.16]].forEach(([s,y])=>{ const c=mesh(new THREE.CylinderGeometry(0.010,0.017,0.09,10), staveWood, 0,s*y,-0.006); c.scale.z=1.3; bow.add(c); });
// finom markolat-kiöblösödés csak a tenyér magasságában (elegáns swell, nem gömb)
const gripSwell=mesh(new THREE.CylinderGeometry(0.021,0.021,0.10,12), staveWood, 0,-0.005,-0.004); gripSwell.scale.set(0.85,1,1.25); bow.add(gripSwell);
// vékony bőr-fogás (feszes gyűrűk a tenyér körül)
const wrap=new THREE.Group(); bow.add(wrap);
for(let i=0;i<6;i++){
  const ring=mesh(new THREE.TorusGeometry(0.0225,0.004,8,18), gripLeather, 0,-0.050+i*0.020,-0.004);
  ring.rotation.x=Math.PI/2; ring.scale.set(0.9,1,1.2); ring.castShadow=true; wrap.add(ring);
}
// nyíl-polc + ablak (a riser jobb oldalán, hogy a nyíl rajta üljön)
const shelf=mesh(new THREE.BoxGeometry(0.055,0.014,0.040), staveWood, 0.030,0.052,0.008); shelf.castShadow=true; bow.add(shelf);
const rest =mesh(new THREE.CylinderGeometry(0.0035,0.0035,0.045,6), gripLeather, 0.046,0.060,0.008); rest.rotation.z=Math.PI/2; bow.add(rest);
// ELEM-BERAKÁS: vésett, izzó csík a markolat hasán + rúna-gyöngy a polc alatt — az aktuális elem színére vált (updateNockElement)
const bowInlayMat=new THREE.MeshStandardMaterial({color:0x0d1a24, emissive:0x36c5ff, emissiveIntensity:0.15, roughness:.4, flatShading:false});
{ const strip=mesh(new THREE.BoxGeometry(0.007,0.125,0.006), bowInlayMat, 0,0,0.020); bow.add(strip);
  const rune=mesh(new THREE.OctahedronGeometry(0.013,0), bowInlayMat, 0.030,0.030,0.020); bow.add(rune); }

/* --- húr (két szakasz a nock-ig) + nock-pont (string-pull point) --- */
const nock=new THREE.Group(); bow.add(nock);
const serving=mesh(new THREE.CylinderGeometry(0.006,0.006,0.060,8), servingMat,0,0,0); serving.rotation.x=Math.PI/2; nock.add(serving);
// a húr maga (két vékony szakasz felső/alsó tip -> nock)
function strSeg(){ const m=mesh(new THREE.CylinderGeometry(0.0034,0.0034,1,6), stringMat,0,0,0); m.castShadow=false; m.receiveShadow=false; return m; }
const sUp=strSeg(), sLo=strSeg(); bow.add(sUp); bow.add(sLo);

const _tipU=new THREE.Vector3(), _tipL=new THREE.Vector3();
const _localTipU=new THREE.Vector3(TIP_U[0],TIP_U[1],TIP_U[2]);
const _localTipL=new THREE.Vector3(TIP_L[0],TIP_L[1],TIP_L[2]);
const _upY=new THREE.Vector3(0,1,0), _dir=new THREE.Vector3();
function setString(){
  limbU.updateMatrix(); limbL.updateMatrix();
  _tipU.copy(_localTipU).applyMatrix4(limbU.matrix);
  _tipL.copy(_localTipL).applyMatrix4(limbL.matrix);
  const np=nock.position;
  [[sUp,_tipU],[sLo,_tipL]].forEach(([s,tip])=>{
    _dir.copy(np).sub(tip); const len=_dir.length();
    s.position.copy(tip).addScaledVector(_dir,0.5);
    s.scale.set(1,len,1);
    s.quaternion.setFromUnitVectors(_upY, _dir.normalize());
  });
}

/* --- nockolt nyíl (csak feszítéskor látszik) --- */
const nockArrow=new THREE.Group();
(function(){
  const shaft=mesh(new THREE.CylinderGeometry(0.0055,0.0055,0.78,8), arrowWood,0,0,0.39); shaft.rotation.x=Math.PI/2; nockArrow.add(shaft);
  // tiszta 6-oldalú hegy (saját anyag-klón, hogy elemenként színezhető/izzítható legyen)
  const head=mesh(new THREE.ConeGeometry(0.020,0.085,6), metalMat.clone(),0,0,-0.04); head.rotation.x=-Math.PI/2; nockArrow.add(head);
  const collar=mesh(new THREE.CylinderGeometry(0.007,0.009,0.02,8), metalMat,0,0,0.01); collar.rotation.x=Math.PI/2; nockArrow.add(collar);
  // három tollazat a vég felé
  [0,1,2].forEach(i=>{ const f=mesh(new THREE.PlaneGeometry(0.080,0.040), featherMat,0,0,0.70); f.rotation.y=Math.PI/2; f.rotation.z=i*(Math.PI*2/3); nockArrow.add(f); });
  nockArrow.add(mesh(new THREE.CylinderGeometry(0.008,0.0065,0.014,8), hornMat,0,0,0.775));   // szaru-nock a vég
  // ELEM: elem-glow + elem-fej tartó a hegyen — feszítés közben is látszik a kiválasztott elem
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xffffff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending})); glow.scale.setScalar(0.18); glow.position.set(0,0,-0.06); nockArrow.add(glow); enableBloom(glow);
  const elemHolder=new THREE.Group(); elemHolder.position.set(0,0,-0.07); elemHolder.scale.setScalar(0.42); nockArrow.add(elemHolder);
  nockArrow.children.forEach(o=>{ if(o.isMesh) o.castShadow=true; });
  nockArrow._tip=head; nockArrow._glow=glow; nockArrow._elemHolder=elemHolder;
})();
nockArrow.visible=false;
nockArrow.rotation.y=Math.PI; // a ~180°-os íjpózban a nyíl hegye a jelenetbe (a célkereszt felé) mutasson
bow.add(nockArrow);

/* --- feszítés/lövés animációs állapot --- */
const BOW_BASE_X=MOBILE_INPUT?0.40:0.34, BOW_BASE_Y=MOBILE_INPUT?-0.13:-0.10, BOW_BASE_Z=-0.62, BOW_BASE_ROTZ=0.13;   // telefonon az íj jobbra-lejjebb húzódik (kevesebbet takar)
let FOV_BASE=SET.fov; camera.fov=FOV_BASE; camera.updateProjectionMatrix();   // TURBÓ: állítható látószög (beállítások)
let prevCharge=0, bowKick=0, bowKickRot=0, relTwang=0, idleT=0, drawNockIn=1, drawT=0;
let stepPhase=0, stepWeight=0;
const bowLag={yaw:0,pitch:0,x:0,y:0,sprint:0,air:0,swap:0}; let sprintNow=false;   // fegyver-tehetetlenség állapota (rugózott eltolások) + "épp sprintel" jelző
// ÚJRATÖLTÉS-animáció: egyszer-sülő hang/impulzus-jelzők (lövéskor/húzáskor/cancelkor nullázódnak)
let raspFired=false, swingFired=false, tapFired=false, seatFired=false;
// élő íj-hangoló: B = be/ki, J/L yaw, I/K pitch, U/O roll, N/M méret, P tükör
const bowAdj={rx:0.05, ry:-3.22, rz:-0.27, s:MOBILE_INPUT?0.80:0.90, mx:1, mz:-1}; // beégetett póz; mz = limb-görbület tükör (B-vel hangolható)
let bowTune=false;
bow.traverse(o=>{ if(o.isMesh && o.material && 'side' in o.material) o.material.side=THREE.DoubleSide; });
const bowTuneEl=document.createElement('div');
bowTuneEl.style.cssText='position:fixed;left:12px;top:12px;z-index:20;display:none;font:600 12px/1.5 ui-monospace,Consolas,monospace;color:#ffe7b8;background:rgba(8,14,28,.88);border:1px solid rgba(255,210,122,.4);padding:8px 12px;border-radius:8px;white-space:pre;';
document.body.appendChild(bowTuneEl);
function applyBowAdj(){ bow.scale.set(bowAdj.s*bowAdj.mx, bowAdj.s, bowAdj.s*bowAdj.mz);
  nockArrow.rotation.y=(bowAdj.mz>0?Math.PI:0); // nyíl-hegy iránya a görbület-tükörhöz igazítva
  bowTuneEl.textContent=(lang==='hu'?'ÍJ HANGOLÁS  (B = kilép)':'BOW TUNING  (B = exit)')+'\nJ/L yaw='+bowAdj.ry.toFixed(2)+'   I/K pitch='+bowAdj.rx.toFixed(2)+'\nU/O roll='+bowAdj.rz.toFixed(2)+'   N/M '+(lang==='hu'?'méret':'size')+'='+bowAdj.s.toFixed(2)+'\nP '+(lang==='hu'?'balra-jobbra':'left-right')+'='+bowAdj.mx+'   Z '+(lang==='hu'?'görbület-tükör':'curve mirror')+'='+bowAdj.mz+'\n=> '+(lang==='hu'?'írd meg a számokat, és beégetem':'send me these numbers and I will bake them in'); }
applyBowAdj();
// KÖZELHARC vágás-ív: jól látható, képernyőn átsuhanó fénylő ív az ütésnél (a kiválasztott elem színében) — kamerára szerelt
const slashArc=(function(){
  const geo=new THREE.RingGeometry(0.30, 0.50, 40, 4, Math.PI*0.12, Math.PI*0.78);
  // ívelt penge-suhintás: fehéren izzó, éles külső él + az elem színében elhaló belső uszály; a két vége elvékonyodik (nem egyszínű körcikk)
  const mat=new THREE.ShaderMaterial({ uniforms:{uColor:{value:new THREE.Color(1,1,1)}, uAlpha:{value:0}},
    vertexShader:'varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader:'uniform vec3 uColor; uniform float uAlpha; varying vec2 vP; void main(){ float r=(length(vP)-0.30)/0.20; float a=(atan(vP.y,vP.x)-0.377)/2.450;'+
      ' float taper=sin(clamp(a,0.0,1.0)*3.14159); float w=0.25+0.75*taper; float rr=clamp((r-(1.0-w))/w,0.0,1.0);'+
      ' float edge=smoothstep(0.80,0.97,rr)*smoothstep(1.0,0.985,r); float body=pow(rr,2.6)*0.75;'+
      ' gl_FragColor=vec4(mix(uColor,vec3(1.0),edge*0.85)*(body+edge*1.4),clamp(body+edge,0.0,1.0)*taper*uAlpha);\n#include <encodings_fragment>\n}',
    transparent:true, depthTest:false, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, fog:false, toneMapped:false });
  const m=new THREE.Mesh(geo, mat); m.position.set(0,-0.04,-0.8); m.renderOrder=1000; m.frustumCulled=false; m.visible=false; camera.add(m); enableBloom(m); return m;
})();

/* --- EGYEDI 3D ÍJ-MODELLEK + VARÁZS-SZIMBÓLUM + EFFEKT-GEOMETRIÁK (egyszer épül, 0 futásidejű allokáció) --- */
const BOW_SKINS=(function(){
  const groups={ bone:[], moss:[], rune:[] }, runeCrystals=[], mossHalos=[];
  const boneMat=std({color:0xefe4cc, roughness:0.42, metalness:0.05, vertexColors:true});
  const sinewMat=std({color:0x3d261a, roughness:0.92});
  const shroomStemMat=std({color:0xd8cfb8, roughness:0.85});
  const shroomCapMat=std({color:0x24584c, emissive:0x66f0c8, emissiveIntensity:1.15, roughness:0.35});
  const runePlateMat=std({color:0x102436, emissive:0x36c5ff, emissiveIntensity:1.35, roughness:0.32, metalness:0.25, vertexColors:true});
  const runeGemMat=std({color:0x9fe8ff, emissive:0x36c5ff, emissiveIntensity:1.75, roughness:0.18, metalness:0.1});
  const sampleLimb=(t, sign)=>{
    const idx=t*(limbProfile.length-1), i0=Math.min(limbProfile.length-2, idx|0), f=idx-i0;
    const a=limbProfile[i0], b=limbProfile[i0+1];
    return [lerp(a[0],b[0],f), sign*lerp(a[1],b[1],f), lerp(a[2],b[2],f)];
  };
  for(const [limb, sign] of [[limbU,1],[limbL,-1]]){
    // 1) CSONTÍV: faragott gerinc-taréj + ín-kötések + ívelt agancs-recurve szarv a végeken
    const bParts=[], sParts=[];
    for(const t of [0.20, 0.42, 0.64, 0.82]){
      const p=sampleLimb(t, sign), r=lerp(0.028, 0.013, t);
      sParts.push({geo:new THREE.TorusGeometry(r, 0.0042, 5, 11), x:p[0], y:p[1], z:p[2], rx:Math.PI*0.5});
      bParts.push({geo:gradTint(new THREE.ConeGeometry(r*0.58, 0.078*(1.15-t*0.35), 5), 0xb8a382, 0xffffff, -0.04, 0.04),
        x:p[0]+0.012, y:p[1], z:p[2]-0.018, rx:sign*-0.85, rz:-0.35});
    }
    const tip=sampleLimb(0.97, sign);
    bParts.push({geo:gradTint(new THREE.ConeGeometry(0.013, 0.135, 6), 0xc7b393, 0xfffaf0, -0.07, 0.07),
      x:tip[0]+0.004, y:tip[1]+sign*0.042, z:tip[2]-0.026, rx:sign*0.72, rz:-0.12});
    bParts.push({geo:gradTint(new THREE.ConeGeometry(0.0075, 0.072, 5), 0xb8a382, 0xffffff, -0.04, 0.04),
      x:tip[0]+0.016, y:tip[1]+sign*0.012, z:tip[2]-0.030, rx:sign*0.38, rz:-0.55});
    const bg=new THREE.Group();
    bg.add(new THREE.Mesh(mergeGeos(bParts), boneMat));
    bg.add(new THREE.Mesh(mergeGeos(sParts), sinewMat));
    bg.visible=false; limb.add(bg); groups.bone.push(bg);

    // 2) ÉLŐ ÁG: mohapárnák, csavarodó inda-rügyek + világító erdei gombák
    const mParts=[], stParts=[], capParts=[], mg=new THREE.Group();
    for(const [t, sc, side] of [[0.24,1.0,1],[0.50,0.86,-1],[0.74,0.70,1]]){
      const p=sampleLimb(t, sign);
      mParts.push({geo:jitter(new THREE.IcosahedronGeometry(0.022*sc, 0), 0.007, 0.006), x:p[0]+side*0.016, y:p[1], z:p[2]-0.012, sx:0.9, sy:1.35, sz:0.85});
    }
    for(const [t, sc] of [[0.34, 1.0], [0.62, 0.76]]){
      const p=sampleLimb(t, sign), ox=p[0]+0.024, oy=p[1], oz=p[2]-0.014;
      stParts.push({geo:new THREE.CylinderGeometry(0.0035*sc, 0.0055*sc, 0.036*sc, 6), x:ox+0.010*sc, y:oy+sign*0.008*sc, z:oz, rz:-0.65*sign});
      capParts.push({geo:new THREE.SphereGeometry(0.019*sc, 8, 6, 0, Math.PI*2, 0, Math.PI*0.56), x:ox+0.019*sc, y:oy+sign*0.018*sc, z:oz, rz:-0.65*sign, sy:0.78});
      const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW, color:0x7fffe0, transparent:true, opacity:0.55, depthWrite:false, blending:THREE.AdditiveBlending}));
      halo.scale.setScalar(0.085*sc); halo.position.set(ox+0.020*sc, oy+sign*0.020*sc, oz); enableBloom(halo); mg.add(halo); mossHalos.push(halo);
    }
    mg.add(new THREE.Mesh(mergeGeos(mParts), mossMat));
    mg.add(new THREE.Mesh(mergeGeos(stParts), shroomStemMat));
    const capM=new THREE.Mesh(mergeGeos(capParts), shroomCapMat); enableBloom(capM); mg.add(capM);
    mg.visible=false; limb.add(mg); groups.moss.push(mg);

    // 3) RÚNAÍJ: vésett rúnalapok + lebegő, forgó arkán kristályok
    const rParts=[], rg=new THREE.Group();
    for(const [i, t] of [0.18, 0.36, 0.56, 0.76].entries()){
      const p=sampleLimb(t, sign), s=1-i*0.11;
      rParts.push({geo:gradTint(new THREE.OctahedronGeometry(0.016*s, 0), 0x1d6896, 0xd8f8ff, -0.02, 0.02),
        x:p[0]+0.019, y:p[1], z:p[2]-0.008, sx:0.42, sy:1.65, sz:0.72, rx:sign*0.18});
    }
    const rMesh=new THREE.Mesh(mergeGeos(rParts), runePlateMat); enableBloom(rMesh); rg.add(rMesh);
    for(const [t, sc, offX, offZ] of [[0.46, 0.015, 0.036, -0.018], [0.99, 0.020, 0.014, 0.072]]){
      const p=sampleLimb(t, sign);
      const cr=new THREE.Mesh(new THREE.OctahedronGeometry(sc, 0), runeGemMat);
      cr.position.set(p[0]+offX, p[1]+sign*(t>0.9?0.032:0), t>0.9?offZ:p[2]+offZ);
      cr.scale.set(0.85, 1.45, 0.85); enableBloom(cr); rg.add(cr); runeCrystals.push(cr);
    }
    const tipGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW, color:0x36c5ff, transparent:true, opacity:0.55, depthWrite:false, blending:THREE.AdditiveBlending}));
    tipGlow.scale.setScalar(0.11); tipGlow.position.set(tip[0]+0.012, tip[1]+sign*0.030, 0.072); enableBloom(tipGlow); rg.add(tipGlow);
    rg.visible=false; limb.add(rg); groups.rune.push(rg);
  }
  // Markolat-díszek (riser)
  const boneGuard=new THREE.Mesh(mergeGeos([
    {geo:gradTint(new THREE.ConeGeometry(0.012,0.085,5),0xb8a382,0xffffff,-0.04,0.04), x:0.026, y:0.085, z:-0.018, rx:-0.35, rz:-0.28},
    {geo:gradTint(new THREE.ConeGeometry(0.012,0.085,5),0xb8a382,0xffffff,-0.04,0.04), x:0.026, y:-0.085, z:-0.018, rx:2.79, rz:0.28}
  ]), boneMat); boneGuard.visible=false; bow.add(boneGuard); groups.bone.push(boneGuard);
  const runeRiser=new THREE.Group();
  const coreGem=new THREE.Mesh(new THREE.OctahedronGeometry(0.017,0), runeGemMat); coreGem.position.set(0.036, 0.0, -0.024); enableBloom(coreGem);
  runeRiser.add(coreGem); runeCrystals.push(coreGem); runeRiser.visible=false; bow.add(runeRiser); groups.rune.push(runeRiser);

  // Varázs-feszítés szimbólum (a nyílhegy körül pörgő kettős arkán rúnagyűrű, amikor a varázslat kész)
  const sigG=new THREE.Group(); sigG.position.set(0.046, 0.060, -0.14); sigG.visible=false;
  const sigOuterMat=new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false, depthTest:false, blending:THREE.AdditiveBlending, fog:false, toneMapped:false});
  const sigInnerMat=sigOuterMat.clone();
  const sigOuter=new THREE.Mesh(new THREE.RingGeometry(0.058, 0.068, 24), sigOuterMat); sigOuter.renderOrder=995; enableBloom(sigOuter);
  const sigInner=new THREE.Mesh(new THREE.RingGeometry(0.030, 0.040, 4), sigInnerMat); sigInner.renderOrder=996; enableBloom(sigInner);
  const sigGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW, color:0xffffff, transparent:true, opacity:0, depthWrite:false, depthTest:false, blending:THREE.AdditiveBlending}));
  sigGlow.scale.setScalar(0.22); sigGlow.renderOrder=994; enableBloom(sigGlow);
  sigG.add(sigOuter, sigInner, sigGlow); bow.add(sigG);
  return { groups, runeCrystals, mossHalos, shroomCapMat, runePlateMat, runeGemMat, sigil:{g:sigG, outer:sigOuter, inner:sigInner, glow:sigGlow, outerMat:sigOuterMat, innerMat:sigInnerMat} };
})();

const BOSS_PROP_GEOS=(function(){
  const boulder=gradTint(jitter(new THREE.IcosahedronGeometry(0.72, 1), 0.16, 0.14), 0x463c32, 0xb89f7d, -0.7, 0.7);
  const thorns=mergeGeos([
    {geo:gradTint(new THREE.ConeGeometry(0.22, 1.45, 6), 0x2b1f12, 0xc79a4b, -0.72, 0.72), x:0, y:0.55, z:0, rx:0.12, rz:-0.08},
    {geo:gradTint(new THREE.ConeGeometry(0.17, 1.15, 5), 0x2b1f12, 0xb88c42, -0.57, 0.57), x:0.42, y:0.42, z:0.18, rx:0.22, rz:-0.38},
    {geo:gradTint(new THREE.ConeGeometry(0.17, 1.10, 5), 0x2b1f12, 0xb88c42, -0.55, 0.55), x:-0.38, y:0.40, z:0.24, rx:0.26, rz:0.40},
    {geo:gradTint(new THREE.ConeGeometry(0.15, 0.96, 5), 0x2b1f12, 0xa87e3a, -0.48, 0.48), x:0.06, y:0.36, z:-0.42, rx:-0.42, rz:0.12},
    {geo:gradTint(new THREE.TorusGeometry(0.55, 0.085, 5, 12), 0x2b3a1e, 0x769448, -0.1, 0.1), x:0, y:0.08, z:0, rx:Math.PI*0.5}
  ]);
  return { boulder, thorns };
})();

