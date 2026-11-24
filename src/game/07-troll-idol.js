/* ===================== GENERÁLT TEREPTÁRGYAK: kőtroll-bálvány, öreg kút, oltár, mohás kövek =====================
   AI-val készült glTF modellek (src/assets/props/*.glb, eredetük: src/assets/props/README.md), 1024/512-es WebP
   textúrákkal; a telített cián részekből külön emisszív térkép készül (rúnák, derengő víz).
   - BÁLVÁNY: az északi holdkapu előtt áll, arccal a tisztás közepe felé; ütközik (játékos + trollok).
   - KÚT / OLTÁR / KÖVEK: csak akkor, ha a GLB benne van a buildben (window.GAME_ASSETS). Ilyenkor a 06-arena.js /
     07-landmarks.js a régi, kódból épített változatot nem rakja ki; az ütközők változatlanok (ott maradnak).
     A kövek helyeit a rock() gyűjti (ROCK_SPOTS), itt EGY instanced hálóba kerülnek, a régi kövek méretére igazítva.
   - Az izzás: a bloom-pass a nem-izzó dolgokat feketére rajzolja, ezért az emisszív térképes hálók fölé ugyanarra a
     geometriára egy additív "izzó-réteg" kerül, ami CSAK a bloom-passban látszik (opacity = BLOOM_PASS_U).
     fog:false -> mindkét passban ugyanaz a shader-változat.
   - PROPS_READY: a bemelegítés (27-frame-warmup.js) megvárja az összes betöltését, így a shaderek is a
     töltőképernyő alatt fordulnak le, nem az első rápillantáskor. */
