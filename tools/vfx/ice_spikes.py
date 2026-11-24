"""Stylized ice spike clusters for Troll Hunting (ice wall / glacier spikes), built headless in Blender (tested with 5.3).

Three low-poly, flat-shaded crystal clusters, each one dominant tall hexagonal spike plus a few smaller shards leaning
outward (and a tiny chip or two at the foot), every variant a different arrangement:
  IceSpikeA  straight main spike, three shards spread around it
  IceSpikeB  slightly leaning main spike with a big companion shard on one side
  IceSpikeC  straight main spike in a crown of four shards
Every mesh is normalised the same way: the main spike's base centre is the origin, nothing goes below the ground
(min Y = 0 after the glTF Y-up conversion, the shards are cut flat at the ground), total height exactly 1.0, the main
spike's base radius 0.2, hard facets (split normals), no UVs, transforms applied. Colour is a vertex colour (glTF
COLOR_0, linear RGB): deep blue #0b356c at the foot of every crystal -> mid blue #4fa8e8 -> near-white #e2f6ff only on
the tip facets.

  blender -b --factory-startup --python tools/vfx/ice_spikes.py -- --export src/assets/vfx/ice_spikes.glb
  blender -b --factory-startup --python tools/vfx/ice_spikes.py -- --save tools/vfx/ice_spikes.blend
  blender -b --factory-startup --python tools/vfx/ice_spikes.py -- --preview OUT.png

--export writes the GLB (the three meshes, each at the origin); --save writes the scene with the three clusters side by
side for viewing (the export always puts them back at the origin); --preview renders a colour preview of the three.
Run on a saved .blend (blender -b tools/vfx/ice_spikes.blend --python ... -- --export ...) it exports the meshes in it.
"""
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vfx_device import use_best_device  # noqa: E402  (CPU; VFX_DEVICE=GPU esetén a videókártya)

NAMES = ("IceSpikeA", "IceSpikeB", "IceSpikeC")
MAIN_R = 0.2
TRI_BUDGET = 260
DEEP, MID, TIP = "#0b356c", "#4fa8e8", "#e2f6ff"
VIEW_SPACING = 0.85            # side-by-side spacing in the .blend / preview (the export ignores it)

# crystal layouts (Blender Z-up). main: (tilt deg, tilt azimuth deg); shards / chips: (azimuth deg, offset from the
# centre, tilt deg, length, base radius, sides)
VARIANTS = {
    "IceSpikeA": dict(seed=11, main=(2.0, 30.0),
                      shards=[(20, 0.10, 31, 0.62, 0.120, 6), (145, 0.10, 27, 0.48, 0.100, 6), (262, 0.09, 38, 0.36, 0.085, 6)],
                      chips=[(205, 0.17, 52, 0.17, 0.050, 5)]),
    "IceSpikeB": dict(seed=23, main=(7.0, 20.0),
                      shards=[(198, 0.11, 22, 0.74, 0.130, 6), (252, 0.10, 41, 0.44, 0.095, 6), (48, 0.10, 46, 0.27, 0.072, 5)],
                      chips=[(120, 0.16, 54, 0.15, 0.045, 5), (300, 0.17, 50, 0.13, 0.042, 5)]),
    "IceSpikeC": dict(seed=37, main=(1.5, 200.0),
                      shards=[(12, 0.10, 34, 0.52, 0.110, 6), (100, 0.10, 30, 0.45, 0.100, 6), (188, 0.10, 38, 0.40, 0.092, 6),
                              (278, 0.10, 33, 0.34, 0.085, 6)],
                      chips=[(55, 0.17, 52, 0.15, 0.045, 5)]),
}


def args():
    a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    opt = {"save": None, "export": None, "preview": None}
    i = 0
    while i < len(a):
        if a[i] in ("--save", "--export", "--preview"): opt[a[i][2:]] = a[i + 1]; i += 2
        else: i += 1
    return opt


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_srgb(h):
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]


def gradient(u):
    """position along a crystal (0 foot .. 1 tip) -> linear RGB; blended in sRGB, stored linear (glTF COLOR_0)"""
    d, m, t = hex_srgb(DEEP), hex_srgb(MID), hex_srgb(TIP)
    stops = [(0.0, d), (0.70, m), (0.84, m), (1.0, t)]
    u = max(0.0, min(1.0, u))
    for (u0, c0), (u1, c1) in zip(stops, stops[1:]):
        if u <= u1:
            k = (u - u0) / (u1 - u0) if u1 > u0 else 1.0
            k = k * k * (3 - 2 * k) if u0 == 0.0 else k            # ease the foot -> mid blend
            return [srgb_to_linear(a + (b - a) * k) for a, b in zip(c0, c1)]
    return [srgb_to_linear(c) for c in t]


