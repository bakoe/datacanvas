# **datacanvas** › [Headless Renderers](../) › Blender Headless Renderer

This directory contains the source code of a headless, server-side, GPU-enabled renderer for [datacanvas](https://datacanvas.dev) using [Blender](https://blender.org).
## Structure

This directory is structured as follows:

| Directory                                                                 | Description                                                                                                                                           |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`/`](/lib/headless-renderer/blender)                               | Files for Docker-based, GPU-enabled provisioning of the Blender headless renderer for datacanvas                                                      |
| [`fastapi-server`](/lib/headless-renderer/blender/fastapi-server) | Source code of a Python/FastAPI-based service for headless rendering of datacanvas scenes/visualizations using Blender                                |
| [`blender-docker`](/lib/headless-renderer/blender-docker)                 | Dockerfile for creating a OptiX-enabled Docker image of Blender 3.1 with the necessary Python/pip modules required for the headless Blender renderer  |

For instructions about the individual components and their setup, view the respective README files of the directories.

---

# **datacanvas** › [Headless Renderers](../) › Blender Headless Renderer › Docker-based provisioning

## Setup instructions

0. Make sure to have Docker installed on your system.
1. If no Docker image for a Blender 3.1 instance has been created yet, you can create one using the Dockerfile contained in [`blender-docker/`](/lib/headless-renderer/blender-docker).
2. Run the `build.sh` script, i.e., build the Docker image containing the [`fastapi-server/`](/lib/headless-renderer/blender/fastapi-server) source code 

You can then run an instance of the Docker image using, e.g., `docker-compose up` utilizing the `docker-compose.yml` file.
