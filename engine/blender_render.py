"""Runs INSIDE Blender (headless).  Builds one scene of the plan and renders a frame range.

    blender -b --factory-startup -P engine/blender_render.py -- \
        --plan build/s01e01/plan.json --shard s02_c00 --out build/s01e01/shards [--preview]

The look is deliberately cheap and janky: low-poly people, Workbench renderer,
and every pose is held for STEP frames (8 poses per second at 24 fps), so walking
looks like a badly-recorded cutscene.  Mouths flap at random: lip-sync is not a thing here.
"""
import argparse
import bisect
import glob
import json
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from engine import cast as castmod  # noqa: E402
from engine import sets  # noqa: E402

STEP = 3
PI = math.pi
rnd = random.Random(1337)


# ------------------------------------------------------------------ basics
def lin(hexcol):
    h = hexcol.lstrip("#")
    return tuple((int(h[i:i + 2], 16) / 255.0) ** 2.2 for i in (0, 2, 4)) + (1.0,)


_mats, _meshes = {}, {}


def material(hexcol):
    if hexcol not in _mats:
        m = bpy.data.materials.new("m" + hexcol)
        m.diffuse_color = lin(hexcol)
        _mats[hexcol] = m
    return _mats[hexcol]


def shape_mesh(shape):
    if shape not in _meshes:
        bm = bmesh.new()
        if shape == "box":
            bmesh.ops.create_cube(bm, size=1.0)
        elif shape == "sphere":
            bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=0.5)
        elif shape == "cyl":
            bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=10,
                                  radius1=0.5, radius2=0.5, depth=1.0)
        elif shape == "gem":
            bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.5)
        me = bpy.data.meshes.new("shape_" + shape)
        bm.to_mesh(me)
        bm.free()
        me.materials.append(None)
        _meshes[shape] = me
    return _meshes[shape]


def prim(shape, name, loc, dim, color, parent=None):
    o = bpy.data.objects.new(name, shape_mesh(shape))
    o.material_slots[0].link = "OBJECT"
    o.material_slots[0].material = material(color)
    o.location = loc
    o.scale = dim
    if parent is not None:
        o.parent = parent
    bpy.context.scene.collection.objects.link(o)
    return o


def empty(name, loc=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, None)
    o.location = loc
    if parent is not None:
        o.parent = parent
    bpy.context.scene.collection.objects.link(o)
    return o


def key(obj, path, frame):
    obj.keyframe_insert(path, frame=frame)


def steps(a, b):
    fr = list(range(a, b, STEP))
    if not fr or fr[-1] != b:
        fr.append(b)
    return fr


