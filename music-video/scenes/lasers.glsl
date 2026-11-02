// =============================================================================
// LASERS — the signature scene / cover-art homage.
// A dark warehouse full of haze. Laser emitters on a truss throw razor beams and
// fans through the smoke, choreographed to the beat; teal wash lights fill the fog;
// a low stage glow back-lights a black crowd of heads and raised hands (cover-art silhouettes).
//
// iParams (all 0..1, 0,0,0,0 = eye-level fan show, no crowd, light haze):
//   x  crowd amount   0 = no crowd: the framing tilts up so the beams own the shot, and the
//                     stage deck, a back-lit DJ, an LED lip, a wet floor and laser floor-hits
//                     appear. .. 1 = dense 3-row silhouette crowd with parallax (hair / caps /
//                     buns, raised fists, open hands, V arms, clappers, phones). Density also
//                     grows with intensity; raised hands / jumping grow with intensity.
//   y  beam layout    0   = fans from emitters on the truss (1 or 3 clusters per pattern)
//                     0.5 = beams crossing the room from left/right side trusses (scissors)
//                     1   = cone / tunnel of beams converging on the camera from a far emitter
//                     (in-between values blend the layouts)
//   z  camera         0 = eye level at the back, looking at the truss
//                     1 = low angle close to the stage, looking up (crowd looms, beams overhead)
//   w  haze density   0 = light haze, crisp beams, dark air .. 1 = thick fog, big halos, lit smoke
// Intensity: beam count 1 (calm) .. 8 (peak), sweep speed 16 -> 2-4 beats per cycle,
//        crowd density / raised hands / jumping, fog brightness.
// Audio: kick = fog flash + beam pulse + fan breathing + tunnel squeeze + stage-glow / rim pump,
//        backbeat (beats 2 & 4, intensity > ~0.6) = 3-frame fan flip / sweep mirror,
//        clap envelope = beam strobe on 8ths (peak) + two cD accent beams + clappers in the crowd
//        bring their hands together, hats = beam shimmer.
//        Crowd sways / dips (calm) or jumps (peak) on the beat grid, hands pump on the beat.
// Pattern (sweep mode, 1 or 3 emitter clusters, spread, tilt, "liquid sky" sheet) changes
// every 2 bars at high intensity (4 bars when calm), on the downbeat.
// iSeed: offsets pattern sequence, camera drift, and per-shot framing (yaw + dutch angle).
//
// PERF NOTE (SwiftShader): total code size costs time on every pixel (even skipped code), and
// inside loops every branch runs masked. So: one copy of the crowd / arm / beam code (loops, not
// repeated calls), branch-free per-person code, expensive one-offs (glare, floor hits) outside loops.
// =============================================================================

const float TRUSS_Y = 8.2;
const float TRUSS_Z = 24.;
const float STAGE_Z = 21.5;

float gBeat, gBar, gI, gPh, gPhP, gMass, smokeG;
vec3 gRo, gRd, gRt, gUp, gFloorP, gGlW; vec4 gGl; float gPix, gExt, gHaloR, gFloorOk;
vec2 gB1, gBh, gBq;     // (cos, sin) of the beat phase: full beat, half-rate, quarter-rate (crowd motion)
vec4 gCrowdPh;          // shared crowd beat phases: (cos beat, |sin half-beat|) for two groups, slightly offset
float gH2, gH4, gH5, gPhC, gClap, gFlip; bool gSky;

// Trig is expensive in SwiftShader, so per-pixel-uniform motion uses these cheap stand-ins:
// cyc(x) ~ sin(TAU*x) (smoothstep-shaped wave), cs(a) = (cos a, sin a) Taylor, good for |a| < 2.
float cyc(float x) { float f = abs(2. * fract(x - .25) - 1.); return 2. * f * f * (3. - 2. * f) - 1.; }
vec2 cs(float a) { float a2 = a * a; return vec2(1. - a2 * (.5 - a2 * (1. / 24. - a2 / 720.)), a * (1. - a2 * (1. / 6. - a2 / 120.))); }

// alternates -1 / +1 every unit of bt, with a quick ease at the start of each unit
float snapWave(float bt, float ease) {
  float k = floor(bt), f = fract(bt);
  float a = mod(k, 2.) * 2. - 1.;
  return mix(-a, a, smoothstep(0., ease, f));
}

// one laser beam from E along unit D: returns (core, halo, glare) for the current view ray.
// Closest approach of the ray to the beam is analytic; core width follows the pixel footprint (AA).
// Beams stop at the floor (with a hit spot), and clumps of haze drift along them (breakup).
// w = eye - E, dw = dot(rd, w), ww = dot(w, w) depend only on the emitter: shared by all beams of a fan.
vec3 beamW(vec3 E, vec3 w, float dw, float ww, vec3 D, float on, float id) {
  float b = dot(gRd, D), e = dot(D, w);
  float rden = inversesqrt(max(1. - b * b, 1e-5));
  float sMax = D.y < -.012 ? min((E.y - .03) / -D.y, 90.) : 90.;
  float s = clamp((e - b * dw) * rden * rden, 0., sMax);  // along the beam
  float t = max(b * s - dw, 0.);                           // along the ray
  vec3 dv = w + gRd * t - D * s;
  float d2 = dot(dv, dv);
  float pw = max(t, .2) * gPix;
  float we = min(.014 + pw * .6, pw * 3.2);
  float iw = 1. / we;
  float cg = max(1. - d2 * iw * iw * .25, 0.);            // ~gaussian core, compact
  cg *= cg;
  float se = s * gExt;
  // haze clumps drifting down the beam (cheap wave noise along s; code in loops is always paid for)
  float n = .5 + .5 * cyc(s * .11 + id * .37 - iTime * .3 + .25 * smokeG);
  float brk = .55 + .9 * n * n + .2 * n;
  float att = on / (1. + se * (1. + se));
  float graze = min(rden, 1.8);                            // looking down the beam = brighter
  float hr = min(gHaloR, pw * 60.);
  float hr2 = hr * hr;
  vec3 r = vec3(cg * cg * (.014 * iw * .65 + .35) * graze * brk, hr2 / (d2 + hr2) * min(graze, 1.4), 0.) * att;
  // beam points at the lens -> emitter glare. Only the strongest one is remembered here; the streak itself
  // is drawn once after the beam loops (code inside loops is always paid for in SwiftShader).
  float g = max(1. - (1. - e * inversesqrt(ww)) * 450., 0.);   // ~cos^1800 of the beam-to-lens angle
  g *= g; g *= g * on;
  if (g > gGl.x) { gGl = vec4(g, dw, ww, 0.); gGlW = w; }
  return r;
}

