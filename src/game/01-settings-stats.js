/* ===================== TURBÓ: új feliratok (HU/EN) + mentett beállítások + futam-statisztika ===================== */
I18N.hu.ui={ runHint:'FUT', tabSet:'Beállítások', dash:'KITÉRÉS', dashKey:'KITÉRÉS · Q', combo:'sorozat', best:'rekord {n}', boss:'TROLL KIRÁLY',
  bossWave:'HULLÁM {n} — ☠ A TROLL KIRÁLY!', bossDown:'☠ A KIRÁLY ELESETT! +{n}', slam:'FÖLDRENGÉS — UGORJ!', perfect:'TÖKÉLETES!', flawless:'SÉRTETLEN HULLÁM +{n}',
  over:'TÚLTÖLTÉS {n}', inv:'SÉRTHETETLEN {n}', next:'következő hullám: {n}', streaks:['DUPLA','TRIPLA','ÖLDÖKLÉS','MEGÁLLÍTHATATLAN','LEGENDA'],
  setSens:'Egér-érzékenység', setFov:'Látószög', setVol:'Hangerő', setInv:'Fordított Y', setNums:'Sebzés-számok', setShake:'Képrázkódás',
  setHint:'A beállítások a böngészőben megmaradnak. A kontroller csatlakoztatva automatikusan működik.',
  statKills:'leterített troll', statHead:'fejlövés', statAcc:'pontosság', statCombo:'legjobb sorozat', statTime:'túlélt idő', statReact:'elemi reakció',
  newRec:'ÚJ REKORD!', bestLine:'Rekord: <b>{score}</b> pont · <b>{wave}</b>. hullám', mobDash:'KITÉR', vihar2:'VIHAR-TÚLTÖLTÉS!',
  extraKeys:'<div class="mrow desktopctl"><span class="kbd">Q</span> kitérés (rövid sérthetetlenség)</div><div class="mrow desktopctl"><span class="kbd">Jobb gomb</span>/<span class="kbd">F</span> közelharc</div><div class="mrow desktopctl"><span class="kbd">Görgő</span> elem-váltás</div><div class="mrow desktopctl"><span class="kbd">Tab</span> radar-jelmagyarázat</div>',
  tipPerfect:'<b>Tökéletes lövés:</b> engedd el abban a pillanatban, amikor a célkereszt-gyűrű <b>aranyra</b> vált — +30% sebzés. <b>Sorozat:</b> a gyors egymás utáni ölések pont-szorzót építenek.' };
I18N.en.ui={ runHint:'RUN', tabSet:'Settings', dash:'DASH', dashKey:'DASH · Q', combo:'streak', best:'best {n}', boss:'TROLL KING',
  bossWave:'WAVE {n} — ☠ THE TROLL KING!', bossDown:'☠ THE KING HAS FALLEN! +{n}', slam:'GROUND SLAM — JUMP!', perfect:'PERFECT!', flawless:'FLAWLESS WAVE +{n}',
  over:'OVERCHARGE {n}', inv:'INVULNERABLE {n}', next:'next wave: {n}', streaks:['DOUBLE','TRIPLE','RAMPAGE','UNSTOPPABLE','LEGENDARY'],
  setSens:'Mouse sensitivity', setFov:'Field of view', setVol:'Volume', setInv:'Invert Y', setNums:'Damage numbers', setShake:'Screen shake',
  setHint:'Settings are saved in your browser. A connected gamepad works automatically.',
  statKills:'trolls slain', statHead:'headshots', statAcc:'accuracy', statCombo:'best streak', statTime:'time survived', statReact:'reactions',
  newRec:'NEW RECORD!', bestLine:'Best: <b>{score}</b> pts · wave <b>{wave}</b>', mobDash:'DASH', vihar2:'STORM OVERCHARGE!',
  extraKeys:'<div class="mrow desktopctl"><span class="kbd">Q</span> dash (brief invulnerability)</div><div class="mrow desktopctl"><span class="kbd">Right click</span>/<span class="kbd">F</span> melee</div><div class="mrow desktopctl"><span class="kbd">Wheel</span> switch element</div><div class="mrow desktopctl"><span class="kbd">Tab</span> radar legend</div>',
  tipPerfect:'<b>Perfect shot:</b> release the instant the crosshair ring turns <b>gold</b> — +30% damage. <b>Streak:</b> quick consecutive kills build a score multiplier.' };
