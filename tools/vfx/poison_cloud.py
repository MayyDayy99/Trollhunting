"""Volumetric toon poison cloud for Troll Hunting, built and rendered headless in Blender (tested with 5.3).

A heavy, lingering column of toxic gas seen from the side (the game draws it as a camera-facing quad standing on
the ground): five billows stacked on each other, each a big core puff with smaller bumps on its upper side (bumpy
tops, heavy smooth undersides), the bottom one a wide mound that spreads out along the ground.
  frames 1-5   it grows from a low puff on the ground: billow after billow wells up out of the one below
  frames 6-12  it billows upward: the column stretches, every puff swells and rolls, the crown widens and two
               wisps tear off its sides
  frames 13-16 it thins out: puffs shrink, the bumps drop out one by one while noise erodes the edges first
The camera looks from slightly above the ground; the ground line sits BASE (8.5%) above the bottom of the cell, so the
game lifts the quad by ~0.415 x its size to stand the cloud on the ground.
The texture stores DATA, not colour (one 4x4 atlas of 256 px cells, 1024x1024):
  RGB = toon band: 0.10 ink outline, 0.32 shadow (undersides, crevices), 0.54 mid, 0.76 light (tops), 1.00 highlight
        (light = N.L from the upper left, darkened in the crevices by ambient occlusion)
  A   = coverage
The game tints the bands green (its own palette).

  blender -b --factory-startup --python tools/vfx/poison_cloud.py -- --save tools/vfx/poison_cloud.blend
  blender -b --factory-startup --python tools/vfx/poison_cloud.py -- --render --out OUTDIR [--preview]

--save writes the scene (opens in colour-preview mode: set the "Preview" value node to 0 for the game data).
--render rebuilds the scene from this script and packs the 16 frames into OUTDIR/poison_cloud_atlas.png
(frame 0 top-left, left-to-right, top-to-bottom); --preview renders the colour version instead.
"""
import math
import os
import random
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector, noise

FRAMES = 16
SIZE = 256
GRID = 4
NAME = "poison_cloud"
DATA = [0.10, 0.32, 0.54, 0.76, 1.00]                 # ink, shadow, mid, light, highlight
SHADE = [(0.00, 1), (0.46, 2), (0.68, 3), (0.90, 4)]  # (light threshold, band)
PREVIEW = [(0.06, 0.14, 0.05), (0.20, 0.42, 0.10), (0.40, 0.68, 0.16), (0.64, 0.88, 0.28), (0.90, 1.00, 0.62)]
LIGHT = Vector((-0.45, -0.38, 0.81)).normalized()   # upper left, high: the undersides fall into shadow
ELEV = 6.0            # camera elevation above the ground (degrees)
ORTHO = 1.95
BASE = 0.085          # the ground line sits this fraction of the cell above its bottom edge

# column height over time (the billows sit at fixed fractions of it)
HEIGHT = [(1, 0.36), (2, 0.52), (3, 0.70), (4, 0.86), (5, 0.98), (6, 1.06), (8, 1.18), (10, 1.27), (12, 1.34), (14, 1.39), (16, 1.43)]
# billows, bottom to top: one big core puff + smaller bumps on its upper side (bumpy tops, heavy smooth undersides).
# (name, height fraction, core radius, core stretch xyz, bumps, bump elevation range (rad), first frame it wells up,
#  sideways spread by the end, frame the core is gone by, sideways offset): a heavy mound on the ground, a chunky stem,
#  a swelling crown; the offsets zig-zag so the billows don't stack into a regular pile
BILLOWS = [("Ground pool", 0.11, 0.28, (1.30, 1.10, 0.80), 7, (-0.05, 0.85), -0.8, 0.22, 17.0, 0.00),
           ("Stem", 0.36, 0.25, (1.10, 1.05, 1.00), 5, (-0.60, 0.80), 1.0, 0.07, 16.8, 0.05),
           ("Stem high", 0.58, 0.245, (1.14, 1.05, 1.05), 5, (-0.60, 0.80), 2.0, 0.09, 17.4, -0.05),
           ("Crown", 0.80, 0.28, (1.18, 1.08, 0.95), 7, (-0.35, 1.20), 2.8, 0.13, 18.0, 0.03),
           ("Top", 0.985, 0.19, (1.00, 1.00, 1.00), 3, (0.00, 1.30), 3.6, 0.08, 17.2, -0.03)]


