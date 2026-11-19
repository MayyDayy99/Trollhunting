"""Stylized, rigged and animated LEFT hand for Troll Hunting's gravity spell, built headless in Blender (tested with 5.3).

One chunky, cartoony left hand with a short forearm stub in a leather bracer (the forearm reaches 0.22 m back from the
wrist), plus a separate glowing sigil decal on the back of the hand. The same GLB is used twice by the game: as the
player's own hand on the camera and, scaled x7, as a translucent "spectral hand" at the target doing the same gesture.

Rest pose (Blender, Z-up): wrist at the origin, fingers along +Y, palm facing +X, thumb on top (+Z), forearm along -Y.
After the glTF Y-up conversion (three.js): fingers -Z, palm +X, thumb +Y, forearm +Z. Wrist to middle fingertip ~0.19 m.

  Hand      the skinned skin + bracer mesh: a low-poly box-modelling cage (12-sided arm/palm loop, 6-sided digits,
            4 finger columns at the knuckles, the thumb grown from a hole in the palm's thumb side) subdivided once
            (Catmull-Clark) and smooth shaded. Vertex colours (glTF COLOR_0, face-corner, linear): warm skin with
            baked crease/occlusion shading, lighter knuckle tops, rosy fingertips and nails, lighter palm; brown
            leather bracer with a lighter strap band, a darker cuff with a stitched seam and a rolled lip.
  HandRune  a flat sigil (ring + inward triangle + centre diamond + six ticks) projected onto the back of the hand
            1.6 mm above the skin, skinned 100 % to Palm, its own emissive material (no vertex colours).
  HandRig   the armature: Wrist (root, at the origin) -> Palm, then Thumb1..3, Index1..3, Middle1..3, Ring1..3,
            Pinky1..3 under Palm. Weights are computed analytically on the subdivided mesh (smooth blends across
            each joint, max 4 influences), so curled fingers do not drag their neighbours.

Animations (actions, one glTF animation each, sampled at 60 fps so every duration is a whole number of frames; the
moves have their root motion on Wrist's translation):
  Idle  2.0 s, loops: relaxed curl, slow breathing bob/sway.
  Lift  0.55 s: dip and pronate (anticipation), then snap palm UP into a strong claw while rising +0.12 m (overshoot).
  Slam  0.45 s: wind up (+0.06 m, wrist cocked back), slam palm DOWN, fingers spread flat, to -0.15 m, small rebound.
  Push  0.45 s: pull back, then the wrist bends back (palm FORWARD, fingers up, spread) and thrusts +0.18 m forward.

  blender -b --factory-startup --python tools/vfx/left_hand.py -- --export src/assets/vfx/left_hand.glb
  blender -b --factory-startup --python tools/vfx/left_hand.py -- --save tools/vfx/left_hand.blend
  blender -b --factory-startup --python tools/vfx/left_hand.py -- --preview OUT.png

--export writes the GLB, --save the scene (Idle is the active action, the others have fake users), --preview renders
a contact sheet: top row a fixed first-person-like camera (shows the root motion), bottom row a close 3/4 view that
follows the hand; columns: rest pose, Idle, and the end pose of Lift, Slam, Push. Run on a saved .blend
(blender -b tools/vfx/left_hand.blend --python ... -- --export ...) it exports what is in it.
"""
import json
import math
import os
import shutil
import struct
import sys

import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree

HAND, RUNE, RIG = "Hand", "HandRune", "HandRig"
FPS = 60
TRI_BUDGET = 2500
X, Y, Z = Vector((1.0, 0.0, 0.0)), Vector((0.0, 1.0, 0.0)), Vector((0.0, 0.0, 1.0))

# ---------------------------------------------------------------- colours (sRGB, stored linear in COLOR_0)
SKIN, SKIN_PALM, SKIN_SHADE = "#eeb08b", "#f7c8a8", "#b8705a"
SKIN_HI, SKIN_TIP, NAIL = "#fad8bf", "#f0a088", "#fde8dc"
LEATHER, LEATHER_DARK, RIM = "#7c4a2a", "#3f2414", "#5a341d"
STRAP, STITCH, CUFF, LIP = "#b9834c", "#efd3a0", "#653a20", "#9c693e"
RUNE_GLOW = "#b88cff"                      # preview only; the game gives HandRune its own emissive material

# ---------------------------------------------------------------- arm / palm cross-sections (12-vertex loops)
# loop order: 0..4 back of hand (-X) from the pinky side (-Z) to the thumb side (+Z), 5 thumb side, 6..10 palm (+X)
# from the thumb side back to the pinky side, 11 pinky side. "grid" = flat palm box (4 finger columns), "ell" = round.
GRID = [(-0.80, -1.00), (-0.97, -0.50), (-1.00, 0.00), (-0.97, 0.50), (-0.80, 1.00), (0.10, 1.08),
        (0.86, 1.00), (0.98, 0.50), (1.00, 0.00), (0.98, -0.50), (0.86, -1.00), (0.10, -1.08)]
W_KNUCKLE = 0.0465


def ell(i):
    a = math.radians((i - 2) * 30.0)
    return (-math.cos(a), math.sin(a))


def knuckle_y(zn):
    """the knuckle loop follows the arch of the MCP joints (middle finger furthest forward)"""
    pts = [(-1.08, 0.085), (-1.0, 0.086), (-0.5, 0.0915), (0.0, 0.0965), (0.5, 0.096), (1.0, 0.092), (1.08, 0.091)]
    for (z0, y0), (z1, y1) in zip(pts, pts[1:]):
        if zn <= z1:
            return y0 + (y1 - y0) * max(0.0, (zn - z0) / (z1 - z0))
    return pts[-1][1]


def bracer(y, bulge=0.0):
    """leather surface half thickness / half width: the forearm grows toward the elbow"""
    t = (y + 0.031) / (-0.206 + 0.031)
    return 0.0250 + 0.0036 * t + bulge, 0.0322 + 0.0036 * t + bulge


# (name, y, style 0 = round .. 1 = flat palm box, half thickness T (X), half width W (Z))
MAIN = [
    ("end", -0.220, 0.0, 0.0228, 0.0290),
    ("rim", -0.206, 0.0, *bracer(-0.206, 0.0016)),
    ("strap back", -0.131, 0.0, *bracer(-0.131, 0.0010)),
    ("strap front", -0.107, 0.0, *bracer(-0.107, 0.0010)),
    ("cuff back", -0.048, 0.0, *bracer(-0.048, 0.0022)),
    ("cuff front", -0.031, 0.0, *bracer(-0.031, 0.0022)),
    ("tuck", -0.027, 0.15, 0.0205, 0.0305),
    ("wrist", -0.006, 0.35, 0.0195, 0.0318),
    ("heel", 0.026, 0.80, 0.0180, 0.0405),
    ("mid palm", 0.062, 1.00, 0.0170, 0.0448),
    ("knuckles", None, 1.00, 0.0146, W_KNUCKLE),
]
THUMB_RING = 8            # the thumb grows from the thumb-side quads between loops 8 (heel) and 9 (mid palm)
LEATHER_END = 6           # loops 0..5 are leather, the bracer ends at the tuck loop

