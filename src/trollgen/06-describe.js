/* ============================================================================
   3) DESCRIBE — a GENOM kisorsolása (determinisztikus, szerializálható)
   ========================================================================== */
function describe(seed, opts) {
  opts = opts || {};
  const R = RNG(seed);
  const casteId = opts.caste || R.weighted([['grunt', 10], ['scout', 6], ['spitter', 4], ['brute', 3], ['shard', 3], ['shaman', 2], ['wisp', 2]]);
  const C = CASTES[casteId] || CASTES.grunt;
  const tier = opts.tier || R.weighted([['normal', 88], ['elite', 10], ['boss', 2]]);
  const TI = TIERS[tier];
  const el = (opts.el !== undefined) ? opts.el : R.weighted([[null, 6], ['fire', 1], ['ice', 1], ['poison', 1], ['lightning', 1]]);

  const skinKind = R.weighted(C.skin);
  const SK = SKIN_KIND[skinKind];
  const h = R.range(SK.h[0], SK.h[1]), s = R.range(SK.s[0], SK.s[1]), l = R.range(SK.l[0], SK.l[1]);

  const gearPool = PARTS.gear.filter(g => !(C.wraith && (g === 'loincloth' || g === 'pauldron')));
  const growthPool = PARTS.growth.slice();

  const g = {
    seed, caste: casteId, casteName: C.name, tier, el,
    name: R.pick(NAME_ADJ) + ' ' + R.pick(NAME_NOUN) + (tier === 'boss' ? ', ' + R.pick(BOSS_TITLE) : ''),

    /* --- arányok --- */
    scale:     R.range(C.scale[0], C.scale[1]) * TI.sizeMul,
    torsoW:    R.range(C.torsoW[0], C.torsoW[1]),
    shoulderW: R.range(C.shoulderW[0], C.shoulderW[1]),
    neckLen:   R.range(C.neckLen[0], C.neckLen[1]),
    lean:      R.range(C.lean[0], C.lean[1]),
    headScale: R.range(C.headScale[0], C.headScale[1]),
    legThick:  R.range(C.legThick[0], C.legThick[1]),
    armThick:  R.range(C.armThick[0], C.armThick[1]),
    armLen:    R.range(C.armLen[0], C.armLen[1]),
    bellySag:  R.range(-.06, .12),
    asym:      R.range(-.09, .09),          // bal/jobb aszimmetria — semmi sem tükörkép
    hunch:     R.range(0, .16),

    /* --- bőr --- */
    skinKind,
    skin:      hsl(h, s, l),
    skinDeep:  hsl(h + R.range(-14, 6), s * 1.15, l * .55),
    skinPale:  hsl(h + R.range(-24, 10), s * .5, Math.min(.82, l * 2.05)),
    mottle:    [hsl(h + 12, s * .8, l * 1.25), hsl(h - 18, s * .9, l * .8), hsl(h + 30, s * .5, l * 1.1), 0xffffff],
    eyeColor:  C.eyeColor,
    eyeCount:  R.weighted([[2, 74], [3, 12], [4, 8], [1, 6]]),
    eyeSize:   R.range(.055, .095),
    pupil:     R.weighted([['slit', 5], ['round', 3], ['none', 2]]),

    /* --- fej --- */
    skull: R.pick(PARTS.skull),
    brow:  R.pick(PARTS.brow),
    jawKind: R.pick(PARTS.jaw),
    ear:   R.weighted(C.ear), earLen: R.range(.22, .95),
    horn:  R.weighted(C.horn), hornLen: R.range(.75, 1.5),
    tusk:  R.weighted(C.tusk), tuskLen: R.range(.7, 1.9),
    crest: R.weighted(C.crest),
    snout: R.range(.85, 1.35),

    /* --- növedékek / moha --- */
    moss: R.range(C.moss[0], C.moss[1]),
    growths: (function () {
      const n = R.int(C.growthN[0], C.growthN[1]);
      const list = R.some(growthPool, n);
      if (C.alwaysGrowth && list.indexOf(C.alwaysGrowth) < 0) list.push(C.alwaysGrowth);
      return list;
    })(),

    /* --- felszerelés / fegyver --- */
    gear: R.some(gearPool, R.int(C.gearN[0], C.gearN[1]) + TI.extra),
    weapon: R.weighted(C.weapon),
    weaponWear: R.range(0, 1),

    /* --- sérülés / kor --- */
    wounds: R.chance(C.woundP + (tier === 'boss' ? .4 : tier === 'elite' ? .2 : 0))
      ? R.some(PARTS.wound, R.int(1, tier === 'normal' ? 2 : 3)) : [],
    age: R.range(0, 1),
  };

  /* kaszt-kényszerek, hogy a gameplay-olvashatóság megmaradjon */
  if (C.rocky)  g.rocky = true;
  if (C.toad)   g.toad = true;
  if (C.mystic) g.mystic = true;
  if (C.wraith) { g.wraith = true; g.moss = 0; g.weapon = g.weapon === 'staff' ? 'staff' : 'none'; }
  if (casteId === 'shaman') g.weapon = 'staff';
  if (casteId === 'spitter') g.weapon = 'none';
  g.atk = R.weighted(ATK_POOL(g));   // T\u00c1MAD\u00c1S-ST\u00cdLUS: a fegyverb\u0151l \u00e9s a kasztb\u00f3l, seed-stabilan
  return g;
}

