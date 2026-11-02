// =============================================================================
// LASERS — the signature scene / cover-art homage.
// A dark warehouse full of haze. Laser emitters on a truss throw razor beams and
// fans through the smoke, choreographed to the beat; teal wash lights fill the fog;
// a black crowd of heads and raised hands bounces in the foreground, rim-lit.
//
// iParams (all 0..1, 0,0,0,0 = eye-level fan show, no crowd, light haze):
//   x  crowd amount   0 = no crowd .. 1 = dense 3-layer crowd (density also grows
//                     with intensity; raised hands / jumping grow with intensity)
//   y  beam layout    0   = fans from emitters on the truss (top centre)
//                     0.5 = beams crossing the room from left/right side walls (scissors)
//                     1   = cone / tunnel of beams converging on the camera from a far emitter
//                     (in-between values blend the layouts)
//   z  camera         0 = eye level at the back, looking at the truss
//                     1 = low angle close to the stage, looking up (crowd looms, beams overhead)
//   w  haze density   0 = light haze, crisp beams .. 1 = thick fog, big halos, lit smoke
// Audio: kick = fog flash + beam pulse + fan breathing + crowd bounce,
//        clap = fan flip / beam strobe / cD accent beams, hats = beam shimmer.
// Pattern (sweep mode, emitter count, spread, tilt, "liquid sky" sheet) changes every
// 2 bars at high intensity (4 bars when calm), on the downbeat.
// =============================================================================

const float TRUSS_Y = 8.2;
const float TRUSS_Z = 24.;

float gBeat, gBar, gI, gPh;
vec2 gB1, gBh, gBq;     // (cos, sin) of the beat phase: full beat, half-rate, quarter-rate (crowd motion)
float gH2, gH4, gH5, gPh0, gClap, gFlip; bool gSky;

vec3 dirYP(float yaw, float pitch) { return vec3(sin(yaw) * cos(pitch), sin(pitch), -cos(yaw) * cos(pitch)); }

// alternates -1 / +1 every unit of bt, with a quick ease at the start of each unit
float snapWave(float bt, float ease) {
  float k = floor(bt), f = fract(bt);
  float a = mod(k, 2.) * 2. - 1.;
  return mix(-a, a, smoothstep(0., ease, f));
}

// fan cluster c (of G) on the truss: emitter E, main axis Mx, fan spread direction S
void fanFrame(float c, float G, out vec3 E, out vec3 Mx, out vec3 S) {
  float gc = c - (G - 1.) * .5;
  float mode = floor(gH2 * 3.);
  float sw = mode < .5 ? sin(gPh0 + gc * 1.3)
           : mode < 1.5 ? sin(gPh0) * (c == 1. ? -1. : 1.)
           : snapWave(gBeat * .5 + gc * .5, .28);
  float yaw = .3 * sw * mix(.45, 1., gI) + gc * .22;
  float pitch = mix(-.06, -.36, gH5) + .12 * sin(gPh0 * .5 + 1.3 + gc);
  float rl = (gH4 - .5) * 2.4 + .35 * sin(gPh0 * .25 + gc);
  if (gSky) { yaw *= .4; pitch = -.15 + .045 * sin(gPh0 * .5) - .04 * gClap; rl = .05 * sin(gPh0 * .5); }
  rl *= gFlip;                                              // backbeat: the fan flips over
  Mx = dirYP(yaw, pitch);
  vec3 R = normalize(cross(vec3(0, 1, 0), Mx)), U = cross(Mx, R);
  E = vec3(gc * 6.6, TRUSS_Y - .78, TRUSS_Z - .5);
  S = cos(rl) * R + sin(rl) * U;
}

// solid mass of bodies below the shoulder line (lower and lumpier when the crowd is sparse)
float massLine(vec2 p, float L, float dens) {
  float b = abs(fract(p.x * .68 + L * .37) - .5);
  return p.y + .8 + (1. - dens) * .2 + .07 * sin(p.x * 1.7 + L) + .18 * b * b;
}

