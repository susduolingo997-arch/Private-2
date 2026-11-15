import cairo, math, sys, subprocess, random
W, H = 1920, 1080
FPS = 24
DUR = 85.632
BEAT, B0 = 0.5573, 0.23
OUT = '#2b1d33'

def hx(c, a=1.0):
    c = c.lstrip('#'); c = ''.join(ch*2 for ch in c) if len(c) == 3 else c; return (int(c[0:2],16)/255, int(c[2:4],16)/255, int(c[4:6],16)/255, a)
def cl(x, a=0, b=1): return max(a, min(b, x))
def ease(x): x = cl(x); return x*x*(3-2*x)
def eob(x):  # ease out back
    x = cl(x); c = 1.9; return 1 + (c+1)*(x-1)**3 + c*(x-1)**2
def lerp(a, b, t): return a + (b-a)*t
def beatpulse(T): ph = ((T-B0)/BEAT) % 1; return math.exp(-ph*6)
def bounce(T): return abs(math.sin(math.pi*(T-B0)/BEAT))

def col(ctx, c, a=1.0):
    ctx.set_source_rgba(*hx(c, a))
def fs(ctx, c, lw=6, oc=OUT):
    col(ctx, c); ctx.fill_preserve(); col(ctx, oc); ctx.set_line_width(lw); ctx.stroke()
def rrect(ctx, x, y, w, h, r):
    r = min(r, w/2, h/2)
    ctx.new_sub_path()
    ctx.arc(x+w-r, y+r, r, -math.pi/2, 0); ctx.arc(x+w-r, y+h-r, r, 0, math.pi/2)
    ctx.arc(x+r, y+h-r, r, math.pi/2, math.pi); ctx.arc(x+r, y+r, r, math.pi, 1.5*math.pi)
    ctx.close_path()
def ell(ctx, x, y, rx, ry):
    ctx.save(); ctx.translate(x, y); ctx.scale(rx, ry); ctx.arc(0, 0, 1, 0, 2*math.pi); ctx.restore()
def line(ctx, x1, y1, x2, y2, w, c, cap=cairo.LINE_CAP_ROUND):
    ctx.set_line_cap(cap); ctx.set_line_width(w); col(ctx, c); ctx.move_to(x1, y1); ctx.line_to(x2, y2); ctx.stroke()
