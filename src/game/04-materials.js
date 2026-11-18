/* ===================== Anyagok / segédek ===================== */
const std=(o)=>new THREE.MeshStandardMaterial(Object.assign({roughness:.9,metalness:0,flatShading:false},o));   // AA-indie: sima árnyalás (az éleket a smoothNormals tartja meg)
const skinMat=std({color:0x6b9c6e,bumpMap:SKIN_N,bumpScale:0.015});
const skinDark=std({color:0x3f6250,bumpMap:SKIN_N,bumpScale:0.015});
const bellyMat=std({color:0xe4d8b8});   // csont-krém VILÁGOS akcentus (torok/fül/has perem) — value-kontraszt, ami BÁRMELY elem-tint alatt megőrzi a formát
const hairMat=std({color:0x24402e,roughness:.97});
const tuskMat=std({color:0xeee2cf,roughness:.5});
const clothMat=std({color:0x604028,roughness:1});
const woodMat=std({color:0x7b5433,roughness:.85,bumpMap:SKIN_N,bumpScale:0.02});
const woodDark=std({color:0x3b2a1e,roughness:.95});
const rockMat=std({color:0x454c5c,roughness:.95,bumpMap:SKIN_N,bumpScale:0.05});
const mossMat=std({color:0x93c584,roughness:0.92,map:MOSS_T,bumpMap:MOSS_T,bumpScale:0.06});   // világos szorzó: az sRGB-dekódolt (sötétebb) textúrát kompenzálja   // sötét akcentus, picit kevésbé matt -> faceted highlight-lépcső
const rockDark=std({color:0x2f3546,roughness:.97,bumpMap:SKIN_N,bumpScale:0.05,emissive:0x171d2b,emissiveIntensity:0.55});   // FÁZIS 5: sötét barlang-szikla — emissive-padló, hogy az árnyékos oldal se essen az égnél sötétebb "lyukba" a magas fedélzetről nézve
const caveMouthMat=new THREE.MeshBasicMaterial({color:0x0b1526,fog:true});           // FÁZIS 5: a barlang szája — SÖTÉT NAVY üreg (nem tükröz fényt), de nem az égnél sötétebb kivágás; a fog a távoli barlangokat az égbe olvasztja
const stemMat=std({color:0xe8dcc2,roughness:.8});
const capMat=std({color:0xc44a43,roughness:.7});
const glowCapM=new THREE.MeshStandardMaterial({color:0x16414f,emissive:0x36c5ff,emissiveIntensity:1.2,roughness:.6,flatShading:false});
const eyeMat=new THREE.MeshStandardMaterial({color:0x2a1c08,emissive:0xff5a2a,emissiveIntensity:2.0,roughness:.4});
const arrowWood=std({color:0x8a6a40,roughness:.7});
const featherMat=std({color:0xd64b3a,roughness:.8,side:THREE.DoubleSide});
const metalMat=new THREE.MeshStandardMaterial({color:0xbfc6d2,metalness:.7,roughness:.3});
// Vertex-színes párhuzamos materiálok. A meglévő megosztottakon NEM kapcsoljuk fel a vertexColors-t,
// mert színattribútum nélküli mesh-eik elromlanának. A vertex-szín SZORZÓDIK a material.color-ral,
// ezért a gradiensek fehér körül készülnek (csak sötétítenek/árnyalnak).
const mossMatV=std({color:0x466b42,roughness:.92,vertexColors:true});
const rockMatV=std({color:0x3e4452,roughness:.95,vertexColors:true});
const woodDarkV=std({color:0x5c4430,roughness:.95,vertexColors:true});
const canopyMat=applyWind(std({color:0x74a050,roughness:.9,vertexColors:true}),'canopy');
const groundMat=std({color:0x6c8576,roughness:.95,map:GROUND_T,bumpMap:GROUND_T,bumpScale:0.05,vertexColors:true});   // a festett talaj-shadert (ösvények, foltok) a modell-készlet után kapja meg
const tuskMatV=std({color:0xeee2cf,roughness:.5,vertexColors:true});

