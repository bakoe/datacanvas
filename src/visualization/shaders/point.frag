precision lowp float;

#include ./lib/facade-frag;

#if __VERSION__ == 100
    #define fragColor gl_FragColor
#else
    layout(location = 0) out vec4 fragColor;
#endif

varying vec4 v_color;

varying vec4 v_index;
uniform bool u_renderIDToFragColor;

void main(void)
{
    vec2 uv = gl_PointCoord.xy * 2.0 - 1.0;

    float zz = dot(uv, uv);
    if(zz > 1.0)
        discard;

    if (u_renderIDToFragColor)
    {
        fragColor = v_index;
        return;
    }

    fragColor = v_color;
}