# ------------------------------------------------------------------ actors
class Actor:
    def __init__(self, who):
        self.who = who
        c = castmod.get(who)
        self.base_h = c["height"]
        self.pos = Vector((0, 0, 0))
        self.rot = [0.0, 0.0, 0.0]
        self.scl = 1.0
        self.trace, self.tkeys = {}, []
        self.limbs = {}
        self.root = empty("root_" + who)
        floating = c.get("floating")
        if floating:
            self.head = empty("head", (0, 0, 2.6), self.root)
            prim("gem", "crystal", (0, 0, 0), (1.5, 1.5, 2.1), c["color"], self.head)
            prim("box", "slit", (0, -0.62, 0.1), (0.9, 0.08, 0.14), "#ffffff", self.head)
            self.mouth = prim("box", "pulse", (0, -0.7, -0.25), (0.5, 0.06, 0.1), "#ffcccc", self.head)
            return
        for side, sx in (("L", -1), ("R", 1)):
            leg = empty("leg" + side, (0.2 * sx, 0, 0.85), self.root)
            prim("box", "legbox", (0, 0, -0.425), (0.3, 0.3, 0.85), "#2d3142", leg)
            arm = empty("arm" + side, (0.55 * sx, 0, 1.68), self.root)
            prim("box", "armbox", (0, 0, -0.4), (0.22, 0.22, 0.8), c["color"], arm)
            self.limbs["leg" + side] = leg
            self.limbs["arm" + side] = arm
        prim("box", "torso", (0, 0, 1.3), (0.85, 0.45, 0.9), c["color"], self.root)
        self.head = empty("head", (0, 0, 2.0), self.root)
        prim("sphere", "skull", (0, 0, 0), (0.7, 0.66, 0.74), "#f1c9a5", self.head)
        prim("box", "hair", (0, 0.03, 0.3), (0.72, 0.7, 0.2), c["hair"], self.head)
        for sx in (-1, 1):
            prim("box", "eye", (0.14 * sx, -0.3, 0.08), (0.16, 0.05, 0.16), "#ffffff", self.head)
            prim("box", "pupil", (0.14 * sx, -0.335, 0.08), (0.07, 0.04, 0.09), "#000000", self.head)
        self.mouth = prim("box", "mouth", (0, -0.33, -0.14), (0.26, 0.05, 0.14), "#7a1f1f", self.head)

    # -- state
    def key_root(self, f, pos=None, rot=None, scl=None):
        if pos is not None:
            self.pos = Vector(pos)
            self.root.location = self.pos
            key(self.root, "location", f)
            if f not in self.trace:
                bisect.insort(self.tkeys, f)
            self.trace[f] = self.pos.copy()
        if rot is not None:
            self.rot = list(rot)
            self.root.rotation_euler = self.rot
            key(self.root, "rotation_euler", f)
        if scl is not None:
            self.scl = scl
        if scl is not None or pos is not None and f == 0:
            s = self.base_h * self.scl
            self.root.scale = (s, s, s)
            key(self.root, "scale", f)

    def part(self, name, f, rot=(0, 0, 0)):
        o = self.head if name == "head" else self.limbs.get(name)
        if o is None:
            return
        o.rotation_euler = rot
        key(o, "rotation_euler", f)

    def swing(self, f, s):
        self.part("armL", f, (s, 0, 0))
        self.part("armR", f, (-s, 0, 0))
        self.part("legL", f, (-s, 0, 0))
        self.part("legR", f, (s, 0, 0))

    def rest(self, f):
        for n in ("armL", "armR", "legL", "legR", "head"):
            self.part(n, f)

    def at(self, f):
        i = bisect.bisect_right(self.tkeys, f) - 1
        return self.trace[self.tkeys[i]].copy() if i >= 0 else self.pos.copy()

    def mouth_scale(self, f, factor):
        if self.mouth is not None:
            if not hasattr(self, "_mouth_base"):
                self._mouth_base = tuple(self.mouth.scale)
            b = self._mouth_base
            self.mouth.scale = (b[0], b[1], b[2] * factor)
            key(self.mouth, "scale", f)


# ------------------------------------------------------------------ acts
class Ctx:
    def __init__(self, set_name, actors, scene_start):
        self.set = set_name
        self.actors = actors
        self.g = scene_start
        self.flashes = 0

    def xy(self, to):
        if isinstance(to, (list, tuple)):
            return Vector((to[0], to[1], 0))
        x, y = sets.mark(self.set, to)
        return Vector((x, y, 0))


def heading(d):
    return math.atan2(d.x, -d.y)


def a_walk(A, f0, f1, tgt, run=False, noclip=False):
    p0 = A.pos.copy()
    p1 = Vector((tgt.x, tgt.y, 0.7 if noclip else 0.0))
    d = p1 - p0
    rz = heading(d) if (d.x ** 2 + d.y ** 2) > 0.05 else A.rot[2]
    A.key_root(f0, rot=(0, 0, rz))
    fr = steps(f0, f1)
    for i, f in enumerate(fr):
        u = (f - f0) / float(max(1, f1 - f0))
        last = f == f1
        p = p0.lerp(p1, u)
        if noclip:
            p.z += 0.06 * math.sin(i * 1.7)
        elif not last:
            p.z += (0.2 if run else 0.1) * abs(math.sin(i * PI / 2))
        A.key_root(f, pos=p)
        A.swing(f, 0 if last else (0.9 if run else 0.55) * (1 if i % 2 == 0 else -1))
    A.key_root(f1, pos=p1)


def a_fall(A, f0, f1):
    p0 = A.pos.copy()
    for i, f in enumerate(steps(f0, f1)):
        u = (f - f0) / float(max(1, f1 - f0))
        A.key_root(f, pos=(p0.x, p0.y, p0.z - 95 * u * u), rot=(u * 14, u * 9, A.rot[2]))
        s = 2.6 * (1 if i % 2 == 0 else -1)
        A.part("armL", f, (PI + s * 0.2, 0, 0))
        A.part("armR", f, (PI - s * 0.2, 0, 0))
        A.part("legL", f, (s * 0.3, 0, 0))
        A.part("legR", f, (-s * 0.3, 0, 0))