// ---------------------------------------------------------------------------
// crowd silhouettes (2D SDF). p in "person" units: 1 = one person's width, y=0 shoulder line
// ---------------------------------------------------------------------------
float crowdSDF(vec2 p, float L, float dens, float armP, float jump) {
  float id0 = floor(p.x);
  float d = massLine(p, L, dens);
  gPh = 1e3;                                                // phone screens (emissive), set as a side output
  for (int k = -1; k <= 1; k++) {
    float id = id0 + float(k);
    float hp = hash12(vec2(id * 1.13 + 7.7, L * 13.7 + 1.3));
    if (hp > dens) continue;
    vec2 ha = hash22(vec2(id * 1.37 + 4.1, L * 7.1 + 2.));
    vec2 hb = hash22(vec2(id * .71 + 9.3, L * 3.3 + 5.));
    float sc = mix(.88, 1.12, fract(hp * 7.31 + ha.y));
    float cx = id + .5 + (ha.x - .5) * .45;
    // per-person phase offset o (small): rotate the shared beat phasors instead of calling trig
    float x1 = (ha.y - .5) * .12 * TAU, x2 = x1 * x1;
    vec2 r1 = vec2(1. - x2 * .5 + x2 * x2 / 24., x1 - x1 * x2 / 6.);   // cos/sin(TAU*o)
    float xh = x1 * .5, xh2 = xh * xh;
    vec2 rh = vec2(1. - xh2 * .5, xh - xh * xh2 / 6.);                 // cos/sin(PI*o)
    float cb = gB1.x * r1.x - gB1.y * r1.y;                            // cos(TAU*(beat+o))
    float amp = (hb.x > .25 ? 1. : .35) * mix(.05, .3, jump);
    float bob = -(.5 + .5 * cb);                          // dip on the beat
    float hop = abs(gBh.y * rh.x + gBh.x * rh.y) * 1.4;   // |sin(PI*(beat+o))|: jump, land on the beat
    float hy = (hb.y - .5) * .4 + amp * mix(bob, hop, jump);
    vec2 q = (p - vec2(cx, hy)) / sc;
    bool arms = hb.x < armP;
    // conservative bounding box: skip people that can't be the closest
    float bb = sdBox2(q - vec2(0., -.2), arms ? vec2(1.12, 1.68) : vec2(.66, 1.1)) * sc;
    if (bb > d) continue;
    float lean = (ha.y - .5) * .2;
    // shoulders (ellipse) + torso
    float dd = (length((q - vec2(0., -.24)) / vec2(.62, .4)) - 1.) * .4;
    dd = smin(dd, sdBox2(q - vec2(0., -1.1), vec2(.5, .86)), .1);
    // neck + head
    dd = smin(dd, sdSeg2(q, vec2(0., .02), vec2(lean * .4, .32)) - .11, .1);
    dd = min(dd, (length((q - vec2(lean, .5)) / vec2(.225, .27)) - 1.) * .225);
    // arms
    if (!arms) {                                          // arms hanging at the sides
      vec2 qa = vec2(abs(q.x), q.y);
      dd = smin(dd, sdSeg2(qa, vec2(.44, -.16), vec2(.53, -.95)) - .1, .06);
    } else {
      float qph = floor(ha.x * 4.);                       // one of 4 sway phases
      float sway = (qph < 1. ? gBq.y : qph < 2. ? gBq.x : qph < 3. ? -gBq.y : -gBq.x) * .12;
      float pump = .5 + .5 * cb;                          // hands highest on the beat
      float sg = ha.x < .5 ? 1. : -1.;
      vec2 sh = vec2(sg * .44, -.14);
      vec2 el = sh + vec2(sg * (.2 + sway), .5 + .12 * pump * jump);
      vec2 hn = el + vec2(sg * .04 + sway * .8, .5 + .18 * pump * jump);
      dd = smin(dd, sdSeg2(q, sh, el) - .11, .05);
      dd = min(dd, sdSeg2(q, el, hn) - .085);
      dd = min(dd, length((q - hn - vec2(0., .07)) * vec2(1., .8)) - .1);
      if (fract(hp * 29.3 + ha.x * 3.1) < .22) {          // filming the show: phone held up, screen towards us
        vec2 pq = (q - hn - vec2(sg * .02, .14)) * mat2(.9928, sg * .1197, -sg * .1197, .9928);
        float pb = sdBox2(pq, vec2(.09, .16)) - .02;
        dd = min(dd, pb);
        gPh = min(gPh, (pb + .035) * sc);
      } else if (fract(hp * 13.7 + hb.y) > .45) {         // both arms up (V)
        vec2 sh2 = vec2(-sg * .44, -.14);
        vec2 el2 = sh2 + vec2(-sg * (.24 - sway), .48 + .1 * pump * jump);
        vec2 hn2 = el2 + vec2(-sg * .1 + sway * .8, .48 + .15 * pump * jump);
        dd = smin(dd, sdSeg2(q, sh2, el2) - .11, .05);
        dd = min(dd, sdSeg2(q, el2, hn2) - .085);
        dd = min(dd, length((q - hn2 - vec2(0., .07)) * vec2(1., .8)) - .1);
      }
    }
    d = min(d, dd * sc);
  }
  return d;
}

