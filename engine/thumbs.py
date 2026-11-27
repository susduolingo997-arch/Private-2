"""Thumbnails, avatars and banners for the universe site.

Hero shots are real frames: a one-beat mini episode is planned and rendered by the same Blender
scene builder as the shows (so the characters and sets match), then Pillow adds the video-site
styling (big outlined title text, channel badge, colour grade). Channel logos and banners are drawn
directly with Pillow. Output goes to universe/art/, which is committed, so building the site never
needs Blender.
"""
import json
import os
import subprocess
import tempfile

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont

from . import cast, cli, plan as planner, schema

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, "universe", "art")
W, H = 1280, 720
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def _xy(set_name, at):
    from . import sets
    at = at.get("at") if isinstance(at, dict) else at
    return tuple(at) if isinstance(at, (list, tuple)) else sets.mark(set_name, at)


def _shot(spec):
    """Camera for a still. Frames the cast's final positions, shifted so they sit on the right
    (the title goes on the left). Override with shot: {look: [x,y,z], off: [dx,dy,dz], lens}."""
    sh = spec.get("shot") or {}
    pts = {w: _xy(spec["set"], at) for w, at in spec["cast"].items() if w != "admin" or len(spec["cast"]) == 1}
    for a in spec.get("acts", []):
        if "to" in a and a["who"] in pts:
            pts[a["who"]] = _xy(spec["set"], a["to"])
    xs = [p[0] for p in pts.values()] or [0]
    ys = [p[1] for p in pts.values()] or [0]
    cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
    spread = max(xs) - min(xs)
    dist = spec.get("dist", 7.2 + spread * 1.1)  # pull back for wide casts
    shift = spec.get("shift", 0.22 * dist)  # subjects sit right of centre; title goes left
    look = sh.get("look") or [cx - shift, cy, spec.get("z", 1.3)]
    off = sh.get("off") or spec.get("off") or [0.0, -dist, 2.0 + dist * 0.06]
    return {"look": look, "loc": [look[0] + off[0], look[1] + off[1], look[2] + off[2]],
            "lens": sh.get("lens", spec.get("lens", 35))}


def grab_frame(url, at, out_png):
    """One frame of a published video (ffmpeg seeks over HTTP, so only a few MB are fetched)."""
    os.makedirs(os.path.dirname(out_png), exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", str(at), "-i", url, "-frames:v", "1", out_png],
                   check=True, timeout=240)
    return out_png


def capture_embed(embed, out_png, at, work=None):
    """Screenshot a self-contained player page (universe/embeds/*.html) at `at` seconds via Playwright.
    Set THREE_JS to a local three.min.js if the page's CDN is unreachable (offline CI / sandboxes)."""
    cmd = ["node", os.path.join(ROOT, "engine", "capture_embed.js"), os.path.join(ROOT, embed), out_png, str(at)]
    if os.environ.get("THREE_JS"):
        cmd.append(os.environ["THREE_JS"])
    subprocess.run(cmd, check=True, capture_output=True, timeout=240)
    return out_png


def render_still(spec, out_png, work=None):
    """spec: {set, cast, cam, acts?, at?}. Renders one 1280x720 frame to out_png (via Blender)."""
    fps, at = 24, int(spec.get("at", 10))
    beat = {"act": 2.0, "cam": spec.get("cam", "wide"), "acts": spec.get("acts", [])}
    beat["shot"] = _shot(spec)
    scene = {"id": "t", "set": spec["set"], "cast": spec["cast"], "beats": [beat]}
    if spec.get("bg"):
        scene["bg"] = spec["bg"]
    ep = {"id": "thumb", "title": "thumb", "fps": fps, "resolution": [W, H], "scenes": [scene]}
    schema.validate(ep)
    for s in ep["scenes"]:
        s["cast"] = s.get("cast") or {}
        for i, b in enumerate(s["beats"]):
            b["kind"], b["index"] = schema.beat_kind(b), i
    plan = planner.build_plan(dict(ep), estimate=True)
    with tempfile.TemporaryDirectory(dir=work) as d:
        pp = os.path.join(d, "plan.json")
        with open(pp, "w") as f:
            json.dump(plan, f)
        subprocess.run(cli._blender_cmd(pp, plan["shards"][0]["id"], d, False, 1, at),
                       check=True, capture_output=True)
        mp4 = os.path.join(d, plan["shards"][0]["id"] + ".mp4")
        os.makedirs(os.path.dirname(out_png), exist_ok=True)
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", mp4, "-frames:v", "1", out_png],
                       check=True)
    return out_png


# ------------------------------------------------------------------ styling
FONT_MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
FONT_COND = "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf"
YELLOW = (255, 225, 77)


def _rgb(hexcol):
    h = hexcol.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _font(size, path=FONT_COND):
    return ImageFont.truetype(path, size)


