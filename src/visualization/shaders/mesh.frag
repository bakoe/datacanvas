
precision lowp float;

#include ./lib/facade-frag;

#if __VERSION__ == 100
    #define fragColor gl_FragColor
#else
    layout(location = 0) out vec4 fragColor;
#endif

varying vec4 v_vertex;
varying vec2 v_uv;


void main(void)
{
    fragColor = vec4(0.96, 0.97, 0.98, 1.0);
}
