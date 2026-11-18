/* ===================== TROLL REDESIGN (részlet-pass) =====================
   Egy közös díszítő-lépés MINDEN trollra (a meglévő rigged handle-eket használva:
   m.g / m.head / m.arms). Gerinc-tüskék, zuzmó-csomók, szőrcsomók, szemölcsök,
   halvány világító spórák — hogy a sziluett gazdagabb, kevésbé "fapados" legyen.
   Megosztott anyagokat használ (nincs per-troll material-leak a mesh-eken). */
const lichenMat = std({color:0x9fb59f, roughness:1});
const wispCloth = std({color:0x0e2c38, emissive:0x1b6f8c, emissiveIntensity:0.5});   // FÁZIS: opaque szellem-köpeny (shared -> warmup elő-fordítja, disposeMonster nem dobja el)
function embellishTroll(m){
  if(m.typeId==='wisp') return;                 // a Lidércnek saját arculata van
  const g=m.g, head=m.head;
  // --- VILÁGÍTÓ GOMBÁK a trollon (a "mohás" jegy; a glow messziről is olvasható) ---
  function sprout(parent,x,y,z,sc,red){
    const mg=new THREE.Group(); mg.position.set(x,y,z); mg.scale.setScalar(sc);
    mg.rotation.set(rand(-0.5,0.5),rand(0,6.28),rand(-0.5,0.5));
    mg.add(mesh(new THREE.CylinderGeometry(0.035,0.05,0.22,6), stemMat, 0,0.11,0));
    mg.add(mesh(new THREE.SphereGeometry(0.15,10,7,0,6.28,0,Math.PI/2), red?capMat:glowCapM, 0,0.24,0, 1,0.72,1));
    if(!red){ const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0x7fe2ff,transparent:true,opacity:0.7,depthWrite:false,blending:THREE.AdditiveBlending})); sp.scale.setScalar(0.6); sp.position.y=0.24; mg.add(sp); }
    parent.add(mg);
  }
  sprout(g, rand(0.2,0.36),1.4,-0.30, 0.95, false);   // egyetlen kis hátsó glow-spóra (a "mohás" jegy, de kevesebb zaj)
  if(Math.random()<0.4) sprout(head, rand(-0.12,0.12),0.34,-0.08, 0.5, false);
  // --- görbe csont-SZARVAK (sziluett-változás) — mind a 4 kúp EGY merge-elt mesh-ben ---
  { const horns=[];
    [-1,1].forEach(s=>{ horns.push({geo:new THREE.ConeGeometry(0.07,0.42,6), x:s*0.15,y:0.28,z:-0.06, rx:-0.30, rz:s*0.28});   // FŐ szarv: hátra-felfelé ível
      horns.push({geo:new THREE.ConeGeometry(0.04,0.20,6), x:s*0.21,y:0.46,z:-0.12, rx:-0.45, rz:s*0.5}); });                  // hegy: a fő szarv folytatása
    head.add(mesh(mergeGeos(horns), tuskMat, 0,0,0)); }
  // --- magas, szaggatott HÁT-TARAJ — EGY merge-elt mesh ---
  { const ns=4+((Math.random()*3)|0), crest=[];
    for(let i=0;i<ns;i++) crest.push({geo:new THREE.ConeGeometry(0.07,0.30+Math.random()*0.14,5), x:rand(-0.05,0.05), y:0.90+i*0.18, z:-0.36, rx:-0.35});
    g.add(mesh(mergeGeos(crest), tuskMat, 0,0,0)); }
  // --- nagy MOHA-tömegek + zuzmó-kontraszt a vállon/háton — 2 merge-elt mesh (moha / zuzmó) ---
  { const mossC=[], lichC=[];
    for(let i=0;i<4;i++){ const a=rand(0,6.28), r=0.14+Math.random()*0.10;
      const it={geo:jitter(new THREE.IcosahedronGeometry(r,0),r*0.2,r*0.15), x:Math.cos(a)*0.30, y:1.0+Math.random()*0.8, z:-0.32-Math.random()*0.14, sx:1.1,sy:0.7,sz:1.1};
      (i%2?lichC:mossC).push(it); }
    if(mossC.length){ const geo=mergeGeos(mossC); gradTint(geo,0x87a07d,0xffffff,0.8,2.0); g.add(mesh(geo, mossMatV, 0,0,0)); }
    if(lichC.length) g.add(mesh(mergeGeos(lichC), lichenMat, 0,0,0)); }
  for(let i=0;i<3;i++) head.add(mesh(new THREE.SphereGeometry(0.03+Math.random()*0.02,6,5), skinDark, rand(-0.16,0.16), rand(-0.08,0.08), 0.30+Math.random()*0.16)); // szemölcs (belső textúra-zaj)
}

// INNATE ELEM: a troll típus-eleme (T.el) láthatóvá tétele — bőr/szem-tint + egy olcsó additív aura. A wisp saját áttetsző passt kap, ott CSAK szem+aura.
function elementSkin(m){
  const e=m.el; if(!e) return; const C=TROLL_EL[e]; if(!C) return;   // m.el-t a makeMonster állítja be (random spawnonként, nem a típushoz kötve)
  if(m.bodySkin && m.bodySkin!==skinMat){ m.bodySkin.color.setHex(C.skin); m.bodySkin.emissive=new THREE.Color(C.emissive); m.bodySkin.emissiveIntensity=C.emInt; }   // a wisp-guard MEGSZŰNT (a test már opaque -> a tint látszik)
  if(m.spitMat){ m.spitMat.color.setHex(C.skin); m.spitMat.emissive=new THREE.Color(C.emissive); m.spitMat.emissiveIntensity=Math.max(C.emInt,0.35); }   // SPITTER: a zöld epe-anyag is kapja az elem-színt
  if(m.wispGlow){ m.wispGlow.forEach(s=>s.material.color.setHex(C.aura)); }   // WISP halo -> elem szín
  if(m.wispFaceMat){ m.wispFaceMat.emissive=new THREE.Color(C.emissive); m.wispFaceMat.emissiveIntensity=0.5; }   // WISP csont-arc
  if(m.eyes) m.eyes.forEach(x=>{ if(x.material&&x.material.emissive) x.material.emissive.setHex(C.eye); });
  if(m._eyeBase==null && m.eyes&&m.eyes[0]) m._eyeBase=C.eye;   // státusz-tint visszaállítása az ELEM-színre, nem a narancsra
  const aura=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:C.aura,transparent:true,opacity:0.55,depthWrite:false,blending:THREE.AdditiveBlending}));
  aura.scale.setScalar(2.0*(m.scale||1)); aura.position.y=(m.bodyCY||1.1); m.g.add(aura); m.elAura=aura;   // prominensebb aura -> a zöld spitteren / sötét wispen is olvas az elem
}
buildElementHUD(); buildUltHud(); updateNockElement();

