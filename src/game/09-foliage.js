/* ===================== FOLIAGE: Sunken Moon-Circle ground-cover ===================== */
/* Insert this whole block in place of the OLD grass loop (lines 255-258) AND the OLD
   mushroom loop (line 253). It defines its own fern material + flower fn, reuses
   grassMat/rockMat/stemMat/GLOW/mesh/rand/swayers. ARENA_R is already 34 here. */

const fernMat = std({color:0x3f6e3a, roughness:1});                 // dark fern/reed
const leafMat = std({color:0x8a5a3a, roughness:.95, side:THREE.DoubleSide}); // litter
const petalAmber = new THREE.MeshStandardMaterial({color:0x6e5a2a, emissive:0xffd27a, emissiveIntensity:.9, roughness:.6, flatShading:false});
const petalCyan  = new THREE.MeshStandardMaterial({color:0x16414f, emissive:0x36c5ff, emissiveIntensity:1.0, roughness:.6, flatShading:false});

// reusable scratch (local to this block)
const _fm=new THREE.Matrix4(), _fq=new THREE.Quaternion(), _fs=new THREE.Vector3(), _fp=new THREE.Vector3(), _fe=new THREE.Euler();
// density-falloff radius sampler: rMin..rMax, bias>1 packs toward rMin (centre)
function rFall(rMin,rMax,bias){ return rMin + (rMax-rMin)*Math.pow(Math.random(), bias); }

// tiny swaying wildflower (stem + flat emissive cap) — joins swayers[]
function flower(x,z,sc,cyan){ const g=new THREE.Group(); g.position.set(x,GROUND_Y,z); g.scale.setScalar(sc);
  g.add(mesh(new THREE.CylinderGeometry(0.012,0.02,0.34,5), fernMat, 0,0.17,0));
  const cap=mesh(new THREE.CircleGeometry(0.11,6), cyan?petalCyan:petalAmber, 0,0.35,0);
  cap.rotation.x=-Math.PI/2 + rand(-0.25,0.25); cap.castShadow=false; g.add(cap);
  g.userData.phase=Math.random()*6.28; swayers.push(g); scene.add(g); }

// a fű/páfrány normáljai felfelé hajlanak: a talajjal EGYÜTT kapják a fényt -> puha gyep, nem csillogó tüske-erdő
function upNormals(g,k){ const n=g.attributes.normal; for(let i=0;i<n.count;i++){ const x=n.getX(i)*(1-k), y=n.getY(i)*(1-k)+k, z=n.getZ(i)*(1-k), l=Math.hypot(x,y,z)||1; n.setXYZ(i,x/l,y/l,z/l); } return g; }
// ---- TUFT GRASS (instanced, dense centre falloff) ----
// fűcsomó-geometria: 5 hajló penge EGY geometriába olvasztva (a régi 1-kúp = "tüske" helyett)
function grassTuftGeo(){
  const pos=[], blades=5, SEG=2;
  for(let i=0;i<blades;i++){
    const yaw=i*1.27+rand(-0.25,0.25), cx=Math.cos(yaw), cz=Math.sin(yaw), qx=-cz, qz=cx;
    const w=0.024, h=0.42+Math.random()*0.30, bend=0.12+Math.random()*0.16, pts=[];
    for(let k=0;k<=SEG;k++){ const t=k/SEG, ww=w*(1-t*0.92), off=bend*t*t;   // parabolikus hajlás + elvékonyodás
      pts.push([cx*off-qx*ww, h*t*(1-0.18*t*t), cz*off-qz*ww, cx*off+qx*ww, cz*off+qz*ww]); }
    for(let k=0;k<SEG;k++){ const A=pts[k], B=pts[k+1];
      if(k<SEG-1){ pos.push(A[0],A[1],A[2], A[3],A[1],A[4], B[3],B[1],B[4]);  pos.push(A[0],A[1],A[2], B[3],B[1],B[4], B[0],B[1],B[2]); }
      else pos.push(A[0],A[1],A[2], A[3],A[1],A[4], (B[0]+B[3])/2,B[1],(B[2]+B[4])/2); }
  }
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); g.computeVertexNormals(); return upNormals(g,0.68);
}
const grassBladeMat=applyWind(std({color:0xffffff, roughness:1, vertexColors:true, side:THREE.DoubleSide}),'grass');   // a zöldet a per-instance szín adja (szorzódás!) grassBladeMat.side=THREE.DoubleSide;   // a hajló pengék mindkét oldala látsszon
const _ic=new THREE.Color();
(function(){ const N=MOBILE_INPUT?1500:4200, BLADE=grassTuftGeo();
  gradTint(BLADE, 0x3b4a36, 0xf2f0c0, 0, 0.55, 1.15);   // sötét tő -> meleg, napszítta hegy (a kék holdfény ellen)
  const im=new THREE.InstancedMesh(BLADE, grassBladeMat, N); im.castShadow=false; im.receiveShadow=false; im.frustumCulled=false;
  grassIM=im; im.userData.full=N; syncGrassCount(); im.layers.set(NOBLOOM_LAYER);   // a bloom-passban kimarad (sosem izzik)
  const A=new THREE.Color(0x214a2a), B=new THREE.Color(0x48723a);
  const R0=GEN_PROP('altarDais')?4.5:1.2;   // a generált oltár (r 4,2) kőlapjain ne nőjön fű
  for(let i=0;i<N;i++){ const a=rand(0,6.283), r=rFall(R0, ARENA_R+6, 1.7), h=rand(0.75,1.5);
    _fp.set(Math.cos(a)*r, GROUND_Y-0.02, Math.sin(a)*r);   // a tő a talajban
    _fe.set(0, rand(0,6.283), (Math.random()-0.5)*0.25); _fq.setFromEuler(_fe);
    _fs.set(rand(0.8,1.4), h, rand(0.8,1.4)); _fm.compose(_fp,_fq,_fs); im.setMatrixAt(i,_fm);
    // kifelé szárazabb/sápadtabb fű + véletlen szórás (a monoton "műfű" ellen)
    if(im.setColorAt){ _ic.copy(A).lerp(B, Math.min(1,r/(ARENA_R+6))*0.7 + Math.random()*0.3); im.setColorAt(i,_ic); } }
  if(im.instanceColor) im.instanceColor.needsUpdate=true;
  im.instanceMatrix.needsUpdate=true; scene.add(im);
})();