def a_tpose(A, f0, f1, hold=False):
    rz = A.rot[2]
    p = A.pos.copy()
    for i, f in enumerate(steps(f0, f1)):
        A.part("armL", f, (0, PI / 2, 0))
        A.part("armR", f, (0, -PI / 2, 0))
        A.key_root(f, pos=(p.x, p.y, p.z + (0.08 if i % 2 else 0.0)),
                   rot=(0, 0, rz + rnd.uniform(-0.12, 0.12)))
    A.key_root(f1, pos=p, rot=(0, 0, rz))
    if not hold:
        A.part("armL", f1 + 1)
        A.part("armR", f1 + 1)


def a_flop(A, f0, f1):
    p = A.pos.copy()
    for i, f in enumerate(steps(f0, f1)):
        A.key_root(f, pos=(p.x, p.y, 0.4 + (0.3 if f == f0 else 0)),
                   rot=(PI / 2 + rnd.uniform(-0.1, 0.1), 0, A.rot[2] + (0.4 if i % 2 else 0)))
        for n in ("armL", "armR", "legL", "legR"):
            A.part(n, f, (rnd.uniform(-1.2, 1.2), rnd.uniform(-0.8, 0.8), 0))
    A.key_root(f1, pos=(p.x, p.y, 0.4), rot=(PI / 2, 0, A.rot[2]))


def a_stand(A, f0, f1):
    A.key_root(f1, pos=(A.pos.x, A.pos.y, 0.0), rot=(0, 0, A.rot[2]))
    A.rest(f1)


def a_jump(A, f0, f1, height=1.6):
    p = A.pos.copy()
    for f in steps(f0, f1):
        u = (f - f0) / float(max(1, f1 - f0))
        A.key_root(f, pos=(p.x, p.y, p.z + height * 4 * u * (1 - u)))
        A.part("armL", f, (PI * 0.9 * (1 - u), 0, 0))
        A.part("armR", f, (PI * 0.9 * (1 - u), 0, 0))
    A.key_root(f1, pos=p)
    A.rest(f1)


def a_shake(A, f0, f1, amt=0.14):
    p, rz = A.pos.copy(), A.rot[2]
    for f in steps(f0, f1):
        A.key_root(f, pos=(p.x + rnd.uniform(-amt, amt), p.y, p.z + rnd.uniform(0, amt)),
                   rot=(0, 0, rz + rnd.uniform(-0.2, 0.2)))
    A.key_root(f1, pos=p, rot=(0, 0, rz))


def a_spin(A, f0, f1, n=2):
    rz = A.rot[2]
    for f in steps(f0, f1):
        u = (f - f0) / float(max(1, f1 - f0))
        A.key_root(f, rot=(0, 0, rz + 2 * PI * n * u))
    A.key_root(f1, rot=(0, 0, rz))


def a_scale(A, f0, f1, factor):
    s0 = A.scl
    for f in steps(f0, f1):
        u = (f - f0) / float(max(1, f1 - f0))
        A.key_root(f, scl=s0 + (factor - s0) * u)


def a_wave(A, f0, f1):
    for i, f in enumerate(steps(f0, f1)):
        A.part("armR", f, (0, -(2.5 + 0.3 * (1 if i % 2 else -1)), 0))
    A.part("armR", f1 + 1)


def a_launch(A, ctx, f0, f1, tgt):
    p0 = A.pos.copy()
    p1 = Vector((tgt.x, tgt.y, 0.4))
    for i, f in enumerate(steps(f0, f1)):
        u = (f - f0) / float(max(1, f1 - f0))
        p = p0.lerp(p1, u)
        p.z = 0.4 + 5.0 * 4 * u * (1 - u)
        A.key_root(f, pos=p, rot=(u * 4 * PI + PI / 2 * u, 0, A.rot[2]))
        for n in ("armL", "armR", "legL", "legR"):
            A.part(n, f, (rnd.uniform(-2, 2), rnd.uniform(-1, 1), 0))
    A.key_root(f1, pos=p1, rot=(PI / 2, 0, A.rot[2]))


def flash(ctx, at, f):
    ctx.flashes += 1
    o = prim("gem", f"flash{ctx.flashes}", (at.x, at.y, 1.2), (0.1, 0.1, 0.1), "#ffffff")
    o.hide_render = True
    key(o, "hide_render", 0)
    o.hide_render = False
    key(o, "hide_render", f)
    for i, s in enumerate((2.0, 4.0, 3.0, 1.0)):
        o.scale = (s, s, s * 1.4)
        key(o, "scale", f + i * 2)
    o.hide_render = True
    key(o, "hide_render", f + 8)


