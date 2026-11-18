/* ===================== MODELL-KÉSZLET (AA-indie látvány) =====================
   A "nyers three.js-primitív" kinézet ellen: (1) SIMA, élmegtartó normálok (smoothNormals: a lapos facetta helyett
   lágy felület, de a valódi élek élesek maradnak), (2) vésett sziklák / lekerekített gerendák / sodort törzsek a
   dobozok-gömbök helyett, (3) festett hatású procedurális anyagok világ-térben (mohás kő, kéreg, deszka, ösvényes talaj),
   (4) levél-kártyás, puha lombkoronák. Minden geometria induláskor épül, a változatok megosztottak (kevés memória). */
function _h3(x,y,z){ const n=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453; return n-Math.floor(n); }
function vnoise3(x,y,z){ const xi=Math.floor(x), yi=Math.floor(y), zi=Math.floor(z); let xf=x-xi, yf=y-yi, zf=z-zi;
  xf=xf*xf*(3-2*xf); yf=yf*yf*(3-2*yf); zf=zf*zf*(3-2*zf);
  const a=_h3(xi,yi,zi), b=_h3(xi+1,yi,zi), c=_h3(xi,yi+1,zi), d=_h3(xi+1,yi+1,zi), e=_h3(xi,yi,zi+1), f=_h3(xi+1,yi,zi+1), g=_h3(xi,yi+1,zi+1), h=_h3(xi+1,yi+1,zi+1);
  return lerp(lerp(lerp(a,b,xf),lerp(c,d,xf),yf), lerp(lerp(e,f,xf),lerp(g,h,xf),yf), zf); }
function fbm3(x,y,z,oct){ let s=0,a=0.5; for(let i=0;i<(oct||3);i++){ s+=a*vnoise3(x,y,z); x=x*2.03+11.7; y=y*2.03+3.1; z=z*2.03+7.9; a*=0.5; } return s; }
/* Élmegtartó sima normálok: az egybeeső csúcsok lap-normáljait átlagolja, DE csak a `creaseDeg` szögnél laposabban
   találkozó lapok közt -> a gömbölyű részek simák, a szándékos élek (doboz-sarok, vésés) élesek maradnak. Helyben ír. */
/* gyors csúcs-kulcs: kvantált koordináták EGY számba csomagolva (szöveges kulcs helyett ~4x gyorsabb); tartományon kívül szöveg */
function vkey(x,y,z,q){ const a=Math.round(x*q)+65536, b=Math.round(y*q)+65536, c=Math.round(z*q)+65536;
  return (a>=0&&a<131072&&b>=0&&b<131072&&c>=0&&c<131072) ? a*17179869184+b*131072+c : a+','+b+','+c; }