I18N.hu.combat={
  bow:'ÍJAK', equipped:'KÉZBEN', equip:'FELSZEREL', owned:'MEGVÉVE', rank:'MESTERSZINT {n}',
  mastery:'Elemi ébredés', masteryEff:'Teljes húzáskor varázslat. A rangok összeadódnak: I varázslat + elemi jel, II + második réteg és reakció-robbantás, III + kataklizma (negyed / fél pálya). Sima nyíllal: I nyílkoszorú, II + nyíleső, III + nyílvihar. Rangok: H5 / H10 / H15.',
  ready:'VARÁZSLAT KÉSZ — TELJES HÚZÁS', cooldown:'VARÁZSLAT {n} mp',
  spell:{fire:'LÁNGÁRADAT',ice:'JÉGFAL',poison:'MÉREGÖRVÉNY',lightning:'ÉGI ÍTÉLET'},
  phase:'TROLL KIRÁLY · {n}. FÁZIS', charge:'ROHAM — TÉRJ KI OLDALRA!',
  rocks:'KŐZÁPOR — HAGYD EL A JELÖLÉST!', roots:'TÖVISKERT — KERESS SZABAD UTAT!',
  exposed:'KIFÁRADT — ÍJSEBZÉS +50%', slam:'LÖKÉSHULLÁM — UGORJ VAGY TÉRJ KI!',
  hint:'Single-player: a Kovácsműhelyben új íjakat és Elemi ébredést vehetsz. Teljes húzáskor a kész varázslat automatikusan elsül; töltődés közben normál nyilat lősz.',
  bows:{starter:['Vadászíj','Kiegyensúlyozott kezdőfegyver.'],
    bone:['Csontív','+35% sebzés, +15% húzás, −10% töltés. Alapnyíl: +1 átütés.'],
    moss:['Élő ág','+20% sebzés, +45% húzás, −28% töltés. +1 szórt nyíl; elemi varázslat −1 mp.'],
    rune:['Rúnaíj','+65% sebzés, +5% húzás, +5% töltés. Varázslat +35% sebzés és −1,5 mp.']}
};
I18N.en.combat={
  bow:'BOWS', equipped:'EQUIPPED', equip:'EQUIP', owned:'OWNED', rank:'MASTERY {n}',
  mastery:'Elemental Awakening', masteryEff:'Full draw casts a spell. Ranks stack: I spell + elemental mark, II + a second layer that detonates reactions, III + cataclysm (a quarter / half of the map). Base arrows: I arrow halo, II + arrow rain, III + arrow storm. Ranks: W5 / W10 / W15.',
  ready:'SPELL READY — FULL DRAW', cooldown:'SPELL {n}s',
  spell:{fire:'FLAME SURGE',ice:'ICE WALL',poison:'VENOM VORTEX',lightning:'SKY JUDGMENT'},
  phase:'TROLL KING · PHASE {n}', charge:'CHARGE — DODGE SIDEWAYS!',
  rocks:'ROCKFALL — LEAVE THE MARKERS!', roots:'THORN GARDEN — FIND AN OPEN PATH!',
  exposed:'EXHAUSTED — BOW DAMAGE +50%', slam:'SHOCKWAVE — JUMP OR DASH!',
  hint:'Single-player: buy bows and Elemental Awakening in the Forge. A full draw automatically casts your ready spell; normal arrows fire while it recharges.',
  bows:{starter:['Hunting Bow','A balanced starting weapon.'],
    bone:['Bone Recurve','+35% damage, +15% draw, −10% reload. Base arrows pierce +1 target.'],
    moss:['Living Bough','+20% damage, +45% draw, −28% reload. +1 spread arrow; spell cooldown −1s.'],
    rune:['Runebow','+65% damage, +5% draw, +5% reload. Spells deal +35% damage and recharge 1.5s faster.']}
};
function loadJSON(k){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):null; }catch(_e){ return null; } }
function saveJSON(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(_e){} }
const SET_KEY='mr_settings', BEST_KEY='mr_best';
const SET=Object.assign({ sens:1, fov:(MOBILE_INPUT?80:72), vol:45, invY:false, dmgNums:true, shake:true }, loadJSON(SET_KEY)||{});   // telefonon tágabb alap-látószög
SET.sens=Math.max(0.3,Math.min(2.5,+SET.sens||1)); SET.fov=Math.max(60,Math.min(100,+SET.fov||72)); SET.vol=Math.max(0,Math.min(100,(SET.vol==null?45:+SET.vol)));
const BEST=Object.assign({ score:0, wave:0 }, loadJSON(BEST_KEY)||{});
const STATS={ kills:0, heads:0, shots:0, hits:0, bestCombo:0, time:0, reacts:0 };
document.documentElement.lang=lang;

