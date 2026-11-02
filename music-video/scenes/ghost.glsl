// =============================================================================
//  GHOST — "U WEREN'T HERE"
//  A lone human figure made of light (glowing outline + scanline / particle
//  interior) standing on a wet mirror floor in an empty dark hall under a single
//  overhead spotlight, haze, dust / rain. It frays into ascending sparks. In void
//  mode the figure is the *absence*: a silhouette-shaped hole cut out of glowing
//  fog with light bursting around it (eclipse) — the missing person.
//
//  iParams (all 0..1, 0,0,0,0 = crisp light figure, full body, light dust):
//    x  dissolve : 0 = crisp light figure (feet fade into the floor)
//                  .. 1 = gone, only rising sparks. The burn front climbs from the
//                  feet to the head; the raised hand is the last thing to go, and a
//                  faint afterimage outline lingers until ~0.9. Animate it
//                  (0.85 -> 0.3 assembles the figure from sparks, 0.3 -> 1 dissolves it).
//    y  framing  : 0 = full body centred, wet floor + reflection, spotlight cone
//                  0.5 = full body (knees-up when letterboxed) on a rule-of-thirds
//                  line, left/right picked by iSeed
//                  1 = close-up head, shoulders and the raised hand
//                  All framings keep the raised hand inside a 0.24 letterbox and
//                  have a slow dolly-in + seed-phased drift.
//    z  weather  : 0 = dust motes glinting in the spotlight
//                  .. 1 = heavy rain streaks + rain rings on the floor (rain from ~0.3)
//    w  mode     : 0 = figure made of light .. 1 = void: silhouette-shaped dark hole
//                  in glowing fog, light-bleed rim, volumetric shafts bursting around
//                  it (dissolved parts leave a fading shadow, the shafts keep the
//                  absent body's shape). Blends continuously; ~0.5 = a glowing outline
//                  with a dark core in front of the light burst.
//  Intensity: calm = dark hall, one spotlight, slow hologram scan. Above ~0.55 a
//  laser fan (cB with cD accents) rises from behind the figure's feet (cover-art
//  look; reflected in the floor), pattern changes every bar and punches on kicks;
//  above ~0.75 the figure slice-glitches on claps / kicks.
//
//  Audio: aEnergy/aRms = breathing (brightness, shoulder lift, halo, fog glow),
//  aMid = interior scanline glow, hologram scan band + chest core (vocals carry
//  the breakdown), aHat = subtle hologram band flicker, aHigh = spark emission,
//  aKick = chest core beat, floor shock-ring, light-pool pulse, rim flare, laser
//  punch, an expanding echo outline of the figure (intensity > .4) and ray flare;
//  aSnare = ray flare, laser flash + burn-edge flash; aBass = distant horizon glow.
// =============================================================================

float gT, gII, gPx, gFx, gTx, gH, gD, gS, gSNs;
float gEcho, gBeamV, gVoidGain, gPulse, gEmbSp, gJit, gDiss, gMode, gRain, gGlitch, gFig, gEmber, gHatF, gLift, gLaser, gScanY;
mat2  gArmRot, gHeadRot;
vec3  gB, gC, gRimCol, gBeamCol, gPoolCol;

float sq(float x) { return x * x; }

// ---------------------------------------------------------------- 2D SDF bits
float sdTCap(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);
  return length(pa - ba * h) - mix(ra, rb, h);
}
float sdEll(vec2 p, vec2 r) {
  float k0 = length(p / r), k1 = length(p / (r * r));
  return k0 * (k0 - 1.) / max(k1, 1e-5);
}
float sdTrap(vec2 p, float r1, float r2, float he) {   // r1 bottom half-width, r2 top
  vec2 k1 = vec2(r2, he), k2 = vec2(r2 - r1, 2. * he);
  p.x = abs(p.x);
  vec2 ca = vec2(p.x - min(p.x, (p.y < 0.) ? r1 : r2), abs(p.y) - he);
  vec2 cb = p - k1 + k2 * clamp(dot(k1 - p, k2) / dot(k2, k2), 0., 1.);
  float s = (cb.x < 0. && ca.y < 0.) ? -1. : 1.;
  return s * sqrt(min(dot(ca, ca), dot(cb, cb)));
}

