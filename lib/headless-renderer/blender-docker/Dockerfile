FROM ubuntu:20.04 AS build-from-source

ARG OPTIX_SOURCES="./NVIDIA-OptiX-SDK-7.4.0-linux64-x86_64"

ADD ${OPTIX_SOURCES} /opt/optix-sdk

RUN apt update && DEBIAN_FRONTEND=noninteractive apt install -y cmake git

WORKDIR /opt/
RUN git clone https://git.blender.org/blender.git
WORKDIR /opt/blender
RUN git checkout blender-v3.1-release

RUN DEBIAN_FRONTEND=noninteractive apt install -y sudo
RUN DEBIAN_FRONTEND=noninteractive ./build_files/build_environment/install_deps.sh --with-all --skip-opencollada --source /opt/dependencies/src --install /opt/dependencies/install
WORKDIR /opt/blender/build_files
RUN DEBIAN_FRONTEND=noninteractive apt install -y nvidia-driver-510 nvidia-cuda-toolkit
RUN cmake .. \
  -D WITH_CODEC_SNDFILE=ON \
  -D PYTHON_VERSION=3.10 \
  -D PYTHON_ROOT_DIR=/opt/dependencies/install/python-3.10 \
  -D BOOST_ROOT=/opt/dependencies/install/boost \
  -D Boost_NO_SYSTEM_PATHS=ON \
  -D Boost_NO_BOOST_CMAKE=ON \
  -D WITH_OPENCOLORIO=ON \
  -D OPENCOLORIO_ROOT_DIR=/opt/dependencies/install/ocio \
  -D OPENEXR_ROOT_DIR=/opt/dependencies/install/openexr \
  -D WITH_OPENIMAGEIO=ON \
  -D OPENIMAGEIO_ROOT_DIR=/opt/dependencies/install/oiio \
  -D WITH_CYCLES_OSL=ON \
  -D WITH_LLVM=ON \
  -D LLVM_VERSION=12.0.0 \
  -D OSL_ROOT_DIR=/opt/dependencies/install/osl \
  -D LLVM_ROOT_DIR=/opt/dependencies/install/llvm \
  -D LLVM_STATIC=ON \
  -D WITH_OPENSUBDIV=ON \
  -D OPENSUBDIV_ROOT_DIR=/opt/dependencies/install/osd \
  -D WITH_OPENVDB=ON \
  -D WITH_OPENVDB_BLOSC=ON \
  -D OPENVDB_ROOT_DIR=/opt/dependencies/install/openvdb \
  -D BLOSC_ROOT_DIR=/opt/dependencies/install/blosc \
  -D WITH_NANOVDB=ON \
  -D NANOVDB_ROOT_DIR=/opt/dependencies/install/nanovdb \
  -D WITH_CYCLES_EMBREE=ON \
  -D EMBREE_ROOT_DIR=/opt/dependencies/install/embree \
  -D WITH_OPENIMAGEDENOISE=ON \
  -D OPENIMAGEDENOISE_ROOT_DIR=/opt/dependencies/install/oidn \
  -D WITH_JACK=ON \
  -D WITH_JACK_DYNLOAD=ON \
  -D WITH_PULSEAUDIO=ON \
  -D WITH_PULSEAUDIO_DYNLOAD=ON \
  -D WITH_ALEMBIC=ON \
  -D ALEMBIC_ROOT_DIR=/opt/dependencies/install/alembic \
  -D WITH_USD=ON \
  -D USD_ROOT_DIR=/opt/dependencies/install/usd \
  -D WITH_CODEC_FFMPEG=ON \
  -D WITH_XR_OPENXR=ON \
  -D XR_OPENXR_SDK_ROOT_DIR=/opt/dependencies/install/xr-openxr-sdk \
  -D WITH_CYCLES_CUDA_BINARIES=On \
  -D WITH_CYCLES=On \
  -D WITH_CYCLES_DEVICE_OPTIX=On \
  -D OPTIX_INCLUDE_DIR="/opt/optix-sdk/include"
RUN /opt/dependencies/install/python-3.10/bin/pip install Cython colormath
RUN make -j 12
WORKDIR /opt/blender
RUN git submodule init && git submodule update
WORKDIR /opt/blender/build_files
RUN make -j 12
RUN make install
RUN /opt/blender/build_files/bin/3.1/python/bin/python3.10 -m ensurepip
RUN /opt/blender/build_files/bin/3.1/python/bin/pip3 install Cython colormath

ENV BLENDER_PATH=/opt/blender/build_files/bin/

# FROM ubuntu:20.04 AS deploy

# WORKDIR /opt/blender/
# COPY --from=build-from-source /opt/blender/build_files/bin/ /opt/blender/
CMD [ "/usr/bin/bash"]
