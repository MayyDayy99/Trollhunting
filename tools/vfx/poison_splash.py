"""Stylized toxic poison splash for Troll Hunting, built and rendered headless in Blender (tested with 5.3).

A blobby liquid splat made of metaballs (they merge and pinch off like real goo): a lumpy core bursts into a
crown of fat fingers, the finger tips pinch off into teardrop droplets that fly out and fall, bubbles swell
on the surface and pop, the core sags into hanging drips, then everything breaks into drops and erodes.
The texture stores DATA, not colour (one 4x4 atlas of 256 px cells, 1024x1024):
  RGB = toon band: 0.10 dark rim (ink outline), 0.32 deep green, 0.54 mid, 0.76 light, 1.00 wet highlight
  A   = coverage
The game tints the bands acid green (src/game/15-fire-burst.js, POISONBURST).

  blender -b --factory-startup --python tools/vfx/poison_splash.py -- --save tools/vfx/poison_splash.blend
  blender -b --factory-startup --python tools/vfx/poison_splash.py -- --render --out OUTDIR [--preview]

--save writes the scene (opens in colour-preview mode: set the "Preview" value node to 0 for the game data).
--render rebuilds the scene from this script and packs the 16 frames into OUTDIR/poison_splash_atlas.png
(frame 0 top-left, left-to-right, top-to-bottom); --preview renders the colour version instead.
"""
import math
import os
import random
import sys

import bpy
import numpy as np
from mathutils import Vector

FRAMES = 16
SIZE = 256
GRID = 4
NAME = "poison_splash"
DATA = [0.10, 0.32, 0.54, 0.76, 1.00]          # grey written for: rim, deep, mid, light, highlight
SHADE = [(0.00, 1), (0.40, 2), (0.66, 3)]       # (light threshold, band) for the body shading
PREVIEW = [(0.07, 0.17, 0.05), (0.17, 0.40, 0.08), (0.42, 0.76, 0.14), (0.72, 0.94, 0.30), (0.95, 1.00, 0.78)]
LIGHT = Vector((-0.50, -0.45, 0.74)).normalized()   # upper left, towards the camera
VIEW = Vector((0.0, -1.0, 0.0))                     # ortho camera looks along +Y
GRAV = -0.026                                       # droplet gravity (units / frame^2)


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


def band_colour(N, L, preview, band_socket, name):
    """band index 0..4 -> data grey (Preview=0) or preview colour (Preview=1)"""
    div = math_node(N, "DIVIDE", b=4.0); L.new(band_socket, div.inputs[0])
    data = ramp(N, [(max(0.0, (i - 0.5) / 4), (d, d, d)) for i, d in enumerate(DATA)])
    col = ramp(N, [(max(0.0, (i - 0.5) / 4), c) for i, c in enumerate(PREVIEW)])
    data.label = name + " data"; col.label = name + " preview"
    L.new(div.outputs[0], data.inputs["Fac"]); L.new(div.outputs[0], col.inputs["Fac"])
    mix = N.new("ShaderNodeMix"); mix.data_type = "RGBA"
    L.new(preview.outputs[0], mix.inputs["Factor"]); L.new(data.outputs["Color"], mix.inputs[6]); L.new(col.outputs["Color"], mix.inputs[7])
    return mix.outputs[2]


