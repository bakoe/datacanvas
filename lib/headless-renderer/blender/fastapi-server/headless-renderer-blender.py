import sys
import os
import subprocess

import bpy
import bmesh
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
    # Deselect all scene elements
    for obj in bpy.context.selected_objects:
        obj.select_set(False)

    t_start = perf_counter()
    id = scene_element['id']
    color_rgb = scene_element['colorRGB']
    translate_x = scene_element['translateXZ']["0"]
    translate_y = scene_element['translateY']
    translate_z = scene_element['translateXZ']["1"]
    translate_webgl =  mathutils.Vector((translate_x, translate_y, translate_z))
    translate_blender = vec3_transform_webgl_to_blender(translate_webgl)

    scale_y_webgl = scene_element['scaleY']
    scale_z_blender = scale_y_webgl
    scale_blender = mathutils.Vector((1, 1, scale_z_blender))

    extent_webgl = scene_element['extent']
    if extent_webgl:
        CUBOID_SIZE_X = 0.5;
        CUBOID_SIZE_Z = 0.5;
        extent_scale_webgl = mathutils.Vector(((extent_webgl["maxX"] - extent_webgl["minX"]) / CUBOID_SIZE_X, 1.0, (extent_webgl["maxZ"] - extent_webgl["minZ"]) / CUBOID_SIZE_Z))
        extent_scale_blender = vec3_transform_webgl_to_blender(extent_scale_webgl)

        extent_compensation_translate_webgl = mathutils.Vector((
            translate_x + (extent_webgl["maxX"] + extent_webgl["minX"]) / 2, 
            translate_y, 
            translate_z + (extent_webgl["maxZ"] + extent_webgl["minZ"]) / 2)
        )
        extent_compensation_translate_blender = vec3_transform_webgl_to_blender(extent_compensation_translate_webgl)
    
    hide = scene_element["idBufferOnly"] == True
    if hide:
        points = scene_element["points"]
        logging.info(f"Adding {len(points)} points to scene element {id}")
        if (len(points) > 0):
            # bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.001)
            # obj = bpy.context.object

            # see: https://blender.stackexchange.com/a/159185
            mesh = bpy.data.meshes.new(f"scene_element_{id}")  # add the new mesh
            obj = bpy.data.objects.new(mesh.name, mesh)
            # col = bpy.data.collections.get("Foreground")
            # col.objects.link(obj)
            # bpy.context.view_layer.objects.active = obj

            mat = bpy.data.materials.new(f"Material_{id}")
            mat.use_nodes = True
            
            attrib_node_color_r: bpy.types.ShaderNodeAttribute = mat.node_tree.nodes.new(type='ShaderNodeAttribute')
            attrib_node_color_r.attribute_type = 'GEOMETRY'
            attrib_node_color_r.attribute_name = 'color-r'
            attrib_node_color_g: bpy.types.ShaderNodeAttribute = mat.node_tree.nodes.new(type='ShaderNodeAttribute')
            attrib_node_color_g.attribute_type = 'GEOMETRY'
            attrib_node_color_g.attribute_name = 'color-g'
            attrib_node_color_b: bpy.types.ShaderNodeAttribute = mat.node_tree.nodes.new(type='ShaderNodeAttribute')
            attrib_node_color_b.attribute_type = 'GEOMETRY'
            attrib_node_color_b.attribute_name = 'color-b'

            combine_rgb_node: bpy.types.ShaderNodeCombineRGB = mat.node_tree.nodes.new(type='ShaderNodeCombineRGB')

            principled_bsdf_node = mat.node_tree.nodes['Principled BSDF']

            mat.node_tree.links.new(attrib_node_color_r.outputs['Fac'], combine_rgb_node.inputs['R'])
            mat.node_tree.links.new(attrib_node_color_g.outputs['Fac'], combine_rgb_node.inputs['G'])
            mat.node_tree.links.new(attrib_node_color_b.outputs['Fac'], combine_rgb_node.inputs['B'])

            mat.node_tree.links.new(combine_rgb_node.outputs['Image'], principled_bsdf_node.inputs['Base Color'])
            
            # TODO: Auto-arrange nodes based on Blender's Node Arrange plug-in
            # TODO: see https://docs.blender.org/manual/en/latest/addons/node/node_arrange.html

            obj.data.materials.append(mat)

            # Remove object from all collections not used in a scene
            bpy.ops.collection.objects_remove_all()
            # add it to our specific collection
            bpy.data.collections['Foreground'].objects.link(obj)

            # Operation-free object duplication (much more efficient than using Blender ops)
            # see: https://blender.stackexchange.com/a/7360
            # objects = []

            verts = []
            edges = []
            faces = []

            valid_points = [point for point in points if point["x"] and point["y"] and point["z"]]
            
            for point_index, point in enumerate(valid_points):
                x = point["x"]
                y = point["y"]
                z = point["z"]

                point_location_webgl = mathutils.Vector((x, y, z))
                point_location_blender = vec3_transform_webgl_to_blender(point_location_webgl)

                verts.append((point_location_blender))
                
                # copy = obj.copy()
                # copy.location = (point_location_blender * scale_blender + translate_blender)
                # if size:
                #     copy.scale = mathutils.Vector((size, size, size))
                # # Create linked duplicates instead of duplicated meshes
                # # copy.data = copy.data.copy() # also duplicate mesh, remove for linked duplicate
                # objects.append(copy)
            
            # for object in objects:
            #     # Blender < 2.8
            #     # scene.objects.link(object)
            #     bpy.context.collection.objects.link(object)
            
            mesh.from_pydata(verts, edges, faces)

            # Add and fill custom attribute(s)

            bm = bmesh.new()
            bm.from_mesh(obj.data)

            bm.verts.ensure_lookup_table()

            # Create custom data layers
            size_attribute = bm.verts.layers.float.new('size')

            color_r_attribute = bm.verts.layers.float.new('color-r')
            color_g_attribute = bm.verts.layers.float.new('color-g')
            color_b_attribute = bm.verts.layers.float.new('color-b')

            # Get the custom data layer by its name
            size_attribute = bm.verts.layers.float['size']
            color_r_attribute = bm.verts.layers.float['color-r']
            color_g_attribute = bm.verts.layers.float['color-g']
            color_b_attribute = bm.verts.layers.float['color-b']

            for point_index, point in enumerate(valid_points):
                size = point["size"]
                r = point["r"]
                g = point["g"]
                b = point["b"]
                # Convert to Gamma-corrected sRGB
                r = pow(r, 2.2)
                g = pow(g, 2.2)
                b = pow(b, 2.2)
                bm.verts[point_index][size_attribute] = size
                bm.verts[point_index][color_r_attribute] = r
                bm.verts[point_index][color_g_attribute] = g
                bm.verts[point_index][color_b_attribute] = b

            bm.to_mesh(obj.data)

            dependency_graph = bpy.context.evaluated_depsgraph_get()
            dependency_graph.update()
            
            add_point_rendering_geometry_nodes(obj, mat)

            if (extent_scale_blender != None and extent_compensation_translate_blender != None):
                extent_transform = mathutils.Matrix.LocRotScale(None, None, extent_scale_blender)
                translate_blender = extent_compensation_translate_blender
                obj.data.transform(extent_transform)

            obj.scale = mathutils.Vector((1, -1, scale_z_blender))
            obj.location = translate_blender

        t_end = perf_counter()
        logging.info(f"Adding scene element {id} took {t_end - t_start:.2f}s")
        return
    
    scale_blender = mathutils.Vector((1, 1, scale_z_blender * 2.0))
    bpy.ops.mesh.primitive_cube_add(size=0.5, scale=(scale_blender))
    obj = bpy.context.object

    if (extent_scale_blender != None and extent_compensation_translate_blender != None):
        extent_transform = mathutils.Matrix.LocRotScale(None, None, extent_scale_blender)
        translate_blender = extent_compensation_translate_blender
        obj.data.transform(extent_transform)
    
    obj.location = translate_blender

    obj.name = f"Cuboid_{id}"

    mat = bpy.data.materials.new(f"Material_{id}")
    mat.use_nodes = True
    principled_bsdf_node = mat.node_tree.nodes['Principled BSDF']
    if color_rgb:
        # Convert to Gamma-corrected sRGB
        color_rgb = [
            pow(color_rgb[0], 2.2),
            pow(color_rgb[1], 2.2),
            pow(color_rgb[2], 2.2)
        ]
        principled_bsdf_node.inputs['Base Color'].default_value = (color_rgb[0], color_rgb[1], color_rgb[2], 1)

    obj.data.materials.append(mat)

    # Remove object from all collections not used in a scene
    bpy.ops.collection.objects_remove_all()
    # add it to our specific collection
    bpy.data.collections['Foreground'].objects.link(obj)

    t_end = perf_counter()
    logging.info(f"Adding scene element {id} took {t_end - t_start:.2f}s")


