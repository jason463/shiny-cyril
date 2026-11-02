// ============================================================================
// fractal — flythrough of an endless, glowing fractal cathedral / megastructure
// ----------------------------------------------------------------------------
// A monumental hall built from two layers:
//  * a ray-marched stone SKELETON (compound piers + pointed transverse and
//    diagonal vault ribs / massive brutalist portals / floating rings) carrying
//    neon filaments that pump with the kick (glow accumulated along the march);
//  * ANALYTIC WALLS OF LIGHT behind it: exact ray-plane / ray-cylinder hits whose
//    2D KIFS tracery is evaluated per pixel at the front AND back face of the wall
//    (real reveal depth + parallax; the inner faces of the tracery catch the glass
//    colour), anti-aliased with fwidth and backlit like stained glass with fold-path
//    / orbit-trap colouring from the section palette. Being analytic, the fractal
//    tracery recurses 3-5 levels cheaply (levels below ~2 px fade to their average),
//    and rays leaving the hall stop at the wall instead of marching on.
// A wet mirror floor reflects the glass (blurred, pier-occluded), coloured god-ray
// shafts fall across the nave, analytic neon leading lines run down the hall into
// the vanishing point, depth fog to black and a soft blazing light at the far end.
//
// iParams (all 0..1, 0,0,0,0 = good default):
//   x : architecture   < .33  gothic cathedral: quadripartite rib vault on compound piers,
//                             Sainte-Chapelle walls of glass in two tiers (aisle + clerestory)
//                             with a triforium band; 3-level recursive lancet tracery with
//                             turning foiled roses; starry vault; neon cornice/base lines
//                      .33-.67 brutalist megastructure: massive rounded portals (+ a half-size
//                             KIFS frame between them) in front of endless concrete facades
//                             pierced by a 4-level Sierpinski carpet of lit windows (some
//                             re-light every bar), open to the dark above; neon rails
//                      > .67  kleinian caverns: floating ring tunnel lined with a slowly
//                             turning apollonian (circle-inversion) lace of light, no floor
//   y : camera path    0 = centred glide down the axis (symmetric vanishing point, looks up a bit)
//                      ~.5 = weaving lateral path with banking into the turns
//                      1 = low worm's-eye looking up into the vault, wider lens, slow roll
//   z : morph speed    speed of the bass-driven morph (vault pointedness, tracery pointedness and
//                      mullion width, rose rotation, portal roundness, apollonian inversion)
//   w : glow amount    0 = normal, 1 = ~1.7x neon filaments, stronger shafts, +25% glass
// Audio: aKickAcc = travel surges; aKick = neon pump + glass pulse; aSnare (claps) = magenta
// (cD) shockwave sweeping down the hall through glass, ribs, lines and floor; aBassAcc =
// architecture morph; aHat = shaft shimmer + vault-star twinkle; aBarCount = re-lights windows.
// iIntensity: speed, glass brightness, how many panes are lit, lace density, neon, shafts.
// iLocal/iShotLen: on shots >= 3 s the hall LIGHTS UP in a wave rushing from the camera to the
// vanishing point during the first ~0.6 s (drop openers); short montage cuts start fully lit.
// iSeed offsets the travel position, the camera path phase and the morph phase.
// Perf: ~2.7x the _test scene at 1280x720 (est. ~450-500 ms/frame unloaded). In SwiftShader cost
// tracks program size, so each heavy function is inlined once (pattern + glass colour in a loop).
// ============================================================================

int   gVar;
float gMorph, gLine, gPix, gEdge, gHot, gFoot, gFade;
vec3  gB, gC, gD;      // luminance-normalised section palette (stable exposure across palettes)
vec3 lumNorm(vec3 c, float L) { return c * (L / max(dot(c, vec3(.2126, .7152, .0722)), .04)); }

// hall geometry, set per variant in mainImage
float BAY;             // bay length (z period)
float WF, TH;          // |x| of the glass wall plane (tunnel radius for rings) + wall thickness
float HS;              // gothic springing/cornice height, brutalist portal height
float XS;              // gothic vaulting-shaft line / brutalist portal half-width
float VC, RRIB, XV;    // gothic vault: arc centre offset, rib radius, web springing |x|
float RC;              // brutalist portal corner radius
float WA, WS1, WS2, TRIB, WRISE, SILL, gPoint, gTw, gRoseRot;   // gothic windows
float gApoK, gApoRot, ZS;                           // apollonian lace

