/* ===================== FPS — STATIKUS VILÁG ÖSSZEVONÁSA (draw-call) =====================
   A világ ~1000 külön hálóból áll (fák törzse/lombja/levél-kártyái, sziklák, menhirek, ládák, hidak pallói és kötelei,
   rámpák, barlangok...), de csak néhány tucat anyagot használ. Minden háló külön rajzolási hívás a fő-, a bloom- és az
   árnyék-passban (a képkocka CPU-idejének nagyja uniform-feltöltés). Itt, betöltéskor EGYSZER, a mozdulatlan, átlátszatlan
   hálókat anyagonként és ~24 m-es cellánként egy-egy hálóvá fűzzük (a csúcsok világ-térbe égetve) -> a frustum-culling
   cellánként tovább működik. Az ütközők (SOLIDS: solidCyl/solidBox) a hálóktól függetlenek, változatlanok.
   Kimarad (úgy rajzolódik, mint eddig): ami mozog vagy hivatkozott (swayers: gombák, virágok, kő-oltár; az ég), az
   instanced / skinnelt háló, az átlátszó, a bloom-rétegű (izzó), a frustum-culling nélküli és a kézi mátrixú háló, a trollokkal
   megosztott könyvtár-anyagok (azokra később a troll rim-shadere kerül), és minden anyag, aminek a shadere a HÁLÓ-terű
   pozíciót olvassa, kivéve a két ismert esetet:
     - 'sty-wood' (deszka-minta a háló-térből): az összevont háló a háló-terű pozíciót aOP attribútumban kapja (applyStylized baked),
     - 'wind-canopy' (lomb-szél): a háló-terű magasság aOH, a kitérés világ-iránya aSD attribútumban (applyWind baked).
   Ez a két változat új shader-program (anyagonként egy klón) — a warmup renderer.compile-ja betöltéskor lefordítja.
   A fák gyújthatók (igniteTree), de a tűz csak zónát + effektet indít a fa (x,z) helyén, a fa hálóihoz nem nyúl.
   A grafikai fokozat a fa-árnyékvetők castShadow-ját kapcsolja (treeCasters) -> az összevont fa-hálók a listába kerülnek.
   Fejlesztői A/B: #dev + window.__noWorldBatch=true (betöltés ELŐTT, pl. addInitScript) -> régi rajzolás. Az összevont hálók ilyenkor
   is elkészülnek, csak nem kerülnek a jelenetbe: a three minden új objektum uuid-jához Math.random-ot húz, így a két mód
   véletlen-sorozata (részecskék, parázs...) azonos marad, és a képek pixelre összevethetők. */