/* ===================== Szörnyek (mohás trollok) ===================== */
const monsters=[];
/* ---- 5 troll-típus (art-direkciós újratervezés, erős sziluett-különbség) ---- */
const TROLL_TYPES = {   // el / resist / scaleMul / hpMul / speedMul: src/shared/config.js (közös a co-op szerverrel)
  wisp: { id:'wisp', ...SHARED.trollBase('wisp'), name:'Lidérc', threat:0x7fe2ff, dmgMul:0.5, speedCap:5.6,
    rangedCd:2.4, bandMin:6.0, bandMax:18.0, castDmg0:8, auraR:3.0, auraSpd:1.25, auraDmg:1.35,   // FEJLESZTÉS: távolsági jég-lövedék + 3m erősítő aura (server-mirror: WISP_S)
    skin:0x16414f, eyeColor:0x7fe2ff, club:false, noTusks:true, earLen:0.52, deathSpin:1.4, postureLean:0.05,
    build(m){
      // ÁTDOLGOZVA: opaque SZELLEM-LÉNY (csuklyás köpeny + csont-arc + szarvak); a glow csak HALO a test körül, nem maga a test -> creature, nem részecske
      const g=m.g, head=m.head;
      if(m.bodySkin){ m.bodySkin.transparent=false; m.bodySkin.opacity=1; m.bodySkin.emissive=new THREE.Color(0x36c5ff); m.bodySkin.emissiveIntensity=0.35; }   // FACE-FIX: opaque test -> a csont-arc nem mosódik el a 0.92-es testtől; a glow halo viszi a szellem-érzetet
      if(m.legs){ m.legs.L.visible=false; m.legs.R.visible=false; }   // LIDÉRC LEBEG -> nincs láb; helyette lefelé csúcsosodó szellem-uszály
      // uszály + köpeny + szegélyek EGY merge-elt mesh-ben, jitterelt-RONGYOS peremmel
      { const cloth=[
          {geo:jitter(new THREE.ConeGeometry(0.34,1.25,7),0.06,0), y:0.18, rx:Math.PI},          // uszály (csúcs lefelé)
          {geo:jitter(new THREE.ConeGeometry(0.55,1.6,8),0.07,0), y:1.3},                        // csuklya/köpeny
          {geo:jitter(new THREE.ConeGeometry(0.22,0.7,6),0.05,0), x:-0.32, y:0.6, z:0.05, rz:-0.3},
          {geo:jitter(new THREE.ConeGeometry(0.22,0.7,6),0.05,0), x:0.32, y:0.6, z:0.05, rz:0.3}];
        g.add(mesh(mergeGeos(cloth), wispCloth, 0,0,0)); }
      // csuklya-torus keretezi a csont-arcot
      { const hood=mesh(new THREE.TorusGeometry(0.245,0.055,6,12), wispCloth, 0,0.05,0.03); head.add(hood); }
      const faceMat=bellyMat.clone(); m.wispFaceMat=faceMat;   // saját opaque klón -> elementSkin tintezheti (NE a SHARED bellyMat-ra írjunk)
      head.add(mesh(new THREE.SphereGeometry(0.19,9,7), faceMat, 0,0.02,0.06, 1,1.05,0.7));   // csont-arclap (világos akcentus a szemek köré)
      [-1,1].forEach(s=>{ const h=mesh(new THREE.ConeGeometry(0.05,0.5,6), wispCloth, s*0.16,0.30,-0.04); h.rotation.x=-0.5; h.rotation.z=s*0.55; head.add(h); });   // 2 görbe szellem-szarv
      const core=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0x9becff,transparent:true,opacity:0.6,depthWrite:false,blending:THREE.AdditiveBlending})); core.scale.setScalar(1.15); core.position.set(0,1.05,0); g.add(core); m.wispGlow=[core];   // szellem-ragyogás (ref: elementSkin az elem színére tinteli)
      for(let i=0;i<3;i++){ const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0x36c5ff,transparent:true,opacity:0.35,depthWrite:false,blending:THREE.AdditiveBlending})); sp.scale.setScalar(0.42-i*0.07); sp.position.set(rand(-0.28,0.28),0.5-i*0.18,rand(-0.22,0.22)); g.add(sp); m.wispGlow.push(sp); }
    } },
  grunt: { id:'grunt', ...SHARED.trollBase('grunt'), name:'Mohás Troll', threat:0x5f9168, dmgMul:1.0, speedCap:5.6, skin:0x6b9c6e, eyeColor:0xff7a3d, club:true, deathSpin:1.0, postureLean:0.12, shoulderW:1.12, torsoW:1.05, neckLen:-0.03, tuskScale:1.0, earLen:0.34, noTusks:false,
    build(m){
const g=m.g;
// ---- HAFTED STONE-&-WOOD CLUB, parented to the RIGHT FIST so it swings with the attack ----
// (arms.R drives walk + attack rotation; hanging the club off the fist makes the bash read).
// fist sits at arm-local ~ (0,-0.72,0.04); we lash the haft into the grip and let the head ride above it.
const fistR = m.arms.R;
const club = new THREE.Group();
club.position.set(0.04, -0.78, 0.10);   // in the fist, angled forward out of the knuckles
club.rotation.set(-0.35, 0.0, -0.30);   // a bot KIFELÉ dől a válltól (nem a fej mögé lóg)
// wooden haft (tapered, slightly knotty via woodMat's bump)
const haft = mesh(new THREE.CylinderGeometry(0.055, 0.085, 0.95, 7), woodMat, 0, 0.30, 0);
club.add(haft);
// dark-wood pommel knot at the grip end
haft.add(mesh(new THREE.SphereGeometry(0.075, 7, 6), woodDark, 0, -0.50, 0));
// chunky striking HEAD: a knotted dark-wood burl with embedded mossy stone studs
const headGrp = new THREE.Group(); headGrp.position.set(0, 0.62, 0); haft.add(headGrp);
headGrp.add(mesh(jitter(new THREE.IcosahedronGeometry(0.20, 1), 0.05, 0.05), woodDark, 0, 0, 0, 1.0, 1.15, 1.0));   // görcsös icosa-burl
// 3 beágyazott fog-kúp ("a buzogány fogai") — EGY merge-elt tuskMat mesh
headGrp.add(mesh(mergeGeos([
  {geo:new THREE.ConeGeometry(0.05,0.17,5), x:0.17, y:0.06, z:0.02, rz:-1.2},
  {geo:new THREE.ConeGeometry(0.05,0.17,5), x:-0.14, y:0.0, z:0.08, rz:1.1, rx:0.5},
  {geo:new THREE.ConeGeometry(0.05,0.17,5), x:0.02, y:0.08, z:-0.15, rx:-1.2}
]), tuskMat, 0,0,0));
// a creep of moss on the club head — keeps it in the species' material trinity
headGrp.add(mesh(new THREE.SphereGeometry(0.11, 7, 6), mossMat, -0.06, 0.10, 0.07, 1.0, 0.7, 1.0));
// 2 bőr grip-tekercs a nyélen — EGY merge-elt clothMat mesh
haft.add(mesh(mergeGeos([
  {geo:new THREE.TorusGeometry(0.078,0.02,5,10), y:-0.26, rx:Math.PI/2},
  {geo:new THREE.TorusGeometry(0.082,0.02,5,10), y:-0.34, rx:Math.PI/2}
]), clothMat, 0,0,0));
fistR.add(club);
m._club=club;   // csukló-billentés handle: emeléskor a bot ELLENFORGATÁSSAL felfelé áll (ütésre kész), nem lóg le a marokból
// ---- MOHA/SZŐR-GALLÉR a váll vonalán: 9 lapított kúp EGY merge-elt mesh-ben ----
{ const ruff=[], nR=9;
  for(let i=0;i<nR;i++){ const a2=(i/nR)*6.283;
    ruff.push({geo:gradTint(new THREE.ConeGeometry(0.09,0.30,5),0x77906c,0xffffff,-0.15,0.15),
      x:Math.cos(a2)*0.30, y:1.66, z:Math.sin(a2)*0.26-0.02, rx:Math.sin(a2)*1.25, rz:-Math.cos(a2)*1.25}); }
  m.torso.add(mesh(mergeGeos(ruff), mossMatV, 0,0,0)); }
// ---- extra MOSS on the crown for character (the species signature, denser up top on the baseline) ----
m.head.add(mesh(new THREE.SphereGeometry(0.10, 7, 6), mossMat, 0.12, 0.26, -0.04));
m.head.add(mesh(new THREE.SphereGeometry(0.075, 6, 5), mossMat, -0.15, 0.22, -0.02, 1.2, 0.7, 1.0));
// a small mossy clump crusted on the right shoulder (ties club arm into the back-moss line)
m.arms.R.add(mesh(jitter(new THREE.DodecahedronGeometry(0.13, 0), 0.04, 0.04), mossMat, 0.04, 0.16, -0.08));
    } },
  scout: { id:'scout', ...SHARED.trollBase('scout'), name:'Fürge Kobold', threat:0xb6ff5a, dmgMul:0.5, speedCap:11.0, skin:0x93c653, eyeColor:0xc6ff4a, club:false, deathSpin:1.9, postureLean:0.40, shoulderW:0.78, torsoW:0.66, neckLen:0.06, tuskScale:0.0, noTusks:true, earLen:0.95,
    build(m){
const g=m.g;
  // LITHE LIMBS — thin the rigged arm/leg Groups so the imp reads lean & wiry.
  // Scaling the Group (not its children) keeps the hip/shoulder pivots at y0.62/y1.5
  // and does NOT touch rotation, so walk/attack/death animations are unaffected.
  ['L','R'].forEach(k=>{ m.arms[k].scale.set(0.78,1.06,0.78); m.legs[k].scale.set(0.84,1.12,0.84); });

  // OVERSIZED BAT-EARS (the giveaway) — earLen:0.85 already grows the base ear cones;
  // add a paler inner-ear membrane inside each so the huge ears catch the light and
  // read as the silhouette signature even as a black cutout.
  [-1,1].forEach(s=>{
    const inner=mesh(new THREE.ConeGeometry(0.05,0.55,5), bellyMat, s*0.40,0.07,-0.02);
    inner.rotation.z=-s*1.3; inner.rotation.x=-0.18; m.head.add(inner);
  });

  // TWITCHY POINTED SNOUT — small needle fangs instead of tusks (noTusks removed the
  // big base tusks). Two tiny down-fangs at the lip keep the predator read without bulk.
  [-1,1].forEach(s=>{
    const fang=mesh(new THREE.ConeGeometry(0.022,0.10,4), tuskMat, s*0.07,-0.13,0.40);
    fang.rotation.x=0.18; m.head.add(fang);
  });
  // a couple of upper snaggle teeth poking up for a sly grin
  [-1,1].forEach(s=>{
    const tip=mesh(new THREE.ConeGeometry(0.018,0.07,4), tuskMat, s*0.05,-0.05,0.42);
    tip.rotation.x=-0.25; m.head.add(tip);
  });

  // CRUDE BONE DAGGERS strapped along each forearm — parented to the arm Groups so they
  // swing with the dash/attack motion and sell "fast & armed". Local pos near the fist.
  ['L','R'].forEach(k=>{
    const dagger=mesh(new THREE.ConeGeometry(0.038,0.32,4), tuskMat, 0.11,-0.50,0.11);
    dagger.rotation.x=-0.15; dagger.rotation.z=0.12;
    // tiny bound-grip wrap at the dagger base for a crude hand-made look
    dagger.add(mesh(new THREE.CylinderGeometry(0.045,0.05,0.06,6), woodDark, 0,-0.15,0));
    m.arms[k].add(dagger);
  });

  // a single sparse moss tuft over one ear — keeps family unity (the quick scout wears
  // the least moss of the caste, per the art direction).
  m.head.add(mesh(new THREE.SphereGeometry(0.07,7,6), mossMat, 0.20,0.20,-0.05));
    } },
  brute: { id:'brute', ...SHARED.trollBase('brute'), name:'Kőbunkó', threat:0xc98a3a, dmgMul:2.4, speedCap:2.8, skin:0x77828c, eyeColor:0xffce5a, club:false, deathSpin:0.6, postureLean:0.22, shoulderW:1.6, torsoW:1.42, neckLen:-0.14, tuskScale:2.2, earLen:0.22,
    build(m){
const g=m.g, mossDk=mossMat; m.bodyR*=1.25;
  // SHRINK THE HEAD so it reads buried between the shoulders (tiny sunken head = key brute silhouette).
  // neckLen:-0.10 already drops the head group; scaling it down sells the "no neck, all shoulders" read.
  m.head.scale.setScalar(0.78);
  // THICKEN THE FRAME: bulk arms & legs (rescale sub-groups only — pivots/rotations untouched, rig safe).
  ['L','R'].forEach(k=>{ m.arms[k].scale.set(1.28,1.0,1.28); m.legs[k].scale.set(1.22,1.0,1.22); });
  // GRÁNIT-LAP PÁNCÉL: 6 lapított, jitterelt icosa-lap a vállakon + a gerinc mentén,
  // EGY merge-elt rockMatV mesh-ben, kő-gradienssel (a régi woodMat-"meleg szikla" hack kiváltva).
  { const plates=[];
    [[0.80,1.66,-0.02],[-0.80,1.66,-0.02]].forEach(p=> plates.push(
      {geo:jitter(new THREE.IcosahedronGeometry(0.42,1),0.09,0.07), x:p[0],y:p[1],z:p[2], sx:1.15,sy:0.62,sz:1.05, rz:p[0]>0?-0.25:0.25}));
    [[0,1.52,-0.42],[0.10,1.20,-0.50],[-0.08,0.90,-0.52],[0.04,0.62,-0.50]].forEach((p,i)=> plates.push(
      {geo:jitter(new THREE.IcosahedronGeometry(0.34-i*0.04,1),0.07,0.06), x:p[0],y:p[1],z:p[2], sx:1.2,sy:0.55,sz:1.0, rx:-0.35}));
    const geo=mergeGeos(plates); gradTint(geo,0x6d7787,0xffffff,0.4,2.0);
    g.add(mesh(geo, rockMatV, 0,0,0)); }
  // KŐ BÜTYÖK-SAPKÁK mindkét öklön
  ['L','R'].forEach(k=> m.arms[k].add(mesh(
    gradTint(jitter(new THREE.IcosahedronGeometry(0.13,0),0.03,0.03),0x8b93a2,0xffffff,-0.13,0.13),
    rockMatV, 0,-0.88,0.08, 1.15,0.8,1.2)));
  // GIANT TWO-HANDED STONE MAUL — icosa-fej + kötél-tekercs a nyakán
  const club=mesh(new THREE.CylinderGeometry(0.10,0.14,1.25,7), woodDark, 0,0,0);
  club.position.set(0.66,1.02,0.05); club.rotation.x=0.55; club.rotation.z=-0.12;
  const mhead=mesh(gradTint(jitter(new THREE.IcosahedronGeometry(0.34,1),0.08,0.07),0x757e8e,0xffffff,-0.35,0.35), rockMatV, 0,0.64,0);
  club.add(mhead);
  { const lash=mesh(new THREE.TorusGeometry(0.125,0.028,5,10), clothMat, 0,0.40,0); lash.rotation.x=Math.PI/2; club.add(lash); }
  g.add(club);
  // HUGE BROKEN TUSKS jutting from the jaw — extra pair beyond the base's tuskScale:2.2 set, jagged & splayed.
  [-1,1].forEach(s=>{ const t=mesh(new THREE.ConeGeometry(0.07,0.36,5), tuskMat, s*0.21,-0.05,0.22);
    t.rotation.x=-0.5; t.rotation.z=s*0.28; m.head.add(t); });
  // a brow-ridge moss crust to anchor the sunken-eyes "two coals in shadow" look on the tiny head
  m.head.add(mesh(new THREE.SphereGeometry(0.14,7,6), mossDk, 0,0.16,0.18, 1.6,0.6,1.0));
    } },
  shard: { id:'shard', ...SHARED.trollBase('shard'), name:'Kőszilánk', threat:0xc98a3a, dmgMul:1.0, speedCap:4.5, skin:0x6a7480, eyeColor:0xffce5a, club:false, deathSpin:1.1, postureLean:0.16, shoulderW:1.15, torsoW:1.1, neckLen:-0.06, tuskScale:1.2, earLen:0.22,
    build(m){ m._crackMat=new THREE.MeshBasicMaterial({color:0xffb24d,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});   // izzó repedés-varratok (a pop-out alatt felvillannak)
      [[0.0,1.1,0.45,0.5],[0.2,0.85,0.42,0.4],[-0.18,1.3,0.36,0.35]].forEach(s=>{ const c=mesh(new THREE.BoxGeometry(0.05,s[3],0.05), m._crackMat, s[0],s[1],s[2]); c.rotation.z=rand(-0.5,0.5); m.g.add(c); });
      // KRISTÁLYFÜRT: 6-8 nyújtott oktaéder a vállakból/hátból, sötét tő -> sápadt hegy — EGY merge-elt mesh
      { const cl=[], n=6+((Math.random()*3)|0);
        for(let i=0;i<n;i++){ const a=rand(0,6.28), rr=0.22+Math.random()*0.22;
          cl.push({geo:gradTint(new THREE.OctahedronGeometry(0.10+Math.random()*0.07,0),0x5a626e,0xffffff,-0.15,0.15),
            x:Math.cos(a)*rr, y:1.05+rand(-0.15,0.5), z:-0.12-Math.random()*0.26,
            sy:1.6+Math.random()*0.9, rx:rand(-0.55,0.15), rz:rand(-0.5,0.5)}); }
        m.g.add(mesh(mergeGeos(cl), rockMatV, 0,0,0)); }
      // kavics-szoknya a csípőn — EGY merge-elt mesh
      { const gr=[]; for(let i=0;i<5;i++){ const a=rand(0,6.28), r2=0.28+Math.random()*0.1;
          gr.push({geo:gradTint(jitter(new THREE.IcosahedronGeometry(0.07+Math.random()*0.04,0),0.02,0.02),0x777d88,0xffffff,-0.1,0.1),
            x:Math.cos(a)*r2, y:0.55+rand(-0.08,0.10), z:Math.sin(a)*r2*0.7}); }
        m.g.add(mesh(mergeGeos(gr), rockMatV, 0,0,0)); } } },
  shaman: { id:'shaman', ...SHARED.trollBase('shaman'), name:'Sámán', threat:0x36c5ff, dmgMul:0.7, speedCap:4.5, skin:0x3a7a72, eyeColor:0x6fe0ff, club:false, deathSpin:1.2, healCd:4.0, healRadius:7.0, healAmt:18,
    castRange:12.0, castMax:22.0, castWind:1.1, castCd:3.2, castDmg0:8, beamNear:5.0, beamDrop:5.5, beamDps:6.0, beamTickHz:4, witherDur:1.2, witherDmgMul:0.65, witherReloadMul:1.35,   // ÚJ: nagy távról arkán lövedék + közelről gyengítő varázs-nyaláb (HEX) postureLean:0.0, shoulderW:0.9, torsoW:0.80, neckLen:0.20, tuskScale:1.2, earLen:0.5,
    build(m){
const g=m.g;
      // ONE shared per-monster glow material for every mystic part (crystal/horns/runes) -> returned on m.staffMat (already disposed by disposeMonster)
      const staffMat=new THREE.MeshStandardMaterial({color:0x16414f,emissive:0x36c5ff,emissiveIntensity:1.4,roughness:.5,flatShading:false});
      m.staffMat=staffMat;

      // --- slim, regal proportions: thin the limbs & lengthen the head a touch (tall priest silhouette) ---
      ['L','R'].forEach(k=>{ m.arms[k].scale.set(0.82,1.08,0.82); m.legs[k].scale.set(0.85,1.1,0.85); });
      m.head.scale.set(0.92,1.12,0.95); m.head.position.y=1.95+0.15; // neckLen lift -> taller stance

      // --- VALÓDI CSONT-AGANCS: oldalanként 3 kúposodó, ívesen forgatott szegmens + 2 ág,
      //     EGY merge-elt tuskMat mesh-ben (az izzás a staffCrystal + harmadik szem kiváltsága marad) ---
      [-1,1].forEach(s=>{
        const horn=mesh(new THREE.ConeGeometry(0.055,0.6,5), tuskMat, s*0.20,0.26,-0.06);
        horn.rotation.z=s*0.62; horn.rotation.x=-0.42;
        const tine=mesh(new THREE.ConeGeometry(0.032,0.26,5), tuskMat, s*0.10,0.30,0.02); tine.rotation.x=0.5; horn.add(tine);   // előre ág
        const back=mesh(new THREE.ConeGeometry(0.028,0.20,5), tuskMat, -s*0.04,0.24,-0.06); back.rotation.x=-0.5; horn.add(back); // hátra ág
        const tip=mesh(new THREE.ConeGeometry(0.034,0.26,5), tuskMat, s*0.10,0.42,-0.08); tip.rotation.z=s*0.55; tip.rotation.x=-0.25; horn.add(tip); // felső ív-folytatás
        m.head.add(horn);
      });
      // small crystal third-eye gem on the brow to tie the crown together
      m.head.add(mesh(new THREE.OctahedronGeometry(0.05,0), staffMat, 0,0.14,0.30));

      // --- bone-bead priest necklace across the pale throat/chest (HEAD-LOCAL, drapes under the jaw) ---
      for(let i=-2;i<=2;i++){ const bead=mesh(new THREE.SphereGeometry(0.035,6,5), tuskMat, i*0.085,-0.34+Math.abs(i)*0.018,0.33); m.head.add(bead); }

      // --- LAPOS FÉL-SZOKNYA KÖPENY hátulra (LatheGeometry, a torso-val together dől) ---
      { const pts=[new THREE.Vector2(0.30,1.04),new THREE.Vector2(0.44,0.70),new THREE.Vector2(0.52,0.40),new THREE.Vector2(0.58,0.14)];
        const robe=mesh(new THREE.LatheGeometry(pts,10,Math.PI/2,Math.PI), clothMat, 0,0,0);
        m.torso.add(robe); }
      // --- CEREMONIAL CRYSTAL STAFF — kétszegmensű, enyhén megtört görcsös nyél ---
      const staff=mesh(new THREE.CylinderGeometry(0.045,0.055,0.78,7), woodMat, 0.55,0.75,0.06); staff.rotation.x=0.18;
      { const upper=mesh(new THREE.CylinderGeometry(0.035,0.045,0.72,7), woodMat, 0.03,0.72,0.03); upper.rotation.z=0.12; upper.rotation.x=-0.08; staff.add(upper); }
      // bound moss grip + bone cap at the base
      staff.add(mesh(new THREE.SphereGeometry(0.07,7,6), mossMat, 0,-0.10,0,1,0.6,1));
      staff.add(mesh(new THREE.ConeGeometry(0.05,0.12,6), tuskMat, 0,-0.74,0)); // pointed bone ferrule
      // crowning crystal (m.staffCrystal -> AI pulses its emissiveIntensity)
      const crystal=mesh(new THREE.OctahedronGeometry(0.17,0), staffMat, 0.06,1.12,0.05); staff.add(crystal); m.staffCrystal=crystal;
      crystal.add(mesh(new THREE.OctahedronGeometry(0.085,0), staffMat, 0,0,0,1,2.0,1)); // inner spike for sparkle
      // kristályfürt a fő kristály tövén (2 kisebb oktaéder)
      crystal.add(mesh(new THREE.OctahedronGeometry(0.07,0), staffMat, 0.10,-0.08,0.02, 1,1.5,1));
      crystal.add(mesh(new THREE.OctahedronGeometry(0.055,0), staffMat, -0.09,-0.10,-0.02, 1,1.4,1));
      enableBloom(crystal);   // a sámán-bot koronázó kristálya izzik (casting közben az AI felpörgeti az emInt-jét)
      // two small orbiting runes near the head of the staff
      staff.add(mesh(new THREE.OctahedronGeometry(0.05,0), staffMat, 0.13,0.56,0.02));
      staff.add(mesh(new THREE.OctahedronGeometry(0.05,0), staffMat, -0.11,0.42,-0.02));
      g.add(staff);

      // --- shoulder moss-mantle clumps (denser moss on the old mystic = family signature, refined not bulky) ---
      [[0.42,1.66,-0.06],[-0.42,1.66,-0.06]].forEach(p=> g.add(mesh(new THREE.SphereGeometry(0.16,8,6), mossMat, p[0],p[1],p[2], 1.1,0.7,1)));

      // --- healing AURA sprite (m.aura -> AI pulses opacity; already disposed) ---
      const aura=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0x36c5ff,transparent:true,opacity:0.45,depthWrite:false,blending:THREE.AdditiveBlending}));
      aura.scale.setScalar(2.8); aura.position.y=1.3; g.add(aura); m.aura=aura;

      // ability/animation state the shaman AI reads every frame
      m.healTimer=rand(1.5,3.0); m.auraPulse=0;
      m.castTimer=rand(1.5,2.6); m.casting=0; m.beaming=false; m.beamAcc=0;   // ÚJ: lövedék-telegráf + nyaláb-akkumulátor
    } },
  spitter: { id:'spitter', ...SHARED.trollBase('spitter'), name:'Köpködő', threat:0x9fb84a, dmgMul:1.0, speedCap:3.5, skin:0xa8bd52, eyeColor:0xc6ff4a, club:false, deathSpin:1.3, rangedCd:2.6, bandMin:8.0, bandMax:17.0, postureLean:0.16, shoulderW:0.95, torsoW:1.32, neckLen:-0.05, tuskScale:0.6, earLen:0.26,
    build(m){
const g=m.g, head=m.head;
      // ── per-monster bile material (the ONLY new material → disposed via m.spitMat) ──
      const spitMat=std({color:0xb6c95a, emissive:0x7e9a2e, emissiveIntensity:0.35, roughness:0.45}); m.spitMat=spitMat;

      // ── BOTTOM-HEAVY TOAD SILHOUETTE: thick stubby legs, thin little arms, low squat ──
      ['L','R'].forEach(k=>{ m.legs[k].scale.set(1.28,0.82,1.28); m.arms[k].scale.set(0.78,0.9,0.78); });

      // ── HUGE SAGGING BILE-BELLY: a big glowing translucent-looking sac drooping from the gut ──
      g.add(mesh(jitter(new THREE.IcosahedronGeometry(0.6,1),0.03,0.025), spitMat, 0,0.86,0.30, 1.34,1.12,1.02));   // main sac — facetted, duzzadt
      g.add(mesh(new THREE.SphereGeometry(0.30,9,7), spitMat, 0,0.55,0.40, 1.1,0.9,1.0));        // lower droop lobe
      g.add(mesh(new THREE.SphereGeometry(0.20,8,6), bellyMat, 0,1.02,0.50, 1.2,0.8,0.7));       // pale highlight ridge
      // moss patch crusted on the belly's upper crown (family unity)
      g.add(mesh(new THREE.SphereGeometry(0.16,7,6), mossMat, -0.10,1.18,0.18, 1.1,0.6,1));

      // ── OOZING BACK-PUSTULE CLUSTER: clumped pale-yellow bile sacs (diseased read) ──
      { const pus=[];
        [[0.40,1.46,-0.24,0.21],[-0.42,1.30,-0.22,0.23],[0.04,1.58,-0.30,0.18],[0.24,1.10,-0.42,0.20],[-0.20,1.04,-0.40,0.17]]
          .forEach(p=>{ pus.push({geo:new THREE.IcosahedronGeometry(p[3],1), x:p[0],y:p[1],z:p[2], sy:0.84});
            pus.push({geo:new THREE.ConeGeometry(p[3]*0.3,p[3]*0.5,5), x:p[0],y:p[1]-p[3]*0.8,z:p[2], rx:Math.PI}); });   // lecsöppenő csepp-kúpok
        g.add(mesh(mergeGeos(pus), spitMat, 0,0,0)); }
      // moss caps on the two biggest sacs (so the back still reads Mossfolk)
      [[0.40,1.57,-0.24],[-0.42,1.43,-0.22]].forEach(p=> g.add(mesh(new THREE.SphereGeometry(0.12,7,6), mossMat, p[0],p[1],p[2], 1,0.6,1)));

      // ── WIDE CROOKED FROG-MOUTH + PUFFED THROAT (ranged-gross read) ──
      head.add(mesh(new THREE.SphereGeometry(0.20,9,7), m.bodySkin, 0,-0.16,0.30, 1.6,0.5,1.15));   // wide flat jaw shelf
      head.add(mesh(new THREE.SphereGeometry(0.22,9,7), spitMat, 0,-0.30,0.26, 1.25,0.95,1.0));     // bulging throat/bile sac
      [-1,1].forEach(s=> head.add(mesh(new THREE.SphereGeometry(0.13,7,6), m.bodySkin, s*0.26,0.02,0.18, 1.0,1.1,0.9))); // puffed cheeks
      // snaggled crooked little tusks jutting from the wide mouth
      [-1,1].forEach(s=>{ const t=mesh(new THREE.ConeGeometry(0.04,0.15,4), tuskMat, s*0.22,-0.10,0.30); t.rotation.x=-0.2; t.rotation.z=s*0.55; head.add(t); });
      // a single drip-bead of bile dangling from the lip (the gross detail)
      head.add(mesh(new THREE.SphereGeometry(0.05,6,5), spitMat, 0.06,-0.30,0.36, 1,1.4,1));

      // ── ÚSZÓHÁRTYÁS VARANGYLÁB: 3 széles, lapított kúp-lábujj lábanként, EGY merge-elt mesh ──
      ['L','R'].forEach(k=>{ const toes=[];
        [-1,0,1].forEach(i=> toes.push({geo:new THREE.ConeGeometry(0.075,0.22,4), x:i*0.10, y:-0.585, z:0.30, rx:1.35, sy:0.5}));
        m.legs[k].add(mesh(mergeGeos(toes), spitMat, 0,0,0)); });

      m.rangedTimer=rand(1.2,2.6);
    } },
};