def text(ctx, s, x, y, size, fill='#ffffff', oc=OUT, lw=None, face='Inter', anchor='c', rot=0):
    ctx.save(); ctx.select_font_face(face, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
    ctx.set_font_size(size); e = ctx.text_extents(s)
    ctx.translate(x, y); ctx.rotate(rot)
    dx = -e.width/2 - e.x_bearing if anchor == 'c' else (-e.x_bearing if anchor == 'l' else -e.width - e.x_bearing)
    ctx.move_to(dx, -e.height/2 - e.y_bearing); ctx.text_path(s)
    ctx.set_line_join(cairo.LINE_JOIN_ROUND)
    if oc: col(ctx, oc); ctx.set_line_width(lw or size*0.16); ctx.stroke_preserve()
    col(ctx, fill); ctx.fill(); ctx.restore()

# ---------------------------------------------------------------- characters
CH = {
 'margaret': dict(k=0.95, top='#7d4cc0', top2='#5e3596', low='#6b3f7a', skin='#f7c9a8', hair='#d3d3de', hair2='#a9a9b8', shoe='#5a2e45'),
 'peter':    dict(k=1.12, top='#3f78d8', top2='#2c58a8', low='#c9a46a', skin='#f2bf98', hair='#6b4224', hair2='#4a2d18', shoe='#3a2a20'),
 'linda':    dict(k=1.05, top='#3fae55', top2='#2d8440', low='#2f3f73', skin='#f5c6a3', hair='#b5502a', hair2='#8a3a1c', shoe='#4b2330'),
 'max':      dict(k=0.98, top='#ff8a1f', top2='#d9680a', low='#3a5d9c', skin='#eebc95', hair='#2e2a2a', hair2='#141212', shoe='#e8e8e8'),
}

def arm_end(side, a, L=105):
    sx = 52*side; sy = -238
    r = math.radians(a)
    return sx, sy, sx + side*math.sin(r)*L, sy + math.cos(r)*L

def prop(ctx, kind, x, y, s=1.0, rot=0, T=0):
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(rot)
    if kind == 'book': rulebook(ctx, 0, 0, 0.75)
    elif kind == 'bigbook': rulebook(ctx, 0, 0, 1.25)
    elif kind == 'remote':
        rrect(ctx, -14, -45, 28, 90, 10); fs(ctx, '#333344', 5)
        for i in range(3): ell(ctx, 0, -25+i*20, 6, 6); col(ctx, ['#ff4d4d','#4dd17a','#4da6ff'][i]); ctx.fill()
    elif kind == 'cookie':
        ell(ctx, 0, 0, 30, 30); fs(ctx, '#d99a4e', 5)
        for dx, dy in ((-10,-8),(9,-3),(-3,11),(12,12)): ell(ctx, dx, dy, 5, 5); col(ctx, '#5a3214'); ctx.fill()
    elif kind == 'mug':
        rrect(ctx, -28, -34, 56, 64, 10); fs(ctx, '#ffffff', 5)
        ctx.arc(30, -2, 15, -math.pi/2, math.pi/2); col(ctx, OUT); ctx.set_line_width(7); ctx.stroke()
        ell(ctx, 0, -10, 9, 9); col(ctx, '#ff6b8b'); ctx.fill()
        for i in range(2):
            ctx.move_to(-10+i*18, -44)
            ctx.curve_to(-20+i*18, -60 - 5*math.sin(T*6+i), 0+i*18, -70, -10+i*18, -88)
            col(ctx, '#ffffff', 0.7); ctx.set_line_width(5); ctx.stroke()
    elif kind == 'magnifier':
        line(ctx, 0, 0, -40, -60, 16, OUT); line(ctx, 0, 0, -40, -60, 9, '#8a5a2b')
        ell(ctx, -62, -94, 40, 40); col(ctx, '#bfe6ff', 0.55); ctx.fill_preserve(); col(ctx, OUT); ctx.set_line_width(9); ctx.stroke()
        ctx.arc(-70, -104, 20, math.pi*1.1, math.pi*1.5); col(ctx, '#ffffff', 0.9); ctx.set_line_width(6); ctx.stroke()
    elif kind == 'notebook':
        rrect(ctx, -55, -70, 110, 140, 8); fs(ctx, '#fff6dc', 5)
        for i in range(5): line(ctx, -40, -40+i*22, 40, -40+i*22, 3, '#9bb7e0')
    elif kind == 'pen':
        line(ctx, 0, 0, 30, -60, 12, OUT); line(ctx, 0, 0, 30, -60, 6, '#3a6be0')
    elif kind == 'plant':
        rrect(ctx, -45, -10, 90, 70, 12); fs(ctx, '#c4683a', 5)
        for i in range(7):
            a = -math.pi/2 + (i-3)*0.38
            ctx.save(); ctx.translate(0, -10); ctx.rotate(a+math.pi/2)
            ell(ctx, 0, -70, 22, 70); fs(ctx, '#3fa34d', 4); ctx.restore()
    elif kind == 'tea':
        ell(ctx, 0, 22, 48, 10); fs(ctx, '#ffffff', 4)
        ctx.move_to(-32, -20); ctx.line_to(32, -20); ctx.line_to(24, 18); ctx.line_to(-24, 18); ctx.close_path(); fs(ctx, '#fff', 5)
        line(ctx, -26, -6, 26, -6, 6, '#f29fc0')
    ctx.restore()

def char(ctx, who, x, y, s=1.0, flip=False, armL=12, armR=12, mouth='smile', eyes='open',
         look=0, lookY=0, brow=0, lean=0, walk=None, hold=None, holdL=None, T=0, squash=1.0,
         tired=False, hood=False, blush=True, shake=0, legs=True, sweat=False):
    d = CH[who]; k = d['k']
    ctx.save(); ctx.translate(x + shake*math.sin(T*90), y)
    ctx.scale(s*(-1 if flip else 1), s); ctx.rotate(math.radians(lean))
    ctx.scale(1/squash**0.5, squash)
    ctx.set_line_join(cairo.LINE_JOIN_ROUND)
    # shadow
    ell(ctx, 0, 4, 85, 14); col(ctx, '#000000', 0.18); ctx.fill()
    ctx.scale(1, k)
    # legs
    ph = walk if walk is not None else 0
    amp = 0.55 if walk is not None else 0
    if legs:
        for side in (-1, 1):
            a = side*math.sin(ph)*amp
            hx_, hy = 22*side, -112
            fx, fy = hx_ + math.sin(a)*110, hy + math.cos(a)*110
            line(ctx, hx_, hy, fx, fy, 40, OUT); line(ctx, hx_, hy, fx, fy, 29, d['low'] if who != 'margaret' else '#e8c0a0')
            ell(ctx, fx + 12*side*0.3 + 10, fy, 30, 16); fs(ctx, d['shoe'], 5)
    # back arm
    def draw_arm(side, a):
        sx, sy, ex, ey = arm_end(side, a)
        line(ctx, sx, sy, ex, ey, 40, OUT); line(ctx, sx, sy, ex, ey, 29, d['top2'] if side < 0 else d['top'])
        ell(ctx, ex, ey, 18, 18); fs(ctx, d['skin'], 5)
        return ex, ey
    hl = draw_arm(-1, armL)
    # torso
    ctx.move_to(-62, -258); ctx.curve_to(-70, -180, -72, -130, -68, -100)
    ctx.line_to(68, -100); ctx.curve_to(72, -130, 70, -180, 62, -258)
    ctx.curve_to(30, -276, -30, -276, -62, -258); ctx.close_path()
    if who == 'margaret':
        ctx.restore() if False else None
    fs(ctx, d['top'])
    if who == 'margaret':  # skirt + cardigan buttons
        ctx.move_to(-66, -130); ctx.line_to(66, -130); ctx.line_to(80, -60); ctx.line_to(-80, -60); ctx.close_path(); fs(ctx, d['low'])
        line(ctx, 0, -262, 0, -132, 4, d['top2'])
        for i in range(4): ell(ctx, 12, -240+i*30, 6, 6); fs(ctx, '#ffd84d', 3)
        ctx.move_to(-30, -268); ctx.line_to(0, -225); ctx.line_to(30, -268); col(ctx, '#ffffff'); ctx.set_line_width(8); ctx.stroke()
    elif who == 'peter':
        for i in range(3): line(ctx, -55, -150-i*30, 55, -150-i*30, 5, d['top2'])
        ctx.move_to(-22, -268); ctx.line_to(0, -246); ctx.line_to(22, -268); col(ctx, '#ffffff'); ctx.set_line_width(7); ctx.stroke()
    elif who == 'linda':
        ctx.arc(0, -262, 26, 0, math.pi); col(ctx, d['top2']); ctx.set_line_width(8); ctx.stroke()
        for i in range(3): ell(ctx, -30+i*30, -180, 7, 7); col(ctx, '#bff0c8'); ctx.fill()
    elif who == 'max':
        rrect(ctx, -40, -170, 80, 40, 12); col(ctx, d['top2']); ctx.set_line_width(5); ctx.stroke()
        line(ctx, -14, -262, -18, -205, 4, '#ffffff'); line(ctx, 14, -262, 18, -205, 4, '#ffffff')
    # head group
    hy = -330
    if who == 'max':  # hood behind head
        ell(ctx, 0, hy+40, 92, 60); fs(ctx, d['top2'])
    if who == 'linda':  # bob back hair
        rrect(ctx, -92, hy-70, 184, 150, 60); fs(ctx, d['hair'])
    if who == 'margaret':
        ell(ctx, 0, hy-82, 36, 30); fs(ctx, d['hair'])
    ell(ctx, -70, hy+4, 14, 18); fs(ctx, d['skin'], 5); ell(ctx, 70, hy+4, 14, 18); fs(ctx, d['skin'], 5)
    ell(ctx, 0, hy, 72, 76); fs(ctx, d['skin'])
    # hair front
    if who == 'margaret':
        ctx.move_to(-74, hy+5); ctx.curve_to(-80, hy-90, 80, hy-90, 74, hy+5)
        ctx.curve_to(60, hy-40, 20, hy-52, 0, hy-40); ctx.curve_to(-20, hy-52, -60, hy-40, -74, hy+5); fs(ctx, d['hair'])
        for i in range(-2, 3): ctx.arc(i*24, hy-52, 12, math.pi, 2*math.pi); col(ctx, d['hair2']); ctx.set_line_width(3); ctx.stroke()
    elif who == 'peter':
        rnd = random.Random(3)
        ctx.move_to(-76, hy+5)
        pts = [(-76, hy-30), (-70, hy-85), (-40, hy-70), (-30, hy-110), (-5, hy-78), (15, hy-115), (30, hy-80), (60, hy-100), (60, hy-60), (88, hy-58), (74, hy+5)]
        for (px, py) in pts: ctx.line_to(px, py)
        ctx.curve_to(50, hy-30, 0, hy-45, -40, hy-30); ctx.close_path(); fs(ctx, d['hair'])
    elif who == 'linda':
        ctx.move_to(-80, hy+30); ctx.curve_to(-90, hy-100, 90, hy-100, 80, hy+30)
        ctx.curve_to(60, hy-20, 10, hy-55, -10, hy-50); ctx.curve_to(-40, hy-40, -70, hy-10, -80, hy+30); fs(ctx, d['hair'])
        if tired:
            for i in range(4):
                ctx.move_to(-40+i*25, hy-75); ctx.curve_to(-55+i*25, hy-110, -20+i*25, hy-105, -35+i*28, hy-130)
                col(ctx, d['hair2']); ctx.set_line_width(5); ctx.stroke()
    elif who == 'max':
        if hood:
            ell(ctx, 0, hy-10, 88, 92); col(ctx, d['top'], 1); ctx.fill()
            ell(ctx, 0, hy+8, 62, 66); fs(ctx, d['skin'])
        ctx.move_to(-74, hy-5); ctx.curve_to(-80, hy-95, 70, hy-100, 76, hy-10)
        ctx.curve_to(40, hy-60, 10, hy-40, -20, hy-30); ctx.curve_to(-45, hy-28, -60, hy-15, -74, hy-5); fs(ctx, d['hair'])
    # face
    ey = hy - 8
    for side in (-1, 1):
        ex = 27*side
        if eyes == 'closed':
            ctx.arc(ex, ey+4, 13, math.pi*1.1, math.pi*1.9); col(ctx, OUT); ctx.set_line_width(6); ctx.stroke()
        elif eyes == 'happy':
            ctx.arc(ex, ey+10, 13, math.pi*1.1, math.pi*1.9); col(ctx, OUT); ctx.set_line_width(6); ctx.stroke()
        else:
            r = 22 if eyes == 'wide' else 17
            ell(ctx, ex, ey, r*0.85, r); fs(ctx, '#ffffff', 4)
            pr = 5 if eyes == 'wide' else 8
            ell(ctx, ex + look*7, ey + lookY*6 + 2, pr, pr); col(ctx, OUT); ctx.fill()
            ell(ctx, ex + look*7 + 2.5, ey + lookY*6 - 1, 2.5, 2.5); col(ctx, '#ffffff'); ctx.fill()
            if eyes == 'tired' or tired:
                ctx.save(); ell(ctx, ex, ey, r*0.85+3, r+3); ctx.clip()
                ctx.rectangle(ex-30, ey-40, 60, 38); col(ctx, d['skin']); ctx.fill(); ctx.restore()
                line(ctx, ex-14, ey-2, ex+14, ey-2, 5, OUT)
                ctx.arc(ex, ey+14, 12, 0.2, math.pi-0.2); col(ctx, '#9a6fb0', 0.8); ctx.set_line_width(4); ctx.stroke()
        # brows (brow: -1 angry, +1 worried/raised)
        bx = ex; by = ey - 30 - (8 if eyes == 'wide' else 0) - max(0, brow)*6
        tilt = -brow*8*side if brow >= 0 else brow*10*side*-1
        ctx.move_to(bx - 14, by + (tilt if side > 0 else -tilt)*0.5 + (6*side if brow < 0 else 0))
        ctx.line_to(bx + 14, by - (tilt if side > 0 else -tilt)*0.5 - (6*side if brow < 0 else 0))
        col(ctx, d['hair2'] if who != 'margaret' else '#8c8c99'); ctx.set_line_width(7); ctx.stroke()
    if who == 'margaret':  # glasses
        for side in (-1, 1):
            ell(ctx, 27*side, ey, 25, 23); col(ctx, '#c9e8ff', 0.25); ctx.fill_preserve(); col(ctx, '#7a2f8f'); ctx.set_line_width(6); ctx.stroke()
        line(ctx, -3, ey-2, 3, ey-2, 5, '#7a2f8f')
        line(ctx, -52, ey-4, -70, ey-8, 5, '#7a2f8f'); line(ctx, 52, ey-4, 70, ey-8, 5, '#7a2f8f')
    ell(ctx, 3, hy+18, 9, 7); col(ctx, '#e09a7a'); ctx.fill()
    if blush:
        ell(ctx, -44, hy+28, 13, 8); col(ctx, '#ff7f8f', 0.35); ctx.fill(); ell(ctx, 44, hy+28, 13, 8); ctx.fill()
    my = hy + 44
    ctx.set_line_width(6); col(ctx, OUT)
    if mouth == 'smile':
        ctx.arc(0, my-14, 22, 0.25*math.pi, 0.75*math.pi); ctx.stroke()
    elif mouth == 'grin':
        ctx.move_to(-28, my-6); ctx.curve_to(-20, my+24, 20, my+24, 28, my-6); ctx.close_path(); fs(ctx, '#ffffff', 5)
    elif mouth == 'smirk':
        ctx.move_to(-18, my+2); ctx.curve_to(0, my+8, 14, my+4, 24, my-8); ctx.stroke()
    elif mouth == 'flat':
        ctx.move_to(-16, my+2); ctx.line_to(16, my+2); ctx.stroke()
    elif mouth == 'frown':
        ctx.arc(0, my+16, 18, 1.2*math.pi, 1.8*math.pi); ctx.stroke()
    elif mouth == 'o':
        ell(ctx, 0, my+2, 10, 12); fs(ctx, '#7a2a35', 5)
    elif mouth == 'shock':
        ell(ctx, 0, my+8, 22, 30); fs(ctx, '#7a2a35', 5)
        ell(ctx, 0, my+26, 12, 8); col(ctx, '#ff7f8f'); ctx.fill()
    elif mouth == 'yawn':
        ell(ctx, 0, my+6, 18, 22); fs(ctx, '#7a2a35', 5)
    elif mouth == 'cookie':
        ctx.arc(0, my-10, 20, 0.25*math.pi, 0.75*math.pi); ctx.stroke(); prop(ctx, 'cookie', 0, my+12, 0.8)
    if sweat:
        ctx.move_to(78, hy-40); ctx.curve_to(70, hy-20, 74, hy-6, 84, hy-6); ctx.curve_to(94, hy-6, 96, hy-24, 78, hy-40)
        fs(ctx, '#9fdcff', 4)
    # front arm
    hr = draw_arm(1, armR)
    for kind, hp in ((holdL, hl), (hold, hr)):
        if kind:
            ctx.save(); ctx.translate(*hp)
            if flip: ctx.scale(-1, 1)
            prop(ctx, kind, 0, 0, 1.0, T=T); ctx.restore()
    ctx.restore()

def rulebook(ctx, x, y, s=1.0, glow=0):
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s)
    if glow > 0:
        g = cairo.RadialGradient(0, 0, 20, 0, 0, 260); g.add_color_stop_rgba(0, 1, 0.9, 0.4, 0.8*glow); g.add_color_stop_rgba(1, 1, 0.9, 0.4, 0)
        ctx.set_source(g); ctx.arc(0, 0, 260, 0, 2*math.pi); ctx.fill()
    rrect(ctx, -95, -125, 190, 250, 14); fs(ctx, '#d6283b', 7)
    rrect(ctx, -95, -125, 34, 250, 10); fs(ctx, '#a51a2c', 5)
    rrect(ctx, 82, -115, 14, 232, 4); fs(ctx, '#fff6dc', 4)
    rrect(ctx, -50, -80, 125, 160, 10); col(ctx, '#ffd84d'); ctx.set_line_width(5); ctx.stroke()
    text(ctx, 'RULES', 12, -20, 34, '#ffd84d', '#7a1020', 6)
    text(ctx, 'VOL. 1', 12, 30, 20, '#ffd84d', None)
    ctx.restore()

