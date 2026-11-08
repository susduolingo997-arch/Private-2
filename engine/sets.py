"""Sets (locations). Coordinates: x right, y away from the default camera, z up.

props: (shape, name, (x, y, z), (sx, sy, sz), colour)   shape: box | sphere | cyl
marks: named floor positions (x, y) that episodes can refer to.
"""

def _room(wall, floor, w=26, d=16):
    return [
        ("box", "floor", (0, 1, -0.1), (w, d, 0.2), floor),
        ("box", "back_wall", (0, d / 2 + 0.9, 3.5), (w, 0.3, 7), wall),
        ("box", "left_wall", (-w / 2, 1, 3.5), (0.3, d, 7), wall),
        ("box", "right_wall", (w / 2, 1, 3.5), (0.3, d, 7), wall),
    ]


SETS = {
    "apartment": dict(
        bg="#10131c",
        props=_room("#3b4a6b", "#7a6a58") + [
            ("box", "couch", (-6, 5, 0.5), (4.2, 1.8, 1.0), "#a23b4a"),
            ("box", "couch_back", (-6, 5.8, 1.2), (4.2, 0.4, 1.0), "#8d3341"),
            ("box", "tv", (-6, 8.6, 2.2), (3.2, 0.2, 1.8), "#111111"),
            ("box", "table", (3.5, 4.5, 0.55), (3.0, 1.6, 0.15), "#8a5a2b"),
            ("box", "table_leg_a", (2.2, 4.0, 0.25), (0.2, 0.2, 0.55), "#6b431d"),
            ("box", "table_leg_b", (4.8, 5.0, 0.25), (0.2, 0.2, 0.55), "#6b431d"),
            ("box", "laptop", (3.5, 4.5, 0.8), (0.9, 0.6, 0.12), "#c0c4cc"),
            ("box", "window", (0.5, 8.7, 3.6), (4.0, 0.1, 2.4), "#8fd3ff"),
            ("box", "door", (12.7, 2, 1.6), (0.2, 1.8, 3.2), "#5b3a1a"),
            ("box", "rent_notice", (-12.8, 3, 3.0), (0.1, 1.2, 1.6), "#fff3b0"),
        ],
        marks=dict(center=(0, 0), left=(-4, -1), right=(4, -1), couch=(-6, 3),
                   table=(3.5, 2.5), door=(11, 2), window=(0.5, 6), front=(0, -4),
                   far_left=(-10, -1), far_right=(10, -1)),
    ),
    "street": dict(
        bg="#6fb7ff",
        props=[
            ("box", "road", (0, -2, -0.1), (60, 6, 0.2), "#3c3f46"),
            ("box", "sidewalk", (0, 2.5, -0.05), (60, 5, 0.3), "#b4b4b4"),
            ("box", "grass", (0, 14, -0.12), (70, 16, 0.2), "#4f9d4f"),
            ("box", "shop", (7, 8, 3.5), (9, 6, 7), "#c94c4c"),
            ("box", "shop_door", (7, 4.95, 1.3), (1.6, 0.15, 2.6), "#222222"),
            ("box", "shop_sign", (7, 4.8, 5.6), (6.5, 0.2, 1.2), "#ffe14d"),
            ("box", "bld_a", (-10, 10, 5), (7, 6, 10), "#6d7aa8"),
            ("box", "bld_b", (-19, 10, 4), (7, 6, 8), "#a87a6d"),
            ("box", "bld_c", (18, 10, 6), (7, 6, 12), "#7aa88a"),
            ("cyl", "lamp", (-2, 4.5, 2.2), (0.15, 0.15, 4.4), "#333333"),
            ("box", "queue_sign", (-12, 1.0, 1.0), (0.2, 0.2, 2.0), "#e8e8e8"),
        ],
        marks=dict(center=(0, 0), queue_back=(-12, 0.5), queue_mid=(-4, 0.5),
                   queue_front=(4, 0.5), shop_door=(7, 3), inside=(7, 7),
                   left=(-6, -1), right=(6, -1), curb=(-9, -3), far_left=(-16, 0.5),
                   far_right=(16, 0.5), edge=(7, 27)),
    ),
    "bank": dict(
        bg="#101820",
        props=_room("#d9d2b8", "#5d6d7e") + [
            ("box", "counter", (3, 5, 0.6), (9, 1.4, 1.2), "#7b5b3a"),
            ("box", "glass", (3, 5, 2.0), (9, 0.1, 1.6), "#bfe9ff"),
            ("box", "atm", (-8, 7.5, 1.5), (2.0, 1.2, 3.0), "#2e3a4d"),
            ("box", "atm_screen", (-8, 6.85, 2.0), (1.4, 0.1, 1.0), "#37ff8b"),
            ("box", "vault", (10, 8.3, 2.5), (4.5, 0.4, 5.0), "#8a8f99"),
            ("cyl", "rope_a", (-3, 0, 0.5), (0.1, 0.1, 1.0), "#c9a227"),
            ("cyl", "rope_b", (-3, 3, 0.5), (0.1, 0.1, 1.0), "#c9a227"),
            ("box", "bank_sign", (0, 8.6, 5.6), (7, 0.2, 1.1), "#c9a227"),
        ],
        marks=dict(center=(0, 0), atm=(-8, 5), counter=(3, 3.2), left=(-5, -1),
                   right=(5, -1), door=(11, 0), front=(0, -4), mid=(-2, 2)),
    ),
    "void": dict(
        bg="#0a0a14",
        props=[("box", "void_floor", (0, 0, -0.2), (40, 40, 0.1), "#1c1c33"),
               ("box", "grid_a", (0, 0, -0.12), (40, 0.06, 0.05), "#3a3a6a"),
               ("box", "grid_b", (0, 0, -0.12), (0.06, 40, 0.05), "#3a3a6a")],
        marks=dict(center=(0, 0), left=(-4, 0), right=(4, 0), front=(0, -4),
                   far=(0, 10)),
    ),
    "black": dict(bg="#000000", props=[], marks=dict(center=(0, 0), left=(-4, 0),
                                                       right=(4, 0))),
}

# Camera presets: (offset from focus point, lens mm)
CAMS = {
    "wide": ((0.0, -17.0, 6.5), 28),
    "two": ((0.0, -9.0, 2.6), 35),
    "dave": ((1.2, -7.0, 1.6), 40),
    "kyle": ((-1.2, -7.2, 1.7), 40),
    "admin": ((0.0, -7.5, 0.6), 35),
    "low": ((0.0, -8.0, 0.2), 28),
    "top": ((0.0, -3.0, 16.0), 35),
    "follow": ((0.0, -10.0, 3.2), 32),
    "black": ((0.0, 0.0, 0.0), 35),
}
CHAR_CAMS = {"dave", "kyle", "admin"}


def mark(set_name, name):
    return SETS[set_name]["marks"][name]
