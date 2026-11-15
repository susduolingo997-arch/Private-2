// Verifies every level:
//  - doing nothing fails
//  - it is solvable within par, and NOT solvable with fewer changes
//  - it is forgiving: many distinct winning placements (MIN_SOLS)
//  - the stored hint wins
// Two-change levels are searched by combining single changes that each fix part of the goal set.
const S = require('../sim.js');
const MIN_SOLS = +process.env.MIN || 10, STEP = 10;
const only = process.argv[2] ? process.argv[2].split(',').map(Number) : null;
function candidates(level) {
  const out = [];
  for (const f of level.fans) if (f.toggle) out.push([{ id: f.id, toggle: true }]);
  for (const sg of level.segs) if (sg.toggle) out.push([{ id: sg.id, toggle: true }]);
  for (const id of S.movables(level)) {
    const w = S.build(level, []);
    const pts = w.segs.filter(s => s.id === id || s.group === id).flatMap(s => [[s.x1, s.y1], [s.x2, s.y2]])
      .concat(w.bodies.filter(b => b.id === id).map(b => [b.x, b.y]))
      .concat(w.zones.filter(z => z.id === id && !z.group).map(z => [z.x, z.y]));
    const minx = Math.min(...pts.map(p => p[0])), maxx = Math.max(...pts.map(p => p[0]));
    const miny = Math.min(...pts.map(p => p[1])), maxy = Math.max(...pts.map(p => p[1]));
    for (let dx = Math.ceil((10 - minx) / 10) * 10; dx <= 790 - maxx; dx += STEP)
      for (let dy = Math.ceil((20 - miny) / 10) * 10; dy <= 430 - maxy; dy += STEP)
        if (dx || dy) out.push([{ id, dx, dy }]);
  }
  return out;
}
let ok = true;
S.LEVELS.forEach((lv, i) => {
  if (only && !only.includes(i + 1)) return;
  const base = S.run(lv, []);
  const singles = candidates(lv).map(c => { const r = S.run(lv, c); return { c, r: { win: r.win, results: r.results } }; });
  const wins1 = singles.filter(x => x.r.win).map(x => x.c);
  let wins2 = [];
  if (!wins1.length) {
    // pair up changes that each fix something, distinct objects
    const useful = singles.filter(x => x.c[0].toggle || x.r.results.some((v, k) => v && !base.results[k]));
    const byId = {}; useful.forEach(x => (byId[x.c[0].id] = byId[x.c[0].id] || []).push(x));
    const ids = Object.keys(byId);
    for (const k of ids) { const L = byId[k], st = Math.max(1, Math.floor(L.length / 50)); byId[k] = L.filter((_, j) => j % st === 0); }
    // a fan switch + any single move: test exhaustively (cheap)
    for (const t of singles.filter(x => x.c[0].toggle)) for (const m of singles) {
      if (m.c[0].toggle || wins2.length >= 60) continue;
      const c = t.c.concat(m.c); if (S.run(lv, c).win) wins2.push(c);
    }
    if (!wins2.length) outer: for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++)
      for (const x of byId[ids[a]]) for (const y of byId[ids[b]]) {
        const c = x.c.concat(y.c); if (S.run(lv, c).win) wins2.push(c);
        if (wins2.length >= 60) break outer;
      }
  }
  const all = wins1.length ? wins1 : wins2;
  const need = wins1.length ? 1 : wins2.length ? 2 : 0, sols = wins1.length || wins2.length;
  const hintOk = lv.hint && S.run(lv, lv.hint).win && lv.hint.length <= lv.par;
  const probs = [];
  if (base.win) probs.push('wins with no changes');
  if (!need) probs.push('unsolvable');
  if (need && need !== lv.par) probs.push(`par is ${lv.par} but needs ${need}`);
  if (sols < MIN_SOLS && !all.every(c => c.every(e => e.toggle))) probs.push(`too fussy (${sols} solutions)`);
  if (!hintOk) probs.push('hint fails');
  if (probs.length) ok = false;
  console.log(`${String(i + 1).padStart(2)}. ${lv.world.padEnd(7)} ${lv.name.padEnd(18)} needs ${need} · ${sols} solutions ${probs.length ? 'BAD: ' + probs.join('; ') : 'OK'}`);
  if (probs.length && all.length) console.log('    median:', JSON.stringify(all[Math.floor(all.length / 2)]));
});
process.exit(ok ? 0 : 1);
