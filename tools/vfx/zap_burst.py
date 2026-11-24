"""Stylized lightning impact star for Troll Hunting, built and rendered headless in Blender (tested with 5.3).

A sharp electric burst: a spiky white-hot core flash, jagged branching rays that shoot out, crackle (they
re-jag every two frames), detach from the core, break into fragments and die out; an expanding ring and a
few flying sparks. Timing is fast-in / fast-out: full size by frame 3, the rays are gone by frame ~13.
Every stroke is drawn as nested toon bands (dark rim > violet > cyan > light cyan > white core), each band a
thinner ribbon in front of the previous one; the white core only runs along the inner part of the rays.
The shapes are built per frame (a stop-motion: frame N shows the "Zap fNN" collection), so the .blend plays
in Blender as it is rendered.
The texture stores DATA, not colour (one 4x4 atlas of 256 px cells, 1024x1024):
  RGB = band: 0.10 dark rim, 0.32 violet, 0.54 cyan, 0.76 light cyan, 1.00 white core
  A   = coverage
The game colours the bands and lets only the white core and the light inner rays bloom (src/game/15-fire-burst.js, ZAPBURST).

  blender -b --factory-startup --python tools/vfx/zap_burst.py -- --save tools/vfx/zap_burst.blend
  blender -b --factory-startup --python tools/vfx/zap_burst.py -- --render --out OUTDIR [--preview]
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
NAME = "zap_burst"
DATA = [0.10, 0.32, 0.54, 0.76, 1.00]
PREVIEW = [(0.14, 0.05, 0.32), (0.44, 0.24, 0.92), (0.26, 0.66, 1.00), (0.72, 0.94, 1.00), (1.00, 1.00, 1.00)]
WIDTH = [1.00, 0.78, 0.58, 0.40, 0.22]     # half-width of each band relative to the stroke (rim .. core)


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


def math_node(N, op, a=None, b=None, label=None):
    m = N.new("ShaderNodeMath"); m.operation = op
    if a is not None: m.inputs[0].default_value = a
    if b is not None: m.inputs[1].default_value = b
    if label: m.label = label
    return m


def build_material():
    mat = bpy.data.materials.new("ZapBurst"); mat.use_nodes = True
    nt = mat.node_tree; N = nt.nodes; L = nt.links; N.clear()
    out = N.new("ShaderNodeOutputMaterial"); out.location = (900, 0)
    erode = N.new("ShaderNodeValue"); erode.name = erode.label = "Erode"
    boil = N.new("ShaderNodeValue"); boil.name = boil.label = "Boil"
    preview = N.new("ShaderNodeValue"); preview.name = preview.label = "Preview"; preview.outputs[0].default_value = 1.0
    for n, y in [(erode, 300), (boil, 150), (preview, 0)]: n.location = (-1000, y)
    # each stroke carries its band (0..1 = rim..core) in the "band" colour attribute
    att = N.new("ShaderNodeAttribute"); att.attribute_type = "GEOMETRY"; att.attribute_name = "band"; att.label = "Band (stroke layer)"
    data = ramp(N, [(max(0.0, (i - 0.5) / 4), (d, d, d)) for i, d in enumerate(DATA)]); data.label = "Band data"
    col = ramp(N, [(max(0.0, (i - 0.5) / 4), c) for i, c in enumerate(PREVIEW)]); col.label = "Band preview"
    L.new(att.outputs["Fac"], data.inputs["Fac"]); L.new(att.outputs["Fac"], col.inputs["Fac"])
    mix = N.new("ShaderNodeMix"); mix.data_type = "RGBA"
    L.new(preview.outputs[0], mix.inputs["Factor"]); L.new(data.outputs["Color"], mix.inputs[6]); L.new(col.outputs["Color"], mix.inputs[7])
    em = N.new("ShaderNodeEmission"); L.new(mix.outputs[2], em.inputs["Color"])
    # crackly break-up at the end: noise holes (the outer bands go first)
    tc = N.new("ShaderNodeTexCoord")
    nz = N.new("ShaderNodeTexNoise"); nz.noise_dimensions = "4D"; nz.inputs["Scale"].default_value = 9.0; nz.inputs["Detail"].default_value = 2.0
    L.new(tc.outputs["Object"], nz.inputs["Vector"]); L.new(boil.outputs[0], nz.inputs["W"])
    er = math_node(N, "MULTIPLY_ADD"); L.new(att.outputs["Fac"], er.inputs[0]); er.inputs[1].default_value = -0.25; L.new(erode.outputs[0], er.inputs[2])
    keep = math_node(N, "GREATER_THAN", label="Keep"); L.new(nz.outputs["Fac"], keep.inputs[0]); L.new(er.outputs[0], keep.inputs[1])
    tr = N.new("ShaderNodeBsdfTransparent"); ms = N.new("ShaderNodeMixShader")
    L.new(keep.outputs[0], ms.inputs["Fac"]); L.new(tr.outputs[0], ms.inputs[1]); L.new(em.outputs[0], ms.inputs[2])
    L.new(ms.outputs[0], out.inputs["Surface"])
    for f, e in [(1, 0.0), (9, 0.0), (11, 0.06), (13, 0.16), (15, 0.30), (16, 0.50)]:
        erode.outputs[0].default_value = e; erode.outputs[0].keyframe_insert("default_value", frame=f)
    for f, w in [(1, 0.0), (FRAMES, 3.0)]:
        boil.outputs[0].default_value = w; boil.outputs[0].keyframe_insert("default_value", frame=f)
    return mat


class Sketch:
    """collects flat shapes (in the camera plane XZ) for one frame; band k is drawn at depth -k*0.01 (core in front)"""
    def __init__(self): self.verts, self.faces, self.bands = [], [], []

    def poly(self, pts, band):           # convex-ish polygon as a triangle fan around its centroid
        c = sum(pts, Vector((0, 0))) / len(pts)
        y = -0.01 * band; base = len(self.verts)
        self.verts.append((c.x, y, c.y)); [self.verts.append((p.x, y, p.y)) for p in pts]
        n = len(pts)
        for i in range(n): self.faces.append((base, base + 1 + i, base + 1 + (i + 1) % n)); self.bands.append(band)

    def ribbon(self, pts, halfw, band):  # polyline with per-point half-width (pointed where halfw = 0)
        y = -0.01 * band; base = len(self.verts); n = len(pts)
        for i, p in enumerate(pts):
            a = pts[max(0, i - 1)]; b = pts[min(n - 1, i + 1)]
            t = (b - a).normalized() if (b - a).length > 1e-9 else Vector((1, 0))
            nrm = Vector((-t.y, t.x)) * halfw[i]
            for q in (p - nrm, p + nrm): self.verts.append((q.x, y, q.y))
        for i in range(n - 1):
            k = base + i * 2
            self.faces.append((k, k + 2, k + 3, k + 1)); self.bands.append(band)

    def stroke(self, pts, width, core_until=1.0, min_band=0):
        """a jagged ray drawn as nested bands; the white core (band 4) only up to core_until of its length"""
        n = len(pts)
        for band in range(min_band, 5):
            limit = core_until if band == 4 else (min(1.0, core_until + 0.35) if band == 3 else 1.0)
            m = max(2, int(round((n - 1) * limit)) + 1)
            sub = pts[:m]
            hw = [width(i / (n - 1)) * WIDTH[band] * (1.0 if band < 3 else (1.0 - 0.8 * (i / max(1, m - 1)) ** 2)) for i in range(m)]
            hw[-1] = 0.0
            self.ribbon(sub, hw, band)

    def build(self, name, mat, col):
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.verts, [], self.faces)
        attr = me.color_attributes.new("band", "FLOAT_COLOR", "CORNER")
        for poly, b in zip(me.polygons, self.bands):
            for li in poly.loop_indices: attr.data[li].color = (b / 4, b / 4, b / 4, 1.0)
        me.materials.append(mat)
        ob = bpy.data.objects.new(name, me); col.objects.link(ob)
        return ob


def jag(a0, r0, r1, rng, segs, amp):
    """jagged polyline from radius r0 to r1 along angle a0 (zig-zag that alternates sides, Brownian wobble)"""
    d = Vector((math.cos(a0), math.sin(a0))); nrm = Vector((-d.y, d.x))
    pts = []; side = rng.choice((-1, 1))
    for i in range(segs + 1):
        t = i / segs
        off = 0.0 if i in (0, segs) else side * amp * rng.uniform(0.5, 1.0) * (0.4 + 0.6 * t)
        side = -side
        pts.append(d * (r0 + (r1 - r0) * t) + nrm * off)
    return pts


def star(r_out, r_in, spikes, rot, rng):
    pts = []
    for i in range(spikes * 2):
        a = rot + i / (spikes * 2) * 6.2832
        r = r_out * rng.uniform(0.75, 1.15) if i % 2 == 0 else r_in
        pts.append(Vector((math.cos(a) * r, math.sin(a) * r)))
    return pts


def circle(r, n=40):
    return [Vector((math.cos(i / n * 6.2832), math.sin(i / n * 6.2832))) * r for i in range(n)]


def frame_shapes(f):
    """the drawing for frame f (1..FRAMES)"""
    S = Sketch()
    epoch = (f - 1) // 2                                      # the rays re-jag every two frames (crackle)
    rng = random.Random(1000 + epoch * 17)
    # --- flash disc behind the core on the first frames (hard toon flash, not a soft glow)
    disc = {1: 0.30, 2: 0.36, 3: 0.24}.get(f, 0.0)
    if disc:
        for band, k in ((1, 1.0), (2, 0.86), (3, 0.70)): S.poly(circle(disc * k), band)
    # --- core: a spiky star, big and white on frames 1-4, then shrinking into a small violet spark
    core = {1: 0.30, 2: 0.50, 3: 0.47, 4: 0.40, 5: 0.33, 6: 0.26, 7: 0.20, 8: 0.14, 9: 0.09, 10: 0.05}.get(f, 0.0)
    if core > 0:
        top = 4 if f <= 7 else 3
        rot = random.Random(500 + epoch).uniform(0, 1)
        for band in range(0, top + 1):
            k = [1.0, 0.86, 0.72, 0.58, 0.44][band]
            S.poly(star(core * k, core * k * 0.40, 8, rot, random.Random(500 + epoch)), band)
    # --- main bolts: bold zig-zags that shoot out, crackle, thin out, detach from the core and break up
    reach = {1: 0.42, 2: 0.82, 3: 1.00, 4: 1.04, 5: 1.06, 6: 1.06, 7: 1.05, 8: 1.04, 9: 1.03, 10: 1.02, 11: 1.0, 12: 0.98, 13: 0.96, 14: 0.94, 15: 0.92}.get(f, 0.0)
    width = {1: 0.100, 2: 0.120, 3: 0.114, 4: 0.102, 5: 0.090, 6: 0.078, 7: 0.066, 8: 0.054, 9: 0.044, 10: 0.036, 11: 0.030, 12: 0.026, 13: 0.023, 14: 0.020, 15: 0.017}.get(f, 0.0)
    start = {8: 0.14, 9: 0.26, 10: 0.36, 11: 0.45, 12: 0.53, 13: 0.60, 14: 0.66, 15: 0.71}.get(f, 0.04)
    core_until = {1: 1.0, 2: 0.90, 3: 0.80, 4: 0.70, 5: 0.60, 6: 0.50, 7: 0.40, 8: 0.28, 9: 0.15}.get(f, 0.0)
    if reach > 0:
        base_rng = random.Random(7)
        n_rays = 7
        angles = [(i + base_rng.uniform(-0.22, 0.22)) / n_rays * 6.2832 + 0.25 for i in range(n_rays)]
        lens = [base_rng.uniform(0.80, 1.08) for _ in range(n_rays)]
        for i, (a0, ln) in enumerate(zip(angles, lens)):
            a = a0 + rng.uniform(-0.05, 0.05)
            r1 = reach * ln
            if start >= r1 - 0.12: continue
            if f >= 12 and (i + f) % 3 == 0: continue          # the last crackles flicker out one by one
            pts = jag(a, start, r1, rng, 5, 0.13 * ln)
            W = width * (0.85 + 0.3 * ln)
            if f >= 10:   # broken into two fragments with a gap
                frag = random.Random(f * 31 + i); cut = frag.randint(2, 3)
                S.stroke(pts[:cut], lambda t, W=W: W * (1.0 - 0.5 * t), 0.0)
                S.stroke(pts[cut + 1:], lambda t, W=W: W * (1.0 - 0.7 * t), 0.0)
            else:
                S.stroke(pts, lambda t, W=W: W * (1.0 - 0.72 * t), core_until)
            # a fork off the middle of each longer bolt
            if 2 <= f <= 10 and ln > 0.88:
                j = rng.randint(2, 3)
                root = pts[j]; dirv = (pts[j + 1] - pts[j - 1]).normalized()
                ang = math.atan2(dirv.y, dirv.x) + rng.choice((-1, 1)) * rng.uniform(0.55, 0.85)
                bl = (r1 - root.length) * rng.uniform(0.70, 0.95)
                if bl > 0.14:
                    d = Vector((math.cos(ang), math.sin(ang))); nrm = Vector((-d.y, d.x))
                    bp = [root + d * bl * (k / 3) + nrm * (0 if k in (0, 3) else rng.uniform(-0.06, 0.06)) for k in range(4)]
                    S.stroke(bp, lambda t, W=W: W * 0.62 * (1.0 - 0.8 * t), 0.35 if f <= 5 else 0.0)
        # short spikes between the bolts (frames 2-6) fill the star shape
        if 2 <= f <= 6:
            for i in range(n_rays):
                a = (angles[i] + angles[(i + 1) % n_rays] + (6.2832 if i == n_rays - 1 else 0)) / 2 + rng.uniform(-0.1, 0.1)
                pts = jag(a, 0.05, reach * rng.uniform(0.38, 0.52), rng, 2, 0.05)
                S.stroke(pts, lambda t: width * 0.7 * (1.0 - 0.8 * t), 0.5)
    # --- shock ring: a violet/cyan circle racing out, tearing open as it thins (frames 2-7)
    ring = {2: 0.40, 3: 0.62, 4: 0.78, 5: 0.89, 6: 0.97, 7: 1.03}.get(f, 0.0)
    if ring:
        th = {2: 0.070, 3: 0.058, 4: 0.046, 5: 0.034, 6: 0.024, 7: 0.016}[f]
        rrng = random.Random(40 + f)
        segs = 56
        pts = [Vector((math.cos(i / segs * 6.2832), math.sin(i / segs * 6.2832))) * ring * rrng.uniform(0.99, 1.01) for i in range(segs + 1)]
        pts[-1] = pts[0]
        gaps = set(rrng.sample(range(segs), {2: 0, 3: 3, 4: 6, 5: 9, 6: 13, 7: 18}[f]))
        run = []
        for i in range(segs + 1):
            if i in gaps or i == segs:
                if len(run) >= 2:
                    for band, k in ((0, 1.0), (1, 0.72), (2, 0.40)):
                        S.ribbon(run, [th * k * (0.3 if q in (0, len(run) - 1) else 1.0) for q in range(len(run))], band)
                run = []
            else:
                run.append(pts[i])
    # --- sparks: little diamonds flung out, each with a dark rim and a light centre
    srng = random.Random(77)
    for k in range(10):
        a = srng.uniform(0, 6.2832); v = srng.uniform(0.10, 0.14); f0 = srng.uniform(1.5, 3.0); life = srng.uniform(6.0, 10.5)
        t = f - f0
        if t < 0 or t > life: continue
        d = Vector((math.cos(a), math.sin(a)))
        p = d * (0.22 + v * t * (1.0 - 0.04 * t))
        size = srng.uniform(0.038, 0.052) * (1.0 - t / life * 0.6)
        nrm = Vector((-d.y, d.x))
        for band, kk in ((0, 1.0), (2, 0.66), (4 if t < 2.5 else 3, 0.34)):
            L_ = size * 2.4 * kk; W_ = size * 0.85 * kk
            S.poly([p + d * L_, p + nrm * W_, p - d * L_ * 0.8, p - nrm * W_], band)
    return S


def build_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, FRAMES
    sc.render.fps = 24
    mat = build_material()
    root = bpy.data.collections.new("Zap frames"); sc.collection.children.link(root)
    for f in range(1, FRAMES + 1):
        col = bpy.data.collections.new(f"Zap f{f:02d}"); root.children.link(col)
        S = frame_shapes(f)
        if not S.verts: continue
        ob = S.build(f"Zap f{f:02d}", mat, col)
        # stop-motion: visible on its own frame only
        for fr, hide in ((f - 1, True), (f, False), (f + 1, True)):
            if fr < 1: continue
            ob.hide_render = hide; ob.hide_viewport = hide
            ob.keyframe_insert("hide_render", frame=fr); ob.keyframe_insert("hide_viewport", frame=fr)
    cam = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
    sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = "ORTHO"; cam.data.ortho_scale = 2.62
    cam.location = (0, -8, 0); cam.rotation_euler = (math.radians(90), 0, 0)
    world = bpy.data.worlds.new("World"); world.use_nodes = True; sc.world = world
    bg = world.node_tree.nodes.get("Background")
    if bg: bg.inputs["Color"].default_value = (0.05, 0.05, 0.10, 1.0)
    sc.render.engine = "CYCLES"; use_best_device(sc); sc.cycles.samples = 16; sc.cycles.use_denoising = False
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = SIZE; sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
    try: sc.view_settings.view_transform = "Raw"
    except TypeError: sc.view_settings.view_transform = "Standard"
    return sc


def render_atlas(out_dir, data=True):
    sc = build_scene()
    bpy.data.materials["ZapBurst"].node_tree.nodes["Preview"].outputs[0].default_value = 0.0 if data else 1.0
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
    bpy.data.materials["ZapBurst"].node_tree.nodes["Preview"].outputs[0].default_value = 1.0
    bpy.context.scene.frame_set(3)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(opt["save"]), compress=True)
    print("SAVED", opt["save"], flush=True)