def args():
    a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    opt = {"save": None, "render": False, "out": None, "preview": False}
    i = 0
    while i < len(a):
        if a[i] == "--save": opt["save"] = a[i + 1]; i += 2
        elif a[i] == "--render": opt["render"] = True; i += 1
        elif a[i] == "--out": opt["out"] = a[i + 1]; i += 2
        elif a[i] == "--preview": opt["preview"] = True; i += 1
        else: i += 1
    return opt


def ramp(nodes, stops):
    r = nodes.new("ShaderNodeValToRGB"); cr = r.color_ramp; cr.interpolation = "CONSTANT"
    while len(cr.elements) > 1: cr.elements.remove(cr.elements[-1])
    cr.elements[0].position = stops[0][0]; cr.elements[0].color = (*stops[0][1], 1.0)
    for pos, col in stops[1:]:
        e = cr.elements.new(pos); e.color = (*col, 1.0)
    return r


def math_node(N, op, a=None, b=None, clamp=False, label=None):
    m = N.new("ShaderNodeMath"); m.operation = op; m.use_clamp = clamp
    if a is not None: m.inputs[0].default_value = a
    if b is not None: m.inputs[1].default_value = b
    if label: m.label = label
    return m


def lumpy(name, radius, seed, amp=0.10):
    """a round puff with small cauliflower bumps"""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=4, radius=radius)
    off = Vector((seed * 3.1, seed * 1.7, seed * 2.3))
    for v in bm.verts:
        n = v.co.normalized()
        v.co = n * radius * (1.0 + noise.noise(n * 1.2 + off) * amp + abs(noise.noise(n * 3.6 + off)) * amp * 0.9)
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    return ob


