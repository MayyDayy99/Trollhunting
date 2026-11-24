"""Stylized toon smoke puff for Troll Hunting, built and rendered headless in Blender (tested with 5.3).

Two puff variants x 16 frames in one 8x4 atlas of 256 px cells (2048x1024): variant A = rows 0-1,
variant B = rows 2-3. Each puff is a cauliflower cluster of small lumps plus a few satellite pufflets;
the lumps billow out, rise (the top faster), then break off and vanish one by one while noise erodes
the edges. The texture stores DATA, not colour:
  RGB = toon band: 0.10 ink outline, 0.32 shadow, 0.56 mid, 0.78 light, 1.00 highlight
        (light = N.L from the upper left, darkened in the crevices by ambient occlusion)
  A   = coverage
The game tints the bands with each particle's own colour (soot, frost, poison...) and adds cool shadows /
warm highlights, so one atlas serves every smoke in the game.

  blender -b --factory-startup --python tools/vfx/smoke_puff.py -- --save tools/vfx/smoke_puff.blend
  blender -b --factory-startup --python tools/vfx/smoke_puff.py -- --render --out OUTDIR [--preview]

--render always rebuilds both variants from this script; the .blend holds variant A for viewing/tweaking.
"""
import math
import os
import random
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector, noise
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vfx_device import use_best_device  # noqa: E402  (CPU; VFX_DEVICE=GPU esetén a videókártya)

FRAMES = 16          # frames per variant
VARIANTS = 2
SIZE = 256
COLS, ROWS = 8, 4
OUTLINE = 0.10
BANDS = [(0.00, 0.32), (0.40, 0.56), (0.62, 0.78), (0.86, 1.00)]   # (light threshold, data grey)
PREVIEW = [(0.00, (0.30, 0.33, 0.45)), (0.40, (0.55, 0.58, 0.68)), (0.62, (0.80, 0.82, 0.88)), (0.86, (0.98, 0.97, 0.95))]
INK = (0.16, 0.17, 0.24)
LIGHT = Vector((-0.50, -0.45, 0.74)).normalized()   # upper left, slightly towards the camera


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


def lumpy_sphere(name, radius, seed):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=3, radius=radius)
    off = Vector((seed * 3.1, seed * 1.7, seed * 2.3))
    for v in bm.verts:
        n = v.co.normalized()
        v.co = n * radius * (1.0 + noise.noise(n * 1.4 + off) * 0.20 + noise.noise(n * 3.0 + off) * 0.06)
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def ramp(nodes, stops):
    r = nodes.new("ShaderNodeValToRGB"); cr = r.color_ramp; cr.interpolation = "CONSTANT"
    while len(cr.elements) > 1: cr.elements.remove(cr.elements[-1])
    cr.elements[0].position = stops[0][0]; cr.elements[0].color = (*stops[0][1], 1.0)
    for pos, col in stops[1:]:
        e = cr.elements.new(pos); e.color = (*col, 1.0)
    return r


def math_node(N, op, clamp=False):
    m = N.new("ShaderNodeMath"); m.operation = op; m.use_clamp = clamp
    return m


