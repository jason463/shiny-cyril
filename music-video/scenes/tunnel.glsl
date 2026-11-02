// =============================================================================
// TUNNEL — infinite neon corridor flythrough
//
// iParams (all 0..1, 0,0,0,0 = round tube, no twist, sparse frames, no data):
//   x  cross-section: 0 = round tube, 0.5 = hexagon, 1 = square/box corridor (continuous blend)
//   y  twist: 0 = none .. 1 = strong corkscrew (cross-section rotates along depth,
//      camera banks with it so the floor stays under you and the tunnel spirals ahead)
//   z  segment density: 0 = sparse frames (spacing 2.6) .. 1 = dense frames (spacing 0.9);
//      per-frame rim/halo brightness is lowered as density rises to keep dark gaps
//   w  data mode: 0 = off .. 1 = glowing glyph/data streams running along the walls
//      (light panels dim as w rises)
// iSeed offsets the curved camera path (each shot gets different bends).
//
// Audio: travel distance = f(aKickAcc) so the camera surges on every kick; every kick
// launches a hot ring pulse from the camera down the tunnel (lights walls + floor);
// claps fire a panel sequence + strobe alternate frames; hats flicker LED dots / data glyphs.
// Peak intensity: much faster travel, colour cycles every bar, iPrev radial motion streaks.
//
// Rendering: analytic plane-stepping (one exact ray/plane intersection per frame ring,
// front-to-back alpha compositing with pixel-footprint coverage => crisp AA edges),
// secant-refined wall hit, real (short) reflection trace on the glossy floor.
// =============================================================================

#define NPRI 60
#define NREF 12

const float FLOORH = .72;
float SP, TW, SHP, DATA, CAMZ, PA, ZP, PE, INT, LIPF, TH, FOGK, RIMI, CYCA, SEED, HALO;
vec3 HAZE, CP, CPU, FC0, FC1, FCG;

vec3 cyc3(float t) {
  t = fract(t) * 3.;
  if (t < 1.) return mix(cB, cC, smoothstep(0., 1., t));
  if (t < 2.) return mix(cC, cD, smoothstep(0., 1., t - 1.));
  return mix(cD, cB, smoothstep(0., 1., t - 2.));
}

// tunnel centre line: x = sum of 2 sines, y = sum of 2 sines (frequencies PW, offsets PO, amplitudes PAMP)
const vec4 PW = vec4(.1, .22, .12, .25), PAMP = vec4(4.4, 1.3, .9, .25);
vec4 PO;
vec4 PSC, PSS;          // cos / sin of the per-frame-plane phase step (SP * PW)
vec2 TWS;               // cos / sin of the per-plane twist step
vec2 path(float z) {
  vec4 sn = sin(z * PW + PO) * PAMP;
  return vec2(sn.x + sn.y, sn.z + sn.w);
}
float ANG(float z) { return TW * z; }

float shape0(vec2 q) {
  vec2 a = abs(q);
  float h = max(a.y, dot(a, vec2(.8660254, .5))) - .94;
  if (SHP < .5) return mix(length(q) - 1., h, SHP * 2.);
  return mix(h, max(a.x * .8, a.y) - .9, SHP * 2. - 1.);
}
float shapeD(vec2 q) { return max(shape0(q), -q.y - FLOORH); }

// tunnel-local (twisted) cross-section coords where the ray crosses plane z
vec2 qAt(vec3 ro, vec3 rd, float z) {
  vec2 xy = ro.xy + rd.xy * ((z - ro.z) / rd.z) - path(z);
  if (TW == 0.) return xy;
  return rot(-ANG(z)) * xy;
}

// anti-aliased line: dist >= 0, half width hw, pixel footprint w (energy-preserving when thin)
float lineAA(float dist, float hw, float w) {
  w = max(w, 1e-5);
  return (1. - smoothstep(hw - w, hw + w, dist)) * min(1., hw / w);
}

vec3 frameCol(float k) {
  float m = mod(k, 4.);
  return m < .5 ? FCG : (m < 2.5 ? FC0 : FC1);          // every 4th frame = hot "gate"
}
float frameBright(float k) {
  float b = RIMI;
  if (mod(k, 4.) < .5) b *= 1.3;
  float alt = mod(k + aBeatCount, 2.);                  // clap strobe on alternate frames
  b *= 1. + aSnare * (alt < .5 ? 2.4 : .25) * (.15 + .85 * INT * sqrt(INT));
  return b;
}

