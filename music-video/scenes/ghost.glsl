// =============================================================================
//  GHOST — "U WEREN'T HERE"
//  A lone human figure made of light (glowing outline + scanline / particle
//  interior) standing on a wet mirror floor in an empty dark hall, a single
//  shaft of light from above, haze, dust / rain. It frays into ascending
//  embers. In void mode the figure is the *absence*: a silhouette-shaped hole
//  cut out of glowing fog — the missing person.
//
//  iParams (all 0..1, 0,0,0,0 = crisp light figure, full body, light dust):
//    x  dissolve : 0 = crisp light figure (only feet / fingertips fray)
//                  .. 1 = almost gone: only burning fragments + rising embers.
//                  Animate it (e.g. 0.85 -> 0.3 assembles the figure from embers).
//    y  framing  : 0 = full body centred (floor + reflection visible)
//                  0.5 = full/medium shot on a rule-of-thirds line (side picked by iSeed)
//                  1 = close-up head & shoulders (raised hand top-right)
//    z  weather  : 0 = a few dust motes drifting in the light shaft
//                  .. 1 = heavy rain streaks + rain rings on the floor
//    w  mode     : 0 = figure made of light .. 1 = void silhouette (dark hole in
//                  glowing fog with a light-bleed rim). Blends continuously.
//
//  Audio: aEnergy/aRms = breathing (brightness, shoulder lift, halo), aMid =
//  interior scanline glow (vocals), aHat = subtle hologram band flicker,
//  aHigh = ember emission, aKick = floor shock-ring + light-pool pulse + rim
//  flare, aSnare (intensity > .75) = slice glitch of the figure.
// =============================================================================

float gT, gII, gPx, gFx, gTx, gH, gD, gS;
float gDiss, gMode, gRain, gGlitch, gFig, gEmber, gHatF, gLift;
mat2  gArmRot, gHeadRot;
vec3  gRimCol, gBeamCol;

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
  float bd = sdBox2(p - vec2(0.06, 1.08), vec2(0.44, 1.14));
  if (bd > 0.3) return bd;
  float lf = gLift;
  // head (slightly tilted) + neck
  vec2 hp = gHeadRot * (p - vec2(0.0, 1.63 + lf * 0.7));
  float d = sdEll(hp, vec2(0.086, 0.112));
  d = smin(d, sdTCap(p, vec2(0., 1.43 + lf), vec2(0., 1.56 + lf * 0.7), 0.046, 0.038), 0.025);
  // shoulders + torso + pelvis
  float sh = sdTCap(p, vec2(-0.165, 1.395 + lf), vec2(0.165, 1.40 + lf), 0.058, 0.058);
  float to = sdTrap(p - vec2(0., 1.16), 0.13, 0.185, 0.22) - 0.03;
  d = smin(d, smin(sh, to, 0.07), 0.03);
  d = smin(d, sdTrap(p - vec2(0., 0.875), 0.15, 0.13, 0.075) - 0.02, 0.05);
  // legs (slight contrapposto)
  float lg = sdTCap(p, vec2(-0.075, 0.86), vec2(-0.088, 0.47), 0.07, 0.05);
  lg = min(lg, sdTCap(p, vec2(-0.088, 0.47), vec2(-0.082, 0.03), 0.048, 0.032));
  lg = min(lg, sdTCap(p, vec2(0.075, 0.86), vec2(0.104, 0.47), 0.07, 0.05));
  lg = min(lg, sdTCap(p, vec2(0.104, 0.47), vec2(0.122, 0.03), 0.048, 0.032));
  d = smin(d, lg, 0.03);
  // left arm hanging
  float la = sdTCap(p, vec2(-0.19, 1.365 + lf), vec2(-0.232, 1.08), 0.05, 0.04);
  la = min(la, sdTCap(p, vec2(-0.232, 1.08), vec2(-0.243, 0.83), 0.038, 0.03));
  la = min(la, sdEll(p - vec2(-0.245, 0.77), vec2(0.03, 0.062)));
  d = smin(d, la, 0.025);
  // right arm raised, reaching (rotates about the shoulder)
  vec2 q = gArmRot * (p - vec2(0.19, 1.375 + lf));
  float ra = sdTCap(q, vec2(0.), vec2(0.12, 0.255), 0.05, 0.04);
  ra = min(ra, sdTCap(q, vec2(0.12, 0.255), vec2(0.158, 0.525), 0.038, 0.031));
  vec2 hq = q - vec2(0.166, 0.6);
  float hd = sdEll(hq, vec2(0.04, 0.052));
  hd = min(hd, sdTCap(hq, vec2(-0.03, -0.022), vec2(-0.078, 0.042), 0.014, 0.011));   // thumb
  hd = min(hd, sdTCap(hq, vec2(-0.022, 0.035), vec2(-0.042, 0.135), 0.0125, 0.009));
  hd = min(hd, sdTCap(hq, vec2(-0.004, 0.04), vec2(-0.004, 0.152), 0.0125, 0.009));
  hd = min(hd, sdTCap(hq, vec2(0.014, 0.037), vec2(0.031, 0.142), 0.012, 0.009));
  hd = min(hd, sdTCap(hq, vec2(0.029, 0.028), vec2(0.061, 0.112), 0.011, 0.008));
  ra = smin(ra, hd, 0.014);
  d = smin(d, ra, 0.03);
  return d;
}