/* ---- ellenséges lövedék-pool (köpködő mohabombái) ---- */
const bombMat=std({color:0x6b8f3a,roughness:1});
const ebombs=[];
function makeBomb(){
  const g=new THREE.Group();
  g.add(mesh(new THREE.DodecahedronGeometry(0.18,0), bombMat,0,0,0));
  [[0.1,0.05,0.05],[-0.08,-0.04,0.08]].forEach(p=> g.add(mesh(new THREE.SphereGeometry(0.08,6,5), mossMat,p[0],p[1],p[2])));
  g.visible=false; g.traverse(o=>{ if(o.isMesh) o.castShadow=true; }); scene.add(g);
  return { g, vel:new THREE.Vector3(), prev:new THREE.Vector3(), life:0, active:false, dmg:12, spin:rand(2,5) };
}
for(let i=0;i<24;i++) ebombs.push(makeBomb());
// LIDÉRC távolsági jég-lövedék (a köpködő-bomba mintájára, saját pool)
const wbolts=[]; const wboltMat=std({color:0x16414f,emissive:0x7fe2ff,emissiveIntensity:1.5,roughness:.4});
function makeWbolt(){ const g=new THREE.Group(); g.add(mesh(new THREE.IcosahedronGeometry(0.16,0),wboltMat,0,0,0)); const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0x9becff,transparent:true,opacity:0.8,depthWrite:false,blending:THREE.AdditiveBlending})); gl.scale.setScalar(0.7); g.add(gl); g.visible=false; scene.add(g); enableBloom(g); return {g,vel:new THREE.Vector3(),prev:new THREE.Vector3(),life:0,active:false,dmg:10,spin:rand(2,4)}; }
for(let i=0;i<12;i++) wbolts.push(makeWbolt());
function wispFire(m){ const b=wbolts.find(x=>!x.active)||wbolts[0]; const p=m.g.position, sx=p.x, sy=p.y+m.bodyCY*0.9, sz=p.z;
  const dx=player.pos.x-sx, dz=player.pos.z-sz, dist=Math.hypot(dx,dz); const T=clamp(dist/10,0.6,1.8);
  const vy=(((player.pos.y-0.4)-sy)+0.5*GRAV*T*T)/T; b.g.position.set(sx,sy,sz); b.prev.set(sx,sy,sz); b.vel.set(dx/T,vy,dz/T);
  b.dmg=(TROLL_TYPES.wisp.castDmg0||8)+wave*0.4; b.life=0; b.active=true; b.g.visible=true; sparks.burst(sx,sy,sz,8,0x9becff,4,0.4); }
