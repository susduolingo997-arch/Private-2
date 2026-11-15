const S=require('../sim.js');
const [i,fx]=[+process.argv[2],+process.argv[3]]; const lv=S.LEVELS[i]; lv.fans[0].fx=fx;
const r=S.run(lv,JSON.parse(process.argv[4]||'[]')); const f=r.frames[600];
console.log(fx, r.results, f.map(p=>p.slice(0,2).map(Math.round).join(',')+(p[3]?'X':'')).join(' '));
