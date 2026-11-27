# IRL BUT CHEATS

A very badly funny 3D animated series. **Dave discovers that real life has a developer
console.** He is not qualified to use it.

Each episode is a ~10 minute YAML script. A small render engine in this repo turns the script
into a finished video using **headless Blender** and **GitHub Actions**: no GPU, no manual
animation, no editing software. Push a script, get an mp4.

```
episodes/s01e01_noclip.yaml          the script (dialogue, actions, cheats, UI popups)
        |
        v   python -m engine plan        Kokoro voices, exact timing, audio mix,
        |                                game-UI overlay, split into ~50 s render shards
        v   python -m engine render      Blender Workbench, one shard per CI job (parallel)
        |
        v   python -m engine assemble    ffmpeg: concat shards + overlay + audio -> mp4
```

The look is intentionally janky: low-poly people, poses held for 3 frames (8 poses per second),
random mouth flapping instead of lip sync, T-poses, and objects that clip through walls. The
game-style HUD (console, `CHEAT ACTIVATED`, achievement toasts, HP, a laggy FPS counter) is burned
in over the picture.

## Render an episode on GitHub

1. **Actions -> Render episode -> Run workflow** (pick the episode file; tick *preview* for a
   half-res draft), or push a tag such as `ep-s01e01`.
2. The `plan` job synthesises speech and works out the timing. It **fails if the episode is not
   10 minutes +/- 5 %** (`target_seconds` in the script).
3. `render` runs one job per shard in parallel (about 18 for a 10 minute episode).
4. `assemble` stitches everything. Download `episode-<id>` from the run's artifacts.

`Check episodes` runs on every push: unit tests, plus every episode must plan and hit the runtime.

## Run it locally

```bash
sudo apt-get install -y blender ffmpeg espeak-ng fonts-dejavu-core xvfb libegl1 libgl1-mesa-dri libglx-mesa0
pip install -r requirements.txt

python -m engine validate episodes/*.yaml        # fast: estimated runtime per scene
python -m engine build episodes/s01e01_noclip.yaml --preview     # everything, half-res
python -m engine build episodes/s01e01_noclip.yaml               # everything, 1280x720
# one shard / one frame, for iterating on a scene:
python -m engine plan episodes/s01e01_noclip.yaml
python -m engine render build/s01e01/plan.json s02_c00 --out build/s01e01/shards --preview --at 600 --limit 1
python -m engine render --help
```

Blender needs OpenGL even in background mode; `xvfb-run` + Mesa provide that on a server (the
CLI uses `xvfb-run` automatically when there is no `$DISPLAY`). Blender 4.0.x is what Ubuntu 24.04
and the GitHub runners ship, and what this was developed against.

## The universe (every show, one fake video site)

All shows share one world and live on one fake video site, **ViewTube**. Channel 9 can report on what Dave did,
Marigold Events can plan the paintball day, and Gerald can comment on all of it. Four channels, five videos each:

| Channel | What it is | Videos |
|---|---|---|
| **IRL BUT CHEATS** | Dave, Kyle and the Admin (this repo's 3D engine) | `episodes/s01e0N_*.yaml` |
| **Channel 9** | Evening news: Martin, Sarah, David, Emma, Kevin, Richard. E01 + E02 are the original standalone pages (`universe/embeds/`), E03-E05 are engine episodes | `episodes/n9_*.yaml` + embeds |
| **PASSIONFRUIT** | The keynote events (Pulp Phone and friends). Already published as releases in the PASSIONFRUIT repo, so the site links out (`link:`) | 5 external videos |
| **Marigold Events** | Marisol and Tobias plan events (a wedding, a gala, a stapler) | `episodes/mg_*.yaml` |

```
universe/universe.yaml     channels, shared characters, every video (+ crossover links, in-world comments)
universe/web/              the site (plain HTML/JS/CSS, no dependencies)
universe/art/              thumbnails, avatars, banners (generated, committed)
universe/embeds/           self-contained player pages (Channel 9 E01/E02)
        |  python -m engine universe art        -> Blender hero frames + Pillow styling -> universe/art/
        |  python -m engine universe build      -> site/index.html (open it; no server needed)
        |  python -m engine universe publish    -> copy rendered mp4s into site/media/, rebuild
```

* `universe check` validates the whole world (unknown channel/character, dangling `mentions`, bad episode files).
* A video is **one of**: `episode:` (engine script), `embed:` (a standalone player page, plays in an iframe) or
  `link:` (published elsewhere, e.g. a GitHub release). Engine episodes go **planned -> scripted -> live** (mp4 in `site/media/`).
* `mentions: [other-video-id]` makes crossovers show up under "In this universe" on both videos.
* **Art for everything.** `universe art` renders a Blender frame of each video's `thumb:` shot (or captures a frame of
  an embed with Playwright) and styles it per show; every character gets an avatar from the same 3D model, and every
  channel gets a logo and banner. It only re-renders what is missing (`--force`, `--only id ...`).
  Set `THREE_JS=/path/to/three.min.js` if the embeds' CDN is unreachable.