function smoothNormals(geo, creaseDeg){
  if(geo.index){ const ng=geo.toNonIndexed(); geo.setIndex(null); for(const k in ng.attributes) geo.setAttribute(k, ng.attributes[k]); }
  const p=geo.attributes.position, n=p.count, tri=(n/3)|0, cosT=Math.cos((creaseDeg==null?50:creaseDeg)*Math.PI/180), A=p.array;
  const fr=new Float32Array(tri*3), fu=new Float32Array(tri*3);
  for(let t=0;t<tri;t++){ const i=t*9, ax=A[i+3]-A[i], ay=A[i+4]-A[i+1], az=A[i+5]-A[i+2], bx=A[i+6]-A[i], by=A[i+7]-A[i+1], bz=A[i+8]-A[i+2];
    const x=ay*bz-az*by, y=az*bx-ax*bz, z=ax*by-ay*bx, l=Math.hypot(x,y,z)||1; fr[t*3]=x; fr[t*3+1]=y; fr[t*3+2]=z; fu[t*3]=x/l; fu[t*3+1]=y/l; fu[t*3+2]=z/l; }
  // egybeeső csúcsok csoportosítása CSR-listába (Map + typed array: nincs csoportonkénti tömb-allokáció)
  const km=new Map(), gid=new Int32Array(n); let ng=0;
  for(let i=0;i<n;i++){ const k=vkey(A[i*3],A[i*3+1],A[i*3+2],250); let g=km.get(k); if(g===undefined){ g=ng++; km.set(k,g); } gid[i]=g; }
  const st=new Int32Array(ng+1); for(let i=0;i<n;i++) st[gid[i]+1]++; for(let g=0;g<ng;g++) st[g+1]+=st[g];
  const cur=st.slice(0,ng), lst=new Int32Array(n); for(let i=0;i<n;i++) lst[cur[gid[i]]++]=i;
  const out=new Float32Array(n*3);
  for(let g=0;g<ng;g++){ const s0=st[g], s1=st[g+1];
    for(let a=s0;a<s1;a++){ const i=lst[a], t=(i/3)|0, ux=fu[t*3], uy=fu[t*3+1], uz=fu[t*3+2]; let x=0,y=0,z=0;
      for(let b=s0;b<s1;b++){ const q=(lst[b]/3)|0; if(ux*fu[q*3]+uy*fu[q*3+1]+uz*fu[q*3+2]>=cosT){ x+=fr[q*3]; y+=fr[q*3+1]; z+=fr[q*3+2]; } }
      const l=Math.hypot(x,y,z)||1; out[i*3]=x/l; out[i*3+1]=y/l; out[i*3+2]=z/l; } }
  geo.setAttribute('normal', new THREE.BufferAttribute(out,3)); geo.userData._tsm=1; return geo;
}
function vcolAttr(geo, fn){   // vertex-szín kitöltés: fn(x,y,z,i) -> [r,g,b] szorzó
  const p=geo.attributes.position, c=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){ const v=fn(p.getX(i),p.getY(i),p.getZ(i),i); c[i*3]=v[0]; c[i*3+1]=v[1]; c[i*3+2]=v[2]; }
  geo.setAttribute('color', new THREE.BufferAttribute(c,3)); return geo;
}
/* Lekerekített élű hasáb (gerenda / palló / kőlap): a nyers BoxGeometry borotvaéles sarkai helyett letört, fényt fogó élek. */
const _BoxG=THREE.BoxGeometry;   // eredeti konstruktor (a troll-építés alatti hi-res csomagoló ne rekurzáljon)
function roundBox(w,h,d,b){
  b=Math.min(b==null?0.05:b, w*0.45, h*0.45, d*0.45); const g=new _BoxG(w,h,d,3,3,3).toNonIndexed(), p=g.attributes.position, hx=w/2, hy=h/2, hz=d/2;
  const snap=(v,hf)=>{ const a=Math.abs(v); return a>hf*0.9 ? Math.sign(v)*hf : Math.sign(v)*(hf-b); };   // a belső osztás a letörés-vonalra ugrik
  for(let i=0;i<p.count;i++){ const x=snap(p.getX(i),hx), y=snap(p.getY(i),hy), z=snap(p.getZ(i),hz);
    const ix=clamp(x,-hx+b,hx-b), iy=clamp(y,-hy+b,hy-b), iz=clamp(z,-hz+b,hz-b); let dx=x-ix, dy=y-iy, dz=z-iz; const l=Math.hypot(dx,dy,dz);
    if(l>1e-6){ dx/=l; dy/=l; dz/=l; p.setXYZ(i, ix+dx*b, iy+dy*b, iz+dz*b); } else p.setXYZ(i,x,y,z); }
  g.deleteAttribute('uv'); vcolAttr(g,()=>[1,1,1]); return smoothNormals(g,58);
}
/* Vésett szikla: zajjal torzított gömb, amit véletlen síkokkal "lefaragunk" -> nagy, lapos törés-felületek lágy éllel. */
function chisel(geo, cuts, lo, hi, rnd){
  const p=geo.attributes.position; rnd=rnd||Math.random;
  for(let c=0;c<cuts;c++){ let nx=rnd()*2-1, ny=rnd()*1.6-0.5, nz=rnd()*2-1; const l=Math.hypot(nx,ny,nz)||1; nx/=l; ny/=l; nz/=l; const d=lo+rnd()*(hi-lo);
    for(let i=0;i<p.count;i++){ const s=p.getX(i)*nx+p.getY(i)*ny+p.getZ(i)*nz-d; if(s>0) p.setXYZ(i,p.getX(i)-nx*s,p.getY(i)-ny*s,p.getZ(i)-nz*s); } }
  return geo;
}
function makeRockGeo(seed, detail, cuts){
  const g=new THREE.IcosahedronGeometry(1,detail), p=g.attributes.position; let s=seed*17.3; const rnd=()=>{ s+=1; return _h3(s,seed,3.3); };
  for(let i=0;i<p.count;i++){ const x=p.getX(i), y=p.getY(i), z=p.getZ(i), k=0.78+0.62*fbm3(x*1.25+seed,y*1.25,z*1.25,3); p.setXYZ(i,x*k,y*k*0.92,z*k); }
  chisel(g, cuts, 0.52, 0.86, rnd);
  for(let i=0;i<p.count;i++){ const x=p.getX(i), y=p.getY(i), z=p.getZ(i), k=1+0.07*(vnoise3(x*5+seed,y*5,z*5)-0.5); p.setXYZ(i,x*k,Math.max(-0.5,y*k),z*k); }   // apró rücskök + lapos talp
  vcolAttr(g,(x,y,z)=>{ const a=0.72+0.28*clamp((y+0.5)/0.9,0,1); return [a,a,a]; });
  return smoothNormals(g,36);
}
const GEO_DETAIL=MOBILE_INPUT?1:2;
/* TROLL HI-RES: a TrollGen a THREE-n keresztül hívja a primitíveket -> az építés idejére részletesebb változatokat
   cserélünk be (több szegmens, eggyel finomabb ikozaéder, a nagyobb dobozok lekerekített élűek). Mobilon mérsékeltebb. */
