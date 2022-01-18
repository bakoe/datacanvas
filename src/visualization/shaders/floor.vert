precision lowp float;

layout(location = 0) in vec3 a_vertex;

uniform mat4 u_viewProjection;
uniform mat4 u_model;

out vec4 v_vertex;
// out vec2 v_uv;

void main()
{
    v_vertex = u_model * vec4(a_vertex, 1.0);
    // v_uv = a_texCoord;

    gl_Position = u_viewProjection *  v_vertex;
}
