precision lowp float;

#include ./lib/facade-vert;
// #include ./lib/ndcoffset;

#if __VERSION__ == 100
    attribute vec3 a_vertex;
    attribute vec3 a_color;
#else
    layout(location = 0) in vec3 a_vertex;
    layout(location = 1) in vec3 a_color;
#endif

uniform mat4 u_viewProjection;
uniform vec2 u_ndcOffset;

varying vec4 v_color;

uniform mat4 u_modelGlobal;

void main()
{
    v_color = vec4(a_color, 1.0);

    vec4 vertex = u_viewProjection * u_modelGlobal * vec4(a_vertex, 1.0);
    // ndcOffset(vertex, u_ndcOffset);
    vertex.xy = u_ndcOffset * vec2(vertex.w) + vertex.xy;

    gl_Position = vertex;
}