def _grade(img, vignette=0.55):
    img = ImageEnhance.Color(img.convert("RGB")).enhance(1.35)
    img = ImageEnhance.Contrast(img).enhance(1.12)
    mask = Image.radial_gradient("L").resize(img.size)  # 0 centre .. 255 edge
    dark = Image.new("RGB", img.size, (0, 0, 0))
    return Image.composite(dark, img, mask.point(lambda v: int(max(0, v - 120) * vignette * 2.2)))


def _outlined(d, xy, text, font, fill, stroke=12, anchor="ls"):
    d.text(xy, text, font=font, fill=fill, stroke_width=stroke, stroke_fill=(0, 0, 0), anchor=anchor)


def _fit(d, text, max_w, start=150, path=FONT_COND):
    size = start
    while size > 40 and d.textlength(text, font=_font(size, path)) > max_w:
        size -= 4
    return _font(size, path)


def logo(kind, size=400, color="#f2a33a"):
    """Hand-drawn channel logo (RGBA, circular)."""
    S = size * 2
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = S // 2
    if kind == "console":
        d.ellipse((0, 0, S, S), fill=(18, 20, 28))
        d.ellipse((S * .03, S * .03, S * .97, S * .97), outline=_rgb(color), width=int(S * .045))
        d.text((c, c), ">_", font=_font(int(S * .42), FONT_MONO), fill=(102, 255, 153), anchor="mm")
    elif kind == "nine":
        d.ellipse((0, 0, S, S), fill=(11, 31, 74))
        d.ellipse((S * .06, S * .06, S * .94, S * .94), outline=(245, 183, 10), width=int(S * .06))
        d.text((c, c * 1.03), "9", font=_font(int(S * .66)), fill=(255, 255, 255), anchor="mm")
        d.rectangle((S * .30, S * .80, S * .70, S * .87), fill=(215, 18, 43))
    elif kind == "shard":  # Pixelpanic: a crystal shard
        d.ellipse((0, 0, S, S), fill=(14, 38, 40))
        d.ellipse((S * .03, S * .03, S * .97, S * .97), outline=_rgb(color), width=int(S * .045))
        d.polygon([(c, S * .14), (S * .72, S * .42), (c, S * .88), (S * .28, S * .42)], fill=(53, 201, 165))
        d.polygon([(c, S * .14), (S * .72, S * .42), (c, S * .5)], fill=(150, 255, 230))
        d.polygon([(S * .28, S * .42), (c, S * .5), (c, S * .88)], fill=(30, 140, 118))
    elif kind == "flower":  # spare logo style  # marigold
        d.ellipse((0, 0, S, S), fill=_rgb(color))
        import math
        for i in range(12):
            a = i * 2 * math.pi / 12
            x, y = c + math.cos(a) * S * .22, c + math.sin(a) * S * .22
            d.ellipse((x - S * .13, y - S * .13, x + S * .13, y + S * .13), fill=(255, 214, 79) if i % 2 else (255, 128, 0))
        d.ellipse((c - S * .12, c - S * .12, c + S * .12, c + S * .12), fill=(120, 50, 0))
    else:  # fruit: a halved passion fruit
        d.ellipse((0, 0, S, S), fill=_rgb(color))
        d.ellipse((S * .16, S * .16, S * .84, S * .84), fill=(94, 36, 128))
        d.ellipse((S * .23, S * .23, S * .77, S * .77), fill=(255, 214, 79))
        import math
        for i in range(9):
            a = i * 2 * math.pi / 9
            x, y = c + math.cos(a) * S * .17, c + math.sin(a) * S * .17
            d.ellipse((x - S * .035, y - S * .045, x + S * .035, y + S * .045), fill=(60, 25, 40))
        d.ellipse((c - S * .05, c - S * .05, c + S * .05, c + S * .05), fill=(60, 25, 40))
    im = im.resize((size, size), Image.LANCZOS)
    return im


def _paste_round(img, tile, xy):
    img.paste(tile, xy, tile)