# ---------------------------------------------------------------- digits
# fingers: name, knuckle column (0 = pinky side), MCP y, rest spread (deg, + toward the thumb), length / radius scale
FINGERS = [("Pinky", 0, 0.0950, -9.0, 0.78, 0.88), ("Ring", 1, 0.1020, -3.5, 0.95, 0.96),
           ("Middle", 2, 0.1048, 1.0, 1.00, 1.00), ("Index", 3, 0.1020, 5.0, 0.93, 0.98)]
SEG = (0.0395, 0.0260, 0.0235)                 # middle finger phalanges (MCP-PIP, PIP-DIP, DIP-tip)
FR_D, FR_L = 0.0113, 0.0118                    # middle finger half thickness / half width at the base
SPREAD_K = {"Index": 9.0, "Middle": 1.5, "Ring": -6.0, "Pinky": -13.0}     # deg per unit of the 'spr' pose value
THUMB = dict(cmc=(0.004, 0.014, 0.022), mcp=(0.016, 0.060, 0.067), ip=(0.025, 0.088, 0.075),
             tip=(0.031, 0.112, 0.078), dorsal=(-0.55, 0.0, 1.0), rd=0.0132, rl=0.0144)

RUNE_C = (0.058, 0.0015)                       # sigil centre on the back of the hand (y, z)
RUNE_LIFT = 0.0016


def lerp(a, b, t):
    return a + (b - a) * t


def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3.0 - 2.0 * t)


def hex_srgb(h):
    h = h.lstrip("#")
    return Vector([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)])


def mix(a, b, t):
    return a.lerp(b, max(0.0, min(1.0, t)))


def args():
    a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    opt = {"save": None, "export": None, "preview": None}
    i = 0
    while i < len(a):
        if a[i] in ("--save", "--export", "--preview"): opt[a[i][2:]] = a[i + 1]; i += 2
        else: i += 1
    return opt


# ================================================================= digit specs (shared by mesh, weights and rig)
def digit_specs():
    out = []
    for name, col, ymcp, spread, ls, rs in FINGERS:
        zc = -W_KNUCKLE + (col + 0.5) * (W_KNUCKLE / 2.0)
        a = math.radians(spread)
        d = Vector((0.0, math.cos(a), math.sin(a)))
        mcp = Vector((-0.0005, ymcp, zc))
        L = [s * ls for s in SEG]
        J = [mcp, mcp + d * L[0], mcp + d * (L[0] + L[1]), mcp + d * sum(L)]
        out.append(dict(name=name, col=col, joints=J, rd=FR_D * rs, rl=FR_L * rs, dorsal=-X, thumb=False,
                        h=(0.009, 0.0055, 0.0045)))
    t = THUMB
    J = [Vector(t["cmc"]), Vector(t["mcp"]), Vector(t["ip"]), Vector(t["tip"])]
    out.append(dict(name="Thumb", col=None, joints=J, rd=t["rd"], rl=t["rl"], dorsal=Vector(t["dorsal"]).normalized(),
                    thumb=True, h=(0.008, 0.008, 0.0055)))
    return out


def chain_len(J):
    acc = [0.0]
    for a, b in zip(J, J[1:]):
        acc.append(acc[-1] + (b - a).length)
    return acc


def chain_point(J, s):
    """point and tangent at arc length s along the joint chain (bisector tangent exactly at a joint)"""
    acc = chain_len(J)
    i = 0
    while i < len(J) - 2 and s > acc[i + 1] + 1e-9:
        i += 1
    u = (J[i + 1] - J[i]).normalized()
    p = J[i] + u * (s - acc[i])
    tan = u
    for k in (1, 2):
        if abs(s - acc[k]) < 1e-7:
            tan = ((J[k] - J[k - 1]).normalized() + (J[k + 1] - J[k]).normalized()).normalized()
    return p, tan


def chain_coord(p, J):
    """project p onto the chain: (arc length s, radial offset vector); the first and last segment extrapolate"""
    acc = chain_len(J)
    best = None
    n = len(J) - 1
    for i in range(n):
        a, b = J[i], J[i + 1]
        L = (b - a).length; u = (b - a) / L
        t = (p - a).dot(u)
        lo = -1e9 if i == 0 else 0.0
        hi = 1e9 if i == n - 1 else L
        t = max(lo, min(hi, t))
        q = a + u * t
        d = (p - q).length
        if best is None or d < best[0]:
            best = (d, acc[i] + t, p - q)
    return best[1], best[2]


# ================================================================= cage mesh
def main_ring(spec):
    _, y, style, T, W = spec
    pts = []
    for i in range(12):
        ex, ez = ell(i); gx, gz = GRID[i]
        px, pz = lerp(ex, gx, style), lerp(ez, gz, style)
        pts.append(Vector((T * px, knuckle_y(pz) if y is None else y, W * pz)))
    return pts


def digit_rings(base, stations, dorsal):
    """rings of 6 around the digit axis, vertex k matched to base loop vertex k (regularised angles, no twist)"""
    C = sum(base, Vector()) / len(base)
    A0 = stations[0][1]
    e1 = (dorsal - A0 * dorsal.dot(A0)).normalized(); e2 = A0.cross(e1)
    angs = []
    for p in base:
        d = p - C; d -= A0 * d.dot(A0)
        angs.append(math.atan2(d.dot(e2), d.dot(e1)))
    turn = 0.0
    for k in range(6):
        da = angs[(k + 1) % 6] - angs[k]
        turn += math.atan2(math.sin(da), math.cos(da))
    sig = 1.0 if turn > 0 else -1.0
    sx = sum(math.cos(a - sig * k * math.pi / 3) for k, a in enumerate(angs))
    sy = sum(math.sin(a - sig * k * math.pi / 3) for k, a in enumerate(angs))
    ref = math.atan2(sy, sx)
    rings = []
    for P, A, rd, rl in stations:
        f1 = (dorsal - A * dorsal.dot(A)).normalized(); f2 = A.cross(f1)
        ring = []
        for k in range(6):
            a = ref + sig * k * math.pi / 3
            ring.append(P + f1 * (rd * math.cos(a)) + f2 * (rl * math.sin(a)))
        rings.append(ring)
    return rings