const _G0={ Sphere:THREE.SphereGeometry, Cyl:THREE.CylinderGeometry, Cone:THREE.ConeGeometry, Ico:THREE.IcosahedronGeometry, Tor:THREE.TorusGeometry, Box:THREE.BoxGeometry };
const _HQ=MOBILE_INPUT?1.2:1.45;
const _GB={
  SphereGeometry:function(r,w,h,a,b,c,d){ return new _G0.Sphere(r, Math.min(18,Math.max(10,Math.round((w||8)*_HQ))), Math.min(12,Math.max(7,Math.round((h||6)*_HQ))), a,b,c,d); },
  CylinderGeometry:function(rt,rb,h,rs,hs,o,ts,tl){ return new _G0.Cyl(rt,rb,h, Math.min(16,Math.max(10,Math.round((rs||8)*_HQ))), Math.max(1,hs||1), o,ts,tl); },
  ConeGeometry:function(r,h,rs,hs,o,ts,tl){ return new _G0.Cone(r,h, Math.min(16,Math.max(8,Math.round((rs||8)*_HQ))), Math.max(1,hs||1), o,ts,tl); },
  IcosahedronGeometry:function(r,d){ return new _G0.Ico(r, Math.min(MOBILE_INPUT?1:2,(d||0)+(r>=0.2?1:0))); },   // csak a nagy testrészek kapnak finomabb ikozaédert
  TorusGeometry:function(r,t,rs,ts,arc){ return new _G0.Tor(r,t, Math.min(8,Math.round((rs||6)*_HQ)), Math.min(24,Math.round((ts||10)*_HQ)), arc); },
  BoxGeometry:function(w,h,d,a,b,c){ const m=Math.min(w,h,d); return m>0.035 ? roundBox(w,h,d,m*0.32) : new _G0.Box(w,h,d,a,b,c); }
};
function withHiResGeo(fn){ const keys=Object.keys(_GB), saved={}; for(const k of keys){ saved[k]=THREE[k]; THREE[k]=_GB[k]; }
  try{ return fn(); } finally{ for(const k of keys) THREE[k]=saved[k]; } }
