// ---------------------------------------------------------------------------
// city — hyperspeed flight through an infinite neon megacity at night
//
// iParams.x  camera mode: 0 = corridor flight down the avenue between the towers
//            (y~13, traffic streams below), 1 = high aerial pass over the rooftops
//            (y~60, looking down into the canyon). Values in between = mid height.
// iParams.y  tower density/height: 0 = default skyline, 1 = taller, fatter, packed megacity
// iParams.z  rain: 0 = light drizzle streaks, 1 = heavy storm (more/brighter streaks, denser fog)
// iParams.w  speed: 0 = default cruise, 1 = ~2x hyperspeed
//
// Audio: aKickAcc drives travel (camera surges on every kick), kicks send a light
// shock-wave through the window grids + lens punch, claps flash the holo signs and
// (every other bar at high intensity) fire lightning, hats flicker a subset of windows,
// intensity > .8 colour-flips the neon each bar and glitches it.
// ---------------------------------------------------------------------------

#define CX 8.
#define CZ 10.
#define AV 5.
#define FAR 260.

float gPix, gHS, gGap, gPeak, gFlip, gGlitch, gRain, gKickWave, gCamZ;

// ---- city layout --------------------------------------------------------------
// cell.x = column (0 = the avenue, empty), cell.y = block along z
void bldg(vec2 cell, out vec2 c, out vec2 hs, out float h, out vec2 hs2, out float h2, out float pres) {
  vec3 r = hash33(vec3(cell, 7.31) + .13);
  vec3 q = hash33(vec3(cell.yx, 3.17) + .71);
  c = cell * vec2(CX, CZ) + vec2(0., CZ * .5);
  hs = vec2(CX * .5 - mix(.6, 1.4, r.x) * gGap, CZ * .5 - mix(.7, 1.9, r.y) * gGap);
  float ax = abs(cell.x);
  if (ax < 1.5) {                       // avenue walls: inner facade aligned on x = +-AV
    float outer = abs(c.x) + hs.x;
    hs.x = .5 * (outer - AV);
    c.x = sign(cell.x) * .5 * (outer + AV);
  }
  float hb = mix(9., 40., q.x * q.x);
  if (q.y > .86) hb = mix(70., 125., q.z);              // megatowers
  if (ax < 1.5) hb = max(hb, mix(18., 34., r.z));       // canyon walls
  h = hb * gHS;
  h2 = 0.; hs2 = hs;
  if (r.z > .45 && hb < 60.) { h2 = h + mix(4., 16., fract(r.z * 7.13)) * gHS; hs2 = hs * mix(.45, .75, fract(q.z * 5.3)); }
  pres = ax < .5 ? 0. : step(.07, fract(r.x * 13.7 + q.y));
}

vec2 iBox(vec3 ro, vec3 ird, vec3 b0, vec3 b1) {
  vec3 t1 = (b0 - ro) * ird, t2 = (b1 - ro) * ird;
  vec3 mn = min(t1, t2), mx = max(t1, t2);
  return vec2(max(max(mn.x, mn.y), mn.z), min(min(mx.x, mx.y), mx.z));
}

// anti-aliased line of half-width w at distance d, given pixel footprint fp
float lineAA(float d, float w, float fp) {
  float W = max(w, fp * .5);
  return clamp((W - d) / fp + .5, 0., 1.) * (w / W);
}

vec3 neonCol(float h) {
  h = fract(h + gFlip * .5);
  vec3 c = h < .4 ? cD : (h < .75 ? cB : cC * 1.6);
  return c;
}

vec3 skyCol(vec3 rd) {
  float y = rd.y;
  float hor = exp(-max(y, 0.) * 5.);
  vec3 c = cA * .5 + mix(cB * .05, cC * .22, hor) + cD * .05 * exp(-abs(y) * 9.);
  return c;
}

