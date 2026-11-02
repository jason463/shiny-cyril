// =============================================================================
// CHROME — liquid-metal metaballs floating in a dark studio void.
// A cluster of morphing chrome blobs (smooth union of orbiting spheres + liquid
// wobble) mirror-reflects an analytic high-contrast neon studio: near-black dome,
// glowing horizon band, overhead softbox with diffuser grid, five tall strip lights
// (crisp streaks that slide over the metal as the camera orbits), sweeping laser
// sheets, and a glowing LED ring on the stage floor far below (also seen directly).
// Reflections are footprint-filtered energy-preservingly (no smeared neon outlines).
// Behind the hero a laser fan fires through the haze (it also rims the silhouettes,
// since grazing reflections look straight back at it). Blobs reflect each other via
// analytic sphere proxies (no second march). Slow orbiting camera, sparse bokeh.
//
// iParams (all 0..1; 0,0,0,0 = 4 blobs, mirror chrome, glassy surface, moody light):
//   x  blob count / complexity   0 = 4 blobs (one big mass + 3 satellites), lazy drift,
//                                    3 droplets per clap
//                                1 = 8 smaller blobs, wider/faster orbits, 4 droplets
//                                (camera pulls back a little as the cluster grows)
//   y  surface                   0 = mirror chrome .. 1 = iridescent oil-slick thin film
//                                (palette-tinted rainbow interference, darker base)
//   z  ripple / noise amount     0 = glassy smooth, gentle kick ripples
//                                1 = strong liquid wobble + big kick shockwaves
//   w  environment brightness    0 = low-key moody studio .. 1 = high-key studio
//                                (bigger, brighter softbox / strips, stronger lasers + fan)
// Audio: bass (sidechain pump) swells the blobs; every kick fires a ripple shockwave
// from a random impact point (its glowing front sweeps across the surface) + radius
// punch + strip-light flare + laser-fan pulse (the fan also scrolls with the kicks);
// claps (beats 2 & 4) snap 3-4 droplets out of the mass that fly off and merge back;
// snare flashes the softbox; hats twinkle the bokeh. Every 4-bar phrase (intensity
// > ~0.6 with drums): during the last bar the cluster is sucked into one trembling
// drop while the laser fan squeezes shut behind it, then on the downbeat the drop
// bursts apart, the fan snaps wide and everything flares. The laser fan fades in
// above intensity ~0.4 (calm = pure dark product shot, peak = chrome in a laser club).
// =============================================================================

#define NB 8
#define ND 4
const float FLOOR_Y = -2.8;  // stage floor far below the cluster
const float LED_R = 1.9;     // floor LED ring radius in units of the floor depth (env() + background())

// NOTE: everything below is written loop-free with constant array indices: on the
// SwiftShader software GPU, dynamically indexed array loops (and both sides of every
// branch) cost a lot. Inactive blobs/droplets are parked far away with radius -1, where
// smin() returns the other operand exactly.
vec4 gB[NB];          // blob centre xyz, radius w (w < 0 = inactive)
vec4 gD[ND];          // droplet centre xyz, radius w (w < 0 = inactive)
int gN, gND;          // active blob / droplet count
const vec4 FAR = vec4(0., 1e4, 0., -1.);
float gK, gDk;        // smooth-union radii (blobs, droplets)
float gNz, gTm;       // wobble amount, wobble time
vec3 gRipC;           // kick shockwave origin
float gRipF, gRipA;   // shockwave front radius, amplitude
float gI, gEnvB, gDisp;
vec3 gCamF;           // camera forward
vec3 gSoftCol;
float gSoftSz, gLaser, gStrip;
vec3 gLN[3];          // laser sheet normals (per frame)
vec3 gFS, gFU, gFV;   // laser fan: source direction + (up, side) basis around it
float gFan, gFanPh, gFanSw, gFanW;
vec2 gHz, gLed;       // (cos, sin) phase rotors: horizon hue, LED colour sweep
mat2 gSoftR;          // softbox rotation

