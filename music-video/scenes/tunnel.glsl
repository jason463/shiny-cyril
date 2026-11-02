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
// launches a hot ring pulse from just ahead of the camera into the depth (it lights a band
// of wall/floor as it races away); claps flash a rotating panel pattern + strobe alternate
// frames; hats flicker LED dots / data glyphs; bass breathes the light at the tunnel's end.
// Peak intensity: much faster travel, colour cycles every bar, rims leave radial light-streak
// trails toward the vanishing point (length = distance travelled during the shutter, so they
// stretch on every kick), short iPrev zoom-blur afterglow on highlights.
//
// Look: a "light at the end of the tunnel" — the haze in-scatters a glow toward the far point
// of the path, so distant frames dissolve into it and it glows around bends.
//
// Rendering: analytic plane-stepping (one exact ray/plane intersection per frame ring,
// front-to-back alpha compositing with pixel-footprint coverage => crisp AA edges),
// secant-refined wall hit, real (short) reflection trace on the glossy floor. Analytic motion
// blur: rim coverage, wall panel edges and runway dashes are widened by the shutter travel BL
// (no wagon-wheel stutter at insane speed).
// =============================================================================

#define NPRI 60
#define NREF 12

const float FLOORH = .72;
float SP, TW, SHP, DATA, CAMZ, PA, ZP, PE, INT, LIPF, TH, FOGK, RIMI, CYCA, SEED, HALO, BL, ZPV, STRK, TRL;
vec3 HAZE, HAZE0, CP, CPU, FC0, FC1, FCG, GLW, VPD;

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

// frame k: (colour, rim brightness). Every 4th frame is a hotter "gate"; claps strobe alternate frames.
float CLP0, CLP1;
vec4 frameCB(float k) {
  float m4 = mod(k, 4.);
  vec3 c = m4 < .5 ? FCG : (m4 < 2.5 ? FC0 : FC1);
  return vec4(c, RIMI * (m4 < .5 ? 1.3 : 1.) * (mod(k + aBeatCount, 2.) < .5 ? CLP0 : CLP1));
}

// front face of frame k (d in [-TH, 0]); LED dots are added once per pixel in ledDots().
// m = small physical motion blur (d units) applied to the face's line details.
vec3 shadeFace(float d, float w, float m, vec3 fc, float fb) {
  float e = max(d + TH, 0.);                            // 0 at inner rim .. TH at wall
  float wm = w + m * .5;
  return cA * .06 + fc * .01 + fc * fb * (lineAA(e, .022, wm) + .22 * exp(-e / .03))
       + mix(cC, fc, .3) * .5 * lineAA(abs(e - (TH - .035)), .006, wm);
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
  vec4 fP = frameCB(k - 1.);                              // carried from plane to plane
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
    if (fog < .025) break;                                // (nearly) fully hazed: stop

    // motion: over the shutter the camera moved BL forward, i.e. this plane was BL further away ->
    // its edges swept radially inward by m (d units) = (dd/dz along the ray) * BL.
    // mb = small physical blur (keeps the neon crisp, kills wagon-wheel stutter);
    // the full sweep m drives a stylised light-streak trail behind each rim (see below).
    float m = min(max(d - dPrev, 0.) / max(z - zPrev, .05) * BL, 1.2);
    float mb = min(m * .3, .07);

    // inner lip (thickness) of the previous frame
    float dl = mix(dPrev, d, LIPF);
    float covL = (i > 0 && dPrev < -TH) ? clamp((dl + TH + mb + w) / (mb + 2. * w), 0., 1.) : 0.;
    float sl = clamp((-TH - dPrev) / max(dl - dPrev, 1e-4), 0., 1.);
    vec3 cl = cA * .05 + fP.rgb * fP.a * .12 * exp(-sl * 9.) + mix(cC, fP.rgb, .4) * .35 * exp(-abs(sl - .9) * 22.);
    h.acc += h.T * covL * fogMixF(cl, fog);
    h.T *= 1. - covL;

    if (d > 0.) { h.hit = 1.; break; }                    // ray left the tube between zPrev and z

    // front face of frame k + in-air halo around its neon rim
    float cov = clamp((d + TH + mb + w) / (mb + 2. * w), 0., 1.);
    vec4 fCur = frameCB(k); vec3 fc = fCur.rgb; float fb = fCur.a;
    float wt = h.T * cov * fog / (1. + m * 30.);          // LED dots vanish when smeared
    if (h.faceW.y < .01 && wt > .01) { h.face = vec4(q, d + TH, k); h.faceW = vec2(w, wt); }
    h.acc += h.T * cov * fogMixF(shadeFace(d, w, mb, fc, fb), fog);
    h.T *= 1. - cov;
    // in-air halo + speed trail: the rim's light streaks radially toward the vanishing point
    float x = clamp(1. + (d + TH) / max(m, 1e-3), 0., 1.);
    h.acc += h.T * fog * fc * fb * (HALO * exp(-max(-TH - d, 0.) / .09) + TRL * STRK * x * x * x);
    if (z < ZP) TP = h.T;
    zPrev = z; dPrev = d; k += 1.; fP = fCur;
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
  // evaluated at mid-shutter, smeared radially by its own (fast) motion over the shutter
  float zpm = ZP - ZPV * .5;
  float tp = (zpm - ro.z) / rd.z;
  float dp = shapeD(qAt(ro, rd, zpm));
  float mp = (dp + 1.) / max(tp, .3) * ZPV;               // ~ radial sweep over the shutter
  float wp = tp * PA * wMul + .0015 + mp * .15;
  float e = -dp - .05;
  float vis = step(ro.z, zpm) * step(zpm, zEnd) * step(dp, 0.) * smoothstep(1.5, 5., zpm - CAMZ);
  h.acc += vis * TP * fogF(tp) * PE * CPU * (lineAA(abs(e), .02, wp) * 5. + .5 * exp(-abs(e) / .035));
  return h;
}