def build_cage():
    V, F = [], []
    groups = {f"m{d}": {} for d in range(5)}       # digit masks (interpolated by the subdivision)
    groups["ring"] = {}                            # main-tube loop index / 16 (to find the bracer bands later)

    def add(p, digit=None, ring=None):
        V.append(Vector(p)); i = len(V) - 1
        if digit is not None: groups[f"m{digit}"][i] = 1.0
        groups["ring"][i] = (ring if ring is not None else 12.0) / 16.0
        return i

    rings = [[add(p, ring=k) for p in main_ring(spec)] for k, spec in enumerate(MAIN)]
    for a in range(len(rings) - 1):
        for j in range(12):
            if a == THUMB_RING and j in (4, 5):
                continue                                   # the thumb hole
            F.append((rings[a][j], rings[a][(j + 1) % 12], rings[a + 1][(j + 1) % 12], rings[a + 1][j]))

    def grid_cap(R, interior_y, x_off):
        back = [R[j] for j in range(5)]
        palm = [R[10 - j] for j in range(5)]
        mid = [R[11]]
        for j in range(1, 4):
            b, p = V[back[j]], V[palm[j]]
            mid.append(add(Vector(((b.x + p.x) / 2 + x_off, interior_y(j), (b.z + p.z) / 2)), ring=None))
        mid.append(R[5])
        return back, mid, palm

    # forearm end cap (grid 4 x 2)
    back, mid, palm = grid_cap(rings[0], lambda j: MAIN[0][1] - 0.006, 0.0)
    for j in range(4):
        F.append((back[j], back[j + 1], mid[j + 1], mid[j]))
        F.append((mid[j], mid[j + 1], palm[j + 1], palm[j]))
    for i in mid[1:4]:
        groups["ring"][i] = 0.0

    specs = digit_specs()
    fingers = [s for s in specs if not s["thumb"]]
    mcp_y = {s["col"]: s["joints"][0].y for s in fingers}
    # knuckle end: webs between the fingers, then each finger grows from its column
    back, mid, palm = grid_cap(rings[-1], lambda j: (mcp_y[j - 1] + mcp_y[j]) / 2 + 0.004, 0.003)
    for i in mid[1:4]:
        groups["ring"][i] = 12.0 / 16.0
    for s in specs:
        J = s["joints"]; acc = chain_len(J)
        if s["thumb"]:
            R8, R9 = rings[THUMB_RING], rings[THUMB_RING + 1]
            base = [R8[4], R8[5], R8[6], R9[6], R9[5], R9[4]]
            plan = [(acc[1], 1.00, 1.00), ((acc[1] + acc[2]) / 2, 0.95, 0.95), (acc[2], 0.93, 0.94),
                    (acc[2] + 0.55 * (acc[3] - acc[2]), 0.86, 0.87)]
            d = 4
        else:
            c = s["col"]
            base = [back[c], back[c + 1], mid[c + 1], palm[c + 1], palm[c], mid[c]]
            plan = [(0.010, 1.04, 1.00), (acc[1] * 0.5, 0.99, 0.99), (acc[1], 1.01, 1.00), (acc[2], 0.97, 0.97),
                    (acc[2] + 0.55 * (acc[3] - acc[2]), 0.95, 0.96)]
            d = c
        stations = []
        for sv, fd, fl in plan:
            P, A = chain_point(J, sv)
            stations.append((P, A, s["rd"] * fd, s["rl"] * fl))
        rr = digit_rings([V[i] for i in base], stations, s["dorsal"])
        loops = [base] + [[add(p, digit=d) for p in ring] for ring in rr]
        for lo, hi in zip(loops, loops[1:]):
            for k in range(6):
                F.append((lo[k], lo[(k + 1) % 6], hi[(k + 1) % 6], hi[k]))
        tipP, tipA = chain_point(J, acc[3])
        tip = add(tipP + tipA * 0.0022, digit=d)
        last = loops[-1]
        for k in range(6):
            F.append((last[k], last[(k + 1) % 6], tip))
    return V, F, groups, specs


# ================================================================= the Hand mesh
def build_hand():
    V, F, groups, specs = build_cage()
    me = bpy.data.meshes.new(HAND)
    me.from_pydata([tuple(v) for v in V], [], F)
    me.validate()
    bm = bmesh.new(); bm.from_mesh(me)
    bad = [e for e in bm.edges if len(e.link_faces) != 2]
    assert not bad, f"cage not closed: {len(bad)} open edges"
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(HAND, me)
    bpy.context.scene.collection.objects.link(ob)
    for name, wd in groups.items():
        vg = ob.vertex_groups.new(name=name)
        for vi, w in wd.items():
            vg.add([vi], w, "REPLACE")
    mod = ob.modifiers.new("Subdivision", "SUBSURF"); mod.levels = 1; mod.render_levels = 1
    for o in bpy.context.view_layer.objects: o.select_set(False)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    me = ob.data
    me.shade_smooth()

    # read the interpolated masks back
    gi = {vg.name: vg.index for vg in ob.vertex_groups}
    nv = len(me.vertices)
    mask = [[0.0] * 5 for _ in range(nv)]
    ringp = [0.0] * nv
    for v in me.vertices:
        for g in v.groups:
            for d in range(5):
                if g.group == gi[f"m{d}"]: mask[v.index][d] = g.weight
            if g.group == gi["ring"]: ringp[v.index] = g.weight * 16.0
    for vg in list(ob.vertex_groups): ob.vertex_groups.remove(vg)

    info = vertex_info(me, specs, mask)
    assign_weights(ob, specs, mask, info)
    paint_colours(me, specs, mask, info, ringp)
    return ob, specs


def vertex_info(me, specs, mask):
    """per vertex: chain coordinate s and radial offset for every digit (rest pose)"""
    info = []
    for v in me.vertices:
        row = []
        for s in specs:
            row.append(chain_coord(v.co, s["joints"]))
        info.append(row)
    return info


def chain_weights(s, spec):
    J = spec["joints"]; acc = chain_len(J); h = spec["h"]
    c0 = smoothstep(-h[0], h[0], s - acc[0]) if not spec["thumb"] else 1.0
    c1 = smoothstep(acc[1] - h[1], acc[1] + h[1], s)
    c2 = smoothstep(acc[2] - h[2], acc[2] + h[2], s)
    n = spec["name"]
    return {"Palm": 1.0 - c0, n + "1": c0 * (1.0 - c1), n + "2": c1 * (1.0 - c2), n + "3": c2}


