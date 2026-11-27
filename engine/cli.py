"""python -m engine <command>   (see README)"""
import argparse
import glob
import json
import os
import shutil
import subprocess
import sys

from . import audio, overlay, plan as planner, schema, universe

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOLERANCE = 0.05  # episodes must land within 5% of target_seconds (default 600 = 10 min)


def _fmt(sec):
    return f"{int(sec // 60)}:{sec % 60:04.1f}"


def _gate(ep, plan, tol=TOLERANCE):
    target = float(ep.get("target_seconds", 600))
    lo, hi = target * (1 - tol), target * (1 + tol)
    if not lo <= plan["seconds"] <= hi:
        raise SystemExit(f"{ep['id']}: runtime {_fmt(plan['seconds'])} is outside "
                         f"{_fmt(lo)}-{_fmt(hi)} (target {_fmt(target)}). Add/trim beats.")


def cmd_validate(a):
    for path in a.episodes:
        ep = schema.load(path)
        plan = planner.build_plan(ep, estimate=True)
        print(f"{ep['id']}  {ep['title']}  ~{_fmt(plan['seconds'])} (estimated)  "
              f"{plan['total_frames']} frames, {len(plan['shards'])} render shards")
        for sid, secs, words in planner.stats(plan):
            print(f"   {sid:<12} {_fmt(secs):>7}   {words} spoken words")
        if a.gate:
            _gate(ep, plan, a.tolerance)


def cmd_plan(a):
    ep = schema.load(a.episode)
    out = os.path.abspath(os.path.join(a.out, ep["id"]))
    os.makedirs(out, exist_ok=True)
    plan = planner.build_plan(ep, audio_dir=os.path.join(out, "audio"), estimate=a.estimate)
    with open(os.path.join(out, "plan.json"), "w") as f:
        json.dump(plan, f, indent=1)
    audio.mix(plan, os.path.join(out, "mix.wav"))
    overlay.build_ass(plan, os.path.join(out, "overlay.ass"))
    matrix = {"include": [{"shard": s["id"]} for s in plan["shards"]]}
    with open(os.path.join(out, "matrix.json"), "w") as f:
        json.dump(matrix, f)
    print(f"{ep['id']}: {_fmt(plan['seconds'])}, {plan['total_frames']} frames, "
          f"{len(plan['shards'])} shards -> {out}")
    if a.gate:
        _gate(ep, plan)
    gh = os.environ.get("GITHUB_OUTPUT")
    if gh:
        with open(gh, "a") as f:
            f.write(f"matrix={json.dumps(matrix)}\nplan_dir={out}\nepisode_id={ep['id']}\n")
    return out


def _blender_cmd(plan_path, shard, out_dir, preview, limit, at=None):
    blender = os.environ.get("BLENDER", "blender")
    cmd = [blender, "-b", "--factory-startup", "-P",
           os.path.join(ROOT, "engine", "blender_render.py"), "--",
           "--plan", plan_path, "--shard", shard, "--out", out_dir]
    if preview:
        cmd.append("--preview")
    if limit:
        cmd += ["--limit", str(limit)]
    if at is not None:
        cmd += ["--at", str(at)]
    if not os.environ.get("DISPLAY") and shutil.which("xvfb-run"):
        cmd = ["xvfb-run", "-a"] + cmd
    return cmd


def cmd_render(a):
    out = os.path.abspath(a.out)
    subprocess.run(_blender_cmd(os.path.abspath(a.plan), a.shard, out, a.preview, a.limit, a.at),
                   check=True)
    print("rendered", os.path.join(out, a.shard + ".mp4"))


def cmd_assemble(a):
    plan_dir = os.path.dirname(os.path.abspath(a.plan))
    with open(a.plan) as f:
        plan = json.load(f)
    missing = [s["id"] for s in plan["shards"]
               if not os.path.exists(os.path.join(a.shards, s["id"] + ".mp4"))]
    if missing:
        raise SystemExit("missing rendered shards: " + ", ".join(missing))
    lst = os.path.join(plan_dir, "concat.txt")
    with open(lst, "w") as f:
        for s in plan["shards"]:
            f.write(f"file '{os.path.abspath(os.path.join(a.shards, s['id'] + '.mp4'))}'\n")
    out = os.path.abspath(a.out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0",
                    "-i", lst, "-i", "mix.wav", "-vf", "ass=overlay.ass",
                    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", out],
                   check=True, cwd=plan_dir)
    print("wrote", out)


