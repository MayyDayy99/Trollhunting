"""Stylized fire burst for Troll Hunting, built and rendered headless in Blender (tested with 5.3).

Builds a cartoon explosion from noise-lumped spheres, shades it in hard heat bands, and renders a
flipbook. The game texture stores DATA, not colour: RGB = heat band (0..1, the game's shader maps it
to the fire palette), A = coverage (with animated noise erosion so it breaks up as it fades).

  blender -b --factory-startup --python tools/vfx/fire_burst.py -- --save tools/vfx/fire_burst.blend
  blender -b tools/vfx/fire_burst.blend --python tools/vfx/fire_burst.py -- --render --out OUTDIR

--save writes the scene (opens in colour-preview mode: set the "Preview" value node to 0 for data).
--render renders FRAMES frames (data mode; add --preview for the colour version) to OUTDIR and packs them into OUTDIR/fire_burst_atlas.png
(4x4 grid, frame 0 top-left, left-to-right, top-to-bottom).
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

FRAMES = 16          # flipbook frames (4x4 atlas)
SIZE = 256           # pixels per frame
GRID = 4
PALETTE = [          # heat band -> preview colour (the game uses its own palette for the same bands)
    (0.00, (0.09, 0.06, 0.05)),   # smoke
    (0.20, (0.55, 0.12, 0.05)),   # deep red
    (0.42, (1.00, 0.36, 0.06)),   # orange
    (0.64, (1.00, 0.70, 0.22)),   # yellow
    (0.84, (1.00, 0.96, 0.78)),   # white-hot core
]
DATA_LEVELS = [0.10, 0.32, 0.54, 0.76, 1.00]   # grey value written for each band (same order as PALETTE)


def args():
    a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    opt = {"save": None, "render": False, "out": None, "preview": False}
    i = 0
    while i < len(a):
        if a[i] == "--save": opt["save"] = a[i + 1]; i += 2
        elif a[i] == "--render": opt["render"] = True; i += 1
        elif a[i] == "--preview": opt["preview"] = True; i += 1
        elif a[i] == "--out": opt["out"] = a[i + 1]; i += 2
        else: i += 1
    return opt


def lumpy_sphere(name, radius, seed):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=4, radius=radius)
    off = Vector((seed * 3.1, seed * 1.7, seed * 2.3))
    for v in bm.verts:
        n = v.co.normalized()
        lump = noise.noise(n * 1.6 + off) * 0.22 + noise.noise(n * 3.4 + off) * 0.08
        v.co = n * radius * (1.0 + lump)
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def ramp(nodes, stops, constant=True):
    r = nodes.new("ShaderNodeValToRGB")
    cr = r.color_ramp
    cr.interpolation = "CONSTANT" if constant else "LINEAR"
    while len(cr.elements) > 1: cr.elements.remove(cr.elements[-1])
    cr.elements[0].position = stops[0][0]; cr.elements[0].color = (*stops[0][1], 1.0)
    for pos, col in stops[1:]:
        e = cr.elements.new(pos); e.color = (*col, 1.0)
    return r


def build_material():
    mat = bpy.data.materials.new("FireBurst")
    mat.use_nodes = True
    nt = mat.node_tree; N = nt.nodes; L = nt.links
    N.clear()
    out = N.new("ShaderNodeOutputMaterial")

    heat_t = N.new("ShaderNodeValue"); heat_t.label = heat_t.name = "Heat"            # animated: 1 -> 0
    erode = N.new("ShaderNodeValue"); erode.label = erode.name = "Erode"              # animated: 0 -> ~0.8
    boil = N.new("ShaderNodeValue"); boil.label = boil.name = "Boil"                  # animated noise W
    preview = N.new("ShaderNodeValue"); preview.label = preview.name = "Preview"      # 1 colour, 0 data
    preview.outputs[0].default_value = 1.0

    lw = N.new("ShaderNodeLayerWeight"); lw.inputs["Blend"].default_value = 0.45
    core = N.new("ShaderNodeMath"); core.operation = "SUBTRACT"; core.inputs[0].default_value = 1.0
    L.new(lw.outputs["Facing"], core.inputs[1])                                        # 1 at the centre of each lump

    obj = N.new("ShaderNodeObjectInfo")
    tc = N.new("ShaderNodeTexCoord")
    nz = N.new("ShaderNodeTexNoise"); nz.noise_dimensions = "4D"
    nz.inputs["Scale"].default_value = 2.6; nz.inputs["Detail"].default_value = 3.0
    L.new(tc.outputs["Object"], nz.inputs["Vector"]); L.new(boil.outputs[0], nz.inputs["W"])

    # heat = Heat(t) * (0.45 + 0.75*core) + (noise - 0.5)*0.5 + (random - 0.5)*0.15
    m1 = N.new("ShaderNodeMath"); m1.operation = "MULTIPLY_ADD"
    L.new(core.outputs[0], m1.inputs[0]); m1.inputs[1].default_value = 0.75; m1.inputs[2].default_value = 0.45
    m2 = N.new("ShaderNodeMath"); m2.operation = "MULTIPLY"
    L.new(m1.outputs[0], m2.inputs[0]); L.new(heat_t.outputs[0], m2.inputs[1])
    nzc = N.new("ShaderNodeMath"); nzc.operation = "MULTIPLY_ADD"
    L.new(nz.outputs["Fac"], nzc.inputs[0]); nzc.inputs[1].default_value = 0.5; nzc.inputs[2].default_value = -0.25
    rnd = N.new("ShaderNodeMath"); rnd.operation = "MULTIPLY_ADD"
    L.new(obj.outputs["Random"], rnd.inputs[0]); rnd.inputs[1].default_value = 0.15; rnd.inputs[2].default_value = -0.075
    h1 = N.new("ShaderNodeMath"); h1.operation = "ADD"
    L.new(m2.outputs[0], h1.inputs[0]); L.new(nzc.outputs[0], h1.inputs[1])
    heat = N.new("ShaderNodeMath"); heat.operation = "ADD"; heat.use_clamp = True
    L.new(h1.outputs[0], heat.inputs[0]); L.new(rnd.outputs[0], heat.inputs[1])

    data_ramp = ramp(N, [(p, (d, d, d)) for (p, _), d in zip(PALETTE, DATA_LEVELS)])
    col_ramp = ramp(N, PALETTE)
    L.new(heat.outputs[0], data_ramp.inputs["Fac"]); L.new(heat.outputs[0], col_ramp.inputs["Fac"])
    mix = N.new("ShaderNodeMix"); mix.data_type = "RGBA"
    L.new(preview.outputs[0], mix.inputs["Factor"])
    L.new(data_ramp.outputs["Color"], mix.inputs[6]); L.new(col_ramp.outputs["Color"], mix.inputs[7])
    em = N.new("ShaderNodeEmission"); em.inputs["Strength"].default_value = 1.0
    L.new(mix.outputs[2], em.inputs["Color"])

    # erosion: a second, coarser noise; pixels whose noise falls below Erode become transparent (hard edge)
    nz2 = N.new("ShaderNodeTexNoise"); nz2.noise_dimensions = "4D"
    nz2.inputs["Scale"].default_value = 1.7; nz2.inputs["Detail"].default_value = 2.0
    L.new(tc.outputs["Object"], nz2.inputs["Vector"]); L.new(boil.outputs[0], nz2.inputs["W"])
    edge = N.new("ShaderNodeMath"); edge.operation = "MULTIPLY_ADD"                   # lumps erode from the rim first
    L.new(lw.outputs["Facing"], edge.inputs[0]); edge.inputs[1].default_value = 0.35; L.new(erode.outputs[0], edge.inputs[2])
    keep = N.new("ShaderNodeMath"); keep.operation = "GREATER_THAN"
    L.new(nz2.outputs["Fac"], keep.inputs[0]); L.new(edge.outputs[0], keep.inputs[1])
    tr = N.new("ShaderNodeBsdfTransparent")
    ms = N.new("ShaderNodeMixShader")
    L.new(keep.outputs[0], ms.inputs["Fac"]); L.new(tr.outputs[0], ms.inputs[1]); L.new(em.outputs[0], ms.inputs[2])
    L.new(ms.outputs[0], out.inputs["Surface"])

    # timing (frames 1..FRAMES): white-hot flash, cooling through the bands, smoke, eroding away
    for f, h, e in [(1, 1.25, 0.0), (3, 1.15, 0.0), (6, 0.85, 0.0), (8, 0.60, 0.04), (10, 0.38, 0.10), (12, 0.20, 0.22), (14, 0.10, 0.40), (16, 0.04, 0.62)]:
        heat_t.outputs[0].default_value = h; heat_t.outputs[0].keyframe_insert("default_value", frame=f)
        erode.outputs[0].default_value = e; erode.outputs[0].keyframe_insert("default_value", frame=f)
    for f, w in [(1, 0.0), (16, 1.6)]:
        boil.outputs[0].default_value = w; boil.outputs[0].keyframe_insert("default_value", frame=f)
    for n, x in zip([heat_t, erode, boil, preview], [-900, -900, -900, -900]): n.location.x = x
    heat_t.location.y, erode.location.y, boil.location.y, preview.location.y = 300, 150, 0, -150
    return mat


def build_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, FRAMES
    sc.render.fps = 24
    random.seed(7)
    mat = build_material()
    blobs = [(0, 0, 0.15, 0.62, 0)] + [
        (math.cos(a) * r, math.sin(a) * r * 0.5, z, s, d)
        for a, r, z, s, d in [(0.3, 0.62, 0.45, 0.46, 1), (2.2, 0.66, 0.30, 0.44, 1), (4.0, 0.58, 0.55, 0.40, 1),
                              (5.3, 0.70, 0.05, 0.38, 2), (1.2, 0.48, 0.92, 0.36, 2), (3.3, 0.74, -0.15, 0.34, 2),
                              (0.9, 0.80, -0.20, 0.30, 3), (4.7, 0.50, 1.05, 0.30, 3)]]
    for i, (x, y, z, s, delay) in enumerate(blobs):
        ob = lumpy_sphere(f"Lump{i}", s, i + 1)
        ob.data.materials.append(mat)
        ob.rotation_euler = (random.uniform(0, 6.28), random.uniform(0, 6.28), random.uniform(0, 6.28))
        start = 1 + delay
        out = Vector((x, y, z)).normalized() if (x or y or z) else Vector((0, 0, 1))
        keys = [(start, 0.25 if delay == 0 else 0.06, 0.0), (start + 1, 0.72, 0.30), (start + 3, 1.0, 0.62), (FRAMES - 4, 1.12, 0.86), (FRAMES, 1.18, 1.0)]
        for f, k, rise in keys:
            ob.scale = (k, k, k)
            ob.location = Vector((x, y, z)) * (0.55 + 0.45 * rise) + out * 0.10 * rise + Vector((0, 0, 0.55 * rise))
            ob.keyframe_insert("scale", frame=f); ob.keyframe_insert("location", frame=f)
        if start > 1:
            ob.scale = (0.0, 0.0, 0.0); ob.keyframe_insert("scale", frame=1)
    cam = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
    sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = "ORTHO"; cam.data.ortho_scale = 3.9
    cam.location = (0, -8, 0.55); cam.rotation_euler = (math.radians(90), 0, 0)
    world = bpy.data.worlds.new("World"); world.use_nodes = True; sc.world = world
    bg = world.node_tree.nodes.get("Background")
    if bg: bg.inputs["Color"].default_value = (0.02, 0.03, 0.05, 1.0)
    sc.render.engine = "CYCLES"
    use_best_device(sc); sc.cycles.samples = 24; sc.cycles.use_denoising = False
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = SIZE; sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
    try: sc.view_settings.view_transform = "Raw"
    except TypeError: sc.view_settings.view_transform = "Standard"
    return sc


def render_atlas(out_dir, data=True):
    sc = bpy.context.scene
    mat = bpy.data.materials["FireBurst"]
    mat.node_tree.nodes["Preview"].outputs[0].default_value = 0.0 if data else 1.0   # data mode for the game
    os.makedirs(out_dir, exist_ok=True)
    atlas = np.zeros((SIZE * GRID, SIZE * GRID, 4), dtype=np.float32)   # top-down rows
    for i in range(FRAMES):
        sc.frame_set(1 + i)
        path = os.path.join(out_dir, f"frame_{i:02d}.png")
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(path)
        px = np.array(img.pixels[:], dtype=np.float32).reshape(SIZE, SIZE, 4)[::-1]   # Blender rows are bottom-up
        bpy.data.images.remove(img)
        r, c = divmod(i, GRID)
        atlas[r * SIZE:(r + 1) * SIZE, c * SIZE:(c + 1) * SIZE] = px
        print(f"FRAME {i + 1}/{FRAMES}", flush=True)
    name = "fire_burst_atlas" if data else "fire_burst_preview"
    out = bpy.data.images.new(name, SIZE * GRID, SIZE * GRID, alpha=True)
    out.colorspace_settings.name = "Non-Color"
    out.pixels[:] = atlas[::-1].ravel()
    out.filepath_raw = os.path.join(out_dir, name + ".png"); out.file_format = "PNG"
    out.save()
    mat.node_tree.nodes["Preview"].outputs[0].default_value = 1.0
    print("ATLAS", out.filepath_raw, flush=True)


opt = args()
if "FireBurst" not in bpy.data.materials:
    build_scene()
if opt["save"]:
    bpy.context.scene.frame_set(5)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(opt["save"]), compress=True)
    print("SAVED", opt["save"], flush=True)
if opt["render"]:
    render_atlas(os.path.abspath(opt["out"] or "fire_burst_out"), data=not opt["preview"])
