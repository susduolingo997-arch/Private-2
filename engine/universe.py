"""The shared universe: channels, characters and videos for every show, served by a fake video site.

universe/universe.yaml  ->  load() + validate()  ->  build_site()  ->  site/ (static, open index.html)

Pure data + file copying; no Blender, no network.
"""
import datetime
import json
import os
import shutil

import yaml

from . import cast, plan as planner, schema

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UNIVERSE_FILE = os.path.join(ROOT, "universe", "universe.yaml")
WEB_DIR = os.path.join(ROOT, "universe", "web")
SITE_DIR = os.path.join(ROOT, "site")


class UniverseError(Exception):
    def __init__(self, errors):
        self.errors = errors
        super().__init__("\n".join(errors))


def _date(v):
    return v.isoformat() if isinstance(v, (datetime.date, datetime.datetime)) else str(v)


def validate(u):
    errs = []
    if not isinstance(u, dict):
        raise UniverseError(["top level must be a mapping"])
    for key in ("site", "channels", "characters", "videos"):
        if key not in u:
            errs.append(f"missing '{key}'")
    if errs:
        raise UniverseError(errs)

    def ids(kind, items):
        seen = set()
        for it in items:
            i = it.get("id")
            if not i:
                errs.append(f"{kind}: entry without id: {it}")
            elif i in seen:
                errs.append(f"{kind}: duplicate id {i!r}")
            seen.add(i)
        return seen

    chans = ids("channel", u["channels"])
    people = ids("character", u["characters"])
    vids = ids("video", u["videos"])

    for c in u["channels"]:
        for key in ("name", "handle", "color"):
            if not c.get(key):
                errs.append(f"channel {c.get('id')}: missing '{key}'")
    for p in u["characters"]:
        if p.get("channel") and p["channel"] not in chans:
            errs.append(f"character {p['id']}: unknown channel {p['channel']!r}")
        eng = p.get("engine")
        if eng and not cast.known(eng):
            errs.append(f"character {p['id']}: engine id {eng!r} is not in engine/cast.py (use dave/kyle/admin/npc_<name>)")
    for v in u["videos"]:
        w = f"video {v.get('id')}"
        if v.get("channel") not in chans:
            errs.append(f"{w}: unknown channel {v.get('channel')!r}")
        if not v.get("title"):
            errs.append(f"{w}: missing title")
        if not v.get("published"):
            errs.append(f"{w}: missing published date")
        for who in v.get("cast") or []:
            if who not in people:
                errs.append(f"{w}: cast member {who!r} is not in characters")
        for m in v.get("mentions") or []:
            if m not in vids:
                errs.append(f"{w}: mentions unknown video {m!r}")
        for cm in v.get("comments") or []:
            if not cm.get("text"):
                errs.append(f"{w}: comment without text")
        ep = v.get("episode")
        if ep:
            path = os.path.join(ROOT, ep)
            if not os.path.exists(path):
                errs.append(f"{w}: episode file {ep!r} does not exist")
            else:
                try:
                    schema.load(path)
                except schema.EpisodeError as e:
                    errs.extend(f"{w}: {line}" for line in e.errors)
    if errs:
        raise UniverseError(errs)


def load(path=UNIVERSE_FILE):
    with open(path, encoding="utf-8") as f:
        u = yaml.safe_load(f)
    validate(u)
    return u


def _media_file(v, media_dir):
    p = os.path.join(media_dir, v["id"] + ".mp4")
    return p if os.path.exists(p) else None


def enrich(u, media_dir):
    """Add derived fields (status, duration, media path, channel/person lookups) for the site."""
    chans = {c["id"]: c for c in u["channels"]}
    out = {"site": dict(u["site"], today=_date(u["site"].get("today", ""))),
           "channels": [], "characters": [], "videos": []}
    for c in u["channels"]:
        out["channels"].append(dict(c, subs=c.get("subs", 0), links=c.get("links", [])))
    for p in u["characters"]:
        out["characters"].append(dict(p))
    for v in u["videos"]:
        d = dict(v, published=_date(v["published"]))
        d.setdefault("views", 0)
        d.setdefault("likes", 0)
        d["cast"] = v.get("cast") or []
        d["mentions"] = v.get("mentions") or []
        d["comments"] = v.get("comments") or []
        d["tags"] = v.get("tags") or []
        d["duration"] = None
        if v.get("episode"):
            ep = schema.load(os.path.join(ROOT, v["episode"]))
            d["duration"] = round(planner.build_plan(ep, estimate=True)["seconds"])
            d["target"] = ep.get("target_seconds")
        if _media_file(v, media_dir):
            d["status"], d["src"] = "live", f"media/{v['id']}.mp4"
        elif v.get("episode"):
            d["status"] = "scripted"
        else:
            d["status"] = "planned"
        d["channel_name"] = chans[v["channel"]]["name"]
        out["videos"].append(d)
    return out


def build_site(out_dir=SITE_DIR, universe_path=UNIVERSE_FILE):
    u = load(universe_path)
    os.makedirs(os.path.join(out_dir, "media"), exist_ok=True)
    for name in os.listdir(WEB_DIR):
        shutil.copy2(os.path.join(WEB_DIR, name), os.path.join(out_dir, name))
    data = enrich(u, os.path.join(out_dir, "media"))
    # data.js (not fetch) so the site works straight from file:// with no server.
    with open(os.path.join(out_dir, "data.js"), "w", encoding="utf-8") as f:
        f.write("window.UNIVERSE = " + json.dumps(data, indent=1) + ";\n")
    return data


def _find_render(v, build_dir):
    ep = v.get("episode")
    names = []
    if ep:
        eid = schema.load(os.path.join(ROOT, ep))["id"]
        names += [os.path.join(build_dir, eid + ".mp4"), os.path.join(build_dir, eid, eid + ".mp4")]
    if v.get("file"):
        names.append(os.path.join(ROOT, v["file"]))
    return next((n for n in names if os.path.exists(n)), None)


def publish(build_dir="build", out_dir=SITE_DIR, universe_path=UNIVERSE_FILE):
    """Copy every rendered episode mp4 into site/media/<video id>.mp4, then rebuild the site."""
    u = load(universe_path)
    media = os.path.join(out_dir, "media")
    os.makedirs(media, exist_ok=True)
    copied = []
    for v in u["videos"]:
        src = _find_render(v, build_dir)
        if src:
            shutil.copy2(src, os.path.join(media, v["id"] + ".mp4"))
            copied.append(v["id"])
    build_site(out_dir, universe_path)
    return copied
