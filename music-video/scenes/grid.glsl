// ============================================================================
// grid — retro-future synthwave night drive (hyper-modern take)
//
// An endless neon-tube grid corridor (box-filtered: hot cores + soft glow that fade to
// their average with distance, so nothing shimmers) between audio-driven ridged mountains,
// a scan-cut setting sun sitting on a hot horizon line, horizon laser fan, starfield +
// nebula, a glossy black floor that mirrors the sun / lasers / pillar as rippled streaks,
// distance haze + valley height-fog + low ground mist.
//
// iParams (all 0..1; 0,0,0,0 = low wire hills, starry night with a light pillar, low cruise)
//   x : terrain height      0 = low rolling hills (7u) .. 1 = towering ridged mountains (24u)
//                           (live height also follows the spectrum: near ridges = bass)
//   y : sun                 0 = no sun: starry night, stronger nebula, a light pillar at the
//                               vanishing point (mirrored down the floor)
//                           0.25..1 = scan-cut setting sun, small -> giant (pillar fades out)
//   z : camera height+speed 0 = low (1u) & cruising (5u/s) .. 1 = high (5u) looking down & fast
//                           (15u/s); speed also scales with intensity, kicks surge on top
//   w : terrain style       0 = black wireframe with neon grid lines
//                           1 = solid black-glass terrain: sun rim/glints, corridor bounce,
//                               glowing topo contour lines that scroll upward, hot peaks
//
// iSeed: camera sway phase, a small per-shot yaw (sun slightly off-centre), laser layout.
//
// Audio: travel = iTime*speed + aKickAcc*k (camera surges on each kick, nose dips);
//   kick -> a thin white-hot scan line + bright band of grid lines races forward along the
//   floor and climbs over the mountains; claps -> sun flare + anamorphic streak + lens ghosts;
//   spectrum -> mountain height; hats -> stars twinkle, lasers flicker;
//   bar -> camera banks left/right, laser fan breathes (re-rolls every 2 bars).
// Intensity: < .25 no lasers / pulse, slower & dimmer; from ~0.82 the sun cracks along a
//   glowing jagged fissure, at 1.0 it shatters into horizontal slices that drift apart,
//   tilt and jolt outward on every kick (grows over the first 3 s of a shot).
// ============================================================================

#define CELL 2.0
#define W0 8.0
#define TMAX 185.0

vec4  P;
float gHS, gBLo, gBMid, gBHi, gSun, gSunR, gSunEl, gPix, gShat, gI, gBl;

// spectrum level around x (one bilinear tap = average of two neighbouring bins)
float specAvg(float x) { return textureLod(iSpectrum, vec2(x + .5 / 64., .5), 0.).r; }
float min3(vec3 v) { return min(v.x, min(v.y, v.z)); }
// ridged noise with slightly rounded crests (fewer razor crags -> calmer silhouettes)
float ridge(float v) { v = 2. * v - 1.; return (1. - sqrt(v * v + .012)) * 1.123; }

// ---------------------------------------------------------------- terrain
// height = ramp(dist from corridor) * scale * ridged-noise * spectrum band factor.
// yTest: if a cheap upper bound is already below yTest the remaining octaves are skipped
// and the bound is returned (used by the march).
float terrainB(vec2 p, float yTest, float lod) {
  float dx = abs(p.x) - W0;
  if (dx <= 0.) return 0.;
  float ramp = smoothstep(0., 26., dx);
  float lat = smoothstep(6., 40., dx);
  float band = mix(gBLo, mix(gBMid, gBHi, smoothstep(40., 80., dx)), lat);
  float s = ramp * gHS * (.55 + .85 * band);
  if (s < yTest) return s;
  vec2 q = p * .05 + (p.x < 0. ? vec2(41.7, 13.1) : vec2(0.));
  float n1 = ridge(vnoise(q));
  float hU = s * (n1 * n1 * .62 + .38);
  if (hU < yTest) return hU;
  float n2 = ridge(vnoise(q * 2.17 + 5.3));
  float n3 = lod > 0. ? mix(.5, vnoise(q * 4.9 + 1.7), lod) : .5;
  return s * (n1 * n1 * .62 + n2 * n2 * .28 + n3 * .1);
}
float terrainH(vec2 p) { return terrainB(p, 1e9, 1.); }