def crystal(base, axis, length, radius, sides, rng, levels):
    """one faceted crystal as its own bmesh: rings of `sides` vertices up the axis, closed by a pointed tip.
    levels: [(position along the axis 0..1, radius factor, twist deg)], the tip is added at 1.0. Open at the foot."""
    bm = bmesh.new()
    axis = axis.normalized()
    side = axis.cross(Vector((0.0, 0.0, 1.0)) if abs(axis.z) < 0.99 else Vector((1.0, 0.0, 0.0))).normalized()
    fwd = axis.cross(side).normalized()
    spin = rng.uniform(0, 2 * math.pi / sides)
    jit = [rng.uniform(0.90, 1.08) for _ in range(sides)]          # slightly irregular facets
    rings = []
    for t, rf, tw in levels:
        ring = []
        for k in range(sides):
            a = spin + (k / sides) * 2 * math.pi + math.radians(tw)
            r = radius * rf * jit[k]
            ring.append(bm.verts.new(base + axis * (length * t) + (side * math.cos(a) + fwd * math.sin(a)) * r))
        rings.append(ring)
    tip_off = (side * rng.uniform(-1, 1) + fwd * rng.uniform(-1, 1)) * radius * 0.10
    tip = bm.verts.new(base + axis * length + tip_off)
    for lo, hi in zip(rings, rings[1:]):
        for k in range(sides):
            bm.faces.new((lo[k], lo[(k + 1) % sides], hi[(k + 1) % sides], hi[k]))
    for k in range(sides):
        bm.faces.new((rings[-1][k], rings[-1][(k + 1) % sides], tip))
    # cut flat at the ground: nothing below z = 0
    geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
    bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-6, plane_co=(0.0, 0.0, 0.0), plane_no=(0.0, 0.0, 1.0), clear_inner=True)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    # gradient by the position along this crystal's own axis (so every crystal is white only at its own tip)
    col = [(v.co.copy(), gradient((v.co - base).dot(axis) / length)) for v in bm.verts]
    return bm, col


def direction(tilt_deg, az_deg):
    t, a = math.radians(tilt_deg), math.radians(az_deg)
    return Vector((math.sin(t) * math.cos(a), math.sin(t) * math.sin(a), math.cos(t)))


def build_cluster(name, spec):
    rng = random.Random(spec["seed"])
    parts = []
    # the dominant spike: a hexagonal prism that tapers a little, then a two-stage faceted point
    tilt, az = spec["main"]
    parts.append(crystal(Vector((0.0, 0.0, -0.02)), direction(tilt, az), 1.02, MAIN_R, 6, rng,
                         [(0.0, 1.0, 0.0), (0.66, 0.86, 4.0), (0.86, 0.42, 8.0)]))
    # shards and chips lean outward from inside the main spike's foot (their foot is buried, then cut at the ground)
    for az, off, tilt, ln, r, sides in spec["shards"] + spec.get("chips", []):
        a = math.radians(az)
        base = Vector((math.cos(a) * off, math.sin(a) * off, -0.05 if ln > 0.2 else -0.025))
        lv = [(0.0, 1.0, 0.0), (0.70, 0.80, 5.0)] if ln > 0.2 else [(0.0, 1.0, 0.0), (0.55, 0.75, 0.0)]
        parts.append(crystal(base, direction(tilt + rng.uniform(-3, 3), az + rng.uniform(-6, 6)), ln + 0.05, r, sides, rng, lv))

    # merge the parts into one mesh, normalise: min Z = 0, height exactly 1.0 (main base radius stays MAIN_R)
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    colours = []
    for part, col in parts:
        vmap = {}
        for v in part.verts:
            vmap[v] = bm.verts.new(v.co)
        for f in part.faces:
            bm.faces.new([vmap[v] for v in f.verts])
        colours += [c for _, c in col]
        part.free()
    bm.verts.index_update()
    zmin = min(v.co.z for v in bm.verts); zmax = max(v.co.z for v in bm.verts)
    for v in bm.verts:
        v.co.z = (v.co.z - zmin) / (zmax - zmin)
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = False                      # hard facets
    ca = me.color_attributes.new(name="Color", type="FLOAT_COLOR", domain="POINT")
    for i, c in enumerate(colours):
        ca.data[i].color = (*c, 1.0)
    me.color_attributes.active_color = ca
    me.color_attributes.render_color_index = 0
    ob = bpy.data.objects.new(name, me)
    return ob


def build_material():
    """a plain default material that shows the vertex colours in Blender (the game uses its own ice material)"""
    mat = bpy.data.materials.new("IceSpike"); mat.use_nodes = True
    mat.use_backface_culling = True                                  # single-sided (the meshes are open at the ground)
    nt = mat.node_tree; N = nt.nodes; L = nt.links
    bsdf = N.get("Principled BSDF")
    attr = N.new("ShaderNodeVertexColor"); attr.layer_name = "Color"; attr.location = (-400, 200)
    L.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.25
    return mat


