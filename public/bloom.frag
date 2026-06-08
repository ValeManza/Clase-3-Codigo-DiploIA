#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D uScene;
uniform vec2 uResolution;
uniform float uGlowIntensity;
uniform float uGlowRadius;

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec2 texel = 1.0 / uResolution;

    // Original scene color
    vec3 color = texture2D(uScene, uv).rgb;

    // Brightness threshold — extract bloom source
    float luma = dot(color, vec3(0.299, 0.587, 0.114));
    float threshold = 0.25;
    vec3 bloomSrc = max(vec3(0.0), color - threshold) / (1.0 - threshold);

    // Gaussian blur of the bloom source using 5x5 kernel
    float r = uGlowRadius * 2.5;
    vec3 blurAccum = vec3(0.0);
    float totalW = 0.0;

    for (int x = -2; x <= 2; x++) {
        for (int y = -2; y <= 2; y++) {
            vec2 off = vec2(float(x), float(y)) * texel * r;
            float w = exp(-float(x * x + y * y) * 0.5);

            vec3 s = texture2D(uScene, uv + off).rgb;
            vec3 sBloom = max(vec3(0.0), s - threshold) / (1.0 - threshold);

            blurAccum += sBloom * w;
            totalW += w;
        }
    }

    vec3 bloom = blurAccum / max(totalW, 0.001);

    // Combine original + bloom
    vec3 final = color + bloom * uGlowIntensity;

    // Reinhard tone mapping (HDR → LDR)
    final = final / (1.0 + final);

    gl_FragColor = vec4(final, 1.0);
}