def assign_weights(ob, specs, mask, info):
    me = ob.data
    names = ["Wrist", "Palm"] + [s["name"] + str(k) for s in specs for k in (1, 2, 3)]
    vgs = {n: ob.vertex_groups.new(name=n) for n in names}
    for v in me.vertices:
        m = mask[v.index]
        m_main = max(0.0, 1.0 - sum(m))
        c = smoothstep(-0.022, 0.016, v.co.y)
        w = {"Wrist": m_main * (1.0 - c), "Palm": m_main * c}
        for d, spec in enumerate(specs):
            if m[d] <= 1e-4:
                continue
            for k, val in chain_weights(info[v.index][d][0], spec).items():
                w[k] = w.get(k, 0.0) + m[d] * val
        top = sorted(((val, k) for k, val in w.items() if val > 1e-4), reverse=True)[:4]
        tot = sum(val for val, _ in top)
        for val, k in top:
            vgs[k].add([v.index], val / tot, "REPLACE")


def hemisphere(n=40):
    g = math.pi * (3.0 - math.sqrt(5.0))
    out = []
    for i in range(n):
        z = 1.0 - (i + 0.5) / n
        r = math.sqrt(max(0.0, 1.0 - z * z))
        out.append(Vector((r * math.cos(g * i), r * math.sin(g * i), z)))
    return out


def occlusion(me, dist=0.011):
    bvh = BVHTree.FromPolygons([v.co.copy() for v in me.vertices], [tuple(p.vertices) for p in me.polygons])
    dirs = hemisphere()
    wsum = sum(d.z for d in dirs)
    ao = []
    for v in me.vertices:
        n = v.normal.normalized()
        t = n.orthogonal().normalized(); b = n.cross(t)
        o = v.co + n * 2e-4
        acc = 0.0
        for d in dirs:
            ray = t * d.x + b * d.y + n * d.z
            hit = bvh.ray_cast(o, ray, dist)
            if hit[0] is not None:
                acc += d.z * (1.0 - hit[3] / dist) ** 0.7
        ao.append(acc / wsum)
    return ao


