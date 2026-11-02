// ============================================================================
// grid — retro-future synthwave night drive (hyper-modern take)
//
// An endless neon grid corridor between audio-driven ridged mountains, a giant
// scan-cut setting sun at the vanishing point, horizon laser beams, starfield +
// nebula, wet-glass floor reflections and depth haze.
//
// iParams (all 0..1; 0,0,0,0 = low wire hills, starry night with a light pillar, low cruise)
//   x : terrain height      0 = low rolling hills (7u) .. 1 = towering ridged mountains (24u)
//   y : sun                 0 = no sun: starry night + nebula + a distant light pillar at the
//                               vanishing point (reflected in the floor)
//                           0.25..1 = scan-cut setting sun growing to a giant sun (pillar fades out)
//   z : camera height+speed 0 = low (1u) & cruising (5u/s) .. 1 = high (5u) & fast (15u/s)
//                           (speed is also scaled by intensity; kicks add surge on top)
//   w : terrain style       0 = black wireframe w/ neon grid lines
//                           1 = solid dark glossy terrain: rim/glint lighting, glowing
//                               scrolling contour lines, hot peaks (faint grid on top)
//
// Audio: travel = iTime*speed + aKickAcc*k -> the camera surges on each kick; each kick
// also launches a bright pulse band + low light-curtain that races forward along the
// grid and over the mountains (rides aBeatPhase); claps -> sun flare + anamorphic
// streak + lens ghosts; mountain height follows the spectrum (ridges near the road =
// bass, far ridges = mids/highs); hats twinkle stars & flicker the horizon lasers;
// camera banks left/right on every bar; laser fan re-rolls every 2 bars.
// Intensity: < .25 no lasers/pulse, slower; > ~0.82 the sun cracks, at 1.0 it shatters
// into tilted slabs with molten edges that drift apart (grows over the first 3 s of a shot).
// ============================================================================

#define CELL 2.0
#define W0 8.0
#define TMAX 185.0

vec4  P;
float gHS, gBLo, gBMid, gBHi, gSun, gSunR, gSunEl, gPix, gShat, gI;

// spectrum level around x (one bilinear tap = average of two neighbouring bins)
float specAvg(float x) { return textureLod(iSpectrum, vec2(x + .5 / 64., .5), 0.).r; }

// ---------------------------------------------------------------- terrain
// height = ramp(dist from corridor) * scale * ridged-noise * spectrum band factor.
// yTest: if the cheap upper bound (first octave only) is already below yTest the
// remaining octaves are skipped and the bound is returned (used by the march).
float terrainB(vec2 p, float yTest, float lod) {
  float dx = abs(p.x) - W0;
  if (dx <= 0.) return 0.;
  float ramp = smoothstep(0., 26., dx);
  float lat = smoothstep(6., 40., dx);
  float band = mix(gBLo, mix(gBMid, gBHi, smoothstep(40., 80., dx)), lat);
  float s = ramp * gHS * (.55 + .85 * band);
  if (s < yTest) return s;
  vec2 q = p * .05 + (p.x < 0. ? vec2(41.7, 13.1) : vec2(0.));
  float n1 = 1. - abs(2. * vnoise(q) - 1.);
  float hU = s * (n1 * n1 * .62 + .38);
  if (hU < yTest) return hU;
  float n2 = 1. - abs(2. * vnoise(q * 2.17 + 5.3) - 1.);
  float n3 = lod > 0. ? mix(.5, vnoise(q * 4.9 + 1.7), lod) : .5;
  return s * (n1 * n1 * .62 + n2 * n2 * .28 + n3 * .1);
}
float terrainH(vec2 p) { return terrainB(p, 1e9, 1.); }

vec3 terrainN(vec2 p) {
  float e = .15;
  float h = terrainH(p);
  return normalize(vec3(h - terrainH(p + vec2(e, 0.)), e, h - terrainH(p + vec2(0., e))));
}