// front face of frame k (d in [-TH, 0]); LED dots are added once per pixel in ledDots()
vec3 shadeFace(float d, float w, vec3 fc, float fb) {
  float e = d + TH;                                     // 0 at inner rim .. TH at wall
  return cA * .06 + fc * .01 + fc * fb * (lineAA(e, .022, w) + .22 * exp(-e / .03))
       + mix(cC, fc, .3) * .5 * lineAA(abs(e - (TH - .035)), .006, w);
}
// LED dots on a frame face: flicker on hats
vec3 ledDots(vec2 q, float e, float k, float w) {
  float a = atan(q.y, q.x);
  float cell = a / TAU * 40.;
  float id = floor(cell);
  float along = (fract(cell) - .5) * TAU * length(q) / 40.;
  float dd = length(vec2(along, e - TH * .58));
  float on = step(.5, hash12(vec2(id + k * 7.31, floor(aBeatCount) * 3.17)));
  float led = (1. - smoothstep(.009 - w, .009 + w, dd)) * (1. - smoothstep(.006, .022, w));
  return mix(cD, vec3(1.), .4) * led * (.06 + aHat * on * 4.);
}

float fogF(float t) { return exp(-t * t * FOGK); }
vec3 fogMix(vec3 c, float t) { float f = fogF(t); return c * f + HAZE * (1. - f); }
vec3 fogMixF(vec3 c, float f) { return c * f + HAZE * (1. - f); }

struct Hit { vec3 acc; float T; float t; float z; vec2 q; float hit; vec4 face; vec2 faceW; };

// Lean loop (SwiftShader executes branch bodies regardless, so heavy work is done once after it):
// per frame plane: 1 ray/plane intersection + shape eval, lip + face coverage, halo.
Hit march(vec3 ro, vec3 rd, int N, float wMul) {
  Hit h; h.acc = vec3(0.); h.T = 1.; h.t = 0.; h.z = ro.z; h.q = vec2(0.); h.hit = 0.;
  h.face = vec4(0.); h.faceW = vec2(0.);
  float zPrev = ro.z;
  float dPrev = min(shapeD(qAt(ro, rd, ro.z)), -1e-3);
  float k = floor(ro.z / SP) + 1.;
  float t = 0., z = ro.z, d = dPrev, TP = 1.;
  // incremental sinusoids: plane z_k = k*SP, advance phases by a fixed rotation per plane (no trig in loop)
  vec4 ph = k * SP * PW + PO;
  vec4 S = sin(ph), C = cos(ph);
  float ta0 = -TW * k * SP;
  vec2 tw = vec2(cos(ta0), sin(ta0));
  for (int i = 0; i < 64; i++) {
    if (i >= N || h.T < .02) break;
    z = k * SP;
    t = (z - ro.z) / rd.z;
    vec4 pa = S * PAMP;
    vec2 xy = ro.xy + rd.xy * t - vec2(pa.x + pa.y, pa.z + pa.w);
    vec2 q = vec2(tw.x * xy.x - tw.y * xy.y, tw.y * xy.x + tw.x * xy.y);
    vec4 S2 = S * PSC + C * PSS; C = C * PSC - S * PSS; S = S2;
    tw = vec2(tw.x * TWS.x + tw.y * TWS.y, tw.y * TWS.x - tw.x * TWS.y);
    d = shapeD(q);
    float w = t * PA * wMul + .0015;
    float fog = fogF(t);
    if (fog < .012) break;                                // fully hazed: stop

    // inner lip (thickness) of the previous frame
    float dl = mix(dPrev, d, LIPF);
    float covL = (i > 0 && dPrev < -TH) ? smoothstep(-TH - w, -TH + w, dl) : 0.;
    float sl = clamp((-TH - dPrev) / max(dl - dPrev, 1e-4), 0., 1.);
    vec3 fcl = frameCol(k - 1.); float fbl = frameBright(k - 1.);
    vec3 cl = cA * .05 + fcl * fbl * .22 * exp(-sl * 7.) + mix(cC, fcl, .4) * .35 * exp(-abs(sl - .9) * 22.);
    h.acc += h.T * covL * fogMixF(cl, fog);
    h.T *= 1. - covL;

    if (d > 0.) { h.hit = 1.; break; }                    // ray left the tube between zPrev and z

    // front face of frame k + in-air halo around its neon rim
    float cov = smoothstep(-TH - w, -TH + w, d);
    vec3 fc = frameCol(k); float fb = frameBright(k);
    float wt = h.T * cov * fog;
    if (h.faceW.y < .01 && wt > .01) { h.face = vec4(q, d + TH, k); h.faceW = vec2(w, wt); }
    h.acc += h.T * cov * fogMixF(shadeFace(d, w, fc, fb), fog);
    h.T *= 1. - cov;
    h.acc += h.T * fog * fc * fb * HALO * exp(-max(-TH - d, 0.) / .09);
    if (z < ZP) TP = h.T;
    zPrev = z; dPrev = d; k += 1.;
  }
  float zEnd = z;
  if (h.hit > .5) {                                       // secant-refined wall hit
    float zw = mix(zPrev, z, dPrev / (dPrev - d));
    float dm = shapeD(qAt(ro, rd, zw));
    zw = dm > 0. ? mix(zPrev, zw, dPrev / (dPrev - dm)) : mix(zw, z, dm / (dm - d));
    h.z = zw; h.q = qAt(ro, rd, zw); t = (zw - ro.z) / rd.z;
    zEnd = zw;
  }
  h.t = t;
  // kick pulse: light ring hugging the wall (additive, occluded by frames in front of it)
  float tp = (ZP - ro.z) / rd.z;
  float dp = shapeD(qAt(ro, rd, ZP));
  float wp = tp * PA * wMul + .0015;
  float e = -dp - .05;
  float vis = step(ro.z, ZP) * step(ZP, zEnd) * step(dp, 0.);
  h.acc += vis * TP * fogF(tp) * PE * CPU * (lineAA(abs(e), .02, wp) * 5. + exp(-abs(e) / .1) * smoothstep(.2, 3., ZP - CAMZ));
  return h;
}

