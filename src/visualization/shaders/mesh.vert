
precision highp float;

#include ./lib/facade-vert;
#include ./lib/ndcoffset;


#if __VERSION__ == 100
    attribute vec3 a_vertex;
    attribute vec2 a_texCoord;
#else
    layout(location = 0) in vec3 a_vertex;
    layout(location = 1) in vec2 a_texCoord;
#endif


uniform mat4 u_viewProjection;
uniform mat4 u_model;

uniform vec2 u_ndcOffset;


varying vec4 v_vertex;
varying vec2 v_uv;


void main()
{
    v_vertex = u_model * vec4(a_vertex, 1.0);
    v_uv = a_texCoord;

    vec4 vertex = u_viewProjection *  v_vertex;
    ndcOffset(vertex, u_ndcOffset);

    gl_Position = vertex;
}