def build_material():
    mat = bpy.data.materials.new("PoisonCloud"); mat.use_nodes = True
    nt = mat.node_tree; N = nt.nodes; L = nt.links; N.clear()
    out = N.new("ShaderNodeOutputMaterial"); out.location = (1400, 0)
    erode = N.new("ShaderNodeValue"); erode.name = erode.label = "Erode"                     # animated: 0 -> ~0.5
    boil = N.new("ShaderNodeValue"); boil.name = boil.label = "Boil"                         # animated noise W
    preview = N.new("ShaderNodeValue"); preview.name = preview.label = "Preview"; preview.outputs[0].default_value = 1.0
    ink = N.new("ShaderNodeValue"); ink.name = ink.label = "Ink"; ink.outputs[0].default_value = 0.46    # outline width (smaller = thicker)
    for n, y in [(erode, 300), (boil, 150), (preview, 0), (ink, -150)]: n.location = (-1400, y)

    geo = N.new("ShaderNodeNewGeometry")
    dot = N.new("ShaderNodeVectorMath"); dot.operation = "DOT_PRODUCT"; dot.label = "N.L"
    L.new(geo.outputs["Normal"], dot.inputs[0]); dot.inputs[1].default_value = LIGHT
    lit = math_node(N, "MULTIPLY_ADD"); L.new(dot.outputs["Value"], lit.inputs[0]); lit.inputs[1].default_value = 0.5; lit.inputs[2].default_value = 0.5
    ao = N.new("ShaderNodeAmbientOcclusion"); ao.samples = 16; ao.inputs["Distance"].default_value = 0.20
    aok = math_node(N, "MULTIPLY_ADD"); L.new(ao.outputs["AO"], aok.inputs[0]); aok.inputs[1].default_value = 0.40; aok.inputs[2].default_value = 0.60
    shade = math_node(N, "MULTIPLY", label="Shade"); L.new(lit.outputs[0], shade.inputs[0]); L.new(aok.outputs[0], shade.inputs[1])
    tc = N.new("ShaderNodeTexCoord")
    nz = N.new("ShaderNodeTexNoise"); nz.noise_dimensions = "4D"; nz.inputs["Scale"].default_value = 2.4; nz.inputs["Detail"].default_value = 1.0
    L.new(tc.outputs["Object"], nz.inputs["Vector"]); L.new(boil.outputs[0], nz.inputs["W"])
    nzc = math_node(N, "MULTIPLY_ADD"); L.new(nz.outputs["Fac"], nzc.inputs[0]); nzc.inputs[1].default_value = 0.12; nzc.inputs[2].default_value = -0.06
    light = math_node(N, "ADD", clamp=True, label="Light"); L.new(shade.outputs[0], light.inputs[0]); L.new(nzc.outputs[0], light.inputs[1])
    bands = ramp(N, [(p, (b / 4, b / 4, b / 4)) for p, b in SHADE]); bands.label = "Light bands"
    L.new(light.outputs[0], bands.inputs["Fac"])

    # ink outline on every puff's silhouette (also inside the column where puffs overlap), thicker on the shadow side
    lw = N.new("ShaderNodeLayerWeight"); lw.inputs["Blend"].default_value = 0.5
    inkw = math_node(N, "MULTIPLY_ADD", label="Ink by light"); L.new(light.outputs[0], inkw.inputs[0]); inkw.inputs[1].default_value = 0.22; L.new(ink.outputs[0], inkw.inputs[2])
    edge = math_node(N, "GREATER_THAN"); L.new(lw.outputs["Facing"], edge.inputs[0]); L.new(inkw.outputs[0], edge.inputs[1])
    keepb = math_node(N, "SUBTRACT", a=1.0); L.new(edge.outputs[0], keepb.inputs[1])
    band = math_node(N, "MULTIPLY", label="Band 0..4 / 4"); L.new(bands.outputs["Color"], band.inputs[0]); L.new(keepb.outputs[0], band.inputs[1])
    data = ramp(N, [(max(0.0, (i - 0.5) / 4), (d, d, d)) for i, d in enumerate(DATA)]); data.label = "Band data"
    col = ramp(N, [(max(0.0, (i - 0.5) / 4), c) for i, c in enumerate(PREVIEW)]); col.label = "Band preview"
    L.new(band.outputs[0], data.inputs["Fac"]); L.new(band.outputs[0], col.inputs["Fac"])
    mix = N.new("ShaderNodeMix"); mix.data_type = "RGBA"
    L.new(preview.outputs[0], mix.inputs["Factor"]); L.new(data.outputs["Color"], mix.inputs[6]); L.new(col.outputs["Color"], mix.inputs[7])
    em = N.new("ShaderNodeEmission"); L.new(mix.outputs[2], em.inputs["Color"])

    # thinning out: noise holes, the rims go first
    nz2 = N.new("ShaderNodeTexNoise"); nz2.noise_dimensions = "4D"; nz2.inputs["Scale"].default_value = 2.6; nz2.inputs["Detail"].default_value = 3.0
    L.new(tc.outputs["Object"], nz2.inputs["Vector"]); L.new(boil.outputs[0], nz2.inputs["W"])
    er = math_node(N, "MULTIPLY_ADD"); L.new(lw.outputs["Facing"], er.inputs[0]); er.inputs[1].default_value = 0.28; L.new(erode.outputs[0], er.inputs[2])
    keep = math_node(N, "GREATER_THAN", label="Keep"); L.new(nz2.outputs["Fac"], keep.inputs[0]); L.new(er.outputs[0], keep.inputs[1])
    tr = N.new("ShaderNodeBsdfTransparent"); ms = N.new("ShaderNodeMixShader")
    L.new(keep.outputs[0], ms.inputs["Fac"]); L.new(tr.outputs[0], ms.inputs[1]); L.new(em.outputs[0], ms.inputs[2])
    L.new(ms.outputs[0], out.inputs["Surface"])

    for f, e in [(1, 0.0), (11, 0.0), (12, 0.04), (13, 0.12), (14, 0.24), (15, 0.37), (16, 0.50)]:
        erode.outputs[0].default_value = e; erode.outputs[0].keyframe_insert("default_value", frame=f)
    for f, w in [(1, 0.0), (FRAMES, 1.5)]:
        boil.outputs[0].default_value = w; boil.outputs[0].keyframe_insert("default_value", frame=f)
    return mat


