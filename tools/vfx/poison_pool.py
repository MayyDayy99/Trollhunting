"""Stylized toxic poison pool for Troll Hunting, built and rendered headless in Blender (tested with 5.3).

A TOP-DOWN flipbook of a puddle of poison on the ground (the game lays the quad flat on the ground):
  frames 1-4   the puddle spreads fast from the centre: an irregular blobby rim and short splash fingers
  frames 4-10  bubbles swell in it and pop, wet sheen on the surface
  frames 10-16 it shrinks inwards and evaporates (noise erosion)
The liquid is one family of flattened metaballs ("Goo", "Goo.001", ...), so the blobs fuse into one puddle
with a soft, lumpy rim; the bubbles are sphere meshes so each keeps its own dark ring.
The texture stores DATA, not colour (one 4x4 atlas of 256 px cells, 1024x1024):
  RGB = toon band: 0.10 dark rim, 0.32 deep green, 0.54 mid, 0.76 light, 1.00 wet highlight
  A   = coverage
The game tints the bands acid green (src/game/15-fire-burst.js, POISONPOOL) and sizes the quad to the
real poison area (src/game/16-elements.js, poisonPool).

  blender -b --factory-startup --python tools/vfx/poison_pool.py -- --save tools/vfx/poison_pool.blend
  blender -b --factory-startup --python tools/vfx/poison_pool.py -- --render --out OUTDIR [--preview]

--save writes the scene (opens in colour-preview mode: set the "Preview" value node to 0 for the game data).
--render rebuilds the scene from this script and packs the 16 frames into OUTDIR/poison_pool_atlas.png
(frame 0 top-left, left-to-right, top-to-bottom); --preview renders the colour version instead.
"""
import math
import os
import random
import sys

import bpy
import numpy as np
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vfx_device import use_best_device  # noqa: E402  (CPU; VFX_DEVICE=GPU esetén a videókártya)

FRAMES = 16
SIZE = 256
GRID = 4
NAME = "poison_pool"
DATA = [0.10, 0.32, 0.54, 0.76, 1.00]          # grey written for: rim, deep, mid, light, highlight
SHADE = [(0.00, 1), (0.66, 2), (0.935, 3)]      # (light threshold, band): the flat top is mid, slopes facing the light are light
PREVIEW = [(0.07, 0.17, 0.05), (0.17, 0.40, 0.08), (0.42, 0.76, 0.14), (0.72, 0.94, 0.30), (0.95, 1.00, 0.78)]
LIGHT = Vector((-0.45, 0.45, 0.77)).normalized()   # from the upper left of the image, high up
VIEW = Vector((0.0, 0.0, 1.0))                      # the ortho camera looks straight down
FLAT = 0.34                                         # puddle blobs are lenses: height / width


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