// ---------------------------------------------------------------------------
// SDF
// ---------------------------------------------------------------------------
// cheap parabolic sine (period TAU, max err ~5%) + its derivative: the march evaluates
// the field ~30-70x per pixel on a software rasteriser, so every transcendental counts
vec3 fsin(vec3 x) { vec3 t = x * (1. / TAU); t -= floor(t + .5); return 8. * t * (1. - 2. * abs(t)); }
vec3 fdsin(vec3 x) { vec3 t = x * (1. / TAU); t -= floor(t + .5); return (8. - 32. * abs(t)) * (1. / TAU); }
float fsin1(float x) { float t = x * (1. / TAU); t -= floor(t + .5); return 8. * t * (1. - 2. * abs(t)); }
float fdsin1(float x) { float t = x * (1. / TAU); t -= floor(t + .5); return (8. - 32. * abs(t)) * (1. / TAU); }
float fbump(float w) { float x = clamp(1. - w * w * 2.4, 0., 1.); return x * x * x; }   // ~exp(-7 w^2)
const vec3 DW = vec3(3.1, -2.5, 2.2);

float sdS(vec3 p, vec4 s) { return length(p - s.xyz) - s.w; }

float map(vec3 p) {
  float d = sdS(p, gB[0]);
  d = smin(d, sdS(p, gB[1]), gK); d = smin(d, sdS(p, gB[2]), gK); d = smin(d, sdS(p, gB[3]), gK);
  d = smin(d, sdS(p, gB[4]), gK); d = smin(d, sdS(p, gB[5]), gK); d = smin(d, sdS(p, gB[6]), gK);
  d = smin(d, sdS(p, gB[7]), gK);
  d = smin(d, sdS(p, gD[0]), gDk); d = smin(d, sdS(p, gD[1]), gDk);
  d = smin(d, sdS(p, gD[2]), gDk); d = smin(d, sdS(p, gD[3]), gDk);
  // liquid wobble (cheap sine "noise") + kick shockwave (wave packet travelling outward
  // from the impact point). Keep in sync with mapGrad().
  vec3 sa = fsin(vec3(p.x * 2.1 + gTm * 1.3, p.y * 2.31 - gTm, p.z * 1.89 + gTm * .8));
  d -= gNz * (sa.x * sa.y * sa.z + .3 * fsin1(dot(p, DW) + gTm * 2.1));
  float w = length(p - gRipC) - gRipF;
  d -= gRipA * fsin1(w * 12.) * fbump(w);
  return d;
}

// same field + analytic gradient (one evaluation instead of 4 for the normal; the
// gradient of the quadratic smin is exactly the h-weighted mix of the input gradients)
#define GSTEP(S, K) v = p - S.xyz; l = length(v); b = l - S.w; h = clamp(.5 + .5 * (b - d) / K, 0., 1.); d = mix(b, d, h) - K * h * (1. - h); g = mix(v / l, g, h);
vec3 mapGrad(vec3 p, vec3 rd) {
  vec3 v = p - gB[0].xyz;
  float l = length(v), b, h;
  float d = l - gB[0].w;
  vec3 g = v / l;
  GSTEP(gB[1], gK) GSTEP(gB[2], gK) GSTEP(gB[3], gK) GSTEP(gB[4], gK)
  GSTEP(gB[5], gK) GSTEP(gB[6], gK) GSTEP(gB[7], gK)
  GSTEP(gD[0], gDk) GSTEP(gD[1], gDk) GSTEP(gD[2], gDk) GSTEP(gD[3], gDk)
  vec3 a = vec3(p.x * 2.1 + gTm * 1.3, p.y * 2.31 - gTm, p.z * 1.89 + gTm * .8);
  vec3 sa = fsin(a), da = fdsin(a);
  float a2 = dot(p, DW) + gTm * 2.1;
  g -= gNz * (vec3(2.1 * da.x * sa.y * sa.z, 2.31 * sa.x * da.y * sa.z, 1.89 * sa.x * sa.y * da.z) + .3 * fdsin1(a2) * DW);
  vec3 u = p - gRipC;
  float lu = max(length(u), 1e-4);
  float w = lu - gRipF;
  float x = clamp(1. - w * w * 2.4, 0., 1.);
  float dw = 12. * fdsin1(w * 12.) * x * x * x - fsin1(w * 12.) * 14.4 * w * x * x;
  // fade the high-frequency ripple where the surface turns away (it would alias there)
  float gl = length(g);
  float fade = smoothstep(.05, .4, -dot(g, rd) / gl);
  g -= gRipA * dw * u / lu * fade;
  return normalize(g);
}