vec2 camPath(float z, float ph) {
  return vec2(sin(z * .085 + ph) * .55 + sin(z * .031 + ph * 1.7) * .45, sin(z * .061 + ph * 2.3));
}

float ribSD(float a, float qz, float th, float dz) {
  vec2 e = vec2(a - th, abs(qz) - dz);
  return length(max(e, 0.)) + min(max(e.x, e.y), 0.);
}

// ---- marched skeleton ----------------------------------------------------------
float mapGothic(vec3 p) {
  float ax = abs(p.x);
  float qz = mod(p.z + BAY * .5, BAY) - BAY * .5;           // 0 = pier / transverse-rib plane
  // compound pier: block against the wall + a vaulting shaft facing the nave + plinth
  float core = sdBox2(vec2(ax - (XS + WF) * .5, qz), vec2((WF - XS) * .5, .3));
  float shaft = length(vec2(ax - XS, qz)) - .17;
  float d = max(min(core, shaft), p.y - HS);
  d = min(d, sdBox(vec3(ax - (XS + WF) * .5 + .05, p.y - .35, qz), vec3((WF - XS) * .5 + .2, .35, .45)));
  gLine = max(length(vec2(ax - XS + .2, qz)), p.y - HS) + .002;        // neon strip up each shaft
  // transverse pointed rib springing from the shafts
  float sd = length(vec2(ax + VC, p.y - HS)) - RRIB;
  float a = p.y > HS ? abs(sd) : length(vec2(ax - XS, p.y - HS));
  d = min(d, ribSD(a, qz, .15, .19));
  gLine = min(gLine, length(vec2(sd + .19, qz)) + max(HS - p.y, 0.));   // neon under the rib
  // diagonal ribs of the quadripartite vault
  if (p.y > HS - .6) {
    float zb = BAY * .5 - abs(qz);
    float L = length(vec2(XS, BAY * .5));
    float u = (ax * XS + zb * BAY * .5) / L, v = (ax * BAY * .5 - zb * XS) / L;
    float sd2 = length(vec2(u * XS / L + VC, max(p.y, HS) - HS)) - RRIB;
    vec2 e2 = vec2(abs(sd2) + max(HS - p.y, 0.) - .1, abs(v) - .11);
    d = min(d, length(max(e2, 0.)) + min(max(e2.x, e2.y), 0.));
    gLine = min(gLine, length(vec2(sd2 + .14, v)) + max(HS - p.y, 0.));
  }
  return d;
}

float mapBrut(vec3 p) {
  float ax = abs(p.x);
  float qz = mod(p.z + BAY * .5, BAY) - BAY * .5;
  // massive rounded portal frame (the floor hides its bottom bar)
  vec2 bb = vec2(ax, abs(p.y - HS * .5)) - vec2(XS, HS * .5) + RC;
  float sd = length(max(bb, 0.)) + min(max(bb.x, bb.y), 0.) - RC;      // < 0 inside the opening
  float d = ribSD(abs(sd - .38), qz, .38, .34);
  gLine = length(vec2(sd + .03, abs(qz) - .36));                        // neon on both inner edges
  // second, slimmer frame at mid-bay, one KIFS level down (half size, lifted)
  float qz2 = abs(qz) - BAY * .5;
  vec2 bb2 = vec2(ax, abs(p.y - HS * .75)) - vec2(XS, HS * .25) + RC * .5;
  float sd2 = length(max(bb2, 0.)) + min(max(bb2.x, bb2.y), 0.) - RC * .5;
  float sb = max(ribSD(abs(sd2 - .14), qz2, .14, .1), HS * .5 - p.y + .2);
  d = min(d, sb);
  gLine = min(gLine, max(length(vec2(sd2 + .02, qz2)), HS * .5 - p.y + .2) + .004);
  return d;
}

float mapRing(vec3 p) {
  float qz = mod(p.z + BAY * .5, BAY) - BAY * .5;
  float r = length(p.xy);
  float d = ribSD(abs(r - RRIB), qz, .17, .2);
  gLine = length(vec2(r - RRIB + .21, qz));
  return d;
}

