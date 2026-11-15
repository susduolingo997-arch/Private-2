const S = require('../sim.js');
const i = +process.argv[2], edits = JSON.parse(process.argv[3] || '[]');
const lv = S.LEVELS[i], r = S.run(lv, edits);
const ids = r.world.bodies.map(b => b.id);
for (let t = 0; t <= 600; t += 30) console.log(String(t).padStart(3), r.frames[t].map((f, k) => `${ids[k]}(${f[0].toFixed(0)},${f[1].toFixed(0)}${f[3] ? ' X' : ''})`).join(' '));
console.log(r.events.filter(e => e.type === 'break'), r.results);