// ---------------------------------------------------------------------------
// analytic studio environment (what the chrome reflects). fp = angular footprint
// ---------------------------------------------------------------------------
float soft(float sd, float ew) { return clamp(.5 - sd / ew, 0., 1.); }
// chord distance between horizontal direction n (unit, xz) and azimuth a (≈ angle for small values)
float azd(vec2 n, float a) { return length(n - vec2(sin(a), cos(a))); }
// tall vertical strip light at constant azimuth direction a (unit xz), half-width hw, y0..y1
// (energy-preserving: a wide reflection footprint dims the strip instead of smearing it
// into a broad wash)
float vstrip(vec2 n, float y, vec2 a, float hw, float y0, float y1, float ew, float ey) {
  return soft(length(n - a) - hw, ew) * min(1., 2.5 * hw / ew) * soft(abs(y - .5 * (y0 + y1)) - .5 * (y1 - y0), ey);
}
// strip light azimuths (sin a, cos a) for a = .55, 1.95, -2.05, -.9, PI
const vec2 SA1 = vec2(.5227, .8525), SA2 = vec2(.9290, -.3702), SA3 = vec2(-.8874, -.4611);
const vec2 SA4 = vec2(-.7833, .6216), SA5 = vec2(0., -1.);

// laser fan: beams radiating from direction gFS (low, right behind the hero as seen from
// the camera), scrolling sideways with the kick count. w = core angular half-width,
// hz = haze glow weight. Shared by env() (rims) and background() (seen directly).
vec3 fanCol(vec3 r, float w0, float fp, float hz, float nr) {
  float w = w0 + fp;
  float u = dot(r, gFU), v = dot(r, gFV);
  float rp = length(vec2(u, v));              // ~ angle from the source
  float phi = atan(v, u + 1e-5);              // 0 = straight up
  const float SP = .2;                        // beam spacing (rad)
  phi /= gFanW;                               // fan squeezes shut during the phrase collapse
  float q = (phi - gFanSw) / SP + gFanPh;
  float dq = (fract(q) - .5) * SP * rp;       // angular distance to the nearest beam
  float m = smoothstep(1.5, 1.05, abs(phi)) * smoothstep(-.2, .3, dot(r, gFS)) * smoothstep(nr * .5, nr, rp);
  float idx = floor(q);
  float on = step(.3, hash11(idx * 7.31 + floor(gFanPh * .25) * 3.7));     // a few beams drop out
  vec3 c = mix(cB, cD, step(.62, hash11(idx * 1.93 + 5.1)));
  float core = w / sqrt(w * w + dq * dq);     // filtered line profile (energy-ish preserving)
  core = core * core * core * w0 / w;
  float glow = exp(-abs(dq) * 30.) * hz;
  return c * (core * 1.4 + glow) * m * on * exp(-rp * 1.2);
}

