/* ===================== HERO LANDMARKS — "Sunken Moon-Circle" =====================
   Self-contained block. Uses only helpers/materials defined ABOVE the dais:
   mesh, jitter, std, rand, GLOW, swayers, rockMat, mossMat, woodMat, woodDark,
   stemMat, glowCapM, GROUND_Y, ARENA_R. No globals leak (all wrapped in an IIFE
   except the one shared rune material, declared local). Decorative, no collision. */
(function buildLandmarks(){
  // shared weathered-stone emissive rune material (cyan beacon language)
  const runeMat = new THREE.MeshStandardMaterial({color:0x16414f,emissive:0x36c5ff,emissiveIntensity:1.15,roughness:.6});
  // helper: a tinted cyan glow sprite (same trick as the glow-mushrooms)
  function glowSprite(scale,opacity,color){
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:color||0x7fe2ff,transparent:true,opacity:opacity||0.5,depthWrite:false,blending:THREE.AdditiveBlending}));
    sp.scale.setScalar(scale||1.2); return sp;
  }
  const stone=(geo,x,y,z,sx,sy,sz,ry)=>{ const m=new THREE.Mesh(geo,envRock); m.position.set(x,y,z); m.scale.set(sx,sy==null?sx:sy,sz==null?sx:sz); if(ry) m.rotation.y=ry; m.castShadow=true; m.receiveShadow=true; return m; };

  /* ---------- 1) RUINED MEGALITH ARCH (trilithon moon-gate): két vésett menhir + ferdén ülő szemöldökkő, bevésett rúna ---------- */
  function megalithArch(x,z,facing,s){
    const g=new THREE.Group(); g.position.set(x,GROUND_Y,z); g.rotation.y=facing; g.scale.setScalar(s||1);
    const upG=makeMenhirGeo(7.7+x, 1.8,6.4,1.5);
    const l=stone(upG,-2.6,3.0,0,1,1,1,0.1); l.rotation.z=0.06; g.add(l);
    const r=stone(upG, 2.6,3.0,0,1,0.96,1,3.3); r.rotation.z=-0.05; g.add(r);
    const lin=stone(makeMenhirGeo(3.1+z, 1.4,7.6,1.6), -0.2,6.35,0,1,1,1); lin.rotation.z=Math.PI/2-0.07; lin.rotation.y=0.04; g.add(lin);
    const rune=mesh(new THREE.TorusGeometry(0.42,0.06,5,18), runeMat, 0,6.35,0.86); rune.castShadow=false; g.add(rune); enableBloom(rune);
    const sp=glowSprite(1.6,0.35,0x7fe2ff); sp.position.set(0,6.35,1.0); g.add(sp);
    g.add(stone(pickGeo(ROCK_GEOS), 4.3,0.35,1.2, 0.9,0.7,0.8, 1.2)); g.add(stone(pickGeo(ROCK_GEOS), -4.1,0.3,-0.9, 0.7,0.55,0.9, 2.2));
    scene.add(g);
  }

  /* ---------- 2) THE OLD WELL: faragott kövekből rakott kávagyűrű, derengő vízzel, fa tetővel és vödörrel ---------- */
  function oldWell(x,z,s){
    const g=new THREE.Group(); g.position.set(x,GROUND_Y,z); g.scale.setScalar(s||1);
    for(let row=0;row<2;row++){ const n=11; for(let i=0;i<n;i++){ const a=(i+row*0.5)/n*6.283, b=stone(roundBox(0.72,0.5,0.46,0.09), Math.cos(a)*1.28,0.27+row*0.5,Math.sin(a)*1.28, rand(0.92,1.06),rand(0.92,1.05),rand(0.9,1.1), -a+Math.PI/2+rand(-0.08,0.08)); g.add(b); } }
    const water=new THREE.Mesh(new THREE.CircleGeometry(1.1,24), new THREE.MeshStandardMaterial({color:0x0c2630,emissive:0x1d6b78,emissiveIntensity:0.85,roughness:.15,metalness:.3}));
    water.rotation.x=-Math.PI/2; water.position.y=0.62; g.add(water);
    for(const sx of [-1,1]){ const post=new THREE.Mesh(roundBox(0.2,2.5,0.2,0.04), envWood); post.position.set(sx*1.45,1.25,0); post.castShadow=true; g.add(post); }
    const beam=new THREE.Mesh(roundBox(3.3,0.18,0.2,0.04), envWood); beam.position.set(0,2.45,0); beam.castShadow=true; g.add(beam);
    for(const sz of [-1,1]){ const roof=new THREE.Mesh(roundBox(3.5,0.08,1.25,0.03), envWood); roof.position.set(0,2.86,sz*0.5); roof.rotation.x=sz*0.62; roof.castShadow=true; g.add(roof); }
    const rope=mesh(new THREE.CylinderGeometry(0.025,0.025,1.1,5), std({color:0x5e4326,roughness:.96}), 0.2,1.85,0); g.add(rope);
    const bucket=new THREE.Mesh(new THREE.CylinderGeometry(0.24,0.19,0.36,10,1,true), envWood); bucket.position.set(0.2,1.2,0); g.add(bucket);
    g.add(stone(pickGeo(ROCK_GEOS), 1.9,0.22,0.7, 0.55,0.42,0.6, 0.6)); g.add(stone(pickGeo(ROCK_GEOS), -1.6,0.16,1.3, 0.38,0.3,0.42, 2.1));
    const sp=glowSprite(1.7,0.42,0x7fe2ff); sp.position.y=0.95; g.add(sp);
    scene.add(g);
  }

  /* ---------- 3) FALLEN GIANT TREE: göcsörtös, kéreg-barázdás rönk törött véggel, moha-párnákkal, kiforduló gyökérzettel ---------- */
  function fallenTree(x,z,rot,s){
    const g=new THREE.Group(); g.position.set(x,GROUND_Y,z); g.rotation.y=rot; g.scale.setScalar(s||1);
    const items=[{geo:taperTube([V3(-5.6,1.25,0),V3(-2.5,1.08,0.1),V3(1.5,1.0,-0.08),V3(5.6,0.92,0.05)], t=>1.22-0.34*t+0.08*Math.sin(t*9), 12, 12, 0.2)}];
    for(let i=0;i<7;i++){ const a=i*0.9+0.3, len=1.5+_h3(i,2,x)*1.3;   // kiforduló gyökerek a tőnél
      items.push({geo:taperTube([V3(-5.5,1.25,0),V3(-6.0,1.25+Math.cos(a)*len*0.5,Math.sin(a)*len*0.5),V3(-6.3,1.25+Math.cos(a)*len,Math.sin(a)*len)], t=>0.26-0.2*t, 4, 6)}); }
    items.push({geo:taperTube([V3(2.2,1.6,0.2),V3(2.6,2.5,0.7),V3(2.7,3.3,1.5)], t=>0.26-0.18*t, 4, 6)});   // letört ágcsonk
    const tg=mergeGeos(items); vcolAttr(tg,(px,py,pz)=>{ const k=0.7+0.3*clamp(py/1.6,0,1); return [k,k,k]; }); smoothNormals(tg,70);
    const trunk=new THREE.Mesh(tg, envBark); trunk.castShadow=true; trunk.receiveShadow=true; g.add(trunk);
    const cap=new THREE.Mesh(new THREE.CircleGeometry(0.84,12), std({color:0xb08a5a,roughness:.9})); cap.position.set(5.62,0.92,0.05); cap.rotation.y=Math.PI/2; g.add(cap);   // világos bütü (évgyűrűs vég)
    const mossM=std({color:0x3a7032,roughness:1,vertexColors:true});
    for(let i=0;i<7;i++){ const mg=new THREE.IcosahedronGeometry(1,GEO_DETAIL), p=mg.attributes.position; for(let k=0;k<p.count;k++){ const vx=p.getX(k), vy=p.getY(k), vz=p.getZ(k), q=0.8+0.4*fbm3(vx*2+i,vy*2,vz*2,2); p.setXYZ(k,vx*q,vy*q*0.45,vz*q); }
      vcolAttr(mg,(px,py)=>{ const k=0.6+0.5*clamp(py*2+0.5,0,1); return [k*0.9,k,k*0.8]; }); smoothNormals(mg,80);
      const c=new THREE.Mesh(mg, mossM); c.position.set((i-3)*1.5+rand(-0.3,0.3), 2.0-Math.abs(i-3)*0.06, rand(-0.35,0.35)); c.scale.setScalar(rand(0.5,0.85)); c.castShadow=true; g.add(c); }
    scene.add(g);
  }

  /* ---------- 4) BROKEN PILLAR CLUSTER: kannelúrás oszlopok lábazattal, csorba tetővel + ledőlt dob és törmelék ---------- */
  function pillarGeo(h, broken, seed){
    const items=[], sh=new THREE.CylinderGeometry(0.5,0.58,h,20,8,true).toNonIndexed(), p=sh.attributes.position;
    for(let i=0;i<p.count;i++){ const px=p.getX(i), py=p.getY(i), pz=p.getZ(i), a=Math.atan2(pz,px), fl=1-0.06*(0.5+0.5*Math.cos(a*10)), top=py>h/2-0.01;
      p.setXYZ(i, px*fl, top&&broken ? py-0.9*vnoise3(Math.cos(a)*1.3+seed,Math.sin(a)*1.3,seed) : py, pz*fl); }
    sh.deleteAttribute('uv'); items.push({geo:sh, y:h/2+0.34});
    items.push({geo:roundBox(1.5,0.2,1.5,0.05), y:0.1}); const tor=new THREE.TorusGeometry(0.6,0.11,6,20); tor.rotateX(Math.PI/2); tor.deleteAttribute('uv'); items.push({geo:tor, y:0.3});
    if(!broken){ const t2=new THREE.TorusGeometry(0.54,0.09,6,20); t2.rotateX(Math.PI/2); t2.deleteAttribute('uv'); items.push({geo:t2, y:h+0.36}); items.push({geo:roundBox(1.36,0.24,1.36,0.05), y:h+0.56}); }
    const g=mergeGeos(items); vcolAttr(g,(px,py)=>{ const k=0.7+0.3*clamp(py/(h*0.5),0,1); return [k,k,k]; }); return smoothNormals(g,44);
  }
  function brokenPillars(x,z,rot){
    const g=new THREE.Group(); g.position.set(x,GROUND_Y,z); g.rotation.y=rot;
    const hs=[3.4,2.1,4.3], offs=[[-1.3,0.4],[1.1,-0.9],[0.2,1.3]];
    for(let i=0;i<3;i++){ const col=stone(pillarGeo(hs[i], i!==2, x+i*3.1), offs[i][0],0,offs[i][1], 1,1,1, rand(0,6.28)); col.rotation.z=(Math.random()-0.5)*0.08; g.add(col); }
    const drum=stone(pillarGeo(2.0,true,x+9.3), 2.4,0.52,1.6, 1,1,1, 0.5); drum.rotation.z=Math.PI/2; g.add(drum);
    for(let i=0;i<5;i++){ const rs=rand(0.26,0.5); g.add(stone(pickGeo(ROCK_GEOS), rand(-2,2.6),rs*0.4,rand(-2,2.6), rs,rs*0.8,rs, rand(0,6.28))); }
    scene.add(g);
  }

  /* ---------- 5) MOSS SHRINE / CAIRN: egymásra rakott lapos vésett kövek, a tetején lebegő rúna-kristály ---------- */
  function cairnShrine(x,z){
    const g=new THREE.Group(); g.position.set(x,GROUND_Y,z);
    let y=0; const rads=[1.0,0.82,0.62,0.46,0.32];
    for(let i=0;i<rads.length;i++){ const hh=0.3; g.add(stone(ROCK_GEOS[i%ROCK_GEOS.length], (Math.random()-0.5)*0.16, y+hh*0.5, (Math.random()-0.5)*0.16, rads[i],hh*1.05,rads[i]*rand(0.9,1.1), rand(0,6.28))); y+=hh*0.86; }
    const orb=mesh(new THREE.OctahedronGeometry(0.3,0), runeMat, 0, y+0.62, 0); orb.scale.y=1.5; orb.castShadow=false; g.add(orb); enableBloom(orb);
    const sp=glowSprite(1.5,0.42,0x7fe2ff); sp.position.y=y+0.62; g.add(sp);
    const ring=mesh(new THREE.TorusGeometry(0.72,0.06,5,22), runeMat, 0,0.06,0); ring.rotation.x=-Math.PI/2; ring.castShadow=false; g.add(ring); enableBloom(ring);
    g.userData.phase=Math.random()*6.28; swayers.push(g);
    scene.add(g);
  }

  /* ---------- 6) SKYLINE HERO BOULDERS (beyond the treeline) ---------- */
  function skylineRock(x,z,r,lean){
    const m=stone(makeRockGeo(x*0.37+z, GEO_DETAIL, 10), x, GROUND_Y+hillH(x,z)+r*0.5, z, r*1.2,r*1.5,r*1.1, rand(0,6.28)); m.rotation.z=lean||0; scene.add(m);
  }

  /* ===================== PLACEMENTS ===================== */
  // North moon-gate framing the moon (moon is at -X,-Z); sit it on the stone ring r=39
  megalithArch(Math.cos(-Math.PI/2)* (ARENA_R+5), Math.sin(-Math.PI/2)*(ARENA_R+5), 0, 1.0);
  // a second smaller arch off to the SE rim for skyline variety
  megalithArch(Math.cos(0.9)*(ARENA_R+5), Math.sin(0.9)*(ARENA_R+5), 0.9-Math.PI/2, 0.78);

  // mid-glade roamable hero props (kept off-center, away from the spawn altar)
  oldWell(Math.cos(0.6)*14, Math.sin(0.6)*14, 1.0);
  fallenTree(Math.cos(2.7)*18, Math.sin(2.7)*18, 2.7+1.3, 1.0);
  brokenPillars(Math.cos(3.9)*22, Math.sin(3.9)*22, 1.1);
  cairnShrine(Math.cos(2.3)*11, Math.sin(2.3)*11);
  // a second well-less landmark: lone broken pillar pair on the W side for orientation
  brokenPillars(Math.cos(4.9)*20, Math.sin(4.9)*20, -0.4);

  // outskirts skyline boulders (beyond the r=95 treeline), individually meshed (tiny count)
  skylineRock(Math.cos(0.3)*78,  Math.sin(0.3)*78,  5.5, 0.15);
  skylineRock(Math.cos(2.1)*92,  Math.sin(2.1)*92,  6.5,-0.1);
  skylineRock(Math.cos(4.4)*70,  Math.sin(4.4)*70,  4.8, 0.2);
  skylineRock(Math.cos(5.6)*100, Math.sin(5.6)*100, 7.0, 0.0);
})();