function updateWbolts(dt){ for(const b of wbolts){ if(!b.active) continue; b.prev.copy(b.g.position); b.vel.y-=GRAV*dt; b.g.position.addScaledVector(b.vel,dt); b.g.rotation.x+=b.spin*dt; b.life+=dt; const bp=b.g.position;
  if(player.alive && Math.hypot(bp.x-player.pos.x,bp.z-player.pos.z)<1.1 && bp.y<player.pos.y+0.2 && bp.y>player.pos.y-2.0){ b.active=false; b.g.visible=false; damagePlayerFrom(b, b.dmg); EFX.flash(bp.x,bp.y,bp.z,0x9fd0ff,0.4,1.6,0.22); continue; }
  if(bp.y<=GROUND_Y+0.1){ b.active=false; b.g.visible=false; EFX.flash(bp.x,GROUND_Y+0.2,bp.z,0x9becff,0.3,1.4,0.2); sparks.burst(bp.x,GROUND_Y+0.1,bp.z,8,0x9becff,4,0.4); continue; }
  if(b.life>4){ b.active=false; b.g.visible=false; } } }
function spitterFire(m, spread){
  const b=ebombs.find(x=>!x.active) || ebombs[0];
  const p=m.g.position, sx=p.x, sy=p.y+m.bodyCY*0.9, sz=p.z;
  let tx=player.pos.x, ty=player.pos.y-0.2, tz=player.pos.z;
  if(spread){ const a=Math.atan2(tz-sz,tx-sx)+spread, dd=Math.hypot(tx-sx,tz-sz); tx=sx+Math.cos(a)*dd; tz=sz+Math.sin(a)*dd; }   // FEJLESZTÉS: 2. lövedék oldalszórása
  const dx=tx-sx, dz=tz-sz, dist=Math.hypot(dx,dz);
  const T=clamp(dist/12,0.55,1.6);
  const vy=((ty-sy)+0.5*GRAV*T*T)/T, vx=dx/T, vz=dz/T;
  b.g.position.set(sx,sy,sz); b.prev.set(sx,sy,sz); b.vel.set(vx,vy,vz);
  b.dmg=10+wave*0.5; b.life=0; b.active=true; b.g.visible=true;
  sparks.burst(sx,sy,sz,8,0x9acb3a,4,0.4); if(AUD.growl) AUD.growl();
}
function updateBombs(dt){
  for(const b of ebombs){ if(!b.active) continue;
    b.prev.copy(b.g.position); b.vel.y-=GRAV*dt; b.g.position.addScaledVector(b.vel,dt);
    b.g.rotation.x+=b.spin*dt; b.g.rotation.y+=b.spin*0.7*dt; b.life+=dt;
    const bp=b.g.position;
    if(player.alive){ const ddx=bp.x-player.pos.x, ddz=bp.z-player.pos.z;
      if(Math.hypot(ddx,ddz)<0.7 && bp.y<player.pos.y+0.4 && bp.y>player.pos.y-1.6){
        damagePlayerFrom(b, b.dmg); gore.burst(bp.x,bp.y,bp.z,16,0x6b8f3a,5,0.5); gore.burst(bp.x,bp.y,bp.z,6,0x2c4636,4,0.3);
        b.active=false; b.g.visible=false; continue; } }
    if(bp.y<=GROUND_Y+0.12){ gore.burst(bp.x,GROUND_Y+0.1,bp.z,14,0x6b8f3a,4,0.4);
      if(player.alive && Math.hypot(bp.x-player.pos.x,bp.z-player.pos.z)<1.3) damagePlayer(b.dmg*0.5);
      b.active=false; b.g.visible=false; continue; }
    if(b.life>5){ b.active=false; b.g.visible=false; }
  }
}
function resetBombs(){ for(const b of ebombs){ b.active=false; b.g.visible=false; } }