// the figure: feet at y=0, centred on x=0, ~1.75 tall, right arm raised (hand ~2.15)
float figSDF(vec2 p) {
  float bd = sdBox2(p - vec2(0.06, 1.08), vec2(0.42, 1.12));
  if (bd > 0.5) return bd;
  float lf = gLift;
  // head (slightly tilted, narrower jaw) + neck
  vec2 hp = gHeadRot * (p - vec2(0.0, 1.635 + lf * 0.7));
  float d = smin(sdEll(hp, vec2(0.082, 0.104)), sdEll(hp - vec2(0., -0.045), vec2(0.06, 0.07)), 0.03);
  d = smin(d, sdTCap(p, vec2(0., 1.45 + lf), vec2(0., 1.56 + lf * 0.7), 0.043, 0.035), 0.02);
  // sloping shoulders (trapezius -> deltoid), torso tapering to the waist, hips
  float sh = min(sdTCap(p, vec2(-0.03, 1.47 + lf), vec2(-0.172, 1.398 + lf), 0.035, 0.055),
                 sdTCap(p, vec2(0.03, 1.47 + lf), vec2(0.175, 1.402 + lf), 0.035, 0.055));
  float to = sdTrap(p - vec2(0., 1.195), 0.115, 0.165, 0.215) - 0.03;
  d = smin(d, smin(sh, to, 0.05), 0.03);
  d = smin(d, sdTrap(p - vec2(0.008, 0.9), 0.15, 0.12, 0.085) - 0.02, 0.06);
  // legs (weight on the left leg, right knee relaxed)
  float lg = sdTCap(p, vec2(-0.07, 0.86), vec2(-0.08, 0.47), 0.066, 0.046);
  lg = min(lg, sdTCap(p, vec2(-0.08, 0.47), vec2(-0.072, 0.03), 0.045, 0.028));
  lg = min(lg, sdTCap(p, vec2(0.082, 0.86), vec2(0.1, 0.48), 0.066, 0.046));
  lg = min(lg, sdTCap(p, vec2(0.1, 0.48), vec2(0.118, 0.04), 0.045, 0.028));
  d = smin(d, lg, 0.035);
  // left arm hanging close to the body
  float la = sdTCap(p, vec2(-0.182, 1.36 + lf), vec2(-0.215, 1.085), 0.046, 0.037);
  la = min(la, sdTCap(p, vec2(-0.215, 1.085), vec2(-0.228, 0.84), 0.035, 0.027));
  la = min(la, sdEll(p - vec2(-0.231, 0.78), vec2(0.028, 0.058)));
  d = smin(d, la, 0.02);
  // right arm raised, reaching (rotates about the shoulder)
  vec2 q = gArmRot * (p - vec2(0.185, 1.38 + lf));
  float ra = sdTCap(q, vec2(0.), vec2(0.125, 0.25), 0.047, 0.037);
  ra = min(ra, sdTCap(q, vec2(0.125, 0.25), vec2(0.158, 0.525), 0.036, 0.028));
  vec2 hq = q - vec2(0.166, 0.598);
  float hd = sdEll(hq, vec2(0.038, 0.05));
  hd = min(hd, sdTCap(hq, vec2(-0.03, -0.022), vec2(-0.076, 0.04), 0.013, 0.01));   // thumb
  hd = min(hd, sdTCap(hq, vec2(-0.022, 0.035), vec2(-0.042, 0.13), 0.012, 0.0085));
  hd = min(hd, sdTCap(hq, vec2(-0.004, 0.04), vec2(-0.004, 0.148), 0.012, 0.0085));
  hd = min(hd, sdTCap(hq, vec2(0.014, 0.037), vec2(0.031, 0.138), 0.0115, 0.0085));
  hd = min(hd, sdTCap(hq, vec2(0.028, 0.028), vec2(0.06, 0.108), 0.0105, 0.0075));
  ra = smin(ra, hd, 0.012);
  d = smin(d, ra, 0.03);
  return d;
}

float n2(vec2 p) { return vnoise(p) * .65 + vnoise(p * 2.13 + 5.7) * .35; }

// ---------------------------------------------------------------- overhead spotlight
// one hard theatre light high above (slightly right of) the figure, aimed at its feet:
// a widening hazy cone with god-ray streaks that churn slowly
float spot(vec2 p) {
  vec2 src = vec2(gFx + 0.42, 5.8);
  vec2 ax = normalize(vec2(gFx + 0.03, -0.1) - src);
  vec2 v = p - src;
  float along = max(dot(v, ax), 0.05);
  float r = (v.x * ax.y - v.y * ax.x) / along;              // tan(angle off the axis)
  float cone = smoothstep(0.15, 0.03, abs(r));
  if (cone <= 0.) return 0.;
  float st = vnoise(vec2(r * 40. + 1.3, gT * 0.11)) * 0.6 + vnoise(vec2(r * 90. - 4.2, gT * 0.23 + 3.)) * 0.4;
  float core = exp(-sq(r / 0.045));
  return cone * (0.15 + 1.0 * st * st) * (0.7 + 0.3 * smoothstep(1.0, 3.4, p.y)) + core * 0.35 * cone;
}

