"""Cycles render device for the headless VFX scripts.

The default is the CPU: these flipbooks are tiny (256 px cells, 16-64 samples), so starting the GPU and uploading
the scene costs more than the render itself. Measured on an RTX 4050 Laptop (Blender 5.3), whole script run,
CPU vs OptiX: dust 4.1 vs 7.0 s, fire 2.9 vs 6.1 s, skull 4.2 vs 6.4 s, hand preview 7.2 vs 8.0 s,
ice preview 4.7 vs 3.3 s. The images match (mean difference 0.000/255).
  VFX_DEVICE=GPU     the fastest GPU backend found (OptiX > CUDA > HIP > oneAPI > Metal), else the CPU;
                     worth it for big renders (high resolution, many samples)
  VFX_DEVICE=CUDA    (or OPTIX / HIP / ONEAPI / METAL) that backend only, else the CPU
Only the GPUs of the chosen backend are used (adding the CPU next to a GPU slows small frames down).
The module is not called gpu.py on purpose: Blender has a built-in `gpu` module.
"""
import os

import bpy

ORDER = ("OPTIX", "CUDA", "HIP", "ONEAPI", "METAL")


def use_best_device(scene):
    want = os.environ.get("VFX_DEVICE", "").strip().upper()
    if want == "GPU" or want in ORDER:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for kind in ((want,) if want in ORDER else ORDER):
            try:
                prefs.compute_device_type = kind
            except TypeError:                        # this Blender build has no such backend
                continue
            (getattr(prefs, "refresh_devices", None) or prefs.get_devices)()
            gpus = [d for d in prefs.devices if d.type == kind]
            if not gpus:
                continue
            for d in prefs.devices:
                d.use = d.type == kind
            scene.cycles.device = "GPU"
            print(f"[vfx] Cycles device: {kind} ({', '.join(d.name for d in gpus)})", flush=True)
            return kind
        print(f"[vfx] no usable GPU for VFX_DEVICE={want}, rendering on the CPU", flush=True)
    scene.cycles.device = "CPU"
    print("[vfx] Cycles device: CPU", flush=True)
    return "CPU"
