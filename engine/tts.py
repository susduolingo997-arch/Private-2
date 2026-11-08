"""Text-to-speech through espeak-ng (cached by content hash)."""
import hashlib
import os
import shutil
import subprocess
import wave

from . import cast


def available():
    return shutil.which("espeak-ng") is not None


def wav_seconds(path):
    with wave.open(path, "rb") as w:
        return w.getnframes() / float(w.getframerate())


def synth(who, text, out_dir):
    """Return (wav_path, seconds) for a line spoken by `who`."""
    c = cast.get(who)
    key = hashlib.sha1(f"{c['voice']}|{c['pitch']}|{c['speed']}|{text}".encode()).hexdigest()[:16]
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f"{who}_{key}.wav")
    if not os.path.exists(path):
        subprocess.run(["espeak-ng", "-v", c["voice"], "-p", str(c["pitch"]),
                        "-s", str(c["speed"]), "-w", path, text],
                       check=True, capture_output=True)
    return path, wav_seconds(path)