// anamorphic glare streak + hot core for the beam that points most directly into the lens
float glare() {
  float te = -gGl.y, ww = gGl.z;
  vec3 lp = -gGlW - te * gRd;
  float ite = 1. / max(te, 1.);
  float ax = abs(dot(lp, gRt)) * ite, ay = abs(dot(lp, gUp)) * ite;
  float pd2 = max(ww - te * te, 0.);
  float sx = max(1. - ax * 3., 0.), sy = max(1. - ay * 400., 0.);
  return gGl.x * (1.5 * sx * sx * sy * sy + .8 / (1. + pd2 * ite * ite * 400.));
}

vec3 beam(vec3 E, vec3 D, float on, float id) {
  vec3 w = gRo - E;
  return beamW(E, w, dot(gRd, w), dot(w, w), D, on, id);
}

// emitter hot spot: ve = emitter - eye
float emitGlow(vec3 ve, vec3 rd) {
  float te = dot(ve, rd);
  float pd2 = max(dot(ve, ve) - te * te, 0.);
  float r0 = .05 + .002 * te;
  return r0 * r0 / (pd2 + r0 * r0) * 2.2 + .25 / (1. + pd2 * 3.);
}

// fan cluster c (of G) on the truss: emitter E, main axis Mx, fan spread direction S
void fanFrame(float c, float G, out vec3 E, out vec3 Mx, out vec3 S) {
  float gc = c - (G - 1.) * .5;
  float mode = gI > .55 ? floor(gH2 * 3.) : 0.;             // calm: smooth sweeps only (no snaps)
  float sw = mode < .5 ? cyc(gPhC + gc * .207)
           : mode < 1.5 ? cyc(gPhC) * (c == 1. ? -1. : 1.)
           : snapWave(gBeat * .5 + gc * .5, .28);
  float yaw = .3 * sw * mix(.45, 1., gI) + gc * .22;
  float pitch = mix(-.06, -.36, gH5) + .12 * cyc(gPhC * .5 + .207 + gc * .159);
  float rl = (gH4 - .5) * 2.4 + .35 * cyc(gPhC * .25 + gc * .159);
  if (gSky) { yaw *= .4; pitch = -.15 + .045 * cyc(gPhC * .5) - .04 * gClap; rl = .05 * cyc(gPhC * .5); }
  rl *= gFlip;                                              // backbeat: the fan flips over
  Mx = normalize(vec3(yaw, pitch, -1.));
  vec3 R = normalize(cross(vec3(0, 1, 0), Mx)), U = cross(Mx, R);
  E = vec3(gc * 6.6, TRUSS_Y - .78, TRUSS_Z - .5);
  vec2 r = cs(rl);
  S = r.x * R + r.y * U;
}

// ---------------------------------------------------------------------------
// crowd silhouettes (2D SDF). p in "person" units: 1 = one person's width, y=0 shoulder line
// ---------------------------------------------------------------------------
float sdTaper(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);
  return length(pa - ba * h) - mix(ra, rb, h);
}
float sdEll(vec2 p, vec2 r) { return (length(p / r) - 1.) * min(r.x, r.y); }

// one arm from shoulder sh on side sg (+1 = right); ud / fd = upper arm / forearm direction
// (un-normalised, + x = outward). hand: 0 fist, 1 open hand, 2 phone. Deliberately compact and
// branch-free: inside loops SwiftShader pays for every branch, so all poses / hands share one path.
float armSDF(vec2 q, vec2 sh, float sg, vec2 ud, vec2 fd, float hand) {
  vec2 u = normalize(vec2(sg * ud.x, ud.y)), f = normalize(vec2(sg * fd.x, fd.y));
  vec2 el = sh + u * .5, wr = el + f * .44;
  float d = min(sdSeg2(q, sh, el) - .1, sdSeg2(q, el, wr) - .068);
  vec2 hq = q - wr;
  vec2 hl = vec2((hq.x * f.y - hq.y * f.x) * sg, dot(hq, f));   // x: across (+ = outward), y: along forearm
  // one shared path for every hand: palm box (fist / open palm / phone) + 4 splayed fingers via domain
  // repetition (one segment evaluation; zero length for a fist) + thumb
  bool open = hand > .5 && hand < 1.5;
  vec4 hb = hand < .5 ? vec4(.035, .045, .045, .06) : open ? vec4(.045, .04, .035, .06) : vec4(.06, .108, .014, .135);
  float hd = sdBox2(hl - vec2(0., hb.w), hb.xy) - hb.z;
  float fk = clamp(floor(hl.x / .036 + 2.), 0., 3.) - 1.5;  // finger slot -1.5 .. 1.5
  float fl = open ? .13 - .03 * abs(fk) : 0.;
  hd = smin(hd, sdSeg2(hl, vec2(fk * .034, .1), vec2(fk * .052, .1 + fl)) - .017, .02);
  hd = min(hd, sdSeg2(hl, vec2(-.05, .04), open ? vec2(-.12, .11) : vec2(-.05, .05)) - .021);  // thumb
  gPhP = min(gPhP, hand > 1.5 ? hd + .028 : 1e3);
  return min(d, hd);
}