float marchTerrain(vec3 ro, vec3 rd, float t0, float maxH) {
  float tEnd = rd.y > 0. ? min(TMAX, (maxH - ro.y) / rd.y) : TMAX;
  if (t0 > tEnd) return -1.;
  float t = t0, lt = t0, ld = 1e3, d = 1.;
  for (int i = 0; i < 56; i++) {
    vec3 p = ro + rd * t;
    d = p.y - terrainB(p.xz, p.y - .5, smoothstep(95., 55., t));
    if (d < 0.) break;
    lt = t; ld = d;
    t += max(d * (.6 + .3 * smoothstep(2., 10., d)), .08 + t * .015);
    if (t > tEnd) return -1.;
  }
  if (d >= 0.) return t;
  return lt + (t - lt) * ld / (ld - d);       // secant hit (smooth across pixels -> stable grid AA)
}

// ---------------------------------------------------------------- AA grid (pristine-grid style)
// uv in cell units, dd = (dFdx(uv), dFdy(uv)), lw = line width as fraction of a cell
vec2 gridAA(vec2 uv, vec4 dd, float lw, float farK) {
  vec2 deriv = vec2(length(dd.xz), length(dd.yw));
  vec2 drawW = clamp(vec2(lw), deriv, vec2(.5));
  vec2 aa = deriv * 1.5;
  vec2 g = 1. - abs(fract(uv) * 2. - 1.);
  vec2 l = smoothstep(drawW + aa, drawW - aa, g);
  l *= clamp(lw / drawW, 0., 1.);
  l = mix(l, vec2(lw * farK), clamp(deriv * 2. - 1., 0., 1.));
  return l;
}

