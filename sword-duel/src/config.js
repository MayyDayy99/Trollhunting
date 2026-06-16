// ============================================================================
// config.js — minden hangolható konstans egy helyen. Nincs logika.
// Egységek: a kéz-keypointok NORMALIZÁLT [-1..1] térben vannak (tükrözve),
// a kard/ütközés értékek VILÁG-egységben (a normalizált koord * view.halfW/halfH).
// A függőleges világ-félmagasság (WY) fix; a vízszintes a képarányból jön.
// ============================================================================

export const CFG = Object.freeze({
  // --- Kamera felvétel ---
  CAM_W: 640,
  CAM_H: 480,

  // --- Világ / nézet ---
  WY: 4.5,              // világ-félmagasság (16:9-nél halfW ≈ 8)
  FLOOR_Y: -4.2,        // padló sík a blob-árnyékhoz (világ y)
  SWORD_Z_OFFSET: 0.06, // P1/P2 pengéje kicsit más z-n, hogy ne z-fightoljon (csak vizuál)

  // --- Kard ---
  BLADE_LEN: 3.0,       // penge hossza világ-egységben (~2/3 WY, nagy kijelzőn olvasható)
  DIR_EPS: 0.12,        // ha |fingerTip - wrist| < ennyi (világ), megtartjuk az előző irányt
  TRAIL_LEN: 16,        // nyomvonal pontok száma

  // --- Ütközés ---
  HURT_R: 1.2,          // sebezhető gömb sugara a kéz körül (világ)
  HIT_SPEED: 5.0,       // ennél gyorsabb hegysebesség kell egy találathoz (világ/mp)
  CLASH_R: 1.0,         // ennél közelebbi HEGYEK = pengeváltás (blokk) — hegy-hegy, nem teljes penge
  CLASH_LOCKOUT: 0.15,  // pengeváltás utáni rövid zár (mp), nincs találat

  // --- Sebzés ---
  MAX_HP: 100,
  DMG_BASE: 18,         // sebzés-skála
  REF_SPEED: 16,        // erős suhintás referencia-sebessége (világ/mp)
  MIN_DMG: 6,
  MAX_DMG: 30,
  INVULN: 0.6,          // védő sérthetetlensége találat után (mp)
  ATTACK_COOLDOWN: 0.25,// támadó újratölt egy találat után (mp)
  DRAW_ALLOWED: false,  // ha false: döntetlennél sudden death

  // --- Simítás (One-Euro szűrő) — a #1 probléma (jitter) ellen ---
  ONE_EURO: { freq: 30, minCutoff: 1.0, beta: 0.007, dCutoff: 1.0 },

  // --- Kéz → játékos hozzárendelés ---
  MATCH_RADIUS: 0.6,    // normalizált: ennél messzebb lévő kezet nem rendelünk a sloghoz
  GRACE_FRAMES: 15,     // ennyi frame-ig "lebeg" az utolsó pozíción, ha elveszett (~0.5s @30fps)

  // --- Állapotgép időzítések ---
  CALIB_FRAMES: 18,     // ennyi frame-en át kell látszania mindkét kéznek a starthoz (~0.6s)
  COUNTDOWN_SEC: 3,
  MATCH_SEC: 120,       // 2 perc / meccs
  FREEZE_SEC: 0.8,      // KO freeze-frame / slow-mo hossza
  VICTORY_SEC: 3,
  NO_HANDS_TIMEOUT: 30, // ennyi mp kéz nélkül -> vissza WAITING (attract mode)

  // --- Színek (mindenhol konzisztens: HUD, kard, nyom, szikra) ---
  P1_COLOR: 0x36c5ff,   // cián — bal oldali játékos
  P2_COLOR: 0xff7a3d,   // narancs — jobb oldali játékos
  BG_TOP: 0x141f36,
  BG_BOTTOM: 0x0a1120,
});

// Játékos azonosítók
export const P1 = 'p1';
export const P2 = 'p2';

// Állapotok
export const STATE = Object.freeze({
  START: 'START',         // belépő képernyő (kamera/audio feloldás)
  WAITING: 'WAITING',     // mindkét kézre várunk / kalibráció
  COUNTDOWN: 'COUNTDOWN',
  FIGHTING: 'FIGHTING',
  ROUND_OVER: 'ROUND_OVER',
  VICTORY: 'VICTORY',
});