def build_material():
    mat = bpy.data.materials.new("PoisonPool"); mat.use_nodes = True
    nt = mat.node_tree; N = nt.nodes; L = nt.links; N.clear()
    out = N.new("ShaderNodeOutputMaterial"); out.location = (1400, 0)
    erode = N.new("ShaderNodeValue"); erode.name = erode.label = "Erode"                       # animated: 0 -> ~0.55
    boil = N.new("ShaderNodeValue"); boil.name = boil.label = "Boil"                           # animated noise W
    preview = N.new("ShaderNodeValue"); preview.name = preview.label = "Preview"; preview.outputs[0].default_value = 1.0
    ink = N.new("ShaderNodeValue"); ink.name = ink.label = "Ink"; ink.outputs[0].default_value = 0.30     # rim width (smaller = thicker)
    gloss = N.new("ShaderNodeValue"); gloss.name = gloss.label = "Gloss"; gloss.outputs[0].default_value = 0.988   # wet sheen size (smaller = bigger)
    for n, y in [(erode, 400), (boil, 250), (preview, 100), (ink, -50), (gloss, -200)]: n.location = (-1400, y)

    # light = (N.L)*0.5+0.5, darkened where blobs meet (ambient occlusion) + a little noise ripple
    geo = N.new("ShaderNodeNewGeometry")
    dot = N.new("ShaderNodeVectorMath"); dot.operation = "DOT_PRODUCT"; dot.label = "N.L"
    L.new(geo.outputs["Normal"], dot.inputs[0]); dot.inputs[1].default_value = LIGHT
    lit = math_node(N, "MULTIPLY_ADD"); L.new(dot.outputs["Value"], lit.inputs[0]); lit.inputs[1].default_value = 0.5; lit.inputs[2].default_value = 0.5
    ao = N.new("ShaderNodeAmbientOcclusion"); ao.samples = 16; ao.inputs["Distance"].default_value = 0.18
    aok = math_node(N, "MULTIPLY_ADD"); L.new(ao.outputs["AO"], aok.inputs[0]); aok.inputs[1].default_value = 0.5; aok.inputs[2].default_value = 0.5
    shade = math_node(N, "MULTIPLY", label="Shade"); L.new(lit.outputs[0], shade.inputs[0]); L.new(aok.outputs[0], shade.inputs[1])
    tc = N.new("ShaderNodeTexCoord")
    nz = N.new("ShaderNodeTexNoise"); nz.noise_dimensions = "4D"; nz.inputs["Scale"].default_value = 4.0; nz.inputs["Detail"].default_value = 1.0
    L.new(tc.outputs["Object"], nz.inputs["Vector"]); L.new(boil.outputs[0], nz.inputs["W"])
    nzc = math_node(N, "MULTIPLY_ADD"); L.new(nz.outputs["Fac"], nzc.inputs[0]); nzc.inputs[1].default_value = 0.16; nzc.inputs[2].default_value = -0.08
    light = math_node(N, "ADD", clamp=True, label="Light"); L.new(shade.outputs[0], light.inputs[0]); L.new(nzc.outputs[0], light.inputs[1])
    body = ramp(N, [(p, (b / 4, b / 4, b / 4)) for p, b in SHADE]); body.label = "Body bands"
    L.new(light.outputs[0], body.inputs["Fac"])
    band = math_node(N, "MULTIPLY", b=4.0); L.new(body.outputs["Color"], band.inputs[0])

    # wet sheen: a hard specular (Blinn N.H) -> band 4
    half = (LIGHT + VIEW).normalized()
    dh = N.new("ShaderNodeVectorMath"); dh.operation = "DOT_PRODUCT"; dh.label = "N.H"
    L.new(geo.outputs["Normal"], dh.inputs[0]); dh.inputs[1].default_value = half
    spec = math_node(N, "GREATER_THAN"); L.new(dh.outputs["Value"], spec.inputs[0]); L.new(gloss.outputs[0], spec.inputs[1])
    band_hi = math_node(N, "MAXIMUM"); L.new(band.outputs[0], band_hi.inputs[0])
    sp4 = math_node(N, "MULTIPLY", b=4.0); L.new(spec.outputs[0], sp4.inputs[0]); L.new(sp4.outputs[0], band_hi.inputs[1])

    # dark rim on the puddle edge and around every bubble -> band 0 (a weighted line: thicker in the shadow)
    lw = N.new("ShaderNodeLayerWeight"); lw.inputs["Blend"].default_value = 0.5
    inkw = math_node(N, "MULTIPLY_ADD", label="Ink by light"); L.new(light.outputs[0], inkw.inputs[0]); inkw.inputs[1].default_value = 0.20; L.new(ink.outputs[0], inkw.inputs[2])
    edge = math_node(N, "GREATER_THAN"); L.new(lw.outputs["Facing"], edge.inputs[0]); L.new(inkw.outputs[0], edge.inputs[1])
    keepb = math_node(N, "SUBTRACT", a=1.0); L.new(edge.outputs[0], keepb.inputs[1])
    # outline copies: the puddle family is drawn twice more, slightly larger and just below it (the camera looks straight
    # down, so they peek out as even rings). Object property "rim": 0 = puddle, 1 = deep-green meniscus, 2 = dark rim.
    rimat = N.new("ShaderNodeAttribute"); rimat.attribute_type = "OBJECT"; rimat.attribute_name = "rim"; rimat.label = "Rim copy (object)"
    is_men = math_node(N, "GREATER_THAN", b=0.5); L.new(rimat.outputs["Fac"], is_men.inputs[0])
    is_rim = math_node(N, "GREATER_THAN", b=1.5); L.new(rimat.outputs["Fac"], is_rim.inputs[0])
    cap = math_node(N, "MULTIPLY_ADD"); L.new(is_men.outputs[0], cap.inputs[0]); cap.inputs[1].default_value = -3.0; cap.inputs[2].default_value = 4.0
    capped = math_node(N, "MINIMUM", label="Meniscus cap"); L.new(band_hi.outputs[0], capped.inputs[0]); L.new(cap.outputs[0], capped.inputs[1])
    not_rim = math_node(N, "SUBTRACT", a=1.0); L.new(is_rim.outputs[0], not_rim.inputs[1])
    keep2 = math_node(N, "MULTIPLY"); L.new(keepb.outputs[0], keep2.inputs[0]); L.new(not_rim.outputs[0], keep2.inputs[1])
    final_band = math_node(N, "MULTIPLY", label="Band 0..4"); L.new(capped.outputs[0], final_band.inputs[0]); L.new(keep2.outputs[0], final_band.inputs[1])
    div = math_node(N, "DIVIDE", b=4.0); L.new(final_band.outputs[0], div.inputs[0])
    data = ramp(N, [(max(0.0, (i - 0.5) / 4), (d, d, d)) for i, d in enumerate(DATA)]); data.label = "Band data"
    col = ramp(N, [(max(0.0, (i - 0.5) / 4), c) for i, c in enumerate(PREVIEW)]); col.label = "Band preview"
    L.new(div.outputs[0], data.inputs["Fac"]); L.new(div.outputs[0], col.inputs["Fac"])
    mix = N.new("ShaderNodeMix"); mix.data_type = "RGBA"
    L.new(preview.outputs[0], mix.inputs["Factor"]); L.new(data.outputs["Color"], mix.inputs[6]); L.new(col.outputs["Color"], mix.inputs[7])
    em = N.new("ShaderNodeEmission"); L.new(mix.outputs[2], em.inputs["Color"])

    # evaporation: noise holes, the rim goes first
    nz2 = N.new("ShaderNodeTexNoise"); nz2.noise_dimensions = "4D"; nz2.inputs["Scale"].default_value = 3.6; nz2.inputs["Detail"].default_value = 3.0
    L.new(tc.outputs["Object"], nz2.inputs["Vector"]); L.new(boil.outputs[0], nz2.inputs["W"])
    er = math_node(N, "MULTIPLY_ADD"); L.new(lw.outputs["Facing"], er.inputs[0]); er.inputs[1].default_value = 0.30; L.new(erode.outputs[0], er.inputs[2])
    keep = math_node(N, "GREATER_THAN", label="Keep"); L.new(nz2.outputs["Fac"], keep.inputs[0]); L.new(er.outputs[0], keep.inputs[1])
    tr = N.new("ShaderNodeBsdfTransparent"); ms = N.new("ShaderNodeMixShader")
    L.new(keep.outputs[0], ms.inputs["Fac"]); L.new(tr.outputs[0], ms.inputs[1]); L.new(em.outputs[0], ms.inputs[2])
    L.new(ms.outputs[0], out.inputs["Surface"])

    for f, e in [(1, 0.0), (10, 0.0), (11, 0.10), (12, 0.18), (13, 0.27), (14, 0.36), (15, 0.46), (16, 0.58)]:
        erode.outputs[0].default_value = e; erode.outputs[0].keyframe_insert("default_value", frame=f)
    for f, w in [(1, 0.0), (FRAMES, 1.6)]:
        boil.outputs[0].default_value = w; boil.outputs[0].keyframe_insert("default_value", frame=f)
    return mat