def build_material():
    mat = bpy.data.materials.new("PoisonSplash"); mat.use_nodes = True
    nt = mat.node_tree; N = nt.nodes; L = nt.links; N.clear()
    out = N.new("ShaderNodeOutputMaterial"); out.location = (1400, 0)
    erode = N.new("ShaderNodeValue"); erode.name = erode.label = "Erode"                       # animated: 0 -> ~0.5
    boil = N.new("ShaderNodeValue"); boil.name = boil.label = "Boil"                           # animated noise W
    preview = N.new("ShaderNodeValue"); preview.name = preview.label = "Preview"; preview.outputs[0].default_value = 1.0
    ink = N.new("ShaderNodeValue"); ink.name = ink.label = "Ink"; ink.outputs[0].default_value = 0.47     # rim width (smaller = thicker)
    gloss = N.new("ShaderNodeValue"); gloss.name = gloss.label = "Gloss"; gloss.outputs[0].default_value = 0.93   # wet highlight size (smaller = bigger)
    for n, y in [(erode, 400), (boil, 250), (preview, 100), (ink, -50), (gloss, -200)]: n.location = (-1400, y)

    # light = (N.L)*0.5+0.5, darkened in the crevices between the blobs (ambient occlusion) + a little noise
    geo = N.new("ShaderNodeNewGeometry")
    dot = N.new("ShaderNodeVectorMath"); dot.operation = "DOT_PRODUCT"; dot.label = "N.L"
    L.new(geo.outputs["Normal"], dot.inputs[0]); dot.inputs[1].default_value = LIGHT
    lit = math_node(N, "MULTIPLY_ADD"); L.new(dot.outputs["Value"], lit.inputs[0]); lit.inputs[1].default_value = 0.5; lit.inputs[2].default_value = 0.5
    ao = N.new("ShaderNodeAmbientOcclusion"); ao.samples = 16; ao.inputs["Distance"].default_value = 0.30
    aok = math_node(N, "MULTIPLY_ADD"); L.new(ao.outputs["AO"], aok.inputs[0]); aok.inputs[1].default_value = 0.6; aok.inputs[2].default_value = 0.4
    shade = math_node(N, "MULTIPLY", label="Shade"); L.new(lit.outputs[0], shade.inputs[0]); L.new(aok.outputs[0], shade.inputs[1])
    tc = N.new("ShaderNodeTexCoord")
    nz = N.new("ShaderNodeTexNoise"); nz.noise_dimensions = "4D"; nz.inputs["Scale"].default_value = 3.0; nz.inputs["Detail"].default_value = 1.0
    L.new(tc.outputs["Object"], nz.inputs["Vector"]); L.new(boil.outputs[0], nz.inputs["W"])
    nzc = math_node(N, "MULTIPLY_ADD"); L.new(nz.outputs["Fac"], nzc.inputs[0]); nzc.inputs[1].default_value = 0.12; nzc.inputs[2].default_value = -0.06
    light = math_node(N, "ADD", clamp=True, label="Light"); L.new(shade.outputs[0], light.inputs[0]); L.new(nzc.outputs[0], light.inputs[1])
    body = ramp(N, [(p, (b / 4, b / 4, b / 4)) for p, b in SHADE]); body.label = "Body bands"
    L.new(light.outputs[0], body.inputs["Fac"])
    band = math_node(N, "MULTIPLY", b=4.0); L.new(body.outputs["Color"], band.inputs[0])

    # wet highlight: a hard specular blob (Blinn N.H) -> band 4
    half = (LIGHT + VIEW).normalized()
    dh = N.new("ShaderNodeVectorMath"); dh.operation = "DOT_PRODUCT"; dh.label = "N.H"
    L.new(geo.outputs["Normal"], dh.inputs[0]); dh.inputs[1].default_value = half
    spec = math_node(N, "GREATER_THAN"); L.new(dh.outputs["Value"], spec.inputs[0]); L.new(gloss.outputs[0], spec.inputs[1])
    band_hi = math_node(N, "MAXIMUM"); L.new(band.outputs[0], band_hi.inputs[0])
    sp4 = math_node(N, "MULTIPLY", b=4.0); L.new(spec.outputs[0], sp4.inputs[0]); L.new(sp4.outputs[0], band_hi.inputs[1])

    # dark rim (ink outline) on every blob's silhouette -> band 0; a weighted line: thin on the lit side, thick in the shadow
    lw = N.new("ShaderNodeLayerWeight"); lw.inputs["Blend"].default_value = 0.5
    inkw = math_node(N, "MULTIPLY_ADD", label="Ink by light"); L.new(light.outputs[0], inkw.inputs[0]); inkw.inputs[1].default_value = 0.24; L.new(ink.outputs[0], inkw.inputs[2])
    edge = math_node(N, "GREATER_THAN"); L.new(lw.outputs["Facing"], edge.inputs[0]); L.new(inkw.outputs[0], edge.inputs[1])
    keepb = math_node(N, "SUBTRACT", a=1.0); L.new(edge.outputs[0], keepb.inputs[1])
    final_band = math_node(N, "MULTIPLY", label="Band 0..4"); L.new(band_hi.outputs[0], final_band.inputs[0]); L.new(keepb.outputs[0], final_band.inputs[1])
    colour = band_colour(N, L, preview, final_band.outputs[0], "Band")
    em = N.new("ShaderNodeEmission"); L.new(colour, em.inputs["Color"])

    # erosion: noise holes, the rim goes first
    nz2 = N.new("ShaderNodeTexNoise"); nz2.noise_dimensions = "4D"; nz2.inputs["Scale"].default_value = 3.2; nz2.inputs["Detail"].default_value = 3.0
    L.new(tc.outputs["Object"], nz2.inputs["Vector"]); L.new(boil.outputs[0], nz2.inputs["W"])
    er = math_node(N, "MULTIPLY_ADD"); L.new(lw.outputs["Facing"], er.inputs[0]); er.inputs[1].default_value = 0.30; L.new(erode.outputs[0], er.inputs[2])
    keep = math_node(N, "GREATER_THAN", label="Keep"); L.new(nz2.outputs["Fac"], keep.inputs[0]); L.new(er.outputs[0], keep.inputs[1])
    tr = N.new("ShaderNodeBsdfTransparent"); ms = N.new("ShaderNodeMixShader")
    L.new(keep.outputs[0], ms.inputs["Fac"]); L.new(tr.outputs[0], ms.inputs[1]); L.new(em.outputs[0], ms.inputs[2])
    L.new(ms.outputs[0], out.inputs["Surface"])

    for f, e in [(1, 0.0), (8, 0.0), (9, 0.02), (11, 0.09), (13, 0.20), (14, 0.28), (15, 0.38), (16, 0.52)]:
        erode.outputs[0].default_value = e; erode.outputs[0].keyframe_insert("default_value", frame=f)
    for f, w in [(1, 0.0), (FRAMES, 1.4)]:
        boil.outputs[0].default_value = w; boil.outputs[0].keyframe_insert("default_value", frame=f)
    return mat


