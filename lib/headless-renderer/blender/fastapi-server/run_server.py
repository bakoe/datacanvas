import os
from typing import Optional

from fastapi import FastAPI
from fastapi.responses import FileResponse

from starlette.background import BackgroundTask

from pydantic import BaseModel

import uuid

import subprocess
import threading

class SceneRenderConfiguration(BaseModel):
    width: Optional[int] = 300
    height: Optional[int] = 200

app = FastAPI()


@app.post("/renderings/")
async def create_rendering(config: SceneRenderConfiguration):
    random_uuid = str(uuid.uuid4())

    render_thread = threading.Thread(target=lambda: subprocess.check_output([
        "/Applications/Blender.app/Contents/MacOS/Blender", 
        "--background",
        "blender_3.0.1_default-scene.blend",
        "-o", f"{random_uuid}.png",
        "--python", "headless-renderer-blender.py",
        "-f", "1",
        "--",
        "--cycles-device", "CUDA+CPU",
        "--datacubes-blend-file-filename", random_uuid,
        "--datacubes-width", f"{config.width}",
        "--datacubes-height", f"{config.height}",
    ]))
    render_thread.start()

    render_thread.join()

    def cleanup():
        os.remove(f"{random_uuid}.blend")
        os.remove(f"{random_uuid}.png0001.png")
        pass

    return FileResponse(
        f"{random_uuid}.png0001.png",
        background=BackgroundTask(cleanup)
    )
