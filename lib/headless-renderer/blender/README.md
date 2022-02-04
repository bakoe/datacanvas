# **haeley-datacubes** › [Headless Renderers](../) › Blender Headless Renderer

## Setup Instructions

- Install [Blender](https://blender.org) v3.0.0+ on the system and add the `blender` CLI executable to the system’s PATH.


## Usage

Inside this directory, run:

```bash
source ./headless-renderer-blender.sh
```
(You can replace `source` with, e.g., `sh`).

Then, the following output files should be created inside this directory:

```bash
2022-02-04_17-00-29.blend # A blend file with the imported (and rendered) scene
2022-02-04_17-00-29.log # A log file indicating the output of running the headless Blender instance
2022-02-04_17-00-29.png # The output image
```