def hash01(i, k=0):
    x = (i * 374761393 + k * 668265263) & 0xFFFFFFFF
    x = ((x ^ (x >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((x ^ (x >> 16)) & 0xFFFF) / 65535.0


def paint_colours(me, specs, mask, info, ringp):
    ao = occlusion(me)
    C = {k: hex_srgb(v) for k, v in dict(SKIN=SKIN, SKIN_PALM=SKIN_PALM, SKIN_SHADE=SKIN_SHADE, SKIN_HI=SKIN_HI,
                                          SKIN_TIP=SKIN_TIP, NAIL=NAIL, LEATHER=LEATHER, LEATHER_DARK=LEATHER_DARK,
                                          RIM=RIM, STRAP=STRAP, STITCH=STITCH, CUFF=CUFF, LIP=LIP).items()}
    skin = []
    for v in me.vertices:
        i = v.index; p = v.co; n = v.normal
        c = C["SKIN"].copy()
        # palm side (and the palmar side of the digits) is lighter
        d_best = max(range(5), key=lambda d: mask[i][d])
        m = mask[i][d_best]
        dorsal = 0.0; s_dig = None
        palmar = smoothstep(0.15, 0.75, n.x) * smoothstep(-0.01, 0.02, p.y)      # palm side of the hand
        if m > 0.05:                                                            # digits: their own palmar side
            spec = specs[d_best]
            s_dig, rad = info[i][d_best]
            if rad.length > 1e-6:
                dd = rad.normalized().dot((spec["dorsal"] - spec["dorsal"].dot(Y) * Y).normalized())
                dorsal = max(0.0, dd)
                palmar = lerp(palmar, smoothstep(0.0, 0.6, -dd), min(1.0, m * 1.4))
        c = mix(c, C["SKIN_PALM"], 0.7 * palmar)
        # knuckles: lighter tops, darker palm-side creases (fingers: MCP, PIP, DIP; thumb: MCP, IP)
        hi = 0.0; crease = 0.0
        for d, spec in enumerate(specs):
            s, rad = info[i][d]
            if rad.length > 0.020:
                continue
            acc = chain_len(spec["joints"])
            joints = (acc[1], acc[2]) if spec["thumb"] else (acc[0] + 0.004, acc[1], acc[2])
            dv = rad.normalized().dot((spec["dorsal"] - spec["dorsal"].dot(Y) * Y).normalized()) if rad.length > 1e-6 else 0.0
            for jk, js in enumerate(joints):
                g = math.exp(-((s - js) / 0.0050) ** 2)
                hi += g * smoothstep(0.35, 0.9, dv) * (0.9 if jk == 0 and not spec["thumb"] else 0.7)
                crease += g * smoothstep(0.30, 0.85, -dv) * 0.8
        c = mix(c, C["SKIN_HI"], min(1.0, hi))
        c = mix(c, C["SKIN_SHADE"], 0.55 * min(1.0, crease))
        # rosy fingertips, nails on top of the last segment
        if s_dig is not None:
            spec = specs[d_best]; acc = chain_len(spec["joints"])
            tipf = smoothstep(acc[2] + 0.004, acc[3], s_dig) * m
            c = mix(c, C["SKIN_TIP"], 0.55 * tipf * (1.0 - 0.6 * dorsal))
            nail = smoothstep(acc[2] + 0.004, acc[2] + 0.009, s_dig) * smoothstep(0.45, 0.8, dorsal) * m
            c = mix(c, C["NAIL"], 0.9 * nail)
        # baked occlusion: creases between fingers, the thumb web, under the cuff lip
        c = mix(c, C["SKIN_SHADE"], 1.2 * ao[i] ** 1.15)
        skin.append(c)

    # leather per vertex (worn variation + occlusion), with stitches on the strap and cuff centre lines
    leather = []
    for v in me.vertices:
        i = v.index
        k = 0.94 + 0.12 * hash01(i, 7)
        leather.append(k)
    ring_y = [spec[1] for spec in MAIN]

    def stitch(v, y_line):
        if abs(v.co.y - y_line) > 0.0012:
            return False
        a = math.atan2(v.co.z / 1.25, -v.co.x)
        return int(round(a / (2 * math.pi / 24))) % 2 == 0

    cuff_mid = (ring_y[4] + ring_y[5]) / 2

    ca = me.color_attributes.new(name="Color", type="BYTE_COLOR", domain="CORNER")
    cols = [0.0] * (len(me.loops) * 4)
    for poly in me.polygons:
        rp = sum(ringp[vi] for vi in poly.vertices) / len(poly.vertices)
        cls = None
        if rp < LEATHER_END - 0.3:
            if rp < 1.0: cls = "RIM"
            elif 2.0 <= rp <= 3.0: cls = "STRAP"
            elif 4.0 <= rp <= 5.0: cls = "CUFF"
            elif rp > 5.0: cls = "LIP"
            else: cls = "LEATHER"
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            v = me.vertices[vi]
            if cls is None:
                c = skin[vi]
            else:
                c = C[cls] * leather[vi]
                if cls == "CUFF" and stitch(v, cuff_mid): c = mix(C["STITCH"], C["CUFF"], 0.45)
                # darker where the strap meets the bracer and in the creases of the lip
                edge = 0.0
                if cls == "LEATHER":
                    edge = max(math.exp(-((v.co.y - ring_y[2]) / 0.010) ** 2), math.exp(-((v.co.y - ring_y[3]) / 0.010) ** 2),
                               math.exp(-((v.co.y - ring_y[4]) / 0.010) ** 2), math.exp(-((v.co.y - ring_y[1]) / 0.012) ** 2))
                c = mix(c, C["LEATHER_DARK"], 0.45 * edge + 0.9 * ao[vi])
            cols[li * 4:li * 4 + 4] = (max(0.0, min(1.0, c.x)), max(0.0, min(1.0, c.y)), max(0.0, min(1.0, c.z)), 1.0)
    ca.data.foreach_set("color_srgb", cols)
    me.color_attributes.active_color = ca
    me.color_attributes.render_color_index = me.color_attributes.find("Color")


# ================================================================= the rune decal
def rune_shapes():
    """2D polygons in (u = toward the fingers, v = toward the thumb), metres"""
    polys = []
    N, ro, ri = 24, 0.0176, 0.0148
    for k in range(N):
        a0, a1 = 2 * math.pi * k / N, 2 * math.pi * (k + 1) / N
        polys.append([(ri * math.cos(a0), ri * math.sin(a0)), (ro * math.cos(a0), ro * math.sin(a0)),
                      (ro * math.cos(a1), ro * math.sin(a1)), (ri * math.cos(a1), ri * math.sin(a1))])
    to, ti = 0.0110, 0.0066                        # triangle frame pointing to the fingers
    T = [(math.cos(math.radians(a)), math.sin(math.radians(a))) for a in (0, 120, 240)]
    for k in range(3):
        a, b = T[k], T[(k + 1) % 3]
        polys.append([(to * a[0], to * a[1]), (to * b[0], to * b[1]), (ti * b[0], ti * b[1]), (ti * a[0], ti * a[1])])
    polys.append([(0.0028, 0.0), (0.0, 0.0021), (-0.0028, 0.0), (0.0, -0.0021)])       # centre diamond
    for k in range(6):                              # ticks, long ones in line with the triangle's corners
        a = math.radians(60 * k); w = math.radians(5.5)
        r0 = ro - 0.0004; r1 = ro + (0.0042 if k % 2 == 0 else 0.0026)
        polys.append([(r0 * math.cos(a - w), r0 * math.sin(a - w)), (r1 * math.cos(a), r1 * math.sin(a)),
                      (r0 * math.cos(a + w), r0 * math.sin(a + w))])
    return polys


def build_rune(hand):
    me = hand.data
    bvh = BVHTree.FromPolygons([v.co.copy() for v in me.vertices], [tuple(p.vertices) for p in me.polygons])
    verts, faces = [], []
    for poly in rune_shapes():
        idx = []
        for u, v in poly:
            o = Vector((-0.12, RUNE_C[0] + u, RUNE_C[1] + v))
            loc, nor, _, _ = bvh.ray_cast(o, X, 0.3)
            assert loc is not None, "rune point missed the hand"
            if nor.x > 0: nor = -nor
            verts.append(loc + nor * RUNE_LIFT); idx.append(len(verts) - 1)
        faces.append(idx)
    rm = bpy.data.meshes.new(RUNE)
    rm.from_pydata([tuple(v) for v in verts], [], faces)
    rm.validate()
    for p in rm.polygons:                           # face outward (-X, away from the skin)
        if p.normal.x > 0: p.flip()
    rm.update()
    ob = bpy.data.objects.new(RUNE, rm)
    bpy.context.scene.collection.objects.link(ob)
    vg = ob.vertex_groups.new(name="Palm")
    vg.add(list(range(len(verts))), 1.0, "REPLACE")
    return ob


# ================================================================= rig
def build_rig(specs):
    arm = bpy.data.armatures.new(RIG)
    ob = bpy.data.objects.new(RIG, arm)
    bpy.context.scene.collection.objects.link(ob)
    arm.display_type = "STICK"
    for o in bpy.context.view_layer.objects: o.select_set(False)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm.edit_bones

    def bone(name, head, tail, parent=None, connect=False, up=Z):
        b = eb.new(name); b.head = head; b.tail = tail; b.align_roll(up)
        if parent: b.parent = eb[parent]; b.use_connect = connect
        return b

    bone("Wrist", (0, 0, 0), (0, 0.03, 0))
    bone("Palm", (0, 0, 0), (0, 0.07, 0), "Wrist")
    for s in specs:
        J = s["joints"]
        prev = "Palm"
        for k in range(3):
            n = f"{s['name']}{k + 1}"
            bone(n, J[k], J[k + 1], prev, connect=k > 0, up=s["dorsal"])
            prev = n
    bpy.ops.object.mode_set(mode="OBJECT")
    return ob


def bind(rig, *meshes):
    for m in meshes:
        m.parent = rig
        m.matrix_parent_inverse = Matrix.Identity(4)
        mod = m.modifiers.new("Armature", "ARMATURE"); mod.object = rig


# ================================================================= poses and animation
def pose_base():
    p = dict(lx=0.0, ly=0.0, lz=0.0, roll=0.0, yaw=0.0, pitch=0.0, wflex=4.0, wdev=0.0, spr=0.12,
             tcx=6.0, tcz=4.0, tmcp=10.0, tip=12.0)
    for n, (a, b, c) in zip(("Index", "Middle", "Ring", "Pinky"), ((12, 20, 11), (16, 26, 14), (20, 30, 17), (24, 33, 19))):
        p[n + ".0"], p[n + ".1"], p[n + ".2"] = float(a), float(b), float(c)
    return p


def curl(p, mcp, pip, dip, casc=(1.0, 1.04, 1.08, 1.13)):
    for n, k in zip(("Index", "Middle", "Ring", "Pinky"), casc):
        p[n + ".0"], p[n + ".1"], p[n + ".2"] = mcp * k, pip * k, dip * k
    return p


def idle_pose(t):
    ph = 2 * math.pi * t / 2.0
    p = pose_base()
    p["lz"] = 0.0035 * math.sin(ph)
    p["pitch"] = 1.3 * math.sin(ph - 0.6)
    p["roll"] = 1.2 * math.sin(ph - 1.2)
    p["wflex"] += 2.5 * math.sin(ph - 1.0)
    p["spr"] += 0.08 * math.sin(ph - 1.8)
    for k, n in enumerate(("Index", "Middle", "Ring", "Pinky")):
        o = 3.0 * math.sin(ph - 1.4 - 0.3 * k)
        p[n + ".0"] += 0.5 * o; p[n + ".1"] += o; p[n + ".2"] += 0.8 * o
    o = 2.5 * math.sin(ph - 1.6)
    p["tmcp"] += o; p["tip"] += o
    return p


def P(base, **kw):
    d = dict(base); d.update(kw); return d


def thumb(p, tcx, tcz, tmcp, tip):
    return P(p, tcx=tcx, tcz=tcz, tmcp=tmcp, tip=tip)


EASE = {
    "lin": lambda x: x,
    "io": lambda x: 0.5 - 0.5 * math.cos(math.pi * x),
    "out": lambda x: 1 - (1 - x) ** 3,
    "out5": lambda x: 1 - (1 - x) ** 5,
    "in3": lambda x: x ** 3,
}
GROUPS = {"loc": ("lx", "ly", "lz"), "rot": ("roll", "yaw", "pitch"), "wrist": ("wflex", "wdev"), "spr": ("spr",),
          "thumb": ("tcx", "tcz", "tmcp", "tip")}
for _n in ("Index", "Middle", "Ring", "Pinky"):
    GROUPS[_n] = tuple(f"{_n}.{k}" for k in range(3))
LAG = {"loc": 0.0, "rot": 0.008, "wrist": 0.016, "spr": 0.022, "thumb": 0.024,
       "Index": 0.020, "Middle": 0.026, "Ring": 0.032, "Pinky": 0.038}


def moves():
    """keyed moves: name -> (duration s, [(time s, ease into this key, pose)])"""
    I0 = idle_pose(0.0)
    lift = [
        (0.00, "lin", I0),
        (0.10, "io", thumb(curl(P(I0, lz=-0.018, roll=12.0, pitch=-5.0, wflex=10.0, spr=0.45), 6, 8, 4, (1, 1, 1, 1)), -4, -10, 0, 2)),
        (0.25, "out5", thumb(curl(P(I0, lz=0.135, ly=0.010, roll=-100.0, pitch=9.0, wflex=16.0, spr=1.25), 24, 88, 64,
                                  (1, 1.0, 1.04, 1.08)), 12, -20, 26, 46)),
        (0.36, "io", thumb(curl(P(I0, lz=0.114, ly=0.004, roll=-86.0, pitch=4.0, wflex=9.0, spr=1.05), 14, 70, 48), 9, -15, 20, 36)),
        (0.47, "io", thumb(curl(P(I0, lz=0.120, ly=0.000, roll=-90.0, pitch=6.0, wflex=12.0, spr=1.15), 18, 80, 56,
                                (1, 1.0, 1.04, 1.08)), 10, -18, 24, 40)),
    ]
    slam = [
        (0.000, "lin", I0),
        (0.130, "out", thumb(curl(P(I0, lz=0.055, roll=68.0, pitch=22.0, wflex=-32.0, spr=0.75), -4, 4, 2), -6, -16, -4, 0)),
        (0.180, "io", thumb(curl(P(I0, lz=0.062, roll=78.0, pitch=25.0, wflex=-36.0, spr=0.85), -6, 2, 0), -6, -18, -4, 0)),
        (0.265, "in3", thumb(curl(P(I0, lz=-0.172, roll=93.0, pitch=-15.0, wflex=8.0, spr=1.30), -12, -2, -4), -8, -24, -8, -4)),
        (0.330, "out", thumb(curl(P(I0, lz=-0.133, roll=89.0, pitch=-7.0, wflex=2.0, spr=1.10), -3, 6, 3), -6, -19, -4, -2)),
        (0.400, "io", thumb(curl(P(I0, lz=-0.150, roll=90.0, pitch=-10.0, wflex=4.0, spr=1.20), -6, 2, 0), -6, -20, -4, -2)),
    ]
    push = [
        (0.000, "lin", I0),
        (0.130, "io", thumb(curl(P(I0, ly=-0.045, lz=0.008, roll=55.0, pitch=4.0, wflex=-28.0, spr=0.05), 22, 38, 22), 10, 0, 14, 16)),
        (0.235, "out5", thumb(curl(P(I0, ly=0.205, lz=0.016, roll=91.0, pitch=31.0, wflex=-68.0, spr=1.30), -14, -4, -3), -6, -24, -6, -6)),
        (0.320, "io", thumb(curl(P(I0, ly=0.172, lz=0.010, roll=90.0, pitch=27.0, wflex=-59.0, spr=1.10), -4, 3, 1), -5, -20, -4, -3)),
        (0.400, "io", thumb(curl(P(I0, ly=0.180, lz=0.012, roll=90.0, pitch=28.0, wflex=-62.0, spr=1.20), -8, 0, 0), -4, -20, -4, -2)),
    ]
    return {"Lift": (0.55, lift), "Slam": (0.45, slam), "Push": (0.45, push)}


def eval_keys(keys, t):
    out = {}
    for g, params in GROUPS.items():
        tt = max(0.0, t - LAG[g])
        i = 0
        while i < len(keys) - 1 and tt > keys[i + 1][0]:
            i += 1
        if i >= len(keys) - 1:
            for p in params: out[p] = keys[-1][2][p]
            continue
        (t0, _, a), (t1, ease, b) = keys[i], keys[i + 1]
        x = EASE[ease]((tt - t0) / (t1 - t0))
        for p in params: out[p] = a[p] + (b[p] - a[p]) * x
    return out


class Poser:
    def __init__(self, rig, specs):
        self.rig = rig
        self.B = {b.name: b.matrix_local.to_3x3() for b in rig.data.bones}
        self.specs = {s["name"]: s for s in specs}
        self.prev = {}

    def rot(self, name, R):
        B = self.B[name]
        q = (B.transposed() @ R @ B).to_quaternion()
        if name in self.prev: q.make_compatible(self.prev[name])
        self.prev[name] = q
        pb = self.rig.pose.bones[name]
        pb.rotation_mode = "QUATERNION"; pb.rotation_quaternion = q

    def apply(self, p):
        rad = math.radians
        R = Matrix.Rotation(rad(p["pitch"]), 3, X) @ Matrix.Rotation(rad(p["yaw"]), 3, Z) @ Matrix.Rotation(rad(p["roll"]), 3, Y)
        self.rot("Wrist", R)
        self.rig.pose.bones["Wrist"].location = Vector((p["lx"], p["ly"], p["lz"]))
        self.rot("Palm", Matrix.Rotation(rad(p["wdev"]), 3, X) @ Matrix.Rotation(rad(p["wflex"]), 3, -Z))
        for n in ("Index", "Middle", "Ring", "Pinky"):
            J = self.specs[n]["joints"]
            d = (J[1] - J[0]).normalized(); a = d.cross(X).normalized()
            self.rot(n + "1", Matrix.Rotation(rad(p["spr"] * SPREAD_K[n]), 3, X) @ Matrix.Rotation(rad(p[n + ".0"]), 3, a))
            self.rot(n + "2", Matrix.Rotation(rad(p[n + ".1"]), 3, a))
            self.rot(n + "3", Matrix.Rotation(rad(p[n + ".2"]), 3, a))
        s = self.specs["Thumb"]; J = s["joints"]
        d1 = (J[1] - J[0]).normalized()
        ax = d1.cross(X).normalized(); az = d1.cross(-Z).normalized()
        self.rot("Thumb1", Matrix.Rotation(rad(p["tcz"]), 3, az) @ Matrix.Rotation(rad(p["tcx"]), 3, ax))
        pad = -s["dorsal"]
        for k, key in ((2, "tmcp"), (3, "tip")):
            dk = (J[k] - J[k - 1]).normalized()
            padk = (pad - dk * pad.dot(dk)).normalized()
            self.rot(f"Thumb{k}", Matrix.Rotation(rad(p[key]), 3, dk.cross(padk).normalized()))

    def rest(self):
        for pb in self.rig.pose.bones:
            pb.rotation_mode = "QUATERNION"; pb.rotation_quaternion = Quaternion(); pb.location = Vector()
        self.prev = {}


def bake_action(rig, poser, name, dur, fn, cyclic=False):
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    ad = rig.animation_data or rig.animation_data_create()
    ad.action = act
    poser.prev = {}
    n = int(round(dur * FPS))
    for f in range(n + 1):
        poser.apply(fn(f / FPS))
        for pb in rig.pose.bones:
            pb.keyframe_insert("rotation_quaternion", frame=f, group=pb.name)
        rig.pose.bones["Wrist"].keyframe_insert("location", frame=f, group="Wrist")
    act.use_frame_range = True
    act.frame_start, act.frame_end = 0, n
    act.use_cyclic = cyclic
    return act


def set_action(rig, act):
    ad = rig.animation_data or rig.animation_data_create()
    ad.action = act
    if act is not None and hasattr(ad, "action_slot") and len(act.slots):
        ad.action_slot = act.slots[0]


def build_animations(rig, specs):
    bpy.context.preferences.edit.keyframe_new_interpolation_type = "LINEAR"
    sc = bpy.context.scene
    sc.render.fps, sc.render.fps_base = FPS, 1.0
    poser = Poser(rig, specs)
    bake_action(rig, poser, "Idle", 2.0, idle_pose, cyclic=True)
    for name, (dur, keys) in moves().items():
        bake_action(rig, poser, name, dur, lambda t, k=keys: eval_keys(k, t))
    set_action(rig, bpy.data.actions["Idle"])
    poser.rest()
    sc.frame_start, sc.frame_end = 0, int(2.0 * FPS)
    sc.frame_set(0)


# ================================================================= materials and scene
def build_materials(hand, rune):
    mat = bpy.data.materials.new(HAND); mat.use_nodes = True
    nt = mat.node_tree; bsdf = nt.nodes.get("Principled BSDF")
    attr = nt.nodes.new("ShaderNodeVertexColor"); attr.layer_name = "Color"; attr.location = (-400, 200)
    nt.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.75
    mat.use_backface_culling = True
    hand.data.materials.append(mat)
    rm = bpy.data.materials.new(RUNE); rm.use_nodes = True
    b = rm.node_tree.nodes.get("Principled BSDF")
    g = hex_srgb(RUNE_GLOW)
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in g]
    b.inputs["Base Color"].default_value = (*lin, 1.0)
    b.inputs["Emission Color"].default_value = (*lin, 1.0)
    b.inputs["Emission Strength"].default_value = 4.0
    rm.use_backface_culling = True
    rune.data.materials.append(rm)


def build_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    hand, specs = build_hand()
    rune = build_rune(hand)
    rig = build_rig(specs)
    bind(rig, hand, rune)
    build_materials(hand, rune)
    build_animations(rig, specs)
    tris = sum(len(p.vertices) - 2 for o in (hand, rune) for p in o.data.polygons)
    assert tris <= TRI_BUDGET, f"{tris} triangles"
    return rig


# ================================================================= report / export
def report():
    hand, rune, rig = bpy.data.objects[HAND], bpy.data.objects[RUNE], bpy.data.objects[RIG]
    for o in (hand, rune):
        me = o.data
        tris = sum(len(p.vertices) - 2 for p in me.polygons)
        ys = [v.co.y for v in me.vertices]; xs = [v.co.x for v in me.vertices]; zs = [v.co.z for v in me.vertices]
        print(f"MESH {o.name}: {tris} tris, {len(me.vertices)} verts, x {min(xs):.3f}..{max(xs):.3f}, "
              f"y {min(ys):.3f}..{max(ys):.3f}, z {min(zs):.3f}..{max(zs):.3f}", flush=True)
    print("BONES", [b.name for b in rig.data.bones], flush=True)
    for a in bpy.data.actions:
        f0, f1 = a.frame_range
        print(f"ACTION {a.name}: frames {f0:.0f}..{f1:.0f} = {(f1 - f0) / FPS:.3f} s", flush=True)


def export(path):
    rig = bpy.data.objects[RIG]
    sc = bpy.context.scene
    sc.render.fps, sc.render.fps_base = FPS, 1.0
    for o in bpy.context.view_layer.objects: o.select_set(False)
    for n in (RIG, HAND, RUNE): bpy.data.objects[n].select_set(True)
    bpy.context.view_layer.objects.active = rig
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.abspath(path), export_format="GLB", use_selection=True, export_yup=True, export_apply=False,
        export_texcoords=False, export_normals=True, export_tangents=False, export_attributes=False,
        export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_materials="EXPORT",
        export_cameras=False, export_lights=False, export_extras=False, export_skins=True, export_influence_nb=4,
        export_all_influences=False, export_def_bones=False, export_leaf_bone=False, export_rest_position_armature=True,
        export_animations=True, export_animation_mode="ACTIONS", export_frame_range=False, export_frame_step=1,
        export_force_sampling=True, export_anim_slide_to_zero=False, export_bake_animation=False,
        export_optimize_animation_size=True, export_anim_single_armature=True, export_reset_pose_bones=True,
        export_current_frame=False, export_morph=False, export_shared_accessors=True,
        export_optimize_animation_keep_anim_armature=False)
    print("EXPORTED", path, f"{os.path.getsize(path) / 1024:.1f} KB", flush=True)
    glb_summary(path)


def glb_summary(path):
    with open(path, "rb") as f:
        data = f.read()
    n = struct.unpack_from("<I", data, 12)[0]
    j = json.loads(data[20:20 + n])
    acc = j["accessors"]
    for m in j["meshes"]:
        for pr in m["primitives"]:
            a = pr["attributes"]
            col = acc[a["COLOR_0"]] if "COLOR_0" in a else None
            print(f"GLB mesh {m['name']}: {acc[pr['indices']]['count'] // 3} tris, {acc[a['POSITION']]['count']} verts, attrs "
                  f"{sorted(a)}" + (f", COLOR_0 {col['type']} ctype {col['componentType']} normalized {col.get('normalized', False)}"
                                    if col else ""), flush=True)
    for an in j.get("animations", []):
        tmax = max(acc[s["input"]]["max"][0] for s in an["samplers"])
        print(f"GLB animation {an['name']}: {tmax:.4f} s, {len(an['channels'])} channels", flush=True)


# ================================================================= preview contact sheet
def look_at(cam, target):
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()


def hand_center():
    """middle of the (posed) hand: 7 cm along the Palm bone from the wrist"""
    rig = bpy.data.objects[RIG]
    pb = rig.pose.bones["Palm"]
    return rig.matrix_world @ (pb.head + pb.matrix.to_3x3() @ Vector((0.0, 0.07, 0.0)))


def render_preview(path):
    import numpy as np
    sc = bpy.context.scene
    rig = bpy.data.objects[RIG]
    specs = digit_specs()
    poser = Poser(rig, specs)
    keep_action = rig.animation_data.action if rig.animation_data else None
    tmp = os.path.join(os.path.dirname(os.path.abspath(path)), "left_hand_panels_tmp")
    os.makedirs(tmp, exist_ok=True)
    added = []

    def new(ob):
        sc.collection.objects.link(ob); added.append(ob); return ob

    cam = new(bpy.data.objects.new("Preview camera", bpy.data.cameras.new("Preview camera")))
    sc.camera = cam
    cam.data.clip_start = 0.01
    key = new(bpy.data.objects.new("Preview key", bpy.data.lights.new("Preview key", "SUN")))
    key.data.energy = 3.4; key.data.color = (1.0, 0.95, 0.88); key.data.angle = math.radians(6)
    key.rotation_euler = (Vector((0.55, -0.75, 0.9)).to_track_quat("Z", "Y")).to_euler()
    rim = new(bpy.data.objects.new("Preview rim", bpy.data.lights.new("Preview rim", "SUN")))
    rim.data.energy = 2.2; rim.data.color = (0.55, 0.68, 1.0)
    rim.rotation_euler = (Vector((-0.7, 0.8, 0.45)).to_track_quat("Z", "Y")).to_euler()
    world = sc.world or bpy.data.worlds.new("World"); sc.world = world; world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.10, 0.12, 0.18, 1.0); bg.inputs["Strength"].default_value = 0.9
    label_mat = bpy.data.materials.new("Preview label"); label_mat.use_nodes = True
    lb = label_mat.node_tree.nodes.get("Principled BSDF")
    lb.inputs["Base Color"].default_value = (0, 0, 0, 1); lb.inputs["Emission Color"].default_value = (0.9, 0.9, 0.95, 1)
    lb.inputs["Emission Strength"].default_value = 1.0
    txt = new(bpy.data.objects.new("Preview label", bpy.data.curves.new("Preview label", "FONT")))
    txt.data.materials.append(label_mat)
    txt.parent = cam

    sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 48; sc.cycles.use_denoising = True
    S = 360
    sc.render.resolution_x = sc.render.resolution_y = S; sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "Standard"
    sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGB"

    panels = [("Rest", None, 0), ("Idle", "Idle", 30), ("Lift end", "Lift", 33), ("Slam end", "Slam", 27),
              ("Push end", "Push", 27)]
    files = []
    for row in range(2):
        for col, (label, act, frame) in enumerate(panels):
            if act is None:
                set_action(rig, None); poser.rest()
            else:
                set_action(rig, bpy.data.actions[act])
            sc.frame_set(frame)
            bpy.context.view_layer.update()
            if row == 0:          # fixed first-person-like camera: behind, right of and above the wrist
                cam.data.lens = 22
                cam.location = Vector((0.20, -0.25, 0.15))
                look_at(cam, Vector((-0.01, 0.12, 0.0)))
            else:                 # close 3/4 view from the front right, following the hand
                c = hand_center()
                cam.data.lens = 50
                cam.location = c + Vector((0.50, 0.52, 0.42)).normalized() * 0.42
                look_at(cam, c)
            half = 0.1 * 18.0 / cam.data.lens
            txt.data.body = label + ("  (first person)" if row == 0 and col == 0 else "")
            txt.data.size = half * 0.13
            txt.location = (-half * 0.92, half * 0.80, -0.1)
            txt.rotation_euler = (0, 0, 0)
            f = os.path.join(tmp, f"p{row}{col}.png")
            sc.render.filepath = f
            bpy.ops.render.render(write_still=True)
            files.append((row, col, f))
    sheet = np.zeros((2 * S, 5 * S, 4), dtype=np.float32)
    for row, col, f in files:
        img = bpy.data.images.load(f)
        px = np.array(img.pixels[:], dtype=np.float32).reshape(S, S, 4)
        y0 = (1 - row) * S
        sheet[y0:y0 + S, col * S:(col + 1) * S] = px
        bpy.data.images.remove(img)
    sheet[:, :, 3] = 1.0
    for col in range(1, 5): sheet[:, col * S - 1:col * S + 1, :3] = 0.04
    sheet[S - 1:S + 1, :, :3] = 0.04
    out = bpy.data.images.new("left_hand_preview", 5 * S, 2 * S, alpha=False)
    out.pixels.foreach_set(sheet.ravel())
    out.filepath_raw = os.path.abspath(path); out.file_format = "PNG"; out.save()
    bpy.data.images.remove(out)
    shutil.rmtree(tmp, ignore_errors=True)
    # leave the scene as it was built
    for ob in added: bpy.data.objects.remove(ob)
    bpy.data.materials.remove(label_mat)
    set_action(rig, keep_action); sc.frame_set(0)
    print("PREVIEW", path, flush=True)


opt = args()
if not all(n in bpy.data.objects for n in (HAND, RUNE, RIG)):
    build_scene()
report()
if opt["export"]: export(opt["export"])
if opt["preview"]: render_preview(opt["preview"])
if opt["save"]:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(opt["save"]), compress=True)
    print("SAVED", opt["save"], flush=True)