/* ===== SÁMÁN: arkán lövedék (lassan követő, kerülhető) + gyengítő varázs-nyaláb (HEX) ===== */
const _shSp=new THREE.Vector3();
const abolts=[];
const arcMat=new THREE.MeshStandardMaterial({color:0x16414f,emissive:0x36c5ff,emissiveIntensity:1.6,roughness:.4,flatShading:false});
function makeAbolt(){ const g=new THREE.Group(); g.add(mesh(new THREE.OctahedronGeometry(0.17,0), arcMat,0,0,0));
  const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0x6fe0ff,transparent:true,opacity:0.8,depthWrite:false,blending:THREE.AdditiveBlending})); gl.scale.setScalar(0.75); g.add(gl);
  g.visible=false; scene.add(g); enableBloom(g); return { g, vel:new THREE.Vector3(), life:0, active:false, dmg:8 }; }
for(let i=0;i<8;i++) abolts.push(makeAbolt());
function shamanCast(m){ const b=abolts.find(x=>!x.active)||abolts[0];
  if(m.staffCrystal) m.staffCrystal.getWorldPosition(_shSp); else _shSp.set(m.g.position.x, m.g.position.y+m.bodyCY, m.g.position.z);
  b.g.position.copy(_shSp);
  const dx=player.pos.x-_shSp.x, dy=(player.pos.y-0.3)-_shSp.y, dz=player.pos.z-_shSp.z, d=Math.hypot(dx,dy,dz)||1, SPD=9.5;
  b.vel.set(dx/d*SPD, dy/d*SPD, dz/d*SPD); b.dmg=(TROLL_TYPES.shaman.castDmg0||8)+wave*0.4; b.life=0; b.active=true; b.g.visible=true;
  EFX.flash(_shSp.x,_shSp.y,_shSp.z,0x6fe0ff,0.5,1.8,0.25); if(AUD.head) AUD.head(); }