float map(vec3 p) { return gVar == 0 ? mapGothic(p) : (gVar == 1 ? mapBrut(p) : mapRing(p)); }

// ---- light walls: 2D KIFS patterns. Return a stone SDF (< 0 stone, > 0 glass) -----
float lancet(vec2 p, float a, float s, float c) {
  return p.y < s ? abs(p.x) - a : length(vec2(abs(p.x) + c, p.y - s)) - a - c;
}

// gothic: two tiers of tracery windows (aisle arcade + clerestory) with a triforium band.
// Each window: lancet -> 2 sub-lancets + foiled rose in the head, 3 KIFS levels.
float trGothic(vec2 p, out float id) {
  float tierB = step(TRIB, p.y);
  float ws = tierB > .5 ? WS2 : WS1, sill = tierB > .5 ? TRIB + .2 : SILL;
  float c = gPoint * WA;
  float d = min(-lancet(p, WA, ws, c), p.y - sill);
  gEdge = abs(d);
  // triforium: a band of small arched openings between the tiers (scale cue)
  float cw = WA / 3.;
  vec2 tp = vec2(mod(p.x + WA, cw * 2.) - cw, p.y);
  float tri = min(min(-lancet(tp, cw - .07, TRIB - .55, 0.), p.y - (TRIB - 1.)), WA - abs(p.x));
  d = max(d, tri);
  // saddle bars across the straight part of the lights
  d = min(d, max(abs(fract((p.y - sill) / .75 + .5) - .5) * .75 - .012, p.y - ws));
  gHot = 0.;
  id = 1.;
  float sc = 1.;
  for (int i = 0; i < 3; i++) {
    vec2 o = p - vec2(0., ws + WRISE * .64);
    float r = WRISE * .23, lo = length(o);
    float an = atan(o.y, o.x) + gRoseRot * (i == 1 ? -1. : 1.);
    an = mod(an + PI / 6., PI / 3.) - PI / 6.;
    float foil = max(abs(length(vec2(cos(an), sin(an)) * lo - vec2(r * .52, 0.)) - r * .4) - .04, lo - r);
    d = min(d, min(abs(lo - r) - .06, foil) / sc);
    gHot = max(gHot, step(lo, r) / sc);
    id = id * 2. + step(0., p.x);
    p.x = abs(p.x) - WA * .5;
    p.y -= ws;
    p *= 2.;
    p.y += ws;
    sc *= 2.;
    d = min(d, (abs(lancet(p, WA - gTw, ws, c)) - .06) / sc);
  }
  id += tierB * 16.;
  return d;
}

// brutalist: Sierpinski carpet of window holes, 4 levels
float trBrut(vec2 p, out float id) {
  float sz = BAY * .5, h = 1e3;
  vec2 q = vec2(p.x, p.y - sz * .5);
  id = 0.; gHot = 0.; gEdge = 1e3; gFade = 0.;
  float cov = 1.;
  for (int i = 0; i < 4; i++) {
    vec2 cl = floor(q / sz + .5);
    float hb = sdBox2(q - cl * sz, vec2(sz / 6.));
    float fd = smoothstep(.6, 2., gFoot * 3. / sz);       // hole below ~2 px -> fade to its average
    gFade += fd * cov / 9.;
    cov *= 8. / 9.;
    hb = mix(hb, 1e3, fd);
    if (hb < 0.) { id = hash12(cl * 1.37 + float(i) * 7.13); gHot = 1. - float(i) * .3; }
    if (i == 0) gEdge = abs(hb);
    h = min(h, hb);
    sz /= 3.;
  }
  return -h;
}

