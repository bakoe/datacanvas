# **datacanvas** › [Headless Renderers](../../) › [Blender Headless Renderer](../) › blender-docker

This directory contains the Dockerfile for creating a OptiX-enabled Docker image of Blender 3.1 with the necessary Python/pip modules required for the headless Blender renderer of [datacanvas](https://datacanvas.dev).

## Prerequisites

To build the Docker image, you have to be on a host system with a CUDA-capable GPU.

## Setup Instructions

0. Make sure to have Docker installed
1. Download [NVIDIA OptiX](https://developer.nvidia.com/designworks/optix/download) for Linux, paying attention the the relevant license agreement.
2. Run the `build.sh` script, i.e., build the Docker image for an OptiX-enabled version of Blender 3.1 with the required Python/pip modules.