const ROCK_GEOS=[1,2,3,4,5,6].map(i=>makeRockGeo(i*3.7, GEO_DETAIL, 9));
const pickGeo=(arr)=>arr[(Math.random()*arr.length)|0];
/* Álló menhir / kőtömb: nyújtott, felfelé keskenyedő vésett hasáb. */
function makeMenhirGeo(seed, w, h, d){
  const g=new THREE.BoxGeometry(w,h,d,3,7,3).toNonIndexed(), p=g.attributes.position;
  for(let i=0;i<p.count;i++){ const x=p.getX(i), y=p.getY(i), z=p.getZ(i), t=(y+h/2)/h, tp=1-0.34*t*t, n=fbm3(x*0.9+seed,y*0.55,z*0.9,3)-0.5;
    p.setXYZ(i, x*tp+n*0.34*w*0.5+Math.sin(y*0.8+seed)*0.06, y+(t>0.9?(vnoise3(x*2+seed,3,z*2)-0.5)*0.5:0), z*tp+(fbm3(x*0.9,y*0.55+seed,z*0.9,3)-0.5)*0.34*d*0.5); }
  g.deleteAttribute('uv'); let s=seed; chisel(g, 7, Math.min(w,d)*0.36, Math.min(w,d)*0.55, ()=>{ s+=1.37; const r=_h3(s,seed,1.1); return r; });
  vcolAttr(g,(x,y,z)=>{ const a=0.66+0.34*clamp((y+h/2)/(h*0.55),0,1); return [a,a,a]; });
  return smoothNormals(g,40);
}
/* Sodort cső változó sugárral (törzs / ág / gyökér / rönk): TubeGeometry gyűrűnként átskálázva. */
function taperTube(pts, radFn, tub, radial, lump){
  const curve=new THREE.CatmullRomCurve3(pts), g=new THREE.TubeGeometry(curve,tub,1,radial,false), p=g.attributes.position, c=new THREE.Vector3();
  for(let i=0;i<=tub;i++){ curve.getPointAt(i/tub,c); const r=radFn(i/tub);
    for(let j=0;j<=radial;j++){ const k=i*(radial+1)+j, x=p.getX(k)-c.x, y=p.getY(k)-c.y, z=p.getZ(k)-c.z, jj=(j%radial), lm=lump?1+lump*(vnoise3(jj*1.7+pts[0].x,i*0.9,pts[0].z)-0.5):1;
      p.setXYZ(k, c.x+x*r*lm, c.y+y*r*lm, c.z+z*r*lm); } }
  g.deleteAttribute('uv'); return g;
}
const V3=(x,y,z)=>new THREE.Vector3(x,y,z);
/* Lombos fa törzse: enyhén ívelt, tőben szétterülő törzs + ágak a lombba + a talajra simuló gyökerek. */
function makeTrunkGeo(seed, H, R){
  const rnd=(k)=>_h3(seed,k,7.7), bx=(rnd(1)-0.5)*0.9, bz=(rnd(2)-0.5)*0.9, items=[];
  items.push({geo:taperTube([V3(0,-0.25,0),V3(bx*0.15,H*0.3,bz*0.15),V3(bx*0.6,H*0.68,bz*0.6),V3(bx,H,bz)], t=>R*(1+1.25*Math.exp(-t*9))*(1-0.5*t), 9, 9, 0.22)});
  for(let i=0;i<4;i++){ const a=i*1.571+rnd(10+i)*1.2, t0=0.55+rnd(20+i)*0.25, len=H*(0.26+rnd(30+i)*0.14), sx=bx*t0*0.8, sz=bz*t0*0.8, sy=H*t0;
    items.push({geo:taperTube([V3(sx,sy,sz),V3(sx+Math.cos(a)*len*0.5,sy+len*0.45,sz+Math.sin(a)*len*0.5),V3(sx+Math.cos(a)*len,sy+len*0.95,sz+Math.sin(a)*len)], t=>R*(0.42-0.3*t), 4, 6)}); }
  for(let i=0;i<5;i++){ const a=i*1.257+rnd(40+i)*0.7, len=R*(2.6+rnd(50+i)*1.6);
    items.push({geo:taperTube([V3(Math.cos(a)*R*0.5,R*1.3,Math.sin(a)*R*0.5),V3(Math.cos(a)*len*0.5,R*0.42,Math.sin(a)*len*0.5),V3(Math.cos(a)*len,-0.12,Math.sin(a)*len)], t=>R*(0.5-0.34*t), 4, 6)}); }
  const g=mergeGeos(items); vcolAttr(g,(x,y,z)=>{ const a=0.62+0.38*clamp(y/(H*0.5),0,1); return [a,a,a]; }); return smoothNormals(g,70);
}
/* Lombkorona: zajjal púposított gömb-pamacsok, a pamacsok közti résekben sötétítve (festett AO), felül világosodva;
   a normálok a korona közepétől kifelé hajlanak -> puha, "párnás" árnyalás. Mellé kifelé álló levél-kártyák (alfa-teszt). */
