/* ---------------------------------------------------------- kombinatorika -- */
function variantCount() {
  /* diszkrét tengelyek szorzata (a folytonos arányok/színek NÉLKÜL) */
  let n = 1;
  n *= Object.keys(CASTES).length;
  n *= PARTS.skull.length * PARTS.brow.length * PARTS.jaw.length;
  n *= PARTS.ear.length * PARTS.horn.length * PARTS.tusk.length * PARTS.crest.length;
  n *= 4;                                   // szemszám
  n *= 3;                                   // pupilla
  n *= PARTS.skinKind.length;
  n *= PARTS.weapon.length;
  n *= 3;                                   // tier
  n *= 5;                                   // elem (+ nincs)
  n *= Math.pow(2, PARTS.growth.length);    // növedék-részhalmazok
  n *= Math.pow(2, PARTS.gear.length);      // felszerelés-részhalmazok
  n *= Math.pow(2, PARTS.wound.length);     // sérülés-részhalmazok
  return n;
}

function dispose(m) {
  m.g.traverse(o => { if (o.isMesh && o.geometry) o.geometry.dispose(); if (o.isSprite && o.material) o.material.dispose(); });
  (m._mats || []).forEach(x => x && x.dispose && x.dispose());
}

global.TrollGen = {
  VERSION: '1.0',
  CASTES, TIERS, PARTS, EL, SKIN_KIND, M,
  RNG, describe, build, dispose, stickArrow, anim, variantCount, dsHex, mossify, mossRel, springStep,
  BOWS, ARROW_EL, makeBow, makeArrowMesh,
  make(seed, opts) { return build(describe(seed, opts)); },
};
