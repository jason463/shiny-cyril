// Global post pipeline: camera punch/shake, glitch, chromatic aberration, bloom,
// text compositing, tonemap + grade, afterimage trails, strobe, VHS, grain, vignette.
precision highp float;
uniform sampler2D uComp;     // composited HDR scene (mipmapped)
uniform sampler2D uPrev;     // previous post output (display space)
uniform sampler2D uText;     // text layer (premultiplied white, mipmapped)
uniform sampler2D uBloomTex; // rgb = scene bloom, a = text glow (1/4 res)
uniform vec2 iResolution;
uniform float iTime;
uniform int iFrame;

uniform float uExposure, uBloom, uBloomThr, uChroma, uGlitch, uGrain, uVignette, uScan, uFlash, uInvert;
uniform float uAfter, uZoom, uLetterbox, uContrast, uSat, uWarp, uPixelate, uMirror, uRoll;
uniform vec2 uShake;
uniform vec3 uTint;          // multiplicative grade tint (1,1,1 = neutral)
uniform vec3 uLift;          // additive shadows tint
uniform vec3 uTextColor;     // HDR text colour
uniform float uTextGlow, uTextMode, uTextGlitch, uTextAlpha;
out vec4 o;

float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float h11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }

vec3 aces(vec3 x) { return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }

vec2 mapUV(vec2 uv) {
  vec2 asp = vec2(iResolution.x / iResolution.y, 1.);
  vec2 p = (uv - .5) * asp;
  // mirror modes: 1 = left/right, 2 = quad, 3 = kaleido 6
  if (uMirror > .5 && uMirror < 1.5) p.x = abs(p.x);
  else if (uMirror > 1.5 && uMirror < 2.5) p = abs(p);
  else if (uMirror > 2.5) {
    float a = atan(p.y, p.x), r = length(p);
    float seg = 6.2831853 / 6.;
    a = mod(a, seg); a = abs(a - seg * .5);
    p = r * vec2(cos(a), sin(a));
  }
  float c = cos(uRoll), s = sin(uRoll);
  p = mat2(c, s, -s, c) * p;
  p /= (1. + uZoom);
  p += uShake;
  if (uWarp > 0.) p += uWarp * vec2(sin(p.y * 9. + iTime * 3.), sin(p.x * 7. - iTime * 2.)) * .02;
  return p / asp + .5;
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  vec2 uv0 = fc / iResolution;
  vec2 uv = uv0;
  if (uPixelate > 1.) { vec2 cell = vec2(uPixelate) / iResolution; uv = (floor(uv / cell) + .5) * cell; }

  // block glitch: displace random horizontal bands / tiles
  float gT = floor(iTime * 24.);
  vec2 gOff = vec2(0.);
  float gSplit = 0.;
  if (uGlitch > 0.) {
    float band = floor(uv.y * (12. + 30. * h11(gT)));
    float tile = floor(uv.x * 6.);
    float r = h12(vec2(band, gT));
    if (r < uGlitch * .35) { gOff.x = (h12(vec2(band, gT + 7.)) - .5) * .35 * uGlitch; gSplit = uGlitch; }
    float r2 = h12(vec2(band * 3. + tile, gT * 1.3));
    if (r2 < uGlitch * .08) { gOff += (vec2(h12(vec2(tile, gT)), h12(vec2(band, tile))) - .5) * .2; gSplit = 1.; }
  }
  vec2 suv = mapUV(uv + gOff);

  // chromatic aberration (radial) + glitch channel split
  vec2 dir = suv - .5;
  float ca = uChroma + gSplit * .015;
  vec3 col;
  col.r = textureLod(uComp, suv + dir * ca + vec2(gSplit * .01, 0.), 0.).r;
  col.g = textureLod(uComp, suv, 0.).g;
  col.b = textureLod(uComp, suv - dir * ca - vec2(gSplit * .01, 0.), 0.).b;

  // bloom (precomputed at 1/4 res from the mip chain)
  col += textureLod(uBloomTex, suv, 0.).rgb * uBloom;

  // text layer — sampled in screen space with its own glitch/chroma
  if (uTextAlpha > 0.) {
    vec2 tuv = uv0;
    float tg = uTextGlitch;
    float tb = floor(tuv.y * 40.);
    float tr = h12(vec2(tb, floor(iTime * 30.)));
    if (tr < tg * .5) tuv.x += (h12(vec2(tb, floor(iTime * 30.) + 3.)) - .5) * .08 * tg;
    float sh = .002 + tg * .008;
    float tR = texture(uText, tuv + vec2(sh, 0.)).a;
    float tG = texture(uText, tuv).a;
    float tB = texture(uText, tuv - vec2(sh, 0.)).a;
    float glow = texture(uBloomTex, tuv).a;
    vec3 tm = vec3(tR, tG, tB) * uTextAlpha;
    if (uTextMode < .5) {                  // solid
      col = mix(col, uTextColor, tm);
    } else if (uTextMode < 1.5) {          // difference / invert-through
      col = mix(col, max(vec3(1.2) - col, 0.) * uTextColor, tm);
    } else {                               // additive neon
      col += uTextColor * tm;
    }
    col += uTextColor * glow * uTextGlow * uTextAlpha;
  }

  // exposure, tonemap, grade
  col *= uExposure;
  col = aces(col);
  col = pow(col, vec3(1. / 2.2));
  col = col * uTint + uLift * (1. - col);
  float l = dot(col, vec3(.299, .587, .114));
  col = mix(vec3(l), col, uSat);
  col = (col - .5) * uContrast + .5;
  col = clamp(col, 0., 1.);

  // afterimage trails (max-blend with decayed previous frame)
  if (uAfter > 0.) {
    vec3 prev = texture(uPrev, uv0 + (uv0 - .5) * -.004).rgb;
    col = max(col, prev * uAfter);
  }

  // strobe flash / invert
  col = mix(col, vec3(1.), clamp(uFlash, 0., 1.));
  col = mix(col, 1. - col, clamp(uInvert, 0., 1.));

  // VHS scanlines + line jitter brightness
  if (uScan > 0.) {
    float sl = .5 + .5 * sin(fc.y * 3.14159);
    col *= 1. - uScan * .35 * sl;
    col += uScan * .04 * (h12(vec2(floor(fc.y * .5), gT)) - .5);
  }
  // vignette
  vec2 vp = uv0 - .5;
  col *= 1. - uVignette * smoothstep(.2, .85, length(vp * vec2(1.1, 1.)));
  // film grain
  float g = h12(fc + float(iFrame % 997) * 13.17) - .5;
  col += g * uGrain * (1.2 - l);
  // letterbox
  float lb = uLetterbox * .5;
  if (uv0.y < lb || uv0.y > 1. - lb) col = vec3(0.);
  o = vec4(clamp(col, 0., 1.), 1.);
}