def build_material():
    mat = bpy.data.materials.new("SmokePuff"); mat.use_nodes = True
    nt = mat.node_tree; N = nt.nodes; L = nt.links; N.clear()
    out = N.new("ShaderNodeOutputMaterial")
    erode = N.new("ShaderNodeValue"); erode.name = erode.label = "Erode"
    boil = N.new("ShaderNodeValue"); boil.name = boil.label = "Boil"
    preview = N.new("ShaderNodeValue"); preview.name = preview.label = "Preview"; preview.outputs[0].default_value = 1.0
    ink = N.new("ShaderNodeValue"); ink.name = ink.label = "Ink"; ink.outputs[0].default_value = 0.86   # outline width (facing threshold)
    for n, y in [(erode, 300), (boil, 150), (preview, 0), (ink, -150)]: n.location = (-1200, y)

    geo = N.new("ShaderNodeNewGeometry")
    dot = N.new("ShaderNodeVectorMath"); dot.operation = "DOT_PRODUCT"
    L.new(geo.outputs["Normal"], dot.inputs[0]); dot.inputs[1].default_value = LIGHT
    lit = math_node(N, "MULTIPLY_ADD"); L.new(dot.outputs["Value"], lit.inputs[0]); lit.inputs[1].default_value = 0.5; lit.inputs[2].default_value = 0.5
    ao = N.new("ShaderNodeAmbientOcclusion"); ao.samples = 16; ao.inputs["Distance"].default_value = 0.35
    aok = math_node(N, "MULTIPLY_ADD"); L.new(ao.outputs["AO"], aok.inputs[0]); aok.inputs[1].default_value = 0.55; aok.inputs[2].default_value = 0.45
    shade = math_node(N, "MULTIPLY"); L.new(lit.outputs[0], shade.inputs[0]); L.new(aok.outputs[0], shade.inputs[1])
    tc = N.new("ShaderNodeTexCoord")
    nz = N.new("ShaderNodeTexNoise"); nz.noise_dimensions = "4D"; nz.inputs["Scale"].default_value = 2.2; nz.inputs["Detail"].default_value = 1.0
    L.new(tc.outputs["Object"], nz.inputs["Vector"]); L.new(boil.outputs[0], nz.inputs["W"])
    nzc = math_node(N, "MULTIPLY_ADD"); L.new(nz.outputs["Fac"], nzc.inputs[0]); nzc.inputs[1].default_value = 0.12; nzc.inputs[2].default_value = -0.06
    light = math_node(N, "ADD", clamp=True); L.new(shade.outputs[0], light.inputs[0]); L.new(nzc.outputs[0], light.inputs[1])

    data_ramp = ramp(N, [(p, (d, d, d)) for p, d in BANDS]); col_ramp = ramp(N, PREVIEW)
    L.new(light.outputs[0], data_ramp.inputs["Fac"]); L.new(light.outputs[0], col_ramp.inputs["Fac"])
    band = N.new("ShaderNodeMix"); band.data_type = "RGBA"
    L.new(preview.outputs[0], band.inputs["Factor"])
    L.new(data_ramp.outputs["Color"], band.inputs[6]); L.new(col_ramp.outputs["Color"], band.inputs[7])

    # ink outline on every lump's silhouette (also inside the cluster where lumps overlap: the "cauliflower" lines)
    lw = N.new("ShaderNodeLayerWeight"); lw.inputs["Blend"].default_value = 0.5
    edge = math_node(N, "GREATER_THAN"); L.new(lw.outputs["Facing"], edge.inputs[0]); L.new(ink.outputs[0], edge.inputs[1])
    inkc = N.new("ShaderNodeMix"); inkc.data_type = "RGBA"
    L.new(preview.outputs[0], inkc.inputs["Factor"])
    inkc.inputs[6].default_value = (OUTLINE, OUTLINE, OUTLINE, 1.0); inkc.inputs[7].default_value = (*INK, 1.0)
    final = N.new("ShaderNodeMix"); final.data_type = "RGBA"
    L.new(edge.outputs[0], final.inputs["Factor"]); L.new(band.outputs[2], final.inputs[6]); L.new(inkc.outputs[2], final.inputs[7])
    em = N.new("ShaderNodeEmission"); L.new(final.outputs[2], em.inputs["Color"])

    nz2 = N.new("ShaderNodeTexNoise"); nz2.noise_dimensions = "4D"; nz2.inputs["Scale"].default_value = 2.4; nz2.inputs["Detail"].default_value = 3.0
    L.new(tc.outputs["Object"], nz2.inputs["Vector"]); L.new(boil.outputs[0], nz2.inputs["W"])
    er = math_node(N, "MULTIPLY_ADD"); L.new(lw.outputs["Facing"], er.inputs[0]); er.inputs[1].default_value = 0.28; L.new(erode.outputs[0], er.inputs[2])
    keep = math_node(N, "GREATER_THAN"); L.new(nz2.outputs["Fac"], keep.inputs[0]); L.new(er.outputs[0], keep.inputs[1])
    tr = N.new("ShaderNodeBsdfTransparent"); ms = N.new("ShaderNodeMixShader")
    L.new(keep.outputs[0], ms.inputs["Fac"]); L.new(tr.outputs[0], ms.inputs[1]); L.new(em.outputs[0], ms.inputs[2])
    L.new(ms.outputs[0], out.inputs["Surface"])

    for f, e in [(1, 0.0), (7, 0.0), (9, 0.06), (11, 0.15), (13, 0.26), (15, 0.40), (16, 0.52)]:
        erode.outputs[0].default_value = e; erode.outputs[0].keyframe_insert("default_value", frame=f)
    for f, w in [(1, 0.0), (FRAMES, 1.2)]:
        boil.outputs[0].default_value = w; boil.outputs[0].keyframe_insert("default_value", frame=f)
    return mat