// kleinian caverns: apollonian circle-inversion lace on the tunnel wall (p.x = angle 0..1).
// Every inversion level contributes its unit-circle outline -> packed circles at all scales.
float trApo(vec2 p, out float id) {
  vec2 q = vec2(p.x * 32., p.y / ZS);
  float s = 1., dm = 1e3;
  id = 0.;
  for (int i = 0; i < 5; i++) {
    q = -1. + 2. * fract(.5 * q + .5);
    float r2 = dot(q, q);
    float dc = abs(sqrt(r2) - .98) / s;
    float fd = max(smoothstep(.15, .5, gFoot * s / ZS),          // circles smaller than ~3 px fade out
                   smoothstep(1.5 + 3. * iIntensity, 2. + 3. * iIntensity, float(i)));   // calm = sparser
    dc = mix(dc, 1e3, fd);
    if (dc < dm) { dm = dc; id = float(i); }
    float k = gApoK / r2;
    q *= k; s *= k;
  }
  gHot = 0.; gEdge = 1e3; gFade = 0.;
  return .022 - dm * ZS;      // the circle outlines are the light, the rest is stone
}

float wallSD(vec2 w, out float id) {
  return gVar == 0 ? trGothic(w, id) : (gVar == 1 ? trBrut(w, id) : trApo(w, id));
}

// stained-glass emission for a pane
vec3 glassCol(float id, float cell, float hot, float y, float I) {
  vec3 c;
  float lit = 1.;
  if (gVar == 2) {
    c = id < .5 ? gB : (id < 1.5 ? gC : (id < 2.5 ? gD : mix(gB, gD, .5)));
    c *= 1.6 - id * .2;
  } else {
    float h = hash11(floor(id * .5) * 3.731 + cell * 1.917);
    float h2 = hash11(id * 7.13 + cell * 3.3 + 1.7);
    c = h < .5 ? gB : (h < .8 ? gC : gD);
    c *= .55 + .8 * h2;
    if (gVar == 0) c *= mix(.7, 1.2, fract(y / (TRIB - .5)));
    else {
      lit = step(fract(h2 * 7.31 + floor(aBarCount + h * 3.) * .618 * step(.75, h)), mix(.5, .92, I));
      c *= mix(.8, 1.3, hot) * lit;
    }
  }
  c = mix(c, mix(gD, vec3(1.), .25) * 1.6, clamp(hot, 0., 1.) * (gVar == 0 ? 1. : .35));
  // calm: sparser, cooler, dimmer glass
  float on = gVar == 0 ? step(hash11(id * 1.3 + cell * 5.1), mix(.55, 1.01, I)) : 1.;
  return c * mix(.25, 1., on);
}

// neon line along z through (P.x, P.y): energy-normalised glow, width never below ~1.5 px
float zLine(vec3 ro, vec3 rd, vec2 P, float tHit, float fogK, float zf, inout float ring) {
  vec2 o = ro.xy - P;
  float dd = max(dot(rd.xy, rd.xy), 1e-7);
  float ts = -dot(o, rd.xy) / dd;
  float front = step(0., ts);
  ts = clamp(ts, 0., 400.);                  // (unclamped, exp() overflowed to inf -> NaN)
  vec2 c = o + rd.xy * ts;
  float e = max(.012, ts * gPix);
  float g = .00025 * (.012 / e) / (dot(c, c) + e * e);
  g *= front * smoothstep(tHit + .4, tHit - .4, ts) * exp(-ts * fogK);
  float dz = ro.z + rd.z * ts - zf;
  ring += g / (1. + dz * dz * 4.);
  return g;
}