// cheap wall light (spill from neighbouring frames, kick pulse band, chase) — also used for reflections
vec3 wallGlow(float z) {
  float kk = floor(z / SP), u = z / SP - kk;
  vec3 col = cA * .03;
  col += frameCol(kk) * frameBright(kk) * .05 * exp(-max(u - LIPF, 0.) * SP * 3.);
  col += frameCol(kk + 1.) * frameBright(kk + 1.) * .035 * exp(-(1. - u) * SP * 4.);
  col += CPU * PE * 1.3 * exp(-abs(z - ZP) * 3.) * (.35 + .65 * smoothstep(.5, 4., ZP - CAMZ));
  return col;
}

vec3 shadeWall(float z, vec2 q, float t, vec3 rd, out vec3 nW, out float isFloor) {
  float s0 = shape0(q);
  float fl = -q.y - FLOORH;
  isFloor = step(s0, fl);
  vec2 g = vec2(0., -1.);
  if (isFloor < .5) {
    g = normalize(vec2(shape0(q + vec2(.004, 0.)) - s0, shape0(q + vec2(0., .004)) - s0));
  }
  nW = vec3(rot(ANG(z)) * (-g), 0.);                     // inward normal (world)
  float cosI = max(abs(dot(rd, nW)), .03);
  float wz = t * PA / cosI;                              // footprint along z
  float wp = t * PA;                                     // footprint across
  float kk = floor(z / SP), u = z / SP - kk;

  vec3 col = wallGlow(z);

  // travelling chase sequence (whole rings light up, moving away)
  float cph = fract(kk * .0625 - iTime * mix(.25, .9, INT)) - .5;
  float chase = exp(-cph * cph * 180.);

  if (isFloor > .5) {
    float x = q.x;
    col += cA * .02;
    float dash = .5 + .5 * cos((z * 1.2 - iTime * 3.) * TAU);
    dash = mix(.5, dash, 1. - smoothstep(.05, .3, wz));
    col += cD * 1.2 * lineAA(abs(x), .02, wp) * (.25 + .75 * chase + .4 * dash);
    col += cC * .25 * lineAA(abs(u - LIPF * .5) * SP, .01, wz) * (1. - smoothstep(.04, .2, wz));
    return col;
  }

  // wall / ceiling light panels
  float a = atan(q.y, q.x);
  float NS = 12.;
  float v = a / TAU * NS + .5;
  float vi = floor(v), fv = fract(v);
  float uw = wz / SP + .001;
  float vw = wp * NS / TAU + .001;
  float pu = (u - LIPF) / (1. - LIPF);
  // panel rect in world units (z, perimeter)
  float segL = SP * (1. - LIPF), secL = TAU / NS;
  vec2 pr = vec2((pu - .5) * segL, (fv - .5) * secL);
  vec2 hs = vec2(.5 * segL - .09, .5 * secL - .06);
  vec2 ed = abs(pr) - hs;
  float wEdge = ed.x > ed.y ? wz : wp;
  float sd = length(max(ed, 0.)) + min(max(ed.x, ed.y), 0.);
  float mask = (1. - smoothstep(-wEdge, wEdge, sd));
  float outline = lineAA(abs(sd), .007, wEdge * 1.5);
  float ph = hash12(vec2(kk, vi));
  float lit = step(.78, ph) * (.6 + .4 * sin(iTime * .9 + ph * 40.));
  float cI = mod(aBeatCount, 3.);
  float pat;
  if (cI < .5) pat = step(fract(vi / NS + kk * .083), .25);
  else if (cI < 1.5) pat = step(mod(kk, 2.), .5);
  else pat = step(.62, hash12(vec2(kk * 1.3 + aBeatCount, vi)));
  float sideFade = smoothstep(-.35, .2, sin(a));        // keep fills mostly on the upper walls / ceiling
  float fillP = mask * (.35 + .65 * smoothstep(0., .18, -sd)) * (.75 + .25 * pu);   // light-box falloff
  vec3 pc = CP * (fillP * (lit * .10 * sideFade + chase * .12) + outline * (.25 + chase * 1.4 + lit * .4))
          + mix(cD, CPU, .5) * aSnare * pat * (fillP * 1.1 + outline * 2.5) * (.25 + .75 * INT);
  // glossy dark panel: faint sheen gradient
  col += cA * .05 * mask * (1. - pu);
  col += pc * (1. - .65 * DATA);

  // data mode: thin glyph tickers streaming along the walls
  if (DATA > .001) {
    float nl = 2.;
    float lv = fv * nl, li = floor(lv), lf = fract(lv);
    float lane = vi * nl + li + 17.;
    float lh = hash11(lane * 1.7 + 3.1);
    float act = step(.3, lh);
    float spd = (3. + 9. * fract(lh * 7.)) * (fract(lh * 13.) > .3 ? 1. : -.5);
    float cz = (z + iTime * spd) / .15;
    float ci = floor(cz), cf = fract(cz);
    float xw = (lf - .5) * secL / nl;                    // across-lane position (world)
    float hw = .045;
    float bx = floor(clamp(xw / hw * .5 + .5, 0., .999) * 3.), by = floor(cf * 5.);
    float inside = 1. - smoothstep(hw - wp, hw + wp, abs(xw));
    float present = step(.3, hash12(vec2(ci, lane)));
    float bit = step(.5, hash13(vec3(ci, lane, bx + by * 3.))) * step(cf, .78);
    float detail = 1. - smoothstep(.008, .03, wz);
    float glyph = mix(.3, bit, detail) * present * inside;
    float head = pow(fract(ci * .037 + iTime * .6 + lh * 7.), 8.);
    float rail = lineAA(abs(abs(xw) - hw - .022), .0035, wp);
    float hatF = 1. + aHat * 2.5 * step(.6, hash12(vec2(ci, lane + floor(aBeatCount))));
    vec3 dc = mix(cC, cB, step(.6, fract(lh * 3.1)));
    col += DATA * act * dc * (glyph * (.18 + 3. * head) * hatF + rail * .3);
  }
  return col;
}

