"""Text-to-speech, cached by content hash.

Primary engine: Kokoro (neural, 82M params, runs on CPU via onnxruntime). The model files are
fetched once from the kokoro-onnx GitHub release into ~/.cache/irl-engine (override: KOKORO_DIR).
Fallback when Kokoro is not installed or cannot be fetched: espeak-ng (robotic but zero setup).
"""
import hashlib
import os
import shutil
import subprocess
import sys
import urllib.request
import wave

from . import cast

_REL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
_FILES = {"kokoro-v1.0.onnx": "model", "voices-v1.0.bin": "voices"}
_kokoro = None
_kokoro_failed = False
SR = 24000


def _model_dir():
    return os.environ.get("KOKORO_DIR") or os.path.join(os.path.expanduser("~"), ".cache", "irl-engine")


def _get_kokoro():
    """Load the Kokoro model once (downloading it if needed). None if unavailable."""
    global _kokoro, _kokoro_failed
    if _kokoro or _kokoro_failed:
        return _kokoro
    try:
        from kokoro_onnx import Kokoro
        d = _model_dir()
        os.makedirs(d, exist_ok=True)
        for name in _FILES:
            p = os.path.join(d, name)
            if not os.path.exists(p):
                print(f"tts: downloading {name} ...", file=sys.stderr)
                urllib.request.urlretrieve(_REL + name, p + ".part")
                os.replace(p + ".part", p)
        _kokoro = Kokoro(os.path.join(d, "kokoro-v1.0.onnx"), os.path.join(d, "voices-v1.0.bin"))
    except Exception as e:  # missing package, offline, bad model: fall back to espeak
        print(f"tts: Kokoro unavailable ({e}); falling back to espeak-ng", file=sys.stderr)
        _kokoro_failed = True
    return _kokoro


def engine():
    if _get_kokoro():
        return "kokoro"
    return "espeak" if shutil.which("espeak-ng") else None


def available():
    return engine() is not None


def wav_seconds(path):
    with wave.open(path, "rb") as w:
        return w.getnframes() / float(w.getframerate())


def _ffmpeg(path, filt):
    tmp = path + ".tmp.wav"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", path, "-af", filt, "-ar", str(SR),
                    "-ac", "1", tmp], check=True)
    os.replace(tmp, path)


def _kokoro_synth(c, text, path, speed, pitch):
    import numpy as np
    import soundfile as sf
    factor = max(0.5, min(2.0, (speed or c["speed"]) / 170.0))
    samples, sr = _get_kokoro().create(text, voice=c["kv"], speed=factor, lang=c.get("lang", "en-us"))
    # a touch of room tone padding so words do not clip at the edges
    samples = np.concatenate([np.zeros(int(sr * 0.04)), samples, np.zeros(int(sr * 0.06))])
    sf.write(path, samples, sr, subtype="PCM_16")
    filt = []
    if pitch and pitch != c["pitch"]:  # per-line pitch override -> semitones around the voice's own pitch
        r = 2 ** (((pitch - c["pitch"]) / 10.0) / 12.0)
        filt.append(f"asetrate={int(sr * r)},aresample={SR},atempo={1 / r:.4f}")
    if c.get("fx") == "crystal":  # The Admin: a short metallic echo
        filt.append("aecho=0.8:0.7:35|70:0.35|0.2")
    elif c.get("fx") == "broadcast":  # news desk: tighter, brighter
        filt.append("highpass=f=120,acompressor=threshold=-18dB:ratio=3,equalizer=f=3500:t=q:w=1:g=3")
    if filt:
        _ffmpeg(path, ",".join(filt))


def synth(who, text, out_dir, speed=None, pitch=None):
    """Return (wav_path, seconds) for a line spoken by `who`. speed (wpm) / pitch override the voice."""
    eng = engine()
    c = dict(cast.get(who))
    key = hashlib.sha1(f"{eng}|{c.get('kv')}|{c.get('fx')}|{c['voice']}|{pitch or c['pitch']}|"
                       f"{speed or c['speed']}|{text}".encode()).hexdigest()[:16]
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f"{who}_{key}.wav")
    if not os.path.exists(path):
        if eng == "kokoro":
            _kokoro_synth(c, text, path, speed, pitch)
        else:
            subprocess.run(["espeak-ng", "-v", c["voice"], "-p", str(pitch or c["pitch"]),
                            "-s", str(speed or c["speed"]), "-w", path, text],
                           check=True, capture_output=True)
    return path, wav_seconds(path)