// ---------------------------------------------------------------- laser fan (peak sections)
// beams fanning up from a stage light hidden behind the figure: the cover-art look
vec3 lasers(vec2 p, float hz) {
  vec2 v = p - vec2(gFx + 0.03, 0.1);
  float len = length(v);
  float a = atan(v.x, max(v.y, 1e-3));
  float bar = aBarCount;
  float sw = sin(gT * 0.55 + iSeed * 6.3) * 0.16 + (hash11(bar * 1.7 + iSeed * 13.) - .5) * 0.22;
  float spr = mix(1.0, 1.32, hash11(bar * 3.1 + 2.));        // half spread of the fan
  float k = (a - sw) / (2. * spr) * 8.;                       // 9 beams at integer k = -4..4
  float id = floor(k + 0.5);
  float da = (k - id) * 2. * spr / 8.;
  float dp = abs(sin(da)) * len;
  float w = max(gPx * 1.15, 0.004) * (1. + len * 0.12);
  float on = step(abs(id), 4.) * step(0.28, hash11(id * 7.3 + bar * 1.9 + 0.5)) * step(-0.02, v.y);
  float ln = exp(-sq(dp / w)) * 1.3 + exp(-dp / (w * 7.)) * 0.16;
  vec3 c = mix(gB, mix(cD, gB, .3), step(0.72, hash11(id * 3.3 + bar)));
  float fade = smoothstep(0.1, 1.1, len) * exp(-len * 0.28);
  return c * ln * on * fade * (0.15 + 1.5 * hz * hz) * gLaser;
}

// ---------------------------------------------------------------- the empty hall (behind / around the figure)
vec3 air(vec2 p) {
  vec3 col = cA * (0.05 + 0.3 * smoothstep(1.9, -0.2, p.y));
  float hz = n2(p * vec2(0.8, 1.5) + vec2(gT * 0.035, -gT * 0.012));
  // low fog bank glowing along the floor line behind the figure
  float gf = exp(-max(p.y, 0.) * 2.6);
  col += gC * gf * (0.03 + 0.1 * hz) * (0.75 + 0.5 * aEnergy);
  // light spilling on the fog bank around the feet (continues the floor pool)
  col += gPoolCol * exp(-sq((p.x - gFx) / 0.45)) * exp(-max(p.y, 0.) / 0.16) * 0.8;
  // slow fog banks + a distant glow on the far horizon (depth, balances the frame)
  float fb = vnoise(p * vec2(0.32, 0.7) + vec2(gT * 0.02, 0.));
  col += (gC * 0.022 + gB * 0.012) * fb * fb * smoothstep(2.4, 0.2, p.y);
  float side = gFx + (iSeed > 0.5 ? -2.4 : 2.4);
  col += mix(gB, cD, .25) * 0.07 * exp(-sq((p.x - side) / 1.1)) * exp(-max(p.y, 0.) / 0.45) * (0.8 + 0.5 * aBass);
  // soft backlight behind the torso so the silhouette separates
  vec2 bq = (p - vec2(gFx, 1.25)) * vec2(1.1, 0.7);
  col += mix(gB, gC, .5) * 0.05 * exp(-dot(bq, bq) * 2.5) * (0.6 + 0.8 * aRms);
  // the spotlight cone (hazy)
  gBeamV = spot(p);
  col += gBeamCol * gBeamV * (0.45 + 0.8 * hz);
  // void mode: the space fills with glowing fog, brightest right behind the silhouette
  if (gMode > 0.001) {
    vec2 fq = p * 0.85 + vec2(gT * 0.045, gT * 0.02);
    float f1 = n2(fq);
    float f2 = vnoise(fq * 2.7 + vec2(f1 * 1.8, -gT * 0.07));
    float fd = smoothstep(0.22, 0.8, f1 * 0.5 + f2 * 0.5);
    vec2 cq = (p - vec2(gFx, 1.3)) * vec2(0.5, 0.52) / gSNs;
    float centre = exp(-dot(cq, cq) * 2.4);
    vec3 fc = cA * 0.4 + (mix(gB * 0.3, mix(gC, gB, .25), centre) + vec3(0.1) * centre * centre)
            * (0.1 + 0.9 * fd) * (0.03 + 0.7 * centre) * (0.8 + 0.35 * aRms + 0.25 * aEnergy) * gVoidGain;
    fc += gBeamCol * gBeamV * 0.5;
    col = mix(col, fc, gMode);
  }
  if (gLaser > 0.002) col += lasers(p, hz);
  return col;
}