// ---- glowing light-line along z (flying / street traffic) ---------------------
// lane at (lx, ly), cars moving with velocity v (world units/s), returns emission
vec3 laneGlow(vec3 ro, vec3 rd, float tMax, vec2 L, float v, float dens, vec3 col, float w) {
  vec2 o = ro.xy, d = rd.xy;
  float dd = dot(d, d);
  float tc = dot(L - o, d) / dd;
  if (tc < .5 || tc > tMax) return vec3(0.);
  float dist = length(o + d * tc - L);
  float fp = tc * gPix * 1.5;
  float zc = ro.z + rd.z * tc;
  float s = (zc - v * gCamZ) / 6.;      // car pattern travelling along z
  float id = floor(s), f = fract(s);
  float hs = hash11(id * 1.37 + L.x * 7.1 + L.y * 3.3);
  float car = step(1. - dens, hs) * smoothstep(0., .08, f) * smoothstep(.55, .25, f);
  float W = max(w, fp);
  float core = (w / W) * exp(-dist * dist / (W * W));
  float halo = .06 * w / (dist * dist + w * .5);
  return col * car * (core * 3. + halo) * exp(-tc * .008);
}

// ---- holographic glyph column for vertical blade signs ------------------------
float glyph(vec2 g, vec2 f, float seed) {   // g = glyph cell id, f = 0..1 inside cell
  vec2 b = floor(f * vec2(4., 5.));
  float on = step(.48, hash13(vec3(b, seed + g.y * 3.1 + g.x * 11.7)));
  vec2 bf = fract(f * vec2(4., 5.)) - .5;
  float m = step(abs(bf.x), .38) * step(abs(bf.y), .38);
  float frame = step(.08, f.x) * step(f.x, .92) * step(.06, f.y) * step(f.y, .94);
  return on * m * frame;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - .5 * iResolution) / iResolution.y;
  float I = iIntensity;
  float mode = iParams.x;
  gHS = mix(1., 1.7, iParams.y);
  gGap = mix(1., .55, iParams.y);
  gRain = mix(.3, 1., iParams.z);
  gPeak = smoothstep(.78, .95, I);
  float flipB = floor(aBarCount + .5);
  gFlip = gPeak * step(.5, hash11(flipB * 1.31 + iSeed * 17.));
  gGlitch = gPeak * (.35 + .65 * aSnare);

  // ---- camera: travel driven by the kick integral ----
  float spd = mix(.7, 1.6, iParams.w) * mix(.5, 1., I);
  float camZ = iTime * 13. * spd + aKickAcc * 36. * spd + iSeed * 900.;
  gCamZ = camZ;
  float sx = iSeed * 6.28;
  float lat = mix(2.4, 1.6, mode);
  #define PX(z) (lat * sin((z) * .021 + sx) + .7 * sin((z) * .047 + sx * 2.))
  float camX = PX(camZ);
  float camY = mix(12.5 + 3. * sin(camZ * .011 + sx), 58. * gHS + 8. * sin(camZ * .009 + sx), mode);
  vec3 ro = vec3(camX, camY, camZ);
  float la = 24.;
  vec3 ta = vec3(PX(camZ + la), camY + mix(.6, -15., mode) + 1.5 * sin(camZ * .017), camZ + la);
  float dx = PX(camZ + 6.) - PX(camZ - 6.);
  float roll = -dx * .09 + .02 * sin(iTime * .7 + sx);
  float fl = mix(.78, .9, mode) - aKick * .05 * I;
  vec3 rd = camRay(ro, ta, uv, fl, roll);
  gPix = 1. / (iResolution.y * fl);
  rd += vec3(1e-5);
  vec3 ird = 1. / rd;

  // kick light-wave radius (expands from the camera after each kick)
  gKickWave = (1. - aKick) * 140.;
  float waveAmt = aKick * I;

  // ---- DDA through the building grid ----
  float tG = rd.y < 0. ? -ro.y / rd.y : 1e5;
  float tEnd = min(tG, FAR);
  float tHit = tEnd;
  float hitB = 0.;
  vec3 hb0 = vec3(0.), hb1 = vec3(1.);
  vec2 hCell = vec2(0.);
  vec3 glow = vec3(0.);

  vec2 o = vec2(ro.x + CX * .5, ro.z);
  vec2 d = rd.xz;
  vec2 C = vec2(CX, CZ);
  vec2 cell = floor(o / C);
  vec2 st = sign(d);
  vec2 tD = abs(C / d);
  vec2 tM = ((cell + max(st, 0.)) * C - o) / d;
  float tc = 0.;
  for (int i = 0; i < 48; i++) {
    if (tc > tEnd) break;
    vec2 c, hs, hs2; float h, h2, pres;
    bldg(cell, c, hs, h, hs2, h2, pres);
    if (pres > .5) {
      vec3 b0 = vec3(c.x - hs.x, 0., c.y - hs.y), b1 = vec3(c.x + hs.x, h, c.y + hs.y);
      vec2 bi = iBox(ro, ird, b0, b1);
      if (bi.x < bi.y && bi.x > 0. && bi.x < tHit) { tHit = bi.x; hb0 = b0; hb1 = b1; hitB = 1.; hCell = cell; }
      float top = h;
      if (h2 > 0.) {
        vec3 c0 = vec3(c.x - hs2.x, h - .01, c.y - hs2.y), c1 = vec3(c.x + hs2.x, h2, c.y + hs2.y);
        vec2 bj = iBox(ro, ird, c0, c1);
        if (bj.x < bj.y && bj.x > 0. && bj.x < tHit) { tHit = bj.x; hb0 = c0; hb1 = c1; hitB = 2.; hCell = cell; }
        top = h2;
      }
      // antenna + blinking aircraft light on tall towers
      if (top > 45.) {
        vec2 a = c;
        vec2 dxz = rd.xz; float l2 = dot(dxz, dxz);
        float ta2 = dot(a - ro.xz, dxz) / l2;
        if (ta2 > 0. && ta2 < tHit + 1.) {
          float dist = length(ro.xz + dxz * ta2 - a);
          float y = ro.y + rd.y * ta2;
          float ah = top + 6. + 6. * fract(c.x * .37 + c.y * .11);
          float dy = max(max(top - y, y - ah), 0.);
          float fpA = ta2 * gPix;
          float dd = sqrt(dist * dist + dy * dy);
          glow += vec3(.5, .55, .7) * .04 * lineAA(dd, .05, fpA) * exp(-ta2 * .01);
          // tip light
          vec3 tip = vec3(a.x, ah, a.y) - ro;
          float tt = dot(tip, rd);
          float dt = length(tip - rd * tt);
          float blink = smoothstep(.5, 0., fract(aBeatPhase * .5 + .25 * floor(fract(c.y * .1) * 4.)) );
          blink = .25 + .75 * smoothstep(.0, .2, fract(iTime * .5 + fract(c.y * .013))) * smoothstep(.45, .3, fract(iTime * .5 + fract(c.y * .013)));
          float W = max(.25, tt * gPix);
          glow += vec3(1., .08, .05) * blink * (.25 / W) * (.25 / W) * exp(-dt * dt / (W * W)) * 2.5 * exp(-tt * .006);
          glow += vec3(1., .08, .05) * blink * .015 / (dt * dt + .3) * exp(-tt * .01);
        }
      }
    }
    if (hitB > 0.) break;
    if (tM.x < tM.y) { tc = tM.x; tM.x += tD.x; cell.x += st.x; }
    else { tc = tM.y; tM.y += tD.y; cell.y += st.y; }
  }

  vec3 col = vec3(0.);
  vec3 p = ro + rd * tHit;
  float pulse = 1. + .5 * aKick * I;

  if (hitB > 0.) {
    // ---- building facade ----
    vec3 cen = .5 * (hb0 + hb1), he = .5 * (hb1 - hb0);
    vec3 qq = (p - cen) / he;
    vec3 aq = abs(qq);
    vec3 n = aq.x > aq.y && aq.x > aq.z ? vec3(sign(qq.x), 0., 0.) : (aq.y > aq.z ? vec3(0., sign(qq.y), 0.) : vec3(0., 0., sign(qq.z)));
    vec3 bid = hash33(vec3(hCell, 1.7 + hitB));
    float ndv = max(abs(dot(n, rd)), .12);
    float fp = tHit * gPix / ndv;
    vec3 ncol = neonCol(bid.z * 3.7);
    float isNeon = step(.45, bid.z);
    vec3 refl = skyCol(reflect(rd, n));
    float fres = pow(1. - ndv, 3.);
    if (abs(n.y) < .5) {
      vec2 fuv = abs(n.x) > .5 ? vec2(p.z, p.y) : vec2(p.x, p.y);
      float u0 = abs(n.x) > .5 ? hb0.z : hb0.x, u1 = abs(n.x) > .5 ? hb1.z : hb1.x;
      // windows
      vec2 wsz = vec2(mix(.45, .9, bid.x), mix(.55, .85, bid.y));
      vec2 wp = fuv / wsz;
      vec2 wc = floor(wp), wf = fract(wp) - .5;
      float wh = hash12(wc + bid.xy * 91.7);
      float floorH = hash12(vec2(wc.y, bid.x * 77.) + floor(wc.x / 6.) * 3.1);
      float litP = mix(.15, .7, bid.y) * step(.25, floorH);
      float lit = step(1. - litP, wh);
      vec2 fw = vec2(fp) / wsz;
      vec2 ext = vec2(mix(.25, .42, bid.x), mix(.28, .4, bid.y));
      float shape = clamp((ext.x - abs(wf.x)) / fw.x + .5, 0., 1.) * clamp((ext.y - abs(wf.y)) / fw.y + .5, 0., 1.);
      float lod = smoothstep(.3, 1., max(fw.x, fw.y));
      float avg = litP * .8 * 4. * ext.x * ext.y;
      float win = mix(shape * lit, avg, lod);
      vec3 wcol = mix(mix(cC, cB, step(.6, fract(wh * 7.3))), vec3(1.), .3);
      wcol = mix(wcol, cD, step(.92, fract(wh * 13.1)));
      float wb = mix(.35, 1.1, fract(wh * 3.7));
      // hat flicker subset
      float fl2 = fract(wh * 29.3);
      wb *= fl2 < .12 ? (.2 + 2.5 * aHat) : 1.;
      // kick wave through the city
      float wave = waveAmt * exp(-abs(tHit - gKickWave) * .12) * 2.5;
      vec3 e = wcol * win * wb * (pulse + wave);
      // facade glass + uplight
      vec3 base = cA * .25 + refl * fres * .9 + cC * .05 * exp(-p.y * .08) + cD * .03 * exp(-p.y * .2);
      col = base * (1. - win) + e;
      // neon edges
      float de = min(fuv.x - u0, u1 - fuv.x);
      float dt = hb1.y - p.y;
      float glitch = gGlitch * step(.7, hash11(floor(p.y * .7) + floor(iTime * 12.)));
      float nl = lineAA(de + glitch * .3, .07, fp) + lineAA(dt, .07, fp);
      // horizontal bands on some neon towers
      float bandSp = mix(4., 9., bid.x);
      float bandOn = step(.7, bid.y) * isNeon;
      float bd = abs(fract(p.y / bandSp) - .5) * bandSp;
      float band = bandOn * lineAA(bd, .05, fp) * (1. - gGlitch * step(.5, hash11(floor(p.y / bandSp) + floor(iTime * 8.))));
      vec3 neon = ncol * (nl * isNeon * 4. + band * 3.) * (1. + .6 * aKick * I);
      neon += ncol * isNeon * .25 * (exp(-de * 2.5) + exp(-dt * 2.5)) * (1. + aKick * I);
      col += neon;
      col += (1. - isNeon) * cB * .15 * (lineAA(de, .05, fp) + lineAA(dt, .05, fp));
    } else {
      // roof
      vec2 r2 = p.xz - cen.xz;
      vec2 dd = he.xz - abs(r2);
      float de = min(dd.x, dd.y);
      col = cA * .3 + refl * .1;
      col += ncol * isNeon * 4. * lineAA(de, .07, fp);
      col += cB * .2 * (1. - isNeon) * lineAA(de, .05, fp);
      // corner warning lights
      float cl = length(dd - .3);
      float bl = step(.5, fract(iTime * .9 + bid.x));
      col += vec3(1., .1, .05) * bl * 3. * lineAA(cl, .12, fp);
      // rooftop machinery glow (dim grid)
      vec2 gq = abs(fract(r2 * .5) - .5);
      col += cC * .04 * step(.42, max(gq.x, gq.y)) * step(1., de);
    }
  } else if (tHit < FAR && tG < FAR) {
    // ---- ground: wet asphalt + traffic in the side streets ----
    float fp = tHit * gPix / max(-rd.y, .05);
    vec3 refl = skyCol(reflect(rd, vec3(0., 1., 0.)));
    col = cA * .15 + refl * .35 * pow(1. + rd.y, 4.);
    // street-light pools
    col += cC * .05 * vnoise(p.xz * .3);
    if (abs(p.x) > AV) {
      // side streets: traffic stripes along z between the blocks
      float lx = p.x - (floor(p.x / CX) + .5) * CX;   // distance to block boundary
      float lane = lineAA(abs(abs(lx) - .4), .12, fp);
      float dir = sign(lx);
      float s = (p.z + dir * 12. * iTime) / 4.;
      float car = step(.5, hash11(floor(s) + floor(p.x / CX) * 13.)) * smoothstep(.0, .1, fract(s)) * smoothstep(.6, .3, fract(s));
      col += mix(vec3(1., .9, .8), cD, step(0., dir)) * lane * car * 2.5;
      float lz = p.z - floor(p.z / CZ) * CZ;           // cross streets along x
      float laneZ = lineAA(abs(min(lz, CZ - lz) - .4), .12, fp);
      float s2 = (p.x + sign(CZ * .5 - lz) * 10. * iTime) / 4.;
      float car2 = step(.55, hash11(floor(s2) + floor(p.z / CZ) * 7.)) * smoothstep(.0, .1, fract(s2)) * smoothstep(.6, .3, fract(s2));
      col += mix(cD, vec3(1., .9, .8), step(lz, CZ * .5)) * laneZ * car2 * 2.;
    } else {
      // avenue: lane markings
      float lm = lineAA(abs(abs(p.x) - 1.9), .05, fp) * step(.5, fract(p.z * .25));
      col += vec3(.6, .65, .8) * lm * .15;
    }
  } else {
    // ---- sky ----
    col = skyCol(rd);
    float tc2 = (160. - ro.y) / max(rd.y, .02);
    vec2 cp = (ro.xz + rd.xz * tc2) * .008 + vec2(0., iTime * .01);
    float cl = fbm(cp);
    float flash = 0.;
    col += mix(cD * .12, cB * .08, cl) * smoothstep(.35, .8, cl) * exp(-tc2 * .002);
    float lightning = aSnare * aSnare * smoothstep(.6, 1., I) * step(.5, fract(aBarCount * .5));
    col += vec3(.7, .75, 1.) * lightning * 2. * smoothstep(.3, .9, cl);
  }

  // ---- fog (height falloff, teal low / violet high) ----
  float H = 18.;
  float yb = ro.y, ye = ro.y + rd.y * tHit;
  float od = .006 * tHit + .05 * H * (exp(-yb / H) - exp(-ye / H)) / (rd.y + sign(rd.y + 1e-6) * 1e-3) ;
  od *= mix(.8, 1.6, gRain);
  float T = exp(-max(od, 0.));
  vec3 fogC = mix(cC * .2, cA * .7 + cB * .05, smoothstep(5., 60., .5 * (yb + ye)));
  fogC += cD * .03;
  float lightning = aSnare * aSnare * smoothstep(.6, 1., I) * step(.5, fract(aBarCount * .5));
  fogC += vec3(.5, .55, .8) * lightning * .5;
  col = col * T + fogC * (1. - T);

  // ---- emissive extras along the avenue ----
  // vertical blade signs sticking out of the avenue walls (planes z = const)
  if (rd.z > 0.) {
    float k0 = floor(ro.z / CZ);
    for (int k = 0; k < 14; k++) {
      float kk = k0 + float(k);
      float zk = (kk + .3 + .4 * hash11(kk * 1.7)) * CZ;
      float tk = (zk - ro.z) / rd.z;
      if (tk > tHit) break;
      if (tk < .2) continue;
      vec2 sp = ro.xy + rd.xy * tk;
      float side = sign(sp.x);
      vec3 sh = hash33(vec3(kk, side, 5.3));
      if (sh.x < .35) continue;
      float x0 = AV - .25, x1 = AV - 1.65;
      float y0 = mix(3., 32., sh.y) * gHS, len = mix(5., 14., sh.z);
      float ax = abs(sp.x);
      if (ax > x0 || ax < x1 || sp.y < y0 || sp.y > y0 + len) continue;
      vec2 su = vec2((x0 - ax) / (x0 - x1), (sp.y - y0) / 1.5);
      float fpS = tk * gPix / max(abs(rd.z), .2) / 1.4;
      vec2 g = vec2(0., floor(su.y));
      float gl = glyph(g + kk * 3., vec2(su.x, fract(su.y)), sh.x * 50. + floor(iTime * .5 + sh.y * 4.));
      gl = mix(gl, .35, smoothstep(.15, .5, fpS * 4.));
      vec3 sc = neonCol(sh.y * 2.3 + sh.z);
      float fr = 1. - min(min(su.x, 1. - su.x) * 1.4, min(sp.y - y0, y0 + len - sp.y)) / max(fpS * 1.5, .06);
      float frame = clamp(fr, 0., 1.);
      float flash = aSnare * step(.5, fract(sh.z * 7. + aBeatCount * .5));
      vec3 e = sc * (gl * 2.2 + frame * 3. + .12) * (1. + flash * 3.);
      e *= .85 + .15 * sin(sp.y * 40. + iTime * 10.);           // holo scanlines
      col += e * exp(-tk * .009);
    }
  }

  // flat holo screens on the avenue walls (planes x = +-AV)
  {
    float s = sign(rd.x);
    float tk = (s * (AV - .08) - ro.x) / rd.x;
    if (tk > .2 && tk < tHit + .5) {
      vec3 sp = ro + rd * tk;
      float kz = floor(sp.z / CZ);
      vec3 sh = hash33(vec3(kz, s, 9.1));
      if (sh.x > .45) {
        float zc = (kz + .5) * CZ, hw = mix(2., 3.6, sh.y);
        float y0 = mix(4., 26., sh.z) * gHS, hh = hw * mix(.5, .9, sh.x);
        vec2 su = vec2((sp.z - zc) / hw, (sp.y - y0) / hh);
        if (abs(su.x) < 1. && su.y > 0. && su.y < 1.) {
          float fpS = tk * gPix / max(abs(rd.x), .1);
          float typ = floor(sh.y * 3.);
          vec3 c1 = neonCol(sh.z * 3.1), c2 = neonCol(sh.z * 3.1 + .45);
          vec3 e;
          if (typ < 1.) {        // spectrum equalizer
            float bx = floor((su.x * .5 + .5) * 16.);
            float lv = spec(bx / 16. * .8 + .05);
            float bar = step(su.y, lv * 1.1) * step(.15, fract((su.x * .5 + .5) * 16.));
            e = mix(c1, c2, su.y) * bar * 2.5;
          } else if (typ < 2.) { // pulsing rings
            float r = length(su * vec2(hw / hh, 1.) * vec2(1., 1.) - vec2(0., .5));
            float rg = .5 + .5 * sin(r * 18. - iTime * 6. - aKick * 4.);
            e = mix(c1, c2, rg) * (.4 + 1.6 * smoothstep(.6, 1., rg));
          } else {              // scrolling text rows
            vec2 gp = vec2(su.x * 6. + iTime * 3., su.y * 4.);
            float gl = glyph(floor(gp), fract(gp), sh.x * 30.);
            e = mix(c1 * .25, c2 * 2.5, gl);
          }
          e *= .8 + .2 * sin(sp.y * 50.);
          float flash = aSnare * step(.5, fract(sh.x * 5. + aBeatCount * .5));
          e += c2 * flash * 2.;
          float soft = smoothstep(.0, .3, max(fpS / hw * 8., .0));
          e = mix(e, mix(c1, c2, .5) * .8, soft);
          col += e * exp(-tk * .009);
        }
      }
    }
  }

  // flying traffic + avenue ground traffic (glowing streams along z)
  vec3 tail = cD * vec3(1., .6, .6) + vec3(.3, 0., 0.);
  vec3 head = mix(vec3(1.), cC, .3);
  glow += laneGlow(ro, rd, tHit, vec2(-1.2, 7.5), 9., .45, head, .05);
  glow += laneGlow(ro, rd, tHit, vec2(1.4, 9.5), 0., .4, tail, .05);
  glow += laneGlow(ro, rd, tHit, vec2(-2.6, 20.), -14., .35, head, .06);
  glow += laneGlow(ro, rd, tHit, vec2(2.9, 26.), 30., .35, cB * 1.5, .06);
  glow += laneGlow(ro, rd, tHit, vec2(-3.6, .25), 6., .55, head, .07);
  glow += laneGlow(ro, rd, tHit, vec2(-2.2, .25), 10., .5, head, .07);
  glow += laneGlow(ro, rd, tHit, vec2(2.2, .25), 22., .5, tail, .07);
  glow += laneGlow(ro, rd, tHit, vec2(3.6, .25), 18., .55, tail, .07);
  col += glow;

  // ---- rain: streaks on cylinders around the travel axis (radial hyperspeed rain) ----
  {
    float rl = length(rd.xy);
    float ang = atan(rd.y, rd.x);
    vec3 racc = vec3(0.);
    for (int L = 0; L < 3; L++) {
      float R = 1.6 + float(L) * 1.9;
      float tr = R / max(rl, 1e-3);
      if (tr > tHit || tr > 60.) continue;
      float zr = ro.z + rd.z * tr;
      float a = ang * R;
      float cw = .22;
      float ca = floor(a / cw);
      float h1 = hash11(ca * 3.17 + float(L) * 19.3);
      float zz = zr * .12 + h1 * 7. + iTime * 1.5;
      float seg = fract(zz);
      float on = step(1. - (.25 + .35 * gRain), hash11(floor(zz) + ca * 1.3));
      float fpR = tr * gPix;
      float da = abs(fract(a / cw) - .5) * cw;
      float ln = lineAA(da, .006, fpR);
      float len = smoothstep(0., .05, seg) * smoothstep(.55, .1, seg);
      racc += mix(cC, cB, h1) * on * ln * len * exp(-tr * .03);
    }
    col += racc * (1.2 + 1.5 * gRain) * (1. + aKick * I * .5);
  }

  fragColor = vec4(max(col, 0.), 1.);
}
