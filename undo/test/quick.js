// quick single-change scan for one level
const S=require('../sim.js'); const i=+process.argv[2]; const lv=S.LEVELS[i];
console.log('base',S.run(lv,[]).results);
