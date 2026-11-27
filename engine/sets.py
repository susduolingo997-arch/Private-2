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
    "office": dict(
        bg="#101820",
        props=_room("#cfd8dc", "#607d8b") + [
            ("box", "desk", (4, 2.2, 0.45), (5.5, 1.8, 0.9), "#8a5a2b"),
            ("box", "monitor", (2.6, 2.6, 1.4), (1.5, 0.12, 0.95), "#1e1e1e"),
            ("box", "window", (-3.5, 8.7, 3.6), (4.5, 0.1, 2.4), "#8fd3ff"),
            ("box", "clock", (-9, 8.7, 5.0), (1.3, 0.1, 1.3), "#ffffff"),
            ("box", "clock_hand", (-9, 8.6, 5.1), (0.08, 0.05, 0.5), "#000000"),
            ("cyl", "pot", (9.5, 5, 0.4), (0.9, 0.9, 0.8), "#a0522d"),
            ("sphere", "plant", (9.5, 5, 1.5), (1.6, 1.6, 1.6), "#2e8b57"),
            ("box", "door", (-12.7, 2, 1.6), (0.2, 1.8, 3.2), "#5b3a1a"),
            ("box", "poster", (7, 8.7, 4.2), (2.2, 0.1, 2.8), "#e8a33d"),
        ],
        marks=dict(center=(0, 0), front=(-3, -1), left=(-5, -1), right=(5, -1),
                   desk=(4, 4.2), door=(-11, 1), lobby=(-8, 2), plant=(9.5, 3),
                   far_left=(-10, -1), far_right=(10, -1)),
    ),
    "newsroom": dict(
        bg="#0b1226",
        props=_room("#16264a", "#2a3550", 30, 16) + [
            ("box", "desk", (0, 5, 0.55), (9, 1.8, 1.1), "#e9edf7"),
            ("box", "desk_trim", (0, 4.05, 0.55), (9.2, 0.1, 1.0), "#2b7de9"),
            ("box", "desk_top", (0, 5, 1.12), (9.4, 2.0, 0.08), "#10192e"),
            ("box", "wall_screen_l", (-7, 9.3, 4.2), (5.5, 0.15, 3.2), "#46b3ff"),
            ("box", "wall_screen_r", (7, 9.3, 4.2), (5.5, 0.15, 3.2), "#6a7bff"),
            ("box", "logo_plate", (0, 9.3, 4.4), (4.0, 0.15, 4.0), "#ffffff"),
            ("box", "logo_nine", (0, 9.1, 4.4), (2.4, 0.1, 3.0), "#2b7de9"),
            ("box", "ticker", (0, 9.2, 1.1), (30, 0.15, 0.8), "#d32f2f"),
            ("box", "weather_wall", (11, 8.4, 3.4), (7, 0.15, 4.4), "#27c24c"),
            ("box", "cam_a", (-7, -2, 1.0), (1.4, 1.8, 1.0), "#222222"),
            ("cyl", "cam_a_stand", (-7, -2, 0.4), (0.2, 0.2, 0.8), "#444444"),
            ("box", "coffee", (3.5, 4.6, 1.3), (0.35, 0.35, 0.45), "#ffffff"),
        ],
        marks=dict(center=(0, 0), desk=(0, 3.0), anchor_l=(-2.2, 3.0), anchor_r=(2.2, 3.0),
                   left=(-6, -1), right=(6, -1), front=(0, -4), weather=(11, 6.5), door=(-13, 1),
                   far_left=(-11, -1), far_right=(11, -1), cam=(-7, -3.5)),
    ),
    "ballroom": dict(
        bg="#1a0d1c",
        props=_room("#5a2750", "#8b6b4a", 34, 18) + [
            ("box", "stage", (0, 9, 0.45), (14, 3.4, 0.9), "#2a2a33"),
            ("box", "stage_banner", (0, 10.3, 5.4), (10, 0.2, 1.8), "#ff4fa3"),
            ("box", "banner_fruit", (0, 10.1, 5.4), (1.4, 0.15, 1.2), "#8e2de2"),
            ("box", "curtain_l", (-8.4, 10.3, 3.5), (2.2, 0.3, 7), "#7b1e5b"),
            ("box", "curtain_r", (8.4, 10.3, 3.5), (2.2, 0.3, 7), "#7b1e5b"),
            ("cyl", "table_a", (-8, 3.5, 0.45), (2.4, 2.4, 0.9), "#f7f3ee"),
            ("cyl", "table_b", (-3, 5.5, 0.45), (2.4, 2.4, 0.9), "#f7f3ee"),
            ("cyl", "table_c", (3, 5.5, 0.45), (2.4, 2.4, 0.9), "#f7f3ee"),
            ("cyl", "table_d", (8, 3.5, 0.45), (2.4, 2.4, 0.9), "#f7f3ee"),
            ("sphere", "centrepiece_a", (-8, 3.5, 1.15), (0.7, 0.7, 0.7), "#ffd23f"),
            ("sphere", "centrepiece_b", (3, 5.5, 1.15), (0.7, 0.7, 0.7), "#8e2de2"),
            ("box", "buffet", (13.8, 1, 0.6), (1.6, 7.0, 1.2), "#d9c7a3"),
            ("box", "dj", (-13.8, 1, 0.7), (1.8, 4.0, 1.4), "#111111"),
            ("sphere", "balloon_a", (-4, 8, 5.3), (1.0, 1.0, 1.3), "#ff4fa3"),
            ("sphere", "balloon_b", (4, 8, 5.7), (1.0, 1.0, 1.3), "#ffd23f"),
            ("sphere", "balloon_c", (0, 7, 6.2), (1.0, 1.0, 1.3), "#8e2de2"),
        ],
        marks=dict(center=(0, 0), stage=(0, 8.5), stage_l=(-4, 8.5), stage_r=(4, 8.5),
                   left=(-6, -1), right=(6, -1), front=(0, -4), door=(0, -6),
                   table_a=(-8, 1.8), table_b=(-3, 3.8), table_c=(3, 3.8), table_d=(8, 1.8),
                   buffet=(12, 1), dj=(-12, 1), far_left=(-12, -2), far_right=(12, -2)),
    ),
    "garden": dict(
        bg="#8fd3ff",
        props=[
            ("box", "lawn", (0, 8, -0.15), (80, 40, 0.3), "#4f9d4f"),
            ("box", "aisle", (0, 4, -0.05), (2.4, 14, 0.12), "#e9dcc3"),
            ("cyl", "arch_l", (-1.8, 11, 1.7), (0.2, 0.2, 3.4), "#ffffff"),
            ("cyl", "arch_r", (1.8, 11, 1.7), (0.2, 0.2, 3.4), "#ffffff"),
            ("box", "arch_top", (0, 11, 3.5), (4.2, 0.3, 0.3), "#ffffff"),
            ("sphere", "arch_fruit_a", (-1.8, 10.8, 3.2), (0.6, 0.6, 0.6), "#8e2de2"),
            ("sphere", "arch_fruit_b", (1.8, 10.8, 3.2), (0.6, 0.6, 0.6), "#ffd23f"),
            ("box", "chairs_l", (-3.6, 3, 0.45), (2.6, 9, 0.9), "#f1f1f1"),
            ("box", "chairs_r", (3.6, 3, 0.45), (2.6, 9, 0.9), "#f1f1f1"),
            ("box", "tent", (14, 8, 2.2), (8, 6, 4.4), "#fafafa"),
            ("box", "tent_roof", (14, 8, 4.7), (8.8, 6.8, 0.6), "#ff4fa3"),
            ("box", "bar", (12, 4.4, 0.6), (4, 1.0, 1.2), "#8a5a2b"),
            ("cyl", "tree_a_trunk", (-14, 12, 2.0), (0.8, 0.8, 4.0), "#6b431d"),
            ("sphere", "tree_a", (-14, 12, 5.2), (4.2, 4.2, 4.2), "#2e8b57"),
            ("cyl", "tree_b_trunk", (-22, 16, 2.0), (0.8, 0.8, 4.0), "#6b431d"),
            ("sphere", "tree_b", (-22, 16, 5.2), (4.6, 4.6, 4.6), "#3a9d5a"),
        ],
        marks=dict(center=(0, 0), altar=(0, 9.2), aisle_far=(0, 1), aisle_mid=(0, 5),
                   left=(-6, -1), right=(6, -1), front=(0, -4), tent=(14, 4), bar=(12, 3),
                   seat_l=(-3.6, 4), seat_r=(3.6, 4), far_left=(-14, 0), far_right=(14, 0)),
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


def is_char_cam(name):
    """Any character can be a camera target: cam: pam = close-up on Pam."""
    from . import cast
    return name not in ("wide", "two", "low", "top", "follow", "black") and cast.known(name)


def cam_preset(name):
    return CAMS.get(name) or CAMS["dave"]


def mark(set_name, name):
    return SETS[set_name]["marks"][name]