// ---- FERNS (instanced, soften treeline + altar fringe) ----
// 5-levelű páfrány-geometria a régi 1 kúp-"tüske" helyett: hajló, lapos frondok egy geometriában
function fernGeo(){
  const pos=[], fronds=5;
  for(let i=0;i<fronds;i++){
    const yaw=i*1.26+rand(-0.2,0.2), cx=Math.cos(yaw), cz=Math.sin(yaw);
    const w=0.075, px=-cz*w, pz=cx*w, h=0.72+Math.random()*0.35, bend=0.42+Math.random()*0.22;
    const mx=cx*bend*0.5, mz=cz*bend*0.5, my=h*0.62, tx=cx*bend, tz=cz*bend, ty=h*0.88;
    pos.push(-px,0.02,-pz, px,0.02,pz, mx,my,mz);
    pos.push(-px,0.02,-pz, mx,my,mz, mx-px*0.5,my,mz-pz*0.5);
    pos.push(mx-px*0.5,my,mz-pz*0.5, mx+px*0.5,my,mz+pz*0.5, tx,ty,tz);
  }
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); g.computeVertexNormals(); return upNormals(g,0.68);
}
const fernMatV=applyWind(std({color:0xffffff, roughness:1, vertexColors:true, side:THREE.DoubleSide}),'fern');   // a zöldet a per-instance szín adja
(function(){ const N=260, FROND=fernGeo();
  gradTint(FROND, 0x3d4f3c, 0xffffff, 0, 0.9, 1.1);   // sötét tő -> világosabb levélhegy
  const im=new THREE.InstancedMesh(FROND, fernMatV, N); im.layers.set(NOBLOOM_LAYER); im.castShadow=false; im.receiveShadow=false; im.frustumCulled=false;
  const A=new THREE.Color(0x30583a), B=new THREE.Color(0x6f9c50);
  for(let i=0;i<N;i++){ const a=rand(0,6.283);
    // 75% in the outer fringe ring, 25% hugging the altar
    const r = (Math.random()<0.75) ? rand(ARENA_R-4, ARENA_R+12) : rand(4.5, 9);
    const h=rand(0.9,1.8);
    _fp.set(Math.cos(a)*r, GROUND_Y, Math.sin(a)*r);
    _fe.set((Math.random()-0.5)*0.2, rand(0,6.283), (Math.random()-0.5)*0.2); _fq.setFromEuler(_fe);
    _fs.set(rand(0.8,1.5), h, rand(0.8,1.5)); _fm.compose(_fp,_fq,_fs); im.setMatrixAt(i,_fm);
    if(im.setColorAt){ _ic.copy(A).lerp(B, Math.random()); im.setColorAt(i,_ic); } }
  if(im.instanceColor) im.instanceColor.needsUpdate=true;
  im.instanceMatrix.needsUpdate=true; scene.add(im);
})();

