/* ===================== GENERÁLT TEREPTÁRGY: mohás kőtroll-bálvány =====================
   AI-val készült glTF modell (src/assets/props/troll_idol.glb, eredete: src/assets/props/README.md):
   ~6000 háromszög, 1024-es WebP textúrák, külön emisszív térkép a cián rúnáknak.
   Az északi holdkapu előtt áll, arccal a tisztás közepe felé; ütközik (játékos + trollok).
   - A rúnák izzása: a bloom-pass a nem-izzó dolgokat feketére rajzolja, ezért a bálvány fölé
     ugyanarra a geometriára egy additív "rúna-réteg" kerül, ami CSAK a bloom-passban látszik
     (opacity = BLOOM_PASS_U). fog:false -> mindkét passban ugyanaz a shader-változat.
   - PROPS_READY: a bemelegítés (27-frame-warmup.js) megvárja a betöltést, így a bálvány
     shaderei is a töltőképernyő alatt fordulnak le, nem az első rápillantáskor. */
const TROLL_IDOL = { x:-6.5, z:-39.5, h:3.2, r:1.25 };   // r: ütköző sugara (a talapzat ~1.4)
const PROPS_READY = (function loadTrollIdol(){
  const url = window.GAME_ASSETS && window.GAME_ASSETS.trollIdol;
  if(!url || !THREE.GLTFLoader) return Promise.resolve(null);
  const I = TROLL_IDOL, groundY = GROUND_Y + hillH(I.x, I.z);
  // ütköző + talaj-árnyékfolt MOST (szinkron): a folt-háló a növényzet után épül, addigra itt kell lennie
  solidCyl(I.x, I.z, I.r, {top:groundY + I.h, mob:true});
  contactBlob(I.x, I.z, 2.4);
  return new Promise(resolve => {
    new THREE.GLTFLoader().load(url, gltf => {
      try{
        const g = gltf.scene, box = new THREE.Box3().setFromObject(g), size = new THREE.Vector3();
        box.getSize(size);
        g.scale.setScalar(I.h / size.y);
        box.setFromObject(g);
        g.position.set(I.x, groundY - box.min.y - 0.08, I.z);   // kicsit a talajba süllyesztve: ne lebegjen a talapzat széle
        g.rotation.y = Math.atan2(I.z, -I.x);                    // a modell eleje +X: forgatás a tisztás közepe felé
        g.traverse(o => {
          if(!o.isMesh) return;
          o.castShadow = true; o.receiveShadow = true;
          const em = o.material && o.material.emissiveMap;
          if(!em) return;
          const glow = new THREE.Mesh(o.geometry, new THREE.MeshBasicMaterial({
            map:em, transparent:true, opacity:0, depthWrite:false, fog:false, blending:THREE.AdditiveBlending,
            polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1 }));
          glow.onBeforeRender = () => { glow.material.opacity = BLOOM_PASS_U.value; };   // fő-pass: 0 (láthatatlan), bloom-pass: 1
          enableBloom(glow); o.add(glow);
        });
        scene.add(g);
        resolve(g);
      }catch(e){ console.warn('[props] troll idol', e); resolve(null); }
    }, undefined, e => { console.warn('[props] troll idol failed to load', e); resolve(null); });
  });
})();
