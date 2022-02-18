import os
from typing import Optional, List

from fastapi import FastAPI
from fastapi.responses import FileResponse

from starlette.background import BackgroundTask

from time import perf_counter
import logging

from pydantic import BaseModel

import json

import uuid

import subprocess
import threading

Vector = List[float]

class SceneRenderConfiguration(BaseModel):
    camera_eye: Vector
    camera_center: Vector
    camera_fov_y_degrees: float
    scene_elements: Optional[List[object]]
    width: Optional[int] = 300
    height: Optional[int] = 200

app = FastAPI()


@app.post("/renderings/")
async def create_rendering(config: SceneRenderConfiguration):
    random_uuid = str(uuid.uuid4())

    logging.basicConfig(filename=f"./blender-temp-data/{random_uuid}.log", level=logging.INFO)

    scene_elements_file = None
    if (config.scene_elements):
        scene_elements_file = f"./blender-temp-data/{random_uuid}_scene_elements.json"
        with open(scene_elements_file, 'w') as f:
            json.dump(config.scene_elements, f, indent=4, sort_keys=True)
    
    args = [
        os.environ.get('BLENDER_PATH', '') + "blender", 
        "--background",
        "--addons", "cycles",
        # "--python-use-system-env",
        "--python-exit-code", "1",
        "--log-level", "1",
        # "--debug-python",
        "blender_3.0.1_default-scene.blend",
        "-o", f"./blender-temp-data/{random_uuid}.png",
        "--python", "headless-renderer-blender.py",
        "-f", "1",
        "--",
        "--cycles-device", "CUDA",
        "--datacubes-blend-file-filename", f"./blender-temp-data/{random_uuid}",
        "--datacubes-width", f"{config.width}",
        "--datacubes-height", f"{config.height}",
        "--datacubes-camera-eye", f"{config.camera_eye}",
        "--datacubes-camera-center", f"{config.camera_center}",
        "--datacubes-camera-fov-y-degrees", f"{config.camera_fov_y_degrees}",
        "--datacubes-scene-elements-file" if scene_elements_file else "",
        scene_elements_file if scene_elements_file else "",
    ]

    env = os.environ.copy()
    blender_python_path = os.environ.get('BLENDER_PYTHON_PATH', '')
    if blender_python_path:
        env['PYTHONPATH'] = blender_python_path

    render_thread = threading.Thread(target=lambda: subprocess.check_output(args, env=env))

    logging.debug(f"Start blender with args: %s", args)

    t_render_thread_start = perf_counter()
    render_thread.start()
    render_thread.join()
    t_render_thread_end = perf_counter()

    logging.info(f"Creating and rendering scene in blender took {t_render_thread_end - t_render_thread_start:.2f}s overall")

    def cleanup():
        # os.remove(f"./blender-temp-data/{random_uuid}.blend")
        # os.remove(f"./blender-temp-data/{random_uuid}.png0001.png")
        # os.remove(f"./blender-temp-data/{random_uuid}_scene_elements.json")
        pass

    return FileResponse(
        f"./blender-temp-data/{random_uuid}.png0001.png",
        background=BackgroundTask(cleanup)
    )
