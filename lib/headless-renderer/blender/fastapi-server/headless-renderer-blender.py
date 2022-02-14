import sys
import os
import subprocess

from importlib import import_module

import bpy
from datetime import datetime

from time import perf_counter
import logging

import mathutils
import json
import math

def install_dependency(package_name): 
    # see: https://blender.stackexchange.com/a/219920
    # python_bin_dir = sys.exec_prefix
    # TODO: Works only on UNIX systems -- for Windows, python.exe should be used instead(?)
    python_bin = sys.executable

    logging.info(f"Installing missing package {package_name} to Python binary at {python_bin}")
    
    # upgrade pip
    subprocess.call([python_bin, "-m", "ensurepip"])
    subprocess.call([python_bin, "-m", "pip", "install", "--upgrade", "pip"])
    subprocess.call([python_bin, "-m", "pip", "install", "--upgrade", "setuptools"])

    # install required package
    if package_name:
        subprocess.call([python_bin, "-m", "pip", "install", package_name])

def vec3_transform_webgl_to_blender(vec3: mathutils.Vector):
    x = vec3[0]
    y = -vec3[2]
    z = vec3[1]
    return mathutils.Vector((x, y, z))

def add_camera(scene, eye, center, fovy_degrees):
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=center)
    center_empty = bpy.context.active_object

    bpy.ops.object.camera_add(
        align='VIEW',
        enter_editmode=False,
        location=eye
    )
    camera_object = bpy.context.active_object

    camera_object.data.angle_y=math.radians(fovy_degrees)
    camera_object.data.lens_unit='FOV'
    camera_object.data.sensor_fit='VERTICAL'

    constraint = camera_object.constraints.new(type='TRACK_TO')
    constraint.target = center_empty

    scene.camera = camera_object
    return


def add_scene_element(scene, scene_element):
    from colormath.color_objects import LabColor, sRGBColor
    from colormath.color_conversions import convert_color

    t_start = perf_counter()
    id = scene_element['id']
    color_lab = LabColor(scene_element['colorLAB'][0], scene_element['colorLAB'][1], scene_element['colorLAB'][2])
    color_lab.lab_l = color_lab.lab_l * 100.0
    color_lab.lab_a = color_lab.lab_a * 256.0 - 128.0
    color_lab.lab_b = color_lab.lab_b * 256.0 - 128.0
    color_srgb = convert_color(color_lab, sRGBColor)
    translate_x = scene_element['translateXZ']["0"]
    translate_y = scene_element['translateY']
    translate_z = scene_element['translateXZ']["1"]
    translate_webgl =  mathutils.Vector((translate_x, translate_y, translate_z))
    translate_blender = vec3_transform_webgl_to_blender(translate_webgl)

    scale_y_webgl = scene_element['scaleY']
    scale_z_blender = scale_y_webgl

    scale_blender = mathutils.Vector((1, 1, scale_z_blender))
    
    hide = scene_element["idBufferOnly"] == True
    if hide:
        points = scene_element["points"]
        logging.info(f"Adding {len(points)} points to scene element {id}")
        if (len(points) > 0):
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.001)
            obj = bpy.context.object

            mat = bpy.data.materials.new(f"Material_{id}")
            mat.use_nodes = True
            principled = mat.node_tree.nodes['Principled BSDF']
            # TODO: The color is set for all points equally; use their individual r, g, and b attributes instead! 
            principled.inputs['Base Color'].default_value = (color_srgb.clamped_rgb_r, color_srgb.clamped_rgb_g, color_srgb.clamped_rgb_b, 1)
            obj.data.materials.append(mat)

            # Remove object from all collections not used in a scene
            bpy.ops.collection.objects_remove_all()
            # add it to our specific collection
            bpy.data.collections['Foreground'].objects.link(obj)

            # Operation-free object duplication (much more efficient than using Blender ops)
            # see: https://blender.stackexchange.com/a/7360
            objects = []
            
            for point in points:
                x = point["x"]
                y = point["y"]
                z = point["z"]
                size = point["size"]
                point_location_webgl = mathutils.Vector((x, y, z))
                point_location_blender = vec3_transform_webgl_to_blender(point_location_webgl)
                
                copy = obj.copy()
                copy.location = (point_location_blender * scale_blender + translate_blender)
                if size:
                    copy.scale = mathutils.Vector((size, size, size))
                # Create linked duplicates instead of duplicated meshes
                # copy.data = copy.data.copy() # also duplicate mesh, remove for linked duplicate
                objects.append(copy)
            
            for object in objects:
                # Blender < 2.8
                # scene.objects.link(object)
                bpy.context.collection.objects.link(object)
            
            # Blender < 2.8
            # scene.update()
            dependency_graph = bpy.context.evaluated_depsgraph_get()
            dependency_graph.update()

        t_end = perf_counter()
        logging.info(f"Adding scene element {id} took {t_end - t_start:.2f}s")
        return
    
    scale_blender = mathutils.Vector((1, 1, scale_z_blender * 2.0))
    bpy.ops.mesh.primitive_cube_add(size=0.5, location=(translate_blender), scale=(scale_blender))
    obj = bpy.context.object
    obj.name = f"Cuboid_{id}"

    mat = bpy.data.materials.new(f"Material_{id}")
    mat.use_nodes = True
    principled = mat.node_tree.nodes['Principled BSDF']
    principled.inputs['Base Color'].default_value = (color_srgb.clamped_rgb_r, color_srgb.clamped_rgb_g, color_srgb.clamped_rgb_b, 1)
    obj.data.materials.append(mat)

    # Remove object from all collections not used in a scene
    bpy.ops.collection.objects_remove_all()
    # add it to our specific collection
    bpy.data.collections['Foreground'].objects.link(obj)

    t_end = perf_counter()
    logging.info(f"Adding scene element {id} took {t_end - t_start:.2f}s")


