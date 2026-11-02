// Transition compositor: blends outgoing shot A into incoming shot B.
precision highp float;
uniform sampler2D uA, uB;
uniform vec2 iResolution;
uniform float uMix;      // 0 = all A, 1 = all B
uniform int uType;       // see list below
uniform float uSeed;
uniform float iTime;
out vec4 o;

float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(h12(i), h12(i + vec2(1, 0)), u.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), u.x), u.y); }

vec4 A(vec2 uv) { return texture(uA, uv); }
vec4 B(vec2 uv) { return texture(uB, uv); }

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution;
  float m = clamp(uMix, 0., 1.);
  vec2 asp = vec2(iResolution.x / iResolution.y, 1.);
  vec3 col;
  if (uType < 0) {                        // single shot passthrough
    col = A(uv).rgb;
  } else if (uType == 0) {                // hard cut at midpoint
    col = (m < .5 ? A(uv) : B(uv)).rgb;
  } else if (uType == 1) {                // crossfade (eased)
    col = mix(A(uv).rgb, B(uv).rgb, smoothstep(0., 1., m));
  } else if (uType == 2) {                // flash through white (HDR burst)
    float f = 1. - abs(m * 2. - 1.);
    col = mix(A(uv).rgb, B(uv).rgb, step(.5, m)) + vec3(6.) * pow(f, 3.);
  } else if (uType == 3) {                // glitch slices
    float rows = 18. + 30. * h12(vec2(uSeed, 1.));
    float r = floor(uv.y * rows);
    float th = h12(vec2(r, uSeed * 91.));
    float off = (h12(vec2(r, floor(m * 12.) + uSeed)) - .5) * .25 * sin(m * 3.14159265);
    bool showB = th < m;
    vec2 q = uv + vec2(off, 0.);
    vec3 a = vec3(A(q + vec2(.01, 0)).r, A(q).g, A(q - vec2(.01, 0)).b);
    vec3 b = vec3(B(q + vec2(.01, 0)).r, B(q).g, B(q - vec2(.01, 0)).b);
    col = showB ? b : a;
  } else if (uType == 4) {                // zoom-through: A rushes past camera, B emerges
    vec2 c = uv - .5;
    float za = 1. / (1. + m * m * 6.);
    float zb = 1. + (1. - m) * 1.5;
    vec3 a = vec3(0.), b = vec3(0.);
    for (int i = 0; i < 8; i++) {
      float k = float(i) / 7.;
      a += A(.5 + c * za * (1. - k * .08 * m)).rgb;
      b += B(.5 + c * zb * (1. - k * .06 * (1. - m))).rgb;
    }
    col = mix(a / 8., b / 8., smoothstep(.35, .75, m));
  } else if (uType == 5) {                // noise dissolve with glowing burn edge
    float n = vn(uv * asp * 6. + uSeed * 10.) * .6 + vn(uv * asp * 23.) * .4;
    float e = m * 1.2 - .1;
    float edge = smoothstep(.06, 0., abs(n - e));
    col = mix(A(uv).rgb, B(uv).rgb, step(n, e)) + vec3(1.6, .7, 2.2) * edge * 3.;
  } else if (uType == 6) {                // RGB split wipe (channels arrive at different times)
    vec3 mm = clamp(vec3(m * 1.6, m * 1.6 - .3, m * 1.6 - .6), 0., 1.);
    vec2 sh = vec2((1. - m) * m * .3, 0.);
    vec3 a = vec3(A(uv + sh).r, A(uv).g, A(uv - sh).b);
    vec3 b = vec3(B(uv - sh).r, B(uv).g, B(uv + sh).b);
    col = mix(a, b, smoothstep(0., 1., mm));
  } else if (uType == 7) {                // iris: circle grows from centre with hot ring
    float d = length((uv - .5) * asp);
    float R = m * 1.1;
    float ring = smoothstep(.03, 0., abs(d - R)) * (1. - m);
    col = mix(B(uv).rgb, A(uv).rgb, smoothstep(R - .005, R + .005, d)) + vec3(2.5, 1.5, 4.) * ring * 2.;
  } else {                                // 8: slit-scan horizontal smear wipe
    float x = uv.x + (vn(vec2(uv.y * 40., uSeed * 7.)) - .5) * .3;
    float w = smoothstep(m * 1.4 - .2, m * 1.4 - .1, x);
    vec2 smear = vec2((1. - abs(m * 2. - 1.)) * .15 * (vn(vec2(uv.y * 90., m * 5.)) - .5), 0.);
    col = mix(B(uv + smear).rgb, A(uv - smear).rgb, w);
  }
  o = vec4(col, 1.);
}