STIFF, THRESH = 1.5, 0.6
VIS = math.sqrt(1.0 - (THRESH / STIFF) ** (1.0 / 3.0))   # visible radius / influence radius of a lone ball
# metaball families: (name, rim property, extra visible radius, z offset). Blender merges every "Goo", "Goo.001", ...
# into one surface owned by the motherball "Goo"; "Men" and "Rim" are the same blobs, a little bigger and a little lower.
FAMILIES = [("Goo", 0, 0.0, 0.0), ("Men", 1, 0.012, -0.018), ("Rim", 2, 0.026, -0.036)]
_COUNT = {}


def goo(role, radius, keys, flat=FLAT):
    """one flattened blob of the puddle, created in all three families (puddle + meniscus + dark rim).
    radius = visible radius of the lone ball seen from above. role = collection. keys: [(frame, (x, y), scale)]"""
    obs = []
    for fam, rim, extra, dz in FAMILIES:
        n = _COUNT.get(fam, 0); _COUNT[fam] = n + 1
        name = fam if n == 0 else f"{fam}.{n:03d}"
        mb = bpy.data.metaballs.new(name)
        mb.resolution = 0.04; mb.render_resolution = 0.010; mb.threshold = THRESH
        el = mb.elements.new(); el.type = "BALL"; el.radius = (radius + extra) / VIS if radius > 0.01 else radius / VIS; el.stiffness = STIFF
        ob = bpy.data.objects.new(name, mb)
        ob["role"] = role; ob["rim"] = float(rim)
        cname = role if rim == 0 else f"{role} ({fam.lower()} copy)"
        col = bpy.data.collections.get(cname)
        if col is None:
            col = bpy.data.collections.new(cname); bpy.context.scene.collection.children.link(col)
            if rim: col.hide_viewport = False
        col.objects.link(ob)
        for f, p, sc in sorted(keys, key=lambda k: k[0]):
            ob.location = (p[0], p[1], dz); ob.scale = (sc, sc, sc * flat)
            ob.keyframe_insert("location", frame=f); ob.keyframe_insert("scale", frame=f)
        obs.append(ob)
    return obs


