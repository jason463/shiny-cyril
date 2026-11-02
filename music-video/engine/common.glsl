// ---------------------------------------------------------------------------
// COMMON HEADER — prepended to every scene shader by engine.js
// Scenes implement:  void mainImage(out vec4 fragColor, in vec2 fragCoord)
// and must output LINEAR HDR colour (no gamma, no tonemap — post does that).
// ---------------------------------------------------------------------------
precision highp float;
precision highp int;

uniform vec2  iResolution;   // output size in pixels
uniform float iTime;         // song time in seconds
uniform float iLocal;        // seconds since this shot started rendering
uniform float iShotLen;      // total shot length (s)
uniform float iProgress;     // iLocal / iShotLen (0..1)
uniform int   iFrame;        // global frame index (30 fps)
uniform float iSeed;         // per-shot random seed 0..1
uniform vec4  iParams;       // per-shot scene parameters (meaning defined by each scene)
uniform float iIntensity;    // 0 = calm/ambient .. 1 = peak drop

// palette for the current section (linear RGB). A: deep base, B: laser/key, C: haze/fill, D: hot accent
uniform vec3 cA, cB, cC, cD;

// audio features (0..1)
uniform float aKick, aSnare, aHat, aBeat;           // decaying transient envelopes, grid-locked
uniform float aSub, aBass, aLowMid, aMid, aHigh, aAir;
uniform float aRms, aEnergy, aEnergySlow, aCentroid, aOnset;
uniform float aBeatPhase, aBarPhase;                // 0..1 saw within current beat / bar
uniform float aBeatCount, aBarCount;                // integer-valued beat / bar counters
uniform float aKickAcc, aEnergyAcc, aBassAcc;       // monotonic integrals (use for smooth audio-driven travel)

uniform sampler2D iPrev;      // this shot's previous output frame (feedback). black on first frame
uniform sampler2D iSpectrum;  // 64x1, R = log-spaced spectrum level 0..1 (x: 30Hz..16kHz)
uniform sampler2D iText;      // text layer, white glyphs in alpha (premultiplied), screen-aligned

out vec4 mv_FragColor;

#define PI  3.14159265359
#define TAU 6.28318530718

// ---- hashing / noise -------------------------------------------------------
float hash11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2  hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
vec3  hash33(vec3 p3) { p3 = fract(p3 * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }
float hash13(vec3 p3) { p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float vnoise3(vec3 p) {
  vec3 i = floor(p), f = fract(p); vec3 u = f * f * (3. - 2. * f);
  float a = hash13(i), b = hash13(i + vec3(1, 0, 0)), c = hash13(i + vec3(0, 1, 0)), d = hash13(i + vec3(1, 1, 0));
  float e = hash13(i + vec3(0, 0, 1)), f1 = hash13(i + vec3(1, 0, 1)), g = hash13(i + vec3(0, 1, 1)), h = hash13(i + vec3(1, 1, 1));
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, f1, u.x), mix(g, h, u.x), u.y), u.z);
}
float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
float fbm3(vec3 p) { float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * vnoise3(p); p = p * 2.01 + 11.3; a *= .5; } return s; }

// ---- transforms / colour ---------------------------------------------------
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d) { return a + b * cos(TAU * (c * t + d)); }   // IQ cosine palette
vec3 hsv2rgb(vec3 c) { vec3 p = abs(fract(c.xxx + vec3(1., 2. / 3., 1. / 3.)) * 6. - 3.); return c.z * mix(vec3(1), clamp(p - 1., 0., 1.), c.y); }
vec3 srgb2lin(vec3 c) { return pow(max(c, 0.), vec3(2.2)); }
// sample the 4-colour section palette continuously (t wraps 0..1)
vec3 secPal(float t) {
  t = fract(t) * 4.;
  vec3 c0 = cA, c1 = cB, c2 = cC, c3 = cD;
  if (t < 1.) return mix(c0, c1, smoothstep(0., 1., t));
  if (t < 2.) return mix(c1, c2, smoothstep(0., 1., t - 1.));
  if (t < 3.) return mix(c2, c3, smoothstep(0., 1., t - 2.));
  return mix(c3, c0, smoothstep(0., 1., t - 3.));
}
float spec(float x) { return texture(iSpectrum, vec2(clamp(x, 0., 1.), .5)).r; }   // spectrum lookup 0..1

// ---- SDF helpers -------------------------------------------------------------
float smin(float a, float b, float k) { float h = clamp(.5 + .5 * (b - a) / k, 0., 1.); return mix(b, a, h) - k * h * (1. - h); }
float sdBox(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.); }
float sdBox2(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.)) + min(max(d.x, d.y), 0.); }
float sdTorus(vec3 p, vec2 t) { vec2 q = vec2(length(p.xz) - t.x, p.y); return length(q) - t.y; }
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h) - r; }
float sdSeg2(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h); }
vec3  opRep(vec3 p, vec3 c) { return mod(p + .5 * c, c) - .5 * c; }

// camera ray helper: ro = eye, ta = target, uv = centred (-aspect..aspect, -1..1)*0.5, fl = focal length
vec3 camRay(vec3 ro, vec3 ta, vec2 uv, float fl, float roll) {
  vec3 f = normalize(ta - ro); vec3 r = normalize(cross(f, vec3(sin(roll), cos(roll), 0.))); vec3 u = cross(r, f);
  return normalize(uv.x * r + uv.y * u + fl * f);
}