/* SOLIDS ütközés-konstansok — KORÁN deklarálva: a tree()/rock()/buildLandmarks() már
   regisztrál ütközőt, ezért ezeknek a const-oknak előbb kell léteznie (TDZ-elkerülés). */
const SOLIDS   = [];
const PLAYER_R = 0.42;   // játékos vízszintes sugara
const STEP     = 0.55;   // max automatikus fellépés-magasság
const BOUND_R  = ARENA_R - 1.5; // 32.5 — a látható peremen belül tartja a játékost

const scene = new THREE.Scene();
/* LÁTVÁNY-TURBÓ: a köd/horizont színe EGY forrásból jön (HORIZON_SRGB), hogy a távoli tárgyak pontosan az ég aljába
   olvadjanak. r128-ban a köd a tone-map + kódolás UTÁN keveredik, ezért composer-módban (lineáris target) lineárisra,
   közvetlen renderben sRGB-ben kell megadni -> applyGraphics() állítja (syncFogColor). */
const HORIZON_SRGB = 0x1c3150;
const HORIZON_LIN  = new THREE.Color(HORIZON_SRGB).convertSRGBToLinear();
scene.background = new THREE.Color(0x05080f);
scene.fog = new THREE.Fog(HORIZON_SRGB, 38, 150);
function syncFogColor(){ scene.fog.color.setHex(HORIZON_SRGB); if(bloomOn && bloomAvail) scene.fog.color.convertSRGBToLinear(); }
// az ég-shader uniformjai KORÁN deklarálva (az applyGraphics már induláskor írja az uQ-t -> TDZ-elkerülés)
const MOON_DIR = new THREE.Vector3(-60,46,-110).normalize();
const SKY_U = { uTime:{value:0}, uMoon:{value:MOON_DIR.clone()}, uHorizon:{value:HORIZON_LIN.clone()}, uQ:{value:1}, uStorm:{value:0}, uStormCol:{value:new THREE.Color(0xffffff)} };
let skyGroup = null;
let grassIM = null;   // fű-InstancedMesh (a grafikai fokozat a .count-ot állítja)
let _treeCastRef=null;   // a fa-árnyékvetők listája (a modell-készlet tölti fel) — ALACSONY fokozaton a fák nem vetnek árnyékot
function syncTreeShadows(){ if(_treeCastRef) for(const m of _treeCastRef) m.castShadow=(gfxTier!=='low'); }
function syncGrassCount(){ if(grassIM) grassIM.count=Math.round(grassIM.userData.full*({low:0.4,medium:0.7,high:1}[gfxTier]||1)); }

const camera = new THREE.PerspectiveCamera(72, innerWidth/innerHeight, 0.05, 400);
camera.layers.enable(2);   // NOBLOOM_LAYER (lentebb deklarálva)
const renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:'high-performance'});   // két-GPU-s gépen kérjük az erősebbet (ahol a böngésző engedi)
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE_INPUT ? 1 : 1.5)); // FPS: mobilon se renderelj túl nagy DPR-en
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // olcsóbb mint a PCFSoft
renderer.shadowMap.autoUpdate = false;   // TELJESÍTMÉNY: az árnyéktérképet mi frissítjük (renderFrame), nem minden render()-hívás
renderer.outputEncoding = THREE.sRGBEncoding;
/* LÁTVÁNY-TURBÓ: saját tone-görbe MINDEN anyagra, MINDEN grafikai fokozaton (nulla extra pass):
   ACES + kontraszt-gamma + enyhe szaturáció. Az r128 a hex-színeket lineárisként értelmezi, ezért a paletta
   "kimosott" volt (szürkés-kék fátyol) — ez a görbe adja vissza a mély árnyékokat és a telt zöldeket. */
THREE.ShaderChunk.tonemapping_pars_fragment = THREE.ShaderChunk.tonemapping_pars_fragment.replace(
  'vec3 CustomToneMapping( vec3 color ) { return color; }',
  'vec3 CustomToneMapping( vec3 color ) { vec3 c = ACESFilmicToneMapping( color ); float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); c = mix( vec3( l ), c, 1.22 ); c = pow( max( c, vec3( 0.0 ) ), vec3( 1.32 ) ) * 1.16; return c; }');
renderer.toneMapping = THREE.CustomToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.appendChild(renderer.domElement);

