precision lowp float;

layout(location = 0) out vec4 fragColor;

uniform vec4 u_clearColor;
uniform vec4 u_diffuse;

in vec4 v_vertex;
// in vec2 v_uv;

float grid(const in vec3 position, const in float scale) {

    vec3 v_pos = fract(+position * scale);
    vec3 grid0 = smoothstep(vec3(0.0), 2.0 * fwidth(v_pos), v_pos);

    vec3 v_neg = fract(-position * scale);
    vec3 grid1 = smoothstep(vec3(0.0), 2.0 * fwidth(v_neg), v_neg);

    vec3 intensity = vec3(1.0) - grid0 * grid1;

    return max(intensity.x, intensity.y) *
        max(intensity.y, intensity.z) *
        max(intensity.z, intensity.x);
}

void main(void)
{
    vec3 g = vec3(
        grid(v_vertex.xyz,  2.0) * 1.00,
        grid(v_vertex.xyz,  4.0) * 0.50,
        grid(v_vertex.xyz, 16.0) * 0.25);

    vec2 uv = v_vertex.xz * 0.125;
    float d = 1.0 - sqrt(dot(uv, uv));

    float alpha = d * max(g[0], max(g[1], g[2]));

    vec4 color = mix(u_clearColor, u_diffuse, alpha);
    fragColor = vec4(color.rgb, color.a * alpha);
}