def plain_keynote_bg(out_png, color="#8e2de2"):
    """Stage-black keynote backdrop with a purple glow and a big passion fruit (for events with no 3D frame)."""
    bg = Image.new("RGB", (W, H), (6, 4, 12))
    glow = Image.radial_gradient("L").resize((W, H))
    glow = ImageChops.invert(glow).point(lambda v: int(v * .55))
    bg.paste(Image.new("RGB", (W, H), _rgb(color)), (0, 0), glow.crop((0, 0, W, H)))
    big = logo("fruit", 460, "#ff4fa3")
    bg.paste(big, (W - 560, (H - 460) // 2 - 10), big)
    os.makedirs(os.path.dirname(out_png), exist_ok=True)
    bg.save(out_png)
    return out_png


def compose_thumb(raw_png, out_jpg, text, hl=0, tag="", style="irl", color="#f2a33a", logo_img=None, show=""):
    img = _grade(Image.open(raw_png).convert("RGB").resize((W, H), Image.LANCZOS))
    d = ImageDraw.Draw(img, "RGBA")
    # darken the lower-left so the title always reads
    shade = Image.linear_gradient("L").rotate(90).resize((W, H))  # white right .. black left
    img.paste(Image.new("RGB", (W, H), (0, 0, 0)), (0, 0), shade.point(lambda v: int((255 - v) * .55)))
    d = ImageDraw.Draw(img, "RGBA")
    accent = _rgb(color)
    lines = text if isinstance(text, list) else [text]
    max_w = int(W * .62)
    sizes = [_fit(d, ln, max_w, 170) for ln in lines]
    y = H - 54 - (70 if style == "news" else 0)
    for i in range(len(lines) - 1, -1, -1):
        _outlined(d, (48, y), lines[i], sizes[i], YELLOW if i == hl else (255, 255, 255))
        y -= sizes[i].size + 10
    if style == "news":
        d.rectangle((0, 0, W, 78), fill=(183, 28, 28, 235))
        _outlined(d, (28, 56), tag or "BREAKING", _font(56), (255, 255, 255), stroke=0)
        d.rectangle((0, H - 84, W, H), fill=(11, 18, 38, 245))
        d.rectangle((0, H - 84, 300, H), fill=(245, 183, 10))
        _outlined(d, (24, H - 26), "CHANNEL 9", _font(48), (11, 31, 74), stroke=0)
        _outlined(d, (330, H - 28), "EVENING NEWS", _font(40), (200, 215, 255), stroke=0)
    elif style == "letsplay":
        d.rounded_rectangle((28, 24, 28 + 40 + len(tag or "EP") * 36, 96), radius=14, fill=(255, 225, 77, 255))
        _outlined(d, (28 + 20, 76), tag or "EP", _font(52), (20, 20, 20), stroke=0)
        _outlined(d, (W - 40, 70), "SHARDWILD", _font(40), (255, 255, 255), stroke=6, anchor="rs")
    elif style == "keynote":
        d.rounded_rectangle((28, 24, 28 + 40 + len(tag or "EVENT") * 36, 96), radius=36, fill=accent + (255,))
        _outlined(d, (28 + 24, 76), tag or "EVENT", _font(52), (255, 255, 255), stroke=0)
        _outlined(d, (W - 40, 70), "PASSIONFRUIT", _font(40), (255, 255, 255), stroke=0, anchor="rs")
    elif style == "events":
        d.polygon([(0, 0), (470, 0), (370, 92), (0, 92)], fill=accent + (245,))
        _outlined(d, (26, 66), (tag or "EVENT"), _font(56), (255, 255, 255), stroke=0)
        for cx, cy, r, col in ((1130, 90, 18, YELLOW), (1200, 150, 10, accent), (1080, 190, 8, (255, 255, 255)),
                               (1215, 60, 12, (142, 45, 226))):
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=col + (230,))
    else:
        d.rounded_rectangle((26, 22, 26 + 22 + len(tag or "cheat") * 33 + 46, 92), radius=10, fill=(0, 0, 0, 215))
        d.text((44, 57), "> " + (tag or "cheat").lower(), font=_font(46, FONT_MONO), fill=(102, 255, 153), anchor="lm")
    if logo_img is not None:
        lg = logo_img.resize((120, 120), Image.LANCZOS)
        _paste_round(img, lg, (W - 150, H - 150 - (80 if style == "news" else 0)))
    os.makedirs(os.path.dirname(out_jpg), exist_ok=True)
    img.save(out_jpg, quality=88)
    return out_jpg


def compose_banner(raw_png, out_jpg, name, color, logo_img):
    img = _grade(Image.open(raw_png), 0.35)
    bw, bh = 2048, 340
    crop_h = int(W * bh / bw)
    top = int(H * .22)
    img = img.crop((0, top, W, top + crop_h)).resize((bw, bh), Image.LANCZOS)
    grad = Image.linear_gradient("L").rotate(90).resize((bw, bh))
    img.paste(Image.new("RGB", (bw, bh), _rgb(color)), (0, 0), grad.point(lambda v: int((255 - v) * .6)))
    d = ImageDraw.Draw(img)
    _outlined(d, (360, 205), name.upper(), _font(120), (255, 255, 255), stroke=8)
    img.paste(logo_img.resize((220, 220), Image.LANCZOS), (90, 60), logo_img.resize((220, 220), Image.LANCZOS))
    os.makedirs(os.path.dirname(out_jpg), exist_ok=True)
    img.save(out_jpg, quality=88)


def compose_avatar(raw_png, out_png, color, size=320):
    img = Image.open(raw_png).convert("RGB")
    s = H  # the shot is already centred on the head: take the central square
    left, top = (W - s) // 2, 0
    img = img.crop((left, top, left + s, top + s)).resize((size * 2, size * 2), Image.LANCZOS)
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, img.size[0] - 1, img.size[1] - 1), fill=255)
    ring = ImageDraw.Draw(img)
    ring.ellipse((6, 6, img.size[0] - 7, img.size[1] - 7), outline=_rgb(color), width=18)
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    out = out.resize((size, size), Image.LANCZOS)
    os.makedirs(os.path.dirname(out_png), exist_ok=True)
    out.save(out_png)