function mesh(geo,mat,x,y,z,sx,sy,sz){
  const m=new THREE.Mesh(geo,mat); m.position.set(x||0,y||0,z||0);
  if(sx!==undefined) m.scale.set(sx, sy===undefined?sx:sy, sz===undefined?sx:sz);
  m.castShadow=true; m.receiveShadow=true; return m;
}
function jitter(geo,axz,ay){
  // FONTOS: a Dodeka/Ikosa geometriák NEM indexeltek (minden lapnak saját, duplikált
  // sarokpontjai vannak). Ha minden vertexet külön tolunk el, a lapok SZÉTSZAKADNak a
  // varratoknál (rések/lyukak a kövön). Ezért az egybeeső pontok KÖZÖS eltolást kapnak.
  const p=geo.attributes.position, seen=new Map();
  for(let i=0;i<p.count;i++){
    const x=p.getX(i), y=p.getY(i), z=p.getZ(i);
    const key=vkey(x,y,z,1e3);
    let o=seen.get(key); if(!o){ o=[(Math.random()-0.5)*axz,(Math.random()-0.5)*ay,(Math.random()-0.5)*axz]; seen.set(key,o); }
    p.setX(i,x+o[0]); p.setY(i,y+o[1]); p.setZ(i,z+o[2]);
  }
  return smoothNormals(geo,50);
}
/* ---- vertex-szín segédek: a csiszolt indie low-poly kulcsa a per-vertex gradiens.
   gradTint/radialTint ÍR (felülírja a color attribútumot), mottleTint SZOROZ a meglévőre
   -> sorrend: grad/radial először, mottle utána. Fehér körüli színek: a material.color-ral
   és az elem-átszínezéssel (elementSkin) szorzódva komponálnak. ---- */
function gradTint(geo,cBot,cTop,yMin,yMax,pow,axis){
  const p=geo.attributes.position,n=p.count,col=new Float32Array(n*3);
  const A=new THREE.Color(cBot),B=new THREE.Color(cTop),C=new THREE.Color();
  const get=axis==='z'?(i)=>p.getZ(i):(i)=>p.getY(i);
  for(let i=0;i<n;i++){ let t=(get(i)-yMin)/(yMax-yMin);
    t=Math.min(1,Math.max(0,t)); if(pow) t=Math.pow(t,pow);
    C.copy(A).lerp(B,t); col[i*3]=C.r; col[i*3+1]=C.g; col[i*3+2]=C.b; }
  geo.setAttribute('color',new THREE.BufferAttribute(col,3)); return geo;
}
function radialTint(geo,cIn,cOut,rMax,cx,cz){
  const p=geo.attributes.position,n=p.count,col=new Float32Array(n*3);
  const A=new THREE.Color(cIn),B=new THREE.Color(cOut),C=new THREE.Color();
  for(let i=0;i<n;i++){ const t=Math.min(1,Math.hypot(p.getX(i)-(cx||0),p.getZ(i)-(cz||0))/rMax);
    C.copy(A).lerp(B,t); col[i*3]=C.r; col[i*3+1]=C.g; col[i*3+2]=C.b; }
  geo.setAttribute('color',new THREE.BufferAttribute(col,3)); return geo;
}
function mottleTint(geo,colors,blend){
  // A jitterrel azonos kulcs-kerekítés: az egybeeső vertexek KÖZÖS foltszínt kapnak
  // (nem-indexelt geometrián nem lesz lap-konfetti, hanem koherens folt).
  const p=geo.attributes.position, seen=new Map(), W=new THREE.Color(0xffffff);
  const has=!!geo.attributes.color;
  const col=has?geo.attributes.color.array:new Float32Array(p.count*3).fill(1);
  const C=new THREE.Color();
  for(let i=0;i<p.count;i++){
    const key=vkey(p.getX(i),p.getY(i),p.getZ(i),1e3);
    let c=seen.get(key); if(!c){ C.setHex(colors[(Math.random()*colors.length)|0]).lerp(W,blend||0); c=[C.r,C.g,C.b]; seen.set(key,c); }
    col[i*3]*=c[0]; col[i*3+1]*=c[1]; col[i*3+2]*=c[2];
  }
  geo.setAttribute('color',new THREE.BufferAttribute(col,3)); return geo;
}
function mergeGeos(items){
  // Transzform-beégető összefésülés: 1 mesh = 1 drawcall. Hiányzó color attribútum fehérrel pótolva.
  const pos=[],col=[],m4=new THREE.Matrix4(),e=new THREE.Euler(),q=new THREE.Quaternion(),
        v=new THREE.Vector3(),sv=new THREE.Vector3(),pv=new THREE.Vector3();
  for(const it of items){
    const g=it.geo.index?it.geo.toNonIndexed():it.geo;
    e.set(it.rx||0,it.ry||0,it.rz||0); q.setFromEuler(e);
    pv.set(it.x||0,it.y||0,it.z||0); sv.set(it.sx||it.s||1,it.sy||it.s||1,it.sz||it.s||1);
    m4.compose(pv,q,sv);
    const p=g.attributes.position,c=g.attributes.color;
    for(let i=0;i<p.count;i++){
      v.fromBufferAttribute(p,i).applyMatrix4(m4);
      pos.push(v.x,v.y,v.z);
      if(c) col.push(c.getX(i),c.getY(i),c.getZ(i)); else col.push(1,1,1);
    }
  }
  const out=new THREE.BufferGeometry();
  out.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  out.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  return smoothNormals(out,50);
}

