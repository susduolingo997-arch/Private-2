# Hamster Cam 🐹

A realistic, watch‑only hamster simulator. A golden Syrian hamster (modelled on the reference photos: ginger coat,
dark smudges behind the cheeks and on the back, dark ears, glossy black eyes, pink paws) lives in a giant, cozy
glass vivarium and just… gets on with its life.

Everything is procedural – no models, textures or audio files. Plain Three.js, no build step.

## Run

```bash
cd hamster-sim
python3 -m http.server 8000      # or any static file server
# open http://localhost:8000
```

Add `?q=low` for slower GPUs, `?q=high` for extra fur/bedding, `?hour=14` to start at 14:00.

## What you'll see

* **Fur** – shell‑textured strands (per‑strand colour, clumping, sheen rim light) on a rigged body with 2‑bone IK legs,
  blinking eyes, twitching ears and whiskers, a jaw that chews and yawns, and cheek pouches that really stuff up.
* **A life of its own** – needs (energy, hunger, thirst, mess, restlessness) plus the time of day drive a utility AI that
  picks between: sleeping curled up in the cabin (and a big yawn + stretch on waking), running on the wheel, eating
  sunflower seeds with both paws, stuffing cheeks and hoarding in the nest, drinking from the bottle on its hind legs,
  four kinds of grooming, exploring/sniffing/periscoping, digging, sand baths, gnawing, climbing the lookout deck and
  crawling through the cork tunnel. It paths around everything with A\*.
* **The cage** – deep paper bedding (26k instanced flakes), wooden cutaway cabin with fairy lights, wooden wheel that
  really spins with the hamster, ceramic bowl, sand tray, cork log, ramp & deck, branch, stones, fake plant, hay,
  water bottle – inside a room with a lamp, a window with a live sky, desk, books and a mug.
* **Day / night** – the clock drives sun, sky, window, lighting and crickets. The hamster is nocturnal.

## Controls

| | |
|---|---|
| Drag / scroll / right‑drag | orbit / zoom / pan |
| Double‑click the bedding (or **T**) | drop a treat – the hamster will come and stuff it into its cheeks |
| **1–7** | Front, Room, Top, Cabin, Wheel, Follow, Hamster POV |
| **N** | show the hamster's needs |
| **M** | sound on/off (synthesised: paws, nibbling, lapping, wheel, crickets) |
| Dock buttons | treats, refill bowl, wake, nap, lamp, fairy lights, time of day & clock speed |

`lib/` holds a vendored copy of three.js r170 (MIT).