def main():
    t_start = perf_counter()

    argv = sys.argv
    argv = argv[argv.index("--") + 1:]  # get all args after "--"

    file_uuid = ''
    try:
        argv_blend_file_index = argv.index('--datacubes-blend-file-filename') 
        argv_blend_file_name = argv[argv_blend_file_index + 1]
        file_uuid = f"{argv_blend_file_name}"
    except ValueError:
        now = datetime.now()
        date_time = now.strftime("%Y-%m-%d_%H-%M-%S")
        file_uuid = f"{date_time}"
    
    logging.basicConfig(filename=f"{file_uuid}.log", encoding='utf-8', level=logging.INFO)

    # Assume colormath is installed
    # see: https://stackoverflow.com/a/60029513
    # for package in ['colormath']:
    #     try:
    #         lib = import_module(package)
    #     except:
    #         logging.info(f"Did not find lib {package} -- installing it now")
    #         install_dependency(package)
    #     else:
    #         logging.info(f"Successfully found lib {package}")

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

    sample_eye =  mathutils.Vector((2.2737033367156982, 2.015049934387207, 3.845113515853882))
    sample_center = [0, 0.5, 0]
    sample_fovy = 45

    try:
        argv_camera_eye_index = argv.index('--datacubes-camera-eye') 
        argv_camera_eye = argv[argv_camera_eye_index + 1]
        sample_eye =  mathutils.Vector(json.loads(argv_camera_eye))
    except:
        pass

    try:
        argv_camera_center_index = argv.index('--datacubes-camera-center') 
        argv_camera_center = argv[argv_camera_center_index + 1]
        sample_center =  mathutils.Vector(json.loads(argv_camera_center))
    except:
        pass

    try:
        argv_fov_y_degrees_index = argv.index('--datacubes-fov-y-degrees') 
        argv_fov_y_degrees = argv[argv_fov_y_degrees_index + 1]
        sample_fovy = float(argv_fov_y_degrees)
    except:
        pass


    scene_elements = None

    try:
        argv_scene_elements_file_index = argv.index('--datacubes-scene-elements-file') 
        argv_scene_elements_file = argv[argv_scene_elements_file_index + 1]
        with open(argv_scene_elements_file, 'r') as scene_elements_file:
            scene_elements = json.load(scene_elements_file)
    except:
        pass

    sample_scaling_factor = 1.0
    sample_cycles_sample_count = 2
    sample_cycles_use_denoising = False

    # Map from WebGL to Blender co-ordinate system
    sample_eye = vec3_transform_webgl_to_blender(sample_eye)
    sample_center = vec3_transform_webgl_to_blender(sample_center)
    
    t_scene_creation_start = perf_counter()

    logging.info(f"Setting scene content of {len(bpy.data.scenes)} scenes")

    for scene_index, scene in enumerate(bpy.data.scenes):
        scene.render.engine = 'CYCLES'
        scene.cycles.device = 'GPU'

        logging.info(f"Enable CYCLES and GPU")

        cpref = bpy.context.preferences.addons['cycles'].preferences
        cpref.compute_device_type = 'CUDA'

        logging.info(f"Enable CUDA")

        # Use GPU devices only
        cpref.get_devices()
        for device in cpref.devices:
            device.use = True if device.type == 'CUDA' else False

        scene.render.resolution_x = round(sample_canvas_size[0] * sample_scaling_factor)
        scene.render.resolution_y = round(sample_canvas_size[1] * sample_scaling_factor)
        scene.cycles.samples = sample_cycles_sample_count
        scene.cycles.use_denoising = sample_cycles_use_denoising

        add_camera(scene, sample_eye, sample_center, sample_fovy)

        if scene_elements:
            logging.info(f"Adding {len(scene_elements)} scene elements to scene {scene_index}")
            for scene_element in scene_elements:
                add_scene_element(scene, scene_element)
    
    t_scene_creation_end = perf_counter()
    logging.info(f"Python-side scene creation took {t_scene_creation_end - t_scene_creation_start:.2f}s")
    
    blend_file_name = os.path.join(os.getcwd(), f"{file_uuid}.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_file_name)

    t_end = perf_counter()
    logging.info(f"Python script inside Blender took {t_end - t_start:.2f}s overall")


if __name__ == "__main__":
    main()

