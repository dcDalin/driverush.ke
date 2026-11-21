"""
Renders a board car in a school's paint, for checking a new school's art and
for the school's sales deck. Run by scripts/render-sponsor-car.mjs:

  blender -b --factory-startup -P scripts/blender/turntable.py -- <car.glb> <wrap.png> <out dir>

Writes seat-<n>.png (the board camera's own tilt, from four sides, as a
learner at the table sees it) and side-left.png / side-right.png / top.png.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

car_path, wrap_path, out_dir = sys.argv[sys.argv.index("--") + 1 :][:3]
os.makedirs(out_dir, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=car_path)

image = bpy.data.images.load(wrap_path)
for obj in bpy.context.scene.objects:
    if obj.type != "MESH":
        continue
    if obj.name.startswith("paint"):
        mat = bpy.data.materials.new("wrap")
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        bsdf = nodes["Principled BSDF"]
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = image
        mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        bsdf.inputs["Roughness"].default_value = 0.4
        obj.data.materials.clear()
        obj.data.materials.append(mat)
    elif obj.name.startswith("body") or obj.name.startswith("wheel"):
        # Show the pack's vertex colours.
        mat = bpy.data.materials.new("body")
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        attr = nodes.new("ShaderNodeVertexColor")
        mat.node_tree.links.new(attr.outputs["Color"], nodes["Principled BSDF"].inputs["Base Color"])
        obj.data.materials.clear()
        obj.data.materials.append(mat)

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items.keys() else "BLENDER_EEVEE"
scene.render.resolution_x = 1200
scene.render.resolution_y = 800
scene.render.film_transparent = False
world = bpy.data.worlds.new("w")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.31, 0.30, 0.28, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
scene.world = world

sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 3.5
sun.rotation_euler = (math.radians(40), math.radians(15), math.radians(30))
scene.collection.objects.link(sun)

cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
cam.data.lens = 50
scene.collection.objects.link(cam)
scene.camera = cam

# glTF's y-up car (nose -z) arrives in Blender z-up with its nose at +y.
target = Vector((0, 0, 0.75))


def shoot(name, heading_deg, tilt_deg, dist):
    h = math.radians(heading_deg)
    t = math.radians(tilt_deg)
    cam.location = target + Vector(
        (math.sin(h) * math.cos(t) * dist, -math.cos(h) * math.cos(t) * dist, math.sin(t) * dist)
    )
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = os.path.join(out_dir, name + ".png")
    bpy.ops.render.render(write_still=True)


# The board camera looks down at 40 to 47 degrees; the car turns under it.
for n, heading in enumerate([30, 120, 210, 300]):
    shoot(f"seat-{n + 1}", heading, 44, 11)
shoot("side-left", 270, 8, 9)
shoot("side-right", 90, 8, 9)
shoot("top", 0, 89, 9)