const TROLL_IDOL = { x:-6.5, z:-39.5, h:3.2, r:1.25 };   // r: ütköző sugara (a talapzat ~1.4)
const OLD_WELL   = { x:11.55, z:7.90, h:2.9 };            // a régi kút helye (07-landmarks.js); ütköző: 12-camera-collision.js
const ALTAR      = { d:8.4, h:0.30 };                     // a középső emelvény átmérője és legnagyobb magassága (rálépni: alacsony marad)
function propGlowLayer(o){   // emisszív térkép -> csak a bloom-passban látszó additív réteg
  const em = o.material && o.material.emissiveMap;
  if(!em) return;
  const glow = new THREE.Mesh(o.geometry, new THREE.MeshBasicMaterial({
    map:em, transparent:true, opacity:0, depthWrite:false, fog:false, blending:THREE.AdditiveBlending,
    polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1 }));
  glow.onBeforeRender = () => { glow.material.opacity = BLOOM_PASS_U.value; };   // fő-pass: 0 (láthatatlan), bloom-pass: 1
  enableBloom(glow); o.add(glow);
}
// A modellek kvantált (Int16/Int8, normalizált) geometriát használnak. A GPU ezt helyesen olvassa, de az r128 CPU-oldali
// getX-e NEM skálázza vissza -> ahol a csúcsokat JS-ben olvassuk/alakítjuk (kő-példányok, oltár-felület), lebegőpontos másolat kell.
function propFloatAttr(a){
  const arr = a.isInterleavedBufferAttribute ? a.data.array : a.array, n = a.count, k = a.itemSize, out = new Float32Array(n * k);
  const unsigned = arr instanceof Uint8Array || arr instanceof Uint16Array;
  const div = !a.normalized ? 1 : arr instanceof Int8Array ? 127 : arr instanceof Uint8Array ? 255 : arr instanceof Int16Array ? 32767 : arr instanceof Uint16Array ? 65535 : 1;
  const get = [a.getX, a.getY, a.getZ, a.getW];
  for(let i = 0; i < n; i++) for(let c = 0; c < k; c++){ const v = get[c].call(a, i) / div; out[i * k + c] = (div > 1 && !unsigned) ? Math.max(-1, v) : v; }
  return new THREE.BufferAttribute(out, k);
}
// betölt egy generált modellt, place(g, box, size) a helyére teszi; hiba esetén null (a játék megy tovább nélküle)
function loadGenProp(name, place){
  const url = window.GAME_ASSETS && window.GAME_ASSETS[name];
  if(!url || !THREE.GLTFLoader) return Promise.resolve(null);
  return new Promise(resolve => {
    new THREE.GLTFLoader().load(url, gltf => {
      try{
        const g = gltf.scene, box = new THREE.Box3().setFromObject(g), size = new THREE.Vector3();
        box.getSize(size);
        place(g, box, size);
        const meshes = []; g.traverse(o => { if(o.isMesh) meshes.push(o); });   // előbb gyűjtés: az izzó-réteg gyerekként kerül a hálóra
        for(const o of meshes){ o.castShadow = true; o.receiveShadow = true; propGlowLayer(o); }
        scene.add(g);
        resolve(g);
      }catch(e){ console.warn('[props] '+name, e); resolve(null); }
    }, undefined, e => { console.warn('[props] '+name+' failed to load', e); resolve(null); });
  });
}
// --- több helyre kerülő modellek (holdkapu, kidőlt fa, oszlopcsoport, kőhalom, parázstartó, barlangszáj) ---
// a modellek "eleje" a saját terükben (a generálási jelentés szerint): ebből számoljuk a forgatást
const GEN_FRONT = { megalithArch:'+x', fallenTree:'+x', brokenPillars:'+x', cairnShrine:'+x', brazier:'+z', caveMouthA:'+x', caveMouthB:'+x' };   // holdkapu: az átjáró iránya; kidőlt fa: a gyökérlabda felőli vég
const _genFrontAng = { '+z':0, '+x':Math.PI/2, '-z':Math.PI, '-x':-Math.PI/2 };
function genYaw(name, fx, fz){ return Math.atan2(fx, fz) - (_genFrontAng[GEN_FRONT[name]] || 0); }   // a modell eleje a (fx,fz) világ-irányba
// a modellt egy tartó-csoportba teszi: a befoglaló doboz alja-közepe a tartó origójában -> (x,z)-re ültetve a talpa a talajon
function genHolder(g, box, k, yaw){
  const c = box.getCenter(new THREE.Vector3()), h = new THREE.Group();
  g.position.set(-c.x, -box.min.y, -c.z); h.add(g);
  if(k && k.isVector3) h.scale.copy(k); else h.scale.setScalar(k || 1);
  h.rotation.y = yaw || 0;
  return h;
}
function genGround(h, x, z, sink){ h.position.set(x, GROUND_Y + hillH(x, z) - (sink == null ? 0.06 : sink), z); return h; }
// egy modell több helyre (klónok: közös geometria és anyag). place(g, spot, box, size, i) -> a jelenetbe teendő objektum (vagy null, ha maga csatolta)
function loadGenPropMulti(name, spots, place){
  const url = window.GAME_ASSETS && window.GAME_ASSETS[name];
  if(!url || !THREE.GLTFLoader) return Promise.resolve(null);
  return new Promise(resolve => {
    new THREE.GLTFLoader().load(url, gltf => {
      try{
        const src = gltf.scene, box = new THREE.Box3().setFromObject(src), size = box.getSize(new THREE.Vector3());
        const list = spots();   // a helyek a betöltés után olvasva: addigra minden építő (08–12) lefutott
        list.forEach((s, i) => {
          const g = src.clone(true), meshes = [];
          g.traverse(o => { if(o.isMesh) meshes.push(o); });
          for(const o of meshes){ o.castShadow = true; o.receiveShadow = true; propGlowLayer(o); }
          const obj = place(g, s, box, size, i);
          if(obj) scene.add(obj);
        });
        resolve(list.length);
      }catch(e){ console.warn('[props] '+name, e); resolve(null); }
    }, undefined, e => { console.warn('[props] '+name+' failed to load', e); resolve(null); });
  });
}
const FALLEN_TREE = { a:[-19.34, 4.13], b:[-11.56, 13.14] };   // a régi rönk ütközőinek két vége (12-camera-collision.js): b-nél a gyökérlabda
function loadGenLandmarks(){
  const arch = loadGenPropMulti('megalithArch', () => GEN_SPOTS.arch, (g, s, box, size) =>
    genGround(genHolder(g, box, 6.8 * s.s / size.y, genYaw('megalithArch', Math.sin(s.facing), Math.cos(s.facing))), s.x, s.z, 0.15));
  const fallen = loadGenPropMulti('fallenTree', () => GEN_SPOTS.fallen.slice(0, 1), (g, s, box, size) => {
    const A = FALLEN_TREE.a, B = FALLEN_TREE.b, dx = B[0] - A[0], dz = B[1] - A[1], len = Math.hypot(dx, dz);
    const along = GEN_FRONT.fallenTree.slice(1) === 'x' ? size.x : size.z;   // a hossz-tengely; az "eleje" a gyökérlabda felőli vég
    return genGround(genHolder(g, box, len / along, genYaw('fallenTree', dx, dz)), (A[0] + B[0]) / 2, (A[1] + B[1]) / 2, 0.12);
  });
  const pillars = loadGenPropMulti('brokenPillars', () => GEN_SPOTS.pillars, (g, s, box, size) =>
    genGround(genHolder(g, box, 4.5 / size.y, s.rot), s.x, s.z, 0.1));
  const cairn = loadGenPropMulti('cairnShrine', () => GEN_SPOTS.cairn, (g, s, box, size) => {
    const k = 1.6 / size.y, h = genGround(genHolder(g, box, k, Math.random() * 6.283), s.x, s.z, 0.05);
    for(const o of s.g.children) if(o.isSprite || (o.geometry && o.geometry.type === 'OctahedronGeometry')) o.position.y = size.y * k + 0.5;   // a lebegő kristály a csúcs fölé
    return h;
  });
  const brazier = loadGenPropMulti('brazier', () => GEN_SPOTS.brazier, (g, s, box, size) => {
    const h = genHolder(g, box, 1.32 / size.y, 0); h.position.y = -0.02; s.g.add(h); return null;   // a parázstartó csoportjába: a parázs/láng/fény ott marad
  });
  const caveSpots = i => () => GEN_SPOTS.cave.filter((c, k) => (GEN_PROP('caveMouthB') ? k % 2 === i : i === 0));
  const cavePlace = (name, H, W) => (g, c, box, size) => {
    const k = Math.min(H / size.y, W / Math.max(size.x, size.z));
    return genGround(genHolder(g, box, k, genYaw(name, -c.x, -c.z)), c.x, c.z, 0.15);   // a száj a tisztás közepe felé
  };
  const caveA = loadGenPropMulti('caveMouthA', caveSpots(0), cavePlace('caveMouthA', 4.2, 6.5));
  const caveB = loadGenPropMulti('caveMouthB', caveSpots(1), cavePlace('caveMouthB', 3.2, 7.5));
  return Promise.all([arch, fallen, pillars, cairn, brazier, caveA, caveB]);
}
const PROPS_READY = (function loadGenProps(){
  const I = TROLL_IDOL, idolY = GROUND_Y + hillH(I.x, I.z);
  // ütköző + talaj-árnyékfolt MOST (szinkron): a folt-háló a növényzet után épül, addigra itt kell lennie
  if(window.GAME_ASSETS && window.GAME_ASSETS.trollIdol){ solidCyl(I.x, I.z, I.r, {top:idolY + I.h, mob:true}); contactBlob(I.x, I.z, 2.4); }
  const idol = loadGenProp('trollIdol', (g, box, size) => {
    g.scale.setScalar(I.h / size.y);
    box.setFromObject(g);
    g.position.set(I.x, idolY - box.min.y - 0.08, I.z);   // kicsit a talajba süllyesztve: ne lebegjen a talapzat széle
    g.rotation.y = Math.atan2(I.z, -I.x);                  // a modell eleje +X: forgatás a tisztás közepe felé
  });
  const well = loadGenProp('oldWell', (g, box, size) => {
    const W = OLD_WELL;
    g.scale.setScalar(W.h / size.y);
    box.setFromObject(g);
    g.position.set(W.x, GROUND_Y + hillH(W.x, W.z) - box.min.y - 0.06, W.z);
    g.rotation.y = Math.atan2(-W.x, -W.z);                 // a Meshy-modell eleje +Z: a tisztás közepe felé fordítva
  });
  const altar = loadGenProp('altarDais', (g, box, size) => {
    const kx = ALTAR.d / Math.max(size.x, size.z), ky = Math.min(kx, ALTAR.h / size.y);   // széles, lapos: magasságban legfeljebb ALTAR.h
    g.scale.set(kx, ky, kx);
    box.setFromObject(g);
    const c = box.getCenter(new THREE.Vector3());
    g.position.set(-c.x, GROUND_Y - box.min.y - 0.05, -c.z);
    // a felület magassága a csúcsokból (világ-térben): a cián rúnagyűrű (06-arena.js, r 2,4) a kőlapok fölé kerül,
    // és a lapos középre mászható, alacsony test jön -> a láb nem süllyed a kőbe
    g.updateMatrixWorld(true);
    const v = new THREE.Vector3(); let rune = GROUND_Y, floor = GROUND_Y;
    g.traverse(o => { if(!o.isMesh) return; const p = propFloatAttr(o.geometry.attributes.position).array;
      for(let i = 0; i < p.length; i += 3){ v.set(p[i], p[i + 1], p[i + 2]).applyMatrix4(o.matrixWorld); const r = Math.hypot(v.x, v.z);
        if(Math.abs(r - 2.4) < 0.3) rune = Math.max(rune, v.y);
        if(r > 1.6 && r < 2.2) floor = Math.max(floor, v.y); } });
    altarRune.position.y = Math.max(altarRune.position.y, rune + 0.02);
    if(floor > GROUND_Y + 0.04) solidCyl(0, 0, 3.6, {top:Math.min(floor, GROUND_Y + ALTAR.h), climb:true});
  });
  // (a ROCK_SPOTS a 08-forest.js-ben telik meg, ez a fájl előbb fut: a helyeket csak a betöltés után, aszinkron olvassuk)
  const rocks = (!GEN_PROP('mossRock') || !THREE.GLTFLoader) ? Promise.resolve(null) : new Promise(resolve => {
    new THREE.GLTFLoader().load(window.GAME_ASSETS.mossRock, gltf => {
      try{
        if(!ROCK_SPOTS.length){ resolve(null); return; }
        // a generált követ a régi kő-geometriák (ROCK_GEOS) átlagos befoglaló dobozára igazítjuk -> a rock() helye/mérete/ütközője változatlan
        const ref = new THREE.Vector3(), rb = new THREE.Box3(); let minY = 0;
        for(const geo of ROCK_GEOS){ geo.computeBoundingBox(); rb.copy(geo.boundingBox); ref.add(rb.getSize(new THREE.Vector3())); minY += rb.min.y; }
        ref.multiplyScalar(1 / ROCK_GEOS.length); minY /= ROCK_GEOS.length;
        const root = gltf.scene; root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
        const norm = new THREE.Matrix4().makeScale(ref.x / size.x, ref.y / size.y, ref.z / size.z)
          .multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y + minY * size.y / ref.y, -c.z));
        const out = new THREE.Group(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
        root.traverse(o => {
          if(!o.isMesh) return;
          const geo = o.geometry.clone();
          for(const n of ['position', 'normal']) if(geo.attributes[n]) geo.setAttribute(n, propFloatAttr(geo.attributes[n]));   // kvantált -> float, különben a transzformáció szétesik
          geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(norm, o.matrixWorld));
          const im = new THREE.InstancedMesh(geo, o.material, ROCK_SPOTS.length);
          ROCK_SPOTS.forEach((s, i) => { q.setFromAxisAngle(up, s.ry);
            im.setMatrixAt(i, m4.compose(new THREE.Vector3(s.x, s.y, s.z), q, new THREE.Vector3(s.sx, s.sy, s.sz))); });
          im.instanceMatrix.needsUpdate = true; im.castShadow = true; im.receiveShadow = true;
          im.frustumCulled = false;   // r128: az instanced háló befoglaló gömbje csak az alap-geometriáé, a szétszórt példányokat levágná
          out.add(im);   // (izzó-réteg nincs: a kövön nincs rúna, és a gyerek-háló nem lenne példányosítva)
        });
        scene.add(out); resolve(out);
      }catch(e){ console.warn('[props] mossRock', e); resolve(null); }
    }, undefined, e => { console.warn('[props] mossRock failed to load', e); resolve(null); });
  });
  return Promise.all([idol, well, altar, rocks, loadGenLandmarks()]);
})();