float lineW(float l, float t) { float e = max(.0084, t * gPix); return .00014 * (.0084 / e) / ((l * l + e * e) * (1. + l * l * 30.)); }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - .5 * iResolution) / iResolution.y;
  gVar = iParams.x < .33 ? 0 : (iParams.x < .67 ? 1 : 2);
  float I = iIntensity;
  gB = lumNorm(cB, .4); gC = lumNorm(cC, .33); gD = lumNorm(cD, .33);
  gMorph = aBassAcc * mix(.15, .9, iParams.z) + iSeed * 20.;

  // ---- hall dimensions + bass morph ---------------------------------------------
  TH = .32;
  if (gVar == 0) {
    BAY = 3.2; WF = 3.7; HS = 9.2; XS = WF - .8;
    VC = XS * (.42 + .22 * sin(gMorph * .41));
    RRIB = XS + VC; XV = XS + .2;
    WA = BAY * .5 - .44; SILL = 1.1;
    gPoint = .45 + .3 * sin(gMorph * .29 + 2.);
    float c = gPoint * WA;
    WRISE = sqrt((WA + c) * (WA + c) - c * c);
    TRIB = 5.7;                       // triforium top / clerestory base
    WS1 = 4.45 - WRISE;               // aisle-tier window springing (apex at 4.45)
    WS2 = HS - .45 - WRISE;           // clerestory springing
    gTw = .14 + .08 * sin(gMorph * .53);      // sub-light gap (mullion width) breathes
    gRoseRot = gMorph * .35;
  } else if (gVar == 1) {
    BAY = 7.2; WF = 5.; HS = 7.6; XS = WF - 1.2;
    RC = 1.1 + .7 * sin(gMorph * .37);
  } else {
    WF = 4.4; ZS = TAU * WF / 32.; BAY = ZS * 4.;
    RRIB = WF - .9 + .15 * sin(gMorph * .33);
    gApoK = 1.05 + .12 * sin(gMorph * .45);
    gApoRot = gMorph * .02 + iTime * .01;
  }
  bool hasFloor = gVar != 2;

  // ---- camera ----------------------------------------------------------------------
  float cy = iParams.y;
  float weave = smoothstep(.2, .6, cy), low = smoothstep(.65, 1., cy);
  float ph = iSeed * 37.;
  float spd = mix(.5, 1., I);
  float travel = (iTime * 1.15 + aKickAcc * 5.5) * spd + iSeed * 300.;
  float amp = mix(.12, gVar == 1 ? 1.9 : 1.35, weave);
  vec2 cp = camPath(travel, ph) * amp;
  float eye = gVar == 0 ? mix(1.7, .6, low) : (gVar == 1 ? mix(2.1, .7, low) : mix(0., -1.9, low));
  vec3 ro = vec3(cp.x, eye + cp.y * .25 + .07 * sin(iTime * .5 + iSeed * 9.), travel);
  float look = gVar == 2 ? mix(.15, 2.6, low) : mix(2., 6.2, low);
  vec3 ta = vec3(camPath(travel + 7., ph).x * amp * .5, eye + look, travel + 7.);
  float bank = (camPath(travel + 3., ph).x * amp - cp.x) * .5 * weave;
  float roll = bank + low * .4 * sin(iTime * .21 + iSeed * 6.);
  float fl = mix(.82, .64, low);
  gPix = 1.5 / (iResolution.y * fl);
  vec3 rd = camRay(ro, ta, uv, fl, roll);

  float fogK = gVar == 0 ? .055 : (gVar == 1 ? .05 : .07);
  vec3 lp = vec3(0., gVar == 0 ? 5.5 : (gVar == 1 ? 4.5 : 0.), travel + 44.);
  vec3 lcol = mix(gC, vec3(1.), .4);

  // clap shockwave front sweeping down the hall; kick pump
  float ringAmp = smoothstep(.02, .3, aSnare) * mix(.4, 1., I);
  float zf = ro.z + 3. + aBeatPhase * 30.;
  float kickB = mix(.3, .7, I) + aKick * mix(.6, 2.6, I);
  float glassE = mix(.3, 1., I) * (1. + aKick * .35 * I) * (1. + .25 * iParams.w);
  // drop reveal: on long shots (>= 3 s) the hall lights up in a wave rushing from the camera to
  // the vanishing point during the first ~0.6 s (short montage cuts start fully lit)
  float revOn = step(3., iShotLen) * (1. - smoothstep(.5, .75, iLocal));
  float zRev = ro.z - 2. + iLocal * 75.;

  // ---- analytic shells -----------------------------------------------------------
  float sgx = rd.x >= 0. ? 1. : -1.;
  float iax = 1. / max(abs(rd.x), 1e-5);
  float tW1, tW2;
  if (gVar == 2) {
    float a = max(dot(rd.xy, rd.xy), 1e-7), b = dot(ro.xy, rd.xy), c0 = dot(ro.xy, ro.xy);
    tW1 = (-b + sqrt(max(b * b - a * (c0 - WF * WF), 0.))) / a;
    tW2 = (-b + sqrt(max(b * b - a * (c0 - (WF + TH) * (WF + TH)), 0.))) / a;
  } else {
    tW1 = min((WF - sgx * ro.x) * iax, 400.);
    tW2 = min((WF + TH - sgx * ro.x) * iax, 400.);
  }
  // gothic vault: cornice ledge + pointed barrel (intersection of two discs)
  float tTop = 1e5;
  if (gVar == 0 && rd.y > 1e-4) {
    float tc = (HS - ro.y) / rd.y;
    float xc = abs(ro.x + rd.x * tc);
    if (xc > XV) tTop = tc;
    else {
      float VR = XV + VC;
      vec2 o1 = ro.xy - vec2(-VC, HS), o2 = ro.xy - vec2(VC, HS);
      float a = dot(rd.xy, rd.xy);
      float b1 = dot(o1, rd.xy), b2 = dot(o2, rd.xy);
      float t1 = (-b1 + sqrt(max(b1 * b1 - a * (dot(o1, o1) - VR * VR), 0.))) / a;
      float t2 = (-b2 + sqrt(max(b2 * b2 - a * (dot(o2, o2) - VR * VR), 0.))) / a;
      tTop = min(t1, t2);
    }
  }
  // floor + its mirror ray onto the light wall (computed for every pixel: shares the pattern loop)
  float tFloor = hasFloor && rd.y < -1e-4 ? -ro.y / rd.y : 1e5;
  vec3 pfl = ro + rd * min(tFloor, 60.);
  vec2 bump = sin(vec2(pfl.x * 2.3 + sin(pfl.z * 1.7), pfl.z * 1.9 + sin(pfl.x * 2.9))) * .5;
  vec3 rr = normalize(vec3(rd.x + bump.x * .008, -rd.y, rd.z + bump.y * .008));
  float rs = rr.x >= 0. ? 1. : -1.;
  float rix = 1. / max(abs(rr.x), 1e-4);
  float tw = min((WF - rs * pfl.x) * rix, 200.);

  // ---- wall pattern at 3 points: front face, back face, floor reflection ----------------
  // One inlined copy inside a loop (SwiftShader cost tracks program size). Evaluated for every
  // pixel in uniform control flow, so fwidth() gives exact anti-aliasing of the tracery.
  vec3 Q[3] = vec3[3](ro + rd * tW1, ro + rd * tW2, pfl + rr * tw);
  float foot = tW1 * gPix * .67 / max(gVar == 2 ? sqrt(1. - rd.z * rd.z) : abs(rd.x), .08);
  float FT[3] = float[3](foot, foot, (min(tFloor, 60.) + tw) * gPix * 3.);
  float Ds[3], Es[3], Fs[3];
  vec3 Gs[3];
  for (int k = 0; k < 3; k++) {
    vec3 q = Q[k];
    vec2 w = gVar == 2 ? vec2(atan(q.y, q.x) / TAU + gApoRot, q.z) : vec2(mod(q.z, BAY) - BAY * .5, q.y);
    gFoot = FT[k];
    float idk;
    Ds[k] = wallSD(w, idk);
    Es[k] = gEdge; Fs[k] = gFade;
    Gs[k] = glassCol(idk, floor(q.z / BAY) + (k == 2 ? rs : sgx) * .5, gHot, q.y, I) * glassE
          * (1. - revOn * .85 * smoothstep(zRev - 2., zRev + 2., q.z));
  }
  float f1 = clamp(fwidth(Ds[0]), 1e-4, 4.), f2 = clamp(fwidth(Ds[1]), 1e-4, 4.);

  float tShell = min(tW1, tTop);
  float tMax = 44.;
  float tEnd = min(min(tShell, tFloor), tMax);

  // ---- march the skeleton with neon glow accumulation --------------------------------
  float t = .05, d = 0.;
  float gl = 0., ringGl = 0.;
  bool hit = false;
  float stp = 0.;
  float omega = 1.5, prevR = 0., sLen = 0.;
  for (int i = 0; i < 36; i++) {
    vec3 p = ro + rd * t;
    d = map(p);
    float dz = p.z - zf;
    float w = d * lineW(gLine, t) * exp(-t * fogK * .8) * (1. - revOn * .8 * smoothstep(zRev - 2., zRev + 2., p.z));
    gl += w;
    ringGl += w / (1. + dz * dz * 16.);
    bool fail = omega > 1. && (d + prevR) < sLen;
    if (fail) { sLen -= omega * sLen; omega = 1.; }
    else {
      if (d < .0035 * t) { hit = true; break; }
      sLen = d * omega;
    }
    prevR = d;
    t += sLen;
    stp += 1.;
    if (t > tEnd) break;
  }
  float hLine = gLine;
  if (!hit) t = tEnd;
  vec3 pf = ro + rd * t;

  vec3 glassAvg = mix(gB, gC, .35) * glassE;      // average glass light (fills the stone)
  vec3 stoneC = (cA * .25 + .012) * glassAvg;
  vec3 col = vec3(0.);
  float shockW = ringAmp * exp(-abs(pf.z - zf) * 3.);
  vec3 revFront = mix(gB, vec3(1.), .4) * revOn * 1.8 * exp(-abs(pf.z - zRev) * 1.2) * step(-3., zRev - ro.z);

  if (hit) {
    // stone: dark, filled by the glass walls (stronger near them), neon spill near filaments
    float ao = clamp(1. - stp / 36., 0., 1.);
    ao = .3 + .7 * ao * ao;
    float nearW = gVar == 2 ? smoothstep(RRIB - 2., WF, length(pf.xy)) : smoothstep(XS - 2.5, WF, abs(pf.x));
    col = stoneC * (.2 + 1. * nearW) * ao;
    col += (cA * .25 + .012) * lcol * 1.5 * pow(max(dot(rd, normalize(lp - ro)), 0.), 8.) * ao;
    float l2 = hLine * hLine;
    vec3 lc = gB * kickB;
    float lw = max(.012, t * gPix * 1.2);
    col += lc * (3. * .012 / lw) * lw * lw / (l2 + lw * lw);
    col += (cA * .25 + .012) * lc * 3. / (1. + l2 * 300.);
    col += gD * shockW * 2.5;
  } else if (tEnd == tFloor) {
    // ---- wet polished floor: inlays + blurred reflection of the glass walls -----------------
    float fw = t * gPix / max(-rd.y, .03);
    float lz = abs(mod(pf.z + BAY * .5, BAY) - BAY * .5);
    float inlay = (1. - smoothstep(0., .02 + fw, lz)) * step(abs(pf.x), XS - .3);
    col = cA * .06 + gB * inlay * kickB * .12 / (1. + fw * fw * 300.);
    vec3 pw = Q[2];
    float rfw = .08 + (t + tw) * .02 / max(abs(rr.x), .12);   // blur grows with the grazing footprint
    vec3 refl = Gs[2] * smoothstep(-rfw, rfw, Ds[2]);
    // occluders between the floor point and the wall: piers / portal frames
    float tp = ((gVar == 0 ? XS - .17 : XS) - rs * pf.x) * rix;
    float qz = abs(mod(pf.z + rr.z * tp + BAY * .5, BAY) - BAY * .5);
    refl *= (1. - step(qz, .33)) * (gVar == 0 ? step(pw.y, HS) : 1.) * exp(-tw * fogK);
    col += refl * (.15 + .6 * pow(1. - abs(rd.y), 4.));
    col += gD * shockW * 1.5;
  } else if (tEnd == tW1) {
    // ---- the light walls: front face / reveal / glass behind ------------------------------
    float open1 = smoothstep(-f1, f1, Ds[0]), open2 = gVar == 2 ? 1. : smoothstep(-f2, f2, Ds[1]);
    vec3 gcol = gVar == 2 ? Gs[0] : Gs[1];
    vec3 stone = stoneC * .4;
    if (gVar == 2) stone += Gs[0] * .25 * exp(min(Ds[0], 0.) * 25.);   // lace halo
    if (gVar == 1) stone += glassAvg * Fs[0] * .5;                    // sub-pixel windows' average light
    vec3 reveal = gcol * .22 + stone;
    col = mix(stone, mix(reveal, gcol, open2), open1);
    // neon edge on the main frame outline
    col += gB * kickB * .35 * exp(-Es[0] * Es[0] / (f1 * f1 * 2. + .0006)) * (gVar == 2 ? 0. : 1.);
    col += gD * shockW * (1.2 + 1.5 * open1);
  } else if (tEnd == tTop) {
    // ---- vault web (starry) / cornice underside ------------------------------------------
    col = stoneC * .25;
    if (abs(pf.x) < XV - .01) {
      vec2 sp = pf.xz / .55;
      vec2 ci = floor(sp);
      vec2 hh = hash22(ci);
      float sdist = length(fract(sp) - .2 - hh * .6) * .55;
      float e = max(.025, t * gPix);
      float tw2 = (.5 + .5 * sin(iTime * 3. + hh.x * 40.) * aHat) * step(.5, hh.y);
      col += mix(gC, vec3(1.), .3) * (.025 * .025 / (sdist * sdist + e * e)) * (.025 / e) * tw2 * mix(.3, 1., I);
    }
    col += gD * shockW;
  }

  col += revFront;
  // ---- depth fog to black + forward in-scatter toward the far light -------------------
  vec3 ldir = normalize(lp - ro);
  float mu = max(dot(rd, ldir), 0.);
  float fogT = 1. - exp(-t * fogK);
  col *= exp(-t * fogK);
  float phase = .01 + .07 * pow(mu, 10.);
  col += mix(gC, gB, .4) * phase * fogT * mix(.5, 1.1, I);
  col += glassAvg * .035 * fogT;
  float fo = fogT * fogT;
  col += lcol * (.5 * pow(mu, 120.) * fo + 2.5 * pow(mu, 2500.) * fo * fo) * mix(.6, 1., I);

  // ---- analytic neon leading lines down the hall ----------------------------------------
  float lnR = 0., ln = 0.;
  if (gVar != 2) {
    for (int k = 0; k < 4; k++) {
      vec2 P = gVar == 0 ? (k < 2 ? vec2(XV, HS - .06) : vec2(XS - .5, .03))
                         : (k < 2 ? vec2(XS - .35, HS - .35) : vec2(XS - .55, .03));
      P.x *= (k == 0 || k == 2) ? 1. : -1.;
      ln += zLine(ro, rd, P, t, fogK, zf, lnR);
    }
  }
  col += gB * ln * kickB * 2.2 + gD * lnR * ringAmp * 6.;

  // ---- coloured light shafts through the upper windows, pooling on the floor -------------
  vec3 Lb = gVar == 2 ? normalize(vec3(.25, -1., .15)) : normalize(vec3(.62, -1., .2));
  float bayZ = floor(ro.z / BAY) * BAY + BAY * .5;
  float wy = gVar == 0 ? HS * .72 : (gVar == 1 ? 10. : WF - .2);
  float x0 = gVar == 2 ? -.6 : -WF;
  float bLen = gVar == 2 ? 2. * WF : wy / -Lb.y;
  vec3 shaft = vec3(0.);
  float b = dot(rd, Lb), den = max(1. - b * b, 1e-3);
  for (int k = 0; k < 5; k++) {
    vec3 a = vec3(x0, wy, bayZ + float(k) * BAY);
    vec3 w0 = ro - a;
    float dd = dot(rd, w0), e = dot(Lb, w0);
    float sr = (b * e - dd) / den, ul = (e - b * dd) / den;
    vec3 dv = w0 + rd * sr - Lb * ul;
    float vis = smoothstep(0., 1.5, sr) * smoothstep(t + .3, t - .3, sr) * smoothstep(0., 1., ul) * smoothstep(bLen, bLen - 1.5, ul)
              * smoothstep(1., 4., a.z - ro.z) * smoothstep(2., 7., sr);
    float hk = hash11(floor(a.z / BAY) * 1.91 + 3.7);
    vec3 sc = hk < .5 ? gB : (hk < .8 ? gC : gD);
    shaft += sc * vis * exp(-dot(dv, dv) * 4.) * exp(-sr * fogK);
  }
  float shaftK = (.5 + 1.2 * aHat) * mix(.25, 1., I) * (1. + .7 * iParams.w) * (gVar == 2 ? 0. : 1.);
  col += shaft * shaftK * .2;

  // ---- accumulated filament glow ------------------------------------------------------
  vec3 glow = gB * gl * kickB + gD * ringGl * ringAmp * 5.;
  col += glow * mix(1., 1.7, iParams.w);
  fragColor = vec4(col, 1.);
}