def interp(table, f):
    for (f0, v0), (f1, v1) in zip(table, table[1:]):
        if f <= f1: return v0 + (v1 - v0) * max(0.0, (f - f0) / (f1 - f0))
    return table[-1][1]


def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


def collection(name):
    col = bpy.data.collections.new(name); bpy.context.scene.collection.children.link(col)
    return col


def build_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, FRAMES
    sc.render.fps = 24
    rng = random.Random(53)
    mat = build_material()

    def billow_state(b, f):
        """centre, size, sideways widening and growth of billow b at frame f"""
        _, zf, rc, st, _, _, fa, spread, _, dx = BILLOWS[b]
        H = interp(HEIGHT, f)
        prev = BILLOWS[b - 1][1] if b > 0 else 0.0
        grow = ease((f - fa) / 2.6)                                   # wells up out of the billow below
        swell = 1.0 + 0.13 * ease((f - 5.0) / 7.0)                    # swells while it rises
        thin = 1.0 - 0.20 * ease((f - 12.0) / 4.0)                    # thins out at the end
        k = (0.30 + 0.70 * grow) * swell * thin if f >= fa else 0.0
        z = (prev + (zf - prev) * grow) * H
        if b == 0: z = max(z, rc * st[2] * k * 0.92)                  # the pool sits on the ground
        x = dx * grow + 0.07 * math.sin(2.4 * zf + 0.30 * f) * zf * ease((f - 2.0) / 6.0)   # zig-zag + a gentle sway
        wide = 1.0 + spread * ease((f - 4.0) / 12.0)                  # the pool spreads, the crown widens
        return Vector((x, 0.0, z)), k, wide

    spin = lambda r: dict(rot=Vector((rng.uniform(0, 6.28), rng.uniform(0, 6.28), rng.uniform(0, 6.28))),
                          roll=Vector([rng.uniform(-r, r) for _ in range(3)]))
    puffs = []
    for b, (name, zf, rc, st, nb, (el0, el1), fa, spread, core_gone, _) in enumerate(BILLOWS):
        col = collection(name)
        puffs.append(dict(name=f"{name} core", b=b, col=col, kind="core", r=rc, d=Vector(), delay=0.0, gone=core_gone, **spin(0.06)))
        off = rng.uniform(0, 6.283)
        for i in range(nb):
            a = off + (i + rng.uniform(-0.3, 0.3)) / nb * 6.2832
            e = rng.uniform(el0, el1)
            d = Vector((math.cos(e) * math.cos(a), math.cos(e) * math.sin(a), math.sin(e)))
            puffs.append(dict(name=f"{name} bump {i + 1}", b=b, col=col, kind="bump", r=rc * rng.uniform(0.40, 0.58), d=d,
                              delay=rng.uniform(0.2, 1.4), gone=rng.uniform(12.5, 18.0), **spin(0.10)))
    col = collection("Wisps")
    for k in range(2):                     # two small wisps tear off the crown's sides and drift away
        puffs.append(dict(name=f"Wisp {k + 1}", b=3, col=col, kind="wisp", r=rng.uniform(0.085, 0.10), d=Vector((-1 if k == 0 else 1, -0.1, 0.1)),
                          delay=4.2 + k * 1.6, gone=12.0 + k * 1.2, **spin(0.15)))

    for i, p in enumerate(puffs):
        ob = lumpy(p["name"], p["r"], i + 1)
        ob.data.materials.append(mat); p["col"].objects.link(ob)
        ob.rotation_mode = "XYZ"
        _, _, rc, st, _, _, fa, _, _, _ = BILLOWS[p["b"]]
        for f in range(1, FRAMES + 1):
            c, k, wide = billow_state(p["b"], f)
            if p["kind"] == "core":                                    # shrinks away at the very end
                kc = k * (1.0 - ease((f - (p["gone"] - 2.2)) / 2.6))
                loc = c; scale = (kc * st[0] * wide, kc * st[1] * wide, kc * st[2])
            elif p["kind"] == "bump":                                  # sits on the core's upper side, rolls outward as it billows
                gb = ease((f - fa - p["delay"]) / 2.2)
                drop = 1.0 - ease((f - (p["gone"] - 2.2)) / 2.6)      # bumps drop out one by one at the end
                kb = k * (0.25 + 0.75 * gb) * drop if f >= fa + p["delay"] else 0.0
                reach = rc * 0.80 * k * (1.0 + 0.10 * ease((f - 5.0) / 7.0))
                loc = c + Vector((p["d"].x * st[0] * wide, p["d"].y * st[1] * wide * 0.8, p["d"].z * st[2])) * reach
                if p["b"] == 0: loc.z = max(loc.z, p["r"] * kb * 0.85)
                scale = (kb, kb, kb)
            else:                                                      # wisp: tears off the crown and drifts away
                age = f - fa - p["delay"]
                kw = ease(age / 1.2) * (1.0 - ease((f - p["gone"] + 1.8) / 1.8)) if age >= 0 else 0.0
                loc = c + Vector((p["d"].x * (rc * 1.25 * wide + 0.05 * max(age, 0)), p["d"].y, p["d"].z + 0.03 * max(age, 0)))
                scale = (kw, kw, kw)
            ob.location = loc; ob.scale = scale
            r = p["rot"] + p["roll"] * (f - 1)
            ob.rotation_euler = tuple(r) if p["kind"] != "core" else (0.0, 0.0, r.z)   # a stretched core only turns about Z (stays flat)
            for path in ("location", "scale", "rotation_euler"): ob.keyframe_insert(path, frame=f)

    cam = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
    sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = "ORTHO"; cam.data.ortho_scale = ORTHO
    e = math.radians(ELEV)
    up = Vector((0.0, math.sin(e), math.cos(e)))           # camera up vector on the screen
    cam.rotation_euler = (math.radians(90) - e, 0, 0)
    cam.location = Vector((0.0, -8.0 * math.cos(e), 8.0 * math.sin(e))) + up * ((0.5 - BASE) * ORTHO)   # ground line BASE above the bottom
    world = bpy.data.worlds.new("World"); world.use_nodes = True; sc.world = world
    bg = world.node_tree.nodes.get("Background")
    if bg: bg.inputs["Color"].default_value = (0.25, 0.30, 0.38, 1.0)
    sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 32; sc.cycles.use_denoising = False
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = SIZE; sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
    try: sc.view_settings.view_transform = "Raw"
    except TypeError: sc.view_settings.view_transform = "Standard"
    return sc