// ---------------------------------------------------------------- rising sparks (figure-local coords)
// tiny hot points with a short motion streak below them, cooling as they rise
vec3 embers(vec2 p, float dens) {
  vec3 acc = vec3(0.);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float cs = 0.05 - fi * 0.012;
    float sp = (0.17 + fi * 0.07) * (0.6 + 0.7 * gII) * gEmbSp;
    vec2 q = p;
    q.y -= gT * sp + fi * 3.7;
    q.x += sin(q.y * 3.1 + fi * 2.1 + gT * 0.4) * 0.04;
    vec2 id = floor(q / cs), f = fract(q / cs) - .5;
    vec2 h = hash22(id + fi * 31.7);
    if (h.y > dens) continue;
    vec2 o = (hash22(id * 1.7 + 9.1) - .5) * vec2(0.6, 0.3);
    vec2 dv = (f - o) * cs;
    float tl = min(sp * 0.12, cs * 0.55) + gPx;                // streak length (trails below)
    float ty = clamp(-dv.y, 0., tl);
    float r = length(vec2(dv.x, dv.y + ty));
    float tail = 1. - ty / tl;
    float sz = max(cs * (0.015 + 0.035 * h.x), gPx * 0.7);
    float szT = sz * (0.4 + 0.6 * tail);                          // tail tapers to a thin line
    float core = smoothstep(szT + gPx, szT * 0.2, r) * (0.3 + 0.7 * tail * tail);
    float hal = exp(-r / (sz * 2.5 + gPx)) * tail * tail;
    float tw = 0.5 + 0.5 * sin(gT * (3. + h.x * 7.) + h.y * 40.);
    float hot = step(0.8, fract(h.x * 7.13));
    float bri = 0.3 + 1.5 * pow(fract(h.x * 3.71 + h.y * 5.3), 3.);   // a few bright, many faint
    vec3 ec = mix(gRimCol, mix(cD, vec3(1., .75, .55), .25), hot);
    acc += (mix(ec, vec3(1.), .55) * core * 2.4 + ec * hal * 0.4) * (0.35 + 0.65 * tw) * bri;
  }
  return acc;
}