vec3 terrainN(vec2 p) {
  float e = .15;
  float h = terrainH(p);
  return normalize(vec3(h - terrainH(p + vec2(e, 0.)), e, h - terrainH(p + vec2(0., e))));
}

// returns hit t (or -1). cov = how close (in pixels) a missing ray grazed a ridge -> soft
// anti-aliased silhouettes against the bright sun. tc = distance of that closest graze.
float marchTerrain(vec3 ro, vec3 rd, float t0, float maxH, out float cov, out float tc) {
  cov = 0.; tc = TMAX;
  float tEnd = rd.y > 0. ? min(TMAX, (maxH - ro.y) / rd.y) : TMAX;
  if (t0 > tEnd) return -1.;
  float t = t0, lt = t0, ld = 1e3, d = 1., mr = 1e3;
  for (int i = 0; i < 40; i++) {
    vec3 p = ro + rd * t;
    d = p.y - terrainB(p.xz, p.y - .5, smoothstep(95., 55., t));
    if (d < 0.) break;
    float rr = d / (t * gPix * 1.2);
    if (rr < mr) { mr = rr; tc = t; }
    lt = t; ld = d;
    t += max(d * (.75 + .2 * smoothstep(2., 10., d)), .1 + t * .02);
    if (t > tEnd) { cov = 1. - smoothstep(0., 1., mr); return -1.; }
  }
  // out of steps while grazing: near -> call it a hit, far -> soft (fogged) miss
  if (d >= 0.) { if (t < 110.) return t; cov = 1. - smoothstep(0., 1., mr); return -1.; }
  return lt + (t - lt) * ld / (ld - d);       // secant hit (smooth across pixels -> stable grid AA)
}

// ---------------------------------------------------------------- neon line lattice
// One axis of an anti-aliased neon-tube lattice (lines at integer x). fw = pixel footprint
// in cells. Core = exact box-filtered coverage of a line of half-width lw; glow = box-filtered
// exp(-d/gw). Both blend to their cell average as the lattice goes sub-pixel -> no shimmer.
vec2 neonAxis(float x, float fw, float lw, float gw) {
  float d = abs(fract(x + .5) - .5);
  float f = max(fw * 1.35, 1e-4);
  float a = d - .5 * f, b = d + .5 * f;
  float core = max(min(b, lw) - max(a, -lw), 0.) / f;
  float Fa = sign(a) * gw * (1. - exp(-abs(a) / gw));
  float glow = (gw * (1. - exp(-b / gw)) - Fa) / f;
  float k = smoothstep(.22, .6, f);
  return mix(vec2(core, glow), vec2(2. * lw, 2. * gw * (1. - exp(-.5 / gw))), k);
}
// returns (core, glow, xCore) for a 2-D lattice; dd = (dFdx(uv), dFdy(uv))
vec3 neonGrid(vec2 uv, vec4 dd, float lw, float gw) {
  vec2 fw = vec2(length(dd.xz), length(dd.yw));
  vec2 a = neonAxis(uv.x, fw.x, lw, gw), b = neonAxis(uv.y, fw.y, lw, gw);
  return vec3(max(a.x, b.x), max(a.y, b.y), a.x);
}

