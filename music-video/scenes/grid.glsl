// ============================================================================
// grid — retro-future synthwave night drive (hyper-modern take)
//
// An endless neon grid corridor between audio-driven ridged mountains, a giant
// scan-cut setting sun at the vanishing point, horizon laser beams, starfield +
// nebula, wet-glass floor reflections and depth haze.
//
// iParams (all 0..1; 0,0,0,0 = low wire hills under a starry sky, cruising low)
//   x : terrain height      0 = low rolling hills .. 1 = towering ridged mountains
//   y : sun                 0 = no sun, starry night + nebula .. 1 = giant setting sun
//   z : camera height+speed 0 = low (0.7u) & cruising .. 1 = high (5u) & fast
//   w : terrain style       0 = black wireframe w/ neon grid lines
//                           1 = solid shaded glowing terrain (lit faces + contour lines)
//
// Audio: travel = f(iTime, aKickAcc) -> surge on each kick; kick also launches a
// bright pulse wave that runs forward along the grid (and over the mountains);
// claps -> sun flare + anamorphic lens streak; mountains' height follows the
// spectrum (near ridges = bass, far ridges = mids/highs); hats twinkle stars and
// lasers; camera banks left/right on each bar. At intensity > ~0.82 the sun
// cracks into slices that drift apart.
// ============================================================================

#define CELL 2.0
#define W0 8.0
#define TMAX 260.0

vec4  P;
float gHS, gBLo, gBMid, gBHi, gSun, gSunR, gSunEl, gPix, gShat, gI;

float specAvg(float x) {
  float d = 1. / 64.;
  return (textureLod(iSpectrum, vec2(x - d, .5), 0.).r + textureLod(iSpectrum, vec2(x, .5), 0.).r +
          textureLod(iSpectrum, vec2(x + d, .5), 0.).r) * (1. / 3.);
}

// ---------------------------------------------------------------- terrain
float terrainH(vec2 p) {
  float dx = abs(p.x) - W0;
  if (dx <= 0.) return 0.;
  float ramp = smoothstep(0., 26., dx);
  vec2 q = p * .05 + (p.x < 0. ? vec2(41.7, 13.1) : vec2(0.));
  float n1 = 1. - abs(2. * vnoise(q) - 1.);
  float n2 = 1. - abs(2. * vnoise(q * 2.17 + 5.3) - 1.);
  float n3 = vnoise(q * 4.9 + 1.7);
  float h = n1 * n1 * .62 + n2 * n2 * .28 + n3 * .1;
  float lat = smoothstep(6., 40., dx);
  float band = mix(gBLo, mix(gBMid, gBHi, smoothstep(40., 80., dx)), lat);
  return ramp * gHS * h * (.55 + .85 * band);
}

vec3 terrainN(vec2 p) {
  float e = .15;
  float h = terrainH(p);
  return normalize(vec3(h - terrainH(p + vec2(e, 0.)), e, h - terrainH(p + vec2(0., e))));
}

float marchTerrain(vec3 ro, vec3 rd, float t0, float maxH) {
  float t = t0, lt = t0, ld = 1e3;
  for (int i = 0; i < 80; i++) {
    vec3 p = ro + rd * t;
    if (p.y > maxH && rd.y >= 0.) return -1.;
    float d = p.y - terrainH(p.xz);
    if (d < 0.) return lt + (t - lt) * ld / (ld - d);
    lt = t; ld = d;
    t += max(d * .4, .02 + t * .006);
    if (t > TMAX) return -1.;
  }
  return t;
}

// ---------------------------------------------------------------- AA grid (pristine-grid style)
// uv in cell units, dd = (dFdx(uv), dFdy(uv)), lw = line width as fraction of a cell
vec2 gridAA(vec2 uv, vec4 dd, float lw) {
  vec2 deriv = vec2(length(dd.xz), length(dd.yw));
  vec2 drawW = clamp(vec2(lw), deriv, vec2(.5));
  vec2 aa = deriv * 1.5;
  vec2 g = 1. - abs(fract(uv) * 2. - 1.);
  vec2 l = smoothstep(drawW + aa, drawW - aa, g);
  l *= clamp(lw / drawW, 0., 1.);
  l = mix(l, vec2(lw), clamp(deriv * 2. - 1., 0., 1.));
  return l;
}