vec3 env(vec3 r, float fp) {
  float y = r.y;
  float cy = max(length(r.xz), 1e-3);
  vec2 n = r.xz / cy;                    // (sin az, cos az)
  vec3 col = vec3(0.);

  // studio dome: near-black, with a glowing palette band just above the horizon
  float up = max(y, 0.);
  vec3 hzCol = mix(cC, cB, .5 + .5 * dot(n, gHz));
  vec3 sky = cA * .3 + hzCol * (.65 * exp(-up * 9.) + .05 * exp(-up * 2.));
  sky += cD * .35 * exp(-azd(n, 2.6) * 1.8) * exp(-up * 6.);
  col += sky * smoothstep(-.012 - fp, .012 + fp, y);
  float hw = .006 + fp;
  col += mix(hzCol, vec3(1.), .3) * 1.8 * exp(-abs(y - .004) / hw) * .006 / hw;

  // ground: near-black floor + one bright LED ring around the base
  {
    float g = smoothstep(0., -.25, y);
    col += hzCol * .06 * exp(-abs(y) * 14.) * step(y, 0.);
    float rr = cy / max(-y, .03);
    float fw = .03 + fp / max(y * y, .002) * 1.2;
    float lw = .07 + fw * 2.;
    float led = abs(rr - LED_R) / lw;
    float lh = .5 + .5 * (2. * n.x * n.y * gLed.x + (n.y * n.y - n.x * n.x) * gLed.y);   // sin(2 az + phase)
    // energy-preserving filter: at grazing angles (huge footprint) the ring fades instead of
    // smearing into a glowing outline around every silhouette
    col += mix(cD, cB, lh) * 2.4 * exp(-led * led) * min(1., .12 / lw) * (.7 + .6 * aBass) * g;
  }

  // overhead softbox (slowly rotating) with a 4 x 2 grid of diffuser panels
  {
    float yy = max(y, .05);
    vec2 q = gSoftR * (r.xz / yy);
    float sd = sdBox2(q, vec2(1.0, .42) * gSoftSz) - .05;
    float ew = .03 + fp / (yy * yy) * 1.5;
    float m = soft(sd, ew) * smoothstep(.1, .2, y);
    float grad = .75 + .25 * exp(-dot(q, q) * 1.5);
    vec2 gd = abs(fract(q / gSoftSz * vec2(2., 2.4)) - .5);
    float gw = ew * 2. / gSoftSz + .02;
    float mull = soft(gd.x - .46, gw) * soft(gd.y - .45, gw * 1.2);
    float sd2 = sdBox2(q - vec2(0., 1.25 * gSoftSz), vec2(1.1, .07) * gSoftSz);
    col += gSoftCol * (m * grad * mix(.3, 1., mull) + .6 * soft(sd2, ew) * smoothstep(.1, .2, y));
  }

  // five tall strip lights (world-fixed, so their streaks slide as the camera orbits);
  // they flare on the kick
  {
    float ewS = .01 + fp * 1.3 / cy, ey = .03 + fp;
    float ss = gSoftSz;
    vec3 sc = mix(vec3(1., .96, .9), cC, .15) * 3.2 * vstrip(n, y, SA1, .08 * ss, -.06, .95, ewS, ey)
            + cB * 4.2 * vstrip(n, y, SA2, .06 * ss, -.06, .85, ewS, ey)
            + cD * 3.8 * vstrip(n, y, SA3, .05 * ss, -.06, .8, ewS, ey)
            + mix(cC, vec3(1.), .25) * 2.2 * vstrip(n, y, SA4, .11 * ss, .02, .6, ewS, ey)
            + vec3(2.4) * vstrip(n, y, SA5, .035 * ss, -.06, .7, ewS, ey);
    col += sc * gStrip;
  }

  // back light right behind the subject: grazing reflections look straight at it,
  // so it draws a clean rim along every silhouette
  float bl = max(dot(r, gCamF), 0.);
  bl *= bl; bl *= bl; bl *= bl; bl *= bl;
  col += mix(cC, cB, .45) * .35 * bl;

  // laser sheets: great circles sweeping with the kick count (footprint-filtered)
  float lw = .004;
  float ef = sqrt(lw * lw + fp * fp * .6);
  float lsc = lw / ef * gLaser * smoothstep(-.1, .2, y + .1);
  vec3 dl = vec3(dot(r, gLN[0]), dot(r, gLN[1]), dot(r, gLN[2]));
  vec3 le = exp(-dl * dl / (ef * ef)) * lsc;
  col += cB * (le.x + le.z) + cD * le.y;
  // the laser fan behind the hero (thin rim streaks at the silhouettes)
  col += fanCol(r, .004, fp, .0, .45) * gFan * 1.5;

  return col * gEnvB;
}

// background seen directly: void + soft horizon haze, floor LED ring, light shaft, laser fan
vec3 background(vec3 ro, vec3 rd, vec2 uv, float pxA) {
  float y = rd.y;
  vec2 n = rd.xz / max(length(rd.xz), 1e-3);
  // keep the void dark for bright palettes (ice/acid/ember have very bright haze colours)
  float kv = .32 / max(dot(cC + cB, vec3(.15, .3, .05)), .32);
  vec3 hzCol = mix(cC, cB, .5 + .5 * dot(n, gHz)) * kv;
  vec3 haze = hzCol * (exp(-abs(y + .03) / .1) * .035 + exp(-abs(y + .03) / .015) * .03);
  vec3 col = cA * .05 + haze;
  // dark stage floor far below, with the glowing LED ring the chrome reflects (fogged with distance)
  {
    float yn = min(y, -.005);
    float tf = (FLOOR_Y - ro.y) / yn;
    vec2 fq = ro.xz + rd.xz * tf;
    float rho = length(fq);
    float R = LED_R * -FLOOR_Y;
    float wf = .06 + pxA * tf / max(-yn, .05) * .7;
    float dr = (rho - R) / wf;
    vec2 fn = fq / max(rho, 1e-3);
    float lh = .5 + .5 * (2. * fn.x * fn.y * gLed.x + (fn.x * fn.x - fn.y * fn.y) * gLed.y);
    float fog = exp(-tf * .045) * smoothstep(-.005, -.04, y);
    col += mix(cD, cB, lh) * (exp(-dr * dr) * .05 / wf + exp(-abs(rho - R) * 1.8) * .1) * (.7 + .6 * aBass) * fog;
    col += mix(cC, cB, .5) * kv * .05 * exp(-rho * rho * .12) * fog;     // pool of light under the cluster
  }
  // spotlit backdrop glow behind the hero (separates the dark lower halves from the void)
  col += mix(cC, cB, .4) * kv * .045 * exp(-dot(uv, uv) * 3.) * (.7 + .3 * aEnergy);
  // soft overhead light shaft through the haze (cone around the vertical axis)
  {
    vec2 dxz = rd.xz;
    float tc = -dot(ro.xz, dxz) / max(dot(dxz, dxz), 1e-4);
    float dc = length(ro.xz + dxz * tc);
    float yc = ro.y + rd.y * tc;
    float wc = .55 + max(4.5 - yc, 0.) * .22;
    float sh = exp(-dc * dc / (wc * wc)) * smoothstep(FLOOR_Y - 1., FLOOR_Y + 2., yc) * smoothstep(9., 3., yc);
    col += mix(gSoftCol * .4, cC, .5) * kv * sh * .03 * step(0., tc);
  }
  // laser fan through the haze behind the hero
  col += fanCol(rd, pxA * 1.3, 0., .06 * kv, .05) * gFan * .5;
  return col;
}