ITEMS = {
    "pizza": ("box", (1.0, 1.0, 0.12), "#e9b44c"),
    "coin": ("cyl", (0.6, 0.6, 0.08), "#ffd700"),
    "cash": ("box", (0.9, 0.5, 0.03), "#5bbf6a"),
    "cube": ("box", (0.8, 0.8, 0.8), "#ff00ff"),
    "sneaker": ("box", (0.9, 0.4, 0.4), "#f5f5f5"),
}


def a_spawn(A, ctx, f0, f1, act):
    shape, dim, col = ITEMS[act.get("item", "pizza")]
    n = min(int(act.get("n", 1)), 600)
    if "to" in act:
        c = ctx.xy(act["to"])
    else:
        c = Vector((A.pos.x, A.pos.y - 1.4, 0))
    spread = float(act.get("spread", 0.0 if n == 1 else 3.0))
    window = max(1, int((f1 - f0) * 0.85))
    for i in range(n):
        fi = f0 + int(i * window / max(1, n))
        x = c.x + rnd.gauss(0, spread / 2)
        y = c.y + rnd.gauss(0, spread / 2)
        rest = 0.07 + 0.13 * rnd.randint(0, 5 if n > 6 else 0)
        o = prim(shape, f"item{i}", (x, y, 9), dim, col)
        o.rotation_euler = (0, 0, rnd.uniform(0, PI))
        o.hide_render = True
        key(o, "hide_render", 0)
        o.hide_render = False
        key(o, "hide_render", fi)
        for dz, df in ((9, 0), (4, STEP), (rest, 2 * STEP)):
            o.location = (x, y, dz)
            key(o, "location", fi + df)


def a_vehicle(A, ctx, f0, f1, act):
    y = A.pos.y
    bus = prim("box", "bus", (-26, y, 1.6), (7, 2.6, 3.0), "#f2c200")
    prim("box", "bus_windows", (0, -1.31, 0.6), (6.2, 0.05, 0.9), "#bfe9ff", bus)
    bus.hide_render = True
    key(bus, "hide_render", 0)
    bus.hide_render = False
    key(bus, "hide_render", f0)
    for f in steps(f0, f1):
        u = (f - f0) / float(max(1, f1 - f0))
        bus.location = (-26 + 52 * u, y, 1.6)
        key(bus, "location", f)
    bus.hide_render = True
    key(bus, "hide_render", f1 + 1)


def run_act(ctx, act, bf0, bf1, fps):
    A = ctx.actors[act["who"]]
    verb = act["do"]
    f0 = min(bf1 - 1, bf0 + int(round(float(act.get("delay", 0)) * fps)))
    f1 = bf1 if "dur" not in act else f0 + max(1, int(round(float(act["dur"]) * fps)))
    f1 = max(f0 + 1, min(bf1, f1))
    tgt = ctx.xy(act["to"]) if "to" in act else None
    if verb == "walk_to":
        a_walk(A, f0, f1, tgt)
    elif verb == "run_to":
        a_walk(A, f0, f1, tgt, run=True)
    elif verb == "noclip_to":
        a_walk(A, f0, f1, tgt, noclip=True)
    elif verb == "fall":
        a_fall(A, f0, f1)
    elif verb == "tpose":
        a_tpose(A, f0, f1, hold=bool(act.get("hold")))
    elif verb == "flop":
        a_flop(A, f0, f1)
    elif verb == "stand":
        a_stand(A, f0, f1)
    elif verb == "jump":
        a_jump(A, f0, f1)
    elif verb == "shake":
        a_shake(A, f0, f1, float(act.get("amt", 0.14)))
    elif verb == "spin":
        a_spin(A, f0, f1, float(act.get("n", 2)))
    elif verb == "grow":
        a_scale(A, f0, f1, float(act.get("by", 2.0)))
    elif verb == "shrink":
        a_scale(A, f0, f1, float(act.get("by", 0.5)))
    elif verb == "wave":
        a_wave(A, f0, f1)
    elif verb == "launch":
        a_launch(A, ctx, f0, f1, tgt if tgt is not None else Vector((A.pos.x + 9, A.pos.y, 0)))
    elif verb == "teleport":
        flash(ctx, A.pos, f0)
        A.key_root(f0, pos=(tgt.x, tgt.y, 0))
        flash(ctx, tgt, f0)
    elif verb == "face":
        if "at" in act and act["at"] in ctx.actors:
            d = ctx.actors[act["at"]].at(f0) - A.pos
        else:
            d = (tgt - A.pos) if tgt is not None else Vector((0, -1, 0))
        A.key_root(f0, rot=(0, 0, heading(d)))
    elif verb == "appear":
        A.key_root(f0, scl=1.0)
    elif verb == "vanish":
        A.key_root(f0, scl=0.0001)
    elif verb == "spawn":
        a_spawn(A, ctx, f0, f1, act)
    elif verb == "vehicle":
        a_vehicle(A, ctx, f0, f1, act)
    # idle: nothing to key


