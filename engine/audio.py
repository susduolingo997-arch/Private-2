"""Mix dialogue + synthesized sound effects + a tiny chiptune bed into one wav."""
import wave

import numpy as np

SR = 24000


def _t(d):
    return np.arange(int(SR * d)) / SR


def _sq(f, d, vol=0.3):
    return vol * np.sign(np.sin(2 * np.pi * f * _t(d)))


def _sine(f, d, vol=0.4):
    return vol * np.sin(2 * np.pi * f * _t(d))


def _env(x, decay=4.0):
    return x * np.exp(-decay * np.arange(len(x)) / len(x))


def _sweep(f0, f1, d, vol=0.4, sq=False):
    t = _t(d)
    f = np.linspace(f0, f1, len(t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return vol * (np.sign(np.sin(ph)) if sq else np.sin(ph))


def _noise(d, vol=0.3, seed=1):
    return vol * (np.random.default_rng(seed).random(int(SR * d)) * 2 - 1)


def make_sfx(name):
    if name == "chime":
        return np.concatenate([_env(_sq(880, .12, .25), 2), _env(_sq(1320, .22, .25), 3)])
    if name == "error":
        return np.concatenate([_sq(110, .15, .35), np.zeros(int(SR * .06)), _sq(110, .25, .35)])
    if name == "pop":
        return _env(_sweep(700, 150, .14, .5), 5)
    if name == "fall":
        return _env(_sweep(1100, 70, 2.2, .4), 1.5)
    if name == "ding":
        return _env(_sine(1568, .5, .45) + _sine(2352, .5, .2), 5)
    if name == "whoosh":
        n = _noise(.6, .5, 2)
        return n * np.hanning(len(n))
    if name == "boom":
        return _env(_sweep(120, 35, .9, .8), 4) + _env(_noise(.9, .3, 3), 8)
    if name == "glitch":
        rng = np.random.default_rng(4)
        return np.concatenate([_sq(float(rng.integers(100, 2000)), .04, .3) for _ in range(14)])
    if name == "warn":
        return np.concatenate([_sq(440, .2, .25), _sq(330, .2, .25)] * 2)
    if name == "crowd":
        n = _noise(2.0, .12, 5)
        return np.convolve(n, np.ones(12) / 12, mode="same")
    raise KeyError(name)


_BEDS = {
    # style: (bpm, arpeggio notes, bass notes (one per 2 arp notes), arp volume)
    "arcade": (112, [261.6, 311.1, 392.0, 311.1, 233.1, 293.7, 349.2, 293.7,
                     207.7, 261.6, 311.1, 261.6, 196.0, 233.1, 293.7, 233.1],
               [65.4, 65.4, 58.3, 58.3, 51.9, 51.9, 49.0, 49.0], .045),
    # News Channel 9: driving, urgent, repeated pulse
    "news": (132, [220.0, 220.0, 329.6, 220.0, 220.0, 329.6, 392.0, 329.6,
                   196.0, 196.0, 293.7, 196.0, 174.6, 174.6, 261.6, 174.6],
             [55.0, 55.0, 49.0, 49.0, 43.7, 43.7, 49.0, 49.0], .05),
    # Marigold Events: bright major bounce
    "party": (124, [392.0, 493.9, 587.3, 493.9, 440.0, 523.3, 659.3, 523.3,
                    349.2, 440.0, 523.3, 440.0, 392.0, 493.9, 587.3, 784.0],
              [98.0, 98.0, 110.0, 110.0, 87.3, 87.3, 98.0, 98.0], .04),
}


def music(seconds, style="arcade"):
    """Quiet chiptune bed (arpeggio + bass), looped. One flavour per show."""
    bpm, notes, bass, vol = _BEDS[style]
    beat = 60 / bpm / 2
    bar = []
    for i, f in enumerate(notes):
        bar.append(_env(_sq(f, beat, vol), 3) + _env(_sine(bass[i // 2], beat, .08), 1.5))
    loop = np.concatenate(bar)
    return np.tile(loop, int(seconds * SR / len(loop)) + 1)[: int(seconds * SR)]


def _read(path):
    with wave.open(path, "rb") as w:
        sr, n = w.getframerate(), w.getnframes()
        x = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768.0
    if sr != SR:
        x = np.interp(np.arange(int(len(x) * SR / sr)) * sr / SR, np.arange(len(x)), x)
    return x


def _add(master, x, t, gain=1.0):
    i = int(t * SR)
    if i >= len(master):
        return
    x = x[: len(master) - i]
    master[i:i + len(x)] += gain * x


def mix(plan, out_path):
    master = np.zeros(int(plan["seconds"] * SR) + SR, dtype=np.float32)
    _add(master, music(plan["seconds"], plan.get("music", "arcade")), 0, 1.0)
    cache = {}
    for s in plan["sfx"]:
        cache.setdefault(s["name"], make_sfx(s["name"]))
        _add(master, cache[s["name"]], s["t"], 0.9)
    for a in plan["audio"]:
        _add(master, _read(a["file"]), a["t"], 1.6)
    peak = float(np.max(np.abs(master))) or 1.0
    master = np.clip(master / max(peak, 1.0) * 0.92, -1, 1)
    with wave.open(out_path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((master * 32767).astype(np.int16).tobytes())
    return out_path
