/* ===================== KOHERENS MOHÁS-ERDŐ ELHELYEZÉS (tömör propok) =====================
   Minden tömör prop ütközőt regisztrál (tree()/rock() automatikusan). A tisztás
   közepe (spawn, r<6.5) szabad; a meglévő mászó-építmények és a középső landmarkok
   lábnyoma körül kerülünk. A propok klaszteresen ülnek (ligetek + kő-kibúvások),
   nem véletlen-átfedőn, és legalább ~1.0-re egymástól, hogy a 0.42 sugár elférjen
   vagy tisztán blokkoljon. */

// FÁZIS 5: barlang-spawnpontok az aréna peremén (a trollok innen bújnak elő, nem a falból). A szerver UGYANEZEKET a pozíciókat használja.
const R_CAVE=SHARED.R_CAVE, CAVE_ANGS=SHARED.CAVE_ANGS;   // közös a co-op szerverrel: src/shared/config.js
const CAVES=CAVE_ANGS.map(a=>({ ang:a, x:Math.cos(a)*R_CAVE, z:Math.sin(a)*R_CAVE }));
// foglalt zónák, amiket KERÜLÜNK (cx,cz,r) — spawn + mászó-építmények + landmarkok + barlangok
const KEEP_CLEAR = [
  ...CAVES.map(c=>[c.x, c.z, 3.2]),   // barlangok köré ne kerüljön fa/kő
  ...CAVE_FOOT.map(f=>[Math.cos(f.ang)*(CAVE_FRONT_R-4), Math.sin(f.ang)*(CAVE_FRONT_R-4), 5.5]),   // a nagy barlangszáj előtere szabad: a trollok kijárata, és a száj kilátszik
  [0,0,6.5],            // spawn-tisztás
  ...[0,1,2,3].map(i=>[Math.cos(0.39+i*Math.PI/2)*8.0, Math.sin(0.39+i*Math.PI/2)*8.0, 1.7]),   // parázstartók
  [-7.0,5.5,2.0],[-8.6,6.2,2.0],[-7.6,4.0,2.0],                    // fa ládák
  [13,11,2.6],[16,13,2.6],                                          // kőlépcsők kifelé
  [11.55,7.90,2.6],    // oldWell
  [-7.3,8.2,2.4],      // cairnShrine
  [-16.3,7.65,7.0],    // fallenTree (hosszú log)
  [-15.9,-15.2,4.0],   // brokenPillars #1
  [3.7,-19.6,4.0],     // brokenPillars #2
  [TROLL_IDOL.x, TROLL_IDOL.z, 3.6],   // generált kőtroll-bálvány (07-troll-idol.js)
  [22.5,9,5.2],[18,9,2.8],   // A-kilátó rámpa + fedélzet
  [8,22.5,5.2],[8,18,2.8],   // B-kilátó rámpa + fedélzet
  [13,13.5,3.2],             // lombhíd közép (A<->B)
  // --- ÓRIÁSFA-LOMBHÁZAK (törzs + fedélzet + rámpa-folyosó) + kötélhíd-vonalak (alattuk ne nőjön fa a hídba) ---
  [40,-8,4.6],[37.1,-8,3.6],[37.1,-23,3.4],[37.1,-18.5,3.4],[37.1,-14,3.4],[37.1,-9.5,3.4],   // TH1 (kelet)
  [24,-24,4.6],[24,-21.1,3.6],[9,-21.1,3.4],[13.5,-21.1,3.4],[18,-21.1,3.4],[22.5,-21.1,3.4],   // TH2 (délkelet)
  [-34,-18,4.6],[-31.1,-18,3.6],[-31.1,-33,3.4],[-31.1,-28.5,3.4],[-31.1,-24,3.4],[-31.1,-19.5,3.4],   // TH3 (délnyugat)
  [-20,24,4.6],[-20,21.1,3.6],[-5,21.1,3.4],[-9.5,21.1,3.4],[-14,21.1,3.4],[-18.5,21.1,3.4],    // TH4 (északnyugat)
  [27.3,-17.8,2.8],[30.6,-14.6,2.8],[33.9,-11.3,2.8],                          // híd TH2<->TH1
  [32.3,-3.8,2.8],[27.6,0.5,2.8],[22.8,4.8,2.8],                               // híd TH1<->A-kilátó
  [-28.8,-10.2,2.8],[-26.6,-2.4,2.8],[-24.4,5.5,2.8],[-22.2,13.4,2.8]          // híd TH3<->TH4 (hosszú nyugati átkelő)
];
function zoneFree(x,z,pad){ if(inCaveFoot(x,z,(pad||0)+0.8)) return false; for(const c of KEEP_CLEAR){ if(Math.hypot(x-c[0],z-c[1]) < c[2]+(pad||0)) return false; } return true; }