function updateAbolts(dt){ for(const b of abolts){ if(!b.active) continue;
    if(player.alive){ const dx=player.pos.x-b.g.position.x, dy=(player.pos.y-0.3)-b.g.position.y, dz=player.pos.z-b.g.position.z, d=Math.hypot(dx,dy,dz)||1, SPD=9.5, k=Math.min(1,dt*1.6);
      b.vel.x=lerp(b.vel.x,dx/d*SPD,k); b.vel.y=lerp(b.vel.y,dy/d*SPD,k); b.vel.z=lerp(b.vel.z,dz/d*SPD,k); }
    b.g.position.addScaledVector(b.vel,dt); b.g.rotation.y+=dt*6; b.g.rotation.x+=dt*4; b.life+=dt; const bp=b.g.position;
    if(player.alive && Math.hypot(bp.x-player.pos.x,bp.z-player.pos.z)<0.85 && Math.abs(bp.y-(player.pos.y-0.4))<1.5){
      damagePlayerFrom(b, b.dmg); applyWither(TROLL_TYPES.shaman.witherDur); EFX.flash(bp.x,bp.y,bp.z,0x6fe0ff,0.6,2.0,0.3); b.active=false; b.g.visible=false; continue; }
    if(bp.y<=GROUND_Y+0.1 || b.life>4){ b.active=false; b.g.visible=false; } } }
