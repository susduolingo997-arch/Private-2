"""Turn an episode into a render plan: frame ranges, audio, overlay events, shards."""
import random

from . import cast, schema, tts

CHUNK_FRAMES = 1200  # 50 s at 24 fps per render job


def build_plan(ep, audio_dir=None, estimate=False):
    fps = ep["fps"]
    use_tts = not estimate and tts.available() and audio_dir
    events, audio, sfx, lag = [], [], [], []
    scenes, shards = [], []
    g = 0  # global frame cursor

    for si, s in enumerate(ep["scenes"]):
        local = 0
        beats = []
        for b in s["beats"]:
            kind = b["kind"]
            wav = None
            if kind == "say":
                if use_tts:
                    wav, secs = tts.synth(b["say"], b["text"], audio_dir, b.get("speed"), b.get("pitch"))
                else:
                    secs = len(b["text"].split()) / schema.WORDS_PER_SEC * 170.0 / float(b.get("speed") or cast.get(b["say"])["speed"]) * cast.KV_RATE.get(cast.get(b["say"]).get("kv"), 1.0)
                dur = max(float(b.get("dur", 0)), secs + schema.SAY_PAD)
            else:
                dur = float(b.get("dur", schema.DEFAULT_DUR[kind]))
            frames = max(1, round(dur * fps))
            t0 = (g + local) / fps
            t1 = (g + local + frames) / fps
            rb = dict(b)
            rb.update(f0=local, f1=local + frames, t0=t0, t1=t1)
            beats.append(rb)
            _beat_events(b, kind, wav, t0, t1, events, audio, sfx, lag)
            local += frames
        scenes.append(dict(index=si, id=s["id"], set=s["set"], cast=s["cast"], bg=s.get("bg"),
                           frames=local, g0=g, beats=beats))
        for ci, start in enumerate(range(0, local, CHUNK_FRAMES)):
            shards.append(dict(id=f"s{si:02d}_c{ci:02d}", scene=si, start=start,
                               end=min(local, start + CHUNK_FRAMES) - 1))
        g += local

    events.extend(_fps_events(g / fps, lag, ep["id"]))
    return dict(id=ep["id"], title=ep["title"], fps=fps, resolution=ep["resolution"],
                total_frames=g, seconds=g / fps, music=ep.get("music", "arcade"), show=ep.get("show", "irl"), scenes=scenes, shards=shards,
                events=sorted(events, key=lambda e: e["t0"]), audio=audio, sfx=sfx)


def _beat_events(b, kind, wav, t0, t1, events, audio, sfx, lag):
    for item in schema.aslist(b.get("sfx") or []):
        name, at = (item["name"], item.get("at", 0.05)) if isinstance(item, dict) else (item, 0.05)
        sfx.append(dict(name=name, t=t0 + float(at)))
    if b.get("lag"):
        lag.append((t0, t1))
    if "hp" in b:
        events.append(dict(kind="hp", t0=t0, t1=t0, text=str(b["hp"])))
    if kind == "say":
        if wav:
            audio.append(dict(file=wav, t=t0 + 0.1))
        events.append(dict(kind="subtitle", t0=t0, t1=t1 - 0.05, who=b["say"], text=b["text"]))
    elif kind == "cheat":
        code = str(b["cheat"])
        events.append(dict(kind="console", t0=t0 + 0.1, t1=t0 + 1.6, text="> " + code))
        events.append(dict(kind="system", t0=t0 + 1.4, t1=min(t1, t0 + 4.4),
                           text="CHEAT ACTIVATED: " + code))
        sfx.append(dict(name="chime", t=t0 + 1.4))
    elif kind == "loading":
        events.append(dict(kind="loading", t0=t0, t1=t1, text=str(b["loading"])))
    elif kind == "card":
        events.append(dict(kind="card", t0=t0, t1=t1, text=str(b["card"]), sub=b.get("sub", "")))
    for u in b.get("ui") or []:
        at = t0 + float(u.get("at", 0.3))
        events.append(dict(kind=u["kind"], t0=at, t1=at + float(u.get("dur", 3.0)),
                           text=u["text"]))
        if u["kind"] == "achievement":
            sfx.append(dict(name="ding", t=at))
        elif u["kind"] == "admin":
            sfx.append(dict(name="warn", t=at))


def _fps_events(total, lag, ep_id):
    rnd = random.Random(ep_id)
    out, t = [], 0.0
    while t < total:
        t1 = min(total, t + 1.5)
        laggy = any(a - 1.5 < t < b for a, b in lag)
        val = rnd.randint(2, 14) if laggy else rnd.choice([58, 59, 60, 60, 60, 61, 24, 60])
        out.append(dict(kind="fps", t0=t, t1=t1, text=str(val)))
        t = t1
    return out


def stats(plan):
    rows = []
    for s in plan["scenes"]:
        words = sum(len(b["text"].split()) for b in s["beats"] if b["kind"] == "say")
        rows.append((s["id"], s["frames"] / plan["fps"], words))
    return rows
