/* ============================================================================
   1) PARAMÉTERTÉR — a "végtelen troll" alkatrész-készlete
   ========================================================================== */
const PARTS = {
  skull:  ['round', 'block', 'wedge', 'flat', 'long', 'crested'],
  brow:   ['heavy', 'plate', 'spiked', 'ridged'],
  jaw:    ['underbite', 'wide', 'lantern', 'hanging'],
  ear:    ['bat', 'stub', 'fin', 'torn', 'droop', 'none'],
  horn:   ['none', 'spike', 'ram', 'antler', 'crown', 'single', 'backswept', 'stub'],
  tusk:   ['none', 'up', 'down', 'cluster', 'broken', 'sabre'],
  crest:  ['none', 'spines', 'fin', 'plates', 'bristle', 'shroomRow'],
  growth: ['glowShroom', 'pustule', 'crystal', 'bark', 'vine', 'shelf', 'lichen'],
  gear:   ['loincloth', 'belt', 'pauldron', 'bracers', 'necklace', 'noseRing', 'armband', 'bandage', 'warpaint', 'trophy', 'backSpikes'],
  weapon: ['none', 'club', 'maul', 'daggers', 'spear', 'axe', 'staff', 'flail', 'trunk', 'boulder', 'shield'],
  wound:  ['scars', 'missingEye', 'brokenHorn', 'tornEar', 'stumpArm', 'patches', 'oldArrows'],
  skinKind: ['moha', 'mocsár', 'hamu', 'epe', 'mélyzöld', 'zúzódás', 'agyag', 'kéreg'],
};

/* bőr-fajta -> HSL tartomány (h, s, l) — ez öli meg az "egysíkú zöld"-et */
const SKIN_KIND = {
  'moha':    { h: [95, 135], s: [.26, .40], l: [.17, .25] },
  'mocsár':  { h: [40, 70],  s: [.22, .34], l: [.14, .21] },
  'hamu':    { h: [195, 230],s: [.09, .18], l: [.18, .27] },
  'epe':     { h: [62, 88],  s: [.34, .50], l: [.20, .28] },
  'mélyzöld':{ h: [150, 180],s: [.24, .38], l: [.13, .20] },
  'zúzódás': { h: [265, 305],s: [.16, .28], l: [.15, .23] },
  'agyag':   { h: [12, 30],  s: [.28, .44] , l: [.15, .23] },
  'kéreg':   { h: [25, 45],  s: [.14, .26], l: [.13, .19] },
};

/* név-generátor (magyar) — minden troll saját nevet kap, ez adja a "mind más" érzetet */
const NAME_ADJ = ['Mohás', 'Rőt', 'Vén', 'Csorba', 'Görbe', 'Kőbőrű', 'Hamvas', 'Zuzmós', 'Félszemű', 'Tüskés',
  'Bűzös', 'Nyirkos', 'Agyaras', 'Ködjáró', 'Sáros', 'Zörgő', 'Fagyos', 'Parázs', 'Villámverte', 'Mérges',
  'Púpos', 'Vasfogú', 'Sánta', 'Repedt', 'Sötét', 'Bozontos', 'Rozsdás', 'Vicsorgó', 'Suta', 'Tarajos'];
const NAME_NOUN = ['Gubó', 'Vadar', 'Bunkó', 'Csülök', 'Marok', 'Rönk', 'Görgeteg', 'Karom', 'Pofa', 'Csont',
  'Tuskó', 'Zsombék', 'Görcs', 'Rög', 'Dorong', 'Agyar', 'Kolonc', 'Szuszék', 'Bögöly', 'Kobak',
  'Mancs', 'Bendő', 'Toportyán', 'Kőmál', 'Süveg', 'Zsúp', 'Bocskor', 'Vinkó', 'Hanga', 'Torzsa'];
const BOSS_TITLE = ['a Vénhedt', 'a Mohakirály', 'a Sziklatörő', 'a Ködúr', 'az Elsőszülött', 'a Csontgyűjtő',
  'a Lápfejedelem', 'a Százsebű', 'a Gyökérrágó', 'az Éjszülte'];

