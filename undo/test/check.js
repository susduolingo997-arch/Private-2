// Verifies each level: unchanged run must fail, and a solution within par must exist.
const S = require('../sim.js');
const STEP = +process.env.STEP || 20;
function candidates(level) {
  const out = [];
  for (const f of level.fans) if (f.toggle) out.push([{ id: f.id, toggle: true }]);
  for (const id of S.movables(level)) {
    const w = S.build(level, []);
    const pts = w.segs.filter(s => s.id === id || s.group === id).flatMap(s => [[s.x1, s.y1], [s.x2, s.y2]])
      .concat(w.bodies.filter(b => b.id === id).map(b => [b.x, b.y]));
    const minx = Math.min(...pts.map(p => p[0])), maxx = Math.max(...pts.map(p => p[0]));
    const miny = Math.min(...pts.map(p => p[1])), maxy = Math.max(...pts.map(p => p[1]));
    for (let dx = -minx + 10; dx <= 790 - maxx; dx += STEP)
      for (let dy = -miny + 20; dy <= 430 - maxy; dy += STEP) {
        const rdx = Math.round(dx / 10) * 10, rdy = Math.round(dy / 10) * 10;
        if (rdx || rdy) out.push([{ id, dx: rdx, dy: rdy }]);
      }
  }
  return out;
}
let ok = true;
S.LEVELS.forEach((lv, i) => {
  const base = S.run(lv, []);
  const single = candidates(lv);
  let sols = single.filter(c => S.run(lv, c).win);
  let pairs = [];
  if (lv.par >= 2 && !sols.length) {
    const nt = single.filter(c => c[0].toggle).length || single.length;
    for (let a = 0; a < nt && pairs.length < 5; a++)
      for (let b = a + 1; b < single.length && pairs.length < 5; b++) {
        if (single[a][0].id === single[b][0].id) continue;
        const c = single[a].concat(single[b]);
        if (S.run(lv, c).win) pairs.push(c);
      }
  }
  const hintOk = S.run(lv, lv.hint).win && lv.hint.length <= lv.par;
  if (!hintOk) { ok = false; console.log('   HINT FAILS'); }
  const solvable = lv.par === 1 ? sols.length > 0 : (sols.length === 0 && pairs.length > 0) || sols.length > 0;
  const good = !base.win && solvable;
  if (!good) ok = false;
  console.log(`${i + 1}. ${lv.name.padEnd(15)} base=${base.win ? 'WIN(bad)' : 'fail'} [${base.results}] 1-change sols=${sols.length}/${single.length} pairs=${pairs.length} ${good ? 'OK' : 'BAD'}`);
  const ex = sols[Math.floor(sols.length / 2)] || pairs[0];
  if (ex) console.log('   e.g.', JSON.stringify(ex));
});
process.exit(ok ? 0 : 1);