# ---------------------------------------------------------------- backgrounds
def sky(ctx, top='#6ec6ff', bot='#d9f2ff'):
    g = cairo.LinearGradient(0, 0, 0, H); g.add_color_stop_rgba(0, *hx(top)); g.add_color_stop_rgba(1, *hx(bot))
    ctx.set_source(g); ctx.rectangle(-4000, -4000, 10000, 10000); ctx.fill()

def cloud(ctx, x, y, s):
    for dx, dy, r in ((0, 0, 50), (50, -20, 60), (110, 0, 48), (55, 15, 50)):
        ell(ctx, x+dx*s, y+dy*s, r*s, r*s*0.85); col(ctx, '#ffffff'); ctx.fill()

def tree(ctx, x, y, s, T):
    sw = math.sin(T*2 + x)*4
    rrect(ctx, x-18*s, y-120*s, 36*s, 120*s, 8); fs(ctx, '#8a5a2b', 5)
    for dx, dy, r in ((0, -190, 90), (-60, -140, 65), (60, -140, 65)):
        ell(ctx, x+(dx+sw)*s, y+dy*s, r*s, r*s); fs(ctx, '#4cb35a', 6)

def exterior(ctx, T, door_open=0, gr=None):
    sky(ctx)
    ell(ctx, 1650, 170, 80, 80); col(ctx, '#ffe066'); ctx.fill()
    for i in range(12):
        a = i*math.pi/6 + T*0.3
        line(ctx, 1650+math.cos(a)*105, 170+math.sin(a)*105, 1650+math.cos(a)*135, 170+math.sin(a)*135, 10, '#ffe066')
    for i, (cx, cy, s) in enumerate(((200, 150, 1.0), (700, 110, 0.8), (1250, 200, 0.9), (-200, 230, 0.7))):
        cloud(ctx, (cx + T*25*(1+i*0.2)) % 2400 - 250, cy, s)
    ctx.move_to(-2000, 700); ctx.curve_to(300, 560, 700, 640, 1000, 640); ctx.curve_to(1400, 640, 1700, 540, 4000, 680)
    ctx.line_to(4000, 3000); ctx.line_to(-2000, 3000); ctx.close_path(); col(ctx, '#8fd16a'); ctx.fill()
    ctx.rectangle(-2000, 880, 6000, 3000); col(ctx, '#6cc24a'); ctx.fill()
    tree(ctx, 330, 900, 1.3, T); tree(ctx, 1600, 900, 1.2, T)
    # house
    ctx.rectangle(560, 470, 800, 430); fs(ctx, '#ffd36b', 8)
    for i in range(9): line(ctx, 560, 500+i*45, 1360, 500+i*45, 3, '#f2bb4a')
    ctx.move_to(510, 480); ctx.line_to(960, 190); ctx.line_to(1410, 480); ctx.close_path(); fs(ctx, '#e8524a', 8)
    ctx.rectangle(1150, 230, 70, 140); fs(ctx, '#b5523a', 6)
    for i in range(3):
        ell(ctx, 1185 + 20*math.sin(T*1.5+i), 200 - i*45 - (T*30 % 45), 22+i*6, 18+i*5); col(ctx, '#ffffff', 0.7 - i*0.2); ctx.fill()
    ell(ctx, 960, 360, 50, 50); fs(ctx, '#bfe6ff', 6); line(ctx, 910, 360, 1010, 360, 5, OUT); line(ctx, 960, 310, 960, 410, 5, OUT)
    for wx in (640, 1140):
        rrect(ctx, wx, 560, 140, 140, 6); fs(ctx, '#bfe6ff', 7)
        line(ctx, wx+70, 560, wx+70, 700, 6, OUT); line(ctx, wx, 630, wx+140, 630, 6, OUT)
        ctx.move_to(wx+4, 564); ctx.curve_to(wx+40, 600, wx+20, 660, wx+4, 696); ctx.close_path(); col(ctx, '#ff8fb1'); ctx.fill()
        ctx.move_to(wx+136, 564); ctx.curve_to(wx+100, 600, wx+120, 660, wx+136, 696); ctx.close_path(); ctx.fill()
        rrect(ctx, wx-10, 700, 160, 30, 6); fs(ctx, '#8a5a2b', 6)
        for f in range(5): ell(ctx, wx+10+f*30, 695, 12, 12); fs(ctx, ['#ff5d73', '#ffd84d', '#c77dff', '#ff9f43', '#ff5d73'][f], 4)
    # path & door
    ctx.move_to(900, 900); ctx.line_to(1020, 900); ctx.line_to(1150, 1100); ctx.line_to(770, 1100); ctx.close_path(); fs(ctx, '#d9c3a0', 6)
    ctx.rectangle(890, 660, 140, 240); fs(ctx, '#ffb547', 7)  # door interior glow
    if gr: gr()
    ow = 120*math.cos(door_open*math.pi*0.45)
    ctx.rectangle(900, 670, ow, 230); fs(ctx, '#3f78d8', 6)
    if ow > 20:
        ell(ctx, 900 + ow*0.85, 790, 7, 7); fs(ctx, '#ffd84d', 3)
        rrect(ctx, 900+ow*0.2, 690, ow*0.6, 60, 6); col(ctx, OUT); ctx.set_line_width(4); ctx.stroke()
    ctx.move_to(870, 665); ctx.arc(960, 665, 90, math.pi, 2*math.pi); col(ctx, OUT); ctx.set_line_width(8); ctx.stroke()
    # fence
    for i in range(-14, 30):
        fx = i*70
        if 760 < fx < 1160: continue
        ctx.move_to(fx, 1000); ctx.line_to(fx, 900); ctx.line_to(fx+22, 880); ctx.line_to(fx+44, 900); ctx.line_to(fx+44, 1000); ctx.close_path(); fs(ctx, '#ffffff', 5)
    for fl in range(0, 1920, 90):
        if 760 < fl < 1160: continue
        ell(ctx, fl+30, 1040 + 6*math.sin(T*3+fl), 14, 14); fs(ctx, ['#ff5d73', '#ffd84d', '#c77dff'][(fl//90) % 3], 4)

def living(ctx, T, dark=0, night=False):
    ctx.rectangle(-4000, -4000, 10000, 10000); col(ctx, '#ffe3b8'); ctx.fill()
    for i in range(-10, 40): ctx.rectangle(i*80, -400, 30, 1250); col(ctx, '#ffd59c'); ctx.fill()
    # window
    rrect(ctx, 760, 150, 400, 330, 10); fs(ctx, '#1d2a5c' if night else '#9fdcff', 10)
    if not night:
        cloud(ctx, 820 + (T*20 % 300), 260, 0.6)
    else:
        ell(ctx, 1080, 240, 40, 40); col(ctx, '#fff4c2'); ctx.fill()
        for sx, sy in ((830, 210), (900, 330), (980, 190), (1100, 380)): ell(ctx, sx, sy, 5, 5); ctx.fill()
    line(ctx, 960, 150, 960, 480, 8, OUT); line(ctx, 760, 315, 1160, 315, 8, OUT)
    for side in (-1, 1):
        x0 = 960 + side*230
        ctx.move_to(x0, 130); ctx.curve_to(x0 - side*60, 300, x0 - side*20, 450, x0 - side*70, 520); ctx.line_to(x0 + side*20, 520); ctx.line_to(x0 + side*20, 130); ctx.close_path(); fs(ctx, '#c77dff', 6)
    line(ctx, 700, 130, 1220, 130, 12, '#8a5a2b')
    # frames
    rrect(ctx, 300, 220, 160, 200, 8); fs(ctx, '#ffd84d', 8); rrect(ctx, 320, 240, 120, 160, 6); fs(ctx, '#ffeedd', 4)
    ell(ctx, 380, 300, 30, 32); fs(ctx, '#f7c9a8', 4); ell(ctx, 380, 266, 18, 14); fs(ctx, '#d3d3de', 3)
    ell(ctx, 368, 300, 8, 8); ell(ctx, 392, 300, 8, 8); col(ctx, '#7a2f8f'); ctx.set_line_width(3); ctx.stroke()
    rrect(ctx, 1450, 250, 180, 130, 8); fs(ctx, '#ff8fb1', 8); rrect(ctx, 1468, 268, 144, 94, 4); fs(ctx, '#bff0c8', 4)
    ctx.move_to(1470, 360); ctx.line_to(1520, 300); ctx.line_to(1560, 340); ctx.line_to(1590, 310); ctx.line_to(1610, 360); col(ctx, '#3fa34d'); ctx.fill()
    # floor
    ctx.rectangle(-4000, 820, 10000, 4000); col(ctx, '#c88a52'); ctx.fill()
    for i in range(-20, 50): line(ctx, i*120, 820, i*120 - 300, 1400, 3, '#a96f3c')
    ctx.rectangle(-4000, 800, 10000, 26); fs(ctx, '#ffffff', 5)
    ell(ctx, 960, 960, 600, 90); fs(ctx, '#ff8a6b', 6); ell(ctx, 960, 960, 480, 65); col(ctx, '#ffb48f'); ctx.fill()
    # lamp
    line(ctx, 1720, 840, 1720, 520, 10, OUT); ell(ctx, 1720, 845, 50, 12); fs(ctx, '#8a5a2b', 5)
    ctx.move_to(1650, 520); ctx.line_to(1790, 520); ctx.line_to(1760, 420); ctx.line_to(1680, 420); ctx.close_path(); fs(ctx, '#ffd84d', 6)
    if dark > 0:
        ctx.rectangle(-4000, -4000, 10000, 10000); col(ctx, '#0b0a2a', dark*0.75); ctx.fill()

def couch(ctx, x, y, s=1.0):
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s)
    rrect(ctx, -260, -230, 520, 160, 40); fs(ctx, '#e8524a', 7)
    rrect(ctx, -280, -110, 560, 110, 30); fs(ctx, '#ff6b5e', 7)
    rrect(ctx, -320, -170, 80, 170, 30); fs(ctx, '#e8524a', 7); rrect(ctx, 240, -170, 80, 170, 30); fs(ctx, '#e8524a', 7)
    line(ctx, 0, -100, 0, -10, 5, '#c43c35')
    ctx.restore()

def tv(ctx, x, y, s, T, on=True):
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s)
    rrect(ctx, -60, -10, 120, 70, 6); fs(ctx, '#8a5a2b', 6)
    rrect(ctx, -150, -200, 300, 190, 16); fs(ctx, '#333344', 7)
    if on:
        g = ((T*7) % 1) > 0.5
        rrect(ctx, -130, -182, 260, 154, 8); col(ctx, '#7ff0ff' if g else '#9cffb0'); ctx.fill()
        ell(ctx, -40, -100, 30, 30); col(ctx, '#ffffff', 0.8); ctx.fill()
        ctx.move_to(-130, -60); ctx.line_to(-40, -110); ctx.line_to(30, -70); ctx.line_to(130, -130); ctx.line_to(130, -28); ctx.line_to(-130, -28); col(ctx, '#3fa34d'); ctx.fill()
        ell(ctx, 40 + 40*math.sin(T*5), -140, 12, 12); col(ctx, '#ffffff'); ctx.fill()
    else:
        rrect(ctx, -130, -182, 260, 154, 8); col(ctx, '#222233'); ctx.fill()
    line(ctx, -40, -200, -80, -260, 5, OUT); line(ctx, 40, -200, 80, -260, 5, OUT)
    ctx.restore()

def kitchen(ctx, T):
    ctx.rectangle(-4000, -4000, 10000, 10000); col(ctx, '#e8f6ff'); ctx.fill()
    for i in range(-10, 40):
        for j in range(-5, 12):
            ctx.rectangle(i*70+2, j*70+2, 66, 66); col(ctx, '#d2ecff' if (i+j) % 2 else '#e8f6ff'); ctx.fill()
    rrect(ctx, 1500, 160, 300, 700, 30); fs(ctx, '#ffffff', 8); line(ctx, 1500, 420, 1800, 420, 6, OUT)
    line(ctx, 1530, 260, 1530, 360, 10, '#99aaaa'); line(ctx, 1530, 480, 1530, 600, 10, '#99aaaa')
    for i, c in enumerate(('#ff5d73', '#ffd84d', '#4da6ff')): ell(ctx, 1600+i*60, 250, 18, 18); fs(ctx, c, 4)
    ctx.rectangle(150, 200, 500, 160); fs(ctx, '#ffb547', 7)
    for i in range(3): rrect(ctx, 170+i*160, 215, 140, 130, 8); col(ctx, OUT); ctx.set_line_width(5); ctx.stroke()
    ctx.rectangle(-4000, 860, 10000, 4000); col(ctx, '#f0d0a0'); ctx.fill()
    for i in range(-20, 50):
        for j in range(4): ctx.rectangle(i*100 + (j % 2)*50, 860+j*60, 96, 56); col(ctx, '#e8c48e' if (i+j) % 2 else '#f0d0a0'); ctx.fill()

def counter(ctx, x0, x1, y):
    ctx.rectangle(x0, y, x1-x0, 1080-y+200); fs(ctx, '#4da6ff', 8)
    rrect(ctx, x0-20, y-30, x1-x0+40, 40, 10); fs(ctx, '#ffffff', 7)
    for i in range(int((x1-x0)//200)):
        rrect(ctx, x0+20+i*200, y+40, 170, 160, 10); col(ctx, OUT); ctx.set_line_width(5); ctx.stroke()
        ell(ctx, x0+105+i*200, y+60, 20, 6); col(ctx, OUT); ctx.fill()

def cookiejar(ctx, x, y, lid=0, T=0):
    rrect(ctx, x-80, y-150, 160, 150, 40); col(ctx, '#bfe6ff', 0.75); ctx.fill_preserve(); col(ctx, OUT); ctx.set_line_width(7); ctx.stroke()
    for i in range(5): prop(ctx, 'cookie', x-40+(i % 3)*40, y-40-(i//3)*45, 0.9)
    text(ctx, 'COOKIES', x, y-100, 26, '#ff5d73', OUT, 6)
    ctx.save(); ctx.translate(x+lid*60, y-155-lid*90); ctx.rotate(lid*0.6)
    rrect(ctx, -90, -18, 180, 30, 12); fs(ctx, '#ff5d73', 6); ell(ctx, 0, -26, 18, 14); fs(ctx, '#ff5d73', 5)
    ctx.restore()

def chalkboard(ctx, x, y, s, n_lines, T, partial=1.0):
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s)
    rrect(ctx, -440, -300, 880, 560, 20); fs(ctx, '#a0642e', 10)
    rrect(ctx, -410, -270, 820, 500, 10); col(ctx, '#2f5d3a'); ctx.fill()
    text(ctx, "GRANDMA'S RULES", 0, -215, 54, '#ffd84d', None)
    rules = ['1. NO TV AFTER 8', '2. NO COOKIES!', '3. BED BY 9 SHARP', '4. NO RUNNING', '5. GRANDMA IS ALWAYS RIGHT']
    for i in range(min(n_lines, 5)):
        sline = rules[i]
        if i == n_lines - 1: sline = sline[:max(1, int(len(sline)*partial))]
        text(ctx, sline, -370, -130 + i*72, 46, '#ffffff', None, anchor='l')
    for i in range(4):
        ell(ctx, -330+i*40, 250, 16, 6); col(ctx, ['#ffffff', '#ff8fb1', '#9fdcff', '#ffd84d'][i]); ctx.fill()
    ctx.restore()

def hallway(ctx, T, scroll=0):
    ctx.rectangle(-4000, -4000, 10000, 10000); col(ctx, '#c9e6c0'); ctx.fill()
    for i in range(-10, 40):
        x = (i*420 + scroll) % 4200 - 1000
        rrect(ctx, x, 260, 220, 540, 10); fs(ctx, ['#ff8a6b', '#4da6ff', '#c77dff', '#ffd84d'][i % 4], 8)
        ell(ctx, x+190, 540, 10, 10); fs(ctx, '#ffd84d', 4)
        rrect(ctx, x+290, 330, 80, 100, 6); fs(ctx, '#ffffff', 6)
    ctx.rectangle(-4000, 800, 10000, 4000); col(ctx, '#a96f3c'); ctx.fill()
    ctx.rectangle(-4000, 880, 10000, 120); col(ctx, '#e8524a'); ctx.fill()
    for i in range(-5, 40): ctx.rectangle((i*120 + scroll) % 4800 - 600, 930, 60, 20); col(ctx, '#ffd84d'); ctx.fill()

def burst(ctx, T, c1, c2, cx=W/2, cy=H/2):
    ctx.rectangle(0, 0, W, H); col(ctx, c1); ctx.fill()
    n = 18
    for i in range(n):
        a0 = i*2*math.pi/n + T*0.4; a1 = a0 + math.pi/n
        ctx.move_to(cx, cy); ctx.line_to(cx + math.cos(a0)*3000, cy + math.sin(a0)*3000); ctx.line_to(cx + math.cos(a1)*3000, cy + math.sin(a1)*3000); ctx.close_path()
        col(ctx, c2); ctx.fill()
    for i in range(0, W+60, 60):
        for j in range(0, H+60, 60):
            r = 4 + 4*((i+j) % 120 == 0)
            ell(ctx, i, j, r, r); col(ctx, '#ffffff', 0.15); ctx.fill()

def speedlines(ctx, T, cx=W/2, cy=H/2, a=0.6):
    rnd = random.Random(int(T*12))
    for i in range(40):
        ang = rnd.random()*2*math.pi; r0 = 450 + rnd.random()*200
        ctx.move_to(cx+math.cos(ang)*r0, cy+math.sin(ang)*r0)
        ctx.line_to(cx+math.cos(ang+0.02)*1400, cy+math.sin(ang+0.02)*1400); ctx.line_to(cx+math.cos(ang-0.02)*1400, cy+math.sin(ang-0.02)*1400)
        ctx.close_path(); col(ctx, '#ffffff', a); ctx.fill()

def hlines(ctx, T, a=0.7):
    rnd = random.Random(int(T*12))
    for i in range(18):
        y = rnd.random()*H; x = rnd.random()*W; l = 200 + rnd.random()*500
        line(ctx, x, y, x+l, y, 6 + rnd.random()*8, '#ffffff')

def namecard(ctx, name, u, color):
    s = eob(u/0.35)
    ctx.save(); ctx.translate(W*0.5, 900); ctx.rotate(-0.06); ctx.scale(s, s)
    rrect(ctx, -380, -90, 760, 180, 26); col(ctx, OUT); ctx.fill()
    rrect(ctx, -370, -100, 760, 180, 26); fs(ctx, color, 10)
    text(ctx, name, 10, -10, 120, '#ffffff', OUT, 22, face='Inter Display')
    ctx.restore()

def bang(ctx, x, y, s, c='#ffd84d', txt='!'):
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s)
    ctx.move_to(100, 0)
    for i in range(1, 25):
        a = i*math.pi/12; r = 100 if i % 2 == 0 else 60
        ctx.line_to(math.cos(a)*r, math.sin(a)*r)
    ctx.close_path(); fs(ctx, c, 7)
    text(ctx, txt, 0, 0, 70 if len(txt) < 3 else 34, '#ff3355', OUT, 10)
    ctx.restore()

def feathers(ctx, T, n=25, seed=1):
    rnd = random.Random(seed)
    for i in range(n):
        x = rnd.random()*W; ph = rnd.random()*10
        y = (rnd.random()*H + T*60*(0.5+rnd.random())) % (H+100) - 50
        ctx.save(); ctx.translate(x + 30*math.sin(T*2+ph), y); ctx.rotate(math.sin(T*3+ph))
        ell(ctx, 0, 0, 20, 8); fs(ctx, '#ffffff', 3); ctx.restore()

# ---------------------------------------------------------------- camera
def cam(ctx, z, cx, cy, rot=0):
    ctx.translate(W/2, H/2); ctx.scale(z, z); ctx.rotate(rot); ctx.translate(-cx, -cy)

def walkph(T, speed=9): return T*speed

# ---------------------------------------------------------------- scenes
def sc_exterior(ctx, T):
    u = ease((T-0.6)/5.0)
    z = lerp(1.0, 3.6, u**1.6); cy = lerp(560, 760, u)
    cam(ctx, z, 960, cy)
    do = ease((T-4.0)/1.0)
    def gr():
        if do > 0.05:
            up = ease((T-5.0)/0.6)
            char(ctx, 'margaret', 960, 900, 0.47, armR=lerp(15, 150, up), armL=20, hold='book', mouth='smirk' if up < 0.5 else 'grin', brow=-1, T=T)
    exterior(ctx, T, do, gr)

def sc_inspect(ctx, T):
    u = T - 5.9
    if u < 4.6:
        gx = lerp(250, 1500, ease(u/4.4))
        cam(ctx, 1.45, cl(gx, 660, 1260), 640)
        living(ctx, T); couch(ctx, 1340, 860, 0.9)
        stop = 1.6 < u < 2.5
        char(ctx, 'margaret', gx, 900, 0.95, walk=None if stop else walkph(T), armR=lerp(30, 70, 0.5+0.5*math.sin(T*3)) if not stop else 100,
             armL=15, hold='magnifier', mouth='flat', brow=-1, look=1, lookY=-0.3 if stop else 0, T=T)
        if stop:
            ctx.save(); ctx.translate(gx+150, 520); rnd = random.Random(int(T*10))
            for i in range(6): ell(ctx, rnd.random()*80, rnd.random()*80, 6, 6); col(ctx, '#bbbbbb', 0.8); ctx.fill()
            ctx.restore()
    else:
        v = u - 4.6
        cam(ctx, lerp(2.0, 2.5, v/2.6), 1450, 560)
        living(ctx, T); couch(ctx, 1340, 860, 0.9)
        wig = math.sin(T*28)*8
        char(ctx, 'margaret', 1450, 900, 0.95, armR=95+wig, armL=60, hold='pen', holdL='notebook', mouth='smirk', brow=-1, lookY=0.8, T=T)
        if (T*1.5) % 1 < 0.15:
            ctx.save(); ctx.translate(1430, 560); ctx.rotate(T)
            for a in range(4): ctx.rotate(math.pi/2); line(ctx, 0, 0, 0, 22, 5, '#ffffff')
            ctx.restore()

def sc_verse_b(ctx, T):
    u = T - 13.1; i = int(u // 1.85); v = u - i*1.85
    if i == 0:  # dad hiding in kitchen, secretly watching TV
        cam(ctx, 1.15 + v*0.04, 960, 560); kitchen(ctx, T)
        tv(ctx, 520, 620, 0.9, T)
        bob = math.sin(T*6)*10
        char(ctx, 'peter', 1150, 950 + bob, 1.0, mouth='grin', look=-1.2, eyes='open', brow=1, T=T, armL=40, armR=40)
        counter(ctx, 750, 1700, 690)
        ell(ctx, 830, 760, 200, 400); col(ctx, '#7ff0ff', 0.10); ctx.fill()
    elif i == 1:  # max stealing cookies
        cam(ctx, 1.25, 960, 560); kitchen(ctx, T)
        lid = ease(v/0.5)
        reach = 140 + 15*math.sin(T*10)
        char(ctx, 'max', 1180, 1000, 1.0, armR=reach, armL=20, hold='cookie' if v > 0.9 else None, mouth='grin', look=1 if v % 0.6 < 0.3 else -1, brow=-1, lean=-8, T=T)
        counter(ctx, 300, 1800, 760)
        cookiejar(ctx, 980, 740, lid, T)
        if v > 0.9: prop(ctx, 'cookie', 1300 + (v-0.9)*300, 600 - (v-0.9)*400, 0.8, rot=T*6)
    elif i == 2:  # mum exhausted
        cam(ctx, 1.4, 1100, 600); living(ctx, T)
        couch(ctx, 1100, 900, 1.0)
        sl = math.sin(T*2)*3
        char(ctx, 'linda', 1100, 860, 0.95, armR=lerp(60, 160, (v*3) % 1), armL=50, hold='mug' if False else None, holdL='mug', mouth='flat', eyes='tired', tired=True, lean=-10+sl, T=T, legs=False)
        n = 47 + int(v*3.5)
        text(ctx, f'{n}...', 1300 + 20*math.sin(T*3), 380 - v*40, 64, '#ffffff', OUT, 10)
        for k in range(3):
            ctx.arc(1000 + k*40, 350 - ((T*40 + k*30) % 80), 14, 0, 2*math.pi); col(ctx, '#ffffff', 0.6); ctx.set_line_width(4); ctx.stroke()
    else:  # grandma setting up the place
        cam(ctx, 1.1, 960, 560); living(ctx, T)
        bx = lerp(1500, 900, ease(v/1.2))
        chalkboard(ctx, bx, 520, 0.8, 0, T)
        char(ctx, 'margaret', bx + 420, 900, 0.95, armL=100, armR=95, mouth='grin', brow=-1, walk=walkph(T) if v < 1.2 else None, flip=True, T=T, lean=-8 if v < 1.2 else 0)

def sc_rules(ctx, T):
    u = T - 20.5
    if u < 2.9:
        cam(ctx, lerp(1.1, 1.35, u/2.9), 900, 540); living(ctx, T)
        nl = 1 + int(u / 0.58); part = (u % 0.58)/0.45
        chalkboard(ctx, 820, 500, 0.9, nl, T, cl(part))
        wig = math.sin(T*30)*10
        char(ctx, 'margaret', 1330, 920, 0.95, flip=True, armR=150+wig, armL=20, hold='pen', mouth='smirk', brow=-1, look=1, T=T)
    elif u < 4.8:
        v = u - 2.9
        cam(ctx, 1.6, 1000, 640); living(ctx, T); couch(ctx, 1000, 920, 1.0)
        tv(ctx, 260, 880, 0.9, T)
        hid = ease((v-0.6)/0.4)
        char(ctx, 'peter', 1000, 860, 1.0, armR=lerp(70, 150, hid) if v < 1.0 else 20, armL=30, hold='remote' if v < 0.9 else None, legs=False,
             mouth='grin' if v < 0.5 else 'o', look=-1 if v < 0.5 else 1, lookY=-0.6 if v > 1 else 0, brow=1, sweat=v > 1.0, T=T)
        if 0.6 < v < 1.0:
            prop(ctx, 'remote', lerp(1130, 1180, (v-0.6)/0.4), lerp(700, 800, (v-0.6)/0.4), 1.0, rot=1.5)
        if v > 1.0:
            for k in range(3): text(ctx, '♪', 1150 + k*50, 420 - k*30 - (v-1)*40, 40, '#ffffff', OUT, 6)
    else:
        v = u - 4.8
        cam(ctx, 1.3, 960, 560); living(ctx, T)
        chalkboard(ctx, 520, 500, 0.75, 5, T)
        caught = v > 1.0
        mx = lerp(1700, 1250, ease(v/1.0)) if not caught else 1250 - 8*math.sin(T*60)*(v < 1.3)
        char(ctx, 'margaret', 900, 920, 0.95, flip=not caught, armR=160 if not caught else 100, armL=20, hold='pen', look=-1 if not caught else 1,
             mouth='smirk' if caught else 'flat', brow=-1, T=T)
        hop = abs(math.sin(T*8))*25 if not caught else 0
        char(ctx, 'max', mx, 920 - hop, 0.95, flip=True, walk=walkph(T, 8) if not caught else None, armL=60 if not caught else 160, armR=60 if not caught else 160,
             mouth='grin' if not caught else 'shock', eyes='open' if not caught else 'wide', look=-1, brow=-1 if not caught else 1, lean=10 if not caught else 0, T=T)
        if caught:
            bang(ctx, mx+40, 420, eob((v-1.0)/0.25)*1.1, txt='CAUGHT!')
            hx_ = lerp(1010, 1160, ease((v-1.0)/0.2))
            line(ctx, 980, 680, hx_, 640, 40, OUT); line(ctx, 980, 680, hx_, 640, 29, CH['margaret']['top'])
            ell(ctx, hx_, 640, 18, 18); fs(ctx, CH['margaret']['skin'], 5)

def sc_escape(ctx, T):
    u = T - 27.2; seg = 7.0/6; i = min(5, int(u // seg)); v = u - i*seg
    if i == 0:
        cam(ctx, 1.5, 960, 700); living(ctx, T)
        x = lerp(300, 1500, v/seg)
        char(ctx, 'peter', x, 930, 0.9, lean=-80, armL=170 + 30*math.sin(T*18), armR=170 - 30*math.sin(T*18), mouth='flat', brow=1, look=1, T=T, legs=True, walk=walkph(T, 18))
        hlines(ctx, T)
    elif i == 1:
        cam(ctx, 1.6, 960, 400); living(ctx, T, night=False)
        up = ease(v/0.8)
        char(ctx, 'max', 960, lerp(900, 560, up), 0.85, armL=170, armR=170, mouth='grin', brow=-1, look=1, lean=lerp(0, 25, up), walk=walkph(T, 12), T=T)
        rrect(ctx, 740, 470, 440, 40, 8); fs(ctx, '#ffffff', 7)
    elif i == 2:
        cam(ctx, 1.4, 960, 600); living(ctx, T)
        x = lerp(500, 1400, v/seg)
        char(ctx, 'linda', x, 920, 0.95, walk=walkph(T, 7), armL=90, armR=90, mouth='flat', look=1, eyes='open', brow=-1, T=T)
        prop(ctx, 'plant', x+20, 600, 1.4)
        ell(ctx, x+5, 560, 10, 10); col(ctx, '#ffffff'); ctx.fill(); ell(ctx, x+35, 560, 10, 10); ctx.fill()
        ell(ctx, x+9, 562, 4, 4); col(ctx, OUT); ctx.fill(); ell(ctx, x+39, 562, 4, 4); ctx.fill()
    elif i == 3:
        cam(ctx, 1.3, 960, 600); living(ctx, T)
        x = lerp(1600, 400, v/seg)
        hop = abs(math.sin(T*10))*30
        ctx.save(); ctx.translate(x, 920 - hop)
        rrect(ctx, -170, -300, 340, 300, 10); fs(ctx, '#d9a066', 7)
        ctx.move_to(-170, -300); ctx.line_to(-230, -380); ctx.line_to(-110, -380); ctx.line_to(-60, -300); fs(ctx, '#c88a52', 6)
        rrect(ctx, -60, -220, 120, 50, 20); col(ctx, OUT); ctx.fill()
        ell(ctx, -25, -195, 14, 14); col(ctx, '#ffffff'); ctx.fill(); ell(ctx, 25, -195, 14, 14); ctx.fill()
        ell(ctx, -32, -195, 6, 6); col(ctx, OUT); ctx.fill(); ell(ctx, 18, -195, 6, 6); ctx.fill()
        text(ctx, 'NOT DAD', 0, -90, 40, '#ffffff', OUT, 8)
        for side in (-1, 1): ell(ctx, side*60, 10, 34, 16); fs(ctx, CH['peter']['shoe'], 5)
        ctx.restore()
    elif i == 4:
        cam(ctx, 1.0, 960, 540); hallway(ctx, T, scroll=T*900)
        for k, w in enumerate(('peter', 'linda', 'max')):
            char(ctx, w, 1300 - k*320 + 30*math.sin(T*3+k), 960 + k*5, 0.95, flip=False, walk=walkph(T, 20), armL=lerp(30, 120, 0.5+0.5*math.sin(T*20)), armR=lerp(120, 30, 0.5+0.5*math.sin(T*20)),
                 mouth='grin', brow=-1, look=1, lean=12, T=T)
        hlines(ctx, T)
    else:
        z = lerp(1.0, 1.5, ease(v/0.4))
        cam(ctx, z, 1000, 560); hallway(ctx, T, scroll=27.2*900 + 5*seg*900)
        skid = ease(v/0.3)
        for k, w in enumerate(('peter', 'linda', 'max')):
            char(ctx, w, 700 - k*230 + skid*60, 960, 0.95, lean=lerp(12, -15, skid), armL=160, armR=160, mouth='shock', eyes='wide', brow=1, look=1, T=T, shake=4)
        up = ease(v/0.4)
        char(ctx, 'margaret', 1350, 960, 1.0, flip=True, armR=lerp(90, 170, up), armL=60, hold='book', mouth='smirk', brow=-1, look=1, T=T)

def sc_names(ctx, T):
    u = T - 34.2; i = min(3, int(u // 4.3)); v = u - i*4.3
    names = [('margaret', 'MARGARET', '#c77dff', '#a45ee8', '#7d4cc0'),
             ('peter', 'PETER', '#4da6ff', '#2f8ae8', '#3f78d8'),
             ('linda', 'LINDA', '#5fd17a', '#3fb35a', '#2d8440'),
             ('max', 'MAX', '#ffa94d', '#ff8a1f', '#e8524a')]
    who, nm, c1, c2, c3 = names[i]
    frz = 0.95
    if v < frz:
        cam(ctx, 1.2 + v*0.2, 960, 560); living(ctx, T)
        p = v/frz
    else:
        burst(ctx, T, c1, c2)
        ctx.translate(W/2, H/2); ctx.scale(1.02 + 0.03*beatpulse(T), 1.02 + 0.03*beatpulse(T)); ctx.translate(-W/2, -H/2)
        p = 1.0
        f = 1 - cl((v-frz)/0.12)
        if f > 0: ctx.rectangle(0, 0, W, H); col(ctx, '#ffffff', f)
    X, Y = 960, 820
    if who == 'margaret':
        a = lerp(170, 95, ease(p))
        if v >= frz:
            rulebook(ctx, 1240, 420, 1.0, glow=0.8)
        char(ctx, 'margaret', X, Y, 1.2, armR=a, armL=40, hold='book' if v < frz else None, mouth='grin', brow=-1, look=0.5, T=T)
        if v < frz and p > 0.8: bang(ctx, 1250, 600, 1.2, txt='SLAM!')
        if v >= frz:
            ell(ctx, X-30, Y-410, 8, 8); col(ctx, '#ffffff'); ctx.fill()
    elif who == 'peter':
        x = lerp(500, 960, ease(p)); y = Y - math.sin(p*math.pi)*120 - 60
        char(ctx, 'peter', x, y, 1.15, lean=lerp(-20, -75, ease(p)), armL=175, armR=170, mouth='shock', eyes='wide', brow=1, look=0, T=T, walk=1.0)
        prop(ctx, 'remote', x + 520*1.0, y - 180, 1.6, rot=T*8 if v < frz else 0.7)
    elif who == 'linda':
        char(ctx, 'linda', X, Y, 1.15, armL=lerp(100, 160, (math.sin(T*8)+1)/2) if v < frz else 165, armR=lerp(160, 100, (math.sin(T*8)+1)/2) if v < frz else 150,
             mouth='grin', eyes='tired', tired=True, brow=1, T=T)
        objs = [('mug', -260, -720), ('cookie', 0, -820), ('remote', 260, -720), ('notebook', 380, -560)]
        for k, (o, ox, oy) in enumerate(objs):
            ph = T*8 + k*1.5 if v < frz else 34.2*0 + k
            prop(ctx, o, X + ox + 30*math.sin(ph), Y + oy + 40*math.cos(ph), 1.2, rot=0.4*math.sin(ph), T=T)
    else:
        y = Y - math.sin(min(p, 1)*math.pi*0.8)*200 - (160 if v >= frz else 0)
        char(ctx, 'max', X, y, 1.15, armL=170, armR=150, mouth='cookie', brow=-1, look=1, lean=-10, T=T, walk=1.4)
        for k in range(6):
            ang = k*1.05 + 0.4
            prop(ctx, 'cookie', X + math.cos(ang)*420, y - 300 + math.sin(ang)*260, 1.3, rot=ang + (T*4 if v < frz else 0))
    if v >= frz:
        namecard(ctx, nm, v - frz, c3)

def sc_bridge(ctx, T):
    u = T - 51.4
    if u < 2.2:
        g = cairo.LinearGradient(0, 0, 0, H); g.add_color_stop_rgba(0, *hx('#2a0f4a')); g.add_color_stop_rgba(1, *hx('#7a2fbf'))
        ctx.set_source(g); ctx.paint()
        ctx.save(); ctx.translate(960, 300)
        for k in range(16):
            ctx.rotate(math.pi/8 + 0.002)
            ctx.move_to(0, 0); ctx.line_to(-60, -1500); ctx.line_to(60, -1500); ctx.close_path(); col(ctx, '#ffd84d', 0.12 + 0.1*ease(u/1.5)); ctx.fill()
        ctx.restore()
        if 1.2 < u < 1.35 or 1.6 < u < 1.7:
            ctx.rectangle(0, 0, W, H); col(ctx, '#ffffff', 0.6); ctx.fill()
        up = ease(u/1.4)
        z = lerp(1.0, 1.25, u/2.2)
        ctx.translate(960, 1080); ctx.scale(z, z); ctx.translate(-960, -1080)
        char(ctx, 'margaret', 960, 1180, 1.75, armR=lerp(60, 175, up), armL=lerp(20, 175, up), mouth='grin', brow=-1, T=T)
        rulebook(ctx, 960 + lerp(250, 0, up), lerp(780, 220, up), 1.5, glow=up)
    elif u < 4.3:
        v = u - 2.2
        cam(ctx, lerp(1.15, 1.3, v/2), 960, 600); living(ctx, T)
        for k, (w, x) in enumerate((('peter', 560), ('linda', 960), ('max', 1360))):
            char(ctx, w, x, 930, 1.0, armL=150, armR=150, mouth='shock', eyes='wide', brow=1, T=T)
        ctx.rectangle(-2000, -2000, 6000, 6000); col(ctx, '#3a2fbf', 0.25); ctx.fill()
        bang(ctx, 960, 330, eob(v/0.3)*0.9, '#ffd84d', 'RULE #101')
    else:
        v = u - 4.3
        cols = ('#4da6ff', '#5fd17a', '#ffa94d')
        for k, w in enumerate(('peter', 'linda', 'max')):
            sl = ease((v - k*0.22)/0.25)
            if sl <= 0: continue
            x0 = k*W/3
            ctx.save(); ctx.translate(0, (1-sl)*-H)
            ctx.rectangle(x0, 0, W/3, H); ctx.clip()
            ctx.rectangle(x0, 0, W/3, H); col(ctx, cols[k]); ctx.fill()
            speedlines(ctx, T + k, x0 + W/6, 500, 0.35)
            char(ctx, w, x0 + W/6, 1600, 2.4, armL=10, armR=10, mouth='shock', eyes='wide', brow=1, T=T, shake=10)
            ctx.restore()
            line(ctx, x0, 0, x0, H, 14, OUT)

def sc_chaos(ctx, T):
    u = T - 58.4
    if u < 7.8:
        cam(ctx, lerp(1.0, 1.12, u/7.8), lerp(900, 1020, u/7.8), 560)
        living(ctx, T); tv(ctx, 260, 880, 0.9, T)
        # armchair + calm grandma
        rrect(ctx, 760, 620, 400, 260, 50); fs(ctx, '#7d4cc0', 7); rrect(ctx, 720, 720, 80, 180, 30); fs(ctx, '#6a3aa8', 7); rrect(ctx, 1120, 720, 80, 180, 30); fs(ctx, '#6a3aa8', 7)
        sip = 0.5 + 0.5*math.sin(T*1.4)
        char(ctx, 'margaret', 960, 900, 0.95, armR=lerp(60, 130, sip), armL=30, hold='mug', eyes='closed', mouth='smile', T=T, legs=True)
        rrect(ctx, 790, 820, 340, 70, 25); fs(ctx, '#8d5ad0', 7)
        # dad chased by vacuum loop
        lp = (u % 3.9)/3.9; dx = lerp(-300, 2200, lp)
        char(ctx, 'peter', dx, 1010, 0.8, walk=walkph(T, 22), armL=170, armR=160, mouth='shock', eyes='wide', brow=1, look=-1, lean=14, T=T, sweat=True)
        ctx.save(); ctx.translate(dx - 300, 1010)
        ell(ctx, 0, -30, 90, 40); fs(ctx, '#ff5d73', 7); ell(ctx, 0, -50, 50, 14); fs(ctx, '#333344', 5)
        ell(ctx, 40, -40, 8, 8); col(ctx, '#7ff0ff' if (T*6) % 1 > 0.5 else '#ffffff'); ctx.fill()
        ctx.restore()
        # max sneaking out the window
        if u > 2.0:
            mp = ease((u-2.0)/3.5)
            char(ctx, 'max', lerp(1700, 1000, mp), lerp(900, 500, ease((u-4.0)/1.5)), 0.7, walk=walkph(T, 8), flip=True, armL=60, armR=60, mouth='grin', brow=-1, look=-1, T=T, hood=True)
        # linda with pillow
        lx = 300 + 1400*(0.5+0.5*math.sin(u*0.9))
        char(ctx, 'linda', lx, 940, 0.75, walk=walkph(T, 14), armL=170, armR=170, mouth='grin', tired=True, brow=-1, T=T, flip=math.cos(u*0.9) < 0)
        rrect(ctx, lx-70, 940-390*0.75*1.05 - 120, 140, 90, 30); fs(ctx, '#ffd84d', 6)
        feathers(ctx, T, 30)
    else:
        v = u - 7.8; seg = 7.8/7; i = min(6, int(v // seg)); w = v - i*seg
        if i % 2 == 1:  # calm grandma beats
            burst(ctx, T, '#ffe3f1', '#ffd0e6')
            pose = [dict(hold='tea', armR=95, eyes='closed', mouth='smile'),
                    dict(hold='book', armR=110, eyes='open', mouth='smile', lookY=0.8),
                    dict(hold='mug', armR=130, eyes='closed', mouth='smile')][i//2]
            char(ctx, 'margaret', 960, 1180, 1.6, armL=30, T=T, **pose)
            for k in range(5):
                ell(ctx, 300 + k*330, 200 + 40*math.sin(T*2+k), 10, 10); col(ctx, '#c77dff', 0.6); ctx.fill()
            text(ctx, '~ calm ~', 960, 120, 60, '#ffffff', '#c77dff', 10)
        else:
            cam(ctx, 1.25 + 0.08*beatpulse(T), 960, 560); living(ctx, T)
            if i == 0:  # spaghetti on dad
                char(ctx, 'peter', 960, 930, 1.0, armL=150, armR=150, mouth='shock', eyes='wide', brow=1, T=T, shake=3)
                ctx.save(); ctx.translate(960, 930 - 1.12*400)
                for k in range(12):
                    ctx.move_to(-70 + k*13, 0); ctx.curve_to(-90 + k*14, 60, -50 + k*12, 90, -70 + k*13, 150 + (k % 3)*20)
                    col(ctx, '#ffe08a'); ctx.set_line_width(8); ctx.stroke()
                ell(ctx, 0, -10, 80, 30); col(ctx, '#e8524a'); ctx.fill()
                ctx.restore()
                prop(ctx, 'tea', 960 + 20*math.sin(T*9), 420 - 1.12*400 + 80, 2.0, rot=3.14)
            elif i == 2:  # ball smashes lamp
                bx = lerp(200, 1700, w/seg); by = 700 - abs(math.sin(w*9))*300
                char(ctx, 'max', 400, 930, 1.0, armR=150, armL=60, mouth='grin', brow=-1, look=1, T=T)
                ell(ctx, bx, by, 45, 45); fs(ctx, '#ff5d73', 6); line(ctx, bx-45, by, bx+45, by, 5, '#ffffff')
                if w > seg*0.75: bang(ctx, 1720, 470, 1.0, txt='CRASH!')
            elif i == 4:  # linda wrestles the vacuum
                char(ctx, 'linda', 960, 930, 1.0, armL=110, armR=100, mouth='shock', tired=True, brow=1, T=T, lean=15*math.sin(T*10))
                ctx.save(); ctx.translate(1260 + 40*math.sin(T*12), 940)
                ell(ctx, 0, -60, 110, 70); fs(ctx, '#ff8a1f', 7); line(ctx, -80, -100, -230, -320, 14, OUT)
                ctx.restore()
                feathers(ctx, T, 25, seed=5)
            else:  # dogpile
                for k, (wh, dx, dy, ln) in enumerate((('peter', -120, 0, -70), ('linda', 120, -40, 70), ('max', 0, -230, 10))):
                    char(ctx, wh, 960 + dx, 940 + dy, 0.9, lean=ln + 6*math.sin(T*15+k), armL=170, armR=160, mouth='grin', eyes='happy', T=T)
                for k in range(8):
                    a = T*3 + k
                    ell(ctx, 960 + math.cos(a)*350, 600 + math.sin(a)*200, 30, 30); col(ctx, '#ffffff', 0.7); ctx.fill()
                bang(ctx, 1450, 300, 0.9, txt='OOF!')

def sc_ending(ctx, T):
    u = T - 74.0
    if u < 3.3:
        cam(ctx, 1.25, 960, 600)
        living(ctx, T, dark=ease((u-1.5)/1.2)*0.5, night=True); couch(ctx, 960, 900, 1.2)
        for k, (w, x) in enumerate((('peter', 620), ('linda', 860), ('max', 1100))):
            char(ctx, w, x, 850, 0.85, eyes='closed', mouth='yawn' if (u*0.8+k*0.3) % 1 < 0.4 else 'smile', armL=20, armR=20, T=T, legs=False, lean=(k-1)*8)
        char(ctx, 'margaret', 1400, 930, 0.95, flip=True, armR=95, armL=20, hold='book', mouth='smile', T=T)
        for k in range(3):
            text(ctx, 'z', 640 + k*240 + 20*math.sin(T*2+k), 380 - ((T*40 + k*30) % 90), 50, '#ffffff', OUT, 8)
        return
    v = u - 3.3
    # zoom out of living room into title card
    z = lerp(1.0, 0.5, ease((v-1.2)/2.0))
    burst(ctx, T, '#ff5d73', '#ff7f8f')
    ctx.save()
    cx = 960; cy = lerp(540, 60, ease((v-1.2)/2.0))
    ctx.translate(W/2, H/2); ctx.scale(z, z); ctx.translate(-cx, -cy)
    rrect(ctx, -20, -20, W+40, H+40, 60); col(ctx, OUT); ctx.fill()
    ctx.save(); rrect(ctx, 0, 0, W, H, 50); ctx.clip()
    lightoff = 1.0 if T > 83.55 else 0.0
    living(ctx, T); couch(ctx, 960, 900, 1.0)
    for k, (w, x) in enumerate((('peter', 520), ('linda', 800), ('max', 1420))):
        char(ctx, w, x, 940, 0.95, mouth='grin', armL=30 + 20*bounce(T), armR=150 if w != 'max' else 160, eyes='happy', T=T, flip=(w == 'max'))
    up = ease(v/0.8)
    char(ctx, 'margaret', 1110, 980, 1.05, armR=lerp(60, 172, up), armL=30, mouth='grin', brow=-1, T=T)
    rulebook(ctx, 1110 + 60*1.05*0.9, lerp(700, 260, up), 1.05, glow=up)
    if lightoff: ctx.rectangle(0, 0, W, H); col(ctx, '#0b0a2a', 0.78); ctx.fill(); rulebook(ctx, 1170, 260, 1.05, glow=0.6)
    ctx.restore(); ctx.restore()
    # title
    tv_ = v - 2.4
    if tv_ > 0:
        title = "GRANDMA'S"; cols = ['#ffd84d', '#4da6ff', '#5fd17a', '#ffa94d', '#c77dff', '#ff5d73', '#ffd84d', '#4da6ff', '#5fd17a']
        ctx.select_font_face('Inter Display', cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
        size = 170; ctx.set_font_size(size)
        widths = [ctx.text_extents(ch).x_advance for ch in title]; tot = sum(widths)
        x = W/2 - tot/2
        for k, ch in enumerate(title):
            s = eob((tv_ - k*0.06)/0.35)
            if s > 0.01:
                wob = math.sin(T*6 + k)*0.06
                ctx.save(); ctx.translate(x + widths[k]/2, 190 - 14*bounce(T + k*0.05)); ctx.scale(s, s)
                text(ctx, ch, 0, 0, size, cols[k], OUT, 30, face='Inter Display', rot=wob); ctx.restore()
            x += widths[k]
        s2 = eob((tv_ - 0.7)/0.4)
        if s2 > 0.01:
            ctx.save(); ctx.translate(W/2, 395); ctx.scale(s2, s2); ctx.rotate(-0.04)
            rrect(ctx, -420, -100, 840, 200, 40); fs(ctx, '#7d4cc0', 14)
            text(ctx, 'RULES', 0, 0, 190, '#ffffff', OUT, 30, face='Inter Display')
            ctx.restore()
            for k in range(10):
                a = k*math.pi/5 + T
                r = 520 + 30*math.sin(T*4+k)
                sx = W/2 + math.cos(a)*r; sy = 300 + math.sin(a)*r*0.35
                ctx.save(); ctx.translate(sx, sy); ctx.rotate(T*2)
                for q in range(4): ctx.rotate(math.pi/2); ctx.move_to(0, 0); ctx.line_to(8, 26); ctx.line_to(-8, 26); ctx.close_path(); col(ctx, '#ffffff'); ctx.fill()
                ctx.restore()

SCENES = [(0, sc_exterior), (5.9, sc_inspect), (13.1, sc_verse_b), (20.5, sc_rules), (27.2, sc_escape),
          (34.2, sc_names), (51.4, sc_bridge), (58.4, sc_chaos), (74.0, sc_ending)]
CUTS = [5.9, 13.1, 14.95, 16.8, 18.65, 20.5, 23.4, 25.3, 27.2, 34.2, 38.5, 42.8, 47.1, 51.4, 53.6, 55.7, 58.4, 66.2, 74.0]

def render(T, surf):
    ctx = cairo.Context(surf)
    ctx.set_line_join(cairo.LINE_JOIN_ROUND)
    fn = SCENES[0][1]
    for t0, f in SCENES:
        if T >= t0: fn = f
    ctx.save(); fn(ctx, T); ctx.restore()
    for c in CUTS:  # flash on cuts
        d = T - c
        if 0 <= d < 0.1:
            ctx.rectangle(0, 0, W, H); col(ctx, '#ffffff', 0.5*(1 - d/0.1)); ctx.fill()
    # vignette
    g = cairo.RadialGradient(W/2, H/2, 600, W/2, H/2, 1250); g.add_color_stop_rgba(0, 0, 0, 0, 0); g.add_color_stop_rgba(1, 0, 0, 0, 0.28)
    ctx.set_source(g); ctx.paint()
    if T < 0.35:
        ctx.rectangle(0, 0, W, H); col(ctx, '#000000', 1 - T/0.35); ctx.fill()

if __name__ == '__main__':
    mode = sys.argv[1]
    surf = cairo.ImageSurface(cairo.FORMAT_RGB24, W, H)
    if mode == 'still':
        for t in sys.argv[2:]:
            render(float(t), surf); surf.write_to_png(f'still_{t}.png')
    else:
        a, b = int(sys.argv[2]), int(sys.argv[3])
        for n in range(a, b):
            render(n / FPS, surf); surf.flush()
            sys.stdout.buffer.write(bytes(surf.get_data()))
