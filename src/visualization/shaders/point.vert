precision lowp float;

#include ./lib/facade-vert;

#if __VERSION__ == 100
    attribute vec3 a_vertex;
    attribute vec3 a_color;
    attribute float a_data;
    attribute vec4 a_index;
#else
    layout(location = 0) in vec3 a_vertex;
    layout(location = 1) in vec3 a_color;
    layout(location = 2) in float a_data;
    layout(location = 3) in vec4 a_index;
#endif

uniform mat4 u_viewProjection;
uniform mat4 u_model;

uniform vec2 u_ndcOffset;

varying vec4 v_color;
varying vec4 v_index;
uniform bool u_renderIDToFragColor;

void main()
{
    v_color = vec4(a_color, 1.0);

    vec4 vertex = u_model * vec4(a_vertex, 1.0);
    vertex = u_viewProjection * vertex;
    vertex.xy = u_ndcOffset * vec2(vertex.w) + vertex.xy;

    v_index = a_index;

    gl_Position = vertex;
    if (u_renderIDToFragColor)
    {
        gl_PointSize = 10.0 * a_data;
    }
    else
    {
        gl_PointSize = a_data;
    }
}