// solid mass of bodies below the shoulder line: rounded humps of shoulders / heads of people
// further back in the same row (lower and lumpier when the crowd is sparse)
float massLine(vec2 p, float L, float dens) {
  float x = p.x * 1.7 + L * 3.1;
  float f = fract(x) - .5;
  float hh = hash12(vec2(floor(x), L * 5.7 + 3.));
  float bump = max(.2 - f * f * .85, 0.) * (.3 + hh);
  return p.y + .8 + (1. - dens) * .3 + .07 * cyc(p.x * .27 + L * .16) - bump;
}

float crowdSDF(vec2 p, float L, float dens, float armP, float jump, bool det, float px) {
  float id0 = floor(p.x);
  float d = massLine(p, L, dens);
  gMass = d;
  gPh = 1e3;                                                // phone screens (emissive), set as a side output
  float dIn = -px * 5.;                                     // deeper inside than this: solid black, no rim -> done
  if (d < dIn) return d;
  bool far = L > 1.5;                                       // far row: tiny people, cheaper (2 cells, no hair / lean)
  float nb = fract(p.x) < .5 ? -1. : 1.;
  for (int kk = 0; kk < 3; kk++) {                          // own cell first, then the nearer / farther neighbour
    if (d < dIn || (far && kk == 2)) break;                 // far row: own + nearer neighbour cell only
    float id = id0 + (kk == 0 ? 0. : kk == 1 ? nb : -nb);
    float hp = hash12(vec2(id * 1.13 + 7.7, L * 13.7 + 1.3));
    if (hp > dens) continue;
    gPhP = 1e3;
    vec2 ha = fract(hp * vec2(97.31, 61.73) + vec2(.137, .591));   // more randoms derived from hp (cheap)
    vec2 hb = fract(ha.yx * vec2(17.13, 9.71) + hp * 5.31);
    vec2 hc = fract(ha * vec2(23.7, 31.3) + hb.yx * 7.1);
    float sc = mix(.86, 1.14, fract(hp * 7.31 + ha.y));
    float cx = id + .5 + (ha.x - .5) * .45;
    // two groups move slightly out of phase (shared phasors, no per-person trig)
    vec2 ph2 = ha.y < .5 ? gCrowdPh.xy : gCrowdPh.zw;
    float cb = ph2.x;                                     // cos(TAU*beat): 1 on the beat
    float amp = (hb.x > .25 ? 1. : .35) * mix(.04, .3, jump);
    float bob = -(.5 + .5 * cb);                          // dip on the beat
    float hop = ph2.y * 1.4;                              // |sin(PI*beat)|: jump, land on the beat
    float hy = (hc.y - .5) * .4 + amp * mix(bob, hop, jump);
    vec2 q = (p - vec2(cx, hy)) / sc;
    bool arms = hb.x < armP;
    float pose = fract(hp * 13.7 + hb.y);
    float sg = ha.x < .5 ? 1. : -1.;
    // (no per-person bounding tests: inside a loop SwiftShader runs every branch masked, so they cost more than they save)
    float qph = floor(ha.x * 4.);                         // one of 4 sway phases
    float sway = (qph < 1. ? gBq.y : qph < 2. ? gBq.x : qph < 3. ? -gBq.y : -gBq.x);
    // whole body leans / sways from the hips
    if (!far) {
      float la = (ha.y - .5) * .1 + sway * .04 * (1. - jump * .6);
      vec2 lr = vec2(1. - .5 * la * la, la);
      q.y += 1.4;
      q = vec2(lr.x * q.x + lr.y * q.y, -lr.y * q.x + lr.x * q.y);
      q.y -= 1.4;
    }
    float wS = mix(.86, 1.12, hc.x);                      // shoulder width
    float hs = mix(.9, 1.08, hb.y);                       // head size
    vec2 shR = vec2(.42 * wS, -.13), shL = vec2(-.42 * wS, -.13);
    vec2 sh1 = sg > 0. ? shR : shL, sh2 = sg > 0. ? shL : shR;
    float dd;
    {
    // torso: sloping trapezius on top, tapering to the waist
    vec2 tq = vec2(q.x * (1. + .2 * clamp(-q.y - .3, 0., 1.)), q.y + .62 * q.x * q.x / wS);
    dd = sdBox2(tq - vec2(0., -.88), vec2(.36 * wS, .76)) - .18;
    dd = smin(dd, sdSeg2(q, vec2(0., -.05), vec2(0., .3 * hs)) - .1, .1);
    vec2 hq = q - vec2(0., .47 * hs);
    float hd = sdEll(hq, vec2(.19, .235) * hs);
    // hair / headwear as one parametric ellipse: long hair, bun, cap, ponytail or short (inside the head)
    float hv = fract(hc.x * 5.3 + hp * 3.1);
    vec4 hr = hv < .18 ? vec4(0., -.17, .23, .28) : hv < .32 ? vec4(.04, .27, .095, .095)
            : hv < .44 ? vec4(0., .1, .235, .09) : hv < .54 ? vec4(.12, -.13, .075, .17) : vec4(0., 0., .1, .1);
    hd = smin(hd, sdEll(hq - hr.xy * hs, hr.zw * hs), .05);
    dd = smin(dd, hd, .06);
    }
    // pose -> arm directions only (one arm code path for every pose); default: arms hanging
    vec2 uA = vec2(.14, -1.), fA = vec2(.06, -1.), uB = uA, fB = fA;
    float hA = 0., hB = 0.;
    if (arms) {
      float sw = sway * .12;
      float pump = (.5 + .5 * cb) * jump;                 // hands highest on the beat
      float hand = hc.y < .45 ? 0. : 1.;
      hA = hand; hB = hand;
      if (pose < .3) {                                    // one arm up, other down
        uA = vec2(.2 + sg * sw - .12 * pump, 1.); fA = vec2(.06 + sg * sw * 1.3 - .08 * pump, 1.);
      } else if (pose < .62) {                            // both arms up in a V
        hA = hB = hc.y < .3 ? 0. : 1.;
        uA = vec2(.62 + sg * sw - .16 * pump, 1.); fA = vec2(.34 + sg * sw - .1 * pump, 1.);
        uB = vec2(.62 - sg * sw - .16 * pump, 1.); fB = vec2(.34 - sg * sw - .1 * pump, 1.);
      } else if (pose < .78) {                            // hands overhead, clapping on the claps
        float ci = .5 * gClap;
        uA = vec2(.33 + sw * .5 - .05 * pump, 1.); fA = vec2(-1.2 - ci, 1.);
        uB = vec2(.33 - sw * .5 - .05 * pump, 1.); fB = fA;
      } else if (pose < .9) {                             // filming the show: phone held up
        uA = vec2(.12 + sg * sw * .3, 1.); fA = vec2(-.1, 1.); hA = 2.;
      } else {                                            // pointing at the stage, fist pumping
        uA = vec2(.93 - .4 * pump + sg * sw * .5, 1.); fA = vec2(.8 - .3 * pump, 1.); hA = 0.;
      }
    }
    for (int a = 0; a < 2; a++) {                         // loop, not two calls: one copy of the arm code
      bool aA = a == 0;
      dd = smin(dd, armSDF(q, aA ? sh1 : sh2, aA ? sg : -sg, aA ? uA : uB, aA ? fA : fB, aA ? hA : hB), .04);
    }
    d = min(d, dd * sc);
    gPh = min(gPh, gPhP * sc);
  }
  return d;
}