# ------------------------------------------------------------------ the whole set
def _dark(hexcol, k=.38):
    r, g, b = _rgb(hexcol)
    return "#%02x%02x%02x" % (int(r * k), int(g * k), int(b * k))


def build_art(universe, only=None, force=False, art=ART, work=None):
    """Render and compose every thumbnail, avatar and banner that is missing (or all with force)."""
    made = []
    chans = {c["id"]: c for c in universe["channels"]}
    logos = {c["id"]: logo(c.get("logo", "fruit"), 400, c["color"]) for c in universe["channels"]}

    def want(kind, i):
        out = os.path.join(art, kind, i + (".png" if kind == "avatars" else ".jpg"))
        if only and i not in only:
            return None
        return None if (os.path.exists(out) and not force) else out

    tmp = tempfile.mkdtemp(dir=work)
    for c in universe["channels"]:
        lg_out = os.path.join(art, "avatars", c["id"] + ".png")
        if not os.path.exists(lg_out) or force:
            os.makedirs(os.path.dirname(lg_out), exist_ok=True)
            logos[c["id"]].save(lg_out)
            made.append(lg_out)
        out = want("banners", c["id"])
        if out and c.get("banner"):
            if c["banner"].get("frame"):
                raw = grab_frame(c["banner"]["frame"]["url"], c["banner"]["frame"].get("at", 60), os.path.join(tmp, "b_" + c["id"] + ".png"))
            else:
                raw = render_still(c["banner"], os.path.join(tmp, "b_" + c["id"] + ".png"))
            compose_banner(raw, out, c["name"], c["color"], logos[c["id"]])
            made.append(out)
    for p in universe["characters"]:
        out = want("avatars", p["id"])
        if not out:
            continue
        if not p.get("engine"):
            continue  # not a 3D model in this engine: the site falls back to an initials avatar
        who = p["engine"]
        acts = [{"who": who, "do": "appear"}] if who == "admin" else []
        if p.get("shrink"):
            acts = [{"who": who, "do": "shrink", "by": p["shrink"], "dur": 0.1}]
        z = 2.5 if who == "admin" else 0.55 if p.get("shrink") else 1.75 * cast.get(who)["height"]
        spec = {"set": "black", "bg": _dark(p["color"]), "cast": {who: [0, 0]}, "cam": who, "acts": acts, "at": 10,
                "shot": {"look": [0, 0, z], "off": [0, -7.0 if not p.get("shrink") else -3.2, 0.15], "lens": 50}}
        raw = render_still(spec, os.path.join(tmp, "a_" + p["id"] + ".png"))
        compose_avatar(raw, out, p["color"])
        made.append(out)
    for v in universe["videos"]:
        out = want("thumbs", v["id"])
        if not out or not v.get("thumb"):
            continue
        t = v["thumb"]
        c = chans[v["channel"]]
        if t.get("file"):
            raw = os.path.join(ROOT, t["file"])
        elif t.get("frame"):
            try:
                raw = grab_frame(t["frame"]["url"], t["frame"].get("at", 60), os.path.join(tmp, "t_" + v["id"] + ".png"))
            except Exception as e:  # asset missing / offline: still give the video a (plain) thumbnail
                print(f"art: could not grab a frame for {v['id']} ({type(e).__name__}); using plain art")
                raw = plain_keynote_bg(os.path.join(tmp, "t_" + v["id"] + ".png"), c["color"])
        elif t.get("plain"):
            raw = plain_keynote_bg(os.path.join(tmp, "t_" + v["id"] + ".png"), c["color"])
        elif t.get("capture"):
            raw = capture_embed(t["capture"]["embed"], os.path.join(tmp, "t_" + v["id"] + ".png"), t["capture"].get("at", 40))
        else:
            raw = render_still(t, os.path.join(tmp, "t_" + v["id"] + ".png"))
        compose_thumb(raw, out, t.get("text", [v["title"]]), t.get("hl", 0), t.get("tag", ""),
                      t.get("style", "irl"), c["color"], logos[c["id"]], c["name"])
        made.append(out)
    return made