// returns layer colour (rgb) and coverage (a)
vec4 crowdLayer(vec2 uv, vec3 bg, float L, float unit, float baseY, float parX,
                vec3 silCol, float rimAmt, float dens, float armP, float jump) {
  if (uv.y > baseY + 2.3 * unit) return vec4(0.);
  vec2 p = vec2((uv.x - parX) / unit + L * 37.3, (uv.y - baseY) / unit);
  float d = crowdSDF(p, L, dens, armP, jump);
  float ph = gPh;
  float px = 1. / (iResolution.y * unit);
  float m = smoothstep(px, -px, d);
  if (m <= 0.) return vec4(0.);
  vec3 c = silCol;
  c += mix(mix(cB, cC, .3), vec3(1.), .3) * (.3 + .2 * fract(p.y * 2.)) * smoothstep(px * .7, -px * .7, ph);
  if (d > -px * 6.) {                                       // rim light from behind / above
    vec2 ld = normalize(vec2(-uv.x * .7, 1.));
    float e = px * 2.;
    float d2 = crowdSDF(p + ld * e, L, dens, armP, jump);
    float facing = clamp((d2 - d) / e, 0., 1.);
    float rim = exp(min(d, 0.) / (px * 1.5));
    rim *= smoothstep(0., px * 3., massLine(p, L, dens) - d);   // no rim on the fake body mass
    c += (bg * 1.3 + (cB * .6 + cC * .4) * (.12 + .25 * aKick)) * rim * facing * rimAmt;
  }
  return vec4(c, m);
}

