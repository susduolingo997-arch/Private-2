"""Burn-in game UI (subtitles, console, toasts, loading bar, HP, FPS) as an ASS file."""
from . import cast

W, H = 1280, 720


def _ts(t):
    t = max(0.0, t)
    cs = int(round(t * 100))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def _bgr(hexcol):
    h = hexcol.lstrip("#")
    return f"&H{h[4:6]}{h[2:4]}{h[0:2]}&".upper()


def _esc(s):
    return str(s).replace("\\", "/").replace("{", "(").replace("}", ")").replace("\n", "\\N")


HEADER = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Sub,DejaVu Sans,34,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,2,140,140,38,1
Style: Mono,DejaVu Sans Mono,26,&H0000FF66,&H0000FF66,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: Toast,DejaVu Sans,24,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: Big,DejaVu Sans,84,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,2,0,1,5,3,5,0,0,0,1
Style: Mid,DejaVu Sans,34,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,2,0,5,0,0,0,1
Style: Small,DejaVu Sans,20,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,2,0,9,0,0,0,1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
"""


def _rect(x1, y1, x2, y2, colour, alpha="40"):
    return (f"{{\\pos(0,0)\\p1\\bord0\\shad0\\1c{_bgr(colour)}\\1a&H{alpha}&}}"
            f"m {x1} {y1} l {x2} {y1} {x2} {y2} {x1} {y2}{{\\p0}}")


class _Slots:
    """Stack overlapping toasts of one kind so they don't draw on top of each other."""

    def __init__(self):
        self.active = []

    def take(self, t0, t1):
        self.active = [(a, b, s) for a, b, s in self.active if b > t0]
        used = {s for _, _, s in self.active}
        slot = next(i for i in range(10) if i not in used)
        self.active.append((t0, t1, slot))
        return slot


def build_ass(plan, path):
    L = [HEADER]

    def ev(layer, t0, t1, style, text):
        L.append(f"Dialogue: {layer},{_ts(t0)},{_ts(t1)},{style},,0,0,0,,{text}\n")

    slots = {k: _Slots() for k in ("console", "system", "achievement", "chat")}
    hp_events = [e for e in plan["events"] if e["kind"] == "hp"]
    total = plan["seconds"]

    for e in plan["events"]:
        k, t0, t1, txt = e["kind"], e["t0"], e["t1"], _esc(e.get("text", ""))
        if k == "subtitle":
            c = cast.get(e["who"])
            ev(1, t0, t1, "Sub", f"{{\\c{_bgr(c['sub'])}}}{c['label']}: {{\\c&HFFFFFF&}}{txt}")
        elif k == "console":
            s = slots[k].take(t0, t1)
            y = 600 - 46 * s
            ev(0, t0, t1, "Mono", _rect(40, y, 640, y + 40, "#000000", "30"))
            ev(1, t0, t1, "Mono", f"{{\\pos(54,{y + 5})}}{txt}")
        elif k == "system":
            s = slots[k].take(t0, t1)
            y = 540 - 46 * s
            ev(0, t0, t1, "Toast", _rect(40, y, 640, y + 40, "#0a3d1f", "30"))
            ev(1, t0, t1, "Toast", f"{{\\pos(54,{y + 8})\\1c&H66FF99&}}{txt}")
        elif k == "achievement":
            s = slots[k].take(t0, t1)
            y = 56 + 74 * s
            ev(0, t0, t1, "Toast", _rect(860, y, 1260, y + 62, "#2a2300", "20"))
            ev(1, t0, t1, "Toast",
               f"{{\\pos(874,{y + 6})\\1c&H33C9FF&}}ACHIEVEMENT UNLOCKED\\N"
               f"{{\\1c&HFFFFFF&\\fs22}}{txt}")
        elif k == "admin":
            ev(0, t0, t1, "Toast", _rect(240, 100, 1040, 180, "#4a0000", "10"))
            ev(1, t0, t1, "Mid", f"{{\\pos(640,140)\\1c&H5555FF&\\fs30}}[ADMIN] {{\\1c&HFFFFFF&}}{txt}")
        elif k == "chat":
            s = slots[k].take(t0, t1)
            y = 90 + 40 * s
            ev(1, t0, t1, "Toast", f"{{\\pos(40,{y})\\bord2\\1c&HDDDDDD&}}{txt}")
        elif k == "loading":
            ev(0, t0, t1, "Mid", _rect(0, 0, W, H, "#000000", "00"))
            ev(1, t0, t1, "Big", f"{{\\pos(640,260)\\fs64}}LOADING...")
            ev(1, t0, t1, "Mid", f"{{\\pos(640,560)\\fs28\\1c&HAAAAAA&}}{txt}")
            ev(1, t0, t1, "Mid", _rect(340, 380, 940, 400, "#444444", "00"))
            dur = int((t1 - t0) * 1000)
            ev(2, t0, t1, "Mid",
               f"{{\\pos(0,0)\\p1\\bord0\\shad0\\1c&H66FF99&\\clip(340,380,340,400)"
               f"\\t(0,{dur},\\clip(340,380,{340 + 600},400))}}m 340 380 l 940 380 940 400 340 400{{\\p0}}")
        elif k == "card":
            ev(0, t0, t1, "Mid", _rect(0, 0, W, H, "#000000", "00"))
            ev(1, t0, t1, "Big", f"{{\\pos(640,330)}}{txt}")
            if e.get("sub"):
                ev(1, t0, t1, "Mid", f"{{\\pos(640,430)\\1c&HAAAAAA&}}{_esc(e['sub'])}")
        elif k == "fps":
            col = "&H66FF99&" if int(e["text"]) >= 30 else "&H4444FF&"
            ev(3, e["t0"], e["t1"], "Small", f"{{\\pos(1250,10)\\1c{col}}}FPS: {txt}")

    # persistent HUD: HP (top-left) until the next hp change
    for i, e in enumerate(hp_events):
        end = hp_events[i + 1]["t0"] if i + 1 < len(hp_events) else total
        txt = e["text"].upper()
        low = txt.isdigit() and int(txt) <= 30
        col = "&H4444FF&" if low else "&H66FF99&"
        ev(3, e["t0"], end, "Toast", f"{{\\pos(24,14)\\bord2\\1c{col}}}HP: {_esc(txt)}")
    ev(3, 0, total, "Small", f"{{\\pos(1250,690)\\an9\\1a&H80&}}IRL BUT CHEATS  {plan['id'].upper()}")

    with open(path, "w", encoding="utf-8") as f:
        f.write("".join(L))
    return path