def cmd_build(a):
    """Everything locally: plan, render every shard, assemble."""
    plan_dir = cmd_plan(argparse.Namespace(episode=a.episode, out=a.out, estimate=a.estimate,
                                           gate=not a.preview))
    plan_path = os.path.join(plan_dir, "plan.json")
    with open(plan_path) as f:
        plan = json.load(f)
    shards = os.path.join(plan_dir, "shards")
    for s in plan["shards"]:
        if a.only and s["id"] not in a.only:
            continue
        cmd_render(argparse.Namespace(plan=plan_path, shard=s["id"], out=shards,
                                      preview=a.preview, limit=a.limit, at=None))
    if not a.only:
        cmd_assemble(argparse.Namespace(plan=plan_path, shards=shards,
                                        out=os.path.join(a.out, plan["id"] + ".mp4")))


def cmd_universe(a):
    try:
        if a.action == "check":
            u = universe.load()
            ph = [x["id"] for k in ("channels", "characters", "videos") for x in u[k] if x.get("placeholder")]
            print(f"universe OK: {len(u['channels'])} channels, {len(u['characters'])} characters, "
                  f"{len(u['videos'])} videos")
            if ph:
                print(f"  {len(ph)} placeholder entries to rewrite: {', '.join(ph)}")
        elif a.action == "art":
            from . import thumbs
            only = set(a.only) if a.only else None
            made = thumbs.build_art(universe.load(), only=only, force=a.force)
            print(f"art: {len(made)} files written under universe/art/")
        elif a.action == "build":
            d = universe.build_site(a.out, pages=a.pages)
            live = sum(v["status"] == "live" for v in d["videos"])
            print(f"site -> {os.path.join(a.out, 'index.html')}  ({len(d['videos'])} videos, {live} playable)")
        else:
            copied = universe.publish(a.build, a.out)
            print("published: " + (", ".join(copied) if copied else "nothing (no rendered mp4s in " + a.build + ")"))
    except universe.UniverseError as e:
        print("Universe errors:\n  " + "\n  ".join(e.errors), file=sys.stderr)
        raise SystemExit(1)


def main(argv=None):
    ap = argparse.ArgumentParser(prog="engine")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("validate", help="check episodes, print estimated runtime")
    p.add_argument("episodes", nargs="+")
    p.add_argument("--gate", action="store_true", help="fail if runtime is not ~10 min")
    p.add_argument("--tolerance", type=float, default=TOLERANCE, help="gate tolerance (estimates are rough: CI uses 0.12)")
    p.set_defaults(fn=cmd_validate)

    p = sub.add_parser("plan", help="TTS + timing + audio mix + overlay + shard matrix")
    p.add_argument("episode")
    p.add_argument("--out", default="build")
    p.add_argument("--estimate", action="store_true", help="skip TTS (estimate speech length)")
    p.add_argument("--gate", action="store_true")
    p.set_defaults(fn=cmd_plan)

    p = sub.add_parser("render", help="render one shard with Blender")
    p.add_argument("plan")
    p.add_argument("shard")
    p.add_argument("--out", required=True)
    p.add_argument("--preview", action="store_true")
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--at", type=int, default=None, help="start at this scene-local frame")
    p.set_defaults(fn=cmd_render)

    p = sub.add_parser("assemble", help="concat shards + overlay + audio -> mp4")
    p.add_argument("plan")
    p.add_argument("shards")
    p.add_argument("--out", required=True)
    p.set_defaults(fn=cmd_assemble)

    p = sub.add_parser("build", help="plan + render + assemble locally")
    p.add_argument("episode")
    p.add_argument("--out", default="build")
    p.add_argument("--preview", action="store_true", help="half-res render")
    p.add_argument("--estimate", action="store_true")
    p.add_argument("--only", nargs="*", help="render only these shard ids (no assemble)")
    p.add_argument("--limit", type=int, default=0, help="only first N frames of each shard")
    p.set_defaults(fn=cmd_build)

    p = sub.add_parser("universe", help="the shared universe + fake video site (universe/universe.yaml)")
    p.add_argument("action", choices=["check", "art", "build", "publish"])
    p.add_argument("--only", nargs="*", help="art: only these video/character/channel ids")
    p.add_argument("--force", action="store_true", help="art: re-render even if the file exists")
    p.add_argument("--pages", action="store_true", help="build: emit a complete HTML page for GitHub Pages (use with --out docs)")
    p.add_argument("--out", default=universe.SITE_DIR, help="site directory (default: site/)")
    p.add_argument("--build", default="build", help="where rendered mp4s are (publish)")
    p.set_defaults(fn=cmd_universe)

    a = ap.parse_args(argv)
    try:
        a.fn(a)
    except schema.EpisodeError as e:
        print("Episode errors:\n  " + "\n  ".join(e.errors), file=sys.stderr)
        raise SystemExit(1)