// cheap wall light (spill from neighbouring frames, kick pulse band, chase) — also used for reflections
vec3 wallGlow(float z) {
  float kk = floor(z / SP), u = z / SP - kk;
  vec3 col = cA * .03;
  vec4 f0 = frameCB(kk), f1 = frameCB(kk + 1.);
  col += f0.rgb * f0.a * .045 * exp(-max(u - LIPF, 0.) * SP * 4.5);
  col += f1.rgb * f1.a * .035 * exp(-(1. - u) * SP * 4.);
  col += CPU * PE * exp(-abs(z - ZP) * 3.) * (.06 + .94 * smoothstep(1.5, 6., ZP - CAMZ));
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
  float wz = t * PA / cosI + BL * .5;                    // footprint along z (+ motion blur)
  float wp = t * PA;                                     // footprint across
  float kk = floor(z / SP), u = z / SP - kk;

  vec3 col = wallGlow(z);

  // travelling chase sequence (whole rings light up, moving away)
  float cph = fract(kk * .0625 - iTime * mix(.25, .9, INT)) - .5;
  float chase = exp(-cph * cph * 180.);

  if (isFloor > .5) {
    float x = q.x;
    col += cA * .02;
    // runway lights: discrete dashes fixed in the world (rush past = speed cue, blur into a
    // continuous streak at high speed via the motion-blurred footprint wz) over a faint guide line
    float dz = abs(fract(z / 1.3) - .5) * 1.3;
    float dash = lineAA(dz, .2, wz);
    float ln = lineAA(abs(x), .018, wp);
    col += cD * ln * (.12 + 1.9 * dash * (.45 + .8 * chase + .5 * PE));
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
  vec3 pc = CP * (fillP * (lit * .10 * sideFade + chase * .07) + outline * (.25 + chase * 1.4 + lit * .4))
          + mix(cD, CPU, .5) * aSnare * pat * (fillP * 1.1 * smoothstep(1.5, 6., t) + outline * 2.5) * (.25 + .75 * INT);
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
    float detail = 1. - smoothstep(.01, .04, wz - BL * .35);   // keep glyph bits readable at speed
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
// light at the end of the tunnel: haze in-scatter brightens toward the far point of the path,
// so distant frames dissolve into it (backlit silhouettes) and it glows around bends
float vpGlow(vec3 dir) { float c = max(1. - dot(dir, VPD), 0.); return exp(-c * 140.) + .12 * exp(-c * 14.); }

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
  RIMI = mix(1.1, 2.1, INT) * mix(1., .65, iParams.z);
  HALO = .035 * mix(1., .3, iParams.z);
  CYCA = smoothstep(.6, .95, INT);
  float clw = aSnare * (.15 + .85 * INT * sqrt(INT));
  CLP0 = 1. + 1.6 * clw; CLP1 = 1. + .1 * clw;
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
  float spdM = mix(1., .8, iParams.z);
  float vDrift = mix(.8, 7., i2) * spdM, vKick = mix(3., 34., i2) * spdM;
  CAMZ = SEED * 731. + shotStart * 3. + iLocal * vDrift + kLoc * vKick;
  float vel = vDrift + aKick * vKick;                    // dCAMZ/dt  (d aKickAcc/dt = aKick)
  BL = vel / 30. * .55;                                   // distance travelled during the shutter

  // kick pulse launched just ahead of the camera into the depth
  float bpP = aBeatPhase;
  ZP = CAMZ + .5 + 34. * bpP * sqrt(bpP);
  ZPV = (vel + 51. * sqrt(bpP) / .49) / 30. * .55;
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

  VPD = normalize(vec3(path(CAMZ + 24.), CAMZ + 24.) - ro);
  GLW = mix(cB, vec3(1.), .25) * mix(.25, 1.1, INT) * (.8 + .4 * aBass);
  HAZE0 = HAZE;
  vec3 hazeP = HAZE0 + GLW * vpGlow(rd);

  // speed-streak mask: thin random radial lines around the vanishing point (screen space, AA'd)
  TRL = .4 * smoothstep(.45, 1., INT);
  STRK = 0.;
  if (TRL > 0.) {
    vec3 fw0 = normalize(ta - ro);
    vec3 rg0 = normalize(cross(fw0, vec3(sin(roll), cos(roll), 0.)));
    vec3 up0 = cross(rg0, fw0);
    vec2 vpu = vec2(dot(VPD, rg0), dot(VPD, up0)) / dot(VPD, fw0) * fl;
    vec2 dv = uv - vpu;
    float an = (atan(dv.y, dv.x) / TAU + .5) * 160.;
    float sid = floor(an), sf = fract(an);
    float h0 = hash11(mod(sid, 160.) + SEED * 97.), h1 = hash11(mod(sid + 1., 160.) + SEED * 97.);
    float secPx = length(dv) * TAU / 160. * iResolution.y;             // sector width in pixels
    float ln = mix(h0, h1, smoothstep(0., 1., sf));
    ln = pow(ln, 6.) * 2.5;
    STRK = mix(.35, ln, smoothstep(1.5, 5., secPx));
  }
  HAZE = hazeP;

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
  HAZE = HAZE0 + GLW * .7 * vpGlow(rr);
  Hit r = march(P + nW * .01, rr, doRefl > .5 ? NREF : 0, 1.8);
  vec3 rc = r.acc + r.T * mix(farGlow(rr), fogMix(wallGlow(r.z), r.t), r.hit);
  HAZE = hazeP;
  float F = .25 + .65 * pow(1. - abs(dot(rd, nW)), 5.);
  s += rc * F * doRefl;
  col += h.T * mix(farGlow(rd), fogMix(s, h.t), h.hit);

  // peak: radial motion streaks via feedback toward the vanishing point
  float sAmt = smoothstep(.55, 1., INT);
  if (sAmt > .001) {
    vec3 fw = normalize(ta - ro);
    vec3 rgt = normalize(cross(fw, vec3(sin(roll), cos(roll), 0.)));
    vec3 up = cross(rgt, fw);
    vec2 vps = vec2(dot(VPD, rgt), dot(VPD, up)) / dot(VPD, fw) * fl;
    vec2 vp = clamp(vps * iResolution.y / iResolution + .5, .1, .9);
    vec2 p = fragCoord / iResolution;
    // short zoom-blur of the previous frame (3 averaged taps along the radial line): a smooth
    // afterglow that accumulates into streaks for the slow far rings; the fast near rings get the
    // analytic streak trails instead (long feedback zooms produced discrete ghost copies)
    float z0 = .99, dz = .008 + .005 * aKick;
    vec3 prev = (texture(iPrev, vp + (p - vp) * z0).rgb + texture(iPrev, vp + (p - vp) * (z0 - dz)).rgb
               + texture(iPrev, vp + (p - vp) * (z0 - 2. * dz)).rgb) * .3333;
    // hue-preserving highlight threshold (subtracting per channel turned pink trails red)
    float lum = max(prev.r, max(prev.g, prev.b));
    prev *= max(lum - .35, 0.) / max(lum, 1e-3);
    col = max(col, prev * sAmt * mix(.62, .5, iParams.z));
  }
  fragColor = vec4(col, 1.);
}