// cheap silhouette proxy for the light-shaft occlusion march
float proxySDF(vec2 p) {
  float bd = sdBox2(p - vec2(0.05, 1.08), vec2(0.36, 1.1));
  if (bd > 0.2) return bd;
  float d = sdEll(p - vec2(0., 1.62), vec2(0.085, 0.112));
  d = min(d, sdTCap(p, vec2(0., 1.33), vec2(0., 0.98), 0.165, 0.125));
  d = min(d, sdTCap(p, vec2(0., 0.88), vec2(0., 0.06), 0.13, 0.05));
  vec2 q = gArmRot * (p - vec2(0.185, 1.38));
  d = min(d, sdTCap(q, vec2(0.), vec2(0.16, 0.66), 0.045, 0.035));
  d = min(d, sdTCap(p, vec2(-0.2, 1.36), vec2(-0.23, 0.76), 0.045, 0.03));
  return d;
}
// ---------------------------------------------------------------- figure shading
// returns light-figure emission; hole coverage / void emission via out params
vec3 figure(vec2 pw, float blur, out float hole, out float rimV, out vec3 voidEm) {
  vec2 p = pw - vec2(gFx, 0.);
  // memory glitch: horizontal slices shove sideways (drop-2 flashes)
  if (gGlitch > 0.01) {
    float tq = floor(gT * 12.);
    float band = floor(p.y * 15. + 7. * hash11(tq));
    float r = hash12(vec2(band, tq));
    p.x += step(r, gGlitch * 0.4) * (hash12(vec2(band * 1.7, tq + 3.)) - .5) * 0.32 * gGlitch;
  }
  float d = figSDF(p);
  hole = 0.; rimV = 0.; voidEm = vec3(0.);
  if (d > 0.62) return vec3(0.);
  float w = gPx + blur;
  float inside = smoothstep(w, -w, d);

  // dissolve field: noise drifting upward; the front climbs from the feet, the raised hand goes last
  float n = vnoise(p * vec2(7., 5.) + vec2(0., -gT * 0.32)) * 0.62 + vnoise(p * vec2(21., 16.) + vec2(3.1, -gT * 0.75)) * 0.38;
  float v = 0.42 * n + 0.62 * (1. - p.y / 1.8) + 0.3 * smoothstep(0.35, 0., p.y);
  float thr = mix(1.1, -0.1, gDiss);
  float alive = smoothstep(thr + 0.045, thr - 0.045, v) * smoothstep(-0.02, 0.16, p.y + 0.12 * (n - 0.5));
  float burn = exp(-abs(v - thr) * 55.) * smoothstep(0.02, -0.01, d) * smoothstep(0.05, 0.45, p.y);
  float trace = (1. - alive) * (1. - smoothstep(0.7, 0.95, gDiss)) * smoothstep(0.1, 0.5, p.y);

  // ---- light figure
  float core = exp(-sq(d / (w * 1.2 + 0.001)));
  float halo = exp(-abs(d) / (0.03 + 0.02 * aEnergy)) * 0.5 + exp(-abs(d) / 0.11) * 0.1 * smoothstep(0.45, 0.2, abs(d));
  float innerG = inside * exp(d / 0.03);
  // energy flowing along the outline; brighter on the head/shoulders, fading into the floor
  float rimMod = (0.45 + 0.75 * vnoise(p * vec2(9., 3.5) + vec2(0., -gT * 0.9))) * (0.35 + 0.65 * smoothstep(0.1, 1.3, p.y));
  // key light from the spotlight (top-right): outline normal from screen derivatives
  vec2 gd = vec2(dFdx(d), dFdy(d));
  float key = clamp(dot(gd / (length(gd) + 1e-6), vec2(0.3, 0.95)), 0., 1.);
  rimMod *= 0.5 + 1.0 * key;
  // a small hot core in the chest that beats with the kick (breathes with the vocal when there is none)
  vec2 hc = (p - vec2(0.045, 1.27)) * vec2(1., 0.85);
  float hr = dot(hc, hc);
  float heart = (exp(-hr / 0.0016) + 0.25 * exp(-hr / 0.012)) * gPulse;
  // hologram band flicker on hats
  float fl = 1. - gHatF * step(0.6, hash12(vec2(floor(p.y * 9.), aBeatCount * 2. + step(.5, aBeatPhase))));
  // hologram scan: a bright line sweeps up the body every 2 bars, leaving a fading wake
  float sd = p.y - gScanY;
  float scan = exp(-sq(sd / (0.012 + w))) + 0.3 * exp(sd / 0.22) * step(sd, 0.);
  // interior (only computed inside the body): scanlines, nebula, drifting particles
  vec3 interior = vec3(0.);
  float ipart = 0.;
  if (d < w * 2.) {
    // horizontal scanlines (fade their contrast when they get close to pixel size)
    float L = 62.;
    float sl = 0.5 + 0.5 * cos(TAU * (p.y * L + gT * 0.55));
    float lw2 = L * w;
    sl = mix(0.45, mix(sl, sl * sl * 1.3, smoothstep(0.24, 0.12, lw2)), smoothstep(0.5, 0.3, lw2));
    float neb = vnoise(p * vec2(5., 2.5) + vec2(0., -gT * 0.3));
    vec2 iq = p + vec2(0., -gT * 0.09);
    float ics = 0.032;
    vec2 iid = floor(iq / ics), ifr = fract(iq / ics) - .5;
    vec2 ih = hash22(iid + 3.3);
    float isz = max(0.13 * ics, gPx * 0.9);
    ipart = smoothstep(isz + gPx, isz * 0.2, length(ifr - (ih - .5) * .6) * ics) * step(0.62, ih.x)
          * (0.5 + 0.5 * sin(gT * 3. + ih.y * 30.));
    interior = gB * (0.05 + 0.42 * sl * (0.35 + 0.65 * neb) * (0.7 + 0.8 * aMid))
             + gC * 0.09 * neb + mix(gC, vec3(1.), .5) * ipart * 1.4;
  }
  float edgeW = 0.25 + 0.75 * exp(d / 0.07);
  float scanG = scan * (0.45 + 0.6 * aMid) * (1. - 0.6 * gMode);
  vec3 em = gRimCol * (core * (1.1 + 1.1 * aKick * gII + scanG * 1.5) + halo * 0.3) * rimMod * (alive + 0.22 * trace) * fl
          + mix(gRimCol, gB, .5) * innerG * 0.22 * alive
          + interior * inside * edgeW * mix(0.1, 0.75, alive) * fl
          + mix(gRimCol, vec3(1.), .4) * scanG * inside * 0.55 * alive
          + mix(cD, vec3(1., .85, .7), .35) * burn * (1.8 + 2. * aSnare * gII)
          + mix(cD, vec3(1.), .45) * heart * alive;
  em *= gFig;

  // ---- kick echo: an outline of the figure ripples outward on every kick (peak sections)
  float echo = 0.;
  if (gEcho > 0.01 && aKick > 0.03) {
    float ka = 1. - aKick;                                   // 0 at the kick -> 1 as it decays
    float es = 1. + 0.6 * ka;
    vec2 ecn = vec2(0.03, 1.15);
    float de = figSDF((p - ecn) / es + ecn) * es;
    echo = exp(-sq(de / (w * 1.2 + 0.003 + 0.016 * ka))) * aKick * aKick * gEcho * (1. - inside);
    em += mix(gB, cD, .35) * echo * 1.8;
  }

  // ---- sparks: born at the burn front and in dissolved parts, plus a thin plume above
  float dUp = proxySDF(p - vec2(sin(p.y * 2.3 + gT * 0.3) * 0.05, 0.32));
  float plume = smoothstep(0.16, -0.04, dUp) * smoothstep(2.7, 1.2, p.y) * smoothstep(-0.02, 0.05, d);
  float dens = smoothstep(0.05, -0.02, d) * (0.015 + 0.26 * (1. - alive) * (0.25 + 0.75 * exp(d / 0.05))) * smoothstep(0.0, 0.4, p.y) + burn * 0.45
             + plume * (0.05 + 0.4 * gDiss);
  dens = clamp(dens * gEmber, 0., 0.9);
  vec3 emb = dens > 0.004 ? embers(p, dens) * gFig : vec3(0.);
  em += emb;

  // ---- void silhouette
  hole = smoothstep(w * 1.5, -w * 1.5, d) * max(alive, 0.42 * trace);   // dissolved parts leave a fading shadow
  rimV = exp(-max(d, 0.) / 0.022) * (1. - inside) * (alive + 0.3 * trace);
  voidEm = mix(gC, vec3(1.), .4) * echo * 1.2 + emb * (0.4 - 0.22 * inside) + gC * ipart * inside * 0.1 * alive + mix(gC, vec3(1.), .5) * burn * 0.5;
  return em;
}