vec3 farGlow(vec3 rd) { return HAZE; }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  INT = clamp(iIntensity, 0., 1.);
  SEED = iSeed;
  SHP = iParams.x; TW = iParams.y * .16; SP = mix(2.6, .9, iParams.z); DATA = iParams.w;
  float ps = SEED * 37.;
  PO = vec4(ps, ps * 1.7 + 1., ps * 2.3, ps * .7);
  PSC = cos(SP * PW); PSS = sin(SP * PW);
  TWS = vec2(cos(TW * SP), sin(TW * SP));
  LIPF = .28; TH = .17;
  FOGK = mix(.0045, .0028, INT);
  RIMI = mix(1.1, 2.5, INT) * mix(1., .65, iParams.z);
  HALO = .035 * mix(1., .3, iParams.z);
  CYCA = smoothstep(.6, .95, INT);
  HAZE = (mix(cC, cB, .45) * .22 + cA * .4) * mix(.6, 1., INT) * (.85 + .3 * aBass);
  CP = cC; CPU = mix(cD, vec3(1.), .25);
  // frame colours: static key colour when calm, cycling through the section palette every bar at peak
  float cyT = aBarCount * .3333 + smoothstep(0., .12, aBarPhase) * .3333;
  FC0 = mix(cB, cyc3(cyT), CYCA);
  FC1 = mix(cB, cyc3(cyT + .12), CYCA);
  FCG = mix(mix(cB, cD, .55), cyc3(cyT + .45), CYCA * .8);

  // travel: shot-local kick integral so the speed multiplier can depend on intensity
  float shotStart = iTime - iLocal;
  float kLoc = aKickAcc - .285 * shotStart;
  float i2 = INT * INT;
  CAMZ = SEED * 731. + shotStart * 3. + iLocal * mix(.8, 7., i2) + kLoc * mix(3., 38., i2);

  // kick pulse launched from the camera into the depth
  ZP = CAMZ - .3 + 46. * pow(aBeatPhase, 1.5);
  PE = sqrt(aKick) * mix(.6, 1.4, INT);

  // camera follows the curved path, banks with curvature + twist
  vec2 off = rot(ANG(CAMZ)) * vec2(0., -.1);
  vec3 ro = vec3(path(CAMZ) + off, CAMZ);
  float la = 2.5;
  vec3 ta = vec3(path(CAMZ + la) + rot(ANG(CAMZ + la)) * vec2(0., -.12), CAMZ + la);
  float roll = -ANG(CAMZ) - (path(CAMZ + 3.).x - 2. * path(CAMZ).x + path(CAMZ - 3.).x) * .5;
  float fl = mix(1.05, .85, INT);
  PA = 1. / (iResolution.y * fl);
  vec2 uv = (fragCoord - .5 * iResolution) / iResolution.y;
  vec3 rd = camRay(ro, ta, uv, fl, roll);

  Hit h = march(ro, rd, NPRI, 1.);
  vec3 col = h.acc + h.faceW.y * ledDots(h.face.xy, h.face.z, h.face.w, h.faceW.x);
  // NOTE: SwiftShader runs loops inside untaken branches anyway, so the reflection march is
  // called unconditionally with an iteration budget of 0 for every non-floor pixel.
  vec3 nW; float isF;
  vec3 s = shadeWall(h.z, h.q, h.t, rd, nW, isF);
  float doRefl = h.hit * isF * step(.03, fogF(h.t));
  vec3 P = ro + rd * h.t;
  vec3 n = nW;
  vec2 rp = vec2(P.x * 2.5, P.z * .7);
  n.xz += (vec2(vnoise(rp), vnoise(rp + 9.3)) - .5) * .05;
  vec3 rr = reflect(rd, normalize(n));
  rr.z = max(rr.z, .05); rr = normalize(rr);
  Hit r = march(P + nW * .01, rr, doRefl > .5 ? NREF : 0, 1.8);
  vec3 rc = r.acc + r.T * mix(farGlow(rr), fogMix(wallGlow(r.z), r.t), r.hit);
  float F = .25 + .65 * pow(1. - abs(dot(rd, nW)), 5.);
  s += rc * F * doRefl;
  col += h.T * mix(farGlow(rd), fogMix(s, h.t), h.hit);

  // peak: radial motion streaks via feedback toward the vanishing point
  float sAmt = smoothstep(.55, 1., INT);
  if (sAmt > .001) {
    vec3 fw = normalize(ta - ro);
    vec3 rgt = normalize(cross(fw, vec3(sin(roll), cos(roll), 0.)));
    vec3 up = cross(rgt, fw);
    vec3 fp = vec3(path(CAMZ + 22.), CAMZ + 22.) - ro;
    vec2 vps = vec2(dot(fp, rgt), dot(fp, up)) / dot(fp, fw) * fl;
    vec2 vp = clamp(vps * iResolution.y / iResolution + .5, .1, .9);
    vec2 p = fragCoord / iResolution;
    vec2 pp = vp + (p - vp) * (.955 - .035 * aKick);
    vec2 dv = (p - vp) * (.03 + .025 * aKick);
    vec3 prev = max(texture(iPrev, pp).rgb, texture(iPrev, pp - dv).rgb * .85);
    col = max(col, max(prev - .4, 0.) * sAmt * mix(.58, .45, iParams.z));
  }
  fragColor = vec4(col, 1.);
}