// --- KÖZÉPSŐ LANDMARKOK ütközői (a buildLandmarks() vizuáljaihoz illesztve) ---
solidCyl(11.55, 7.90, 1.5);                 // oldWell kőperem
solidCyl(-7.3, 8.2, 1.0);                   // cairnShrine alap
solidBox(-16.3, 7.65, 5.0, 1.1, {mob:true});            // fallenTree fekvő törzs (kb. 11 hosszú, forgatva ~vízszintes) — trollok se menjenek át rajta
solidCyl(-15.9, -15.2, 1.3);                // brokenPillars #1 oszlop-csokor
solidCyl(3.7, -19.6, 1.3);                  // brokenPillars #2

// --- FA-LIGETEK a tisztás peremén (klaszteres, természetes csoportok) ---
const GROVES = [ [0.4,46],[1.25,48],[2.05,44],[3.0,49],[3.85,45],[4.7,47],[5.5,44],[6.0,48],
  [0.8,30],[1.9,27],[2.9,31],[4.0,28],[5.2,30],[6.1,27] ];   // külső perem-ligetek + középmező-szigetek
for(const gr of GROVES){ const ca=gr[0], cr=gr[1];
  const cx=Math.cos(ca)*cr, cz=Math.sin(ca)*cr; const n=2+((Math.random()*3)|0);
  for(let k=0;k<n;k++){ let tries=0,tx,tz; do{ const aa=ca+rand(-0.18,0.18), rr=cr+rand(-3.5,3.0); tx=Math.cos(aa)*rr; tz=Math.sin(aa)*rr; }
      while((!zoneFree(tx,tz,1.0) || Math.hypot(tx,tz)>BOUND_R-1.5 || Math.hypot(tx,tz)<10) && ++tries<8);
    if(tries<8){ tree(tx,tz, rand(0.9,1.7)); KEEP_CLEAR.push([tx,tz,1.6]); } }
}
// --- SŰRŰ HATÁR-FASOR a perem mentén (vizuális zártság, fenn ütköző) ---
for(let i=0;i<40;i++){ const a=(i/40)*6.283+rand(-0.06,0.06), r=BOUND_R+rand(0.5,2.2);
  if(inCaveFoot(Math.cos(a)*r, Math.sin(a)*r, 1.0)) continue;   // a barlangtömbbe nem nő fa
  tree(Math.cos(a)*r, Math.sin(a)*r, rand(1.1,1.9)); }
// néhány nagy fa a fal mögött (sziluett, ütköző nem szükséges – peremen kívül)
for(let i=0;i<26;i++){ const a=rand(0,6.28), r=rand(BOUND_R+8, 100); if(inCaveFoot(Math.cos(a)*r, Math.sin(a)*r, 2.0)) continue; tree(Math.cos(a)*r, Math.sin(a)*r, rand(1.0,1.8)); }

// --- KŐ-KIBÚVÁSOK / sziklacsoportok a tisztáson belül (klaszteres) ---
const OUTCROPS = [ [0.9,15],[2.4,17],[3.5,12],[4.2,18],[5.1,14],[5.9,16],
  [0.5,36],[1.6,40],[2.7,35],[3.8,42],[4.9,38],[5.7,34] ];   // + külső sziklacsoportok
for(const oc of OUTCROPS){ const ca=oc[0], cr=oc[1];
  const n=2+((Math.random()*2)|0);
  for(let k=0;k<n;k++){ let tries=0,rx,rz; const rr0=rand(0.7,1.7); do{ const aa=ca+rand(-0.22,0.22), rr=cr+rand(-2.5,2.5); rx=Math.cos(aa)*rr; rz=Math.sin(aa)*rr; }
      while((!zoneFree(rx,rz,rr0+0.6) || Math.hypot(rx,rz)>BOUND_R-1.2 || Math.hypot(rx,rz)<8) && ++tries<8);
    if(tries<8){ rock(rx,rz, rr0); KEEP_CLEAR.push([rx,rz,rr0+0.9]); } }
}
// szórt kis kövek a peremen kívül (díszlet, ütköző peremen kívül – ártalmatlan)
for(let i=0;i<24;i++){ const a=rand(0,6.28), r=rand(BOUND_R+8, 115); if(inCaveFoot(Math.cos(a)*r, Math.sin(a)*r, 0.5)) continue; rock(Math.cos(a)*r, Math.sin(a)*r, rand(0.6,1.8)); }
// fű-foltok az arénában
const grassMat=std({color:0x47803f,roughness:1});