// ---------------------------------------------------------------- sky
vec3 lasers(float az, float el, float blur) {
  vec3 acc = vec3(0.);
  if (gI < .25 || el < -.004 || el > .7) return acc;
  float on = smoothstep(.25, .6, gI);
  float bar = floor(aBarCount * .5);
  float e = max(el, 0.);
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

vec3 sunCol(vec2 sp, float blur, out float cover) {
  // sp: sun-local coords (1 = radius); returns emission
  cover = 0.;
  if (gSun <= 0.) return vec3(0.);
  float pixS = gPix / gSunR * (1. + blur * 6.);
  vec2 q = sp;
  // shatter: slabs drift apart sideways, spread vertically, tilt, and split on a jagged crack
  float N = 7.;
  float sy = q.y / (1. + gShat * .45);
  float k = floor(sy * N * .5 + N * .5);
  float fk = fract(sy * N * .5 + N * .5);
  float hk = hash11(k * 13.7 + 3.1);
  float drift = gShat * ((hk - .5) * 1.1 + .3 * sin(iTime * .5 + k * 2.1)) * (1. + .6 * aKick);
  q.x -= drift;
  q.y += gShat * (hk - .5) * .25 * q.x;                       // tilt slabs
  float cx = (hash11(k * 3.3 + 1.) - .5) * 1.2 + (fk - .5) * (hash11(k * 5.9) - .5) * .9;   // diagonal crack
  float side = sign(q.x - cx);
  q.x -= side * gShat * .07 * (1. + aKick);
  float r = length(q);
  float disc = smoothstep(1. + pixS, 1. - pixS, r);
  // scanline cuts (lower part), scrolling down with travel
  float u = q.y * 7. + (iTime * .3 + aKickAcc * .12);
  float gw = smoothstep(.5, -.45, q.y) * .62 * (1. - gShat * .6);
  float du = 7. * pixS * 1.2;
  float g = abs(fract(u) - .5) * 2.;                 // 0 at cut center .. 1
  float cut = smoothstep(gw - du, gw + du, g);
  cut = mix(cut, 1. - gw, clamp(du * 2. - .5, 0., 1.));
  cut = mix(1., cut, smoothstep(0., .03, gw));
  // shatter gaps between slabs and along the crack
  float gap = gShat * .2;
  float ps = pixS * N * .5 * (1. + gShat * .45);     // pixel size in slab units
  float ed = min(fk - gap, 1. - gap - fk);           // distance to slab edge (slab units)
  float cd = abs(q.x - cx - side * gShat * .07) - gShat * .045;
  float sg = smoothstep(-ps, ps, ed) * smoothstep(-pixS, pixS, cd);
  sg = mix(1., sg, step(.001, gShat));
  cover = disc * cut * sg;
  // gradient: hot top -> key bottom
  float v = clamp(q.y * .5 + .5, 0., 1.);
  vec3 top = mix(cD, vec3(1., .6, .2), .5) * 1.35;
  vec3 mid = cD * .8;
  vec3 bot = mix(cD, cB, .75) * .38;
  vec3 c = mix(bot, mid, smoothstep(.0, .55, v));
  c = mix(c, top, smoothstep(.5, 1., v));
  // molten edges glow hot when shattered
  float edge = gShat * cover * (exp(-max(ed, 0.) / (ps * 2.5)) + exp(-max(cd, 0.) / (pixS * 2.5)));
  c *= 1. + aSnare * .7;
  return (c * cover * (.8 + .2 * gI) + edge * mix(cD, vec3(1., .85, .7), .6) * 1.7) * mix(1., .72, smoothstep(.5, 1., P.y));
}

// gradient + horizon glow + wide sun haze (also used as the depth-fog colour)
vec3 skyBase(vec3 rd) {
  float el = rd.y;
  vec3 col = mix(cA * .9 + cC * .03, cA * .2, smoothstep(-.02, .55, el));
  float hz = exp(-max(el, 0.) * 10.);
  col += mix(mix(cB, cC, .4), mix(cD, cB, .3), gSun) * hz * (.08 + .13 * gSun) * (.6 + .4 * gI);
  vec2 sp = vec2(atan(rd.x, rd.z), el - gSunEl) / gSunR;
  float r = length(sp);
  col += mix(cD, cC, .25) * gSun * exp(-max(r - 1., 0.) * 3.) * .1 * (.6 + .5 * aSnare + .2 * gI);
  return col;
}

vec3 sky(vec3 rd, float blur, bool stars) {
  float el = rd.y;
  float az = atan(rd.x, rd.z);
  vec3 col = skyBase(rd);
  // nebula + milky band (stronger at night)
  float band = exp(-pow(dot(rd, normalize(vec3(.55, -.35, .2))) * 3.2, 2.));
  float nebA = (1. - .75 * gSun) * smoothstep(.0, .3, el);
  if (stars && nebA > 0.01) {
    vec2 nq = vec2(az * 1.6, el * 2.6) + iSeed * 7.;
    float n = vnoise(nq * 2.) * .6 + vnoise(nq * 4.1 + 3.) * .4;
    float n2 = vnoise(nq * 1.3 + 11.);
    float neb = smoothstep(.4, .85, n) * (.35 + .65 * n2) * (.25 + .75 * band);
    col += mix(cB, cD, n2) * neb * .07 * nebA;
    col += cC * smoothstep(.5, .9, n * (.6 + .6 * n2)) * band * .035 * nebA;
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
      float d = length(f) / 85.;                   // angular distance
      float sig = gPix * .75;
      float m = fract(h.z * 13.1);
      float tw = .7 + .3 * sin(iTime * (2. + 4. * m) + m * 40.) + aHat * .5;
      float b = exp(-d * d / (sig * sig)) * (.1 + 2.2 * m * m * m) * tw;
      col += mix(vec3(1.), cC + .3, h.x * .6) * b * sA;
    }
  }
  // lasers
  col += lasers(az, el, blur);
  // starry-night focal point: a distant light pillar at the vanishing point
  float pil = 1. - gSun;
  if (pil > 0.) {
    float e = max(el, 0.);
    float pw = (.004 + e * .01) * (1. + blur * 3.);
    float core = exp(-az * az / (pw * pw)) * exp(-e * 2.5) * smoothstep(-.004, .006, el);
    float glow = exp(-abs(az) * 18.) * exp(-e * 6.) * .25;
    float base = exp(-az * az * 60. - el * el * 4000.);
    col += mix(cB, vec3(1.), .25) * (core * 2.2 + glow + base * 1.5) * pil * (.5 + .5 * gI + .6 * aKick);
  }
  // sun + halo
  vec2 sp = vec2(az, el - gSunEl) / gSunR;
  float cover = 0.;
  float r = length(sp);
  vec3 s = vec3(0.);
  if (r < 1.9) s = sunCol(sp, blur, cover);
  col = mix(col, vec3(0.), cover * .9) + s;
  float halo = gSun * exp(-max(r - 1., 0.) * 12.) * .3 * (1. - cover);
  col += mix(cD, cC, .25) * halo * (.6 + .5 * aSnare + .2 * gI);
  // clap flare: anamorphic streak through the sun
  float sy = (el - gSunEl);
  float streak = exp(-abs(sy) * (240. / (1. + blur * 4.))) * exp(-abs(az) * 1.3);
  col += mix(cD, vec3(1.), .5) * streak * aSnare * (1.5 + 2.5 * gI) * (.5 + .5 * gSun);
  return col;
}