_GOO = [0]
STIFF, THRESH = 1.5, 0.6
VIS = math.sqrt(1.0 - (THRESH / STIFF) ** (1.0 / 3.0))   # visible radius / influence radius of a lone ball


def goo(role, radius, keys):
    """one metaball of the 'Goo' family: Blender merges every "Goo", "Goo.001", "Goo.002"... into ONE liquid
    surface (owned by the motherball "Goo"), so drops neck and pinch off the body like real goo.
    radius = VISIBLE radius of the lone ball (its influence reaches ~2x further, which is what fuses the blobs).
    role = collection it is sorted into. keys: [(frame, (x, y, z), scale)]"""
    name = "Goo" if _GOO[0] == 0 else f"Goo.{_GOO[0]:03d}"; _GOO[0] += 1
    mb = bpy.data.metaballs.new(name)
    mb.resolution = 0.05; mb.render_resolution = 0.014; mb.threshold = THRESH
    el = mb.elements.new(); el.type = "BALL"; el.radius = radius / VIS; el.stiffness = STIFF
    ob = bpy.data.objects.new(name, mb)
    ob["role"] = role
    col = bpy.data.collections.get(role)
    if col is None:
        col = bpy.data.collections.new(role); bpy.context.scene.collection.children.link(col)
    col.objects.link(ob)
    for f, p, s in sorted(keys, key=lambda k: k[0]):
        ob.location = p; ob.scale = (s, s, s)
        ob.keyframe_insert("location", frame=f); ob.keyframe_insert("scale", frame=f)
    return ob