def build_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    mat = build_material()
    col = bpy.data.collections.new("Ice spikes"); sc.collection.children.link(col)
    for name in NAMES:
        ob = build_cluster(name, VARIANTS[name])
        ob.data.materials.append(mat)
        col.objects.link(ob)
        tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
        assert tris <= TRI_BUDGET, f"{name}: {tris} triangles"
    arrange(True)
    return sc


def arrange(side_by_side):
    for i, name in enumerate(NAMES):
        ob = bpy.data.objects[name]
        ob.location = ((i - 1) * VIEW_SPACING if side_by_side else 0.0, 0.0, 0.0)


def report():
    for name in NAMES:
        me = bpy.data.objects[name].data
        xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
        tris = sum(len(p.vertices) - 2 for p in me.polygons)
        print(f"MESH {name}: {tris} tris, {len(me.vertices)} verts, x {min(xs):.3f}..{max(xs):.3f}, "
              f"depth {min(ys):.3f}..{max(ys):.3f}, height {min(zs):.3f}..{max(zs):.3f}", flush=True)


def export(path):
    arrange(False)                                   # every mesh at the origin, identity transforms
    bpy.ops.object.select_all(action="DESELECT")
    for name in NAMES: bpy.data.objects[name].select_set(True)
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(path), export_format="GLB", use_selection=True,
                              export_yup=True, export_apply=True, export_texcoords=False, export_normals=True,
                              export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_materials="EXPORT",
                              export_animations=False, export_cameras=False, export_lights=False, export_extras=False)
    arrange(True)
    print("EXPORTED", path, flush=True)


def render_preview(path):
    sc = bpy.context.scene
    arrange(True)
    for ob in [o for o in sc.objects if o.type in ("CAMERA", "LIGHT")]: bpy.data.objects.remove(ob)
    mat = bpy.data.materials["IceSpike"]
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    attr = [n for n in mat.node_tree.nodes if n.type == "VERTEX_COLOR"][0]
    mat.node_tree.links.new(attr.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 0.35                 # like the game's emissive ice
    ground = bpy.data.objects.get("Preview ground")
    if ground is None:
        gm = bpy.data.meshes.new("Preview ground"); bm = bmesh.new()
        bmesh.ops.create_circle(bm, cap_ends=True, segments=48, radius=2.2); bm.to_mesh(gm); bm.free()
        ground = bpy.data.objects.new("Preview ground", gm); sc.collection.objects.link(ground)
        gmat = bpy.data.materials.new("Preview ground"); gmat.use_nodes = True
        gmat.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = (0.05, 0.07, 0.09, 1.0)
        gm.materials.append(gmat)
    cam = bpy.data.objects.new("Preview camera", bpy.data.cameras.new("Preview camera")); sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = "ORTHO"; cam.data.ortho_scale = 2.75
    e = math.radians(16.0)
    cam.rotation_euler = (math.radians(90) - e, 0.0, 0.0)
    cam.location = Vector((0.0, -6.0 * math.cos(e), 6.0 * math.sin(e) + 0.45))
    sun = bpy.data.objects.new("Preview sun", bpy.data.lights.new("Preview sun", "SUN")); sc.collection.objects.link(sun)
    sun.data.energy = 3.2; sun.rotation_euler = (math.radians(50), math.radians(-28), math.radians(-35))
    world = sc.world or bpy.data.worlds.new("World"); sc.world = world; world.use_nodes = True
    bg = world.node_tree.nodes.get("Background"); bg.inputs["Color"].default_value = (0.16, 0.20, 0.27, 1.0); bg.inputs["Strength"].default_value = 0.8
    sc.render.engine = "CYCLES"; use_best_device(sc); sc.cycles.samples = 64; sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = 960, 400
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "Standard"
    sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGB"
    sc.render.filepath = os.path.abspath(path)
    bpy.ops.render.render(write_still=True)
    # leave the .blend as it was built
    for ob in (cam, sun, ground): bpy.data.objects.remove(ob)
    for n in [l for l in mat.node_tree.links if l.to_socket == bsdf.inputs["Emission Color"]]: mat.node_tree.links.remove(n)
    bsdf.inputs["Emission Strength"].default_value = 0.0
    print("PREVIEW", path, flush=True)


opt = args()
if not all(n in bpy.data.objects for n in NAMES):
    build_scene()
report()
if opt["export"]: export(opt["export"])
if opt["preview"]: render_preview(opt["preview"])
if opt["save"]:
    arrange(True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(opt["save"]), compress=True)
    print("SAVED", opt["save"], flush=True)