def build_scene(variant=0):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc["Variant"] = variant
    sc.frame_start, sc.frame_end = 1, FRAMES
    sc.render.fps = 24
    rng = random.Random(23 + variant * 41)
    mat = build_material()
    lumps = [(Vector((0.0, 0.0, 0.0)), 0.42, 0.0, False)]
    for k in range(13):                                   # cauliflower shell around the core, biased upwards
        a = rng.uniform(0, 6.283); el = rng.uniform(-0.25, 1.05)
        d = Vector((math.cos(a) * math.cos(el), math.sin(a) * math.cos(el) * 0.55, math.sin(el)))
        lumps.append((d * rng.uniform(0.32, 0.48), rng.uniform(0.18, 0.32), rng.uniform(0.0, 2.0), False))
    for k in range(5):                                    # satellite puffs that drift off and break away first
        a = rng.uniform(0, 6.283)
        d = Vector((math.cos(a), math.sin(a) * 0.4, rng.uniform(-0.3, 0.8))).normalized()
        lumps.append((d * rng.uniform(0.62, 0.78), rng.uniform(0.08, 0.13), rng.uniform(1.0, 3.0), True))
    for i, (p, s, delay, sat) in enumerate(lumps):
        ob = lumpy_sphere(f"Puff{i}", s, i + 1 + variant * 31)
        ob.data.materials.append(mat)
        ob.rotation_euler = (rng.uniform(0, 6.28), rng.uniform(0, 6.28), rng.uniform(0, 6.28))
        height = p.z + 0.5                                  # higher lumps rise faster
        out = p.normalized() if p.length > 1e-6 else Vector((0, 0, 1))
        start = 1 + delay
        gone = (11 + rng.uniform(0, 4.5)) if not sat else (8 + rng.uniform(0, 4))   # staggered break-up
        gone = min(gone, FRAMES - 0.5)
        if i == 0: gone = 14.0                             # the core breaks up too (no lone ball at the end)
        keys = [(1, 0.0 if start > 1.01 else 0.50, 0.0), (start, 0.36, 0.0), (start + 2, 0.92, 0.12), (start + 4, 1.0, 0.25),
                (gone - 3.0, 1.10, 0.6), (gone, 0.30, 0.8), (gone + 1.0, 0.0, 0.85)]
        seen = set()
        for f, k, t in sorted(keys, key=lambda x: x[0]):
            if round(f, 3) in seen: continue
            seen.add(round(f, 3))
            ob.scale = (k, k, k)
            ob.location = p * (0.70 + 0.30 * min(1, t * 1.6)) + out * (0.22 if sat else 0.08) * t + Vector((0, 0, (0.30 + 0.45 * height) * t))
            ob.keyframe_insert("scale", frame=f); ob.keyframe_insert("location", frame=f)
    cam = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
    sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = "ORTHO"; cam.data.ortho_scale = 1.95
    cam.location = (0, -8, 0.44); cam.rotation_euler = (math.radians(90), 0, 0)
    world = bpy.data.worlds.new("World"); world.use_nodes = True; sc.world = world
    bg = world.node_tree.nodes.get("Background")
    if bg: bg.inputs["Color"].default_value = (0.25, 0.32, 0.42, 1.0)
    sc.render.engine = "CYCLES"; use_best_device(sc); sc.cycles.samples = 32; sc.cycles.use_denoising = False
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = SIZE; sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
    try: sc.view_settings.view_transform = "Raw"
    except TypeError: sc.view_settings.view_transform = "Standard"
    return sc


def render_variant(out_dir, variant, data, atlas):
    sc = build_scene(variant)
    bpy.data.materials["SmokePuff"].node_tree.nodes["Preview"].outputs[0].default_value = 0.0 if data else 1.0
    for f in range(FRAMES):
        sc.frame_set(1 + f)
        path = os.path.join(out_dir, f"v{variant}_frame_{f:02d}.png")
        sc.render.filepath = path; bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(path)
        px = np.array(img.pixels[:], dtype=np.float32).reshape(SIZE, SIZE, 4)[::-1]
        bpy.data.images.remove(img)
        r, c = divmod(variant * FRAMES + f, COLS)
        atlas[r * SIZE:(r + 1) * SIZE, c * SIZE:(c + 1) * SIZE] = px
        print(f"VARIANT {variant} FRAME {f + 1}/{FRAMES}", flush=True)


def render_atlas(out_dir, data=True):
    os.makedirs(out_dir, exist_ok=True)
    atlas = np.zeros((SIZE * ROWS, SIZE * COLS, 4), dtype=np.float32)
    for v in range(VARIANTS): render_variant(out_dir, v, data, atlas)
    name = "smoke_puff_atlas" if data else "smoke_puff_preview"
    out = bpy.data.images.new(name, SIZE * COLS, SIZE * ROWS, alpha=True)
    out.colorspace_settings.name = "Non-Color"
    out.pixels[:] = atlas[::-1].ravel()
    out.filepath_raw = os.path.join(out_dir, name + ".png"); out.file_format = "PNG"; out.save()
    print("ATLAS", out.filepath_raw, flush=True)


opt = args()
if opt["render"]:
    render_atlas(os.path.abspath(opt["out"] or "smoke_puff_out"), data=not opt["preview"])
if opt["save"]:
    build_scene(0)
    bpy.data.materials["SmokePuff"].node_tree.nodes["Preview"].outputs[0].default_value = 1.0
    bpy.context.scene.frame_set(6)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(opt["save"]), compress=True)
    print("SAVED", opt["save"], flush=True)