// screen-space volumetric shafts radiating from a light behind the chest.
// x: light blocked by the silhouette (void mode), y: light emitted by the figure (light mode)
vec2 shafts(vec2 p) {
  vec2 Lc = vec2(0.03, 1.42);
  vec2 dv = Lc - p;
  float len = length(dv);
  vec2 dir = dv / max(len, 1e-4);
  float stp = min(len, 1.5 * gSNs) / 8.;
  float k = 2.6 / sq(gSNs);
  float aV = 0., aL = 0., wgt = 1.;
  for (int i = 0; i < 8; i++) {
    vec2 q = p + dir * stp * (float(i) + gJit);
    float occ = smoothstep(0.012, -0.012, proxySDF(q));
    vec2 lq = q - Lc;
    aV += (1. - occ) * exp(-dot(lq, lq) * k) * wgt;
    aL += occ * wgt;
    wgt *= 0.88;
  }
  float att = 1. / (1. + sq(len / (1.1 * gSNs)));
  return vec2(aV * att, aL * smoothstep(1.75 * gSNs, 0.25 * gSNs, len)) * 0.175;
}

vec3 sceneAt(vec2 p, float blur) {
  vec3 a = air(p);
  float hole, rimV; vec3 vem;
  vec3 em = figure(p, blur, hole, rimV, vem);
  vec2 sh = vec2(0.);
  float lightRays = (0.45 * aKick + 0.28 * aSnare) * smoothstep(0.35, 0.7, gII);
  vec2 fp = p - vec2(gFx, 0.);
  float lenL = length(fp - vec2(0.03, 1.42));
  if ((gMode > 0.001 && lenL < 2.9 * gSNs) || (lightRays > 0.015 && lenL < 1.8)) {
    sh = shafts(fp);
    vec2 rv = fp - vec2(0.03, 1.42);
    vec2 rd = normalize(rv + 1e-5);
    float stripes = 0.25 + vnoise(rd * 5.5 + vec2(gT * 0.13, -gT * 0.09)) * 1.5;
    sh.y *= stripes;
    sh.x *= sq(0.3 + 0.7 * stripes);
  }
  vec3 lightC = a + em + gRimCol * sh.y * lightRays * gFig * (1. - gMode);
  if (gMode < 0.001) return lightC;
  float shv = sh.x * 1.6 * (0.9 + 0.5 * aRms + 0.9 * aKick * gII) * gVoidGain;
  shv = shv / (1. + 0.45 * shv);                              // soft shoulder: a burst, never a white wall
  vec3 shc = mix(mix(gC, gB, .3), vec3(dot(gC, vec3(.2126, .7152, .0722))), .2) * 1.25;
  vec3 voidC = a * (1. - hole) + a * rimV * 2.4 + vem + shc * shv * (1. - 0.92 * hole);
  return mix(lightC, voidC, gMode);
}