// ---------------------------------------------------------------- sky
vec3 lasers(float az, float el, float blur) {
  vec3 acc = vec3(0.);
  if (gI < .25 || el < -.004 || el > .7) return acc;
  float on = smoothstep(.25, .6, gI);
  float e = max(el, 0.);
  if (gBl > .5)   // mirrored in the wet floor: soft vertical fan glow
    return mix(cB, cD, .35) * on * exp(-e * 9.) * exp(-abs(az) * 2.5) * (.5 + .5 * sin(az * 23. + aBarCount * 1.7)) * .5 * (.8 + .4 * aHat);
  float bar = floor(aBarCount * .5);
  float sweep = sin(PI * (aBarCount + smoothstep(0., .8, aBarPhase)));
  float w = max(.0012, gPix * .9) * (1. + blur * 5.) * (1. + e * 3.);
  float hk = 120. / (1. + blur * 2.);
  float hw = .1 + exp(-e * 35.) * .6;
  float thr = .3 + .65 * gI;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float h2 = hash11(fi * 3.17 + bar * 5.11 + 2.);
    if (h2 > thr) continue;
    float h = hash11(fi * 7.31 + bar * 1.73 + iSeed * 13.);
    float side = fi < 4. ? -1. : 1.;
    float base = side * (.06 + mod(fi, 4.) * .095 + h * .05);
    // fan outward from the vanishing point, breathing with the bar
    float tilt = base * (1.2 + .5 * sweep * side) + (h - .5) * .15;
    float x = az - base - e * tilt;
    float ax = abs(x);
    if (ax * hk > 9.) continue;
    vec3 c = h > .72 ? cD : cB;
    acc += c * (.0012 / w * exp(-x * x / (w * w)) * 3.5 + exp(-ax * hk) * hw);
  }
  float fade = exp(-e * 7.) * smoothstep(-.004, .008, el);
  return acc * on * fade * (.75 + .4 * aHat + .4 * aKick);
}

vec3 sunHot() { return mix(vec3(1., .55, .1), cD, .2); }

