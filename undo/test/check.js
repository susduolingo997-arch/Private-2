// Verifies every level (built-in + generated packs) using the parallel search engine:
// fails untouched, needs exactly par changes, forgiving (>= MIN solutions unless it's a pure switch),
// and its hint wins in the full simulator.
const fs = require('fs'), path = require('path');
const S = require('../sim.js'), T = require('../tools/search.js');
const dir = path.join(__dirname, '../levels');
fs.readdirSync(dir).filter((f) => f.endsWith('.js') && !f.endsWith('.src.js')).sort().forEach((f) => S.addLevels(require(path.join(dir, f))));
const MIN = +process.env.MIN || 10, only = process.argv[2] ? process.argv[2].split(',').map(Number) : null;
(async () => {
  let ok = true; const t0 = Date.now();
  for (const [i, lv] of S.LEVELS.entries()) {
    if (only && !only.includes(i + 1)) continue;
    const a = await T.analyse(lv, 10), probs = [];
    const allToggle = a.sols.length && a.sols.every((c) => c.every((e) => e.toggle));
    if (a.baseWin) probs.push('wins with no changes');
    if (!a.need) probs.push('unsolvable');
    else if (a.need !== lv.par) probs.push(`par ${lv.par} but needs ${a.need}`);
    if (a.count < MIN && !allToggle) probs.push(`too fussy (${a.count})`);
    if (!lv.hint || !S.run(lv, lv.hint).win || lv.hint.length > lv.par) probs.push('hint fails');
    if (probs.length) ok = false;
    console.log(`${String(i + 1).padStart(2)}. ${lv.world.padEnd(8)} ${lv.name.padEnd(18)} needs ${a.need} · ${String(a.count).padStart(4)} solutions  ${probs.length ? 'BAD: ' + probs.join('; ') : 'OK'}`);
  }
  T.close();
  console.log(`${ok ? 'ALL GOOD' : 'PROBLEMS FOUND'} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  process.exit(ok ? 0 : 1);
})();