def mesh_keys(ob, keys):
    for f, p, s in keys:
        ob.location = p; ob.scale = (s, s, s) if not isinstance(s, tuple) else s
        ob.keyframe_insert("location", frame=f); ob.keyframe_insert("scale", frame=f)


def build_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, FRAMES
    sc.render.fps = 24
    _COUNT.clear()
    rng = random.Random(9)
    mat = build_material()

    # the motherballs "Goo", "Men", "Rim" own the merged surfaces and the material; tiny fixed balls so the others can vanish freely
    for ob in goo("Puddle core", 0.003, [(1, (0, 0), 1.0)]): ob.data.materials.append(mat)

    # CORE: big blobs that splash out of the impact and settle into the middle of the puddle
    for i, (x, y, r, gone) in enumerate([(0.0, 0.0, 0.34, 15.6), (0.20, 0.12, 0.26, 14.4), (-0.22, 0.08, 0.27, 15.0),
                                         (0.05, -0.24, 0.27, 14.0), (-0.12, 0.26, 0.22, 13.4), (0.24, -0.16, 0.22, 13.0)]):
        p = Vector((x, y))
        goo("Puddle core", r, [(1, tuple(p * 0.35), 0.62), (2, tuple(p * 0.85), 0.95), (3, tuple(p * 1.05), 1.06), (4, tuple(p), 1.0),
                               (10, tuple(p * 1.02), 1.0), (gone - 3.5, tuple(p * 0.85), 0.85), (gone - 1.4, tuple(p * 0.62), 0.50), (gone, tuple(p * 0.5), 0.0)])

    # RIM: lumps around the edge give the puddle an irregular, blobby outline; it shrinks back inwards one lump at a time
    n = 15
    for i in range(n):
        a = (i + rng.uniform(-0.3, 0.3)) / n * 6.2832
        d = Vector((math.cos(a), math.sin(a)))
        R = rng.uniform(0.44, 0.60); r = rng.uniform(0.13, 0.21)
        gone = rng.uniform(11.8, 15.4)
        goo("Puddle rim", r, [(1, tuple(d * R * 0.2), 0.3), (2, tuple(d * R * 0.70), 0.85), (3, tuple(d * R * 1.02), 1.05), (4, tuple(d * R), 1.0),
                              (10, tuple(d * R * 1.02), 1.0), (gone - 2.6, tuple(d * R * 0.86), 0.80), (gone - 1.0, tuple(d * R * 0.70), 0.40),
                              (gone, tuple(d * R * 0.64), 0.0)])

    # SPLASH FINGERS: short tendrils shot out along the ground, each ending in a drop; they thin and pull back first
    for i in range(8):
        a = (i + rng.uniform(-0.18, 0.18)) / 8 * 6.2832 + 0.2
        d = Vector((math.cos(a), math.sin(a))); side = Vector((-d.y, d.x)) * rng.uniform(-0.05, 0.05)
        reach = rng.uniform(0.78, 0.90)
        back = rng.uniform(7.5, 10.5)
        for j, (t, r) in enumerate([(0.62, 0.085), (0.71, 0.068), (0.79, 0.056)]):
            p = d * reach * t / 0.90 + side * j
            goo("Splash fingers", r, [(1, tuple(d * 0.2), 0.0), (1.8 + 0.4 * j, tuple(p * 0.75), 0.9), (3.0 + 0.3 * j, tuple(p), 1.0),
                                      (back - 0.6 * j, tuple(p * 0.98), 0.9), (back + 1.6 - 0.6 * j, tuple(p * 0.88), 0.0)])
        tip = d * reach + side * 3
        goo("Splash fingers", 0.062, [(1, tuple(d * 0.2), 0.0), (2.6, tuple(tip * 0.85), 0.9), (3.6, tuple(tip), 1.05),
                                      (back + 0.5, tuple(tip * 1.01), 0.85), (back + 2.0, tuple(tip * 1.0), 0.0)])

    # BUBBLES: they swell in the puddle and pop (sphere meshes sunk into the surface, each with its own dark ring);
    # a pop leaves a thin ring that spreads out for a frame or two
    for k, (x, y, f0, f_pop, r) in enumerate([(-0.14, 0.10, 4.0, 6.6, 0.080), (0.18, -0.06, 4.6, 7.6, 0.095), (0.02, 0.30, 5.2, 8.4, 0.070),
                                              (-0.26, -0.18, 5.8, 9.2, 0.085), (0.30, 0.20, 6.4, 9.8, 0.065), (0.06, -0.30, 4.2, 8.0, 0.060),
                                              (-0.02, 0.0, 7.0, 10.2, 0.075)]):
        r *= 1.45
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=r)
        b = bpy.context.active_object; b.name = f"Bubble{k}"
        for poly in b.data.polygons: poly.use_smooth = True
        b.data.materials.append(mat)
        z = r * 0.45
        mesh_keys(b, [(1, (x, y, z), 0.0), (f0, (x, y, z), 0.0), (f0 + 1.2, (x, y, z), 0.8), (f_pop - 0.4, (x, y, z), 1.12), (f_pop, (x, y, z), 0.0)])
        bpy.ops.mesh.primitive_torus_add(major_radius=r * 1.1, minor_radius=r * 0.16, major_segments=32, minor_segments=8)
        ring = bpy.context.active_object; ring.name = f"BubblePop{k}"
        for poly in ring.data.polygons: poly.use_smooth = True
        ring.data.materials.append(mat)
        mesh_keys(ring, [(1, (x, y, 0.02), 0.0), (f_pop - 0.01, (x, y, 0.02), 0.0), (f_pop, (x, y, 0.04), 1.0), (f_pop + 1.0, (x, y, 0.04), (1.7, 1.7, 0.6)),
                         (f_pop + 1.8, (x, y, 0.04), 0.0)])

    cam = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
    sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = "ORTHO"; cam.data.ortho_scale = 2.06
    cam.location = (0, 0, 8); cam.rotation_euler = (0, 0, 0)       # straight down, image up = +Y
    world = bpy.data.worlds.new("World"); world.use_nodes = True; sc.world = world
    bg = world.node_tree.nodes.get("Background")
    if bg: bg.inputs["Color"].default_value = (0.20, 0.24, 0.20, 1.0)
    sc.render.engine = "CYCLES"; use_best_device(sc); sc.cycles.samples = 32; sc.cycles.use_denoising = False
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = SIZE; sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
    try: sc.view_settings.view_transform = "Raw"
    except TypeError: sc.view_settings.view_transform = "Standard"
    return sc


def render_atlas(out_dir, data=True):
    sc = build_scene()
    bpy.data.materials["PoisonPool"].node_tree.nodes["Preview"].outputs[0].default_value = 0.0 if data else 1.0
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
    bpy.data.materials["PoisonPool"].node_tree.nodes["Preview"].outputs[0].default_value = 1.0
    bpy.context.scene.frame_set(6)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(opt["save"]), compress=True)
    print("SAVED", opt["save"], flush=True)
