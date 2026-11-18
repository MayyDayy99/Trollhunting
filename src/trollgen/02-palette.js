/* ============================================================================
   ELEM-PALETTA — a design system tokens/elements.css-éből
   Ha a token-lap be van linkelve, futásidőben ONNAN olvassuk (--el-<e>-*,
   --status-<e>); a literálok a token-lap SAJÁT értékei, hogy a modul a
   játékban (CSS nélkül) is pontosan ugyanazt adja.
   Slot-jelentés a token-lap fejlécéből:
     core=nyílhegy-emissive · mid=test/láng/folyadék · glow=külső halo
     spark=szikra · deep=korom/árnyék · light=PointLight · status=troll-tint
   ========================================================================== */
function dsHex(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (v && v.charAt(0) === '#') return parseInt(v.slice(1), 16);
  } catch (_e) {}
  return fallback;
}
function elToken(e, core, mid, glow, spark, deep, light, status, label) {
  return {
    core:   dsHex('--el-' + e + '-core',  core),
    mid:    dsHex('--el-' + e + '-mid',   mid),
    glow:   dsHex('--el-' + e + '-glow',  glow),
    spark:  dsHex('--el-' + e + '-spark', spark),
    deep:   dsHex('--el-' + e + '-deep',  deep),
    light:  dsHex('--el-' + e + '-light', light),
    status: dsHex('--status-' + e,        status),
    emInt: .30, label,
  };
}
const EL = {
  fire:      elToken('fire',      0xff5a2a, 0xff9a3d, 0xffc24d, 0xfff1c4, 0x2a1c14, 0xff7a3d, 0xff6a2a, 'TŰZ'),
  ice:       elToken('ice',       0x6fd8ff, 0xa9e8ff, 0xe2f6ff, 0xffffff, 0x2a6fd0, 0x7fd0ff, 0xbfe6ff, 'JÉG'),
  poison:    elToken('poison',    0x7e9a2e, 0x9fdc4a, 0xc8e26a, 0xd8ee8a, 0x4d6b1e, 0x9fdc4a, 0x9fd24a, 'MÉREG'),
  lightning: elToken('lightning', 0xb48cff, 0xa8c8ff, 0xffffff, 0xd8e6ff, 0x5a3fb0, 0xb48cff, 0xc8b4ff, 'VILLÁM'),
};
/* visszafelé kompatibilis aliasok (a régi mezőnevek a build-ben) */
Object.keys(EL).forEach(k => { const E = EL[k];
  E.emissive = E.core; E.eye = E.glow; E.aura = E.light; E.crust = E.deep; E.skin = E.status; });