float n2(vec2 p) { return vnoise(p) * .65 + vnoise(p * 2.13 + 5.7) * .35; }

// ---------------------------------------------------------------- light shaft from above
float beam(vec2 p) {
  vec2 src = vec2(gFx + 0.45, 4.2);
  vec2 v = p - src;
  vec2 dir = normalize(vec2(gFx - 0.02, 0.9) - src);
  float ang = atan(v.x * dir.y - v.y * dir.x, dot(v, dir));   // signed angle to the beam axis
  float cone = smoothstep(0.24, 0.02, abs(ang));
  float rays = vnoise(vec2(ang * 38. + 1.3, gT * 0.18)) * vnoise(vec2(ang * 13. - gT * 0.05, 4.7));
  float dist = length(v);
  return cone * (0.25 + 1.6 * rays) * exp(-dist * 0.22) * smoothstep(0.0, 0.6, dist);
}

// ---------------------------------------------------------------- the empty hall (behind / around the figure)
vec3 air(vec2 p) {
  vec3 col = cA * (0.12 + 0.3 * smoothstep(1.8, -0.2, p.y));
  float hz = n2(p * vec2(0.8, 1.5) + vec2(gT * 0.035, -gT * 0.012));
  // low fog bank glowing along the floor line behind the figure
  float gf = exp(-max(p.y, 0.) * 2.6);
  col += cC * gf * (0.035 + 0.11 * hz) * (0.75 + 0.5 * aEnergy);
  // soft backlight behind the torso so the silhouette separates
  vec2 bq = (p - vec2(gFx, 1.25)) * vec2(1.1, 0.7);
  col += mix(cB, cC, .5) * 0.05 * exp(-dot(bq, bq) * 2.5) * (0.6 + 0.8 * aRms);
  // the light shaft (hazy)
  col += gBeamCol * beam(p) * (0.5 + 0.7 * hz);
  // void mode: the space fills with glowing fog
  if (gMode > 0.001) {
    vec2 fq = p * 1.05 + vec2(gT * 0.05, gT * 0.025);
    float f1 = n2(fq);
    float f2 = n2(fq * 2.4 + f1 * 1.6 - vec2(0., gT * 0.06));
    float fog = smoothstep(0.25, 0.85, f1 * 0.55 + f2 * 0.5);
    vec2 cq = (p - vec2(gFx, 1.15)) * vec2(0.55, 0.62);
    float centre = exp(-dot(cq, cq) * 1.6);
    vec3 fc = mix(cA * 3. + cC * 0.08, cC * 0.75 + cB * 0.25, fog) + cB * 0.5 * sq(f2) * fog;
    fc *= (0.35 + 1.35 * centre) * (0.8 + 0.35 * aRms + 0.25 * aEnergy);
    fc += gBeamCol * beam(p) * 0.6;
    col = mix(col, fc, gMode);
  }
  return col;
}