def talk(A, f0, f1):
    for f in steps(f0, f1 - 2):
        A.mouth_scale(f, rnd.choice([0.3, 0.7, 1.0, 1.5]))
        A.part("head", f, (rnd.uniform(-0.1, 0.1), 0, rnd.uniform(-0.12, 0.12)))
    A.mouth_scale(f1, 0.4)
    A.part("head", f1)


# ------------------------------------------------------------------ camera
class Cam:
    def __init__(self, scene):
        data = bpy.data.cameras.new("cam")
        self.obj = bpy.data.objects.new("cam", data)
        scene.collection.objects.link(self.obj)
        scene.camera = self.obj
        self.target = empty("cam_target")
        c = self.obj.constraints.new("TRACK_TO")
        c.target = self.target
        c.track_axis = "TRACK_NEGATIVE_Z"
        c.up_axis = "UP_Y"
        self.data = data

    def shoot(self, f, loc, tgt, lens):
        self.obj.location = loc
        self.target.location = tgt
        self.data.lens = lens
        key(self.obj, "location", f)
        key(self.target, "location", f)
        key(self.data, "lens", f)


def mean(vs):
    out = Vector((0, 0, 0))
    for v in vs:
        out += v
    return out / max(1, len(vs))


def pick_cam(beat, ctx, prev):
    c = beat.get("cam")
    if not c:
        if beat["kind"] == "say" and beat["say"] in ctx.actors:
            c = beat["say"]
        elif beat["kind"] in ("loading", "card"):
            c = "black"
        else:
            c = prev or "wide"
    if sets.is_char_cam(c) and c not in ctx.actors:
        c = "two" if "dave" in ctx.actors else "wide"
    if beat["kind"] in ("loading", "card"):
        c = "black"
    return c


def follow_who(beat, ctx):
    if beat.get("follow") in ctx.actors:
        return beat["follow"]
    for a in beat.get("acts") or []:
        if a["who"] in ctx.actors:
            return a["who"]
    return "dave" if "dave" in ctx.actors else next(iter(ctx.actors))


def frame_camera(cam, beat, ctx, preset, fps):
    f0, f1 = beat["f0"], beat["f1"]
    if beat.get("shot"):  # explicit camera (used for thumbnails): {loc: [x,y,z], look: [x,y,z], lens}
        sh = beat["shot"]
        cam.shoot(f0, tuple(sh["loc"]), tuple(sh["look"]), sh.get("lens", 35))
        return
    off, lens = sets.cam_preset(preset)
    if preset == "black":
        cam.shoot(f0, (0, 0, -300), (0, 10, -300), lens)
        return
    shake = bool(beat.get("shake") or beat.get("lag"))
    dynamic = sets.is_char_cam(preset) or preset in ("two", "follow")

    def focus(f):
        if sets.is_char_cam(preset):
            return ctx.actors[preset].at(f) + Vector((0, 0, 1.5))
        if preset == "follow":
            return ctx.actors[follow_who(beat, ctx)].at(f) + Vector((0, 0, 1.3))
        pool = [a for k, a in ctx.actors.items() if k in ("dave", "kyle")] or list(ctx.actors.values())
        if preset == "two":
            return mean([a.at(f) for a in pool]) + Vector((0, 0, 1.2))
        # wide / top / low: halfway between the action and the middle of the set
        pts = [a.at(f0) for a in ctx.actors.values()]
        pts = [p for p in pts if p.z > -5] or [Vector((0, 0, 0))]  # ignore anyone who fell out of the world
        return mean(pts) * 0.5 + Vector((0, 2.0, 1.2))

    frames = steps(f0, f1 - 1) if (dynamic or shake) else [f0]
    for f in frames:
        t = focus(f)
        loc = t + Vector(off)
        if shake:
            j = Vector((rnd.uniform(-.25, .25), rnd.uniform(-.1, .1), rnd.uniform(-.2, .2)))
            loc, t = loc + j, t + j * 0.5
        cam.shoot(f, loc, t, lens)