// ---------------------------------------------------------------- main
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  P = clamp(iParams, 0., 1.);
  gI = iIntensity;
  vec2 uv = (fragCoord - .5 * iResolution.xy) / iResolution.y;

  // audio-driven globals
  gBLo = smoothstep(.3, 1., specAvg(.1));
  gBMid = smoothstep(.3, 1., specAvg(.45));
  gBHi = smoothstep(.3, 1., specAvg(.72));
  gHS = mix(7., 24., P.x);
  gSun = smoothstep(0., .25, P.y);
  gSunR = mix(.12, .29, P.y);
  gSunEl = mix(.04, .07, P.y);
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
  vec3 ta = vec3(sway * .8, camH * .78 + .35 - aKick * .06 * gI, camZ + 12.);
  vec3 rd = camRay(ro, ta, uv, fl, roll);

  // --- intersect: corridor floor analytically, mountains by heightfield march
  float maxH = gHS * (.55 + .85 * max(gBLo, max(gBMid, gBHi))) + .1;
  float tPl = rd.y < 0. ? -ro.y / rd.y : 1e9;
  float tEx = abs(rd.x) > 1e-5 ? ((rd.x > 0. ? W0 : -W0) - ro.x) / rd.x : 1e9;
  float t = -1.;
  float mat = 0.;                                  // 0 sky, 1 floor, 2 terrain
  if (tPl < tEx) { t = tPl; mat = 1.; }
  else {
    t = marchTerrain(ro, rd, max(tEx, 0.), maxH);
    if (t > 0.) mat = 2.;
  }
  if (t > TMAX) mat = 0.;
  vec3 pos = ro + rd * max(t, 0.);
  if (mat > 1.5 && abs(pos.x) < W0) { mat = 1.; }

  // derivatives must be taken in uniform control flow
  vec2 guv = pos.xz / CELL;
  vec4 gdd = vec4(dFdx(guv), dFdy(guv));
  float cy = pos.y / (gHS * .1) - iTime * .2;
  vec2 cdd = vec2(dFdx(cy), dFdy(cy));

  vec3 col;
  // kick pulse wave running forward along the grid
  float zr = pos.z - ro.z;
  float front = 4.5 * exp(aBeatPhase * 3.1);
  float kg = clamp(aKick * 2.3, 0., 1.) * smoothstep(.15, .55, gI);
  float pw = .5 + front * .16;
  float pulse = kg * (exp(-abs(zr - front) / pw) * 1.6 + step(zr, front) * exp(-(front - zr) / (pw * 4.)) * .35);
  float fogK = 5e-5 + 2e-5 * (1. - gSun);
  vec3 haze = mix(cC, cD, .45 + .25 * gSun) * (.05 + .17 * gSun) * (.6 + .4 * gI) + cA * .3;

  if (mat < .5) {
    col = sky(rd, 0., true);
  } else {
    // ---- shading common
    vec2 gl = gridAA(guv, gdd, .03, mat > 1.5 ? .5 : 1.);
    float line = max(gl.x, gl.y);
    vec2 gs = gridAA(guv, gdd, .2, 1.);                  // soft neon halo around lines
    float soft = max(gs.x, gs.y) - line * .5;
    float lineB = (.7 + .6 * gI) * (1. + pulse * 4.5);
    if (mat < 1.5) {
      // ---- wet glass floor
      float rw = smoothstep(.3, .18, -rd.y);
      vec3 refl = vec3(0.);
      float fres = 0.;
      if (rw > 0.) {
        float rip = exp(-t * .03);
        vec2 rn = (vnoise(pos.xz * vec2(.25, 1.3)) - .5) * vec2(.12, .04) * rip;
        vec3 n = normalize(vec3(rn.x, 1., rn.y));
        vec3 rr = reflect(rd, n);
        rr.y = max(rr.y, .002);
        fres = (.02 + .98 * pow(1. - max(dot(-rd, n), 0.), 6.)) * rw;
        // terrain occlusion of the reflection (cheap: 4 envelope probes)
        float occ = 0.;
        float tt = 3.5;
        for (int k = 0; k < 4; k++) {
          vec3 q = pos + rr * tt;
          float dx = abs(q.x) - W0;
          if (q.y < .6 * gHS * smoothstep(0., 26., dx)) { occ = 1. - tt / 90.; break; }
          tt *= 2.3;
        }
        vec3 rrs = normalize(vec3(rr.x, rr.y * .55, rr.z));
        refl = sky(rrs, 1., false);
        float stk = mix(.5, smoothstep(.25, .75, vnoise(vec2(pos.x * .5, pos.z * 1.7))), exp(-t * .04));
        refl *= .15 + 1.5 * stk;
        refl = mix(refl, haze * .5 + cA * .1, clamp(occ, 0., 1.) * .95);
      }
      col = cA * .04 + refl * mix(vec3(1.), mix(cB, cD, .6) * 1.3, .5) * fres * .32;
      vec3 lc = mix(cB, cD, smoothstep(20., 140., t) * .5);
      col += lc * (line * lineB + max(soft, 0.) * .12 * (1. + pulse * 2.));
      float edge = exp(-abs(zr - front) / pw) * kg;
      col += mix(cD, vec3(1.), .2) * (edge * .38 + pulse * .03);
      col += cB * aSub * .02 * gI;
    } else {
      // ---- mountains
      vec3 n = terrainN(pos.xz);
      float hN = clamp(pos.y / (gHS * 1.1), 0., 1.);
      float fr = pow(1. - clamp(dot(n, -rd), 0., 1.), 3.);
      float face = clamp(dot(n, vec3(-sign(pos.x), .4, 0.)), 0., 1.);     // faces toward the corridor glow
      vec3 lc = mix(cB, cD, smoothstep(.1, .75, hN));
      // wireframe
      vec3 wire = vec3(0.), solid = vec3(0.);
      if (P.w < .999) {
      wire = cA * .08 + (cC * .15 + cD * .08) * fr * .6 + cB * face * .02;
      wire += lc * (line * lineB * 1.1 + max(soft, 0.) * .1);
      }
      if (P.w > .001) {
      // solid glowing: dark glossy faces, horizon rim light, sun glints, emissive contour bands, molten peaks
      vec3 sdir = normalize(vec3(0., .25, 1.));
      vec3 rf = reflect(rd, n);
      float spc = pow(clamp(dot(rf, sdir), 0., 1.), 24.) * gSun;
      float hzr = exp(-abs(rf.y) * 8.);
      float key = clamp(dot(n, normalize(vec3(-sign(pos.x) * .5, .7, -.5))), 0., 1.);
      float lowF = smoothstep(.0, 2.5, pos.y);       // fade fill to the floor look at the corridor edge
      solid = cA * .2 + mix(cB, cC, .3) * key * key * .035 * lowF;
      solid += mix(cB, cD, .3 + .4 * gSun) * (pow(fr, 5.) * .15 + hzr * .025 + spc * .25) * lowF;
      solid += cB * .06 * face * exp(-hN * 2.5) * exp(-(abs(pos.x) - W0) * .03) * lowF;
      vec2 cl = gridAA(vec2(cy), cdd.xyxy * vec4(1., 0., 1., 0.), .05, .15);
      solid += mix(cB, cD, hN) * cl.x * (1.8 + pulse * 3.) * smoothstep(.1, .25, hN) * (.6 + .6 * gI);
      solid += lc * line * lineB * .15;
      solid += mix(cD, vec3(1., .8, .6), .2) * smoothstep(.85, 1.15, hN) * .15 * (.5 + gBLo);
      }
      col = mix(wire, solid, P.w);
    }
    // depth haze
    // distance haze + exponential height fog (valley mist, crisp peaks)
    float hb = .16;
    float ry = abs(rd.y) < 1e-4 ? 1e-4 : rd.y * hb;
    float hfog = .009 * exp(-ro.y * hb) * (1. - exp(-t * ry)) / ry;
    float fog = 1. - exp(-t * t * fogK - hfog);
    vec3 fogC = skyBase(normalize(vec3(rd.x, max(rd.y, 0.) * .5 + .005, rd.z))) * mix(.55, 1., smoothstep(90., TMAX, t));
    col = mix(col, fogC, fog);
  }

  // kick shock-curtain: a translucent wall of light running away along the corridor
  if (kg > .01) {
    float tc = (ro.z + front - ro.z) / max(rd.z, 1e-3);
    float tlim = mat < .5 ? 1e9 : t;
    if (rd.z > 0. && tc < tlim) {
      vec3 pc = ro + rd * tc;
      float wall = exp(-pc.y * 1.3) * smoothstep(W0 + 30., W0, abs(pc.x));
      float fade = 1. - smoothstep(30., 95., front);
      col += mix(cD, cB, .35) * wall * kg * fade * .2 * (.5 + .5 * gI);
    }
  }

  // low ground mist glow (volumetric-ish, analytic)
  float tm = mat < .5 ? TMAX : t;
  float mist = (1. - exp(-tm * .012)) * exp(-max(rd.y, 0.) * 18.);
  col += mix(cC, cB, .4) * mist * .06 * (.5 + .5 * gI);

  if (gSun > 0.) {
    vec3 cf = normalize(ta - ro);
    vec3 cr = normalize(cross(cf, vec3(sin(roll), cos(roll), 0.)));
    vec3 cu = cross(cr, cf);
    vec3 sd = normalize(vec3(0., sin(gSunEl), cos(gSunEl)));
    vec2 sUV = vec2(dot(sd, cr), dot(sd, cu)) / dot(sd, cf) * fl;
    // clap lens ghosts (along the sun -> centre axis)
    if (aSnare > .01) {
      for (int i = 0; i < 3; i++) {
        float k = -.6 - float(i) * .55;
        vec2 gp = sUV * k;
        float rr2 = .03 + .04 * float(i);
        float g = smoothstep(rr2, rr2 * .7, length(uv - gp));
        col += mix(cD, cC, float(i) * .5) * g * .25 * aSnare * gSun;
      }
    }
  }

  fragColor = vec4(max(col, 0.), 1.);
}
