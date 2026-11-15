// Undo — deterministic simulation + levels. Shared by the game and the Node test.
(function (root) {
  'use strict';
  const G = 900, DT = 1 / 60, SUB = 4, TICKS = 600; // 10 seconds
  const KINDS = {
    ball:   { r: 14, m: 1,   e: 0.5,  frag: 0 },
    orange: { r: 13, m: 1,   e: 0.4,  frag: 0 },
    vase:   { r: 16, m: 1.2, e: 0.2,  frag: 380 },
    egg:    { r: 11, m: 0.6, e: 0.2,  frag: 300 },
    mug:    { r: 13, m: 1,   e: 0.2,  frag: 420 },
    cat:    { r: 18, m: 5,   e: 0.0,  frag: 0, speed: 70 },
  };
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // ---- level-building helpers ----
  const seg = (id, x1, y1, x2, y2, o) => Object.assign({ id, x1, y1, x2, y2, mat: 'wood' }, o || {});
  const body = (id, kind, x, y, o) => Object.assign({ id, kind, x, y }, o || {});
  function bowl(id, x, y, w, o) { // y = bottom of bowl
    const h = 36, g = (o && o.movable) ? { group: id, movable: true } : { group: id };
    return {
      segs: [
        seg(id + 'L', x - w / 2 - 14, y - h, x - w / 2, y, Object.assign({ mat: 'bowl' }, g)),
        seg(id + 'B', x - w / 2, y, x + w / 2, y, Object.assign({ mat: 'bowl' }, g)),
        seg(id + 'R', x + w / 2, y, x + w / 2 + 14, y - h, Object.assign({ mat: 'bowl' }, g)),
      ],
      zone: Object.assign({ id, x: x - w / 2 - 14, y: y - h - 20, w: w + 28, h: h + 24, label: 'bowl' }, g),
    };
  }
  const room = () => [
    seg('floor', -20, 430, 820, 430, { mat: 'floor' }),
    seg('wallL', 0, -400, 0, 430, { mat: 'wall' }),
    seg('wallR', 800, -400, 800, 430, { mat: 'wall' }),
  ];
  function L(def) {
    const segs = room().concat(def.segs || []), zones = (def.zones || []).slice();
    (def.bowls || []).forEach((b) => { segs.push(...b.segs); zones.push(b.zone); });
    return Object.assign({ fans: [], bodies: [] }, def, { segs, zones });
  }

  // ---- levels (all solutions verified by test/run in Node) ----
  const LEVELS = [
    L({
      name: 'Morning Roll', par: 1,
      story: 'The ball rolls off the counter and smashes Grandma\'s vase. Rewind and move the cutting board to stop it.',
      segs: [seg('counter', 0, 250, 400, 250, { mat: 'counter' }),
             seg('board', 700, 430, 700, 380, { movable: true, mat: 'board' })],
      bodies: [body('b', 'ball', 40, 230, { vx: 160 }), body('v', 'vase', 500, 410)],
      goals: [{ t: 'intact', id: 'v' }],
    }),
    L({
      name: 'Fan Club', par: 1,
      story: 'The orange was meant for the fruit bowl. Someone left the fan on.',
      segs: [seg('shelf', 0, 200, 300, 220, { mat: 'counter' })],
      fans: [{ id: 'fan', x: 300, y: 220, w: 300, h: 210, fx: 260, fy: 0, on: true, toggle: true }],
      bowls: [bowl('bowl', 390, 428, 70)],
      bodies: [body('o', 'orange', 30, 180, { vx: 90 })],
      goals: [{ t: 'in', id: 'o', zone: 'bowl' }],
      solution: [{ id: 'fan', toggle: true }],
    }),
    L({
      name: 'Great Escape', par: 1,
      story: 'Mittens is heading straight for the open door. Put something in the way.',
      segs: [seg('board', 120, 330, 120, 290, { movable: true, mat: 'board' }),
             seg('shelf', 60, 330, 240, 330, { mat: 'counter' })],
      zones: [{ id: 'door', x: 720, y: 300, w: 80, h: 130, label: 'door', trap: true }],
      bodies: [body('c', 'cat', 260, 410, { dir: 1 })],
      goals: [{ t: 'out', id: 'c', zone: 'door' }],
      solution: [{ id: 'board', dx: 480, dy: 90 }],
    }),
    L({
      name: 'Soft Landing', par: 1,
      story: 'A ball knocks the egg off the shelf. Breakfast is ruined... unless something soft is waiting below.',
      segs: [seg('shelf', 0, 200, 420, 200, { mat: 'counter' }),
             seg('sponge', 60, 430, 160, 430, { movable: true, mat: 'sponge' })],
      bodies: [body('b', 'ball', 30, 180, { vx: 220 }), body('e', 'egg', 300, 186)],
      goals: [{ t: 'intact', id: 'e' }],
      solution: null, // found by search in test
    }),
    L({
      name: 'Jelly Jump', par: 1,
      story: 'The ball needs to get into the high bowl. The wobbly jelly plate might help.',
      segs: [seg('shelf', 0, 160, 220, 160, { mat: 'counter' }),
             seg('jelly', 60, 425, 160, 425, { movable: true, mat: 'jelly' }),
             seg('high', 430, 300, 620, 300, { mat: 'counter' })],
      bowls: [bowl('bowl', 500, 298, 70)],
      bodies: [body('b', 'ball', 30, 140, { vx: 120 })],
      goals: [{ t: 'in', id: 'b', zone: 'bowl' }],
      solution: null,
    }),
    L({
      name: 'Double Trouble', par: 2,
      story: 'Two things go wrong at once. You will need two changes.',
      segs: [seg('counter', 0, 250, 360, 250, { mat: 'counter' }),
             seg('board', 60, 250, 60, 210, { movable: true, mat: 'board' })],
      fans: [{ id: 'fan', x: 360, y: 250, w: 200, h: 180, fx: 900, fy: 0, on: true, toggle: true }],
      bowls: [bowl('bowl', 450, 428, 70)],
      zones: [{ id: 'door', x: 720, y: 300, w: 80, h: 130, label: 'door', trap: true }],
      bodies: [body('o', 'orange', 100, 230, { vx: 150 }), body('c', 'cat', 560, 410, { dir: 1 })],
      goals: [{ t: 'in', id: 'o', zone: 'bowl' }, { t: 'out', id: 'c', zone: 'door' }],
      solution: null,
    }),
    L({
      name: 'Move the Bowl', par: 1,
      story: 'Sometimes it is easier to move the target than the thing.',
      segs: [seg('ramp', 0, 120, 260, 220, { mat: 'counter' })],
      bowls: [bowl('bowl', 120, 428, 70, { movable: true })],
      bodies: [body('o', 'orange', 30, 100)],
      goals: [{ t: 'in', id: 'o', zone: 'bowl' }],
      solution: null,
    }),
    L({
      name: 'Cat Pinball', par: 1,
      story: 'Mittens could push the ball into the bowl, if Mittens were facing the right way.',
      segs: [seg('counter', 0, 300, 540, 300, { mat: 'counter' })],
      bowls: [bowl('bowl', 600, 428, 70)],
      bodies: [body('b', 'ball', 330, 280), body('c', 'cat', 250, 280, { dir: -1, movable: true })],
      goals: [{ t: 'in', id: 'b', zone: 'bowl' }],
      solution: null,
    }),
    L({
      name: 'Egg Express', par: 2,
      story: 'Get the egg into the bowl without cracking it.',
      segs: [seg('shelf', 0, 180, 300, 180, { mat: 'counter' }),
             seg('sponge', 690, 430, 750, 430, { movable: true, mat: 'sponge' })],
      fans: [{ id: 'fan', x: 300, y: 180, w: 300, h: 250, fx: 900, fy: 0, on: false, toggle: true }],
      bowls: [bowl('bowl', 560, 428, 70)],
      bodies: [body('e', 'egg', 30, 166, { vx: 120 })],
      goals: [{ t: 'in', id: 'e', zone: 'bowl' }, { t: 'intact', id: 'e' }],
      solution: null,
    }),
    L({
      name: 'Kitchen Chaos', par: 2,
      story: 'Final exam: orange in the bowl, vase in one piece, and Mittens stays home.',
      segs: [seg('ramp', 0, 140, 300, 240, { mat: 'counter' }),
             seg('board', 40, 430, 40, 380, { movable: true, mat: 'board' }),
             seg('jelly', 700, 425, 780, 425, { movable: true, mat: 'jelly' })],
      fans: [{ id: 'fan', x: 300, y: 240, w: 300, h: 190, fx: 600, fy: 0, on: true, toggle: true }],
      bowls: [bowl('bowl', 450, 428, 70)],
      zones: [{ id: 'door', x: 720, y: 300, w: 80, h: 130, label: 'door', trap: true }],
      bodies: [body('o', 'orange', 30, 120), body('v', 'vase', 620, 410), body('c', 'cat', 670, 410, { dir: 1 })],
      goals: [{ t: 'in', id: 'o', zone: 'bowl' }, { t: 'intact', id: 'v' }, { t: 'out', id: 'c', zone: 'door' }],
      solution: null,
    }),
  ];

  // ---- edits ----
  function movables(level) {
    const ids = [];
    const add = (id) => { if (!ids.includes(id)) ids.push(id); };
    level.segs.forEach((s) => { if (s.movable) add(s.group || s.id); });
    level.bodies.forEach((b) => { if (b.movable) add(b.id); });
    return ids;
  }
  function build(level, edits) {
    const w = { segs: clone(level.segs), bodies: clone(level.bodies), fans: clone(level.fans), zones: clone(level.zones), events: [], tick: 0 };
    for (const e of edits || []) {
      if (e.toggle) { const f = w.fans.find((f) => f.id === e.id); if (f) f.on = !f.on; continue; }
      w.segs.forEach((s) => { if (s.id === e.id || s.group === e.id) { s.x1 += e.dx; s.x2 += e.dx; s.y1 += e.dy; s.y2 += e.dy; } });
      w.zones.forEach((z) => { if (z.group === e.id) { z.x += e.dx; z.y += e.dy; } });
      w.bodies.forEach((b) => { if (b.id === e.id) { b.x += e.dx; b.y += e.dy; } });
    }
    for (const b of w.bodies) {
      Object.assign(b, KINDS[b.kind], { vx: b.vx || 0, vy: b.vy || 0, a: 0, broken: false, dir: b.dir || 1 });
    }
    return w;
  }

  function hit(w, b, imp) {
    if (b.frag && !b.broken && imp > b.frag) { b.broken = true; b.vx = b.vy = 0; w.events.push({ t: w.tick, type: 'break', id: b.id }); }
    else if (imp > 120) w.events.push({ t: w.tick, type: 'bump', id: b.id, imp });
  }
  function colSeg(w, b, s) {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1, L2 = dx * dx + dy * dy || 1;
    let t = ((b.x - s.x1) * dx + (b.y - s.y1) * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = s.x1 + dx * t, py = s.y1 + dy * t;
    let nx = b.x - px, ny = b.y - py; const d = Math.hypot(nx, ny), R = b.r + 3;
    if (d >= R || d === 0) return;
    nx /= d; ny /= d; b.x += nx * (R - d); b.y += ny * (R - d);
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      let imp = -vn, e = s.mat === 'jelly' ? 0.95 : s.mat === 'sponge' ? 0 : b.e;
      if (s.mat === 'sponge') imp *= 0.25;
      if (imp < 40 && s.mat !== 'jelly') e = 0;
      hit(w, b, imp);
      b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
      const tx = -ny, ty = nx, vt = b.vx * tx + b.vy * ty, f = s.mat === 'sponge' ? 0.3 : 0.0004;
      b.vx -= vt * f * tx; b.vy -= vt * f * ty;
    }
    if (b.kind === 'cat' && Math.abs(nx) > 0.7 && nx * b.dir < 0) b.dir = -b.dir;
  }
  function colPair(w, a, b) {
    let nx = b.x - a.x, ny = b.y - a.y; const d = Math.hypot(nx, ny), R = a.r + b.r;
    if (d >= R || d === 0) return;
    nx /= d; ny /= d; const ov = R - d, tm = a.m + b.m;
    a.x -= nx * ov * b.m / tm; a.y -= ny * ov * b.m / tm; b.x += nx * ov * a.m / tm; b.y += ny * ov * a.m / tm;
    const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (vn < 0) {
      hit(w, a, -vn); hit(w, b, -vn);
      const e = Math.min(a.e, b.e) + 0.2, j = -(1 + e) * vn / (1 / a.m + 1 / b.m);
      if (!a.broken) { a.vx -= j / a.m * nx; a.vy -= j / a.m * ny; }
      if (!b.broken) { b.vx += j / b.m * nx; b.vy += j / b.m * ny; }
    }
    if (a.kind === 'cat' && nx * a.dir > 0.7 && b.broken) a.dir = -a.dir;
    if (b.kind === 'cat' && -nx * b.dir > 0.7 && a.broken) b.dir = -b.dir;
  }
  function step(w) {
    const h = DT / SUB, live = w.bodies.filter((b) => !b.broken);
    for (let s = 0; s < SUB; s++) {
      for (const b of live) {
        if (b.broken) continue;
        if (b.kind === 'cat') b.vx = b.dir * b.speed;
        b.vy += G * h;
        for (const f of w.fans) if (f.on && b.x > f.x && b.x < f.x + f.w && b.y > f.y && b.y < f.y + f.h) { b.vx += f.fx * h / b.m; b.vy += f.fy * h / b.m; }
        b.x += b.vx * h; b.y += b.vy * h; b.a += b.vx * h / b.r;
        for (const sg of w.segs) colSeg(w, b, sg);
        for (const z of w.zones) if (z.trap && inZone(b, z)) { b.broken = true; b.caught = z.id; b.vx = b.vy = 0; w.events.push({ t: w.tick, type: 'escape', id: b.id }); }
      }
      for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
        const a = live[i], b = live[j];
        if (a.broken || b.broken) continue;
        colPair(w, a, b);
      }
    }
    w.tick++;
  }
  const snap = (w) => w.bodies.map((b) => [b.x, b.y, b.a, b.broken ? 1 : 0, b.dir]);
  function inZone(b, z) { return b.x > z.x && b.x < z.x + z.w && b.y > z.y && b.y < z.y + z.h; }
  function evaluate(w) {
    return w.goals.map((g) => {
      const b = w.bodies.find((x) => x.id === g.id), z = w.zones.find((x) => x.id === g.zone);
      if (g.t === 'intact') return !b.broken;
      if (g.t === 'out') return b.caught !== g.zone && !inZone(b, z);
      if (g.t === 'in') return !b.broken && inZone(b, z);
      return false;
    });
  }
  function run(level, edits) {
    const w = build(level, edits); w.goals = level.goals;
    const frames = [snap(w)];
    for (let t = 0; t < TICKS; t++) { step(w); frames.push(snap(w)); }
    const results = evaluate(w);
    return { frames, events: w.events, results, win: results.every(Boolean), world: w };
  }

  const API = { LEVELS, KINDS, TICKS, DT, build, run, movables };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.UndoSim = API;
})(this);