// ---------------------------------------------------------------- weather (screen space, in front)
vec3 weather(vec2 uv, float lit) {
  vec3 acc = vec3(0.);
  float px = 1. / iResolution.y;
  // dust motes
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float sc = 9. + fi * 7.;
    vec2 q = uv * sc + vec2(gTx * (0.5 + fi) * 0.4 + gT * 0.05, gT * (0.04 + fi * 0.03));
    q += vec2(sin(q.y * 1.3 + gT * 0.3), cos(q.x * 1.1 + gT * 0.25)) * 0.25;
    vec2 id = floor(q), f = fract(q) - .5;
    vec2 h = hash22(id + fi * 13.1);
    float keep = step(h.x, 0.25 + 0.5 * gRain);
    float r = length(f - (h - .5) * .7) / sc;
    float sz = (1.2 + 1.8 * h.y) * px * (1. + fi * 0.6);
    acc += mix(gC, vec3(1.), .5) * (smoothstep(sz + px, 0., r) * 0.6 + 0.12 * exp(-r / (sz * 2.5))) * keep
         * (0.4 + 0.6 * sin(gT * 1.5 + h.y * 20.)) * (0.05 + lit * 2.4);
  }
  // rain streaks (3 depth layers)
  float rain = smoothstep(0.3, 1., gRain);
  if (rain > 0.001) {
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float cols = 38. + fi * 26.;
      vec2 q = uv;
      q.x += q.y * 0.08 + gTx * 0.15 * (1. + fi);
      float xc = q.x * cols;
      float id = floor(xc);
      float h = hash11(id * 1.31 + fi * 7.7);
      float sp = (2.6 + fi * 0.9 + h) * (0.7 + 0.5 * gII);
      float y = fract(q.y * (0.55 + 0.2 * h) + gT * sp * 0.35 + h * 9.);
      float len = 0.10 + 0.06 * h;
      float seg = smoothstep(0., len * 0.3, y) * smoothstep(len, len * 0.5, y);
      float xo = (fract(xc) - 0.5 - (hash11(id * 3.7 + fi) - .5) * 0.6) / cols;
      float wpx = px * (0.9 + fi * 0.5);
      float line = exp(-sq(xo / wpx));
      float keep = step(hash11(id * 9.1 + floor(gT * sp * 0.35 + h * 9. + q.y * (0.55 + 0.2 * h)) * 3.3), 0.25 + 0.6 * rain);
      acc += mix(gC, vec3(1.), .4) * line * seg * keep * (0.03 + lit * 1.6) * rain * (0.5 + 0.3 * fi);
    }
  }
  return acc;
}