// sp: sun-local coords (1 = radius); returns emission, cover = opaque coverage
vec3 sunCol(vec2 sp, float blur, out float cover) {
  cover = 0.;
  if (gSun <= 0.) return vec3(0.);
  float pixS = gPix / gSunR * (1. + blur * 6.);
  float S = gShat;
  float jolt = 1. + aKick * smoothstep(.3, 1., S) * 1.2;
  vec2 q = sp;
  // ---- shatter into horizontal slices: spread apart, drift sideways (alternating), tilt
  float sh = 2. / 9.;                                   // slice height (sun units)
  float spread = 1. + S * .26 * jolt;
  float k = floor((q.y / spread + 1.) / sh);
  float ck = -1. + (k + .5) * sh;                       // slice centre (un-spread)
  float hk = hash11(k * 13.7 + 3.1 + floor(iSeed * 7.));
  float dir = mod(k, 2.) < .5 ? -1. : 1.;
  float drift = S * (dir * (.04 + .2 * hk) + .05 * sin(iTime * .6 + k * 1.9)) * jolt;
  q.y -= ck * (spread - 1.);
  q.x -= drift;
  q.y += S * (hk - .5) * .14 * q.x;                     // tilt
  float sly = abs(q.y - ck);
  float slE = sh * .5 - S * .035;
  float ps = pixS * spread;
  float sOn = smoothstep(0., .05, S);
  float slMask = mix(1., 1. - smoothstep(slE - ps, slE + ps, sly), sOn);
  // ---- crack: one jagged near-vertical fissure through the whole disc that opens up
  float gapD = 1e3, open = 0.;
  if (S > 0.) {
    float cyy = q.y;
    float cx = .1 * sin(cyy * 2.3 + iSeed * 6.) + .1;
    if (gBl < .5) cx += .2 * (vnoise(vec2(cyy * 4.5, iSeed * 9.)) - .5) + .07 * (vnoise(vec2(cyy * 14., 3.)) - .5);
    float cxd = q.x - cx;
    float side = cxd < 0. ? -1. : 1.;
    open = S * .045 * jolt;
    gapD = abs(cxd) - open;                             // < 0 inside the opened crack
    q.x -= side * open;
  }
  float r = length(q);
  float disc = 1. - smoothstep(1. - pixS, 1. + pixS, r);
  // ---- scanline cuts (lower part, thicker toward the bottom), scrolling with travel
  float u = q.y * 7. + (iTime * .3 + aKickAcc * .12);
  float gw = smoothstep(.45, -.55, q.y) * .62 * (1. - S * .4);
  float du = 7. * pixS * 1.2;
  float g = abs(fract(u) - .5) * 2.;
  float cut = smoothstep(gw - du, gw + du, g);
  cut = mix(cut, 1. - gw, clamp(du * 2. - .5, 0., 1.));
  cut = mix(1., cut, smoothstep(0., .03, gw));
  float crM = S > 0. ? smoothstep(-pixS, pixS, gapD) : 1.;
  cover = disc * cut * slMask * crM;
  // ---- gradient: white-gold top -> saturated cD -> deep violet-ish bottom
  float v = clamp(q.y * .5 + .5, 0., 1.);
  vec3 bot = mix(cD, cB, .45); bot = max(bot - .35 * min3(bot), 0.) * 1.3;
  vec3 c = mix(bot * .5, cD * 1.05, smoothstep(.12, .55, v));
  c = mix(c, sunHot() * 1.45, smoothstep(.55, .98, v));
  c *= 1. + aSnare * .6;
  // ---- molten edges + light leaking out of the crack
  vec3 molten = mix(cD, vec3(1., .82, .6), .55);
  float eS = exp(-max(slE - sly, 0.) / (ps * 3.)) * sOn;
  float em = eS * 1.1 * disc * cut * slMask * crM;
  if (S > 0.) {
    float eC = exp(-max(gapD, 0.) / (pixS * 2.5 + .004));
    float inner = (1. - crM) * disc * (1. - .8 * S) * slMask;
    em += (eC * disc * cut * slMask * crM * 1.4 + inner * 1.5) * smoothstep(0., .12, S);
  }
  float dimBig = mix(1., .8, smoothstep(.5, 1., P.y));
  return (c * cover * (.85 + .15 * gI) + molten * em) * dimBig;
}

// hot horizon line where the sun / pillar touches the horizon
vec3 hLine(float az, float ae) {
  float hl = exp(-ae / (gPix * 2.5 + .001));
  float wSun = exp(-az * az / (gSunR * gSunR * 1.2)) * gSun;
  float wPil = exp(-az * az * 80.) * (1. - gSun);
  return mix(sunHot(), vec3(1.), .3) * hl * (wSun * .8 + wPil) * (.6 + .4 * gI + .5 * aKick);
}

// gradient + horizon band + wide sun haze + hot horizon line + light pillar.
// Symmetric around the horizon, so it doubles as the depth-fog colour of the far floor.
vec3 skyBase(vec3 rd, float az) {
  float el = rd.y, ae = abs(el);
  vec3 col = mix(cA * .9 + cC * .03, cA * .2, smoothstep(-.02, .55, el));
  float hz = exp(-ae * 10.);
  col += mix(mix(cB, cC, .4), mix(cD, cB, .3), gSun) * hz * (.07 + .1 * gSun) * (.6 + .4 * gI);
  vec2 sp = vec2(az, el - gSunEl) / gSunR;
  float r = length(sp);
  col += mix(cD, cC, .25) * gSun * exp(-max(r - 1., 0.) * 3.) * .08 * (.6 + .5 * aSnare + .2 * gI);
  col += hLine(az, ae);
  // starry-night focal point: a distant light pillar at the vanishing point (+ its mirror image)
  float pil = 1. - gSun;
  if (pil > 0.) {
    float pw = (.004 + ae * .01) * (1. + gBl * 4.);
    float core = exp(-az * az / (pw * pw)) * exp(-ae * 2.5);
    float glow = exp(-abs(az) * 18.) * exp(-ae * 6.) * .25;
    float base = exp(-az * az * 60. - el * el * 3000.) * 1.2;
    col += mix(cB, vec3(1.), .25) * (core * 2.2 / (1. + gBl * 2.) + glow + base) * pil * (.5 + .5 * gI + .6 * aKick);
  }
  return col;
}

