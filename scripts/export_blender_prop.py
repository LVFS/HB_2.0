# Esporta i mesh del .blend aperto in public/models/props/<nome>.glb
#
# Uso da Blender: apri il .blend da assets/blender/, Scripting > Open questo
# file > Run Script (Alt+P). Da terminale, senza aprire Blender:
#   blender -b assets/blender/scala.blend --python scripts/export_blender_prop.py
#
# Nome del .glb = nome del .blend con "_" -> "-" (bancone_snack.blend ->
# bancone-snack.glb), tranne le eccezioni in GLB_NAME_OVERRIDES. In LDtk lo
# spriteId è "model:<nome del .glb senza estensione>".
import os

import bpy

GLB_NAME_OVERRIDES = {"scala": "scale"}

blend_path = bpy.data.filepath
if not blend_path:
    raise RuntimeError("Salva prima il .blend in assets/blender/")

blend_name = os.path.splitext(os.path.basename(blend_path))[0]
glb_name = GLB_NAME_OVERRIDES.get(blend_name, blend_name.replace("_", "-"))
repo_root = os.path.dirname(os.path.dirname(os.path.dirname(blend_path)))
out_path = os.path.join(repo_root, "public", "models", "props", glb_name + ".glb")
os.makedirs(os.path.dirname(out_path), exist_ok=True)

# Un oggetto rimasto in Edit Mode fa fallire l'export (mesh non aggiornata).
for o in bpy.data.objects:
    if o.type == "MESH" and o.mode != "OBJECT":
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.mode_set(mode="OBJECT")

meshes = [o for o in bpy.data.objects if o.type == "MESH"]
if not meshes:
    raise RuntimeError("Nessun mesh da esportare")

for o in bpy.data.objects:
    o.select_set(False)
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]

bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_apply=True,
)
print(f"Esportato {len(meshes)} mesh -> {out_path}")