function makeCanopy(seed, n, R, y0, spread, detail){
  const rnd=(k)=>_h3(seed,k,2.9), P=[], pos=[], col=[], cpos=[], ccol=[], cuv=[], cnrm=[];
  for(let i=0;i<n;i++){ const a=(i/n)*6.283+rnd(i)*0.9, rr=i?spread*(0.55+rnd(i+20)*0.55):0, r=R*(i?0.62+rnd(i+40)*0.4:1);
    P.push({x:Math.cos(a)*rr, y:y0+(i?(rnd(i+60)-0.35)*R*0.9-rr*0.28:R*0.35), z:Math.sin(a)*rr, r}); }
  let ymin=1e9, ymax=-1e9; for(const q of P){ ymin=Math.min(ymin,q.y-q.r*0.8); ymax=Math.max(ymax,q.y+q.r*0.8); }
  const ico=new THREE.IcosahedronGeometry(1,detail), ip=ico.attributes.position, cx=0, cy=(ymin+ymax)/2, cz=0;
  const shade=(x,y,z,self)=>{ let occ=1; for(const o of P){ if(o===self) continue; const d=Math.hypot(x-o.x,(y-o.y)/0.82,z-o.z)/o.r; if(d<occ) occ=d; }
    const h=clamp((y-ymin)/(ymax-ymin),0,1), k=(0.46+0.62*Math.pow(h,1.25))*(0.5+0.5*clamp((occ-0.62)/0.5,0,1))*(0.9+0.2*vnoise3(x*1.3+seed,y*1.3,z*1.3)); return [k*0.96,k,k*0.9]; };
  for(const q of P){ for(let i=0;i<ip.count;i++){ const vx=ip.getX(i), vy=ip.getY(i), vz=ip.getZ(i), k=q.r*(0.74+0.56*fbm3(vx*1.5+q.x+seed,vy*1.5+q.y,vz*1.5+q.z,3));
        const x=q.x+vx*k, y=q.y+vy*k*0.82, z=q.z+vz*k; pos.push(x,y,z); const c=shade(x,y,z,q); col.push(c[0],c[1],c[2]); }
    const nc=detail>1?10:6;   // levél-kártyák: sugárirányban kiálló négyszögek (a sziluettet törik meg)
    for(let j=0;j<nc;j++){ const u=rnd(j*7+q.x*3)*2-1, th=rnd(j*13+q.z*5)*6.283, sq=Math.sqrt(1-u*u); let dx=sq*Math.cos(th), dy=u*0.8+0.25, dz=sq*Math.sin(th); const dl=Math.hypot(dx,dy,dz); dx/=dl; dy/=dl; dz/=dl;
      let tx=dy*0.3-dz, ty=dz*0.1-dx*0.3, tz=dx-dy*0.1; const roll=rnd(j*3.1+q.y)*6.283, tl=Math.hypot(tx,ty,tz)||1; tx/=tl; ty/=tl; tz/=tl;
      const bx2=dy*tz-dz*ty, by2=dz*tx-dx*tz, bz2=dx*ty-dy*tx, cr=Math.cos(roll), sr=Math.sin(roll), sx=tx*cr+bx2*sr, sy=ty*cr+by2*sr, sz=tz*cr+bz2*sr;
      const s=q.r*(0.55+rnd(j+q.x)*0.35), b0=q.r*0.72, b1=b0+s*1.15, hw=s*0.6, ox=q.x, oy=q.y, oz=q.z;
      const c0=[ox+dx*b0-sx*hw, oy+dy*b0*0.82-sy*hw, oz+dz*b0-sz*hw], c1=[ox+dx*b0+sx*hw, oy+dy*b0*0.82+sy*hw, oz+dz*b0+sz*hw], c2=[ox+dx*b1+sx*hw, oy+dy*b1*0.82+sy*hw, oz+dz*b1+sz*hw], c3=[ox+dx*b1-sx*hw, oy+dy*b1*0.82-sy*hw, oz+dz*b1-sz*hw];
      const sc=shade(ox+dx*b1,oy+dy*b1*0.82,oz+dz*b1,q), lit=[sc[0]*1.12,sc[1]*1.14,sc[2]*1.08];
      for(const [v,uu,vv] of [[c0,0,0],[c1,1,0],[c2,1,1],[c0,0,0],[c2,1,1],[c3,0,1]]){ cpos.push(v[0],v[1],v[2]); cuv.push(uu,vv); cnrm.push(dx,dy*0.6+0.4,dz); ccol.push(lit[0],lit[1],lit[2]); } } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); smoothNormals(g,85);
  { const p=g.attributes.position, nr=g.attributes.normal; for(let i=0;i<p.count;i++){ let x=p.getX(i)-cx, y=p.getY(i)-cy, z=p.getZ(i)-cz; const l=Math.hypot(x,y,z)||1;
      x=nr.getX(i)*0.55+x/l*0.45; y=nr.getY(i)*0.55+y/l*0.45; z=nr.getZ(i)*0.55+z/l*0.45; const m=Math.hypot(x,y,z)||1; nr.setXYZ(i,x/m,y/m,z/m); } }
  const cg=new THREE.BufferGeometry(); cg.setAttribute('position',new THREE.Float32BufferAttribute(cpos,3)); cg.setAttribute('color',new THREE.Float32BufferAttribute(ccol,3));
  cg.setAttribute('uv',new THREE.Float32BufferAttribute(cuv,2)); cg.setAttribute('normal',new THREE.Float32BufferAttribute(cnrm,3));
  return { puff:g, cards:cg };
}
/* Fenyő: egymásra ültetett, rojtos szélű kúp-szoknyák (a peremen túli erdő sziluettjéhez). */
function makeConiferGeo(seed){
  const items=[], L=5;
  for(let i=0;i<L;i++){ const r=2.0*(1-i/(L+0.6)), h=2.1, g=new THREE.ConeGeometry(r,h,11,2,true).toNonIndexed(), p=g.attributes.position;
    for(let k=0;k<p.count;k++){ const x=p.getX(k), y=p.getY(k), z=p.getZ(k), a=Math.atan2(z,x), low=y<-h*0.4, mid=(!low&&y<h*0.3), w=1+0.26*Math.sin(a*5.5+seed+i*1.7)+0.12*Math.sin(a*11+i);
      if(low) p.setXYZ(k,x*w,y-0.28*(0.5+0.5*Math.sin(a*5.5+seed+i)),z*w); else if(mid) p.setXYZ(k,x*(0.94+0.1*Math.sin(a*7+i)),y,z*(0.94+0.1*Math.sin(a*7+i))); }
    g.deleteAttribute('uv'); vcolAttr(g,(x,y,z)=>{ const rr=Math.hypot(x,z)/Math.max(0.01,r), k=(0.5+0.5*rr)*(0.72+0.1*i); return [k*0.9,k,k*0.98]; });
    items.push({geo:g, y:1.5+i*1.12+h/2}); }
  const tr=new THREE.CylinderGeometry(0.16,0.3,2.2,7,1,true).toNonIndexed(); tr.deleteAttribute('uv'); vcolAttr(tr,()=>[0.34,0.25,0.2]); items.push({geo:tr,y:1.0});
  return smoothNormals(mergeGeos(items),62);
}