// ---------------------------------------------------------------------------
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - .5 * iResolution) / iResolution.y;
  gI = clamp(iIntensity, 0., 1.);
  gBeat = aBeatCount + aBeatPhase;
  gBar = (gBeat - 3.) / 4.;                                 // bar 0 starts at the 8.07 s downbeat
  gB1 = vec2(cos(TAU * gBeat), sin(TAU * gBeat));
  gBh = vec2(cos(PI * gBeat), sin(PI * gBeat));
  gBq = vec2(cos(TAU * gBeat * .25), sin(TAU * gBeat * .25));
  float kick = aKick;
  float clap = smoothstep(.12, .55, aSnare);
  // fan flip: toggles on the backbeat (beats 2 & 4) at groove/drop intensity, 3-frame snap
  float flipS = mix(1., snapWave((gBeat - 4.) * .5, .1), smoothstep(.5, .7, gI));
  float haze = .3 + .7 * iParams.w;

  // pattern: changes every 2 bars at peak, every 4 when calm
  float patLen = gI > .55 ? 2. : 4.;
  float pat = floor(gBar / patLen) + floor(iSeed * 97.);
  float h1 = hash11(pat * 1.31 + .17), h2 = hash11(pat * 2.71 + .53);
  float h3 = hash11(pat * .93 + .91), h4 = hash11(pat * 3.17 + .29), h5 = hash11(pat * 5.37 + .71);
  float sweepP = gI > .8 ? (h1 < .3 ? 2. : 4.) : gI > .45 ? 8. : 16.;   // beats per sweep cycle
  float nB = 1. + 11. * pow(gI, 1.8);                       // active beams (fractional last one fades)

  // ---- camera
  float tilt = iParams.z;
  float tt = iTime + iSeed * 40.;
  vec3 ro = vec3(1.3 * sin(tt * .11), mix(1.75, .7, tilt) + .08 * sin(tt * .23), mix(0., 11., tilt));
  float sx = (hash11(iSeed * 71.3 + 2.1) - .5) * 2.;       // per-shot framing offset
  vec3 ta = vec3(.6 * sin(tt * .07 + 1.) + sx * 3.5, mix(3.1, 4.9, tilt), TRUSS_Z);
  float fl = mix(1.15, .82, tilt);
  float roll = .025 * sin(tt * .13) - sx * .05 * gI;
  vec3 fw = normalize(ta - ro);
  vec3 rt = normalize(cross(fw, vec3(sin(roll), cos(roll), 0.)));
  vec3 up = cross(rt, fw);
  vec3 rd = normalize(uv.x * rt + uv.y * up + fl * fw);
  float pix = 1. / (iResolution.y * fl);

  // ---- smoke density (screen space, two drifting layers)
  vec2 hp = uv * vec2(1.4, 2.) + vec2(ro.x * .06, 0.);
  vec2 q1 = hp * 1.3 + vec2(iTime * .035, -iTime * .012);
  float s1 = vnoise(q1) * .54 + vnoise(q1 * 2.03 + 17.1) * .27 + vnoise(q1 * 4.1 + 3.3) * .15;
  vec2 q2 = hp * 3.2 + vec2(-iTime * .06, iTime * .02) + s1 * 1.5;
  float s2 = vnoise(q2) * .62 + vnoise(q2 * 2.1 + 5.3) * .38;
  float smoke = clamp(s1 * .85 + s2 * .5 - .25, 0., 1.);
  smoke = mix(smoke, .5, .4 * iParams.w);                   // thick fog = more uniform
  float smokeB = .2 + 1.6 * smoke;                          // beam modulation

  // ---- background: deep base + lit haze
  vec3 col = cA * .2;
  // stage back-glow behind the crowd: a wide low band of light (the stage is behind them)
  float tB = (TRUSS_Z + 4. - ro.z) / max(rd.z, .05);
  vec3 PB = ro + rd * tB;
  float back = exp(-pow(abs(PB.y - .9) / (2.2 + 2. * haze), 1.6)) * exp(-PB.x * PB.x / (300. + 200. * haze));
  float kickFlash = 1. + 1.7 * kick * mix(.4, 1., gI);
  vec3 fog = mix(cC, cB, .35) * back * .55;

  // wash lights: teal cones from the truss down onto the floor
  float wash = 0.;
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    vec3 Ew = vec3((fk - 1.5) * 5.5, TRUSS_Y - .5, TRUSS_Z - .3);
    float sw = sin(gBeat * TAU / 32. + fk * 1.9 + iSeed * 5.);
    vec3 Dw = normalize(vec3(sw * .35 + (fk - 1.5) * .08, -1., -.4 - .2 * cos(fk + gBar * .2)));
    vec3 w = ro - Ew;
    float b = dot(rd, Dw), dw = dot(rd, w), e = dot(Dw, w);
    float s = clamp((e - b * dw) / max(1. - b * b, 1e-4), 0., 14.);
    vec3 Q = Ew + Dw * s;
    float t = max(dot(Q - ro, rd), 0.);
    vec3 dv = ro + rd * t - Q;
    float r = .12 + s * .3;
    wash += exp(-dot(dv, dv) / (r * r)) * (.32 / (1. + s * .2));
  }
  fog += cC * wash;
  fog *= haze * mix(.4, 1., gI) * kickFlash * (.15 + 1.7 * smoke * smoke);
  col += fog;

  // ---- truss (silhouette with lattice against the glow)
  float trussMask = 0.;
  {
    float tz = (TRUSS_Z - ro.z) / rd.z;
    vec3 P = ro + rd * tz;
    float ty = P.y - TRUSS_Y;
    if (abs(ty) < 1.2) {
      float pw = tz * pix * 1.2;
      float inX = smoothstep(17., 16.6, abs(P.x));
      float chord = smoothstep(.06 + pw, .06 - pw, abs(abs(ty) - .4));
      float u = fract(P.x / 1.05);
      float zz = .4 * (1. - 4. * abs(u - .5));
      float diag = smoothstep(.03 + pw, .03 - pw, abs(ty - zz) / 3.2) * step(abs(ty), .42);
      trussMask = clamp(max(chord, diag), 0., 1.) * inX;
      vec2 fx = vec2(mod(P.x + 1.375, 2.75) - 1.375, ty + .68);  // hanging fixtures
      float fixt = smoothstep(pw, -pw, sdBox2(fx, vec2(.24, .22)) - .04) * smoothstep(15.5, 15., abs(P.x));
      trussMask = max(trussMask, fixt);
      col = mix(col, cA * .06 + fog * .05, trussMask);
    }
  }
  // side trusses carrying the crossing-beam emitters (layout B)
  float wSide = smoothstep(.1, .35, iParams.y) * (1. - smoothstep(.65, .9, iParams.y));
  if (wSide > 0.) {
    float sd = rd.x > 0. ? 1. : -1.;
    float tx = (sd * 13.4 - ro.x) / rd.x;
    vec3 P = ro + rd * tx;
    float ty = P.y - 6.;
    float fz = max(fwidth(P.z), 1e-4), fy = max(fwidth(P.y), 1e-4);
    float inZ = smoothstep(11., 12., P.z) * smoothstep(33., 32., P.z);
    float chord = 1. - smoothstep(.05 - fy, .05 + fy, abs(abs(ty) - .3));
    float u = fract(P.z / .9);
    float zz = .3 * (1. - 4. * abs(u - .5));
    float diag = (1. - smoothstep(.025, .025 + fy + fz * .7, abs(ty - zz) / 2.8)) * step(abs(ty), .32);
    float sm = clamp(max(chord, diag), 0., 1.) * inZ * wSide;
    col = mix(col, cA * .06 + fog * .05, sm);
  }

  fragColor = vec4(col, 1.); return;
  // ---- laser rig setup
  float N = max(ceil(nB), 1.);
  float wAB = smoothstep(0., .5, iParams.y), wBC = smoothstep(.5, 1., iParams.y);
  float ph = TAU * gBeat / sweepP;
  // A: fan clusters on the truss
  float G = (h1 < .5 || N < 5.) ? 1. : 3.;
  float M = ceil(N / G);
  bool sky = G < 1.5 && h4 > .6 && N >= 4.;               // flat "liquid sky" sheet pattern
  float spreadA = mix(.55, 1.5, h3) * (G > 1.5 ? .55 : 1.) * (1. + .14 * kick);
  if (sky) spreadA = mix(1.1, 1.6, h3) * (1. + .1 * kick);
  gH2 = h2; gH4 = h4; gH5 = h5; gPh0 = ph; gClap = clap; gFlip = flipS; gSky = sky;
  vec3 cE0 = vec3(0.), cM0 = vec3(0., 0., -1.), cS0 = vec3(1., 0., 0.), cE1 = cE0, cM1 = cM0, cS1 = cS0, cE2 = cE0, cM2 = cM0, cS2 = cS0;
  if (wAB < 1.) {
    fanFrame(0., G, cE0, cM0, cS0);
    if (G > 1.5) { fanFrame(1., G, cE1, cM1, cS1); fanFrame(2., G, cE2, cM2, cS2); }
  }
  // C: tunnel apex & ring
  vec3 EC = ro + fw * 44. + up * (1.2 * sin(gBar * .37 + iSeed * 6.)) + rt * (1.8 * sin(gBar * .23 + iSeed * 9.));
  float rotC = gBeat * mix(.04, .2, gI) * (h2 < .5 ? 1. : -1.) * TAU / 4. + (.5 - .5 * flipS) * PI / N;
  float RC = mix(2.4, 4.2, h4) * (1. - .16 * kick);

  // ---- lasers
  float ext = mix(.006, .03, iParams.w);
  float haloR = mix(.12, .4, iParams.w);
  float haloA = mix(.035, .12, iParams.w);
  float W0 = .018;
  float beamI = mix(.75, 1.2, gI) * (1. + .8 * kick);
  float strobe = 1. - step(.5, fract(gBeat * 2.)) * clap * smoothstep(.6, .95, gI) * step(.4, h4);
  float beams = 0., halo = 0., emit = 0.;
  float wa = (1. - wAB) * (1. - wBC), wb = wAB * (1. - wBC);
  float shareI = inversesqrt(M * wa + wb + N * wBC);        // emitters shared by many beams glow less each
  float aSt = M > 1. ? spreadA / (M - 1.) : 0.;
  vec2 fanR = vec2(cos(-.5 * aSt * (M - 1.)), sin(-.5 * aSt * (M - 1.)));   // fan angle phasor (A)
  vec2 fanS = vec2(cos(aSt), sin(aSt));
  vec2 ringR = vec2(cos(rotC), sin(rotC)), ringS = vec2(cos(TAU / N), sin(TAU / N));   // ring phasor (C)
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float on = clamp(nB - fi, 0., 1.);
    if (on <= 0.) break;
    vec3 E = vec3(0.), D = vec3(0.);
    if (wAB < 1.) {
      float gi = mod(fi, G);
      if (i > 0 && gi < .5) fanR = vec2(fanR.x * fanS.x - fanR.y * fanS.y, fanR.y * fanS.x + fanR.x * fanS.y);
      vec3 Ec = gi < .5 ? cE0 : gi < 1.5 ? cE1 : cE2;
      vec3 Mc = gi < .5 ? cM0 : gi < 1.5 ? cM1 : cM2;
      vec3 Sc = gi < .5 ? cS0 : gi < 1.5 ? cS1 : cS2;
      E += Ec * wa;
      D += (Mc * fanR.x + Sc * fanR.y) * wa;
    }
    if (wAB > 0. && wBC < 1.) {
      float side = mod(fi, 2.) < .5 ? -1. : 1.;
      float k = floor(fi * .5);
      float scis = h2 < .5 ? 0. : PI * (side * .5 + .5);
      float phi = .2 + .55 * sin(ph + k * .8 * h3 + scis) * flipS;   // backbeat: sweep mirrors
      float pitch = -.06 + .12 * sin(ph * .5 + k * 1.1 + side) + .05 * (hash11(k * 3.1 + pat) - .5);
      float zk = mix(13., 30., fract(k * .618 + .35));
      E += vec3(side * 13., 5.35, zk) * wb;
      D += normalize(vec3(-side * cos(phi), sin(pitch), -sin(phi))) * wb;
    }
    if (wBC > 0.) {
      if (i > 0) ringR = vec2(ringR.x * ringS.x - ringR.y * ringS.y, ringR.y * ringS.x + ringR.x * ringS.y);
      float ring = (h3 > .55 && mod(fi, 2.) > .5) ? .55 : 1.;
      vec3 T = ro + (rt * ringR.x + up * ringR.y) * RC * ring - fw * 3.;
      E += EC * wBC;
      D += normalize(T - EC) * wBC;
    }
    D = normalize(D);

    // closest approach of the view ray to the beam
    vec3 w = ro - E;
    float b = dot(rd, D), dw = dot(rd, w), e = dot(D, w);
    float den = max(1. - b * b, 1e-5);
    float s = clamp((e - b * dw) / den, 0., 90.);
    vec3 Q = E + D * s;
    float t = max(dot(Q - ro, rd), 0.);
    vec3 dv = ro + rd * t - Q;
    float d2 = dot(dv, dv);
    float pw = max(t, .2) * pix;
    float att = on / (1. + s * ext * (1. + s * ext));
    float graze = min(inversesqrt(den), 1.8);               // looking down the beam = brighter
    float we = min(W0 + pw * .75, pw * 4.);                // pixel-footprint AA width
    if (d2 < 12. * we * we) {
      float sh = 1. + aHat * .7 * sin(s * 2.3 - iTime * 40. + fi * 2.1);   // hat shimmer
      beams += exp(-d2 / (we * we)) * sqrt(W0 / we) * att * graze * sh;
    }
    float hr = min(haloR, pw * 60.);
    halo += hr * hr / (d2 + hr * hr) * att * min(graze, 1.4);
    // emitter hot spot + glare when the beam points at the lens
    vec3 ve = E - ro; float te = dot(ve, rd);
    float vv = dot(ve, ve);
    float pd2 = max(vv - te * te, 0.);
    float r0 = .05 + .002 * te;
    emit += (r0 * r0 / (pd2 + r0 * r0) * 2.2 + .25 / (1. + pd2 * 3.)) * on * shareI;
    float ca = -dot(D, ve) * inversesqrt(vv);
    if (ca > .996) {
      float glare = pow(ca, 1800.);
      vec3 lp = ve - te * rd;
      float ite = 1. / max(te, 1.);
      float ax = abs(dot(lp, rt)) * ite, ay = abs(dot(lp, up)) * ite;
      emit += glare * on * (1.5 * exp(-ay * 900.) * exp(-ax * 8.) + .8 / (1. + pd2 * ite * ite * 400.));
    }
  }
  // "liquid sky": continuous sheet between the fan beams, smoke visible in it
  float sheet = 0.;
  if (sky && wAB < 1.) {
    vec3 n = normalize(cross(cM0, cS0));
    float dn = dot(rd, n);
    float tp = dot(cE0 - ro, n) / dn;
    if (tp > 0.) {
      vec3 v = ro + rd * tp - cE0;
      float ang = atan(dot(v, cS0), dot(v, cM0));
      float edge = smoothstep(spreadA * .5 + .02, spreadA * .5 - .04, abs(ang));
      sheet = edge * .035 / max(abs(dn), .04) * exp(-length(v) * ext * 1.5) * smoothstep(.5, 4., length(v));
      sheet *= (1. - wAB) * smoothstep(3., 5.5, N) * (.25 + 2.2 * smoke * smoke);
    }
  }
  // accent beams (cD) on claps — from the truss ends, crossing in front
  float acc = 0.;
  float accI = clap * smoothstep(.25, .6, gI);
  if (accI > .01) {
    for (int i = 0; i < 2; i++) {
      float sg = float(i) * 2. - 1.;
      vec3 E = vec3(sg * 15., TRUSS_Y - .5, TRUSS_Z - 1.);
      vec3 D = normalize(vec3(-sg * (.45 + .25 * sin(gBar * PI + sg)), -.08 + .06 * sin(gBeat * PI * .5), -1.));
      vec3 w = ro - E;
      float b = dot(rd, D), dw = dot(rd, w), e = dot(D, w);
      float s = clamp((e - b * dw) / max(1. - b * b, 1e-5), 0., 90.);
      vec3 Q = E + D * s;
      float t = max(dot(Q - ro, rd), 0.);
      vec3 dv = ro + rd * t - Q;
      float d2 = dot(dv, dv);
      float pwa = max(t, .2) * pix;
      float we = min(sqrt(W0 * W0 + pwa * pwa), pwa * 4.);
      float hr = min(haloR, pwa * 60.);
      acc += (exp(-d2 / (we * we)) * sqrt(W0 / we) * 1.4 + hr * hr / (d2 + hr * hr) * haloA * 1.5) / (1. + s * ext);
      vec3 ve = E - ro; float te = dot(ve, rd);
      acc += .15 / (1. + max(dot(ve, ve) - te * te, 0.) * 8.);
    }
    acc *= accI;
  }
  beams *= strobe; halo *= strobe; sheet *= strobe;
  vec3 laser = cB * (beams * 4.5 * smokeB + sheet * 3.) * beamI
             + mix(cB, cC, .55) * halo * haloA * beamI * (.55 + .9 * smoke) * kickFlash
             + mix(cB, vec3(1.), .35) * emit * beamI * .9
             + cD * acc * 4. * smokeB;
  col += laser * (1. - trussMask * .6);

  // ---- crowd (front-to-back so hidden layers are skipped)
  float crowd = iParams.x * mix(.5, 1., gI);
  float T = 1.;
  if (crowd > .01) {
    float armP = mix(.2, .85, gI) * mix(.7, 1., iParams.x);
    float jump = smoothstep(.55, 1., gI) * clamp(aEnergy * 1.3, .3, 1.);
    float sc = 1. + .38 * tilt;
    float lift = .045 * tilt;
    float dens = mix(.3, .97, crowd);
    vec3 acc3 = vec3(0.);
    vec4 l = crowdLayer(uv, col, 0., .145 * sc, -.43 + lift * 1.3, -ro.x * .07, vec3(0.), 1.1, dens * .8, armP, jump);
    acc3 += l.rgb * l.a; T = 1. - l.a;
    if (T > .002) {
      l = crowdLayer(uv, col, 1., .082 * sc, -.29 + lift, -ro.x * .03, fog * .1 + cA * .05, .9, dens * .9, armP, jump * .85);
      acc3 += T * l.rgb * l.a; T *= 1. - l.a;
    }
    if (T > .002) {
      l = crowdLayer(uv, col, 2., .05 * sc, -.21 + lift, -ro.x * .012, fog * .4 + cA * .3, .7, dens, armP * .8, jump * .6);
      acc3 += T * l.rgb * l.a; T *= 1. - l.a;
    }
    col = acc3 + T * col;
  }

  // ---- laser persistence (short trails on fast sweeps), not through the crowd
  vec3 prev = texture(iPrev, fragCoord / iResolution).rgb;
  col = max(col, prev * mix(.2, .36, gI) * T);

  fragColor = vec4(max(col, 0.), 1.);
}
