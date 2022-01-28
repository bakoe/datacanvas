
precision lowp float;

#include ./lib/facade-frag;

#if __VERSION__ == 100
    #define fragColor gl_FragColor
#else
    layout(location = 0) out vec4 fragColor;
#endif

varying vec4 v_vertex;
varying vec2 v_uv;

uniform vec4 u_encodedID;
uniform bool u_renderIDToFragColor;

uniform vec3 u_color;

void main(void)
{
    if (u_renderIDToFragColor)
    {
        fragColor = u_encodedID;
        return;
    }
    fragColor = vec4(u_color, 1.0);

    if (v_uv.y <= 0.01 || v_uv.y >= 0.99 || v_uv.x < 0.01 || v_uv.x >= 0.99) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    }
}