* To add a show: add a channel, its characters, and videos in `universe.yaml`.

## Voices

Dialogue is spoken by **Kokoro** (a small neural TTS model, runs on CPU; about 3 minutes per episode). The model
(325 MB) downloads once to `~/.cache/irl-engine` (override with `KOKORO_DIR`). Each cast member has a Kokoro voice
(`kv`) in `engine/cast.py`; the Admin gets a metallic echo, news staff a broadcast EQ, and `speed`/`pitch` on a line
still work. If Kokoro is not installed or cannot download, it falls back to espeak-ng.
`--estimate` uses a calibrated words-per-second model (`schema.WORDS_PER_SEC`, `cast.KV_RATE`); the render workflow
measures the real audio and enforces 10 minutes +/- 5 %.

## Show looks

Set `show:` and `music:` at the top of an episode: `irl` (game HUD, default), `news` (CHANNEL 9 bug, LIVE, scrolling
`ticker`, `lower` thirds, `headline` banners; `hp:` becomes VIEWERS) or `events` (`hp:` becomes BUDGET, `lower` thirds).
Music beds: `arcade`, `news`, `party`. New sets: `newsroom`, `ballroom`, `garden`. Any character can be a camera: `cam: martin`.

## Writing an episode

```yaml
id: s01e02
title: Speedhack
target_seconds: 600
scenes:
  - id: apartment
    set: apartment                      # apartment | street | bank | office | void | black
    cast: {dave: couch, kyle: right}    # character: mark   (or {at: mark, face: degrees})
    beats:
      - {say: dave, text: "Watch this.", cam: dave}
      - {cheat: speedhack, dur: 4, hp: "INF", acts: [{who: dave, do: run_to, to: door}]}
      - {act: 3, cam: follow, acts: [{who: kyle, do: shake}], ui: [{kind: achievement, text: "Wrong Door", at: 1}]}
      - {loading: "Tip: Doors are load-bearing.", dur: 5}
      - {card: "NEXT TIME", sub: "S01E03", dur: 5}
```

| Beat | What it does | Length |
|---|---|---|
| `say: <who>` + `text` | Speech (espeak-ng voice per character) + subtitle + mouth flap | speech + 0.45 s |
| `act: <seconds>` | Pure action / reaction beat | given |
| `cheat: <code>` | Types the code in the console, `CHEAT ACTIVATED` toast + chime | `dur` (3) |
| `loading: "tip"` | Full-screen loading bar with a tip | `dur` (4) |
| `card: "TITLE"` (+`sub`) | Title card | `dur` (3) |

Fields on any beat: `cam`, `acts`, `ui`, `sfx`, `hp`, `lag` (FPS tanks), `shake` (camera shake), `follow`.
On `say` beats, `speed` (words per minute, default ~170) and `pitch` override the voice for that line, e.g. chipmunk-fast speedhack speech.

* **cam**: `wide two dave kyle admin low top follow black`. Default: close-up of the speaker.
* **acts** (`who`, `do`, optional `to`, `dur`, `delay`): `idle walk_to run_to noclip_to fall tpose flop stand jump shake spin grow shrink teleport face appear vanish wave spawn vehicle launch`.
  `spawn` takes `item` (`pizza coin cash cube sneaker`), `n`, `to`, `spread`.
* **ui** (`kind`, `text`, `at`, `dur`): `console system achievement admin chat lower ticker headline`.
* **sfx**: names or `{name, at}`: `chime error pop fall ding whoosh boom glitch warn crowd`.
* Characters: `dave`, `kyle`, `admin`, and any `npc_<anything>` (a different voice and colour is derived from the name).
* Marks (named floor positions) per set live in `engine/sets.py`.

Run `python -m engine validate episodes/*.yaml` after editing. It lists every mistake at once
(unknown character, mark, verb, speaker not in the scene...).

## Layout

```
engine/schema.py          episode loading + validation
engine/plan.py            timing, shards, overlay/audio events
engine/tts.py             espeak-ng wrapper (cached)
engine/audio.py           dialogue + synthesised sfx + chiptune bed -> mix.wav
engine/overlay.py         burn-in game UI as an ASS subtitle file
engine/blender_render.py  runs inside Blender: scene builder + renderer
engine/cast.py, sets.py   characters, locations, camera presets (data)
universe/, engine/universe.py, engine/thumbs.py  shared universe, fake video site, art
docs/series_bible.md      cast, rules, running gags, season 1 slate
```

## Budget

Rendering 10 minutes at 720p with Workbench takes ~14k frames, roughly 12 minutes of CPU when
split over ~18 parallel shards (a few minutes wall time). Public repos get free Actions minutes;
on private repos a full episode costs on the order of 15-25 runner-minutes, a preview about a third of that.