// ---------------------------------------------------------------- rising embers (figure-local coords)
vec3 embers(vec2 p, float dens) {
  vec3 acc = vec3(0.);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float cs = 0.055 - fi * 0.014;
    float sp = (0.16 + fi * 0.06) * (0.6 + 0.6 * gII);
    vec2 q = p;
    q.y -= gT * sp + fi * 3.7;
    q.x += sin(q.y * 3.5 + fi * 2.1 + gT * 0.4) * 0.035;
    vec2 id = floor(q / cs), f = fract(q / cs) - .5;
    vec2 h = hash22(id + fi * 31.7);
    float keep = step(h.y, dens);
    vec2 o = (hash22(id * 1.7 + 9.1) - .5) * 0.55;
    float r = length(f - o) * cs;
    float sz = max(cs * (0.035 + 0.06 * h.x), gPx * 1.1);
    float tw = 0.55 + 0.45 * sin(gT * (2.5 + h.x * 6.) + h.y * 40.);
    float e = smoothstep(sz + gPx, sz * 0.15, r) * 2.2 + 0.5 * exp(-r / (sz * 2.2));
    vec3 ec = mix(cD, mix(cC, vec3(1.), .4), h.x * h.x);
    acc += ec * e * tw * keep;
  }
  return acc;
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
  float w = gPx + blur;
  float inside = smoothstep(w, -w, d);

  // dissolve field: noise drifting upward, legs fade into the floor, fingertips fray
  float n = vnoise(p * vec2(7., 5.) + vec2(0., -gT * 0.32)) * 0.62 + vnoise(p * vec2(21., 16.) + vec2(3.1, -gT * 0.75)) * 0.38;
  float v = n + smoothstep(0.7, 0.0, p.y) * 0.62 + smoothstep(1.95, 2.2, p.y) * 0.38;
  float thr = mix(1.14, -0.08, gDiss);
  float alive = smoothstep(thr + 0.045, thr - 0.045, v);
  float burn = exp(-abs(v - thr) * 28.) * smoothstep(0.02, -0.01, d);

  // ---- light figure
  float core = exp(-sq(d / (w * 1.25 + 0.0012)));
  float halo = exp(-abs(d) / (0.035 + 0.02 * aEnergy)) * 0.5 + exp(-abs(d) / 0.16) * 0.12;
  float innerG = inside * exp(d / 0.045);
  // horizontal scanlines (fade their contrast when they get close to pixel size)
  float L = 62.;
  float sl = 0.5 + 0.5 * cos(TAU * (p.y * L + gT * 0.55));
  float aaS = smoothstep(0.55, 0.22, L * w);
  sl = mix(0.45, sl * sl * 1.3, aaS);
  float neb = vnoise(p * vec2(5., 2.5) + vec2(0., -gT * 0.3));
  // drifting particles inside the body
  vec2 iq = p + vec2(0., -gT * 0.09);
  float ics = 0.032;
  vec2 iid = floor(iq / ics), ifr = fract(iq / ics) - .5;
  vec2 ih = hash22(iid + 3.3);
  float isz = max(0.13 * ics, gPx * 0.9);
  float ipart = smoothstep(isz + gPx, isz * 0.2, length(ifr - (ih - .5) * .6) * ics) * step(0.62, ih.x)
              * (0.5 + 0.5 * sin(gT * 3. + ih.y * 30.));
  // hologram band flicker on hats
  float fl = 1. - gHatF * step(0.6, hash12(vec2(floor(p.y * 9.), aBeatCount * 2. + step(.5, aBeatPhase))));
  vec3 interior = cB * (0.06 + 0.42 * sl * (0.35 + 0.65 * neb) * (0.7 + 0.8 * aMid))
                + cC * 0.10 * neb + mix(cC, vec3(1.), .5) * ipart * 1.4;
  vec3 em = gRimCol * (core * (1.6 + 1.4 * aKick * gII) + halo * 0.55) * alive * fl
          + mix(gRimCol, cB, .5) * innerG * 0.7 * alive
          + interior * inside * mix(0.1, 1., alive) * fl
          + mix(cD, vec3(1., .85, .7), .25) * burn * (2.2 + 2. * aSnare * gII);
  em *= gFig;

  // ---- embers: born where the body is dissolving, plus a plume above it
  float dUp = figSDF(p - vec2(sin(p.y * 2.3 + gT * 0.3) * 0.05, 0.32));
  float plume = smoothstep(0.16, -0.04, dUp) * smoothstep(2.7, 1.2, p.y);
  float dens = smoothstep(0.06, -0.02, d) * (0.12 + 0.85 * (1. - alive)) + burn * 0.6
             + plume * (0.1 + 0.6 * gDiss) + smoothstep(1.9, 2.3, p.y) * plume * 0.35;
  dens = clamp(dens * gEmber, 0., 0.95);
  vec3 emb = dens > 0.005 ? embers(p, dens) * gFig : vec3(0.);
  em += emb;

  // ---- void silhouette
  hole = smoothstep(w * 1.5, -w * 1.5, d) * mix(0.25, 1., alive);
  rimV = exp(-max(d, 0.) / 0.022) * (1. - inside) * mix(0.3, 1., alive);
  voidEm = emb * 0.55 + cC * ipart * inside * 0.15 + mix(cD, vec3(1.), .3) * burn * 1.2;
  return em;
}

