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
    return (f"{{\\an7\\pos(0,0)\\p1\\bord0\\shad0\\1c{_bgr(colour)}\\1a&H{alpha}&}}"
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


_SHOW = {  # per-show branding: bug text, accent colour (hex), HUD label for `hp:` beats
    "irl": dict(bug="IRL BUT CHEATS", accent="#33c9ff", hp="HP"),
    "news": dict(bug="CHANNEL 9", accent="#f5b70a", hp="VIEWERS"),
    "events": dict(bug="PASSIONFRUIT", accent="#8e2de2", hp="BUDGET"),
}


def build_ass(plan, path):
    L = [HEADER]
    show = plan.get("show", "irl")
    brand = _SHOW[show]
    sub_pos = "{\\an2\\pos(640,650)}" if show == "news" else ""

    def ev(layer, t0, t1, style, text):
        L.append(f"Dialogue: {layer},{_ts(t0)},{_ts(t1)},{style},,0,0,0,,{text}\n")

    slots = {k: _Slots() for k in ("console", "system", "achievement", "chat")}
    hp_events = [e for e in plan["events"] if e["kind"] == "hp"]
    total = plan["seconds"]

    for e in plan["events"]:
        k, t0, t1, txt = e["kind"], e["t0"], e["t1"], _esc(e.get("text", ""))
        if k == "subtitle":
            c = cast.get(e["who"])
            ev(1, t0, t1, "Sub", f"{sub_pos}{{\\c{_bgr(c['sub'])}}}{c['label']}: {{\\c&HFFFFFF&}}{txt}")
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
            ev(0, t0, t1, "Toast", _rect(720, y, 1260, y + 62, "#2a2300", "20"))
            ev(1, t0, t1, "Toast",
               f"{{\\pos(734,{y + 6})\\1c&H33C9FF&}}ACHIEVEMENT UNLOCKED\\N"
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
               f"{{\\an7\\pos(0,0)\\p1\\bord0\\shad0\\1c&H66FF99&\\clip(340,380,340,400)"
               f"\\t(0,{dur},\\clip(340,380,{340 + 600},400))}}m 340 380 l 940 380 940 400 340 400{{\\p0}}")
        elif k == "card":
            ev(0, t0, t1, "Mid", _rect(0, 0, W, H, "#000000", "00"))
            ev(1, t0, t1, "Big", f"{{\\pos(640,330)}}{txt}")
            if e.get("sub"):
                ev(1, t0, t1, "Mid", f"{{\\pos(640,430)\\1c&HAAAAAA&}}{_esc(e['sub'])}")
        elif k == "lower":  # "NAME|Title" lower third
            name, _, role = txt.partition("|")
            ev(0, t0, t1, "Toast", _rect(40, 520, 700, 600, brand["accent"], "10"))
            ev(1, t0, t1, "Mid", f"{{\\an7\\pos(58,524)\\fs38}}{name.strip()}")
            ev(1, t0, t1, "Toast", f"{{\\an7\\pos(58,568)\\fs22}}{role.strip()}")
        elif k == "headline":
            ev(0, t0, t1, "Toast", _rect(0, 84, W, 160, "#b71c1c" if show == "news" else brand["accent"], "10"))
            ev(1, t0, t1, "Mid", f"{{\\pos(640,122)\\fs40}}{txt}")
        elif k == "ticker":
            pass  # persistent, drawn below
        elif k == "fps":
            if show != "irl":
                continue
            col = "&H66FF99&" if int(e["text"]) >= 30 else "&H4444FF&"
            ev(3, e["t0"], e["t1"], "Small", f"{{\\pos(1250,10)\\1c{col}}}FPS: {txt}")

    # persistent HUD: HP (top-left) until the next hp change
    for i, e in enumerate(hp_events):
        end = hp_events[i + 1]["t0"] if i + 1 < len(hp_events) else total
        txt = e["text"].upper()
        low = txt.isdigit() and int(txt) <= 30
        col = "&H4444FF&" if low else "&H66FF99&"
        if show == "irl":
            ev(3, e["t0"], end, "Toast", f"{{\\pos(24,14)\\bord2\\1c{col}}}HP: {_esc(txt)}")
        else:
            ev(3, e["t0"], end, "Toast", f"{{\\an9\\pos(1256,50)\\bord2\\1c&H66E0FF&}}{brand['hp']}: {_esc(txt)}")
    if show == "irl":
        ev(3, 0, total, "Small", f"{{\\pos(1250,690)\\an9\\1a&H80&}}IRL BUT CHEATS  {plan['id'].upper()}")
    else:
        ev(3, 0, total, "Small", f"{{\\an9\\pos(1256,12)\\1c{_bgr(brand['accent'])}}}{brand['bug']}")
    if show == "news":
        ev(3, 0, total, "Toast", _rect(24, 14, 130, 52, "#d32f2f", "00"))
        ev(4, 0, total, "Toast", "{\\an7\\pos(40,19)}LIVE")
        tick = [e for e in plan["events"] if e["kind"] == "ticker"]
        for i, e in enumerate(tick):
            end = tick[i + 1]["t0"] if i + 1 < len(tick) else total
            ev(3, e["t0"], end, "Toast", _rect(0, 672, W, 720, "#0b1226", "00"))
            ev(4, e["t0"], end, "Toast", _rect(0, 672, 150, 720, "#d32f2f", "00"))
            ev(5, e["t0"], end, "Toast", "{\\an7\\pos(18,682)}CHANNEL 9")
            txt = _esc(e["text"]) + "    +++    "
            width = int(len(txt) * 14.5)
            period = max(8.0, (W + width) / 120.0)  # ~120 px/s
            t = e["t0"]
            while t < end:
                te = min(end, t + period)
                ev(4, t, te, "Toast", f"{{\\an7\\move({W},682,{150 - width},682,0,{int(period * 1000)})\\clip(150,672,{W},720)}}{txt}")
                t = te

    with open(path, "w", encoding="utf-8") as f:
        f.write("".join(L))
    return path
