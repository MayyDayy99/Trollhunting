/* ============================================================================
   5) NYÍL A TESTBEN — beleáll és ott is marad, amíg a test el nem tűnik
   ========================================================================== */
const _v = new T3.Vector3(), _q = new T3.Quaternion(), _m = new T3.Matrix4();
function stickArrow(troll, worldPos, worldDir, el) {
  const cands = [
    { o: troll.head, y: (2.50 + troll.genome.neckLen) * troll.scale },
    { o: troll.torsoIn || troll.torso, y: 1.5 * troll.scale },
    { o: troll.arms.L, y: 1.9 * troll.scale }, { o: troll.arms.R, y: 1.9 * troll.scale },
    { o: troll.elbows && troll.elbows.L }, { o: troll.elbows && troll.elbows.R },
    { o: troll.legs.L, y: .8 * troll.scale }, { o: troll.legs.R, y: .8 * troll.scale },
    { o: troll.knees && troll.knees.L }, { o: troll.knees && troll.knees.R },
  ].filter(c => c.o);
  let best = cands[1], bd = 1e9;
  for (const c of cands) {
    c.o.getWorldPosition(_v);
    const d = _v.distanceToSquared(worldPos);
    if (d < bd) { bd = d; best = c; }
  }
  const arr = makeStubArrow(el);
  best.o.add(arr);
  arr.position.copy(best.o.worldToLocal(worldPos.clone()));
  /* a vessző a becsapódás irányával SZEMBE áll ki a testből */
  const wq = best.o.getWorldQuaternion(new T3.Quaternion()).invert();
  const localDir = worldDir.clone().normalize().negate().applyQuaternion(wq).normalize();
  arr.quaternion.setFromUnitVectors(new T3.Vector3(0, 1, 0), localDir);
  const ws = new T3.Vector3(); best.o.getWorldScale(ws);
  arr.scale.setScalar(1 / (ws.x || 1));
  troll.stuckArrows.push(arr);
  return arr;
}