// sparse out-of-focus bokeh discs (screen space, parallax with the orbit), kept away from
// the hero; hats make them twinkle
vec3 bokeh(vec2 uv, float camA, float layer) {
  float sc = mix(3.6, 2.,  layer);
  vec2 q = uv * sc + vec2(camA * mix(1.5, 4., layer), iTime * .03 * (1. + layer));
  vec2 id = floor(q), f = fract(q) - .5;
  vec2 h = hash22(id + layer * 31.7 + floor(iSeed * 50.));
  vec2 o = (hash22(id * 1.7 + 3.1) - .5) * .5;
  float rad = mix(.07, .17, h.y) * mix(1., .75, layer);
  float d = length(f - o);
  float aa = sc * 2. / iResolution.y;
  float disk = smoothstep(rad, rad - aa, d) * step(h.x, mix(.3, .16, layer));
  disk *= .45 + .55 * smoothstep(rad * .4, rad * .97, d);       // brighter rim (lens bokeh)
  vec3 c = mix(cB, cD, step(.55, fract(h.y * 7.3)));
  float tw = 1. + 1.2 * aHat * step(.5, fract(h.x * 17.3 + h.y * 5.1)) * gI;
  return c * disk * mix(.07, .12, layer) * (.6 + .5 * aEnergy) * tw * smoothstep(.12, .5, length(uv));
}

// blob i: Lissajous orbit about the cluster centre (blob 0 = big central mass)
vec4 makeBlob(float fi, float sd, float spread, float rs, float sw) {
  vec3 h = hash33(vec3(fi * 7.13 + 1.7, fi * 3.31 + sd, 2.71));
  vec3 c = sin(gTm * (.45 + h * .6) + h.zxy * TAU) * vec3(1.3, .8, 1.3) * spread * mix(.6, 1., h.y);
  float r = mix(.44, .7, h.x) * rs;
  if (fi < .5) { c *= .15; r = .86 * rs; }
  return fi < float(gN) ? vec4(c, r * sw) : FAR;
}
// clap droplet j: splits off blob b0 and flies out past the cluster rim (radius rc
// around cen), then falls back in. q = (clap id, seed, sin(PI*phase), phase)
vec4 makeDrop(float fj, vec4 b0, vec3 cen, float rc, vec4 q, float fly, float trv, float rs) {
  vec3 h = hash33(vec3(q.x * 1.31 + fj * 5.7, fj + 3.3, q.y));
  vec3 dir = h * 2. - 1. + vec3(0., .1, 0.) + (b0.xyz - cen) * .8;   // leave from the blob's outer side
  dir -= gCamF * dot(dir, gCamF) * .75;        // fly mostly across the frame, not into depth
  dir.y *= .5;                                 // 16:9 frame: more room sideways than up/down
  dir /= max(length(dir), .05);
  vec3 side = normalize(cross(dir, vec3(.3, 1., .2)));
  vec3 tgt = cen + dir * (rc + mix(.4, 1., h.x) * trv);
  tgt.y = cen.y + clamp(tgt.y - cen.y, -1.2, 1.3);   // stay inside the frame vertically
  vec3 pos = mix(b0.xyz, tgt, fly) + side * .3 * q.z * fly;
  return fj < float(gND) ? vec4(pos, mix(.16, .27, h.y) * rs * (1. - .25 * q.w)) : FAR;
}

