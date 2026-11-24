"""Cartoon poison skull icon (skull + crossed bones) for Troll Hunting, built and rendered headless in Blender (tested with 5.3).

A front-facing, chunky toon skull with two crossed bones behind it, played as a 16-frame flipbook while the game
moves the sprite upward:
  frames 1-4   pop in: scale up with a springy overshoot and a little twist
  frames 5-12  hold: a slow side-to-side wobble while the jaw chatters twice
  frames 13-16 dissolve: screen-space noise eats it away, outer parts first, while it swells a little
Every piece (face, teeth, bones) has an "inverted hull" ink copy: the same mesh pushed out along the normals (Displace
modifier) that only shows its back faces, so each silhouette gets an even, thick ink line, also where the face overlaps
the teeth and the bones. The pieces sit in depth layers (ortho camera: depth does not change their size), so a piece in
front always draws its ink over the pieces behind it. Eye sockets, nose and tooth gaps are flat ink decals.
The texture stores DATA, not colour (one 4x4 atlas of 256 px cells, 1024x1024):
  RGB = toon band: 0.10 ink outline / sockets, 0.32 shadow, 0.54 mid, 0.76 light, 1.00 highlight (glint)
  A   = coverage
The game tints the bands with its own palette (poison green).

  blender -b --factory-startup --python tools/vfx/poison_skull.py -- --save tools/vfx/poison_skull.blend
  blender -b --factory-startup --python tools/vfx/poison_skull.py -- --render --out OUTDIR [--preview]

--save writes the scene (opens in colour-preview mode: set the "Preview" value node to 0 for the game data).
--render rebuilds the scene from this script and packs the 16 frames into OUTDIR/poison_skull_atlas.png
(frame 0 top-left, left-to-right, top-to-bottom); --preview renders the colour version instead.
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vfx_device import use_best_device  # noqa: E402  (CPU; VFX_DEVICE=GPU esetén a videókártya)

FRAMES = 16
SIZE = 256
GRID = 4
NAME = "poison_skull"
DATA = [0.10, 0.32, 0.54, 0.76, 1.00]                 # ink, shadow, mid, light, highlight
SHADE = [(0.00, 1), (0.40, 2), (0.62, 3), (0.93, 4)]  # (light threshold, band)
PREVIEW = [(0.05, 0.11, 0.04), (0.16, 0.38, 0.08), (0.38, 0.70, 0.14), (0.66, 0.92, 0.30), (0.93, 1.00, 0.72)]
LIGHT = Vector((-0.55, -0.62, 0.56)).normalized()    # upper left, towards the camera
VIEW = Vector((0.0, -1.0, 0.0))                       # the ortho camera looks along +Y
INK_W = 0.085                                         # ink outline width (world units; 1 unit = SIZE / ORTHO px)
ORTHO = 2.80
KIND_BODY, KIND_HULL, KIND_DECAL = 0.0, 1.0, 2.0

# layout (icon root space, at rest): face in front, teeth behind it, bones behind both
FACE_Z = 0.16
TEETH = dict(z=FACE_Z - 0.63, y=0.60, hx=0.30, hy=0.15, hz=0.175)
BONES = dict(z=-0.30, length=2.02, angle=40.0, y=(1.10, 1.55))


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


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3.0 - 2.0 * t)


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
    """one material for every piece; the object property "kind" says what it is: 0 = shaded body,
    1 = ink hull (only its back faces show, as ink), 2 = flat ink decal. "tone" darkens a body (bones sit behind)."""
    mat = bpy.data.materials.new("PoisonSkull"); mat.use_nodes = True
    nt = mat.node_tree; N = nt.nodes; L = nt.links; N.clear()
    out = N.new("ShaderNodeOutputMaterial"); out.location = (1600, 0)
    erode = N.new("ShaderNodeValue"); erode.name = erode.label = "Erode"                     # animated: -1 (whole) -> ~0.55
    boil = N.new("ShaderNodeValue"); boil.name = boil.label = "Boil"                         # animated noise W
    preview = N.new("ShaderNodeValue"); preview.name = preview.label = "Preview"; preview.outputs[0].default_value = 1.0
    gloss = N.new("ShaderNodeValue"); gloss.name = gloss.label = "Gloss"; gloss.outputs[0].default_value = 0.972   # glint size (smaller = bigger)
    for n, y in [(erode, 400), (boil, 250), (preview, 100), (gloss, -50)]: n.location = (-1500, y)

    kind = N.new("ShaderNodeAttribute"); kind.attribute_type = "OBJECT"; kind.attribute_name = "kind"; kind.label = "Kind (object)"
    tone = N.new("ShaderNodeAttribute"); tone.attribute_type = "OBJECT"; tone.attribute_name = "tone"; tone.label = "Tone (object)"
    geo = N.new("ShaderNodeNewGeometry")

    # body shading: light = (N.L)*0.5+0.5 times the tone -> bands 1..4, plus a hard glint (Blinn N.H) -> band 4
    dot = N.new("ShaderNodeVectorMath"); dot.operation = "DOT_PRODUCT"; dot.label = "N.L"
    L.new(geo.outputs["Normal"], dot.inputs[0]); dot.inputs[1].default_value = LIGHT
    lit = math_node(N, "MULTIPLY_ADD"); L.new(dot.outputs["Value"], lit.inputs[0]); lit.inputs[1].default_value = 0.5; lit.inputs[2].default_value = 0.5
    light = math_node(N, "MULTIPLY", clamp=True, label="Light"); L.new(lit.outputs[0], light.inputs[0]); L.new(tone.outputs["Fac"], light.inputs[1])
    bands = ramp(N, [(p, (b / 4, b / 4, b / 4)) for p, b in SHADE]); bands.label = "Light bands"
    L.new(light.outputs[0], bands.inputs["Fac"])
    half = (LIGHT + VIEW).normalized()
    dh = N.new("ShaderNodeVectorMath"); dh.operation = "DOT_PRODUCT"; dh.label = "N.H"
    L.new(geo.outputs["Normal"], dh.inputs[0]); dh.inputs[1].default_value = half
    spec = math_node(N, "GREATER_THAN"); L.new(dh.outputs["Value"], spec.inputs[0]); L.new(gloss.outputs[0], spec.inputs[1])
    body = math_node(N, "MAXIMUM", label="Body band / 4"); L.new(bands.outputs["Color"], body.inputs[0]); L.new(spec.outputs[0], body.inputs[1])

    # hulls and decals are ink (band 0)
    is_body = math_node(N, "LESS_THAN", b=0.5); L.new(kind.outputs["Fac"], is_body.inputs[0])
    band = math_node(N, "MULTIPLY", label="Band / 4"); L.new(body.outputs[0], band.inputs[0]); L.new(is_body.outputs[0], band.inputs[1])
    data = ramp(N, [(max(0.0, (i - 0.5) / 4), (d, d, d)) for i, d in enumerate(DATA)]); data.label = "Band data"
    col = ramp(N, [(max(0.0, (i - 0.5) / 4), c) for i, c in enumerate(PREVIEW)]); col.label = "Band preview"
    L.new(band.outputs[0], data.inputs["Fac"]); L.new(band.outputs[0], col.inputs["Fac"])
    mix = N.new("ShaderNodeMix"); mix.data_type = "RGBA"
    L.new(preview.outputs[0], mix.inputs["Factor"]); L.new(data.outputs["Color"], mix.inputs[6]); L.new(col.outputs["Color"], mix.inputs[7])
    em = N.new("ShaderNodeEmission"); L.new(mix.outputs[2], em.inputs["Color"])

    # a hull only shows its back faces (seen through its own transparent front: an even ring around the silhouette)
    is_hull = math_node(N, "COMPARE", b=1.0); is_hull.inputs[2].default_value = 0.5; L.new(kind.outputs["Fac"], is_hull.inputs[0])
    front = math_node(N, "SUBTRACT", a=1.0); L.new(geo.outputs["Backfacing"], front.inputs[1])
    hide = math_node(N, "MULTIPLY"); L.new(is_hull.outputs[0], hide.inputs[0]); L.new(front.outputs[0], hide.inputs[1])
    shown = math_node(N, "SUBTRACT", a=1.0); L.new(hide.outputs[0], shown.inputs[1])

    # dissolve: noise in SCREEN space (Window coordinates), so a hole goes through body, hull and decal alike;
    # the threshold grows with the distance from the cell centre, so the outer parts go first
    tc = N.new("ShaderNodeTexCoord")
    ctr = N.new("ShaderNodeVectorMath"); ctr.operation = "SUBTRACT"; L.new(tc.outputs["Window"], ctr.inputs[0]); ctr.inputs[1].default_value = (0.5, 0.5, 0.0)
    rad = N.new("ShaderNodeVectorMath"); rad.operation = "LENGTH"; L.new(ctr.outputs["Vector"], rad.inputs[0])
    nz = N.new("ShaderNodeTexNoise"); nz.noise_dimensions = "4D"; nz.inputs["Scale"].default_value = 7.0; nz.inputs["Detail"].default_value = 3.0
    L.new(tc.outputs["Window"], nz.inputs["Vector"]); L.new(boil.outputs[0], nz.inputs["W"])
    thr = math_node(N, "MULTIPLY_ADD", label="Erode by radius"); L.new(rad.outputs["Value"], thr.inputs[0]); thr.inputs[1].default_value = 0.70; L.new(erode.outputs[0], thr.inputs[2])
    keep = math_node(N, "GREATER_THAN", label="Keep"); L.new(nz.outputs["Fac"], keep.inputs[0]); L.new(thr.outputs[0], keep.inputs[1])
    vis = math_node(N, "MULTIPLY", label="Visible"); L.new(keep.outputs[0], vis.inputs[0]); L.new(shown.outputs[0], vis.inputs[1])
    tr = N.new("ShaderNodeBsdfTransparent"); ms = N.new("ShaderNodeMixShader")
    L.new(vis.outputs[0], ms.inputs["Fac"]); L.new(tr.outputs[0], ms.inputs[1]); L.new(em.outputs[0], ms.inputs[2])
    L.new(ms.outputs[0], out.inputs["Surface"])

    for f, e in [(1, -1.0), (12, -1.0), (13, 0.13), (14, 0.26), (15, 0.38), (16, 0.50)]:
        erode.outputs[0].default_value = e; erode.outputs[0].keyframe_insert("default_value", frame=f)
    for f, w in [(1, 0.0), (FRAMES, 1.4)]:
        boil.outputs[0].default_value = w; boil.outputs[0].keyframe_insert("default_value", frame=f)
    return mat


# ---------------------------------------------------------------- meshes

def face_bm():
    """the skull: a round dome narrowing into cheeks and a short, squarish muzzle; flattened in depth"""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=32, radius=1.0)
    for v in bm.verts:
        x, y, z = v.co
        low = smoothstep(0.10, -0.90, z)                   # 0 on the dome, 1 at the chin
        X = x * 0.60 * (1.0 - 0.30 * low)
        Z = z * 0.55 if z > 0 else -0.60 * abs(z) ** 0.65  # fuller, flatter bottom (square-ish muzzle)
        Y = y * 0.40 * (1.0 - 0.20 * low)
        v.co = (X, Y, Z)
    return bm


def rounded_box_bm(hx, hy, hz, p=0.40, notches=()):
    """superellipsoid (rounded box); notches = x positions where the bottom edge is pinched up (tooth gaps)"""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=20, radius=1.0)
    f = lambda c: math.copysign(abs(c) ** p, c)
    for v in bm.verts:
        x, y, z = v.co
        X, Y, Z = f(x) * hx, f(y) * hy, f(z) * hz
        if Z < 0:
            pinch = max([math.exp(-((X - n) / 0.040) ** 2) for n in notches] + [0.0])
            Z += 0.045 * pinch * (-Z / hz)
        v.co = (X, Y, Z)
    return bm


def bone_bm(length, r_shaft=0.084, r_knob=0.124, spread=0.098):
    """a cartoon bone along X: a slim shaft with two round knobs at each end"""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=False, segments=24, radius1=r_shaft, radius2=r_shaft, depth=length,
                          matrix=Matrix.Rotation(math.pi / 2, 4, "Y"))
    for sx in (-1, 1):
        for sz in (-1, 1):
            bmesh.ops.create_icosphere(bm, subdivisions=3, radius=r_knob,
                                       matrix=Matrix.Translation((sx * length / 2, 0.0, sz * spread)))
    return bm


def decal_bm(hw, hh, egg=0.0, tilt=0.0):
    """a flat ink spot facing the camera (a squashed sphere); egg > 0 makes the bottom wider than the top"""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=1.0)
    c, s = math.cos(tilt), math.sin(tilt)
    for v in bm.verts:
        x, y, z = v.co
        x *= hw * (1.0 - egg * z); z *= hh; y *= 0.015
        v.co = (c * x - s * z, y, s * x + c * z)
    return bm


def link(ob, col):
    for c in list(ob.users_collection): c.objects.unlink(ob)
    col.objects.link(ob)


def make_object(name, bm, mat, col, parent=None, kind=KIND_BODY, tone=1.0, smooth=True):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = smooth
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me); col.objects.link(ob)
    ob["kind"] = kind; ob["tone"] = tone
    if parent: ob.parent = parent
    return ob


def add_hull(body, col):
    """inverted-hull ink: a linked copy of the body pushed out along its normals (edit the body, the ink follows)"""
    h = bpy.data.objects.new(body.name + " ink", body.data); col.objects.link(h)
    h["kind"] = KIND_HULL; h["tone"] = 1.0
    h.parent = body
    d = h.modifiers.new("Ink width", "DISPLACE"); d.direction = "NORMAL"; d.mid_level = 0.0; d.strength = INK_W
    return h


def surface_y(bvh, x, z):
    """depth of the front surface of a mesh at (x, z), seen from the camera (-Y)"""
    hit = bvh.ray_cast(Vector((x, -5.0, z)), Vector((0.0, 1.0, 0.0)))
    return hit[0].y if hit[0] is not None else 0.0


def collection(name):
    col = bpy.data.collections.new(name); bpy.context.scene.collection.children.link(col)
    return col


def keys(ob, ks, path):
    for f, val in ks:
        setattr(ob, path, val); ob.keyframe_insert(path, frame=f)


def build_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, FRAMES
    sc.render.fps = 24
    mat = build_material()
    c_face, c_teeth, c_bones, c_ink = collection("Skull"), collection("Teeth"), collection("Crossed bones"), collection("Ink hulls")

    root = bpy.data.objects.new("Icon", None); sc.collection.objects.link(root)
    root.empty_display_type = "SPHERE"; root.empty_display_size = 0.15

    # FACE (front layer, depth 0): dome + muzzle, eye sockets and nose as ink decals floating just in front of it
    fbm = face_bm(); bvh = BVHTree.FromBMesh(fbm)
    face = make_object("Skull", fbm, mat, c_face, parent=root)
    face.location = (0.0, 0.0, FACE_Z)
    for side in (-1, 1):
        x, z = side * 0.232, -0.05
        eye = make_object(f"Eye socket {'LR'[side > 0]}", decal_bm(0.150, 0.168, egg=0.16, tilt=side * math.radians(-9)), mat, c_face, parent=face, kind=KIND_DECAL)
        eye.location = (x, surface_y(bvh, x, z) - 0.05, z)
        x, z = side * 0.034, -0.315
        nose = make_object(f"Nose {'LR'[side > 0]}", decal_bm(0.052, 0.080, egg=0.30, tilt=side * math.radians(26)), mat, c_face, parent=face, kind=KIND_DECAL)
        nose.location = (x, surface_y(bvh, x, z) - 0.05, z)

    # TEETH (middle layer): a rounded block peeking out under the face, tooth gaps as ink lines; it chatters
    t = TEETH; gaps = (-t["hx"] / 2, 0.0, t["hx"] / 2)
    teeth = make_object("Teeth", rounded_box_bm(t["hx"], t["hy"], t["hz"], notches=gaps), mat, c_teeth, parent=root, tone=0.97)
    teeth.location = (0.0, t["y"], t["z"])
    for k, gx in enumerate(gaps):
        g = make_object(f"Tooth gap {k}", decal_bm(0.021, t["hz"] * 0.80), mat, c_teeth, parent=teeth, kind=KIND_DECAL)
        g.location = (gx, -t["hy"] - 0.03, -0.01)
    mouth = make_object("Mouth", rounded_box_bm(0.26, 0.04, 0.10), mat, c_teeth, parent=root, kind=KIND_DECAL)   # dark gap when it opens wide
    mouth.location = (0.0, t["y"] + 0.30, t["z"] + t["hz"] * 0.7)

    # CROSSED BONES (back layers): two bones in an X behind the skull, the knobs stick out at the four corners
    b = BONES; bones = []
    for k, (sgn, depth) in enumerate(zip((1, -1), b["y"])):
        bone = make_object(f"Bone {k + 1}", bone_bm(b["length"]), mat, c_bones, parent=root, tone=0.90)
        bone.location = (0.0, depth, b["z"]); bone.rotation_euler = (0.0, sgn * math.radians(b["angle"]), 0.0)
        bones.append(bone)

    for body in (face, teeth, *bones):
        link(add_hull(body, c_ink), c_ink)

    # centre the icon on the root (the pop scales around the middle of the whole outline)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get(); pts = []
    for ob in c_ink.objects:
        ev = ob.evaluated_get(dg); me = ev.to_mesh()
        pts += [ob.matrix_world @ v.co for v in me.vertices]
        ev.to_mesh_clear()
    cx = (min(p.x for p in pts) + max(p.x for p in pts)) / 2; cz = (min(p.z for p in pts) + max(p.z for p in pts)) / 2
    for ob in (face, teeth, mouth, *bones):
        ob.location.x -= cx; ob.location.z -= cz
    sc["icon_span"] = (max(p.x for p in pts) - min(p.x for p in pts), max(p.z for p in pts) - min(p.z for p in pts))

    # ANIMATION. root: pop with overshoot and a twist, wobble, swell while it dissolves (rotation about Y = in the image plane)
    pop = [(1, 0.30, -16), (2, 0.86, 7), (3, 1.11, -3), (4, 0.97, 1), (5, 1.0, 0)]
    hold = [(6, 1.0, 3.5), (7, 1.0, 5.0), (8, 1.0, 3.0), (9, 1.0, -0.5), (10, 1.0, -4.0), (11, 1.0, -5.0), (12, 1.0, -3.0)]
    fade = [(13, 1.02, -1.0), (14, 1.04, 0.5), (15, 1.06, 1.5), (16, 1.08, 2.0)]
    for f, s, deg in pop + hold + fade:
        root.scale = (s, s, s); root.rotation_euler = (0.0, math.radians(deg), 0.0)
        root.keyframe_insert("scale", frame=f); root.keyframe_insert("rotation_euler", frame=f)
    # teeth chatter twice during the hold (the ink line under the face thickens = mouth opens)
    z0 = teeth.location.z
    keys(teeth, [(f, (0.0, t["y"], z0 - d)) for f, d in [(1, 0.0), (5, 0.0), (6, 0.05), (7, 0.10), (8, 0.04), (9, 0.0), (10, 0.06), (11, 0.10), (12, 0.04), (13, 0.0), (16, 0.02)]], "location")

    cam = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
    sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = "ORTHO"; cam.data.ortho_scale = ORTHO; cam.data.clip_end = 30.0
    cam.location = (0.0, -10.0, 0.0); cam.rotation_euler = (math.radians(90), 0.0, 0.0)
    world = bpy.data.worlds.new("World"); world.use_nodes = True; sc.world = world
    bg = world.node_tree.nodes.get("Background")
    if bg: bg.inputs["Color"].default_value = (0.20, 0.24, 0.30, 1.0)
    sc.render.engine = "CYCLES"; use_best_device(sc); sc.cycles.samples = 32; sc.cycles.use_denoising = False
    sc.cycles.transparent_max_bounces = 32
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = SIZE; sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
    try: sc.view_settings.view_transform = "Raw"
    except TypeError: sc.view_settings.view_transform = "Standard"
    return sc


def render_atlas(out_dir, data=True):
    sc = build_scene()
    bpy.data.materials["PoisonSkull"].node_tree.nodes["Preview"].outputs[0].default_value = 0.0 if data else 1.0
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
    print("ATLAS", out.filepath_raw, "span", tuple(sc["icon_span"]), flush=True)


opt = args()
if opt["render"]:
    render_atlas(os.path.abspath(opt["out"] or NAME + "_out"), data=not opt["preview"])
if opt["save"]:
    build_scene()
    bpy.data.materials["PoisonSkull"].node_tree.nodes["Preview"].outputs[0].default_value = 1.0
    bpy.context.scene.frame_set(7)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(opt["save"]), compress=True)
    print("SAVED", opt["save"], flush=True)
