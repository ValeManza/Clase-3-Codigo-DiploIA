#ifdef GL_ES
precision highp float;
#endif

uniform vec2  uResolution;
uniform float uTime;
uniform float uFrequency;
uniform float uAmplitude;
uniform float uSpeed;
uniform float uSigma;
uniform float uOrientation;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform vec3  uColor3;
uniform float uKernelScale;
uniform float uWarp;
uniform float uTimeScale;
uniform float uDensity;
uniform float uRippleAmount;
uniform float uRippleFreq;
uniform float uRippleSpeed;
uniform float uBrightness;
uniform float uContrast;

#define PI 3.14159265359

// ---- Soft clamp (replaces tanh for WebGL 1.0 compatibility) ----

float softClip(float x) {
    x = clamp(x, -10.0, 10.0); // safe range: tanh(10) ≈ 1.0
    float ax = exp(x);
    float ay = exp(-x);
    return (ax - ay) / (ax + ay);
}

// ---- Hash Functions ----

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec2 hash2(vec2 p) {
    float h = dot(p, vec2(127.1, 311.7));
    float h2 = dot(p, vec2(269.5, 183.3));
    return fract(vec2(sin(h), cos(h2)) * 43758.5453123);
}

// ---- Gabor Kernel ----

float gaborKernel(vec2 delta, float freq, float orient, float phase, float sigma) {
    float env = exp(-PI * dot(delta, delta) / (sigma * sigma));
    vec2 fv = freq * vec2(cos(orient), sin(orient));
    return env * cos(2.0 * PI * dot(delta, fv) + phase);
}

// ---- Gabor Noise (sparse convolution sum) ----

float gaborNoise(vec2 p, float freq, float orient, float sigma, float density) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    float noise = 0.0;
    float weight = 0.0;

    // Evaluate 3x3 neighborhood of cells
    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            vec2 cell = i + vec2(float(x), float(y));
            vec2 rp = hash2(cell);               // random impulse position in cell
            vec2 delta = f - vec2(float(x), float(y)) - rp;

            float cellSeed = hash(cell + vec2(0.5));
            float impulses = floor(1.0 + density * cellSeed);

            float cellNoise = 0.0;
            float s = cellSeed;

            for (int k = 0; k < 16; k++) {
                if (float(k) < impulses) {
                    s = fract(s * 1.3247 + 0.5391);
                    vec2 ioffset = hash2(cell + vec2(float(k) * 0.731));
                    vec2 d2 = delta + (ioffset - 0.5) * 0.3;
                    float phase = hash(vec2(cell) + float(k) * 0.7) * 2.0 * PI;
                    float orientJitter = orient + (hash(vec2(float(k) * 0.13)) - 0.5) * 0.6;
                    float freqJitter = freq * (0.8 + hash(cell + float(k) * 0.37) * 0.4);
                    cellNoise += gaborKernel(d2, freqJitter, orientJitter, phase, sigma);
                }
            }

            // Weight by distance from cell center (smooth falloff)
            float w = 1.0 - smoothstep(0.0, 1.5, length(f - vec2(float(x), float(y)) - rp));
            noise += cellNoise * w;
            weight += w;
        }
    }

    return weight > 0.0 ? noise / weight : 0.0;
}

// ---- Main ----

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    float aspect = uResolution.x / uResolution.y;

    float time = uTime * uSpeed;

    // Base coordinates
    vec2 p = uv * uKernelScale;
    p.x *= aspect;

    // --- Ripple effect ---
    vec2 rippleOffset = vec2(0.0);
    if (uRippleAmount > 0.001) {
        vec2 center = uv - 0.5;
        center.x *= aspect;
        float dist = length(center);
        float wave = sin(dist * uRippleFreq * 20.0 - time * uRippleSpeed * 2.0) * uRippleAmount;
        vec2 dir = dist > 0.001 ? normalize(center) : vec2(0.0, 1.0);
        rippleOffset = dir * wave * uKernelScale * 0.15;
    }

    p += rippleOffset;

    // --- Domain Warping ---
    vec2 warpOffset = vec2(0.0);
    if (uWarp > 0.0) {
        float wFreq = uFrequency * 0.5;
        float wOrient = uOrientation + 1.2;
        float wSigma = uSigma * 1.2;
        float w1 = gaborNoise(p + vec2(time * uTimeScale * 0.05, 0.0), wFreq, wOrient, wSigma, uDensity);
        float w2 = gaborNoise(p + vec2(0.0, time * uTimeScale * 0.05), wFreq, wOrient + 1.57, wSigma, uDensity);
        warpOffset = vec2(w1, w2) * uWarp * 0.5;
    }

    p += warpOffset;

    // --- Animated phase offset ---
    vec2 pAnim = p + vec2(time * uTimeScale * 0.04, time * uTimeScale * 0.02);

    // --- Main noise (base + octave) ---
    float n1 = gaborNoise(pAnim, uFrequency, uOrientation, uSigma, uDensity);
    float n2 = gaborNoise(pAnim * 1.7 + 2.0, uFrequency * 1.7, uOrientation + 0.8, uSigma * 0.7, uDensity * 0.6);
    float n = n1 * 0.6 + n2 * 0.4;

    // --- Apply amplitude ---
    n *= uAmplitude;

    // --- Map to [0, 1] with some nonlinear shaping ---
    n = softClip(n);       // soft clamping (manual tanh)
    n = n * 0.5 + 0.5;     // map [-1,1] → [0,1]
    n = clamp(n, 0.0, 1.0);

    // --- Color mapping (tricolor gradient) ---
    vec3 color;
    if (n < 0.5) {
        color = mix(uColor1, uColor2, n * 2.0);
    } else {
        color = mix(uColor2, uColor3, (n - 0.5) * 2.0);
    }

    // --- Subtle vignette ---
    vec2 vig = uv - 0.5;
    float vignette = 1.0 - dot(vig, vig) * 0.5;
    color *= vignette;

    // --- Brightness & Contrast ---
    color *= uBrightness;
    color = (color - 0.5) * uContrast + 0.5;
    color = clamp(color, 0.0, 1.0);

    gl_FragColor = vec4(color, 1.0);
}