// ---------------------------------------------------------------------------
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - .5 * iResolution) / iResolution.y;
  float I = clamp(iIntensity, 0., 1.);
  gI = I;
  float cx = clamp(iParams.x, 0., 1.);
  float sy = clamp(iParams.y, 0., 1.);
  float rz = clamp(iParams.z, 0., 1.);
  float ew = clamp(iParams.w, 0., 1.);

  gEnvB = mix(.8, 1.15, ew) * mix(.7, 1., I);
  gSoftSz = mix(.85, 1.3, ew);
  gLaser = mix(1.2, 3.5, I) * mix(.8, 1.3, ew);
  gSoftCol = mix(vec3(1.), cC, .3) * 2.4 * (1. + aSnare * I);
  gStrip = 1. + 1.6 * aKick * aKick * I;

  // ---- time bases
  float spd = mix(.22, .45, I) * mix(.85, 1.25, cx);
  gTm = iTime * spd + aBassAcc * .06 + iSeed * 40.;
  float bass = .5 * (aBass + aSub);
  float swell = 1. + .09 * bass * mix(.4, 1., I) + .07 * aKick * I;
  gHz = vec2(cos(gTm * .15), sin(gTm * .15));
  gLed = vec2(cos(gTm * .5), sin(gTm * .5));
  gSoftR = rot(gTm * .07);
  // laser sheet normals (3 sheets, phase-offset, tilted differently)
  vec3 la = aKickAcc * .22 + gTm * .05 + vec3(0., 2.1, 4.2);
  vec3 lsn = sin(la), lcs = cos(la), lcy = cos(la * .7 + vec3(0., 1.7, 3.4));
  gLN[0] = normalize(normalize(vec3(lsn.x, .35 * lcy.x, lcs.x)) - vec3(0., .75, 0.));
  gLN[1] = normalize(vec3(lsn.y, .35 * lcy.y, lcs.y));
  gLN[2] = normalize(normalize(vec3(lsn.z, .35 * lcy.z, lcs.z)) + vec3(0., .75, 0.));

  // ---- 4-bar phrase choreography: in the last bar the cluster is sucked together into
  // one trembling drop, then bursts apart (elastic overshoot) on the phrase downbeat
  float ph16 = mod(aBeatCount - 3., 16.) + aBeatPhase;      // 0..16 beats, 0 = phrase downbeat
  float contract = ph16 < 8. ? exp(-ph16 * 1.6) * cos(ph16 * 3.6) : pow(smoothstep(12., 16., ph16), 1.5);
  float pg = smoothstep(.55, .85, I) * smoothstep(.3, .6, aEnergy);
  contract *= pg;
  float burst = (ph16 < 8. ? exp(-ph16 * 1.2) : 0.) * pg;  // flare envelope after the burst
  gStrip += 1.2 * burst;

  // ---- blobs
  gN = 4 + int(floor(cx * 4. + .5));
  float spread = mix(1.15, 1.3, cx) * (1. - .06 * aKick * I) * (1. - .72 * contract);
  float rs = mix(1., .82, cx) * (1. + .12 * max(contract, 0.));
  gK = mix(.4, .34, cx);
  float sd97 = floor(iSeed * 97.);
  gB[0] = makeBlob(0., sd97, spread, rs, swell); gB[1] = makeBlob(1., sd97, spread, rs, swell);
  gB[2] = makeBlob(2., sd97, spread, rs, swell); gB[3] = makeBlob(3., sd97, spread, rs, swell);
  gB[4] = makeBlob(4., sd97, spread, rs, swell); gB[5] = makeBlob(5., sd97, spread, rs, swell);
  gB[6] = makeBlob(6., sd97, spread, rs, swell); gB[7] = makeBlob(7., sd97, spread, rs, swell);
  vec3 cen = (gB[0].xyz + gB[1].xyz + gB[2].xyz + gB[3].xyz + gB[4].xyz * step(0., gB[4].w)
            + gB[5].xyz * step(0., gB[5].w) + gB[6].xyz * step(0., gB[6].w) + gB[7].xyz * step(0., gB[7].w)) / float(gN);

  // ---- kick shockwave + surface wobble
  float beatT = aBeatPhase * (60. / 122.45);
  vec3 kh = hash33(vec3(aBeatCount * .713, 4.1, floor(iSeed * 37.)));
  gNz = mix(.015, .075, rz) * mix(.6, 1., I) * (1. + 1.2 * max(contract, 0.));
  gRipA = mix(.03, .075, rz) * pow(aKick, .8) * mix(.4, 1., I) * (1. + .8 * max(contract, 0.));
  gRipF = .15 + beatT * mix(4.5, 6., I);
  gDisp = gNz * 1.3 + gRipA;

  // ---- camera: slow orbit around the cluster centroid, gentle push-in over the shot
  float camA = iSeed * TAU + iTime * mix(.07, .16, I) + aKickAcc * .025;
  float el = .2 + .17 * sin(iTime * .11 + iSeed * 5.3);
  float dist = mix(7.6, 8.8, cx) * (1. - .06 * smoothstep(0., 1., iProgress));
  vec3 ta = cen * .75;
  vec3 ro = ta + vec3(sin(camA) * cos(el), sin(el), cos(camA) * cos(el)) * dist;
  float fl = 1.85;
  vec3 rd = camRay(ro, ta, uv, fl, .05 * sin(iTime * .21 + iSeed * 3.));
  gCamF = normalize(ta - ro);

  // ---- laser fan: source low behind the hero, beams scroll with the kicks, pulse on them
  gFS = normalize(gCamF + vec3(0., -.1, 0.));
  gFU = normalize(vec3(0., 1., 0.) - gFS * gFS.y);
  gFV = cross(gFS, gFU);
  gFanPh = aKickAcc * .5 + iSeed * 9.;
  gFanSw = .3 * sin(gTm * .4 + iSeed * 4.);
  gFan = smoothstep(.35, .85, I) * mix(.7, 1.3, ew) * (.45 + 1.1 * aKick + 1.5 * burst) * smoothstep(.1, .4, aEnergy + .2 * I);
  gFanW = 1. - .6 * max(contract, 0.);

  // ---- clap droplets: snap out on beats 2 & 4, fly, merge back by the next clap
  // claps land on even beat indices: clock + id from the beat tracker (pop-free)
  float cpt = (mod(aBeatCount, 2.) + aBeatPhase) * .5;
  float cid = floor(aBeatCount * .5);
  float act = smoothstep(.35, .7, I) * smoothstep(.25, .55, aEnergy);
  float fly = sin(PI * pow(cpt, .7)) * act;                 // quick ejection, slower fall-back
  gND = act > .001 ? 3 + int(cx > .5) : 0;
  gDk = .38;
  vec4 dq = vec4(cid, floor(iSeed * 61.), sin(PI * cpt), cpt);
  float trv = mix(.6, .85, cx);
  float rc = spread * 1.05 + .4;
  gD[0] = makeDrop(0., gB[0], cen, rc, dq, fly, trv, rs); gD[1] = makeDrop(1., gB[1], cen, rc, dq, fly, trv, rs);
  gD[2] = makeDrop(2., gB[2], cen, rc, dq, fly, trv, rs); gD[3] = makeDrop(3., gB[3], cen, rc, dq, fly, trv, rs);

  // impact point on the main blob, biased towards the camera so the rings read
  vec3 kr = kh * 2. - 1.;
  vec3 kd = normalize(mix(kr / max(length(kr), .05), -gCamF, .55) + vec3(0., .05, 0.));
  gRipC = gB[0].xyz + kd * gB[0].w;

  // ---- raymarch. Range = union of the inflated blob / droplet spheres: rays that miss
  // them all skip the march, hits start right next to the surface.
  float pxA = 1. / (iResolution.y * fl);
  float tS = 1e9, tE = -1.;