vec3 sky(vec3 rd, float blur, bool stars) {
  float el = rd.y;
  float az = atan(rd.x, rd.z);
  vec3 col = skyBase(rd, az);
  // nebula + milky band (stronger at night)
  float bd = dot(rd, normalize(vec3(.55, -.35, .2))) * 3.2;
  float band = exp(-bd * bd);
  float nebA = (1. - .75 * gSun) * smoothstep(.0, .3, el);
  if (stars && nebA > .12) {
    vec2 nq = vec2(az * 1.6, el * 2.6) + iSeed * 7.;
    float n2 = vnoise(nq * 1.3 + 11.);
    float n = vnoise(nq * 2.) * .75 + n2 * .1 + .07;
    float neb = smoothstep(.4, .85, n) * (.35 + .65 * n2) * (.25 + .75 * band);
    col += mix(cB, cD, n2) * neb * .08 * nebA;
    col += cC * smoothstep(.5, .9, n * (.6 + .6 * n2)) * band * .04 * nebA;
    col *= 1. - smoothstep(.3, .6, n * (1. - n2)) * band * .5;    // dust lanes
  }
  // stars (single layer, varied magnitude, hat twinkle)
  if (stars && el > 0.) {
    float sA = (1. - .6 * gSun) * smoothstep(.0, .25, el);
    vec2 sq = vec2(az, el) * 85.;
    vec2 id = floor(sq);
    vec3 h = hash33(vec3(id + iSeed * 31., 4.1));
    if (h.z > .89 - band * .12) {
      vec2 f = fract(sq) - .5 - (h.xy - .5) * .7;
      float d = length(f) / 85.;
      float sig = gPix * .75;
      float m = fract(h.z * 13.1);
      float tw = .7 + .3 * sin(iTime * (2. + 4. * m) + m * 40.) + aHat * .5;
      float b = exp(-d * d / (sig * sig)) * (.1 + 2.2 * m * m * m) * tw;
      col += mix(vec3(1.), cC + .3, h.x * .6) * b * sA;
    }
  }
  col += lasers(az, el, blur);
  // sun + halo
  vec2 sp = vec2(az, el - gSunEl) / gSunR;
  float cover = 0.;
  float r = length(sp);
  vec3 s = vec3(0.);
  if (r < 1.5) s = sunCol(sp, blur, cover);
  col = mix(col, vec3(0.), cover * .9) + s + hLine(az, abs(el)) * cover * .9;
  float halo = gSun * exp(-max(r - 1., 0.) * 10.) * .22 * (1. - cover);
  col += mix(cD, cC, .2) * halo * (.6 + .6 * aSnare + .2 * gI);
  // clap flare: anamorphic streak through the sun
  float sy = el - gSunEl * gSun;                  // through the sun, or the pillar base at night
  float streak = exp(-abs(sy) * (240. / (1. + blur * 4.))) * exp(-abs(az) * 1.3);
  col += mix(cD, vec3(1.), .5) * streak * aSnare * (1.5 + 2.5 * gI) * (.5 + .5 * gSun);
  return col;
}

