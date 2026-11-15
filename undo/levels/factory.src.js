// Factory world — level TEMPLATES. Run:  node tools/forge.js levels/factory.src.js
// Each level lists `grid` (candidate values for tunable numbers) and `make(p, H)`.
// Forge picks the settings that make the level fair and forgiving, then writes levels/factory.js.
//
// Factory mechanics: gates (tap to close/open), lifts (moving platforms that fling things),
// presses (crush anything fragile), conveyors and magnets, forkbots, bulbs, crates, widgets.
const press = (x, w) => ({ id: 'press', x, y: 360, w, h: 75, label: 'press', crush: true });
const recycler = (x) => ({ id: 'recycler', x, y: 300, w: 80, h: 130, label: 'recycler', trap: true });
const chute = (H, x, y, w, o) => { const b = H.bowl('chute', x, y, w, o); b.segs.forEach((s) => { s.mat = 'chute'; }); b.zone.label = 'chute'; return b; };

module.exports = {
  world: 'factory',
  levels: [
    {
      name: 'Gate Keeper', par: 1,
      story: 'The conveyor is carrying a light bulb straight into the press. Tap the gate to close it.',
      grid: { belt: [70, 100, 130], gx: [300, 360, 420] },
      make: (p, H) => ({
        segs: [H.seg('belt', 60, 300, 520, 300, { mat: 'conveyor', belt: p.belt }),
               H.seg('stop', 60, 300, 60, 260, { mat: 'metal' }),
               H.seg('gate', p.gx, 300, p.gx, 250, { mat: 'gate', gate: true, off: true, toggle: true })],
        zones: [press(500, 140)],
        bodies: [H.body('b', 'bulb', 150, 287)],
        goals: [{ t: 'intact', id: 'b' }],
      }),
    },
    {
      name: 'Forklift Frenzy', par: 1,
      story: 'The forkbot is driving straight into the recycler. Drag a steel panel into its path.',
      grid: { start: [200, 300], px: [40, 100] },
      make: (p, H) => ({
        segs: [H.seg('panel', p.px, 430, p.px, 370, { movable: true, mat: 'panel' })],
        zones: [recycler(720)],
        bodies: [H.body('f', 'forkbot', p.start, 410, { dir: 1 })],
        goals: [{ t: 'out', id: 'f', zone: 'recycler' }],
      }),
    },
    {
      name: 'Bulb Drop', par: 1,
      story: 'A bulb rolls out of the hopper and smashes on the factory floor. Catch it with foam.',
      grid: { vx: [80, 140, 200], hy: [160, 220] },
      make: (p, H) => ({
        segs: [H.seg('hopper', 0, p.hy, 280, p.hy + 30, { mat: 'metal' }),
               H.seg('foam', 660, 430, 760, 430, { movable: true, mat: 'foam' })],
        bodies: [H.body('b', 'bulb', 30, p.hy - 14, { vx: p.vx })],
        goals: [{ t: 'intact', id: 'b' }],
      }),
    },
    {
      name: 'Magnet Sorter', par: 1,
      story: 'Widgets should drop into the sorting chute, but they ride right past it. Switch on the magnet.',
      grid: { mx: [380, 440, 500], pull: [900, 1400], my: [360, 400] },
      make: (p, H) => ({
        segs: [H.seg('belt', 0, 250, 300, 250, { mat: 'conveyor', belt: 140 })],
        fans: [{ id: 'mag', type: 'magnet', x: p.mx, y: p.my, r: 220, pull: p.pull, on: false, toggle: true }],
        bowls: [chute(H, p.mx, 428, 90)],
        bodies: [H.body('w', 'widget', 40, 236)],
        goals: [{ t: 'in', id: 'w', zone: 'chute' }],
      }),
    },
    {
      name: 'Catapult Lift', par: 1,
      story: 'The bobbing lift can fling a widget up into the high chute — if it is in the right place.',
      grid: { amp: [-80, -120], period: [1.2, 1.6], cy: [250, 300] },
      make: (p, H) => ({
        segs: [H.seg('ledge', 0, 160, 200, 160, { mat: 'metal' }),
               H.seg('lift', 640, 425, 740, 425, { movable: true, mat: 'lift', lift: { dy: p.amp, period: p.period } }),
               H.seg('high', 480, p.cy, 800, p.cy, { mat: 'metal' })],
        bowls: [chute(H, 620, p.cy - 2, 90)],
        bodies: [H.body('w', 'widget', 30, 146, { vx: 110 })],
        goals: [{ t: 'in', id: 'w', zone: 'chute' }],
      }),
    },
    {
      name: 'Shift Change', par: 2,
      story: 'The belt runs backwards AND the gate is shut. Two taps to get the crate into the chute.',
      grid: { belt: [-90, -130], cx: [600, 660] },
      make: (p, H) => ({
        segs: [H.seg('belt', 60, 280, 480, 280, { mat: 'conveyor', belt: p.belt, toggle: true }),
               H.seg('stop', 60, 280, 60, 240, { mat: 'metal' }),
               H.seg('gate', 400, 280, 400, 230, { mat: 'gate', gate: true, off: false, toggle: true })],
        bowls: [chute(H, p.cx, 428, 110)],
        bodies: [H.body('c', 'crate', 250, 264)],
        goals: [{ t: 'in', id: 'c', zone: 'chute' }],
      }),
    },
    {
      name: 'Pushy Forkbot', par: 1,
      story: 'The forkbot shoves a bulb off the mezzanine into the press below.',
      grid: { start: [60, 120], bx: [380, 420] },
      make: (p, H) => ({
        segs: [H.seg('mezz', 0, 260, 470, 260, { mat: 'metal' }),
               H.seg('panel', 740, 430, 740, 370, { movable: true, mat: 'panel' })],
        zones: [press(470, 160)],
        bodies: [H.body('f', 'forkbot', p.start, 240, { dir: 1 }), H.body('b', 'bulb', p.bx, 247)],
        goals: [{ t: 'intact', id: 'b' }],
      }),
    },
    {
      name: 'Delivery Bot', par: 1,
      story: 'The forkbot could push the crate into the chute — if it were facing the other way.',
      grid: { cx: [620, 680], crate: [420, 480, 520], gap: [60, 100] },
      make: (p, H) => ({
        segs: [H.seg('mezz', 0, 300, p.cx - 60, 300, { mat: 'metal' })],
        bowls: [chute(H, p.cx, 428, 90)],
        bodies: [H.body('c', 'crate', p.crate, 283), H.body('f', 'forkbot', p.crate - p.gap, 280, { dir: -1, movable: true })],
        goals: [{ t: 'in', id: 'c', zone: 'chute' }],
      }),
    },
    {
      name: 'Quality Control', par: 2,
      story: 'The bulb rides into the press AND the forkbot heads for the recycler. Two changes.',
      grid: { belt: [80, 120], gx: [320, 380] },
      make: (p, H) => ({
        segs: [H.seg('belt', 60, 240, 480, 240, { mat: 'conveyor', belt: p.belt }),
               H.seg('stop', 60, 240, 60, 200, { mat: 'metal' }),
               H.seg('gate', p.gx, 240, p.gx, 190, { mat: 'gate', gate: true, off: true, toggle: true }),
               H.seg('panel', 30, 430, 30, 370, { movable: true, mat: 'panel' })],
        zones: [press(460, 140), recycler(720)],
        bodies: [H.body('b', 'bulb', 140, 227), H.body('f', 'forkbot', 600, 410, { dir: 1 })],
        goals: [{ t: 'intact', id: 'b' }, { t: 'out', id: 'f', zone: 'recycler' }],
      }),
    },
    {
      name: 'Factory Finale', par: 2,
      story: 'Final shift: the widget must reach the chute AND the bulb must survive.',
      grid: { mx: [440, 500], belt: [120, 160] },
      make: (p, H) => ({
        segs: [H.seg('belt', 0, 220, 300, 220, { mat: 'conveyor', belt: p.belt }),
               H.seg('foam', 680, 430, 780, 430, { movable: true, mat: 'foam' }),
               H.seg('shelf', 560, 150, 800, 150, { mat: 'metal' })],
        fans: [{ id: 'mag', type: 'magnet', x: p.mx, y: 380, r: 220, pull: 1200, on: false, toggle: true }],
        bowls: [chute(H, p.mx, 428, 90)],
        bodies: [H.body('w', 'widget', 40, 206), H.body('b', 'bulb', 790, 136, { vx: -120 })],
        goals: [{ t: 'in', id: 'w', zone: 'chute' }, { t: 'intact', id: 'b' }],
      }),
    },
  ],
};
