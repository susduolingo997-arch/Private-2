// tune.js <levelIdx0> <groupId> <shelfId|-> <moveId> vx...  : search target placement maximizing ground-move solutions
const S=require('../sim.js');const [i,grp,shelf,mv]=process.argv.slice(2);const vxs=process.argv.slice(6).map(Number);
const res=[];
for(const vx of vxs)for(let bx=-300;bx<=100;bx+=20)for(let by=-40;by<=120;by+=20){
 const l=JSON.parse(JSON.stringify(S.LEVELS[+i])); l.bodies[0].vx=vx;
 l.segs.forEach(s=>{if(s.group===grp||s.id===shelf){s.x1+=bx;s.x2+=bx;s.y1+=by;s.y2+=by;}});
 l.zones.forEach(z=>{if(z.group===grp){z.x+=bx;z.y+=by;}});
 if(S.run(l,[]).win) continue; let n=0,ex=[];
 for(let dx=-20;dx<=680;dx+=10) if(S.run(l,[{id:mv,dx,dy:0}]).win){n++;ex.push(dx);}
 res.push([n,vx,bx,by,ex.join(',')]);}
res.sort((a,b)=>b[0]-a[0]);console.log(res.slice(0,3).map(r=>r.join(' | ')).join('\n'));
