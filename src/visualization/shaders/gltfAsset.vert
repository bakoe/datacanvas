precision highp float;

// Adapted from https://github.com/KhronosGroup/glTF-WebGL-PBR

#include ./lib/facade-vert;


#if __VERSION__ == 100
    attribute vec3 a_position;
    attribute vec2 a_uv;
    attribute mat4 a_model;
#else
    layout (location = 0) in vec3 a_position;
    layout (location = 1) in vec2 a_uv;
    layout (location = 2) in mat4 a_model;
#endif

varying vec2 v_uv;
varying vec3 v_position;

uniform mat4 u_viewProjection;

uniform vec2 u_ndcOffset;

void main(void)
{
    v_uv = a_uv;

    vec3 position = a_position.xyz;
    position.xyz = vec4(a_model * vec4(position, 1.0)).xyz;
    v_position = position.xyz;
    gl_Position = u_viewProjection * vec4(v_position, 1.0);
    gl_Position.xy = u_ndcOffset * vec2(gl_Position.w) + gl_Position.xy;
}