function resetAbolts(){ for(const b of abolts){ b.active=false; b.g.visible=false; } }
// HEX gyengítő-nyaláb: egy közös cső (SP-ben egy aktív tether), kamera-tér additív
const beamTube=(function(){ const g=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,1,7), new THREE.MeshBasicMaterial({color:0x36c5ff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,toneMapped:false})); g.visible=false; g.renderOrder=900; g.frustumCulled=false; scene.add(g); enableBloom(g); return g; })();
const _bA=new THREE.Vector3(), _bDir=new THREE.Vector3(), _bUp=new THREE.Vector3(0,1,0);
let _beamSeenThisFrame=false;
function drawBeam(ax,ay,az,bx,by,bz,t){ _bA.set(ax,ay,az); _bDir.set(bx-ax,by-ay,bz-az); const len=_bDir.length()||0.001;
  beamTube.position.set(ax+_bDir.x*0.5, ay+_bDir.y*0.5, az+_bDir.z*0.5); beamTube.scale.set(1,len,1); beamTube.quaternion.setFromUnitVectors(_bUp,_bDir.normalize());
  beamTube.material.opacity=0.35+0.3*Math.abs(Math.sin(t*9)); beamTube.visible=true; _beamSeenThisFrame=true; }
function applyWither(dur){ player.witherT=Math.max(player.witherT||0, dur); }
function updateWither(dt){ if(player.witherT>0){ player.witherT-=dt; if(player.witherT<0) player.witherT=0; }
  if(witherEl) witherEl.style.opacity=(player.witherT>0?(0.16+0.12*Math.abs(Math.sin(performance.now()*0.006))):0);
  if(!_beamSeenThisFrame) beamTube.visible=false; _beamSeenThisFrame=false; }

