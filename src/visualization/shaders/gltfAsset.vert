precision highp float;

// Adapted from https://github.com/KhronosGroup/glTF-WebGL-PBR

#include ./lib/facade-vert;


#if __VERSION__ == 100
    attribute vec3 a_position;
    attribute vec2 a_uv;
#else
    layout (location = 0) in vec3 a_position;
    layout (location = 1) in vec2 a_uv;
#endif

varying vec2 v_uv;
varying vec3 v_position;

uniform mat4 u_viewProjection;

uniform vec2 u_ndcOffset;

void main(void)
{
    v_uv = a_uv;

    vec3 offset = vec3(float(gl_InstanceID % 32 - 16), float((gl_InstanceID / 32) % 32 - 16), float(gl_InstanceID / 1024 - 16));
    vec3 position = a_position.xyz;
    v_position = position * 0.6 + 0.5;
    gl_Position = u_viewProjection * vec4(position * 0.1 + offset * 0.25, 1.0);
    gl_Position.xy = u_ndcOffset * vec2(gl_Position.w) + gl_Position.xy;
}