# ------------------------------------------------------------------ scene
def build(plan, scene_idx, preview):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.edit.keyframe_new_interpolation_type = "CONSTANT"
    scene = bpy.context.scene
    fps = plan["fps"]
    sc = plan["scenes"][scene_idx]
    s = sets.SETS[sc["set"]]

    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.fps = fps
    scene.render.resolution_x, scene.render.resolution_y = plan["resolution"]
    scene.render.resolution_percentage = 50 if preview else 100
    scene.view_settings.view_transform = "Standard"
    sh = scene.display.shading
    sh.light = "STUDIO"
    sh.color_type = "MATERIAL"
    sh.show_object_outline = True
    sh.object_outline_color = (0, 0, 0)
    sh.show_cavity = False
    scene.display.render_aa = "FXAA"
    world = bpy.data.worlds.new("W")
    world.color = lin(sc.get("bg") or s["bg"])[:3]
    scene.world = world

    for shape, name, loc, dim, col in s["props"]:
        prim(shape, name, loc, dim, col)
    prim("box", "blackbox", (0, 0, -300), (60, 60, 60), "#000000")

    actors = {}
    for who, at in sc["cast"].items():
        face = 0.0
        if isinstance(at, dict):
            face, at = math.radians(float(at.get("face", 0))), at["at"]
        x, y = (at if isinstance(at, (list, tuple)) else sets.mark(sc["set"], at))
        A = Actor(who)
        A.key_root(0, pos=(x, y, 0), rot=(0, 0, face), scl=0.0001 if who == "admin" else 1.0)
        A.rest(0)
        actors[who] = A
    ctx = Ctx(sc["set"], actors, sc["g0"])

    cam = Cam(scene)
    prev = None
    for beat in sc["beats"]:
        f0, f1 = beat["f0"], beat["f1"]
        for act in beat.get("acts") or []:
            run_act(ctx, act, f0, f1, fps)
        if beat["kind"] == "say" and beat["say"] in actors:
            talk(actors[beat["say"]], f0, f1)
        prev = pick_cam(beat, ctx, prev)
        frame_camera(cam, beat, ctx, prev, fps)
    return scene


def render(scene, plan, shard, out_dir):
    scene.frame_start, scene.frame_end = shard["start"], shard["end"]
    os.makedirs(out_dir, exist_ok=True)
    r = scene.render
    r.image_settings.file_format = "FFMPEG"
    r.ffmpeg.format = "MPEG4"
    r.ffmpeg.codec = "H264"
    r.ffmpeg.constant_rate_factor = "MEDIUM"
    r.ffmpeg.ffmpeg_preset = "REALTIME"
    r.ffmpeg.gopsize = 12
    prefix = os.path.join(out_dir, shard["id"] + "_")
    r.filepath = prefix
    for old in glob.glob(prefix + "*.mp4") + [os.path.join(out_dir, shard["id"] + ".mp4")]:
        if os.path.exists(old):
            os.remove(old)
    bpy.ops.render.render(animation=True)
    made = sorted(glob.glob(prefix + "*.mp4"))
    if not made:
        raise SystemExit("render produced no file (is OpenGL / Mesa available?)")
    os.replace(made[-1], os.path.join(out_dir, shard["id"] + ".mp4"))


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--plan", required=True)
    ap.add_argument("--shard", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--limit", type=int, default=0, help="render only the first N frames")
    ap.add_argument("--at", type=int, default=None, help="start at this scene-local frame")
    a = ap.parse_args(argv)
    with open(a.plan) as f:
        plan = json.load(f)
    shard = next(s for s in plan["shards"] if s["id"] == a.shard)
    if a.at is not None:
        shard = dict(shard, start=a.at, end=a.at + max(a.limit, 1) - 1)
    elif a.limit:
        shard = dict(shard, end=min(shard["end"], shard["start"] + a.limit - 1))
    scene = build(plan, shard["scene"], a.preview)
    render(scene, plan, shard, a.out)


main()
