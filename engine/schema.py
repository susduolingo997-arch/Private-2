"""Episode loading and validation.

An episode is a YAML file:

    id: s01e01
    title: Noclip
    scenes:
      - id: apartment
        set: apartment
        cast: {dave: couch}
        beats:
          - {say: dave, text: "Hello.", cam: dave}
          - {act: 3, acts: [{who: dave, do: walk_to, to: door}]}
          - {cheat: noclip, dur: 3, acts: [...]}
          - {loading: "Tip: reality has no undo.", dur: 5}
          - {card: "IRL BUT CHEATS", sub: "S01E01", dur: 4}

Common beat fields: cam, dur, acts, ui, sfx, lag, shake, hp.
"""
import yaml

from . import cast, sets

KINDS = ("say", "act", "cheat", "loading", "card")
VERBS = {
    "idle", "walk_to", "run_to", "noclip_to", "fall", "tpose", "flop", "stand",
    "jump", "shake", "spin", "grow", "shrink", "teleport", "face", "appear",
    "vanish", "wave", "spawn", "vehicle", "launch",
}
UI_KINDS = {"console", "system", "achievement", "admin", "chat"}
SFX = {"chime", "error", "pop", "fall", "ding", "whoosh", "boom", "glitch", "warn", "crowd"}
DEFAULT_DUR = {"act": 2.0, "cheat": 3.0, "loading": 4.0, "card": 3.0}
SAY_PAD = 0.45
WORDS_PER_SEC = 2.6  # only used when no TTS audio is available


class EpisodeError(Exception):
    def __init__(self, errors):
        self.errors = errors
        super().__init__("\n".join(errors))


def beat_kind(b):
    found = [k for k in KINDS if k in b]
    return found[0] if len(found) == 1 else None


def load(path):
    with open(path, encoding="utf-8") as f:
        ep = yaml.safe_load(f)
    validate(ep, path)
    ep.setdefault("fps", 24)
    ep.setdefault("resolution", [1280, 720])
    for s in ep["scenes"]:
        s["cast"] = s.get("cast") or {}
        for i, b in enumerate(s["beats"]):
            b["kind"] = beat_kind(b)
            b["index"] = i
    return ep


def _mark_ok(set_name, to):
    if isinstance(to, (list, tuple)):
        return len(to) == 2 and all(isinstance(v, (int, float)) for v in to)
    return to in sets.SETS[set_name]["marks"]


def validate(ep, path="<episode>"):
    errs = []
    if not isinstance(ep, dict):
        raise EpisodeError([f"{path}: top level must be a mapping"])
    for key in ("id", "title", "scenes"):
        if key not in ep:
            errs.append(f"{path}: missing '{key}'")
    for si, s in enumerate(ep.get("scenes") or []):
        where = f"{path} scene {si} ({s.get('id', '?')})"
        if s.get("set") not in sets.SETS:
            errs.append(f"{where}: unknown set {s.get('set')!r}")
            continue
        set_name = s["set"]
        scene_cast = s.get("cast") or {}
        for who, at in scene_cast.items():
            at = at.get("at") if isinstance(at, dict) else at
            if not cast.known(who):
                errs.append(f"{where}: unknown character {who!r}")
            if not _mark_ok(set_name, at):
                errs.append(f"{where}: cast {who} at unknown mark {at!r}")
        if not s.get("beats"):
            errs.append(f"{where}: no beats")
        for bi, b in enumerate(s.get("beats") or []):
            bw = f"{where} beat {bi}"
            kind = beat_kind(b)
            if kind is None:
                errs.append(f"{bw}: needs exactly one of {KINDS}")
                continue
            if kind == "say":
                if not cast.known(b["say"]):
                    errs.append(f"{bw}: unknown speaker {b['say']!r}")
                elif b["say"] not in scene_cast:
                    errs.append(f"{bw}: speaker {b['say']!r} is not in this scene's cast")
                if not b.get("text"):
                    errs.append(f"{bw}: say needs text")
            cam = b.get("cam")
            if cam and cam not in sets.CAMS:
                errs.append(f"{bw}: unknown cam {cam!r}")
            for item in _aslist(b.get("sfx") or []):
                nm = item.get("name") if isinstance(item, dict) else item
                if nm not in SFX:
                    errs.append(f"{bw}: unknown sfx {nm!r}")
            for a in b.get("acts") or []:
                who, verb = a.get("who"), a.get("do")
                if who not in scene_cast:
                    errs.append(f"{bw}: act by {who!r} who is not in the cast")
                if verb not in VERBS:
                    errs.append(f"{bw}: unknown verb {verb!r}")
                if "to" in a and not _mark_ok(set_name, a["to"]):
                    errs.append(f"{bw}: unknown mark {a['to']!r}")
                if verb in ("walk_to", "run_to", "noclip_to", "teleport") and "to" not in a:
                    errs.append(f"{bw}: {verb} needs 'to'")
            for u in b.get("ui") or []:
                if u.get("kind") not in UI_KINDS or not u.get("text"):
                    errs.append(f"{bw}: bad ui event {u!r}")
            if kind == "cheat" and not b.get("cheat"):
                errs.append(f"{bw}: cheat needs a code")
    if errs:
        raise EpisodeError(errs)


def _aslist(v):
    return v if isinstance(v, list) else [v]


aslist = _aslist