def render_atlas(out_dir, data=True):
    sc = build_scene()
    bpy.data.materials["PoisonCloud"].node_tree.nodes["Preview"].outputs[0].default_value = 0.0 if data else 1.0
    os.makedirs(out_dir, exist_ok=True)
    atlas = np.zeros((SIZE * GRID, SIZE * GRID, 4), dtype=np.float32)
    for i in range(FRAMES):
        sc.frame_set(1 + i)
        path = os.path.join(out_dir, f"frame_{i:02d}.png")
        sc.render.filepath = path; bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(path)
        px = np.array(img.pixels[:], dtype=np.float32).reshape(SIZE, SIZE, 4)[::-1]
        bpy.data.images.remove(img)
        r, c = divmod(i, GRID)
        atlas[r * SIZE:(r + 1) * SIZE, c * SIZE:(c + 1) * SIZE] = px
        print(f"FRAME {i + 1}/{FRAMES}", flush=True)
    name = NAME + ("_atlas" if data else "_preview")
    out = bpy.data.images.new(name, SIZE * GRID, SIZE * GRID, alpha=True)
    out.colorspace_settings.name = "Non-Color"
    out.pixels[:] = atlas[::-1].ravel()
    out.filepath_raw = os.path.join(out_dir, name + ".png"); out.file_format = "PNG"; out.save()
    print("ATLAS", out.filepath_raw, flush=True)


opt = args()
if opt["render"]:
    render_atlas(os.path.abspath(opt["out"] or NAME + "_out"), data=not opt["preview"])
if opt["save"]:
    build_scene()
    bpy.data.materials["PoisonCloud"].node_tree.nodes["Preview"].outputs[0].default_value = 1.0
    bpy.context.scene.frame_set(9)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(opt["save"]), compress=True)
    print("SAVED", opt["save"], flush=True)