def sphere(name, mat, radius, keys):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=radius)
    ob = bpy.context.active_object; ob.name = name
    for p in ob.data.polygons: p.use_smooth = True
    ob.data.materials.append(mat)
    for f, p, s in keys:
        ob.location = p; ob.scale = (s, s, s)
        ob.keyframe_insert("location", frame=f); ob.keyframe_insert("scale", frame=f)
    return ob


def ballistic(p0, v, f0, f1, g=GRAV):
    """sample a thrown droplet once per frame: [(frame, position, velocity)]"""
    out = []; f = f0
    while f <= f1 + 1e-6:
        t = f - f0
        out.append((f, Vector((p0[0] + v[0] * t, p0[1] + v[1] * t, p0[2] + v[2] * t + 0.5 * g * t * t)), Vector((v[0], v[1], v[2] + g * t))))
        f += 1.0
    return out


def droplet(role, p0, v, f0, f_gone, r, g=GRAV, tail=1.0):
    """flying teardrop: a head ball plus two shrinking tail balls close behind it (they fuse into a drop that
    points back along the velocity); it shrinks over its last frames and vanishes at f_gone"""
    p0 = Vector(p0); v = Vector(v)
    path = ballistic(p0, v, f0, f_gone - 1.0, g)
    keys = [[(1, tuple(p0), 0.0), (f0 - 0.5, tuple(p0), 0.0)] for _ in range(3)]
    for f, pos, vel in path:
        life = (f - f0) / max(1.0, f_gone - f0)
        s = 1.0 if life < 0.45 else 1.0 - (life - 0.45) / 0.55 * 0.6
        stretch = 0.55 + 0.6 * min(1.0, vel.length / 0.08)          # faster = longer tail
        back = -vel.normalized()
        keys[0].append((f, tuple(pos), s))
        keys[1].append((f, tuple(pos + back * r * 0.75 * stretch), s * 0.70 * tail))
        keys[2].append((f, tuple(pos + back * r * 1.35 * stretch), s * 0.42 * tail))
    last = path[-1][1] if path else p0
    keys[0].append((f_gone, tuple(last), 0.0)); keys[1].append((f_gone - 0.4, tuple(last), 0.0)); keys[2].append((f_gone - 0.7, tuple(last), 0.0))
    for k in keys: goo(role, r, k)