// ---- PEBBLES (instanced ground stones, worn-flagstone fleck) ----
(function(){ const N=190, PEB=makeRockGeo(23.1,0,5).scale(0.17,0.17,0.17);   // vésett mini-szikla (festett kő-anyag)
  const im=new THREE.InstancedMesh(PEB, envRock, N); im.castShadow=false; im.receiveShadow=true; im.frustumCulled=false;
  const A=new THREE.Color(0xb0b5be), B=new THREE.Color(0xffffff);
  for(let i=0;i<N;i++){ const a=rand(0,6.283), r=rFall(2, ARENA_R+14, 1.2), s=rand(0.5,1.6);
    _fp.set(Math.cos(a)*r, GROUND_Y+0.05*s, Math.sin(a)*r);
    _fe.set(rand(0,3.14), rand(0,6.283), rand(0,3.14)); _fq.setFromEuler(_fe);
    _fs.set(s, s*rand(0.5,0.8), s); _fm.compose(_fp,_fq,_fs); im.setMatrixAt(i,_fm);
    if(im.setColorAt){ _ic.copy(A).lerp(B, Math.random()); im.setColorAt(i,_ic); } }
  if(im.instanceColor) im.instanceColor.needsUpdate=true;
  im.instanceMatrix.needsUpdate=true; scene.add(im);
})();

// ---- FALLEN LEAVES (instanced flat litter quads) ----
(function(){ const N=250, LEAF=(function(){ const g=new THREE.BufferGeometry(), v=[], P=[[0,-0.11],[0.045,-0.05],[0.06,0.02],[0.035,0.08],[0,0.12],[-0.035,0.08],[-0.06,0.02],[-0.045,-0.05]];   // hegyes ovális levél-forma (a téglalap helyett)
    for(let i=0;i<P.length;i++){ const a=P[i], b=P[(i+1)%P.length]; v.push(0,0,0, a[0],a[1],0, b[0],b[1],0); } g.setAttribute('position',new THREE.Float32BufferAttribute(v,3)); g.computeVertexNormals(); return g; })();
  const im=new THREE.InstancedMesh(LEAF, leafMat, N); im.layers.set(NOBLOOM_LAYER); im.castShadow=false; im.receiveShadow=false; im.frustumCulled=false;
  const LC=[0xffffff,0xe8d0a8,0xb8d0a0,0xd8b890];
  for(let i=0;i<N;i++){ const a=rand(0,6.283), r=rFall(2, ARENA_R+8, 1.4);
    _fp.set(Math.cos(a)*r, GROUND_Y+0.02, Math.sin(a)*r);
    _fe.set(-Math.PI/2 + (Math.random()-0.5)*0.4, rand(0,6.283), (Math.random()-0.5)*0.4); _fq.setFromEuler(_fe);
    const s=rand(0.7,1.5); _fs.set(s,s,s); _fm.compose(_fp,_fq,_fs); im.setMatrixAt(i,_fm);
    if(im.setColorAt){ _ic.setHex(LC[(Math.random()*LC.length)|0]).lerp(new THREE.Color(0xffffff), Math.random()*0.25); im.setColorAt(i,_ic); } }
  if(im.instanceColor) im.instanceColor.needsUpdate=true;
  im.instanceMatrix.needsUpdate=true; scene.add(im);
})();

// ---- GLOW-MUSHROOMS (groups, swaying — reuse existing mushroom() fn) ----
for(let i=0;i<52;i++){ const a=rand(0,6.283), r=rFall(2, ARENA_R+10, 1.3);
  mushroom(Math.cos(a)*r, Math.sin(a)*r, rand(0.4,1.3), Math.random()<0.45); }

// ---- WILDFLOWERS (groups, swaying — warm amber + rare cyan accents) ----
for(let i=0;i<36;i++){ const a=rand(0,6.283), r=rFall(3, ARENA_R, 1.5);
  flower(Math.cos(a)*r, Math.sin(a)*r, rand(0.8,1.6), Math.random()<0.25); }
/* ===================== /FOLIAGE ===================== */

/* ---- EDIT K+ (sky/moon/stars/treeline) — REPLACE lines 261-269
        (the "/* hold + csillagok *​/" block through the stars IIFE). ---- */

/* gradient sky-dome: huge back-side sphere, vertex-coloured zenith->horizon.
   Renders behind everything; fog:false so it stays a clean gradient. */