// ---------------------------------------------------------------- main
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - .5 * iResolution) / iResolution.y;
  gT = iTime;
  gII = clamp(iIntensity, 0., 1.);
  gDiss = clamp(iParams.x, 0., 1.);
  float fr = clamp(iParams.y, 0., 1.);
  gRain = clamp(iParams.z, 0., 1.);
  gMode = clamp(iParams.w, 0., 1.);

  // ---- camera / framing (figure plane coords: feet at y=0, raised fingertips ~2.15)
  // every framing keeps the hand inside a 0.24 letterbox (breakdown)
  float side = iSeed > 0.5 ? 1. : -1.;
  float a1 = smoothstep(0., 0.5, fr), a2 = smoothstep(0.5, 1., fr);
  float s  = mix(mix(3.35, 2.95, a1), 1.42, a2);
  float ty = mix(mix(1.0, 1.17, a1), 1.68, a2);
  float sx = mix(mix(0., 0.3, a1) * side, -0.1, a2);         // figure screen x
  // slow dolly-in + drift
  s *= 1.015 - 0.045 * smoothstep(0., 1., iProgress);
  float ph = iSeed * 6.283;
  vec2 drift = vec2(sin(gT * 0.13 + ph), sin(gT * 0.09 + ph * 1.7)) * vec2(0.035, 0.012) * s;
  gFx = 0.;
  gTx = gFx - sx * s + drift.x;
  ty += drift.y;
  gS = s;
  gSNs = mix(1., s / 3.35, 0.8);                              // screen-normalised glow radius
  gPx = s / iResolution.y;
  gH = mix(0.7, 1.45, fr);
  gD = s * 1.5;
  vec2 p = vec2(gTx, ty) + uv * s;

  // ---- pose / audio state
  float breath = 0.5 + 0.5 * sin(gT * TAU / 3.92);           // one breath per 2 bars
  gLift = 0.006 * breath + 0.01 * aEnergy;
  gArmRot = rot(0.035 * sin(gT * 0.45 + ph) - 0.02 * aEnergy);
  gHeadRot = rot(-0.09 + 0.025 * sin(gT * 0.3 + 1.));
  gFig = (0.55 + 0.45 * gII) * (0.8 + 0.25 * aRms + 0.2 * aEnergy + 0.08 * breath) * mix(1., 0.62, a2);
  gEmber = (0.5 + 0.5 * gII) * (0.7 + 0.9 * aHigh);
  gHatF = aHat * 0.45 * (0.4 + 0.6 * gII);
  gEmbSp = mix(1., 0.45, a2);
  gVoidGain = mix(1., 0.6, a2);
  gEcho = smoothstep(0.4, 0.9, gII);
  gPulse = 0.2 + 0.12 * breath + 0.3 * aMid * (1. - gII) + 0.9 * aKick * (0.35 + 0.65 * gII);
  gJit = fract(52.9829189 * fract(dot(fragCoord, vec2(0.06711056, 0.00583715))) + float(iFrame % 64) * 0.618034);
  gGlitch = smoothstep(0.75, 1., gII) * clamp(0.25 + aSnare * 0.9 + aKick * 0.35, 0., 1.);
  gLaser = smoothstep(0.55, 0.9, gII) * (0.45 + 0.55 * aKick + 0.35 * aSnare);
  gScanY = fract(gT / 3.92 + iSeed) * 2.9 - 0.35;
  // palette colours normalised in luminance so bright palettes (ice, acid, dream) don't blow out
  vec3 lw = vec3(.2126, .7152, .0722);
  gB = cB * min(1., 0.4 / max(dot(cB, lw), 1e-3));
  gC = cC * min(1., 0.32 / max(dot(cC, lw), 1e-3));
  gRimCol = mix(gB, gC, .3) + vec3(.25);
  gPoolCol = mix(gC, gB, .35) * (0.08 + 0.06 * aRms + 0.12 * aKick * gII);
  gBeamCol = mix(mix(gC, gB, .4), vec3(1.), .45) * 0.17 * (0.85 + 0.3 * aEnergy) * (1. - 0.35 * gLaser);

  // ---- direct view, or the wet floor's mirror reflection of the same scene
  vec2 sp = p;
  float blur = 0., R = 1., lit;
  vec3 add = vec3(0.);
  if (p.y < 0.) {
    float zr = gH / (gH - p.y);                               // depth relative to the figure plane
    vec2 fw = vec2((p.x - gTx) * zr + gTx - gFx, (zr - 1.) * gD);
    float fwz = gD * gH / sq(gH - p.y) * gPx;                 // floor-z change per pixel (for AA)
    float pud = smoothstep(0.42, 0.62, vnoise(fw * vec2(1.4, 2.3) + 7.3) * 0.7 + vnoise(fw * vec2(4.1, 6.3)) * 0.3);
    float rAA = smoothstep(0.06, 0.015, fwz * 14.);
    float rn = vnoise(fw * vec2(8., 14.) + vec2(0., gT * 0.25)) - 0.5;
    vec2 off = vec2(rn * 0.02, rn * 0.05) * (1. - 0.7 * pud) * rAA;
    // rain rings
    float rainA = smoothstep(0.25, 1., gRain);
    float rings = 0.;
    if (rainA > 0.001) {
      vec2 rq = fw / 0.32;
      vec2 rid = floor(rq), rf = fract(rq) - .5;
      vec2 rh = hash22(rid + 1.7);
      float age = fract(gT * (0.9 + 0.6 * rh.x) + rh.y * 7.);
      float rr = length((rf - (rh - .5) * .5) * 0.32);
      rings = exp(-sq((rr - age * 0.13) / (0.008 + fwz * 1.5))) * (1. - age) * rainA
            * step(hash12(rid + floor(gT * (0.9 + 0.6 * rh.x) + rh.y * 7.)), 0.3 + 0.6 * rainA);
      off.y += rings * 0.02 * rAA;
    }
    // kick shock-ring from the figure's feet
    float rr = length(fw * vec2(1., 1.25));
    float ringR = 0.12 + aBeatPhase * 1.5;
    float kw = 0.025 + 0.035 * aBeatPhase;
    float kring = exp(-sq((rr - ringR) / (kw + fwz * 0.7))) * kw / (kw + fwz * 0.7) * aKick * (0.3 + 0.7 * gII);
    off.y += kring * 0.04;
    blur = (-p.y) * 0.05 * (1. - 0.65 * pud) + 0.003;
    sp = vec2(p.x + off.x, -p.y + off.y);
    float nearL = exp(p.y / 0.06);                            // far edge of the floor dissolves into the fog bank
    kring *= 1. - nearL;
    float r0 = mix(0.3, 0.75, pud);
    R = mix(r0 + (0.9 - r0) * pow(zr, 6.), 1., nearL);        // fresnel: grazing = mirror
    // light pool under the figure from the spotlight above
    vec2 pq = (fw - vec2(0.03, 0.0)) * vec2(1.5, 2.1);
    float pool = exp(-dot(pq, pq) * 2.2);
    vec3 base = cA * 0.06 + gPoolCol * pool * (1.2 - 0.6 * pud);
    // low mist over the far floor
    base += gC * 0.04 * exp(p.y / 0.12) * n2(fw * vec2(1.5, 3.) + vec2(gT * 0.08, 0.));
    add = base * (1. - nearL) + mix(gB, vec3(1.), .3) * (kring * 0.7 + rings * 0.12 * (0.3 + pool * 3.));
    lit = pool * 0.02;
  } else {
    lit = 0.;
  }
  vec3 col = sceneAt(sp, blur) * R + add;
  lit += gBeamV * (p.y < 0. ? 0.05 : 0.1);
  // light near the figure catches the weather too
  vec2 fqd = (p - vec2(gFx, 1.1)) * vec2(1.4, 0.55);
  lit += exp(-dot(fqd, fqd) * 2.) * 0.03 * (1. - gMode * .3);
  col += weather(uv, lit);

  // afterglow: short max-blend with the previous frame, pulled slightly upward (spark trails)
  vec3 prev = texture(iPrev, (fragCoord + vec2(0., -1.)) / iResolution).rgb;
  col = max(col, prev * (0.6 + 0.12 * (1. - gII)));

  fragColor = vec4(max(col, 0.), 1.);
}