/* ---- procedurális, világ-térbeli "festett" anyagok (a meglévő Standard shader diffúz színét módosítják) ---- */
const STY_NOISE=[
  'float sh1(float n){ return fract(sin(n)*43758.5453); }',
  'float sn3(vec3 x){ vec3 p=floor(x), f=fract(x); f=f*f*(3.0-2.0*f); float n=p.x+p.y*57.0+p.z*113.0;',
  '  return mix(mix(mix(sh1(n),sh1(n+1.0),f.x), mix(sh1(n+57.0),sh1(n+58.0),f.x), f.y), mix(mix(sh1(n+113.0),sh1(n+114.0),f.x), mix(sh1(n+170.0),sh1(n+171.0),f.x), f.y), f.z); }',
  'float sn2(vec2 x){ vec2 p=floor(x), f=fract(x); f=f*f*(3.0-2.0*f); float n=p.x+p.y*57.0; return mix(mix(sh1(n),sh1(n+1.0),f.x), mix(sh1(n+57.0),sh1(n+58.0),f.x), f.y); }',
  'float fb2(vec2 p){ return 0.5*sn2(p)+0.25*sn2(p*2.07+13.1)+0.125*sn2(p*4.11+31.7); }'].join('\n')+'\n';
const STY_FRAG={
  rock:[ '{ float n1=sn3(vWP*0.55), n2=sn3(vWP*2.6+11.0), n3=sn3(vWP*8.5);',
    '  diffuseColor.rgb*=(0.78+0.38*n1)*(0.92+0.16*n3);',
    '  diffuseColor.rgb*=1.0-smoothstep(0.03,0.0,abs(n2-0.5))*0.30*smoothstep(0.35,0.6,n1);',          // hajszál-repedések
    '  float moss=smoothstep(0.50,0.74,vWN.y+(n2-0.5)*0.6+(n1-0.5)*0.35);',
    '  diffuseColor.rgb=mix(diffuseColor.rgb, vec3(0.15,0.30,0.11)*(0.7+0.6*n3), moss*0.9);',          // moha a felfelé néző felületeken
    '  diffuseColor.rgb*=mix(0.5,1.0,smoothstep(-0.1,0.8,vWP.y)); }' ].join('\n'),                       // talaj-közeli sötétedés
  bark:[ '{ float a=sn3(vec3(vWP.x*4.2,vWP.y*0.55,vWP.z*4.2)), b=sn3(vec3(vWP.x*12.0,vWP.y*1.7,vWP.z*12.0));',
    '  float groove=smoothstep(0.40,0.5,a)*(1.0-smoothstep(0.5,0.60,a));',
    '  diffuseColor.rgb*=(0.80+0.36*a)*(0.9+0.2*b)*(1.0-0.42*groove);',                                 // függőleges kéreg-barázdák
    '  float m=smoothstep(0.56,0.8,sn3(vWP*0.85+5.0)+(1.0-smoothstep(0.0,2.6,vWP.y))*0.22)*smoothstep(-0.2,0.5,vWN.y+0.35);',
    '  diffuseColor.rgb=mix(diffuseColor.rgb, vec3(0.13,0.26,0.10), m*0.6);',
    '  diffuseColor.rgb*=mix(0.5,1.0,smoothstep(0.0,1.2,vWP.y)); }' ].join('\n'),
  wood:[ '{ vec3 q=vOP; float pz=q.z/0.36+0.5, id=floor(pz), f=fract(pz);',
    '  float seam=smoothstep(0.0,0.06,f)*smoothstep(1.0,0.94,f);',
    '  float grain=sn3(vec3(q.x*1.3+id*9.0,q.y*7.0,q.z*24.0)), knot=smoothstep(0.84,0.92,sn3(vec3(q.x*0.8+id*3.7,q.y*1.5,id*1.3)));',
    '  diffuseColor.rgb*=(0.82+0.34*sh1(id*7.13+floor(q.x*0.31)*3.1))*(0.84+0.3*grain)*mix(0.38,1.0,seam)*(1.0-0.4*knot);',
    '  diffuseColor.rgb=mix(diffuseColor.rgb, vec3(0.14,0.25,0.10), smoothstep(0.62,0.85,sn3(vWP*0.7+2.0))*smoothstep(0.3,0.9,vWN.y)*0.45); }' ].join('\n'),
  ground:[ '{ vec2 g=vWP.xz; float r=length(g), n1=fb2(g*0.06), n2=fb2(g*0.42+7.0), n3=sn2(g*4.0);',
    '#ifdef USE_MAP',
    '  diffuseColor.rgb=mix(diffuseColor.rgb, diffuseColor.rgb*texture2D(map,vUv*0.171+0.31).rgb*3.0, 0.45);',   // második, nagy léptékű mintavétel: nincs csempe-ismétlődés
    '#endif',
    '  diffuseColor.rgb*=0.74+0.46*n1;',
    '  { float gl=dot(diffuseColor.rgb,vec3(0.3,0.59,0.11)); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(gl*0.82,gl*1.02,gl*0.9),0.38); }',   // kevésbé neon: holdfényes, tompább zöld
    '  diffuseColor.rgb=mix(diffuseColor.rgb, diffuseColor.rgb*vec3(1.25,1.08,0.62), smoothstep(0.52,0.72,n2)*0.5);',      // sárgás, szárazabb foltok
    '  float sp=abs(fract((atan(g.y,g.x)-0.7854)/1.5708+0.5)-0.5)*1.5708, dP=sin(min(sp,1.5))*r, wob=(n2-0.5)*2.2;',
    '  float path=(1.0-smoothstep(0.9,2.4,dP+wob))*smoothstep(4.0,6.5,r)*(1.0-smoothstep(49.0,56.0,r));',
    '  path=max(path, 1.0-smoothstep(0.8,1.9,abs(r-5.6)+wob*0.45));',
    '  diffuseColor.rgb=mix(diffuseColor.rgb, vec3(0.105,0.082,0.058)*(0.72+0.56*n3)*(0.8+0.4*n2), path*0.92); }' ].join('\n')   // kitaposott föld-ösvények + gyűrű az oltár körül
};
// baked: világ-térbe összevont hálóhoz (12-world-batch) — a háló-térbeli pozíciót (vOP: a deszka-minta ezt olvassa) az aOP attribútum hordozza
function applyStylized(mat, kind, baked){
  mat.onBeforeCompile=function(sh){
    sh.vertexShader=(baked?'attribute vec3 aOP;\n':'')+'varying vec3 vWP; varying vec3 vWN; varying vec3 vOP;\n'+sh.vertexShader
      .replace('#include <defaultnormal_vertex>','#include <defaultnormal_vertex>\nvWN=normalize((vec4(transformedNormal,0.0)*viewMatrix).xyz);')   // világ-normál a three skálázás-helyes (inverz-transzponált) normáljából
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvOP='+(baked?'aOP':'position')+'; { vec4 wp_=vec4(position,1.0);\n#ifdef USE_INSTANCING\n wp_=instanceMatrix*wp_;\n#endif\n vWP=(modelMatrix*wp_).xyz; }');
    sh.fragmentShader='varying vec3 vWP; varying vec3 vWN; varying vec3 vOP;\n'+STY_NOISE+sh.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+STY_FRAG[kind]);
  };
  mat.customProgramCacheKey=function(){ return 'sty-'+kind+(baked?'-b':''); }; return mat;
}
/* levél-fürt alfa-textúra a lomb-kártyákhoz (alulról legyezőszerűen kihajló levelek) */
const LEAF_T=(function(){ const S=128, c=document.createElement('canvas'); c.width=c.height=S; const x=c.getContext('2d');
  const leaf=(ang,len,w,sh)=>{ x.save(); x.translate(S/2,S*0.98); x.rotate(ang); x.beginPath(); x.moveTo(0,0); x.quadraticCurveTo(w,-len*0.5,0,-len); x.quadraticCurveTo(-w,-len*0.5,0,0);
    x.fillStyle='rgb('+sh+','+sh+','+sh+')'; x.fill(); x.restore(); };
  [[-1.05,74,17,170],[1.05,74,17,178],[-0.62,96,19,205],[0.62,96,19,212],[-0.22,112,20,238],[0.24,110,20,244],[0,120,18,255]].forEach(l=>leaf(l[0],l[1],l[2],l[3]));
  const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; return t; })();