def add_point_rendering_geometry_nodes(object: bpy.types.Object, material: bpy.types.Material, size_attr_name = 'size'):
    # Setup a geometry node tree for spheres instanced at vertex positions
    modifier: bpy.types.NodesModifier = object.modifiers.new('Geometry Nodes Modifier', type='NODES')
    geometry_node_tree: bpy.types.GeometryNodeTree = modifier.node_group
    geometry_node_tree.name = "Geometry Nodes"

    # Clean up existing node set-up
    for node in geometry_node_tree.nodes:
        geometry_node_tree.nodes.remove(node)
    
    # Available types: https://docs.blender.org/api/3.1/bpy.types.html
    input_node: bpy.types.NodeGroupInput = geometry_node_tree.nodes.new(type='NodeGroupInput')
    
    ico_sphere_node: bpy.types.GeometryNodeMeshIcoSphere = geometry_node_tree.nodes.new(type='GeometryNodeMeshIcoSphere')
    ico_sphere_node.inputs['Radius'].default_value = 0.002
    ico_sphere_node.inputs['Subdivisions'].default_value = 1
    
    instance_on_points_node: bpy.types.GeometryNodeInstanceOnPoints = geometry_node_tree.nodes.new(type='GeometryNodeInstanceOnPoints')

    realize_instances_node: bpy.types.GeometryNodeRealizeInstances = geometry_node_tree.nodes.new(type='GeometryNodeRealizeInstances')

    set_material_node: bpy.types.GeometryNodeSetMaterial = geometry_node_tree.nodes.new(type='GeometryNodeSetMaterial')
    set_material_node.inputs['Material'].default_value = material
    
    output_node: bpy.types.NodeGroupOutput = geometry_node_tree.nodes.new(type='NodeGroupOutput')

    geometry_node_tree.links.new(ico_sphere_node.outputs['Mesh'], instance_on_points_node.inputs['Instance'])
    geometry_node_tree.links.new(input_node.outputs['Geometry'], instance_on_points_node.inputs['Points'])
    geometry_node_tree.links.new(instance_on_points_node.outputs['Instances'], realize_instances_node.inputs['Geometry'])
    geometry_node_tree.links.new(realize_instances_node.outputs['Geometry'], set_material_node.inputs['Geometry'])
    geometry_node_tree.links.new(set_material_node.outputs['Geometry'], output_node.inputs['Geometry'])

    # https://docs.blender.org/api/3.1/bpy.types.NodeSocket.html#bpy.types.NodeSocket.type
    input_node.outputs.new("VECTOR", "Scale", identifier="Scale")
    geometry_node_tree.links.new(input_node.outputs["Scale"], instance_on_points_node.inputs['Scale'])
    modifier["Input_2_use_attribute"] = 1
    modifier["Input_2_attribute_name"] = size_attr_name

    # TODO: Auto-arrange nodes based on Blender's Node Arrange plug-in
    # TODO: see https://docs.blender.org/manual/en/latest/addons/node/node_arrange.html
    
    return modifier


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