// returns layer colour (rgb) and coverage (a)
vec4 crowdLayer(vec2 uv, vec3 bg, float L, float unit, float baseY, float parX,
                vec3 silCol, vec3 veil, vec3 rimCol, float dens, float armP, float jump, bool det) {
  if (uv.y > baseY + 2.05 * unit) return vec4(0.);
  vec2 p = vec2((uv.x - parX) / unit + L * 37.3, (uv.y - baseY) / unit);
  float px = 1. / (iResolution.y * unit);
  float d = crowdSDF(p, L, dens, armP, jump, det, px);
  vec2 gd = vec2(dFdx(d), dFdy(d));                         // SDF gradient from screen derivatives (rim direction)
  float ph = gPh;
  float m = smoothstep(px, -px, d);
  if (m <= 0.) return vec4(0.);
  // haze veil: heads/shoulders are wrapped in lit smoke, bodies further down sink into black
  vec3 c = silCol + veil * smoothstep(-1.3, .9, p.y);
  c += mix(cC, vec3(1.), .55) * .32 * smoothstep(px * .7, -px * .7, ph);   // phone screen
  if (d > -px * 4.5) {                                      // rim light from the stage / beams behind
    vec2 ld = normalize(vec2(-uv.x * .8, 1.));
    float facing = clamp(dot(gd, ld) / px, 0., 1.);
    facing *= facing;
    float rim = exp(min(d, 0.) / (px * 1.15));
    rim *= smoothstep(0., px * 3., gMass - d);                // no rim on the fake body mass
    c += (bg + rimCol) * rim * facing;
  }
  return vec4(c, m);
}

