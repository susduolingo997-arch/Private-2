# ⏪ Undo

You can't act — you can only **rewind time and change one small thing**.

Each level is a 10-second moment in a kitchen that goes wrong. Watch it, rewind (VHS-style), drag a glowing object or tap a fan, then play the moment again. The physics are deterministic, so the same changes always produce the same result.

**Play:** open `index.html` in any browser (no install, no build). Works on phones (drag with a finger) and desktops (Space = play/rewind).

- 10 levels in Kitchen World with cutting boards, sponges, jelly plates, fans, a cat and a door
- Stars: 3 for fixing it in par changes or fewer
- Daily Moment with a shareable emoji result card
- Progress saved in the browser

**Files:** `sim.js` (physics + levels), `game.js` (rendering/input), `test/check.js` (verifies every level fails untouched and has a solution: `node undo/test/check.js`).