#define BOUND(S, K) { vec3 oc = ro - S.xyz; float R = S.w + K * .5 + gDisp + .03; float bj = dot(oc, rd); \
    float hj = bj * bj - (dot(oc, oc) - R * R); if (hj > 0. && S.w > 0.) { float sq = sqrt(hj); tS = min(tS, -bj - sq); tE = max(tE, -bj + sq); } }
  BOUND(gB[0], gK) BOUND(gB[1], gK) BOUND(gB[2], gK) BOUND(gB[3], gK)
  BOUND(gB[4], gK) BOUND(gB[5], gK) BOUND(gB[6], gK) BOUND(gB[7], gK)
  BOUND(gD[0], gDk) BOUND(gD[1], gDk) BOUND(gD[2], gDk) BOUND(gD[3], gDk)
  float t = max(tS, .1), tMin = t, minR = 1e9;
  // near-surface step factor from the field's Lipschitz bound (wobble + ripple add slope):
  // big steps between kicks, careful ones while the shockwave is strong
  float kNear = clamp(1. / (1. + gNz * 3.5 + gRipA * 13.), .6, .92);
  bool hit = false;
  if (tE > 0.) {
    for (int i = 0; i < 72; i++) {
      float d = map(ro + rd * t);
      float rr = d / t;
      if (rr < minR) { minR = rr; tMin = t; }
      if (d < pxA * t * .6) { hit = true; tMin = t; break; }
      t += d * (d > .1 ? .95 : kNear);
      if (t > tE) break;
    }
  }
  // edge coverage from the closest approach (analytic AA on silhouettes)
  float alpha = hit ? 1. : clamp(1. - minR / (pxA * 1.2), 0., 1.);

  vec3 pos = ro + rd * tMin;
  vec3 nrm = vec3(0., 1., 0.), refl = rd;
  if (alpha > 0.) {
    nrm = mapGrad(pos, rd);
    refl = reflect(rd, nrm);
  }
  // reflection footprint (derivatives in uniform control flow) -> env pre-filtering
  float fp = clamp(length(fwidth(refl)), 0., .6);

  vec3 col = background(ro, rd, uv, pxA) + bokeh(uv, camA, 0.);

  if (alpha > 0.) {
    float ndv = clamp(dot(nrm, -rd), 0., 1.);
    float fres = pow(1. - ndv, 5.);

    // surface tint: chrome .. thin-film oil slick
    float thick = .55 + .3 * sin(dot(pos, vec3(1.7, 2.3, -1.9)) + gTm * .6)
                + .2 * sin(dot(pos, vec3(-3.1, 1.3, 2.2)) - gTm * .9) + .25 * aBass;
    float ph = thick * (1.2 + 1.1 * ndv);
    vec3 rainbow = .5 + .5 * cos(TAU * (ph + vec3(0., .33, .67)));
    vec3 pf = secPal(ph * .7 + .15);
    pf /= max(max(pf.r, max(pf.g, pf.b)), .05);
    vec3 film = mix(rainbow, pf, .55) * 1.15;
    vec3 chromeT = mix(vec3(.9, .92, 1.), mix(vec3(1.), cC * 1.8, .12), .5);
    vec3 F0 = mix(chromeT * .95, film * .75, sy);
    vec3 F = F0 + (vec3(1.) - F0) * fres;

    // reflected ray: hits another blob (analytic sphere proxy, one more bounce) or the
    // studio. Same loop accumulates analytic sphere occlusion for the crevices.
    float tb = 1e9, occ = 0.;
    vec4 hb = vec4(0.);
#define REFL(S) { vec3 oc = pos - S.xyz; float r2 = S.w * S.w; float o2 = dot(oc, oc); \
    if (o2 > r2 * 1.35 && S.w > 0.) { occ += r2 / o2 * clamp(dot(nrm, -oc) * inversesqrt(o2), 0., 1.); \
      float bb = dot(oc, refl); float h2 = bb * bb - (o2 - r2); \
      if (h2 > 0. && bb < 0.) { float tt = -bb - sqrt(h2); if (tt < tb) { tb = tt; hb = S; } } } }
    REFL(gB[0]) REFL(gB[1]) REFL(gB[2]) REFL(gB[3]) REFL(gB[4]) REFL(gB[5]) REFL(gB[6]) REFL(gB[7])
    vec3 edir = refl, etint = vec3(1.);
    float efp = fp;
    if (tb < 1e8) {
      vec3 n2 = normalize(pos + refl * tb - hb.xyz);
      edir = reflect(refl, n2);
      etint = F0 * (.75 + .25 * pow(1. - clamp(dot(n2, -refl), 0., 1.), 5.));
      efp = fp * 2.5 + .02;
    }
    vec3 c = env(edir, efp) * etint * F;
    c *= 1. - clamp(occ * .9, 0., .7);

    // a whisper of coloured rim on the kick only (the env back light does the real rim)
    vec3 rimDir = normalize(vec3(-gCamF.z, .4, gCamF.x));
    float rim = pow(1. - ndv, 4.) * smoothstep(-.1, .8, dot(nrm, rimDir));
    c += mix(cB, cD, .3 + .3 * sin(gTm * .4)) * rim * (.04 + .12 * aKick * I) * (1. - .5 * sy);
    // the kick shockwave front catches the light as it sweeps across the surface
    float wf = length(pos - gRipC) - gRipF;
    c += mix(cB, cD, .35) * exp(-wf * wf * 160.) * min(gRipA * 30., 1.2) * ndv;
    // snare: droplets / thin necks sparkle a touch
    c += cD * aSnare * I * .2 * pow(1. - ndv, 2.);

    col = mix(col, c, alpha);
  }

  // near bokeh layer in front (shallow DOF foreground)
  col += bokeh(uv * .8 + .3, camA * 1.6, 1.) * .8;

  fragColor = vec4(max(col, 0.), 1.);
}
