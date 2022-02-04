#!/bin/bash
DATETIME_FILE_PREFIX=$(date +"%Y-%m-%d_%H-%M-%S")

# Log console output to log file
# See https://serverfault.com/a/103569
exec 3>&1 4>&2
trap 'exec 2>&4 1>&3' 0 1 2 3
exec 1>$DATETIME_FILE_PREFIX.log 2>&1

blender\
    --background\
    blender_3.0.1_default-scene.blend\
    -o $DATETIME_FILE_PREFIX.png\
    --python headless-renderer-blender.py\
    -f 1\
    --\
    --cycles-device CUDA+CPU\
    --datacubes-blend-file-filename $DATETIME_FILE_PREFIX

# Remove the 0001.png prefix that Blender adds automatically
# See https://blender.stackexchange.com/questions/172704/properly-control-compositors-output-file-names-when-using-command-line-renderin#comment290409_172704
mv $DATETIME_FILE_PREFIX.png0001.png $DATETIME_FILE_PREFIX.png