// környezeti anyagok (a trollok megosztott rock/wood anyagaitól KÜLÖN, mert azokra a troll rim-shader kerül)
const envRock =applyStylized(std({color:0x5c606a,roughness:.96,vertexColors:true}),'rock');
const envBark =applyStylized(std({color:0x7a5c44,roughness:.97,vertexColors:true}),'bark');
const envWood =applyStylized(std({color:0x7a5333,roughness:.86}),'wood');
const envWoodV=applyStylized(std({color:0x7a5333,roughness:.86,vertexColors:true}),'wood');
const leafCardMat=applyWind(std({color:0x86b25a,roughness:.9,vertexColors:true,map:LEAF_T,alphaTest:0.42,side:THREE.DoubleSide}),'canopy');
const coniferMat=applyWind(std({color:0x1d3a26,roughness:.95,vertexColors:true}),'canopy');
const TREE_KIT=[1,2,3,4].map(i=>({ trunk:makeTrunkGeo(i*5.1,4.6,0.3), can:makeCanopy(i*9.7, 6+(i%2), 1.05, 4.75, 1.15, 1) }));   // detail 1: a sok fa miatt (a levél-kártyák adják a részletet)
const CONIFER_GEOS=[1,2,3].map(i=>makeConiferGeo(i*2.3));
const treeCasters=[];   // árnyékvető fa-mesh-ek (a grafikai fokozat kapcsolja)
/* talaj-kontakt árnyék-foltok: minden fa/szikla/tárgy alá egy puha sötét korong -> a tárgyak "leülnek" a talajra (1 drawcall) */
const _blobList=[]; function contactBlob(x,z,r,a){ _blobList.push([x,z,r,a==null?1:a]); }
function buildContactBlobs(){
  const im=new THREE.InstancedMesh(new THREE.CircleGeometry(1,20).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({map:GLOW,color:0x020508,transparent:true,opacity:0.62,depthWrite:false,fog:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}), _blobList.length);
  const m=new THREE.Matrix4(), q=new THREE.Quaternion(), s=new THREE.Vector3(), p=new THREE.Vector3();
  _blobList.forEach((b,i)=>{ p.set(b[0],GROUND_Y+0.012,b[1]); s.set(b[2],1,b[2]); m.compose(p,q,s); im.setMatrixAt(i,m); });
  im.instanceMatrix.needsUpdate=true; im.frustumCulled=false; im.layers.set(NOBLOOM_LAYER); im.renderOrder=-2; scene.add(im);
}