vec3 sceneAt(vec2 p, float blur) {
  vec3 a = air(p);
  float hole, rimV; vec3 vem;
  vec3 em = figure(p, blur, hole, rimV, vem);
  vec3 lightC = a + em;
  if (gMode < 0.001) return lightC;
  vec3 voidC = a * (1. - hole) + a * rimV * 1.6 + vem;
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
    acc += mix(cC, vec3(1.), .5) * (smoothstep(sz + px, 0., r) * 0.6 + 0.12 * exp(-r / (sz * 2.5))) * keep
         * (0.4 + 0.6 * sin(gT * 1.5 + h.y * 20.)) * (0.06 + lit * 2.2);
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
      acc += mix(cC, vec3(1.), .4) * line * seg * keep * (0.03 + lit * 1.6) * rain * (0.5 + 0.3 * fi);
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

  // ---- camera / framing (figure plane coords: feet at y=0)
  float side = iSeed > 0.5 ? 1. : -1.;
  float a1 = smoothstep(0., 0.5, fr), a2 = smoothstep(0.5, 1., fr);
  float s  = mix(mix(3.1, 2.55, a1), 0.95, a2);
  float ty = mix(mix(1.0, 1.08, a1), 1.47, a2);
  float sx = mix(mix(0., 0.3, a1), 0.12, a2) * side;          // figure screen x
  // slow dolly-in + drift
  s *= 1.03 - 0.06 * smoothstep(0., 1., iProgress);
  float ph = iSeed * 6.283;
  vec2 drift = vec2(sin(gT * 0.13 + ph), sin(gT * 0.09 + ph * 1.7)) * vec2(0.035, 0.018) * s;
  gFx = 0.;
  gTx = gFx - sx * s + drift.x;
  ty += drift.y;
  gS = s;
  gPx = s / iResolution.y;
  gH = mix(0.7, 1.45, fr);
  gD = s * 1.5;
  vec2 p = vec2(gTx, ty) + uv * s;

  // ---- pose / audio state
  float breath = 0.5 + 0.5 * sin(gT * TAU / 3.92);           // one breath per 2 bars
  gLift = 0.006 * breath + 0.01 * aEnergy;
  gArmRot = rot(0.035 * sin(gT * 0.45 + ph) - 0.02 * aEnergy);
  gHeadRot = rot(-0.09 + 0.025 * sin(gT * 0.3 + 1.));
  gFig = (0.55 + 0.45 * gII) * (0.8 + 0.25 * aRms + 0.2 * aEnergy + 0.08 * breath);
  gEmber = (0.5 + 0.5 * gII) * (0.7 + 0.9 * aHigh);
  gHatF = aHat * 0.45 * (0.4 + 0.6 * gII);
  gGlitch = smoothstep(0.75, 1., gII) * clamp(0.25 + aSnare * 0.9 + aKick * 0.35, 0., 1.);
  gRimCol = mix(cB, cC, .3) + vec3(.25);
  gBeamCol = mix(cC, vec3(1.), .35) * 0.09 * (0.85 + 0.3 * aEnergy);

  vec3 col;
  float lit;
  if (p.y >= 0.) {
    col = sceneAt(p, 0.);
    lit = beam(p) * 0.09;
  } else {
    // ---- wet floor: perspective coords, puddles, ripples, mirror reflection
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
    float kring = exp(-sq((rr - ringR) / (0.03 + 0.04 * aBeatPhase + fwz * 2.))) * aKick * (0.3 + 0.7 * gII);
    off.y += kring * 0.04;
    float blur = (-p.y) * 0.05 * (1. - 0.65 * pud) + 0.003;
    vec3 refl = sceneAt(vec2(p.x + off.x, -p.y + off.y), blur);
    float R = mix(0.3, 0.72, pud) * (0.5 + 0.5 * zr);
    // light pool under the figure from the shaft above
    vec2 pq = (fw - vec2(0.03, 0.0)) * vec2(1.6, 2.2);
    float pool = exp(-dot(pq, pq) * 2.2);
    vec3 base = cA * 0.06 + mix(cC, cB, .4) * pool * (0.06 + 0.08 * aRms + 0.1 * aKick * gII) * (1. - 0.5 * pud);
    col = base + refl * R + mix(cB, vec3(1.), .3) * (kring * 0.7 + rings * 0.12 * (0.3 + pool * 3.));
    lit = beam(vec2(p.x, -p.y)) * 0.05 + pool * 0.02;
  }
  // light near the figure catches the weather too
  vec2 fqd = (p - vec2(gFx, 1.1)) * vec2(1.4, 0.55);
  lit += exp(-dot(fqd, fqd) * 2.) * 0.03 * (1. - gMode * .3);
  col += weather(uv, lit);

  // afterglow: slow max-blend with the previous frame, pulled slightly upward
  vec3 prev = texture(iPrev, (fragCoord + vec2(0., -0.7)) / iResolution).rgb;
  col = max(col, prev * (0.78 + 0.08 * (1. - gII)));

  fragColor = vec4(max(col, 0.), 1.);
}
