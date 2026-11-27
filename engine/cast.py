"""Characters: look, voice and subtitle colour. Pure data, no Blender imports."""
import zlib

CAST = {
    "dave": dict(label="DAVE", color="#f2a33a", hair="#5b3a1a", height=1.00,
                 voice="en-us+m1", pitch=55, speed=170, sub="#ffd27a", kv="am_puck"),
    "kyle": dict(label="KYLE", color="#4a90e2", hair="#1c1c1c", height=1.12,
                 voice="en-us+m7", pitch=28, speed=158, sub="#8ec5ff", kv="am_onyx"),
    # The Admin is a floating red crystal with a very bored voice.
    "admin": dict(label="ADMIN", color="#e03a3a", hair="#ffffff", height=1.00,
                  voice="en-gb+croak", pitch=12, speed=145, sub="#ff7b7b",
                  floating=True, kv="bm_lewis", fx="crystal"),
    # ---- Channel 9 Evening News (canon from the original Channel 9 episodes)
    "martin": dict(label="MARTIN", color="#7fb2ff", hair="#2b2b2b", height=1.08,
                   voice="en-gb+m5", pitch=28, speed=150, sub="#7fb2ff", kv="bm_george", fx="broadcast"),
    "sarah": dict(label="SARAH", color="#ffb3c7", hair="#6b3a1a", height=1.0,
                  voice="en-us+f2", pitch=52, speed=170, sub="#ffb3c7", kv="af_nicole", fx="broadcast"),
    "david": dict(label="DAVID", color="#9ef0c0", hair="#8a5a2b", height=1.15,
                  voice="en-us+m4", pitch=20, speed=165, sub="#9ef0c0", kv="am_adam", fx="broadcast"),
    "emma": dict(label="EMMA", color="#ffd27a", hair="#c9a27a", height=1.0,
                 voice="en-us+f4", pitch=62, speed=185, sub="#ffd27a", kv="af_heart", fx="broadcast"),
    "kevin": dict(label="KEVIN", color="#c9a7ff", hair="#1c1c1c", height=0.95,
                  voice="en-us+m3", pitch=75, speed=190, sub="#c9a7ff", kv="am_liam"),
    "richard": dict(label="RICHARD", color="#ff9a7a", hair="#5b5b5b", height=1.0,
                    voice="en-us+m4", pitch=12, speed=195, sub="#ff9a7a", kv="am_santa"),
    "gerald": dict(label="GERALD", color="#7fb7be", hair="#9aa5b1", height=1.0,
                   voice="en-us+m3", pitch=30, speed=140, sub="#bfe3e8", kv="am_eric"),
    "greg": dict(label="GREG", color="#b08968", hair="#2b2b2b", height=1.18,
                 voice="en-us+m4", pitch=22, speed=150, sub="#e6c9a8", kv="am_fenrir"),
}

_NPC_VOICES = ["en-us+f2", "en-us+m3", "en-gb+m5", "en-us+f4", "en-us+m4", "en-gb+f3"]
# Measured speaking time of each Kokoro voice relative to the 3.06 words/s baseline (engine/schema.py).
# Used only by --estimate; real runs measure the audio. Re-fit with a few `plan` runs if voices change.
KV_RATE = {"af_nicole": 1.40, "af_heart": 0.87, "af_bella": 0.96, "af_sky": 0.87, "af_nova": 0.78,
           "am_eric": 0.72, "am_puck": 0.90, "bf_emma": 0.81, "bm_daniel": 0.91, "am_michael": 1.03,
           "am_adam": 0.97, "am_onyx": 0.99, "bm_fable": 0.96, "bm_lewis": 0.96, "af_alloy": 0.98,
           "af_jessica": 0.92, "bf_isabella": 1.07, "am_santa": 0.90}


_NPC_KV = ["af_heart", "am_michael", "bf_emma", "af_sky", "am_liam", "bm_daniel", "af_jessica",
           "am_echo", "bf_isabella", "af_nova", "am_santa", "af_alloy"]
_NPC_COLORS = ["#9aa5b1", "#b08968", "#8fb996", "#c9a0dc", "#d4a373", "#7fb7be"]


def is_npc(who):
    return who.startswith("npc_")


def known(who):
    return who in CAST or is_npc(who)


ALIASES = {"npc_gerald": "gerald", "npc_greg": "greg"}  # older scripts


def get(who):
    who = ALIASES.get(who, who)
    if who in CAST:
        return CAST[who]
    if not is_npc(who):
        raise KeyError(who)
    h = zlib.crc32(who.encode())
    return dict(label=who.replace("npc_", "NPC ").upper().replace("_", " "),
                color=_NPC_COLORS[h % len(_NPC_COLORS)], hair="#444444",
                height=0.9 + (h % 30) / 100.0,
                voice=_NPC_VOICES[h % len(_NPC_VOICES)],
                pitch=30 + h % 40, speed=150 + h % 25, sub="#dddddd",
                kv=_NPC_KV[(h >> 3) % len(_NPC_KV)])
