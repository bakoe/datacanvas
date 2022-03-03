precision highp float;

#include ./lib/facade-frag;

#if __VERSION__ == 100
    #define fragColor gl_FragColor
#else
    layout(location = 0) out vec4 fragColor;
#endif

uniform sampler2D baseColor;

varying vec2 v_uv;
varying vec3 v_position;


void main(void)
{
    vec4 diffuse = texture(baseColor, v_uv);
    fragColor = diffuse;
}