def build_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, FRAMES
    sc.render.fps = 24
    _GOO[0] = 0
    rng = random.Random(5)
    mat = build_material()

    # the motherball "Goo" owns the merged surface and the material; it is a tiny fixed ball so the others can vanish freely
    goo("Goo core", 0.004, [(1, (0, 0, 0), 1.0)]).data.materials.append(mat)

    # CORE: five blobs; they splat wide on impact, gather, sag under their own weight, then break apart:
    # the side blobs slide off as globs, the top one slumps in, and the main body melts down into drips
    core = [((0.00, 0.00, 0.02), 0.30), ((0.20, -0.06, -0.05), 0.21), ((-0.21, 0.05, -0.03), 0.22),
            ((0.05, -0.10, 0.18), 0.18), ((-0.06, 0.12, -0.17), 0.20)]
    obs = []
    for i, (p, r) in enumerate(core):
        p = Vector(p); splat = Vector((p.x * 1.7, p.y, p.z * 0.65))
        keys = [(1, tuple(Vector((p.x * 1.1, p.y, p.z * 0.5))), 0.84), (2, tuple(splat), 1.14), (3, tuple(splat * 1.05), 1.10), (5, tuple(p * 1.05), 1.0),
                (8, tuple(p * 0.98 + Vector((0, 0, -0.04))), 0.96)]
        obs.append((goo("Goo core", r, keys), p, r))
    def more(ob, keys):
        for f, pos, sc in keys:
            ob.location = pos; ob.scale = (sc, sc, sc)
            ob.keyframe_insert("location", frame=f); ob.keyframe_insert("scale", frame=f)
    main, side_r, side_l, top, bottom = obs
    more(main[0], [(10, (0.0, 0.0, -0.08), 0.86), (12, (0.0, 0.0, -0.16), 0.66), (14, (0.0, 0.0, -0.24), 0.40), (15.4, (0.0, 0.0, -0.28), 0.0)])
    more(top[0], [(9.5, (0.03, -0.10, 0.06), 0.80), (11.5, (0.02, -0.10, -0.06), 0.45), (13.0, (0.0, -0.10, -0.12), 0.0)])
    for (ob, p, r), f_split, vx, gone in [(side_r, 8.6, 0.044, 14.2), (side_l, 9.6, -0.040, 15.0)]:
        start = p * 0.98 + Vector((0, 0, -0.06))
        more(ob, [(f_split, tuple(start), 0.94), (f_split + 0.6, tuple(start + Vector((vx * 0.6, 0, -0.01))), 0.0)])
        droplet("Goo core", tuple(start + Vector((vx * 0.6, 0, -0.01))), (vx, 0.0, 0.004), f_split + 0.6, gone, r * 0.80, g=-0.016, tail=0.7)
    ob, p, r = bottom
    start = p * 0.98 + Vector((0, 0, -0.06))
    more(ob, [(10.5, tuple(start + Vector((0, 0, -0.10))), 0.9), (11.0, tuple(start + Vector((0, 0, -0.12))), 0.0)])
    droplet("Goo core", tuple(start + Vector((0, 0, -0.12))), (0.0, 0.0, -0.016), 11.0, 15.6, r * 0.78, g=-0.022, tail=0.8)

    # CROWN: fat fingers fanning up and out of the splat, each a chain of blobs ending in a swollen tip;
    # the neck thins, the tip pinches off into a teardrop and the rest of the finger is sucked back in
    fingers = [(-104, 0.62, 0.10), (-72, 0.78, -0.15), (-44, 0.90, 0.20), (-16, 0.98, -0.08), (14, 0.94, 0.12),
               (42, 0.88, -0.20), (70, 0.76, 0.06), (101, 0.60, -0.10)]
    for k, (deg, reach, dy) in enumerate(fingers):
        a = math.radians(90 - deg + rng.uniform(-5, 5))
        d = Vector((math.cos(a), dy, math.sin(a))).normalized()
        reach *= rng.uniform(0.92, 1.05)
        f_launch = 4.2 + rng.uniform(0.0, 1.3)
        kick = rng.uniform(0.70, 1.30)   # some drops fly far, some just plop off: no neat ring
        for j, (t, rr) in enumerate([(0.32, 0.15), (0.52, 0.115), (0.68, 0.085)]):
            gone = f_launch + 2.6 - 0.9 * j
            goo("Goo crown", rr, [(1, tuple(d * reach * t * 0.42), 0.55), (2, tuple(d * reach * t * 0.80), 1.0), (3, tuple(d * reach * t), 1.0),
                                  (f_launch - 0.3, tuple(d * reach * t * 1.0), 0.92 - 0.12 * j), (gone - 0.9, tuple(d * reach * t * 0.62), 0.45),
                                  (gone, tuple(d * reach * t * 0.45), 0.0)])
        rt = rng.uniform(0.11, 0.15)
        tip = d * reach * 0.86
        v = Vector((d.x * 0.050, d.y * 0.02, 0.022 + 0.034 * max(0.0, d.z))) * kick
        goo("Goo crown", rt, [(1, (0, 0, 0), 0.0), (2, tuple(tip * 0.78), 0.9), (3, tuple(tip), 1.06), (f_launch, tuple(tip * 1.04), 1.14),
                              (f_launch + 0.5, tuple(tip * 1.04 + v * 0.5), 0.0)])
        droplet("Goo drops", tuple(tip * 1.04 + v * 0.5), v, f_launch + 0.5, f_launch + rng.uniform(6.5, 9.0), rt * 0.92)

    # a few quick specks flung out sideways at the first impact
    for k, deg in enumerate([-128, -62, 58, 124, 168]):
        a = math.radians(deg + rng.uniform(-8, 8)); d = Vector((math.cos(a), rng.uniform(-0.2, 0.2), math.sin(a))).normalized()
        v = Vector((d.x * 0.10, d.y * 0.03, d.z * 0.06 + 0.035))
        droplet("Goo specks", tuple(d * 0.34), v, 2.0, rng.uniform(6.5, 8.5), rng.uniform(0.050, 0.062))

    # DRIPS: they bulge out of the bottom of the sagging core, stretch on a thinning neck, pinch off and fall
    for k, (x, y, f0) in enumerate([(-0.22, -0.06, 5.5), (0.12, -0.12, 6.5), (0.30, 0.04, 8.0), (-0.04, 0.10, 9.0)]):
        top = Vector((x, y, -0.26)); r = 0.095 - 0.008 * k; snap = f0 + 4.0
        goo("Goo drips", r * 0.8, [(1, tuple(top), 0.0), (f0, tuple(top), 0.0), (f0 + 1.5, tuple(top + Vector((0, 0, -0.10))), 1.0),
                                   (snap, tuple(top + Vector((0, 0, -0.22))), 0.7), (snap + 1.0, tuple(top + Vector((0, 0, -0.16))), 0.0)])
        hang = top + Vector((0, 0, -0.40))
        goo("Goo drips", r, [(1, tuple(top), 0.0), (f0, tuple(top), 0.0), (f0 + 1.5, tuple(top + Vector((0, 0, -0.20))), 0.95),
                             (snap - 0.5, tuple(hang), 1.0)])
        droplet("Goo drips", tuple(hang), (0, 0, -0.012), snap, min(FRAMES + 0.5, snap + rng.uniform(4.0, 5.0)), r, g=-0.020)

    # BUBBLES swell on the front of the goo and pop (sphere meshes, so each keeps its own dark rim)
    for k, (p, f0, f_pop, r) in enumerate([((-0.17, -0.27, 0.08), 3.0, 7.0, 0.095), ((0.18, -0.26, -0.05), 4.5, 8.5, 0.085),
                                           ((0.02, -0.29, -0.16), 5.5, 10.0, 0.075)]):
        p = Vector(p)
        sphere(f"Bubble{k}", mat, r, [(1, tuple(p), 0.0), (f0, tuple(p), 0.0), (f0 + 1.5, tuple(p), 0.85), (f_pop - 0.5, tuple(p), 1.15), (f_pop, tuple(p), 0.0)])
        for j in range(3):   # the pop flicks off three tiny specks
            a = math.radians(40 + j * 50 + rng.uniform(-15, 15)); v = Vector((math.cos(a) * 0.045, -0.02, math.sin(a) * 0.045 + 0.02))
            droplet("Bubble specks", tuple(p + v.normalized() * r), v, f_pop, f_pop + rng.uniform(2.5, 3.5), 0.032)

    cam = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
    sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = "ORTHO"; cam.data.ortho_scale = 2.45
    cam.location = (0, -8, 0.02); cam.rotation_euler = (math.radians(90), 0, 0)
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
    bpy.data.materials["PoisonSplash"].node_tree.nodes["Preview"].outputs[0].default_value = 0.0 if data else 1.0
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
    bpy.data.materials["PoisonSplash"].node_tree.nodes["Preview"].outputs[0].default_value = 1.0
    bpy.context.scene.frame_set(4)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(opt["save"]), compress=True)
    print("SAVED", opt["save"], flush=True)