/* ===== SHARED BASE BODY (everything before T.build(m)) — drop-in replacement for makeMonster body =====
   r128. Uses only existing helpers/materials: mesh, std, jitter, GLOW, MOSS_T, SKIN_N, mossMat,
   skinDark, bellyMat, tuskMat, woodMat, woodDark, eyeMat, rand, lerp, THREE.*
   Keeps EVERY rigged handle + field from the contract. Mesh count ~30 (well within budget). */

/* ===== Troll HP-csíkok: EGY közös geometria + közös anyagok (depthTest:false -> köd/mélység nem rejti el) ===== */
const HPBAR_W = 1.05;                                                   // a csík világ-szélessége (méret-normalizált)
const HPBAR_GEO = new THREE.PlaneGeometry(1, 0.12); HPBAR_GEO.translate(0.5, 0, 0); // bal-szélre horgonyzott: scale.x = HP-arány
const _hpMat = (c, o)=> new THREE.MeshBasicMaterial({ color:c, transparent:true, opacity:(o==null?0.95:o), depthTest:false, depthWrite:false, fog:false, toneMapped:false });
const HPMAT_BG = _hpMat(0x140d0a, 0.62), HPMAT_HI = _hpMat(0x5fd06a), HPMAT_MID = _hpMat(0xe8c24a), HPMAT_LO = _hpMat(0xe05a3a);
const HPBAR_LINGER = 4.0;                                               // sebzés után ennyi mp-ig látszik a csík
const _hpQ = new THREE.Quaternion();