// ---------------------------------------------------------------- main
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  P = clamp(iParams, 0., 1.);
  gI = iIntensity;
  gBl = 0.;
  vec2 uv = (fragCoord - .5 * iResolution.xy) / iResolution.y;

  // audio-driven globals
  gBLo = smoothstep(.3, 1., specAvg(.1));
  gBMid = smoothstep(.3, 1., specAvg(.45));
  gBHi = smoothstep(.3, 1., specAvg(.72));
  gHS = mix(7., 24., P.x);
  gSun = smoothstep(0., .25, P.y);
  gSunR = mix(.12, .27, P.y);
  gSunEl = mix(.05, .08, P.y);
  gShat = smoothstep(.82, 1., gI) * (.55 + .45 * smoothstep(0., 3., iLocal));

  // camera: travel surges on every kick, banks left/right on the bar
  float fl = 1.05;
  gPix = 1. / (iResolution.y * fl);
  float spd = mix(5., 15., P.z) * (.45 + .55 * gI);
  float camZ = iTime * spd + aKickAcc * mix(9., 20., P.z) + iSeed * 900.;
  float camH = mix(1., 5., P.z * P.z);
  float sway = sin(iTime * .23 + iSeed * 6.28) * 2.2 + sin(iTime * .093 + 1.) * 1.2;
  vec3 ro = vec3(sway, camH, camZ);
  float bank = cos(PI * (aBarCount + smoothstep(0., .7, aBarPhase)));
  float roll = .045 * bank * (.5 + .5 * gI) + sin(iTime * .23 + iSeed * 6.28) * .02;
  // per-shot yaw (iSeed) puts the sun slightly off-centre for composition variety
  float yaw = (hash11(iSeed * 71.3 + 2.) - .5) * .26;
  vec3 ta = vec3(sway * .8 + yaw * 12., camH * .78 + .35 - aKick * .06 * gI, camZ + 12.);
  vec3 rd = camRay(ro, ta, uv, fl, roll);
  float az0 = atan(rd.x, rd.z);

  // --- intersect: corridor floor analytically (to infinity), mountains by heightfield march
  float maxH = gHS * (.55 + .85 * max(gBLo, max(gBMid, gBHi))) + .1;
  float tPl = rd.y < 0. ? -ro.y / rd.y : 1e9;
  float tEx = abs(rd.x) > 1e-5 ? ((rd.x > 0. ? W0 : -W0) - ro.x) / rd.x : 1e9;
  float t = -1., cov = 0., tc = TMAX;
  float mat = 0.;                                  // 0 sky / far ground, 1 floor, 2 terrain
  if (tPl < tEx) { t = tPl; mat = 1.; }
  else {
    t = marchTerrain(ro, rd, max(tEx, 0.), maxH, cov, tc);
    if (t > 0.) mat = 2.;
  }
  vec3 pos = ro + rd * max(t, 0.);
  if (mat > 1.5 && abs(pos.x) < W0) { mat = 1.; }

  // derivatives must be taken in uniform control flow
  vec2 guv = pos.xz / CELL;
  vec4 gdd = vec4(dFdx(guv), dFdy(guv));
  float cy = pos.y / (gHS * .1) - iTime * .2;
  float cfw = length(vec2(dFdx(cy), dFdy(cy)));
  float zfw = length(vec2(dFdx(pos.z), dFdy(pos.z)));

  vec3 col;
  // kick pulse: a front racing forward along the grid (rides aBeatPhase)
  float zr = pos.z - ro.z;
  float front = 5. * exp(aBeatPhase * 3.);
  float kg = clamp(aKick * 2.2, 0., 1.) * smoothstep(.15, .55, gI);
  float pw = .6 + front * .12;
  float band = exp(-abs(zr - front) / pw) + step(zr, front) * exp(-max(front - zr, 0.) / (pw * 2.5)) * .15;
  float sw = .1 + front * .007, sW = max(sw, zfw * .8);
  float scan = exp(-abs(zr - front) / sW) * (sw / sW) * kg;   // filtered: thin, never smears
  float pulse = kg * band;
  float fogK = 3.4e-5 + 1.6e-5 * (1. - gSun);
  vec3 haze = mix(cC, cD, .4 + .2 * gSun) * (.04 + .12 * gSun) * (.6 + .4 * gI) + cA * .3;
  float coreB = (.75 + 2.05 * gI) * (1. + pulse * 3.5);
  float glowB = (.16 + .36 * gI) * (1. + pulse * 1.5);
  vec3 scanC = mix(cD, vec3(1.), .35) * scan * 2.4;

  if (mat < .5) {
    if (rd.y < 0.) col = skyBase(rd, az0);           // far ground beyond the march: fully hazed
    else {
      col = sky(rd, 0., true);
      // anti-aliased ridge silhouette (ray grazed a ridge within ~1px)
      if (cov > 0.) {
        float fg = 1. - exp(-tc * tc * fogK);
        col = mix(col, mix(cA * .08, skyBase(rd, az0) * .8, fg), cov);
      }
    }
  } else {
    vec3 lc;
    if (mat < 1.5) {
      // ---- glossy black floor
      vec3 g = neonGrid(guv, gdd, .011, .045);
      float rw = smoothstep(.33, .13, -rd.y);
      vec3 refl = vec3(0.);
      float fres = 0.;
      if (rw > 0.) {
        float rip = exp(-t * .025);
        float rn = (vnoise(pos.xz * vec2(.3, 1.1)) - .5) * .07 * rip;
        vec3 n = normalize(vec3(rn, 1., rn * .3));
        vec3 rr = reflect(rd, n);
        rr.y = max(rr.y, .001);
        fres = (.06 + .94 * pow(1. - max(dot(-rd, n), 0.), 5.)) * rw;
        // terrain occlusion of the reflection (cheap: 4 envelope probes)
        float occ = 0.;
        float tt = 3.5;
        for (int k = 0; k < 4; k++) {
          vec3 q = pos + rr * tt;
          float dx = abs(q.x) - W0;
          if (q.y < .6 * gHS * smoothstep(0., 26., dx)) { occ = 1. - tt / 90.; break; }
          tt *= 2.3;
        }
        // anisotropic: stretch the mirrored sky vertically (wet asphalt streaks)
        if (occ < .9) {
          vec3 rrs = normalize(vec3(rr.x * 1.4, rr.y * .4, rr.z));
          gBl = 1.;
          refl = sky(rrs, 2.2, false);
          gBl = 0.;
        }
        // horizontal ripple break-up that lives on the floor (scrolls with travel)
        float stk = smoothstep(.3, .7, vnoise(vec2(pos.x * .1, pos.z * 2.3)));
        stk *= .65 + .35 * sin(pos.x * .7 + pos.z * .23 + 2. * sin(pos.z * .11));
        stk = mix(.4, stk, exp(-t * .025));
        refl *= .15 + 1.9 * stk;
        refl = mix(refl, haze * .4 + cA * .1, clamp(occ, 0., 1.) * .95);
      }
      col = cA * .035 + refl * mix(vec3(1.), mix(cB, cD, .5) * 1.2, .3) * fres * .5;
      lc = mix(cB, cD, smoothstep(30., 160., t) * .45);
      // corridor-edge rails (x = +-W0) in the hot accent colour
      float rail = 1. - smoothstep(.4, 1., abs(abs(pos.x) - W0));
      vec3 lcR = mix(lc, mix(cD, vec3(1.), .1), rail);
      float coreR = g.x + (g.z * rail * .6);
      col += mix(lcR, vec3(1.), .3) * coreR * coreB + lcR * g.y * glowB * (1. + rail);
      col += scanC + mix(cD, cB, .3) * band * kg * .04;
      col += cB * aSub * .025 * gI;
    } else {
      // ---- mountains
      vec3 g = neonGrid(guv, gdd, .012, .035);
      vec3 n = terrainN(pos.xz);
      float hN = clamp(pos.y / (gHS * 1.1), 0., 1.);
      float fr = pow(1. - clamp(dot(n, -rd), 0., 1.), 3.);
      float face = clamp(dot(n, vec3(-sign(pos.x), .4, 0.)), 0., 1.);     // faces toward the corridor glow
      lc = mix(cB, cD, smoothstep(.1, .75, hN));
      vec3 wire = vec3(0.), solid = vec3(0.);
      if (P.w < .999) {
        wire = cA * .07 + (cC * .12 + cD * .06) * fr * .6 + cB * face * .02;
        wire += mix(lc, vec3(1.), .25) * g.x * coreB * 1.05 + lc * g.y * glowB * .9;
      }
      if (P.w > .001) {
        // black glass: sun rim + glints, corridor bounce, emissive topo contours, hot peaks
        vec3 sdir = normalize(vec3(0., .25, 1.));
        vec3 rf = reflect(rd, n);
        float spc = pow(clamp(dot(rf, sdir), 0., 1.), 20.) * gSun;
        float hzr = exp(-abs(rf.y) * 8.);
        float key = clamp(dot(n, normalize(vec3(-sign(pos.x) * .5, .7, -.5))), 0., 1.);
        float lowF = smoothstep(.0, 2.5, pos.y);
        solid = cA * .1 + mix(cB, cC, .3) * key * key * .03 * lowF;
        solid += mix(cB, cD, .3 + .4 * gSun) * (pow(fr, 4.) * .25 + hzr * .03 + spc * .45) * lowF;
        solid += cB * .07 * face * exp(-hN * 2.5) * exp(-(abs(pos.x) - W0) * .03) * lowF;
        vec2 cl = neonAxis(cy, cfw, .035, .09);
        solid += mix(mix(cB, cD, hN), vec3(1.), .15) * (cl.x * 1.5 + cl.y * .35) * (1. + pulse * 3.)
               * smoothstep(.08, .25, hN) * (.6 + .6 * gI);
        solid += lc * g.x * coreB * .1;
        solid += mix(cD, vec3(1., .8, .6), .2) * smoothstep(.85, 1.15, hN) * .15 * (.5 + gBLo);
      }
      col = mix(wire, solid, P.w);
      col += scanC * .8;
    }
    // distance haze + exponential height fog (valley mist, crisp peaks)
    float hb = .16;
    float ry = abs(rd.y) < 1e-4 ? 1e-4 : rd.y * hb;
    float hfog = .006 * exp(-ro.y * hb) * (1. - exp(-t * ry)) / ry;
    float fog = 1. - exp(-t * t * fogK - hfog);
    vec3 fogC = skyBase(rd, az0) * mix(.4, 1., smoothstep(60., TMAX, t));
    col = mix(col, fogC, fog);
  }

  // low ground mist glow (volumetric-ish, analytic)
  float tm = mat < .5 ? TMAX : min(t, TMAX * 2.);
  float mist = (1. - exp(-tm * .012)) * exp(-abs(rd.y) * 18.);
  col += mix(cC, cB, .4) * mist * .05 * (.5 + .5 * gI);

  if (gSun > 0. && aSnare > .01) {
    vec3 cf = normalize(ta - ro);
    vec3 cr = normalize(cross(cf, vec3(sin(roll), cos(roll), 0.)));
    vec3 cu = cross(cr, cf);
    vec3 sd = normalize(vec3(0., sin(gSunEl), cos(gSunEl)));
    vec2 sUV = vec2(dot(sd, cr), dot(sd, cu)) / dot(sd, cf) * fl;
    // clap lens ghosts (along the sun -> centre axis)
    for (int i = 0; i < 3; i++) {
      float k = -.6 - float(i) * .55;
      vec2 gp = sUV * k;
      float rr2 = .03 + .04 * float(i);
      float gg = smoothstep(rr2, rr2 * .7, length(uv - gp));
      col += mix(cD, cC, float(i) * .5) * gg * .22 * aSnare * gSun;
    }
  }

  fragColor = vec4(max(col, 0.), 1.);
}
