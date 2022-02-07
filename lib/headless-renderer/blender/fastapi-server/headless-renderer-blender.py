import bpy
from datetime import datetime

import sys
argv = sys.argv
argv = argv[argv.index("--") + 1:]  # get all args after "--"

def add_camera(scene, eye, center, fovy):
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=center)
    center_empty = bpy.context.active_object

    bpy.ops.object.camera_add(
        align='VIEW',
        enter_editmode=False,
        location=eye
    )
    camera_object = bpy.context.active_object

    camera_object.data.angle_y=fovy
    camera_object.data.lens_unit='FOV'
    camera_object.data.sensor_fit='VERTICAL'

    constraint = camera_object.constraints.new(type='TRACK_TO')
    constraint.target = center_empty

    scene.camera = camera_object
    return

sample_canvas_size = [2560, 379]

try:
    argv_width_index = argv.index('--datacubes-width') 
    argv_width = argv[argv_width_index + 1]
    sample_canvas_size[0] = int(argv_width)
except:
    pass

try:
    argv_height_index = argv.index('--datacubes-height') 
    argv_height = argv[argv_height_index + 1]
    sample_canvas_size[1] = int(argv_height)
except:
    pass

sample_scaling_factor = 1.0
sample_cycles_sample_count = 10
sample_cycles_use_denoising = False

sample_eye = (2.2737033367156982, 2.015049934387207, 3.845113515853882)
sample_center = (0, 0.5, 0)
sample_fovy = 45

# Map from WebGL to Blender co-ordinate system
sample_eye = (
    sample_eye[0],
    -sample_eye[2],
    sample_eye[1]
)

sample_center = (
    sample_center[0],
    -sample_center[2],
    sample_center[1]
)

for scene in bpy.data.scenes:
    scene.render.engine = 'CYCLES'

    scene.render.resolution_x = round(sample_canvas_size[0] * sample_scaling_factor)
    scene.render.resolution_y = round(sample_canvas_size[1] * sample_scaling_factor)
    scene.cycles.samples = sample_cycles_sample_count
    scene.cycles.use_denoising = sample_cycles_use_denoising

    add_camera(scene, sample_eye, sample_center, sample_fovy)

blender_file_name = ''
try:
    argv_blend_file_index = argv.index('--datacubes-blend-file-filename') 
    argv_blend_file_name = argv[argv_blend_file_index + 1]
    blender_file_name = f"{argv_blend_file_name}.blend"
except ValueError:
    now = datetime.now()
    date_time = now.strftime("%Y-%m-%d_%H-%M-%S")
    blender_file_name = f"{date_time}.blend"
bpy.ops.wm.save_as_mainfile(filepath=f"./{blender_file_name}")