const WB_CELL=24;   // cella-méret (m): kisebb -> pontosabb culling, több rajzolási hívás (mérve: 16 m 605, 24 m 560, 48 m 494 hívás/képkocka)
const _wbN=new THREE.Matrix3();
let worldBatchInfo=null;
function _wbKind(mat){   // melyik shader-változat kell az összevont hálónak (null: nem összevonható)
  const def=mat.onBeforeCompile===THREE.Material.prototype.onBeforeCompile && mat.customProgramCacheKey===THREE.Material.prototype.customProgramCacheKey;
  if(def) return 'plain';
  let k=''; try{ k=String(mat.customProgramCacheKey()); }catch(_e){ return null; }
  if(k==='sty-rock' || k==='sty-bark' || k==='sty-ground') return 'plain';   // csak világ-tér (vWP/vWN) -> összevonva is pontosan ugyanaz
  if(k==='sty-wood') return 'wood';
  if(k==='wind-canopy') return 'wind';
  return null;
}
const _WB_UVMAPS=['map','bumpMap','normalMap','roughnessMap','metalnessMap','emissiveMap','alphaMap','specularMap'];
function _wbAttrs(mat){   // az anyag által olvasott csúcs-attribútumok (a többit nem visszük át); null: nem összevonható
  if(mat.aoMap || mat.lightMap || mat.displacementMap) return null;   // uv2 / háló-terű kiemelés kellene
  const n=['position'];
  if(!mat.isMeshBasicMaterial || mat.envMap) n.push('normal');
  if(mat.vertexColors) n.push('color');
  if(_WB_UVMAPS.some(k=>mat[k])) n.push('uv');
  return n;
}
function _wbMerge(list, names, kind){
  // Indexelt (Uint16) kimenet, a csúcsok világ-térben; a hívó gondoskodik róla, hogy a csúcsszám <= 65535.
  const wantN=names.indexOf('normal')>=0, wantC=names.indexOf('color')>=0, wantU=names.indexOf('uv')>=0;
  let vTot=0, iTot=0;
  for(const o of list){ const g=o.geometry; vTot+=g.attributes.position.count; iTot+=g.index?g.index.count:g.attributes.position.count; }
  const P=new Float32Array(vTot*3), Nn=wantN?new Float32Array(vTot*3):null, C=wantC?new Float32Array(vTot*3):null, U=wantU?new Float32Array(vTot*2):null;
  const OP=kind==='wood'?new Float32Array(vTot*3):null, OH=kind==='wind'?new Float32Array(vTot):null, SD=kind==='wind'?new Float32Array(vTot*3):null;
  const I=new Uint16Array(iTot);
  let vo=0, io=0;
  for(const o of list){
    const g=o.geometry, pa=g.attributes.position, n=pa.count, M=o.matrixWorld, e=M.elements, flip=M.determinant()<0;   // tükrözött háló: a körüljárást is meg kell fordítani (a three ilyenkor CW-front-face-szel rajzolt)
    for(let k=0;k<n;k++){ const x=pa.getX(k), y=pa.getY(k), z=pa.getZ(k), d=(vo+k)*3;
      P[d]=e[0]*x+e[4]*y+e[8]*z+e[12]; P[d+1]=e[1]*x+e[5]*y+e[9]*z+e[13]; P[d+2]=e[2]*x+e[6]*y+e[10]*z+e[14];
      if(OP){ OP[d]=x; OP[d+1]=y; OP[d+2]=z; }
      if(OH) OH[vo+k]=y; }
    if(SD){ const sx=e[0]+0.6*e[8], sy=e[1]+0.6*e[9], sz=e[2]+0.6*e[10]; for(let k=0;k<n;k++){ const d=(vo+k)*3; SD[d]=sx; SD[d+1]=sy; SD[d+2]=sz; } }
    if(wantN){ _wbN.getNormalMatrix(M); const q=_wbN.elements, na=g.attributes.normal;
      for(let k=0;k<n;k++){ const x=na.getX(k), y=na.getY(k), z=na.getZ(k), d=(vo+k)*3;
        const nx=q[0]*x+q[3]*y+q[6]*z, ny=q[1]*x+q[4]*y+q[7]*z, nz=q[2]*x+q[5]*y+q[8]*z, l=Math.hypot(nx,ny,nz)||1;
        Nn[d]=nx/l; Nn[d+1]=ny/l; Nn[d+2]=nz/l; } }
    if(wantC){ const ca=g.attributes.color; for(let k=0;k<n;k++){ const d=(vo+k)*3; C[d]=ca.getX(k); C[d+1]=ca.getY(k); C[d+2]=ca.getZ(k); } }
    if(wantU){ const ua=g.attributes.uv; for(let k=0;k<n;k++){ const d=(vo+k)*2; U[d]=ua.getX(k); U[d+1]=ua.getY(k); } }
    if(g.index){ const ia=g.index.array, ic=g.index.count; for(let k=0;k<ic;k++) I[io+k]=ia[k]+vo;
      if(flip) for(let k=0;k+2<ic;k+=3){ const t=I[io+k+1]; I[io+k+1]=I[io+k+2]; I[io+k+2]=t; } io+=ic; }
    else { for(let k=0;k+2<n;k+=3){ I[io+k]=vo+k; I[io+k+1]=vo+k+(flip?2:1); I[io+k+2]=vo+k+(flip?1:2); } io+=n; }
    vo+=n;
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P,3));
  if(wantN) geo.setAttribute('normal', new THREE.BufferAttribute(Nn,3));
  if(wantC) geo.setAttribute('color', new THREE.BufferAttribute(C,3));
  if(wantU) geo.setAttribute('uv', new THREE.BufferAttribute(U,2));
  if(OP) geo.setAttribute('aOP', new THREE.BufferAttribute(OP,3));
  if(OH){ geo.setAttribute('aOH', new THREE.BufferAttribute(OH,1)); geo.setAttribute('aSD', new THREE.BufferAttribute(SD,3)); }
  geo.setIndex(new THREE.BufferAttribute(I,1));
  geo.computeBoundingSphere();
  return geo;
}
function batchWorldMeshes(){
  const t0=performance.now();
  scene.updateMatrixWorld(true);
  // trollokkal megosztott könyvtár-anyagok: a troll-építés később rim-shadert (háló-terű zaj) tesz rájuk -> sosem vonjuk össze
  const libMats=new Set([skinMat,skinDark,bellyMat,hairMat,tuskMat,clothMat,woodMat,woodDark,rockMat,mossMat,rockDark,stemMat,capMat,glowCapM,eyeMat,
    arrowWood,featherMat,metalMat,mossMatV,rockMatV,woodDarkV,tuskMatV]);
  const skip=new Set(); for(const g of swayers) g.traverse(o=>skip.add(o)); if(skyGroup) skyGroup.traverse(o=>skip.add(o));
  const casters=new Set(treeCasters), defaultOBR=THREE.Object3D.prototype.onBeforeRender, groups=new Map(), _c=new THREE.Vector3();
  let seen=0;
  scene.traverse(o=>{
    if(!o.isMesh) return; seen++;
    if(skip.has(o) || o.isInstancedMesh || o.isSkinnedMesh || !o.frustumCulled || !o.matrixAutoUpdate || o.onBeforeRender!==defaultOBR) return;
    if(o.layers.mask!==1 && o.layers.mask!==(1<<NOBLOOM_LAYER)) return;   // izzó (bloom-rétegű) háló marad
    for(let p=o; p; p=p.parent) if(!p.visible) return;
    const mat=o.material;
    if(!mat || Array.isArray(mat) || libMats.has(mat) || mat.transparent || mat.blending!==THREE.NormalBlending || mat.skinning || mat.morphTargets || mat.wireframe || (mat.clippingPlanes && mat.clippingPlanes.length)) return;
    if(!(mat.isMeshStandardMaterial || mat.isMeshBasicMaterial || mat.isMeshLambertMaterial || mat.isMeshPhongMaterial)) return;
    const kind=_wbKind(mat); if(!kind) return;
    const geo=o.geometry;
    if(!geo || !geo.isBufferGeometry || !geo.attributes.position || geo.attributes.position.count>65535) return;
    if(geo.morphAttributes && Object.keys(geo.morphAttributes).length) return;
    if(geo.drawRange.start!==0 || geo.drawRange.count!==Infinity) return;
    const names=_wbAttrs(mat), size={position:3, normal:3, color:3, uv:2};
    if(!names) return;
    for(const nm of names){ const a=geo.attributes[nm]; if(!a || a.isInterleavedBufferAttribute || a.normalized || a.itemSize!==size[nm]) return; }   // hiányzó attribútum: marad (pontos egyezés)
    if(!geo.boundingSphere) geo.computeBoundingSphere();
    _c.copy(geo.boundingSphere.center).applyMatrix4(o.matrixWorld);
    const cell=Math.floor(_c.x/WB_CELL)+','+Math.floor(_c.z/WB_CELL);
    const cast=casters.has(o);
    const key=mat.uuid+'|'+kind+'|'+o.castShadow+'|'+o.receiveShadow+'|'+o.renderOrder+'|'+o.layers.mask+'|'+cast+'|'+cell;
    let gr=groups.get(key); if(!gr) groups.set(key, gr={mat, kind, names, o0:o, cast, list:[]});
    gr.list.push(o);
  });
  // 1) minden összevont geometria elkészül (a jelenet még érintetlen: hiba esetén minden marad a régiben)
  const bakedMat=new Map(), out=[];
  const baked=(mat,kind)=>{ let m=bakedMat.get(mat); if(m) return m; m=mat.clone();
    if(kind==='wood') applyStylized(m, mat.customProgramCacheKey().slice(4), true); else applyWind(m, 'canopy', true);
    bakedMat.set(mat,m); return m; };
  for(const gr of groups.values()){
    if(gr.list.length<2) continue;
    // darabolás 65535 csúcsonként (Uint16 index)
    let chunk=[], cnt=0; const chunks=[chunk];
    for(const o of gr.list){ const n=o.geometry.attributes.position.count; if(cnt+n>65535){ chunk=[]; chunks.push(chunk); cnt=0; } chunk.push(o); cnt+=n; }
    for(const ch of chunks){ if(ch.length<2) continue;
      const geo=_wbMerge(ch, gr.names, gr.kind);
      const mm=new THREE.Mesh(geo, gr.kind==='plain'?gr.mat:baked(gr.mat,gr.kind)), f=gr.o0;
      mm.castShadow=f.castShadow; mm.receiveShadow=f.receiveShadow; mm.renderOrder=f.renderOrder; mm.layers.mask=f.layers.mask;
      mm.matrixAutoUpdate=false; mm.userData._worldBatch=ch.length;   // identitás-mátrix, sosem mozog
      out.push({mm, list:ch, cast:gr.cast}); } }
  if(window.__noWorldBatch && location.hash.indexOf('dev')>=0) return;   // A/B: elkészült, de nem cseréljük be (ld. fent)
  // 2) csere: az összevont hálók be, az eredetiek ki a jelenetből (gyerekes háló csak láthatatlanná válik: a gyerekei maradnak)
  const gone=new Set();
  for(const b of out){ scene.add(b.mm); if(b.cast) treeCasters.push(b.mm); for(const o of b.list) gone.add(o); }
  const depth=o=>{ let d=0; for(let p=o.parent; p; p=p.parent) d++; return d; };
  const parents=new Set();
  for(const o of [...gone].sort((a,b)=>depth(b)-depth(a))){
    if(o.children.length){ o.layers.disableAll(); continue; }
    if(o.parent){ parents.add(o.parent); o.parent.remove(o); } }
  // kiürült csoportok (fa-, barlang-, landmark-csoport) is ki: kevesebb mátrix-frissítés és bejárás minden képkockán
  for(let p of parents){ while(p && p!==scene && !p.isMesh && !p.children.length && !skip.has(p)){ const up=p.parent; if(up) up.remove(p); p=up; } }
  for(let i=treeCasters.length-1;i>=0;i--) if(gone.has(treeCasters[i])) treeCasters.splice(i,1);
  worldBatchInfo={ meshes:seen, merged:gone.size, batches:out.length, verts:out.reduce((s,b)=>s+b.mm.geometry.attributes.position.count,0), ms:Math.round(performance.now()-t0) };
}
try{ batchWorldMeshes(); }catch(e){ console.warn('[world batch] kimarad:', e && e.message); }
