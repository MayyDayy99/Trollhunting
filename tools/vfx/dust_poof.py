"""Stylized ground dust poof for Troll Hunting, built and rendered headless in Blender (tested with 5.3).

A low, wide toon dust cloud: a ring of small irregular lumps rolls out sideways along the ground from the
impact (the side "wings" travel furthest and curl up), a puff in the middle bulges up, pebbles are kicked up
and tumble back down, then the lumps break off one by one while noise erodes the edges.
The camera looks at the ground from slightly above; the impact point sits low in the cell (the game lifts the
camera-facing quad by ~0.35 x size so the cloud's base stays on the ground).
The texture stores DATA, not colour (one 4x4 atlas of 256 px cells, 1024x1024):
  RGB = toon band: 0.10 ink outline, 0.32 shadow, 0.54 mid, 0.76 light, 1.00 highlight
        (light = N.L from the upper left, darkened in the crevices by ambient occlusion; pebbles are darker)
  A   = coverage
The game tints the bands earthy brown-grey (src/game/15-fire-burst.js, DUSTPOOF).

  blender -b --factory-startup --python tools/vfx/dust_poof.py -- --save tools/vfx/dust_poof.blend
  blender -b --factory-startup --python tools/vfx/dust_poof.py -- --render --out OUTDIR [--preview]

--save writes the scene (opens in colour-preview mode: set the "Preview" value node to 0 for the game data).
--render rebuilds the scene from this script and packs the 16 frames into OUTDIR/dust_poof_atlas.png.
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
NAME = "dust_poof"
DATA = [0.10, 0.32, 0.54, 0.76, 1.00]                 # ink, shadow, mid, light, highlight
SHADE = [(0.00, 1), (0.38, 2), (0.60, 3), (0.86, 4)]  # (light threshold, band)
PREVIEW = [(0.22, 0.17, 0.13), (0.44, 0.37, 0.30), (0.64, 0.56, 0.46), (0.82, 0.75, 0.64), (0.95, 0.91, 0.83)]
LIGHT = Vector((-0.50, -0.45, 0.74)).normalized()
ELEV = 11.0                                            # camera elevation above the ground (degrees)


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


def lumpy(name, radius, seed, subdiv=3, amp=0.10, flat=False):
    """a round puff with small cauliflower bumps (amp) - or, with flat=True and a big amp, a chipped pebble"""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    off = Vector((seed * 3.1, seed * 1.7, seed * 2.3))
    for v in bm.verts:
        n = v.co.normalized()
        v.co = n * radius * (1.0 + noise.noise(n * 1.2 + off) * amp + abs(noise.noise(n * 3.6 + off)) * amp * 0.9)
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = not flat
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def build_material():
    mat = bpy.data.materials.new("DustPoof"); mat.use_nodes = True
    nt = mat.node_tree; N = nt.nodes; L = nt.links; N.clear()
    out = N.new("ShaderNodeOutputMaterial"); out.location = (1400, 0)
    erode = N.new("ShaderNodeValue"); erode.name = erode.label = "Erode"
    boil = N.new("ShaderNodeValue"); boil.name = boil.label = "Boil"
    preview = N.new("ShaderNodeValue"); preview.name = preview.label = "Preview"; preview.outputs[0].default_value = 1.0
    ink = N.new("ShaderNodeValue"); ink.name = ink.label = "Ink"; ink.outputs[0].default_value = 0.74    # outline width (smaller = thicker)
    for n, y in [(erode, 300), (boil, 150), (preview, 0), (ink, -150)]: n.location = (-1400, y)

    geo = N.new("ShaderNodeNewGeometry")
    dot = N.new("ShaderNodeVectorMath"); dot.operation = "DOT_PRODUCT"; dot.label = "N.L"
    L.new(geo.outputs["Normal"], dot.inputs[0]); dot.inputs[1].default_value = LIGHT
    lit = math_node(N, "MULTIPLY_ADD"); L.new(dot.outputs["Value"], lit.inputs[0]); lit.inputs[1].default_value = 0.5; lit.inputs[2].default_value = 0.5
    ao = N.new("ShaderNodeAmbientOcclusion"); ao.samples = 16; ao.inputs["Distance"].default_value = 0.30
    aok = math_node(N, "MULTIPLY_ADD"); L.new(ao.outputs["AO"], aok.inputs[0]); aok.inputs[1].default_value = 0.55; aok.inputs[2].default_value = 0.45
    shade = math_node(N, "MULTIPLY", label="Shade"); L.new(lit.outputs[0], shade.inputs[0]); L.new(aok.outputs[0], shade.inputs[1])
    # per-object tone: pebbles are darker than the dust (object property "tone", 1 = dust)
    tone = N.new("ShaderNodeAttribute"); tone.attribute_type = "OBJECT"; tone.attribute_name = "tone"; tone.label = "Tone (object)"
    toned = math_node(N, "MULTIPLY"); L.new(shade.outputs[0], toned.inputs[0]); L.new(tone.outputs["Fac"], toned.inputs[1])
    tc = N.new("ShaderNodeTexCoord")
    nz = N.new("ShaderNodeTexNoise"); nz.noise_dimensions = "4D"; nz.inputs["Scale"].default_value = 2.4; nz.inputs["Detail"].default_value = 1.0
    L.new(tc.outputs["Object"], nz.inputs["Vector"]); L.new(boil.outputs[0], nz.inputs["W"])
    nzc = math_node(N, "MULTIPLY_ADD"); L.new(nz.outputs["Fac"], nzc.inputs[0]); nzc.inputs[1].default_value = 0.12; nzc.inputs[2].default_value = -0.06
    light = math_node(N, "ADD", clamp=True, label="Light"); L.new(toned.outputs[0], light.inputs[0]); L.new(nzc.outputs[0], light.inputs[1])
    bands = ramp(N, [(p, (b / 4, b / 4, b / 4)) for p, b in SHADE]); bands.label = "Light bands"
    L.new(light.outputs[0], bands.inputs["Fac"])

    # ink outline on every lump's silhouette (also inside the cloud where lumps overlap), thicker on the shadow side
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

    nz2 = N.new("ShaderNodeTexNoise"); nz2.noise_dimensions = "4D"; nz2.inputs["Scale"].default_value = 2.6; nz2.inputs["Detail"].default_value = 3.0
    L.new(tc.outputs["Object"], nz2.inputs["Vector"]); L.new(boil.outputs[0], nz2.inputs["W"])
    er = math_node(N, "MULTIPLY_ADD"); L.new(lw.outputs["Facing"], er.inputs[0]); er.inputs[1].default_value = 0.28; L.new(erode.outputs[0], er.inputs[2])
    keep = math_node(N, "GREATER_THAN", label="Keep"); L.new(nz2.outputs["Fac"], keep.inputs[0]); L.new(er.outputs[0], keep.inputs[1])
    tr = N.new("ShaderNodeBsdfTransparent"); ms = N.new("ShaderNodeMixShader")
    L.new(keep.outputs[0], ms.inputs["Fac"]); L.new(tr.outputs[0], ms.inputs[1]); L.new(em.outputs[0], ms.inputs[2])
    L.new(ms.outputs[0], out.inputs["Surface"])

    for f, e in [(1, 0.0), (7, 0.0), (9, 0.05), (11, 0.13), (13, 0.24), (15, 0.38), (16, 0.50)]:
        erode.outputs[0].default_value = e; erode.outputs[0].keyframe_insert("default_value", frame=f)
    for f, w in [(1, 0.0), (FRAMES, 1.3)]:
        boil.outputs[0].default_value = w; boil.outputs[0].keyframe_insert("default_value", frame=f)
    return mat


def keys(ob, ks):
    for f, p, s, rot in sorted(ks, key=lambda k: k[0]):
        ob.location = p; ob.scale = (s, s, s) if not isinstance(s, tuple) else s
        ob.keyframe_insert("location", frame=f); ob.keyframe_insert("scale", frame=f)
        if rot is not None:
            ob.rotation_euler = rot; ob.keyframe_insert("rotation_euler", frame=f)


def collection(name):
    col = bpy.data.collections.new(name); bpy.context.scene.collection.children.link(col)
    return col


def move_to(ob, col):
    for c in list(ob.users_collection): c.objects.unlink(ob)
    col.objects.link(ob)


def build_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, FRAMES
    sc.render.fps = 24
    rng = random.Random(31)
    mat = build_material()
    ring_col, mid_col, peb_col = collection("Dust ring"), collection("Dust puff"), collection("Pebbles")

    # RING: puffs roll out along the ground; the sides (left/right of the camera) travel furthest, grow and curl up.
    # Two tiers: big puffs on the ground, smaller ones riding on top of them -> a billowy cauliflower silhouette.
    n = 22
    for i in range(n):
        a = (i + rng.uniform(-0.35, 0.35)) / n * 6.2832
        side = abs(math.cos(a))                       # 1 = left/right wing, 0 = front/back
        front = -math.sin(a)                          # +1 = towards the camera
        d = Vector((math.cos(a), math.sin(a), 0.0))
        for tier in (0, 1):
            if tier == 1 and rng.random() < 0.35 + 0.4 * (1 - side): continue
            R = (0.38 + 0.52 * side ** 1.3) * rng.uniform(0.92, 1.06) * (0.86 if tier else 1.0)
            s = (rng.uniform(0.11, 0.21) if tier == 0 else rng.uniform(0.08, 0.13)) * (1.0 + 0.30 * side) * (0.80 if front > 0.6 else 1.0)
            ob = lumpy(f"Ring{i:02d}{'ab'[tier]}", s, i * 2 + tier + 1)
            ob.data.materials.append(mat); ob["tone"] = 1.0; move_to(ob, ring_col)
            rot = (rng.uniform(0, 6.28), rng.uniform(0, 6.28), rng.uniform(0, 6.28))
            curl = (0.05 + 0.30 * side ** 2) * (1.0 + 0.6 * tier)   # wings lift as they roll out, the top tier most
            gone = min(FRAMES - 0.3, rng.uniform(11.0, 15.2) - 1.8 * (1 - side) - 1.0 * tier)   # staggered break-up
            # (frame, travel, scale, lift): fast push out, then slow billowing growth
            prog = [(1, 0.10, 0.35, 0.0), (2, 0.40, 0.70, 0.12), (3, 0.60, 0.88, 0.28), (5, 0.78, 1.00, 0.52), (8, 0.90, 1.14, 0.78),
                    (gone - 2.6, 0.97, 1.22, 0.95), (gone - 0.9, 1.0, 0.75, 1.02), (gone, 1.01, 0.0, 1.04)]
            ks = []
            for f, t, k, up in prog:
                p = d * R * t + Vector((0.0, 0.0, s * k * (0.80 + 1.25 * tier) + curl * up))
                roll = 0.9 * t * (1 if math.cos(a) > 0 else -1)
                ks.append((f, tuple(p), k, (rot[0], rot[1] + roll, rot[2])))
            keys(ob, ks)

    # PUFF in the middle: bulges up out of the impact, billows, sinks back and breaks into pieces
    for i, (x, y, z, s, gone) in enumerate([(0.00, 0.06, 0.20, 0.24, 12.8), (-0.22, 0.10, 0.15, 0.19, 11.2), (0.23, 0.02, 0.14, 0.19, 12.0),
                                            (0.07, 0.16, 0.38, 0.17, 13.6), (-0.11, -0.04, 0.34, 0.15, 10.4), (0.15, -0.10, 0.10, 0.14, 9.8),
                                            (-0.02, 0.0, 0.52, 0.12, 11.5)]):
        ob = lumpy(f"Puff{i}", s, 40 + i)
        ob.data.materials.append(mat); ob["tone"] = 1.0; move_to(ob, mid_col)
        rot = (rng.uniform(0, 6.28), rng.uniform(0, 6.28), rng.uniform(0, 6.28))
        p = Vector((x, y, z)); out = Vector((x, y, 0.0)) * 0.9
        keys(ob, [(1, tuple(p * 0.4), 0.45, rot), (2, tuple(p + Vector((0, 0, 0.06))), 0.95, None), (4, tuple(p + out * 0.4 + Vector((0, 0, 0.14))), 1.12, None),
                  (7, tuple(p + out * 0.7 + Vector((0, 0, 0.20))), 1.22, None), (gone - 2.0, tuple(p + out + Vector((0, 0, 0.22))), 1.05, None),
                  (gone - 0.7, tuple(p + out * 1.1 + Vector((0, 0, 0.24))), 0.50, None), (gone, tuple(p + out * 1.15 + Vector((0, 0, 0.24))), 0.0, None)])

    # little dust tufts that pop off the top early and drift away
    for i in range(5):
        a = rng.uniform(0.3, 2.85); d = Vector((math.cos(a), rng.uniform(-0.3, 0.3), math.sin(a) * 0.7))
        ob = lumpy(f"Tuft{i}", rng.uniform(0.06, 0.09), 60 + i)
        ob.data.materials.append(mat); ob["tone"] = 1.0; move_to(ob, mid_col)
        p0 = Vector((d.x * 0.25, d.y * 0.2, 0.32)); gone = rng.uniform(7.5, 11.0)
        keys(ob, [(1, tuple(p0), 0.0, None), (2, tuple(p0), 0.6, None), (4, tuple(p0 + d * 0.42), 1.0, None),
                  (gone - 1.5, tuple(p0 + d * 0.72 + Vector((0, 0, 0.06))), 0.9, None), (gone, tuple(p0 + d * 0.80 + Vector((0, 0, 0.08))), 0.0, None)])

    # PEBBLES: small dark rocks kicked up, tumbling along a ballistic arc, bouncing once and gone
    g = -0.048
    for i in range(12):
        a = (i + rng.uniform(-0.3, 0.3)) / 12 * 6.283; side = abs(math.cos(a))
        r = rng.uniform(0.042, 0.068)
        ob = lumpy(f"Pebble{i:02d}", r, 80 + i, subdiv=1, amp=0.40, flat=True)
        ob.data.materials.append(mat); ob["tone"] = 0.42; move_to(ob, peb_col)
        vx, vy = math.cos(a) * rng.uniform(0.030, 0.058) * (0.5 + 0.7 * side), math.sin(a) * 0.03
        vz = rng.uniform(0.25, 0.31); f0 = 1.2 + rng.uniform(0, 0.9)
        t_land = -2 * vz / g; f_land = f0 + t_land
        rot0 = Vector((rng.uniform(0, 6.28), rng.uniform(0, 6.28), rng.uniform(0, 6.28))); spin = Vector([rng.uniform(-0.6, 0.6) for _ in range(3)])
        ks = [(1, (0, 0, 0.02), 0.0, tuple(rot0)), (f0 - 0.4, (0, 0, 0.02), 0.0, tuple(rot0))]
        f = f0
        while f <= min(FRAMES, f_land + 3.0):
            t = f - f0
            if f <= f_land:
                p = Vector((vx * t, vy * t, r + vz * t + 0.5 * g * t * t))
            else:   # one small bounce, then it settles and fades
                tb = f - f_land
                p = Vector((vx * (t_land + tb * 0.5), vy * (t_land + tb * 0.5), r + max(0.0, vz * 0.25 * tb + 0.5 * g * tb * tb)))
            sc_ = 1.0 if f < f_land + 1.5 else max(0.0, 1.0 - (f - f_land - 1.5) / 1.5)
            ks.append((f, tuple(p), sc_, tuple(rot0 + spin * t)))
            f += 1.0
        ks.append((f, ks[-1][1], 0.0, None))
        keys(ob, ks)

    cam = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
    sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = "ORTHO"; cam.data.ortho_scale = 2.55
    e = math.radians(ELEV)
    # the impact point (origin) lands ~17% above the bottom of the cell: aim the camera 0.33*ortho above it (on screen)
    up = Vector((0.0, math.sin(e), math.cos(e)))          # camera up vector on the screen
    cam.rotation_euler = (math.radians(90) - e, 0, 0)
    cam.location = Vector((0.0, -8.0 * math.cos(e), 8.0 * math.sin(e))) + up * (0.33 * cam.data.ortho_scale)
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
    bpy.data.materials["DustPoof"].node_tree.nodes["Preview"].outputs[0].default_value = 0.0 if data else 1.0
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
    bpy.data.materials["DustPoof"].node_tree.nodes["Preview"].outputs[0].default_value = 1.0
    bpy.context.scene.frame_set(5)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(opt["save"]), compress=True)
    print("SAVED", opt["save"], flush=True)
