# ⏪ Undo

You can't act — you can only **rewind time and change one small thing**.

Each level is a 10-second moment in a kitchen that goes wrong. Watch it, rewind (VHS-style), drag a glowing object or tap a fan, then play the moment again. The physics are deterministic, so the same changes always produce the same result.

**Play:** open `index.html` in any browser (no install, no build). Works on phones (drag with a finger) and desktops (Space = play/rewind).

- 10 levels in Kitchen World with cutting boards, sponges, jelly plates, fans, a cat and a door
- Stars: 3 for fixing it in par changes or fewer
- Daily Moment with a shareable emoji result card
- Progress saved in the browser

**Worlds:** 🍳 Kitchen (15) · 🏙️ City (10) · 🚀 Space Station (10) · 🏭 Factory (10)

## Making levels fast: Forge

Write a level once as a *template* with a few tunable numbers, and Forge finds the best version automatically.

```js
// levels/factory.src.js
{ name: 'Gate Keeper', par: 1, story: '...',
  grid: { belt: [70, 100, 130], gx: [300, 360, 420] },   // values to try
  make: (p, H) => ({ segs: [H.seg('gate', p.gx, 300, ...)], ... }) }
```

```
node undo/tools/forge.js undo/levels/factory.src.js      # all levels (~1 min)
node undo/tools/forge.js undo/levels/factory.src.js 5 8  # just levels 5 and 8
```

For every combination it checks that the level goes wrong untouched, needs exactly `par` changes,
and keeps the setting with the most winning placements. It then picks a natural hint
(preferring spots on the floor), verifies it in the full simulator and writes `levels/<world>.js`.
New worlds: add a `.src.js`, run Forge, add one `<script>` tag in `index.html`.

`node undo/test/check.js` audits all levels in parallel on every CPU core (~2 min for 45 levels).

**Files:** `sim.js` (physics + hand-made levels), `levels/*.src.js` (Forge templates) → `levels/*.js` (generated), `game.js` (rendering/input), `tools/search.js` (parallel solver), `tools/forge.js`, `test/check.js`.