// ---------------------------------------------------------------- sky
vec3 lasers(float az, float el, float blur) {
  vec3 acc = vec3(0.);
  if (gI < .25) return acc;
  float on = smoothstep(.25, .6, gI);
  float bar = floor(aBarCount * .5);
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float h = hash11(fi * 7.31 + bar * 1.73 + iSeed * 13.);
    float h2 = hash11(fi * 3.17 + bar * 5.11 + 2.);
    if (h2 > .35 + .6 * gI) continue;
    float base = (fi - 3.) * .2 + (h - .5) * .12;
    float tilt = (h - .5) * 1.1 + sin(iTime * .35 + fi * 1.7) * .12;
    float x = az - base - max(el, 0.) * tilt;
    float w = max(.0016, gPix * 1.1) * (1. + blur * 7.);
    float core = .0016 / w * exp(-x * x / (w * w));
    float halo = .05 * exp(-abs(x) * 70. / (1. + blur * 3.));
    float fade = exp(-max(el, 0.) * 2.2) * smoothstep(-.01, .02, el);
    vec3 c = mix(cB, cD, step(.7, h)) ;
    float flick = .65 + .5 * aHat + .3 * aKick;
    acc += c * (core * 2.6 + halo) * fade * flick;
  }
  return acc * on;
}

vec3 sunCol(vec2 sp, float blur, out float cover) {
  // sp: sun-local coords (1 = radius); returns emission
  cover = 0.;
  if (gSun <= 0.) return vec3(0.);
  float pixS = gPix / gSunR * (1. + blur * 6.);
  vec2 q = sp;
  // shatter: slices drift apart / tilt
  float N = 7.;
  float sy = q.y / (1. + gShat * .35);
  float k = floor(sy * N * .5 + N * .5);
  float fk = fract(sy * N * .5 + N * .5);
  float hk = hash11(k * 13.7 + 3.1);
  float drift = gShat * ((hk - .5) * .9 + .25 * sin(iTime * .6 + k * 2.1)) * (1. + .5 * aKick);
  q.x -= drift;
  q.y += gShat * (hk - .5) * .06 * q.x;            // tilt slices
  float r = length(q);
  float disc = smoothstep(1. + pixS, 1. - pixS, r);
  // scanline cuts (lower part), scrolling down with travel
  float u = q.y * 9. + (iTime * .35 + aKickAcc * .15);
  float gw = smoothstep(.35, -1., q.y) * .55;
  float du = 9. * pixS * 1.2;
  float g = abs(fract(u) - .5) * 2.;                 // 0 at cut center .. 1
  float cut = smoothstep(gw - du, gw + du, g);
  cut = mix(cut, 1. - gw, clamp(du * 2. - .5, 0., 1.));
  // shatter gaps between slices
  float gap = gShat * .22;
  float sg = smoothstep(gap, gap + pixS * N, fk) * smoothstep(gap, gap + pixS * N, 1. - fk);
  sg = mix(1., sg, step(.001, gShat));
  cover = disc * cut * sg;
  // gradient: hot top -> key bottom
  float v = clamp(q.y * .5 + .5, 0., 1.);
  vec3 top = mix(cD, vec3(1., .9, .75), .45);
  vec3 bot = mix(cD, cB, .8);
  vec3 c = mix(bot, top, smoothstep(.0, 1., v)) * (1.1 + 2.2 * v * v);
  // crack edges glow hot when shattered
  float edge = gShat * (1. - smoothstep(0., pixS * N * 3., abs(fk - gap - pixS * N))) * disc;
  c *= 1. + aSnare * .7;
  return c * cover * (.75 + .25 * gI) + edge * vec3(1.6, 1.3, 1.4) * 2.;
}

