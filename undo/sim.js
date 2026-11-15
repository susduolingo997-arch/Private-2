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
    pot:    { r: 15, m: 1.2, e: 0.2,  frag: 360 },
    soccer: { r: 14, m: 1,   e: 0.55, frag: 0 },
    robot:  { r: 18, m: 6,   e: 0.0,  frag: 0, speed: 80 },
    orb:    { r: 13, m: 1,   e: 0.5,  frag: 0 },
    crystal:{ r: 12, m: 0.8, e: 0.2,  frag: 330 },
    rover:  { r: 18, m: 6,   e: 0.0,  frag: 0, speed: 75 },
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
    const segs = (def.segs || []).concat(room()), zones = (def.zones || []).slice();
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
      hint: [{ id: "board", dx: -410, dy: -180 }],
      goals: [{ t: 'intact', id: 'v' }],
    }),
    L({
      name: 'Fan Club', par: 1,
      story: 'The orange was meant for the fruit bowl. Someone left the fan on.',
      segs: [seg('shelf', 0, 200, 300, 220, { mat: 'counter' })],
      fans: [{ id: 'fan', x: 300, y: 220, w: 300, h: 210, fx: 260, fy: 0, on: true, toggle: true }],
      bowls: [bowl('bowl', 390, 428, 70)],
      bodies: [body('o', 'orange', 30, 180, { vx: 90 })],
      hint: [{ id: "fan", toggle: true }],
      goals: [{ t: 'in', id: 'o', zone: 'bowl' }],
    }),
    L({
      name: 'Great Escape', par: 1,
      story: 'Mittens is heading straight for the open door. Put something in the way.',
      segs: [seg('board', 120, 330, 120, 290, { movable: true, mat: 'board' }),
             seg('shelf', 60, 330, 240, 330, { mat: 'counter' })],
      zones: [{ id: 'door', x: 720, y: 300, w: 80, h: 130, label: 'door', trap: true }],
      bodies: [body('c', 'cat', 260, 410, { dir: 1 })],
      hint: [{ id: "board", dx: 390, dy: 70 }],
      goals: [{ t: 'out', id: 'c', zone: 'door' }],
    }),
    L({
      name: 'Soft Landing', par: 1,
      story: 'A ball knocks the egg off the shelf. Breakfast is ruined... unless something soft is waiting below.',
      segs: [seg('shelf', 0, 200, 420, 200, { mat: 'counter' }),
             seg('sponge', 60, 430, 160, 430, { movable: true, mat: 'sponge' })],
      bodies: [body('b', 'ball', 30, 180, { vx: 220 }), body('e', 'egg', 300, 186)],
      hint: [{ id: "sponge", dx: 420, dy: 0 }],
      goals: [{ t: 'intact', id: 'e' }],
    }),
    L({
      name: 'Jelly Jump', par: 1,
      story: 'The ball needs to get into the high bowl. The wobbly jelly plate might help.',
      segs: [seg('shelf', 0, 160, 220, 160, { mat: 'counter' }),
             seg('jelly', 60, 425, 160, 425, { movable: true, mat: 'jelly' }),
             seg('high', 350, 300, 540, 300, { mat: 'counter' })],
      bowls: [bowl('bowl', 420, 298, 70)],
      bodies: [body('b', 'ball', 30, 140, { vx: 120 })],
      hint: [{ id: "jelly", dx: 200, dy: 0 }],
      goals: [{ t: 'in', id: 'b', zone: 'bowl' }],
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
      hint: [{ id: "fan", toggle: true }, { id: "board", dx: 510, dy: 150 }],
      goals: [{ t: 'in', id: 'o', zone: 'bowl' }, { t: 'out', id: 'c', zone: 'door' }],
    }),
    L({
      name: 'Move the Bowl', par: 1,
      story: 'Sometimes it is easier to move the target than the thing.',
      segs: [seg('ramp', 0, 120, 260, 220, { mat: 'counter' })],
      bowls: [bowl('bowl', 120, 428, 70, { movable: true })],
      bodies: [body('o', 'orange', 30, 100)],
      hint: [{ id: "bowl", dx: 200, dy: -110 }],
      goals: [{ t: 'in', id: 'o', zone: 'bowl' }],
    }),
    L({
      name: 'Cat Pinball', par: 1,
      story: 'Mittens could push the ball into the bowl, if Mittens were facing the right way.',
      segs: [seg('counter', 0, 300, 540, 300, { mat: 'counter' })],
      bowls: [bowl('bowl', 600, 428, 70)],
      bodies: [body('b', 'ball', 330, 280), body('c', 'cat', 250, 280, { dir: -1, movable: true })],
      hint: [{ id: "c", dx: -200, dy: 0 }],
      goals: [{ t: 'in', id: 'b', zone: 'bowl' }],
    }),
    L({
      name: 'Egg Express', par: 2,
      story: 'Get the egg into the bowl without cracking it.',
      segs: [seg('shelf', 0, 180, 300, 180, { mat: 'counter' }),
             seg('sponge', 690, 430, 750, 430, { movable: true, mat: 'sponge' })],
      fans: [{ id: 'fan', x: 300, y: 180, w: 300, h: 250, fx: 500, fy: 0, on: false, toggle: true }],
      bowls: [bowl('bowl', 520, 428, 70)],
      bodies: [body('e', 'egg', 30, 166, { vx: 120 })],
      hint: [{ id: "fan", toggle: true }, { id: "sponge", dx: -210, dy: -20 }],
      goals: [{ t: 'in', id: 'e', zone: 'bowl' }, { t: 'intact', id: 'e' }],
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
      hint: [{ id: "fan", toggle: true }, { id: "board", dx: 650, dy: -40 }],
      goals: [{ t: 'in', id: 'o', zone: 'bowl' }, { t: 'intact', id: 'v' }, { t: 'out', id: 'c', zone: 'door' }],
    }),
  ];
  LEVELS.forEach((l) => { l.world = 'kitchen'; });

  const CITY = [
    L({
      name: 'Window Box', par: 1,
      story: 'A stray football knocks the flower pot off the balcony. Something soft on the pavement would help.',
      segs: [seg('ledge', 0, 190, 380, 190, { mat: 'ledge' }),
             seg('trash', 640, 430, 740, 430, { movable: true, mat: 'trash' })],
      bodies: [body('b', 'soccer', 30, 170, { vx: 230 }), body('p', 'pot', 300, 175)],
      hint: [{ id: "trash", dx: -220, dy: 0 }],
      goals: [{ t: 'intact', id: 'p' }],
    }),
    L({
      name: 'Open Manhole', par: 1,
      story: 'The delivery robot is rolling straight towards an open manhole. Put a plank in its way.',
      segs: [seg('plank', 60, 300, 60, 250, { movable: true, mat: 'plank' }),
             seg('ledge', 0, 300, 200, 300, { mat: 'ledge' })],
      zones: [{ id: 'hole', x: 560, y: 395, w: 70, h: 40, label: 'manhole', trap: true }],
      bodies: [body('r', 'robot', 230, 410, { dir: 1 })],
      hint: [{ id: "plank", dx: 300, dy: 130 }],
      goals: [{ t: 'out', id: 'r', zone: 'hole' }],
    }),
    L({
      name: 'Updraft', par: 1,
      story: 'The football should land in the bin on the balcony. The subway vent is switched off.',
      segs: [seg('ledge', 0, 200, 240, 200, { mat: 'ledge' }),
             seg('balcony', 430, 250, 640, 250, { mat: 'ledge' })],
      fans: [{ id: 'vent', x: 240, y: 0, w: 140, h: 430, fx: 0, fy: -1300, on: false, toggle: true }],
      bowls: [bowl('bin', 520, 248, 70)],
      bodies: [body('b', 'soccer', 30, 180, { vx: 120 })],
      hint: [{ id: "vent", toggle: true }],
      goals: [{ t: 'in', id: 'b', zone: 'bin' }],
    }),
    L({
      name: 'Awning Assist', par: 1,
      story: 'Bounce the football off the café awning and into the rooftop bin.',
      segs: [seg('ledge', 0, 150, 200, 150, { mat: 'ledge' }),
             seg('awning', 60, 425, 160, 425, { movable: true, mat: 'awning' }),
             seg('roof', 320, 280, 520, 280, { mat: 'ledge' })],
      bowls: [bowl('bin', 400, 278, 70)],
      bodies: [body('b', 'soccer', 30, 130, { vx: 110 })],
      hint: [{ id: "awning", dx: 170, dy: 0 }],
      goals: [{ t: 'in', id: 'b', zone: 'bin' }],
    }),
    L({
      name: 'Rush Hour', par: 2,
      story: 'A gust is blowing the flower pot off the ledge AND the robot is heading for the manhole.',
      segs: [seg('ledge', 0, 220, 330, 220, { mat: 'ledge' }),
             seg('plank', 40, 430, 40, 380, { movable: true, mat: 'plank' })],
      fans: [{ id: 'gust', x: 0, y: 120, w: 420, h: 110, fx: 500, fy: 0, on: true, toggle: true }],
      zones: [{ id: 'hole', x: 640, y: 395, w: 70, h: 40, label: 'manhole', trap: true }],
      bodies: [body('p', 'pot', 250, 205), body('r', 'robot', 420, 410, { dir: 1 })],
      hint: [{ id: "gust", toggle: true }, { id: "plank", dx: 390, dy: -40 }],
      goals: [{ t: 'intact', id: 'p' }, { t: 'out', id: 'r', zone: 'hole' }],
    }),
  ];
  CITY.forEach((l) => { l.world = 'city'; LEVELS.push(l); });

  // ---- pack 2 (appended so saved progress keeps its level numbers) ----
  const ramp = (id, x, o) => seg(id, x, 428, x + 90, 368, Object.assign({ movable: true, mat: 'board' }, o || {}));
  const block = (id, x1, x2, top, mat) => [seg(id + 'L', x1, 430, x1, top, { mat }), seg(id + 'T', x1, top, x2, top, { mat }), seg(id + 'R', x2, top, x2, 430, { mat })];
  const KITCHEN2 = [
    L({
      name: 'Mug Shot', par: 1,
      story: 'Mittens strolls along the counter and nudges the favourite mug off the edge. Block the way.',
      segs: [seg('counter', 0, 260, 460, 260, { mat: 'counter' }),
             seg('board', 700, 430, 700, 380, { movable: true, mat: 'board' }),
             seg('sponge', 40, 430, 140, 430, { movable: true, mat: 'sponge' })],
      bodies: [body('c', 'cat', 100, 240, { dir: 1 }), body('m', 'mug', 420, 245)],
      hint: [{ id: 'board', dx: -300, dy: -170 }],
      goals: [{ t: 'intact', id: 'm' }],
    }),
    L({
      name: 'Nap Time', par: 1,
      story: 'Mittens just wants a nap, but a cutting board blocks the way to the cat bed.',
      segs: [seg('board', 470, 430, 470, 370, { movable: true, mat: 'board' })],
      zones: [{ id: 'bed', x: 620, y: 380, w: 90, h: 55, label: 'bed', trap: true, only: 'cat' }],
      bodies: [body('c', 'cat', 260, 410, { dir: 1 })],
      hint: [{ id: 'board', dx: -400, dy: -100 }],
      goals: [{ t: 'reach', id: 'c', zone: 'bed' }],
    }),
    L({
      name: 'Ramp Up', par: 1,
      story: 'The ball bounces off the kitchen island. Help it roll over the top and drop into the bowl.',
      segs: block('island', 420, 620, 368, 'counter').concat([ramp('ramp', 20)]),
      bowls: [bowl('bowl', 700, 428, 120)],
      bodies: [body('b', 'ball', 200, 410, { vx: 520 })],
      hint: [{ id: 'ramp', dx: 290, dy: 0 }],
      goals: [{ t: 'in', id: 'b', zone: 'bowl' }],
    }),
    L({
      name: 'Breezy Breakfast', par: 2,
      story: 'The fan blows the egg along the counter, and the ball is coming for it too.',
      segs: [seg('counter', 0, 250, 520, 250, { mat: 'counter' }),
             seg('board', 740, 430, 740, 380, { movable: true, mat: 'board' })],
      fans: [{ id: 'fan', x: 120, y: 150, w: 420, h: 100, fx: 260, fy: 0, on: true, toggle: true }],
      bodies: [body('b', 'ball', 30, 230, { vx: 200 }), body('e', 'egg', 300, 236)],
      hint: [{ id: 'fan', toggle: true }, { id: 'board', dx: -500, dy: -180 }],
      goals: [{ t: 'intact', id: 'e' }],
    }),
    L({
      name: 'Sleepy Chaos', par: 2,
      story: 'Grand finale: ball in the bowl AND Mittens in bed. Two changes.',
      segs: block('island', 420, 620, 368, 'counter').concat([ramp('ramp', 700, { y: 0 }),
             seg('board', 130, 430, 130, 370, { movable: true, mat: 'board' })]),
      bowls: [bowl('bowl', 700, 428, 120)],
      zones: [{ id: 'bed', x: 20, y: 380, w: 90, h: 55, label: 'bed', trap: true, only: 'cat' }],
      bodies: [body('b', 'ball', 250, 410, { vx: 520 }), body('c', 'cat', 190, 410, { dir: -1 })],
      hint: [{ id: 'ramp', dx: -380, dy: 0 }, { id: 'board', dx: 0, dy: -200 }],
      goals: [{ t: 'in', id: 'b', zone: 'bowl' }, { t: 'reach', id: 'c', zone: 'bed' }],
    }),
  ];
  const CITY2 = [
    L({
      name: 'Kick Ramp', par: 1,
      story: 'The football bounces off the newspaper kiosk. A plank ramp could get it over and into the bin.',
      segs: block('kiosk', 420, 620, 368, 'ledge').concat([ramp('plank', 20, { mat: 'plank' })]),
      bowls: [bowl('bin', 700, 428, 120)],
      bodies: [body('b', 'soccer', 200, 410, { vx: 520 })],
      hint: [{ id: 'plank', dx: 290, dy: 0 }],
      goals: [{ t: 'in', id: 'b', zone: 'bin' }],
    }),
    L({
      name: 'Robot Push', par: 1,
      story: 'The rooftop robot is about to shove a flower pot off the edge.',
      segs: [seg('ledge', 0, 260, 460, 260, { mat: 'ledge' }),
             seg('plank', 720, 430, 720, 380, { movable: true, mat: 'plank' }),
             seg('trash', 40, 430, 140, 430, { movable: true, mat: 'trash' })],
      bodies: [body('r', 'robot', 100, 240, { dir: 1 }), body('p', 'pot', 420, 245)],
      hint: [{ id: 'plank', dx: -360, dy: -130 }],
      goals: [{ t: 'intact', id: 'p' }],
    }),
    L({
      name: 'Gusty Goal', par: 1,
      story: 'The football rolls off the roof towards the bin, but a gust blows it off course.',
      segs: [seg('roof', 0, 200, 260, 200, { mat: 'ledge' })],
      fans: [{ id: 'gust', x: 260, y: 150, w: 540, h: 280, fx: 700, fy: 0, on: true, toggle: true }],
      bowls: [bowl('bin', 360, 428, 130)],
      bodies: [body('b', 'soccer', 30, 180, { vx: 120 })],
      hint: [{ id: 'gust', toggle: true }],
      goals: [{ t: 'in', id: 'b', zone: 'bin' }],
    }),
    L({
      name: 'Safe Crossing', par: 1,
      story: 'The robot is rolling left towards the manhole. Turn it around.',
      segs: [seg('plank', 760, 430, 760, 380, { movable: true, mat: 'plank' })],
      zones: [{ id: 'hole', x: 100, y: 395, w: 70, h: 40, label: 'manhole', trap: true }],
      bodies: [body('r', 'robot', 520, 410, { dir: -1 })],
      hint: [{ id: 'plank', dx: -480, dy: 0 }],
      goals: [{ t: 'out', id: 'r', zone: 'hole' }],
    }),
    L({
      name: 'Grand Central', par: 2,
      story: 'City finale: the vent must lift the ball into the bin, and the robot must not fall in.',
      segs: [seg('ledge', 0, 200, 240, 200, { mat: 'ledge' }),
             seg('balcony', 430, 250, 640, 250, { mat: 'ledge' }),
             seg('plank', 30, 430, 30, 380, { movable: true, mat: 'plank' })],
      fans: [{ id: 'vent', x: 240, y: 0, w: 140, h: 430, fx: 0, fy: -1300, on: false, toggle: true }],
      bowls: [bowl('bin', 520, 248, 70)],
      zones: [{ id: 'hole', x: 690, y: 395, w: 70, h: 40, label: 'manhole', trap: true }],
      bodies: [body('b', 'soccer', 30, 180, { vx: 120 }), body('r', 'robot', 470, 410, { dir: 1 })],
      hint: [{ id: 'vent', toggle: true }, { id: 'plank', dx: 620, dy: 0 }],
      goals: [{ t: 'in', id: 'b', zone: 'bin' }, { t: 'out', id: 'r', zone: 'hole' }],
    }),
  ];
  KITCHEN2.forEach((l) => { l.world = 'kitchen'; LEVELS.push(l); });

  // ---- Space Station: low gravity, conveyor belts, magnets, portals ----
  const dock = (id, x, y, w, o) => { const b = bowl(id, x, y, w, o); b.segs.forEach((sg) => { sg.mat = 'dock'; }); b.zone.label = 'dock'; return b; };
  const portals = (ax, ay, bx, by, o) => [
    { id: 'pin', x: ax, y: ay, portal: 'pout', label: 'portal-in' },
    Object.assign({ id: 'pout', x: bx, y: by, label: 'portal-out' }, o || {}),
  ];
  const SPACE = [
    L({
      name: 'Moonwalk', par: 1, gravity: 0.35,
      story: 'Low gravity! The orb floats right past the dock. Move the dock to where it lands.',
      segs: [seg('ledge', 0, 200, 260, 200, { mat: 'hull' })],
      bowls: [dock('dock', 380, 428, 90, { movable: true })],
      bodies: [body('o', 'orb', 30, 180, { vx: 130 })],
      hint: [{ id: 'dock', dx: 150, dy: 0 }],
      goals: [{ t: 'in', id: 'o', zone: 'dock' }],
    }),
    L({
      name: 'Wrong Way Belt', par: 1,
      story: 'The conveyor carries the crystal straight off the edge. Tap the belt to reverse it.',
      segs: [seg('belt', 120, 260, 520, 260, { mat: 'conveyor', belt: 90, toggle: true }),
             seg('wallL', 120, 260, 120, 220, { mat: 'hull' })],
      bodies: [body('c', 'crystal', 300, 246)],
      hint: [{ id: 'belt', toggle: true }],
      goals: [{ t: 'intact', id: 'c' }],
    }),
    L({
      name: 'Magnetic Pull', par: 1, gravity: 0.5,
      story: 'The orb sails over the dock. Switch on the magnet to pull it down.',
      segs: [seg('ledge', 0, 180, 220, 180, { mat: 'hull' })],
      fans: [{ id: 'mag', type: 'magnet', x: 520, y: 380, r: 300, pull: 1200, on: false, toggle: true }],
      bowls: [dock('dock', 520, 428, 90)],
      bodies: [body('o', 'orb', 30, 160, { vx: 200 })],
      hint: [{ id: 'mag', toggle: true }],
      goals: [{ t: 'in', id: 'o', zone: 'dock' }],
    }),
    L({
      name: 'Portal Hop', par: 1,
      story: 'The orb rolls into the purple portal. Drag the orange exit portal somewhere useful.',
      segs: [seg('floorL', 0, 300, 360, 300, { mat: 'hull' })],
      zones: portals(330, 286, 120, 380, { movable: true }),
      bowls: [dock('dock', 640, 428, 100)],
      bodies: [body('o', 'orb', 40, 286, { vx: 160 })],
      hint: [{ id: 'pout', dx: 500, dy: -80 }],
      goals: [{ t: 'in', id: 'o', zone: 'dock' }],
    }),
    L({
      name: 'Rover Runaway', par: 1,
      story: 'The rover is trundling towards the open airlock. Put a hull panel in its way.',
      segs: [seg('panel', 80, 430, 80, 370, { movable: true, mat: 'panel' })],
      zones: [{ id: 'airlock', x: 720, y: 300, w: 80, h: 130, label: 'airlock', trap: true }],
      bodies: [body('r', 'rover', 300, 410, { dir: 1 })],
      hint: [{ id: 'panel', dx: 560, dy: 0 }],
      goals: [{ t: 'out', id: 'r', zone: 'airlock' }],
    }),
    L({
      name: 'Belt Delivery', par: 1,
      story: 'The orb needs to reach the dock at the far end of the belt.',
      segs: [seg('belt', 60, 330, 520, 330, { mat: 'conveyor', belt: -110, toggle: true }),
             seg('stop', 60, 330, 60, 290, { mat: 'hull' })],
      bowls: [dock('dock', 620, 428, 100)],
      bodies: [body('o', 'orb', 300, 316)],
      hint: [{ id: 'belt', toggle: true }],
      goals: [{ t: 'in', id: 'o', zone: 'dock' }],
    }),
    L({
      name: 'Wormhole Rover', par: 1,
      story: 'The rover wants its charging pad on the upper deck. Use the portal.',
      segs: [seg('deck', 420, 220, 800, 220, { mat: 'hull' })],
      zones: [{ id: 'pin', x: 560, y: 410, portal: 'pout', label: 'portal-in' },
              { id: 'pout', x: 120, y: 330, label: 'portal-out', movable: true },
              { id: 'pad', x: 680, y: 150, w: 100, h: 75, label: 'pad', trap: true, only: 'rover' }],
      bodies: [body('r', 'rover', 300, 410, { dir: 1 })],
      hint: [{ id: 'pout', dx: 360, dy: -140 }],
      goals: [{ t: 'reach', id: 'r', zone: 'pad' }],
    }),
    L({
      name: 'Crystal Express', par: 2,
      story: 'Belt runs the wrong way AND the crystal will smash on landing. Two changes.',
      segs: [seg('belt', 60, 240, 460, 240, { mat: 'conveyor', belt: -100, toggle: true }),
             seg('stop', 60, 240, 60, 200, { mat: 'hull' }),
             seg('foam', 660, 430, 760, 430, { movable: true, mat: 'foam' })],
      bodies: [body('c', 'crystal', 300, 226)],
      zones: [{ id: 'bay', x: 470, y: 330, w: 330, h: 105, label: 'bay' }],
      hint: [{ id: 'belt', toggle: true }, { id: 'foam', dx: -170, dy: 0 }],
      goals: [{ t: 'intact', id: 'c' }, { t: 'in', id: 'c', zone: 'bay' }],
    }),
    L({
      name: 'Decoy Magnet', par: 1, gravity: 0.6,
      story: 'Get the orb into the dock. The magnet looks helpful... but do you even need it?',
      segs: [seg('ledge', 0, 260, 300, 260, { mat: 'hull' })],
      zones: portals(270, 246, 60, 120, { movable: true }),
      fans: [{ id: 'mag', type: 'magnet', x: 640, y: 380, r: 300, pull: 1200, on: false, toggle: true }],
      bowls: [dock('dock', 640, 428, 90)],
      bodies: [body('o', 'orb', 40, 246, { vx: 150 })],
      hint: [{ id: 'pout', dx: 540, dy: 180 }],
      goals: [{ t: 'in', id: 'o', zone: 'dock' }],
    }),
    L({
      name: 'Mission Control', par: 2, gravity: 0.5,
      story: 'Final mission: orb in the dock AND the rover stays aboard.',
      segs: [seg('belt', 60, 220, 400, 220, { mat: 'conveyor', belt: -110, toggle: true }),
             seg('stop', 60, 220, 60, 180, { mat: 'hull' }),
             seg('panel', 30, 430, 30, 370, { movable: true, mat: 'panel' })],
      bowls: [dock('dock', 520, 428, 100)],
      zones: [{ id: 'airlock', x: 720, y: 300, w: 80, h: 130, label: 'airlock', trap: true }],
      bodies: [body('o', 'orb', 250, 206), body('r', 'rover', 620, 410, { dir: 1 })],
      hint: [{ id: 'belt', toggle: true }, { id: 'panel', dx: 670, dy: 0 }],
      goals: [{ t: 'in', id: 'o', zone: 'dock' }, { t: 'out', id: 'r', zone: 'airlock' }],
    }),
  ];

  CITY2.forEach((l) => { l.world = 'city'; LEVELS.push(l); });
  SPACE.forEach((l) => { l.world = 'space'; LEVELS.push(l); });

  // ---- edits ----
  function movables(level) {
    const ids = [];
    const add = (id) => { if (!ids.includes(id)) ids.push(id); };
    level.segs.forEach((s) => { if (s.movable) add(s.group || s.id); });
    level.bodies.forEach((b) => { if (b.movable) add(b.id); });
    level.zones.forEach((z) => { if (z.movable && !z.group) add(z.id); });
    return ids;
  }
  function build(level, edits) {
    const w = { g: G * (level.gravity || 1), segs: clone(level.segs), bodies: clone(level.bodies), fans: clone(level.fans), zones: clone(level.zones), events: [], tick: 0 };
    for (const e of edits || []) {
      if (e.toggle) { const f = w.fans.find((f) => f.id === e.id); if (f) f.on = !f.on; w.segs.forEach((sg) => { if (sg.id === e.id && sg.belt) sg.belt = -sg.belt; }); continue; }
      w.segs.forEach((s) => { if (s.id === e.id || s.group === e.id) { s.x1 += e.dx; s.x2 += e.dx; s.y1 += e.dy; s.y2 += e.dy; } });
      w.zones.forEach((z) => { if (z.group === e.id || (z.movable && z.id === e.id)) { z.x += e.dx; z.y += e.dy; } });
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
      const bouncy = s.mat === 'jelly' || s.mat === 'awning', soft = s.mat === 'sponge' || s.mat === 'trash' || s.mat === 'foam';
      let imp = -vn, e = bouncy ? 0.95 : soft ? 0 : b.e;
      if (soft) imp *= 0.25;
      if (imp < 40 && !bouncy) e = 0;
      hit(w, b, imp);
      b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
      const tx = -ny, ty = nx, vt = b.vx * tx + b.vy * ty, f = soft ? 0.3 : 0.0004;
      b.vx -= vt * f * tx; b.vy -= vt * f * ty;
      if (s.belt && !b.speed) { const want = s.belt * Math.sign(s.x2 - s.x1 || 1) * (ty < 0 ? -1 : 1), cur = b.vx * tx + b.vy * ty, d = (want - cur) * 0.08; b.vx += d * tx; b.vy += d * ty; }
    }
    if (b.speed && Math.abs(nx) > 0.7 && nx * b.dir < 0) b.dir = -b.dir;
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
    if (a.speed && nx * a.dir > 0.7 && b.broken) a.dir = -a.dir;
    if (b.speed && -nx * b.dir > 0.7 && a.broken) b.dir = -b.dir;
  }
  function step(w) {
    const h = DT / SUB, live = w.bodies.filter((b) => !b.broken);
    for (let s = 0; s < SUB; s++) {
      for (const b of live) {
        if (b.broken) continue;
        if (b.speed) b.vx = b.dir * b.speed;
        b.vy += w.g * h;
        for (const f of w.fans) if (f.type === 'magnet') {
          if (!f.on) continue; const dx = f.x - b.x, dy = f.y - b.y, d = Math.hypot(dx, dy);
          if (d < f.r && d > 4) { b.vx += dx / d * f.pull * h / b.m; b.vy += dy / d * f.pull * h / b.m; }
        } else if (f.on && b.x > f.x && b.x < f.x + f.w && b.y > f.y && b.y < f.y + f.h) { b.vx += f.fx * h / b.m; b.vy += f.fy * h / b.m; }
        b.x += b.vx * h; b.y += b.vy * h; b.a += b.vx * h / b.r;
        for (const sg of w.segs) colSeg(w, b, sg);
        if (b.cool > 0) b.cool -= h;
        for (const z of w.zones) if (z.portal && !(b.cool > 0) && Math.hypot(b.x - z.x, b.y - z.y) < 22) {
          const o = w.zones.find((q) => q.id === z.portal); b.x = o.x + (o.ox || 0); b.y = o.y + (o.oy || 0); b.cool = 0.5;
          w.events.push({ t: w.tick, type: 'warp', id: b.id });
        }
        for (const z of w.zones) if (z.trap && (!z.only || z.only === b.kind) && inZone(b, z)) { b.broken = true; b.caught = z.id; b.vx = b.vy = 0; w.events.push({ t: w.tick, type: z.label === 'bed' ? 'nap' : 'escape', id: b.id, zone: z.id }); }
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
      if (g.t === 'reach') return b.caught === g.zone;
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
