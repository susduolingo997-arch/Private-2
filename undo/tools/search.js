// Shared search engine: parallel evaluation of edit lists over a level (worker_threads).
const { Worker, isMainThread, parentPort } = require('worker_threads');
const os = require('os');
const path = require('path');
const S = require('../sim.js');

if (!isMainThread) {
  parentPort.on('message', ({ id, level, jobs }) => {
    parentPort.postMessage({ id, out: jobs.map((e) => { const r = S.fastRun(level, e); return [r.win ? 1 : 0, r.results.map(Number)]; }) });
  });
  return;
}

const N = Math.max(1, os.cpus().length);
let pool = null, seq = 0;
const pending = new Map();
function ensure() {
  if (pool) return;
  pool = Array.from({ length: N }, () => {
    const w = new Worker(__filename);
    w.on('message', ({ id, out }) => { const p = pending.get(id); pending.delete(id); p(out); });

    return w;
  });
}
// Evaluate many edit lists in parallel; returns [{win, results}] in order.
async function evalAll(level, editLists) {
  if (editLists.length < 40) return editLists.map((e) => S.fastRun(level, e));
  ensure();
  const chunk = Math.ceil(editLists.length / N), parts = [];
  for (let k = 0; k < N; k++) {
    const jobs = editLists.slice(k * chunk, (k + 1) * chunk); if (!jobs.length) continue;
    const id = ++seq; parts.push(new Promise((res) => { pending.set(id, res); pool[k].postMessage({ id, level, jobs }); }));
  }
  return (await Promise.all(parts)).flat().map(([w, r]) => ({ win: !!w, results: r.map(Boolean) }));
}
function close() { if (pool) pool.forEach((w) => w.terminate()); pool = null; }

// All single changes for a level on a grid of `step` px.
function singles(level, step) {
  const out = [];
  for (const f of level.fans) if (f.toggle) out.push([{ id: f.id, toggle: true }]);
  for (const sg of level.segs) if (sg.toggle) out.push([{ id: sg.id, toggle: true }]);
  for (const id of S.movables(level)) {
    const w = S.build(level, []);
    const pts = w.segs.filter((s) => s.id === id || s.group === id).flatMap((s) => [[s.x1, s.y1], [s.x2, s.y2]])
      .concat(w.bodies.filter((b) => b.id === id).map((b) => [b.x, b.y]))
      .concat(w.zones.filter((z) => z.id === id && !z.group).map((z) => [z.x, z.y]));
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
    for (let dx = Math.ceil((10 - minx) / step) * step; dx <= 790 - maxx; dx += step)
      for (let dy = Math.ceil((20 - miny) / step) * step; dy <= 430 - maxy; dy += step)
        if (dx || dy) out.push([{ id, dx, dy }]);
  }
  return out;
}

// Full analysis: how many changes are needed, how many winning solutions, a natural hint.
async function analyse(level, step = 10, cap = 60) {
  const base = S.fastRun(level, []);
  const cands = singles(level, step);
  const res = await evalAll(level, cands);
  const wins1 = cands.filter((_, i) => res[i].win);
  let wins2 = [];
  if (!wins1.length && level.par >= 2) {
    const toggles = cands.filter((c) => c[0].toggle), moves = cands.filter((c) => !c[0].toggle);
    let pairs = [];
    for (const t of toggles) for (const m of moves) pairs.push(t.concat(m));
    for (let a = 0; a < toggles.length; a++) for (let b = a + 1; b < toggles.length; b++) pairs.push(toggles[a].concat(toggles[b]));
    // move+move: only changes that fix part of the goal by themselves
    const useful = cands.map((c, i) => [c, res[i]]).filter(([c, r]) => !c[0].toggle && r.results.some((v, k) => v && !base.results[k]));
    const byId = {}; useful.forEach(([c]) => (byId[c[0].id] = byId[c[0].id] || []).push(c));
    const ids = Object.keys(byId);
    for (const k of ids) { const L = byId[k], st = Math.max(1, Math.floor(L.length / 60)); byId[k] = L.filter((_, j) => j % st === 0); }
    for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) for (const x of byId[ids[a]]) for (const y of byId[ids[b]]) pairs.push(x.concat(y));
    if (pairs.length > 6000) { const st = Math.ceil(pairs.length / 6000); pairs = pairs.filter((_, j) => j % st === 0); }
    const r2 = await evalAll(level, pairs);
    wins2 = pairs.filter((_, i) => r2[i].win).slice(0, 400);
  }
  const all = wins1.length ? wins1 : wins2;
  const need = wins1.length ? 1 : wins2.length ? 2 : 0;
  return { baseWin: base.win, need, count: all.length, sols: all, hint: pickHint(all) };
}
// Prefer hints that rest on the floor / need no vertical shift, then the middle of the range.
function pickHint(sols) {
  if (!sols.length) return null;
  const score = (c) => c.reduce((s, e) => s + (e.toggle ? 0 : Math.abs(e.dy) < 1 ? 0 : 1), 0);
  const best = Math.min(...sols.map(score));
  const pool = sols.filter((c) => score(c) === best);
  return pool[Math.floor(pool.length / 2)];
}
module.exports = { evalAll, analyse, singles, close, pickHint, N };
