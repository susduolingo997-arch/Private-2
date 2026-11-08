"""Characters: look, voice and subtitle colour. Pure data, no Blender imports."""
import zlib

CAST = {
    "dave": dict(label="DAVE", color="#f2a33a", hair="#5b3a1a", height=1.00,
                 voice="en-us+m1", pitch=55, speed=170, sub="#ffd27a"),
    "kyle": dict(label="KYLE", color="#4a90e2", hair="#1c1c1c", height=1.12,
                 voice="en-us+m7", pitch=28, speed=158, sub="#8ec5ff"),
    # The Admin is a floating red crystal with a very bored voice.
    "admin": dict(label="ADMIN", color="#e03a3a", hair="#ffffff", height=1.00,
                  voice="en-gb+croak", pitch=12, speed=145, sub="#ff7b7b",
                  floating=True),
}

_NPC_VOICES = ["en-us+f2", "en-us+m3", "en-gb+m5", "en-us+f4", "en-us+m4", "en-gb+f3"]
_NPC_COLORS = ["#9aa5b1", "#b08968", "#8fb996", "#c9a0dc", "#d4a373", "#7fb7be"]


def is_npc(who):
    return who.startswith("npc_")


def known(who):
    return who in CAST or is_npc(who)


def get(who):
    if who in CAST:
        return CAST[who]
    if not is_npc(who):
        raise KeyError(who)
    h = zlib.crc32(who.encode())
    return dict(label=who.replace("npc_", "NPC ").upper().replace("_", " "),
                color=_NPC_COLORS[h % len(_NPC_COLORS)], hair="#444444",
                height=0.9 + (h % 30) / 100.0,
                voice=_NPC_VOICES[h % len(_NPC_VOICES)],
                pitch=30 + h % 40, speed=150 + h % 25, sub="#dddddd")