// ---------------------------------------------------------------------------
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - .5 * iResolution) / iResolution.y;
  gI = clamp(iIntensity, 0., 1.);
  gBeat = aBeatCount + aBeatPhase;
  gBar = (gBeat - 3.) / 4.;                                 // bar 0 starts at the 8.07 s downbeat
  gB1 = vec2(cyc(gBeat + .25), cyc(gBeat));
  gBh = vec2(cyc(gBeat * .5 + .25), cyc(gBeat * .5));
  gBq = vec2(cyc(gBeat * .25 + .25), cyc(gBeat * .25));
  gCrowdPh = vec4(gB1.x, abs(gBh.y), cyc(gBeat + .3), abs(cyc(gBeat * .5 + .025)));
  float kick = aKick;
  float clap = smoothstep(.12, .55, aSnare);
  // fan flip: toggles on the backbeat (beats 2 & 4) at groove/drop intensity, 3-frame snap
  float flipS = mix(1., snapWave((gBeat - 4.) * .5, .1), smoothstep(.5, .7, gI));
  float haze = .3 + .7 * iParams.w;
  float crowd = iParams.x * mix(.5, 1., gI);

  // pattern: changes every 2 bars at peak, every 4 when calm
  float patLen = gI > .55 ? 2. : 4.;
  float pat = floor(gBar / patLen) + floor(iSeed * 97.);
  float h1 = hash11(pat * 1.31 + .17), h2 = hash11(pat * 2.71 + .53);
  float h3 = hash11(pat * .93 + .91), h4 = hash11(pat * 3.17 + .29), h5 = hash11(pat * 5.37 + .71);
  float sweepP = gI > .8 ? (h1 < .3 ? 2. : 4.) : gI > .45 ? 8. : 16.;   // beats per sweep cycle
  float nB = floor(1.5 + 7. * pow(gI, 1.8));                // active beams: 1 (calm) .. 8 (peak)

  // ---- camera
  float tilt = iParams.z;
  float tt = iTime + iSeed * 40.;
  vec3 ro = vec3(1.3 * cyc(tt * .0175), mix(1.75, .7, tilt) + .08 * cyc(tt * .0366), mix(0., 11., tilt));
  float sx = (hash11(iSeed * 71.3 + 2.1) - .5) * 2.;       // per-shot framing offset
  float noCrowd = 1. - smoothstep(0., .3, iParams.x);       // no crowd: frame higher, the beams own the shot
  vec3 ta = vec3(.6 * cyc(tt * .0111 + .16) + sx * 3.5, mix(3.1, 4.9, tilt) + 1.8 * noCrowd, TRUSS_Z);
  float fl = mix(1.15, .82, tilt);
  float roll = .025 * cyc(tt * .0207) - sx * .05 * gI;
  vec3 fw = normalize(ta - ro);
  vec3 rt = normalize(cross(fw, vec3(roll, 1., 0.)));
  vec3 up = cross(rt, fw);
  vec3 rd = normalize(uv.x * rt + uv.y * up + fl * fw);
  float pix = 1. / (iResolution.y * fl);

  // ---- smoke density (screen space, two drifting layers)
  vec2 hp = uv * vec2(1.4, 2.) + vec2(ro.x * .06, 0.);
  vec2 q1 = hp * 1.3 + vec2(iTime * .035, -iTime * .012);
  float s1 = vnoise(q1) * .6 + vnoise(q1 * 2.03 + 17.1) * .36;
  vec2 q2 = hp * 3.2 + vec2(-iTime * .06, iTime * .02) + s1 * 1.5;
  float s2 = vnoise(q2) * .62 + vnoise(q2 * 2.1 + 5.3) * .38;
  float smoke = clamp(s1 * .85 + s2 * .5 - .25, 0., 1.);
  smoke = mix(smoke, .5, .4 * iParams.w);                   // thick fog = more uniform
  float smokeB = .25 + 1.5 * smoke;                         // beam modulation
  smokeG = smoke * 4.;                                      // also de-regularises the beam breakup

  // ---- stage deck + DJ booth (only visible without a crowd, which hides it) and the floor
  float tS = (STAGE_Z - ro.z) / max(rd.z, .05);
  vec3 PS = ro + rd * tS;
  float stageM = 0.;
  float stageVis = 1. - smoothstep(0., .2, crowd);          // a crowd hides stage, floor hits and lip: skip them
  if (stageVis > 0.) {
    float pw = tS * pix;
    float deck = smoothstep(pw, -pw, sdBox2(PS.xy, vec2(11.5, .8)));
    float booth = sdBox2(PS.xy - vec2(0., 1.), vec2(1.5, .2)) - .04;
    // the DJ behind the booth, back-lit; a hand goes up on the beat at peaks
    vec2 dj = PS.xy - vec2(.4 + .05 * gBq.y, 0.);
    float djd = min(sdEll(dj - vec2(0., 1.62), vec2(.27, .17)), length(dj - vec2(.02, 1.95)) - .115);
    djd = min(djd, sdBox2(dj - vec2(0., 1.35), vec2(.21, .25)));
    float up = smoothstep(.5, .8, gI) * (.8 + .2 * gB1.x);
    djd = min(djd, sdSeg2(dj, vec2(.22, 1.66), vec2(.38 + .1 * up, 1.75 + .62 * up)) - .05);
    stageM = max(deck, smoothstep(pw, -pw, min(booth, djd))) * stageVis;
  }
  gFloorOk = 0.; gFloorP = vec3(0.);
  float tF = rd.y < -.002 ? -ro.y / rd.y : 1e4;
  float onFloor = tF < tS ? 1. : 0.;
  if (onFloor * stageVis > 0.) { gFloorOk = 1.; gFloorP = ro + rd * tF; }
  float floorW = onFloor * smoothstep(0., 6., tS - tF);    // floor fades into the haze towards the stage

  // ---- background: deep base + lit haze
  vec3 col = cA * .14;
  float kickFlash = 1. + 1.7 * kick * mix(.4, 1., gI);
  // stage back-glow: a wide low band of light behind the stage that silhouettes the crowd.
  // On the floor it shows as a soft reflection (mirror the band height).
  float tB = (TRUSS_Z + 4. - ro.z) / max(rd.z, .05);
  vec3 PB = ro + rd * tB;
  float bw = (1.5 + 1.6 * haze);
  float ab = (PB.y - 1.2) / bw, af = (-PB.y - 1.2) / bw;
  ab *= ab; af *= af;
  float bx = 1. / (1. + PB.x * PB.x / (140. + 110. * haze));
  float back = mix(1. / (1. + ab * (1. + ab)) * (1. - .8 * stageM), .1 * (.3 + smoke) / (1. + af * (1. + af)) * smoothstep(4., 16., tF), floorW) * bx;
  vec3 fogBack = mix(cC, cB, .3) * back * (.25 + 1.3 * smoke * smoke) * (1. + .6 * kick * gI);

  // wash lights: teal cones from the truss down onto the floor
  float wash = 0.;
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    vec3 Ew = vec3((fk - 1.5) * 5.5, TRUSS_Y - .5, TRUSS_Z - .3);
    float sw = cyc(gBeat / 32. + fk * .302 + iSeed * .8);
    vec3 Dw = normalize(vec3(sw * .35 + (fk - 1.5) * .08, -1., -.4 - .2 * cyc(fk * .159 + gBar * .0318 + .25)));
    vec3 w = ro - Ew;
    float b = dot(rd, Dw), dw = dot(rd, w), e = dot(Dw, w);
    float s = clamp((e - b * dw) / max(1. - b * b, 1e-4), 0., 14.);
    vec3 Q = Ew + Dw * s;
    float t = max(dot(Q - ro, rd), 0.);
    vec3 dv = ro + rd * t - Q;
    float r = .12 + s * .3;
    float g = max(1. - dot(dv, dv) / (r * r) * .25, 0.);
    wash += g * g * g * (.32 / (1. + s * .2));
  }
  vec3 fog = cC * wash * (.12 + 1.7 * smoke * smoke) + fogBack * .8;
  fog *= haze * mix(.4, 1., gI) * kickFlash;
  col += fog;
  col *= 1. - stageM * .82;
  // thin LED strip along the stage lip, a horizon line that pulses with the kick
  if (stageVis > 0.) {
    float pw = tS * pix;
    float lip = exp(-abs(PS.y - .8) / (pw * 1.2 + .012)) * smoothstep(11.5, 10.5, abs(PS.x));
    col += mix(cC, cB, .5) * lip * (.2 + .5 * kick) * mix(.4, 1., gI) * (1. - onFloor) * stageVis;
  }

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

  // ---- laser rig setup
  float N = max(ceil(nB), 1.);
  float wAB = smoothstep(0., .5, iParams.y), wBC = smoothstep(.5, 1., iParams.y);
  float ph = gBeat / sweepP;                                // sweep phase in cycles
  // A: fan clusters on the truss
  float G = (h1 < .5 || N < 5.) ? 1. : 3.;
  float M = ceil(N / G);
  bool sky = G < 1.5 && h4 > .6 && N >= 4.;               // flat "liquid sky" sheet pattern
  float spreadA = mix(.55, 1.5, h3) * (G > 1.5 ? .55 : 1.) * (1. + .14 * kick);
  if (sky) spreadA = mix(1.1, 1.6, h3) * (1. + .1 * kick);
  gH2 = h2; gH4 = h4; gH5 = h5; gPhC = ph; gClap = clap; gFlip = flipS; gSky = sky;
  vec3 cE0 = vec3(0.), cM0 = vec3(0., 0., -1.), cS0 = vec3(1., 0., 0.), cE1 = cE0, cM1 = cM0, cS1 = cS0, cE2 = cE0, cM2 = cM0, cS2 = cS0;
  if (wAB < 1.) {
    fanFrame(0., G, cE0, cM0, cS0);
    if (G > 1.5) {
      for (int c = 1; c < 3; c++) {                          // loop, not two calls: less code for SwiftShader
        vec3 E, Mx, S;
        fanFrame(float(c), G, E, Mx, S);
        if (c == 1) { cE1 = E; cM1 = Mx; cS1 = S; } else { cE2 = E; cM2 = Mx; cS2 = S; }
      }
    }
  }
  // C: tunnel apex & ring
  vec3 EC = ro + fw * 44. + up * (1.2 * cyc(gBar * .059 + iSeed * .95)) + rt * (1.8 * cyc(gBar * .0366 + iSeed * 1.43));
  float rotC = gBeat * mix(.04, .2, gI) * (h2 < .5 ? 1. : -1.) / 4. + (.5 - .5 * flipS) * .5 / N;   // cycles
  float RC = mix(2.4, 4.2, h4) * (1. - .16 * kick);

  // ---- lasers
  float ext = mix(.006, .03, iParams.w);
  float haloR = mix(.12, .4, iParams.w);
  float haloA = mix(.035, .12, iParams.w);
  float W0 = .016;
  float beamI = mix(.75, 1.2, gI) * (1. + .8 * kick);
  float strobe = 1. - step(.5, fract(gBeat * 2.)) * clap * smoothstep(.6, .95, gI) * step(.4, h4);
  float beams = 0., halo = 0., emit = 0.;
  gRo = ro; gRd = rd; gRt = rt; gUp = up; gPix = pix; gExt = ext; gHaloR = haloR;
  gGl = vec4(0.); gGlW = vec3(0.);
  float wa = (1. - wAB) * (1. - wBC), wb = wAB * (1. - wBC);
  bool pureA = wa > .999, pureC = wBC > .999;
  float aSt = M > 1. ? spreadA / (M - 1.) : 0.;
  vec2 fanR = cs(-.5 * aSt * (M - 1.)), fanS = cs(aSt);   // fan angle phasor (A)
  vec2 ringR = vec2(cyc(rotC + .25), cyc(rotC)), ringS = vec2(cyc(1. / N + .25), cyc(1. / N));   // ring phasor (C)
  vec3 bh = vec3(0.);
  if (pureA || pureC) {
    // fans (1 or 3 clusters) and the tunnel share their emitters: one loop, emitter terms precomputed.
    // (A single copy of the beam code matters: SwiftShader pays for code size on every pixel.)
    vec3 E0 = pureA ? cE0 : EC;
    emit += emitGlow(E0 - ro, rd) * sqrt(pureA ? floor((N - 1.) / G) + 1. : N);
    if (pureA && G > 1.5) {
      emit += emitGlow(cE1 - ro, rd) * sqrt(floor((N - 2.) / G) + 1.);
      emit += emitGlow(cE2 - ro, rd) * sqrt(max(floor((N - 3.) / G) + 1., 0.));
    }
    vec3 w0 = ro - E0, w1 = ro - cE1, w2 = ro - cE2;
    vec3 dws = vec3(dot(rd, w0), dot(rd, w1), dot(rd, w2)), wws = vec3(dot(w0, w0), dot(w1, w1), dot(w2, w2));
    vec2 rr = pureA ? fanR : ringR, rS = pureA ? fanS : ringS;
    float Gl = pureA ? G : 1.;
    for (int i = 0; i < 12; i++) {
      float fi = float(i);
      float on = clamp(nB - fi, 0., 1.);
      if (on <= 0.) break;
      float gi = mod(fi, Gl);                                // cluster of this beam
      if (i > 0 && gi < .5) rr = vec2(rr.x * rS.x - rr.y * rS.y, rr.y * rS.x + rr.x * rS.y);
      vec3 D = pureA ? (gi < .5 ? cM0 : gi < 1.5 ? cM1 : cM2) * rr.x + (gi < .5 ? cS0 : gi < 1.5 ? cS1 : cS2) * rr.y
                     : normalize(ro + (rt * rr.x + up * rr.y) * RC * ((h3 > .55 && mod(fi, 2.) > .5) ? .55 : 1.) - fw * 3. - EC);
      bool c0 = gi < .5, c1 = gi < 1.5;
      bh += beamW(c0 ? E0 : c1 ? cE1 : cE2, c0 ? w0 : c1 ? w1 : w2, c0 ? dws.x : c1 ? dws.y : dws.z,
                  c0 ? wws.x : c1 ? wws.y : wws.z, D, on, fi);
    }
  } else {                                                   // B, or blends between layouts
    float shareI = inversesqrt(M * wa + wb + N * wBC);
    for (int i = 0; i < 12; i++) {
      float fi = float(i);
      float on = clamp(nB - fi, 0., 1.);
      if (on <= 0.) break;
      vec3 E = vec3(0.), D = vec3(0.);
      if (wa > 0.) {
        float gi = mod(fi, G);
        if (i > 0 && gi < .5) fanR = vec2(fanR.x * fanS.x - fanR.y * fanS.y, fanR.y * fanS.x + fanR.x * fanS.y);
        vec3 Ec = gi < .5 ? cE0 : gi < 1.5 ? cE1 : cE2;
        vec3 Mc = gi < .5 ? cM0 : gi < 1.5 ? cM1 : cM2;
        vec3 Sc = gi < .5 ? cS0 : gi < 1.5 ? cS1 : cS2;
        E += Ec * wa;
        D += (Mc * fanR.x + Sc * fanR.y) * wa;
      }
      if (wb > 0.) {
        float side = mod(fi, 2.) < .5 ? -1. : 1.;
        float k = floor(fi * .5);
        float scis = h2 < .5 ? 0. : .5 * (side * .5 + .5);
        float phi = .2 + .55 * cyc(ph + k * .127 * h3 + scis) * flipS;   // backbeat: sweep mirrors
        float pitch = -.06 + .12 * cyc(ph * .5 + k * .175 + side * .159) + .05 * (hash11(k * 3.1 + pat) - .5);
        float zk = mix(13., 30., fract(k * .618 + .35));
        vec2 r = cs(phi);
        E += vec3(side * 13., 5.35, zk) * wb;
        D += normalize(vec3(-side * r.x, pitch, -r.y)) * wb;
      }
      if (wBC > 0.) {
        if (i > 0) ringR = vec2(ringR.x * ringS.x - ringR.y * ringS.y, ringR.y * ringS.x + ringR.x * ringS.y);
        float ring = (h3 > .55 && mod(fi, 2.) > .5) ? .55 : 1.;
        vec3 T = ro + (rt * ringR.x + up * ringR.y) * RC * ring - fw * 3.;
        E += EC * wBC;
        D += normalize(T - EC) * wBC;
      }
      bh += beam(E, normalize(D), on, fi);
      emit += emitGlow(E - ro, rd) * on * shareI;
    }
  }
  float shim = 1. + aHat * .6 * cyc(dot(uv, vec2(5.3, 3.1)) * 2. - iTime * 6.4);   // hat shimmer
  beams = bh.x * shim; halo = bh.y;
  if (gGl.x > 0.) emit += glare();                          // uniform: skipped unless a beam hits the lens
  // laser hit spots on the floor (no-crowd shots: intro / calm, 1-2 beams), for the first two fan / tunnel beams.
  // Recomputed here rather than inside the beam loops, where SwiftShader would pay for it on every pixel.
  if (gFloorOk > 0. && (pureA || pureC)) {
    vec2 r0 = pureA ? cs(-.5 * aSt * (M - 1.)) : vec2(cyc(rotC + .25), cyc(rotC));
    vec2 rS = pureA ? fanS : ringS;
    vec3 E0 = pureA ? cE0 : EC;
    for (int i = 0; i < 2; i++) {
      float on = clamp(nB - float(i * (pureA ? int(G) : 1)), 0., 1.);
      if (i > 0) r0 = vec2(r0.x * rS.x - r0.y * rS.y, r0.y * rS.x + r0.x * rS.y);
      vec3 D = pureA ? cM0 * r0.x + cS0 * r0.y
                     : normalize(ro + (rt * r0.x + up * r0.y) * RC * ((h3 > .55 && i == 1) ? .55 : 1.) - fw * 3. - EC);
      if (D.y < -.012) {
        float sM = (E0.y - .03) / -D.y;
        vec3 hp = E0 + D * sM - gFloorP;
        beams += .02 * on / ((dot(hp, hp) + .02) * (1. + sM * ext));
      }
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
      float edge = smoothstep(spreadA * .5 + .01, spreadA * .5 - .18, abs(ang));
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
      vec3 D = normalize(vec3(-sg * (.45 + .25 * cyc(gBar * .5 + sg * .159)), -.08 + .06 * cyc(gBeat * .25), -1.));
      vec3 w = ro - E;
      float b = dot(rd, D), dw = dot(rd, w), e = dot(D, w);
      float s = clamp((e - b * dw) / max(1. - b * b, 1e-5), 0., 90.);
      vec3 Q = E + D * s;
      float t = max(dot(Q - ro, rd), 0.);
      vec3 dv = ro + rd * t - Q;
      float d2 = dot(dv, dv);
      float pwa = max(t, .2) * pix;
      float we = min(W0 + pwa * .6, pwa * 3.2);
      float hr = min(haloR, pwa * 60.);
      float cg = max(1. - d2 / (we * we) * .25, 0.);
      cg *= cg;
      acc += (cg * cg * sqrt(W0 / we) * 1.4 + hr * hr / (d2 + hr * hr) * haloA * 1.5) / (1. + s * ext);
      vec3 ve = E - ro; float te = dot(ve, rd);
      acc += .15 / (1. + max(dot(ve, ve) - te * te, 0.) * 8.);
    }
    acc *= accI;
  }
  beams *= strobe; halo *= strobe; sheet *= strobe;
  // saturated laser colour in the core, only the very centre of hot beams goes white
  float coreE = (beams * smokeB + sheet * .7) * beamI;
  vec3 laser = cB * coreE * 3. + vec3(.55, .5, .6) * coreE * coreE * .12
             + mix(cB, cC, .45) * halo * haloA * beamI * (.55 + .9 * smoke) * kickFlash
             + mix(cB, vec3(1.), .35) * emit * beamI * .9
             + cD * acc * 4. * smokeB;
  col += laser * (1. - trussMask * .6);

  // ---- crowd (front-to-back so hidden layers are skipped)
  float T = 1.;
  if (crowd > .01) {
    float armP = mix(.2, .85, gI) * mix(.7, 1., iParams.x);
    float jump = smoothstep(.55, 1., gI) * clamp(aEnergy * 1.3, .3, 1.);
    float sc = 1. + .38 * tilt;
    float lift = .045 * tilt;
    float dens = mix(.3, .97, crowd);
    vec3 acc3 = vec3(0.);
    // rim light colour: the stage glow + laser light hitting the crowd from the front
    vec3 rimL = (mix(cC, cB, .4) * (.12 + .3 * haze) * mix(.5, 1., gI) + cB * min(halo * haloA * 2. + beams * .3, .6)) * (1. + 1.2 * kick);
    vec3 fogV = fog + cC * .02;
    // near -> far, hidden rows skipped. A loop, so the (large) crowd code exists once in the shader:
    // in SwiftShader code size costs time on every pixel, even for code that is skipped.
    // top-level guard: pixels above the highest possible raised hand skip the crowd entirely
    float crowdTop = max(-.43 + lift * 1.3 + 2.05 * .145 * sc, -.21 + lift + 2.05 * .05 * sc);
    if (uv.y < crowdTop)
    for (int li = 0; li < 3; li++) {
      if (T > .002) {
        float L = float(li);
        float unit = (li == 0 ? .145 : li == 1 ? .082 : .05) * sc;
        float baseY = (li == 0 ? -.43 : li == 1 ? -.29 : -.21) + lift * (li == 0 ? 1.3 : 1.);
        float parX = -ro.x * (li == 0 ? .07 : li == 1 ? .03 : .012);
        vec3 silCol = li == 0 ? vec3(0.) : li == 1 ? cA * .02 : cA * .05;
        float veil = li == 0 ? .03 : li == 1 ? .14 : .38;
        float rimK = li == 0 ? 1.3 : li == 1 ? .8 : .4;
        float dL = li == 0 ? dens * .8 : li == 1 ? dens * .9 : mix(dens, 1., .6);
        float jL = jump * (li == 0 ? 1. : li == 1 ? .85 : .6);
        vec4 l = crowdLayer(uv, col, L, unit, baseY, parX, silCol, fogV * veil, rimL * rimK, dL,
                            armP * (li == 2 ? .65 : 1.), jL, li == 0);
        acc3 += T * l.rgb * l.a; T *= 1. - l.a;
      }
    }
    col = acc3 + T * col;
  }

  // ---- laser persistence (short trails on fast sweeps), not through the crowd
  vec3 prev = texture(iPrev, fragCoord / iResolution).rgb;
  col = max(col, prev * mix(.2, .36, gI) * T);

  fragColor = vec4(max(col, 0.), 1.);
}