vec3 sky(vec3 rd, float blur, bool stars) {
  float el = rd.y;
  float az = atan(rd.x, rd.z);
  // base gradient + horizon glow
  vec3 col = mix(cA * .9 + cC * .03, cA * .2, smoothstep(-.02, .55, el));
  float hz = exp(-max(el, 0.) * 10.);
  col += mix(cC, cD, .55 + .25 * gSun) * hz * (.12 + .3 * gSun) * (.6 + .4 * gI);
  // nebula (stronger at night)
  float nebA = (1. - .7 * gSun) * smoothstep(.0, .25, el);
  if (stars && nebA > 0.01) {
    vec2 nq = vec2(az * 1.6, el * 2.6) + iSeed * 7.;
    float n = vnoise(nq * 2.) * .5 + vnoise(nq * 4.1 + 3.) * .3 + vnoise(nq * 8.3 + 7.) * .2;
    float n2 = vnoise(nq * 1.3 + 11.);
    float neb = smoothstep(.45, .85, n) * (.5 + .5 * n2);
    col += mix(cB, cD, n2) * neb * .1 * nebA;
    col += cC * smoothstep(.55, .9, n * n2 * 1.6) * .05 * nebA;
  }
  // stars
  if (stars && el > 0.) {
    float sA = (1. - .55 * gSun) * smoothstep(.0, .2, el);
    for (int L = 0; L < 2; L++) {
      float sc = L == 0 ? 70. : 150.;
      vec2 sq = vec2(az, el) * sc + float(L) * 17.;
      vec2 id = floor(sq), f = fract(sq) - .5;
      vec2 h = hash22(id + iSeed * 31.);
      vec2 o = (h - .5) * .7;
      float d = length(f - o) / sc;              // angular distance
      float sig = gPix * .9;
      float b = exp(-d * d / (sig * sig));
      float m = hash12(id * 1.7 + 4.);
      float tw = .6 + .4 * sin(iTime * (2. + 4. * m) + m * 40.) + aHat * .6;
      b *= step(L == 0 ? .55 : .7, m) * (L == 0 ? 1.8 : .8) * tw;
      col += mix(vec3(1.), cC + .3, h.x * .6) * b * sA;
    }
  }
  // lasers
  col += lasers(az, el, blur);
  // sun + halo
  vec2 sp = vec2(az, el - gSunEl) / gSunR;
  float cover;
  vec3 s = sunCol(sp, blur, cover);
  float r = length(sp);
  col = mix(col, vec3(0.), cover * .9) + s;
  float halo = gSun * (exp(-max(r - 1., 0.) * 2.2) * .22 + exp(-max(r - 1., 0.) * 9.) * .35) * (1. - cover);
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
  gHS = mix(4., 22., P.x);
  gSun = smoothstep(0., .25, P.y);
  gSunR = mix(.14, .36, P.y);
  gSunEl = mix(.05, .1, P.y);
  gShat = smoothstep(.82, 1., gI) * (.55 + .45 * smoothstep(0., 3., iLocal));

  // camera: travel surges on every kick, banks left/right on the bar
  float fl = 1.05;
  gPix = 1. / (iResolution.y * fl);
  float spd = mix(5., 15., P.z) * (.45 + .55 * gI);
  float camZ = iTime * spd + aKickAcc * mix(9., 20., P.z) + iSeed * 900.;
  float camH = mix(.7, 5., P.z * P.z);
  float sway = sin(iTime * .23 + iSeed * 6.28) * 2.2 + sin(iTime * .093 + 1.) * 1.2;
  vec3 ro = vec3(sway, camH, camZ);
  float bank = cos(PI * (aBarCount + smoothstep(0., .7, aBarPhase)));
  float roll = .045 * bank * (.5 + .5 * gI) + sin(iTime * .23 + iSeed * 6.28) * .02;
  vec3 ta = vec3(sway * .8, camH * .78 + .35 - aKick * .06 * gI, camZ + 12.);
  vec3 rd = camRay(ro, ta, uv, fl, roll);

  // --- intersect: corridor floor analytically, mountains by heightfield march
  float maxH = gHS * 1.45;
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
  float cy = pos.y / 1.6 - iTime * .25;
  vec2 cdd = vec2(dFdx(cy), dFdy(cy));

  vec3 col;
  // kick pulse wave running forward along the grid
  float zr = pos.z - ro.z;
  float front = 3. + aBeatPhase * 95.;
  float kg = clamp(aKick * 2.3, 0., 1.) * smoothstep(.15, .55, gI);
  float pulse = kg * (exp(-abs(zr - front) * .3) * 1.4 + step(zr, front) * exp(-(front - zr) * .05) * .3);
  float fogK = .0085 + .004 * (1. - gSun);
  vec3 haze = mix(cC, cD, .45 + .25 * gSun) * (.1 + .25 * gSun) * (.6 + .4 * gI) + cA * .3;

  if (mat < .5) {
    col = sky(rd, 0., true);
  } else {
    // ---- shading common
    vec2 gl = gridAA(guv, gdd, .045);
    float line = max(gl.x, gl.y);
    vec2 gs = gridAA(guv, gdd, .2);                  // soft neon halo around lines
    float soft = max(gs.x, gs.y) - line * .5;
    float lineB = (1.1 + .9 * gI) * (1. + pulse * 4.5);
    if (mat < 1.5) {
      // ---- wet glass floor
      float rip = exp(-t * .03);
      vec2 rn = (vec2(vnoise(pos.xz * .35), vnoise(pos.xz * .35 + 7.3)) - .5) * .09 * rip;
      vec3 n = normalize(vec3(rn.x, 1., rn.y));
      vec3 rr = reflect(rd, n);
      rr.y = max(rr.y, .002);
      float fres = .04 + .96 * pow(1. - max(dot(-rd, n), 0.), 5.);
      // terrain occlusion of the reflection (cheap: 5 probes)
      float occ = 0.;
      float tt = 3.;
      for (int k = 0; k < 5; k++) {
        vec3 q = pos + rr * tt;
        if (q.y < terrainH(q.xz)) { occ = 1. - tt / 90.; break; }
        tt *= 2.1;
      }
      vec3 refl = sky(rr, 1., false);
      refl = mix(refl, haze * .5 + cA * .1, clamp(occ, 0., 1.) * .95);
      col = cA * .04 + refl * fres * .85;
      vec3 lc = mix(cB, cD, smoothstep(20., 140., t) * .5);
      col += lc * (line * lineB + max(soft, 0.) * .12 * (1. + pulse * 2.));
      col += mix(cD, vec3(1.), .3) * pulse * .12 * exp(-abs(zr - front) * .5);
      col += cB * aSub * .02 * gI;
    } else {
      // ---- mountains
      vec3 n = terrainN(pos.xz);
      float hN = clamp(pos.y / (gHS * 1.1), 0., 1.);
      float fr = pow(1. - clamp(dot(n, -rd), 0., 1.), 3.);
      float face = clamp(dot(n, vec3(-sign(pos.x), .4, 0.)), 0., 1.);     // faces toward the corridor glow
      vec3 lc = mix(cB, cD, smoothstep(.1, .75, hN));
      // wireframe
      vec3 wire = cA * .08 + (cC * .15 + cD * .08) * fr * .6 + cB * face * .02;
      wire += lc * (line * lineB * 1.1 + max(soft, 0.) * .1);
      // solid glowing
      vec3 sdir = normalize(vec3(0., .35, 1.));
      float back = clamp(dot(n, sdir), 0., 1.);
      vec3 solid = mix(cA * .6, cB * .25, hN) * (.25 + .75 * face) + mix(cD, cC, .3) * pow(back, 2.) * .35 * gSun;
      solid += mix(cC, cD, hN) * fr * .5;
      vec2 cl = gridAA(vec2(cy), cdd.xyxy * vec4(1., 0., 1., 0.), .06);
      solid += mix(cB, cD, hN) * cl.x * (1.4 + pulse * 3.) * smoothstep(.05, .2, hN);
      solid += lc * line * lineB * .3;
      solid += cD * pow(hN, 3.) * .5;
      col = mix(wire, solid, P.w);
    }
    // depth haze
    float fog = 1. - exp(-t * fogK);
    vec3 fogC = haze + sky(normalize(vec3(rd.x, .01, rd.z)), 2., false) * .0;
    col = mix(col, fogC, fog);
  }

  // low ground mist glow (volumetric-ish, analytic)
  float tm = mat < .5 ? TMAX : t;
  float mist = (1. - exp(-tm * .012)) * exp(-max(rd.y, 0.) * 18.);
  col += mix(cC, cB, .4) * mist * .06 * (.5 + .5 * gI);

  // clap lens ghosts (screen space, along the sun -> centre axis)
  if (gSun > 0. && aSnare > .01) {
    vec3 cf = normalize(ta - ro);
    vec3 cr = normalize(cross(cf, vec3(sin(roll), cos(roll), 0.)));
    vec3 cu = cross(cr, cf);
    vec3 sd = normalize(vec3(0., sin(gSunEl), cos(gSunEl)));
    vec2 sUV = vec2(dot(sd, cr), dot(sd, cu)) / dot(sd, cf) * fl;
    for (int i = 0; i < 3; i++) {
      float k = -.6 - float(i) * .55;
      vec2 gp = sUV * k;
      float rr2 = .03 + .04 * float(i);
      float g = smoothstep(rr2, rr2 * .7, length(uv - gp));
      col += mix(cD, cC, float(i) * .5) * g * .25 * aSnare * gSun;
    }
  }

  fragColor = vec4(max(col, 0.), 1.);
}
