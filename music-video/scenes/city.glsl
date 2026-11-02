// ---------------------------------------------------------------------------
// city — hyperspeed flight through an infinite neon megacity at night
//
// iParams.x  camera mode (continuous): 0 = corridor flight down the neon avenue between
//            the towers (y~12, under the skybridges, wet mirror street + traffic below,
//            blade signs whooshing past), 1 = high aerial pass over the rooftops (y~70,
//            pitched down into the glowing canyons, megatowers + sky lasers),
//            0.5 = mid-height (y~40) between the two.
// iParams.y  tower density/height: 0 = default skyline, 1 = 1.7x taller, fatter blocks with
//            narrower streets (signs/bridges placed higher, hologram a bit bigger).
// iParams.z  rain: 0 = light drizzle + damp street, 1 = heavy storm (3 streak layers, more
//            and brighter streaks, denser fog, mirror-wet avenue).
// iParams.w  speed: 0 = default cruise, 1 = ~2.3x hyperspeed (longer rain streaks too).
// iSeed      offsets the camera path / position along the infinite city.
//
// Look: three facade types (office ribbon glazing with ceiling lights/blinds, punched
// residential grid with pilasters, dark glass curtain wall), coloured light spill from the
// blade signs onto the avenue walls, skybridges with lit corridors crossing the avenue
// (the camera flies under them), and a wet mirror avenue reflecting walls, signs, the
// hologram and the vanishing-point glow.
//
// Audio: travel = iTime + aKickAcc (camera surges on every kick) + small FOV punch.
// Kicks: the neon skybridges spanning the avenue strobe, a light shock-wave runs out
// through the window grids, neon tubes, rooftop helipad rings and the vanishing-point glow
// (and its streak on the wet road) pulse. Claps flash half of the holo signs/screens and
// their light spill on the walls, and every other
// bar at intensity > .6 fire lightning (sky flash + forked bolt). Hats flicker a subset of
// windows. Lasers sweep on an 8-beat cycle. Intensity > .8: neon colours flip per bar
// (hash), neon tubes stutter and the giant avenue hologram glitches on claps. Every ~300
// units the camera flies through a giant hologram bust floating in the avenue (mirrored
// in the wet asphalt) — the "whoa" moment, ~every 10-25 s.
// ---------------------------------------------------------------------------

#define CX 8.
#define CZ 10.
#define AV 6.
#define FAR 230.
#define SPB 32.

vec3 nB, nC, nD;
float gStreak, gMega;
float gPix, gHS, gGap, gPeak, gFlip, gGlitch, gRain, gKickWave, gCamZ, gKP, gI;

// ---- city layout --------------------------------------------------------------
// cell.x = column (0 = the avenue, empty), cell.y = block along z
void bldg(vec2 cell, out vec2 c, out vec2 hs, out float h, out vec2 hs2, out float h2, out float pres) {
  pres = 0.; c = vec2(0.); hs = vec2(1.); h = 0.; hs2 = hs; h2 = 0.;
  if (abs(cell.x) < .5) return;
  vec3 r = hash33(vec3(cell, 7.31) + .13);
  vec3 q = fract(r.yzx * vec3(13.71, 29.37, 7.93) + r.zxy * 3.1);
  c = cell * vec2(CX, CZ) + vec2(0., CZ * .5);
  hs = vec2(CX * .5 - mix(.6, 1.4, r.x) * gGap, CZ * .5 - mix(.7, 1.9, r.y) * gGap);
  float ax = abs(cell.x);
  if (ax < 1.5) {                       // avenue walls: inner facade aligned on x = +-AV
    float outer = abs(c.x) + hs.x;
    hs.x = .5 * (outer - AV);
    c.x = sign(cell.x) * .5 * (outer + AV);
  }
  float hb = mix(9., 40., q.x * q.x);
  if (q.y > gMega + step(2.5, ax) * .03) hb = mix(70., 125., q.z);   // megatowers
  if (ax < 1.5) hb = max(hb, mix(18., 34., r.z));       // canyon walls
  h = hb * gHS;
  h2 = 0.; hs2 = hs;
  if (r.z > .45 && hb < 60.) { h2 = h + mix(4., 16., fract(r.z * 7.13)) * gHS; hs2 = hs * mix(.45, .75, fract(q.z * 5.3)); }
  pres = step(.07, fract(r.x * 13.7 + q.y));
}

vec2 iBox(vec3 ro, vec3 ird, vec3 b0, vec3 b1) {
  vec3 t1 = (b0 - ro) * ird, t2 = (b1 - ro) * ird;
  vec3 mn = min(t1, t2), mx = max(t1, t2);
  return vec2(max(max(mn.x, mn.y), mn.z), min(min(mx.x, mx.y), mx.z));
}
vec3 boxN(vec3 p, vec3 b0, vec3 b1) {
  vec3 qq = (p - .5 * (b0 + b1)) / (.5 * (b1 - b0)), aq = abs(qq);
  return aq.x > aq.y && aq.x > aq.z ? vec3(sign(qq.x), 0., 0.) : (aq.y > aq.z ? vec3(0., sign(qq.y), 0.) : vec3(0., 0., sign(qq.z)));
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
vec3 warmCol() { return mix(cD, vec3(1., .78, .55), .55); }
vec3 coolCol() { return mix(cC / max(max(cC.r, cC.g), max(cC.b, .01)) * .9, vec3(.85, .92, 1.), .4); }

vec3 skyCol(vec3 rd) {
  float y = rd.y;
  float hor = exp(-max(y, 0.) * 5.);
  vec3 c = cA * .5 + mix(nB * .05, nC * .22, hor) + nD * .05 * exp(-abs(y) * 9.);
  return c;
}

// ---- facade windows -------------------------------------------------------------
// fuv = (along the face, height) in world units, bid = building hash, fp = pixel footprint.
// Three facade types: office ribbon glazing, punched residential grid with pilasters,
// dark glass curtain wall. Returns window emission; glassM = glass coverage, litM = lit coverage.
vec3 facade(vec2 fuv, vec3 bid, float fp, out float glassM, out float litM) {
  float ft = floor(bid.x * 2.999);
  float r1 = fract(bid.y * 3.1), r2 = fract(bid.z * 5.1), r3 = fract(bid.x * 7.7);
  float fh = mix(.42, .6, bid.y);
  float cw = ft < .5 ? mix(.3, .42, r1) : (ft < 1.5 ? mix(.34, .52, r1) : mix(.7, 1., r1));
  vec2 wsz = vec2(cw, fh);
  vec2 wp = fuv / wsz;
  vec2 wc = floor(wp), wf = fract(wp) - .5;
  vec2 fw = vec2(fp) / wsz;
  float lod = smoothstep(.22, .8, max(fw.x, fw.y));
  float wh = hash12(wc + bid.xy * 91.7);
  vec3 warm = warmCol(), cool = coolCol();
  vec2 ext; float litP, on, wb, solid = 0., mw, avW; vec3 wcol, avC;
  float calm = mix(.65, 1., gI);
  if (ft < .5) {            // office ribbons: continuous glazing per floor, lit in long runs
    ext = vec2(.5, mix(.27, .36, r2));
    float runL = floor(mix(4., 14., r3));
    float seg = hash12(vec2(wc.y, floor(wc.x / runL)) + bid.xy * 31.3);
    litP = mix(.25, .55, r2) * calm;
    on = step(1. - litP, seg);
    wb = .5 + .45 * fract(seg * 7.3);
    wcol = mix(cool, cB, step(.82, fract(seg * 11.1)));
    mw = .05; avW = .7; avC = cool;
  } else if (ft < 1.5) {    // punched grid: individual warm windows, pilasters every P columns
    ext = vec2(mix(.27, .4, r3), mix(.22, .34, r2));
    solid = step(mod(wc.x, floor(mix(4., 8., r2))), .5);
    litP = mix(.3, .6, r1) * calm;
    float runL = mix(2., 6., r3);
    float blk = hash12(vec2(wc.y, floor(wc.x / runL)) + bid.xy * 31.3);
    on = max(step(1. - litP, blk) * step(.15, wh), step(.96, wh));
    float w3 = fract(wh * 3.7);
    wb = .22 + 1.5 * w3 * w3 * w3;
    float wk = fract(wh * 7.3);
    wcol = wk < .75 ? warm : (wk < .9 ? cool : cB);
    mw = 0.; avW = .5; avC = warm;
  } else {                  // dark glass curtain wall: a few lit floors, thin mullion grid
    ext = vec2(.5, .5);
    litP = mix(.06, .2, r2) * calm;
    float fl = hash12(vec2(wc.y, floor(wc.x / 12.)) + bid.xy * 7.7);
    on = step(1. - litP, fl);
    wb = .3 + .3 * fract(fl * 9.1);
    wcol = mix(cool, cB, .4);
    mw = .025; avW = .45; avC = wcol;
  }
  // mechanical floors every M floors (no windows) break the regular grid
  solid = max(solid, step(mod(wc.y, floor(mix(10., 24., fract(bid.z * 13.7)))), .5) * step(ft, 1.5));
  float sxm = clamp((ext.x - abs(wf.x)) / fw.x + .5, 0., 1.);
  float sym = clamp((ext.y - abs(wf.y)) / fw.y + .5, 0., 1.);
  float open = sxm * sym * (1. - solid);
  float mull = mw > 0. ? lineAA(.5 - abs(wf.x), mw, fw.x) : 0.;
  // interior: brighter toward the ceiling; blinds / half-drawn curtains close up
  float vy = wf.y / ext.y * .5 + .5;
  float inner = .55 + .6 * vy;
  if (ft < .5) inner = (.45 + .35 * smoothstep(.2, .7, vy) + 1.2 * (1. - lod) * lineAA(abs(vy - .86), .035, fw.y / ext.y * .5)) * (1. - .45 * step(vy, .3) * (1. - lod));
  float bl = fract(wh * 13.3), det = (1. - lod) * (1. - smoothstep(.15, .4, fw.y * 7.));
  inner *= mix(1., .5 + .5 * step(.45, fract(vy * 7.)), step(.72, bl) * det);
  inner *= mix(1., smoothstep(-.15, .15, wf.x * sign(bl - .06)), step(bl, .12) * (1. - lod));
  // hat flicker subset
  wb *= fract(wh * 29.3) < .1 ? (.12 + 2.8 * aHat) : 1.;
  float area = 4. * ext.x * ext.y * (ft > .5 && ft < 1.5 ? .84 : .95);
  // far away: average radiance, modulated by lit/dark zones of whole floors so facades keep structure
  float zone = lod > 0. ? .45 + 1.1 * hash12(floor(wc / vec2(16., 3.)) + bid.yz * 13.1) : 1.;
  float win = mix(open * on * wb * inner * (1. - mull), litP * area * avW * .24 * zone, lod);
  glassM = mix(open * (1. - mull), area, lod);
  litM = mix(open * on, litP * area, lod);
  return mix(mix(wcol, avC, lod), vec3(1.), .1) * win;
}

// ---- skybridges spanning the avenue ---------------------------------------------
float bridgeBox(float kk, out vec3 b0, out vec3 b1, out vec3 bh) {   // returns presence
  bh = hash33(vec3(kk, 3.3, 1.9));
  float zb = kk * SPB + 3. + bh.y * 14.;
  float y0 = mix(17.5, 29., bh.z * bh.z) * gHS;
  b0 = vec3(-AV - .5, y0, zb);
  b1 = vec3(AV + .5, y0 + mix(1.3, 2.6, fract(bh.x * 7.1)), zb + mix(2., 4.2, fract(bh.y * 5.3)));
  return step(.15, bh.x);
}

// nearest skybridge hit along a ray: only the bridge slots whose z-range overlaps the part of
// the ray inside the bridge height band / avenue width are tested
void bridgeScan(vec3 ro, vec3 rd, vec3 ird, float zH, float tMax, inout float tBest, inout float kBest) {
  float ty0 = (17.5 * gHS - ro.y) * ird.y, ty1 = (31.6 * gHS - ro.y) * ird.y;
  float tx0 = (-AV - .5 - ro.x) * ird.x, tx1 = (AV + .5 - ro.x) * ird.x;
  float tA = max(max(min(ty0, ty1), min(tx0, tx1)), 0.);
  float tB = min(min(max(ty0, ty1), max(tx0, tx1)), tMax);
  if (tA >= tB || rd.z <= 0.) return;
  float kS = floor((ro.z + rd.z * tA - 21.2) / SPB), kE = floor((ro.z + rd.z * tB - 3.) / SPB);
  for (int k = 0; k < 6; k++) {
    float kk = kS + float(k);
    if (kk > kE) break;
    vec3 b0, b1, bh;
    float pr = bridgeBox(kk, b0, b1, bh);
    if (pr < .5 || abs(b0.z - zH) < 40. || abs(b0.z - zH + 300.) < 40.) continue;
    vec2 bi = iBox(ro, ird, b0, b1);
    if (bi.x < bi.y && bi.x > 0. && bi.x < tBest) { tBest = bi.x; kBest = kk; }
  }
}

// coloured light spilling from the blade signs onto the avenue wall at p (wall x = side*AV)
vec3 signSpill(vec3 p, float side) {
  vec3 s = vec3(0.);
  float k0 = floor(p.z / CZ), nb = fract(p.z / CZ) < .5 ? -1. : 1.;
  for (int j = 0; j < 2; j++) {
    float kk = k0 + float(j) * nb;
    vec3 sh = hash33(vec3(kk, side, 5.3));
    float zk = (kk + .3 + .4 * hash11(kk * 1.7)) * CZ;
    float y0 = mix(3., 32., sh.y) * gHS, len = mix(5., 14., sh.z);
    float dy = max(max(y0 - p.y, p.y - y0 - len), 0.);
    float dz = abs(p.z - zk);
    float flash = aSnare * step(.5, fract(sh.z * 7. + aBeatCount * .5));
    s += step(.35, sh.x) * neonCol(sh.y * 2.3 + sh.z) * (1. + 2. * flash) / (dz * dz * .6 + dy * dy * .5 + 1.2);
  }
  return s;
}

vec3 bridgeShade(vec3 p, vec3 n, vec3 b0, vec3 b1, vec3 bh, float fp) {
  vec3 nc = neonCol(bh.y * 2.7 + bh.z * 1.3);
  float kick = .5 + 2.6 * gKP * (1. - .5 * step(.5, bh.x * 3. - floor(bh.x * 3.)));
  vec3 col = cA * .1;
  float zz = p.z - b0.z, dz = b1.z - b0.z;
  float dB = p.y - b0.y, dT = b1.y - p.y, hgt = b1.y - b0.y;
  if (abs(n.z) > .5) {            // front / back: lit corridor window strip + neon edge tubes
    float wy = abs(dB - hgt * .55);
    float band = clamp((hgt * .17 - wy) / fp + .5, 0., 1.);
    float cell = floor(p.x / .9);
    float seg = hash11(cell + bh.x * 50.);
    float mull = lineAA((.5 - abs(fract(p.x / .9) - .5)) * .9, .04, fp);
    vec3 wc = mix(warmCol(), coolCol(), step(.55, bh.z));
    col += wc * band * (1. - mull) * step(.25, seg) * (.35 + .9 * seg) * (.7 + .6 * (dB / hgt));
    col += nc * (lineAA(dB, .06, fp) * 4. + lineAA(dT, .045, fp) * 2.5) * kick;
    col += nc * .22 * exp(-dB * 2.5) * kick;
  } else if (n.y < -.5) {         // underside: neon tubes across the avenue + chasing lights
    float d1 = min(abs(zz - dz * .22), abs(zz - dz * .78));
    float de = min(zz, dz - zz);
    col += nc * (lineAA(d1, .05, fp) * 3.5 + lineAA(de, .04, fp) * 2.) * kick;
    col += nc * .25 * (exp(-d1 * 4.) * .6) * kick;
    float rl = fract(p.x * .18 - iTime * 1.5 + bh.z * 7.);
    col += mix(nc, vec3(1.), .5) * 2. * lineAA(abs(zz - dz * .5), .07, fp) * smoothstep(.8, 1., rl);
  } else {                        // top / sides
    col += nc * 2. * lineAA(min(zz, dz - zz), .05, fp) * kick;
  }
  return col;
}

// ---- reflection of the avenue walls in the wet street (mirror-world estimate) -----
// sx = which wall, zm/ym = mirrored hit on the wall plane, bw = blur width (roughness)
vec3 wallRefl(float sx, float zm, float ym, float bw) {
  vec2 cell = vec2(sx, floor(zm / CZ));
  vec2 c, hs, hs2; float h, h2, pres;
  bldg(cell, c, hs, h, hs2, h2, pres);
  float dz = hs.y - abs(zm - c.y);
  if (pres < .5 || dz < -bw || ym > h + bw) return vec3(0.);
  vec3 bid = hash33(vec3(cell, 2.7));
  float inside = clamp(dz / bw + .5, 0., 1.) * clamp((h - ym) / bw + .5, 0., 1.);
  float ft = floor(bid.x * 2.999);
  vec3 wcol = ft < .5 ? coolCol() : (ft < 1.5 ? warmCol() : mix(coolCol(), cB, .4));
  // lit window columns smear into vertical streaks
  float colH = hash12(vec2(floor(zm / .45), cell.y + bid.x * 40.));
  float wins = (.05 + .3 * smoothstep(.6, .97, colH)) * (ft > 1.5 ? .4 : 1.) * smoothstep(.5, 4., ym);
  vec3 r = wcol * wins * inside * mix(.65, 1.1, gI);
  float isNeon = step(mix(.7, .5, gI), bid.z);
  vec3 ncol = neonCol(bid.z * 3.7);
  float de = abs(dz), dt = abs(h - ym);
  r += ncol * isNeon * (lineAA(de, .07, bw) * 3. + lineAA(dt, .07, bw) * 2. + .2 * (exp(-de * 2.) + exp(-dt * 2.)) * inside) * (1. + .8 * gKP);
  return r;
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
  float s = (zc - v * iTime) / 6.;      // car pattern travelling along z
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
  float on = step(.48, hash12(b * vec2(1.13, 7.31) + seed + g.y * 3.1 + g.x * 11.7));
  vec2 bf = fract(f * vec2(4., 5.)) - .5;
  float m = step(abs(bf.x), .38) * step(abs(bf.y), .38);
  float frame = step(.08, f.x) * step(f.x, .92) * step(.06, f.y) * step(f.y, .94);
  return on * m * frame;
}

// ---- giant hologram bust ("the one who isn't here") ---------------------------
float sdEll(vec2 p, vec2 r) { float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.) / max(k1, 1e-4); }
float holoSD(vec2 q, out float face) {
  float torso = max(sdEll(q - vec2(0., .4), vec2(.6, .36)), .1 - q.y);
  float neck = sdBox2(q - vec2(0., .84), vec2(.075, .14)) - .015;
  vec2 hq = rot(.13) * (q - vec2(0., .95)) - vec2(0., .27);      // melancholic head tilt
  vec2 jq = hq; jq.x *= 1. + .45 * smoothstep(.0, -.26, hq.y);    // narrower jaw
  float head = sdEll(jq, vec2(.19, .26));
  float hair = max(sdEll(hq - vec2(0., .045), vec2(.245, .3)), -(hq.y + .17));
  face = head;
  float d = smin(torso, neck, .06);
  d = smin(d, head, .025);
  return min(d, hair);
}
vec3 holo(vec2 q, float fpq, float gl, float near) {
  // glitch slices
  float sl = floor(q.y * 26.);
  float gt = floor(iTime * 20.);
  float gsh = hash11(sl * 1.7 + gt);
  q.x += step(.6, gsh) * (hash11(sl + gt * 3.1) - .5) * .25 * gl;
  float face;
  float d = holoSD(q, face);
  float fill = 1. - smoothstep(-fpq, fpq, d);
  float rim = lineAA(abs(d), .004, fpq);
  float halo = exp(-max(d, 0.) * 12.) * .06 + exp(-abs(d) * 45.) * .4;
  float scanF = q.y * 160. - iTime * 3.;
  float scan = mix(.5 + .5 * sin(scanF * 6.2832), .5, smoothstep(.15, .5, fpq * 160.));
  // closed eyes + lips as thin holo strokes (in tilted head space)
  vec2 hq = rot(.13) * (q - vec2(0., .95)) - vec2(0., .27);
  vec2 fq = vec2(abs(hq.x), hq.y);
  float eye = abs(length(fq - vec2(.08, .07)) - .055);
  eye = (fq.y < .055 && fq.x > .035 && fq.x < .13) ? eye : 1.;
  float lips = sdSeg2(fq, vec2(0., -.15), vec2(.045, -.14));
  float feat = (lineAA(eye, .005, fpq) + lineAA(lips, .006, fpq)) * step(face, 0.);
  float fadeB = smoothstep(.1, .5, q.y) * (.6 + .4 * smoothstep(.5, 1.3, q.y));
  vec3 cBody = gFlip > .5 ? cD : cB, cRim = gFlip > .5 ? cB : cC * 1.8;
  vec3 e = cBody * fill * (.02 + .17 * scan) * (1. - .65 * near) + cRim * (rim * 2. + halo * .45) + cD * feat * 3.;
  return e * fadeB;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - .5 * iResolution) / iResolution.y;
  float I = iIntensity;
  gI = I;
  nB = cB / max(max(cB.r, cB.g), max(cB.b, .01));
  nC = cC / max(max(cC.r, cC.g), max(cC.b, .01)) * .42;
  nD = cD / max(max(cD.r, cD.g), max(cD.b, .01));
  float mode = iParams.x;
  gHS = mix(1., 1.7, iParams.y);
  gMega = mix(.84, .93, iParams.x);
  gGap = mix(1., .55, iParams.y);
  gRain = mix(.3, 1., iParams.z);
  gPeak = smoothstep(.78, .95, I);
  float flipB = floor(aBarCount + .5);
  gFlip = gPeak * step(.5, hash11(flipB * 1.31 + iSeed * 17.));
  gGlitch = gPeak * (.35 + .65 * aSnare);
  gKP = aKick * smoothstep(.15, .7, I);

  // ---- camera: travel driven by the kick integral ----
  float spd = mix(.7, 1.6, iParams.w) * mix(.5, 1., I);
  float camZ = iTime * 13. * spd + aKickAcc * 36. * spd + iSeed * 900.;
  gCamZ = camZ;
  gStreak = .1 + .22 * smoothstep(.3, 1.3, spd);
  float sx = iSeed * 6.28;
  float lat = mix(2.4, 1.6, mode);
  #define PX(z) (lat * sin((z) * .021 + sx) + .7 * sin((z) * .047 + sx * 2.))
  float camX = PX(camZ);
  float camY = mix(12.5 + 3. * sin(camZ * .011 + sx), 70. * gHS + 8. * sin(camZ * .009 + sx), mode);
  vec3 ro = vec3(camX, camY, camZ);
  float la = mix(24., 40., mode);
  vec3 ta = vec3(PX(camZ + la), camY + mix(.6, -13., mode) + 1.5 * sin(camZ * .017), camZ + la);
  float dx = PX(camZ + 6.) - PX(camZ - 6.);
  float roll = -dx * .15 + .025 * sin(iTime * .7 + sx);
  float fl = mix(.78, .9, mode) - aKick * .05 * I;
  vec3 rd = camRay(ro, ta, uv, fl, roll);
  gPix = 1. / (iResolution.y * fl);
  rd += vec3(1e-5);
  vec3 ird = 1. / rd;

  // kick light-wave radius (expands from the camera after each kick)
  gKickWave = (1. - aKick) * 150.;
  float waveAmt = sqrt(aKick) * I;
  float gLight = aSnare * aSnare * smoothstep(.6, 1., I) * step(.5, fract(aBarCount * .5 + .25));

  // nearest giant hologram plane ahead (every 300 units)
  float zH = (floor((ro.z - 40.) / 300.) + 1.) * 300. + 40.;

  float tG = rd.y < 0. ? -ro.y / rd.y : 1e5;

  // ---- skybridges (and their mirror images under the wet street) ----
  float tBr = 1e5, kBr = 0.;
  bridgeScan(ro, rd, ird, zH, FAR, tBr, kBr);

  // ---- DDA through the building grid ----
  float tEnd = min(min(tG, FAR), tBr);
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
  // the avenue column (cell.x == 0) is empty: jump straight to where the ray leaves it
  if (cell.x == 0.) {
    tc = tM.x; cell.x += st.x; tM.x += tD.x;
    cell.y = floor((o.y + d.y * tc) / CZ);
    tM.y = ((cell.y + max(st.y, 0.)) * CZ - o.y) / d.y;
  }
  float maxTop = (125. + 13.) * gHS;
  float exhausted = 1.;
  for (int i = 0; i < 30; i++) {
    if (tc > tEnd || (rd.y > 0. && ro.y + rd.y * tc > maxTop)) { exhausted = 0.; break; }
    vec2 c, hs, hs2; float h, h2, pres;
    bldg(cell, c, hs, h, hs2, h2, pres);
    if (pres > .5) {
      vec3 b0 = vec3(c.x - hs.x, 0., c.y - hs.y), b1 = vec3(c.x + hs.x, h, c.y + hs.y);
      vec2 bi = iBox(ro, ird, b0, b1);
      if (bi.x < bi.y && bi.x > 0.) { tHit = bi.x; hb0 = b0; hb1 = b1; hitB = 1.; }
      float top = h;
      if (h2 > 0.) {
        vec3 c0 = vec3(c.x - hs2.x, h - .01, c.y - hs2.y), c1 = vec3(c.x + hs2.x, h2, c.y + hs2.y);
        vec2 bj = iBox(ro, ird, c0, c1);
        if (bj.x < bj.y && bj.x > 0. && bj.x < tHit) { tHit = bj.x; hb0 = c0; hb1 = c1; hitB = 2.; }
        top = h2;
      }
      // antenna + blinking aircraft light on the megatowers
      if (top > 66. * gHS) {
        float ah = top + 6. + 6. * fract(c.x * .37 + c.y * .11);
        vec3 w = vec3(c.x, 0., c.y) - ro;
        float ta2 = dot(w.xz, rd.xz) / dot(rd.xz, rd.xz);
        if (ta2 > 0. && ta2 < tHit + 1.) {
          float dist = length(rd.xz * ta2 - w.xz);
          float y = ro.y + rd.y * ta2;
          float dy = max(max(top - y, y - ah), 0.);
          glow += vec3(.5, .55, .7) * .04 * lineAA(sqrt(dist * dist + dy * dy), .05, ta2 * gPix) * exp(-ta2 * .01);
          vec3 tip = w + vec3(0., ah, 0.);
          float tt = dot(tip, rd);
          float dt2 = dot(tip - rd * tt, tip - rd * tt);
          float ph = fract(iTime * .5 + fract(c.y * .013));
          float blink = .25 + .75 * smoothstep(.0, .2, ph) * smoothstep(.45, .3, ph);
          float W = max(.25, tt * gPix);
          glow += vec3(1., .08, .05) * blink * ((.0625 / (W * W)) * exp(-dt2 / (W * W)) * 2.5 * exp(-tt * .006) + .015 / (dt2 + .3) * exp(-tt * .01));
        }
      }
    }
    if (hitB > 0.) { hCell = cell; exhausted = 0.; break; }
    if (tM.x < tM.y) { tc = tM.x; tM.x += tD.x; cell.x += st.x; }
    else { tc = tM.y; tM.y += tD.y; cell.y += st.y; }
  }
  if (exhausted > .5) tHit = min(tHit, max(tc, 120.));
  if (tBr < 1e4 && tBr <= tHit) { hitB = 3.; tHit = tBr; exhausted = 0.; }

  vec3 col = vec3(0.);
  vec3 p = ro + rd * tHit;
  float pulse = 1. + .5 * aKick * I;
  float gnd = 0., gRefl = 0., gRough = 1.;   // wet-street mirror reflection (avenue only)
  if (hitB > 2.5) {
    // ---- skybridge ----
    vec3 b0, b1, bh;
    float pr = bridgeBox(kBr, b0, b1, bh);
    col = skyCol(vec3(rd.x, -rd.y, rd.z)) * .08 + bridgeShade(p, boxN(p, b0, b1), b0, b1, bh, tHit * gPix * 1.5);
  } else if (hitB > 0.) {
    // ---- building facade ----
    vec3 n = boxN(p, hb0, hb1);
    vec3 cen = .5 * (hb0 + hb1), he = .5 * (hb1 - hb0);
    vec3 bid = hash33(vec3(hCell, 1.7 + hitB));
    float ndv = max(abs(dot(n, rd)), .12);
    float fp = tHit * gPix / ndv;
    vec3 ncol = neonCol(bid.z * 3.7);
    float isNeon = step(mix(.7, .5, I), bid.z);
    // peak: neon tubes stutter on the claps
    if (gGlitch > .55) isNeon *= step(hash13(vec3(hCell, floor(iTime * 15.))), .6);
    vec3 refl = skyCol(reflect(rd, n));
    float fres = (1. - ndv) * (1. - ndv) * (1. - ndv);
    if (abs(n.y) < .5) {
      vec2 fuv = abs(n.x) > .5 ? vec2(p.z, p.y) : vec2(p.x, p.y);
      float u0 = abs(n.x) > .5 ? hb0.z : hb0.x, u1 = abs(n.x) > .5 ? hb1.z : hb1.x;
      float glassM, litM;
      vec3 wE = facade(fuv, bid, fp, glassM, litM);
      // kick wave through the city
      float wave = waveAmt * exp(-abs(tHit - gKickWave) * .09) * 2.6;
      vec3 e = wE * (pulse + wave) * mix(.7, 1.1, I);
      // matte wall panels vs dark glass with smeared neon reflections; street uplight
      vec2 sw2 = abs(fract(vec2(fuv.x * .143 + bid.x * 6.4, p.y * .011 + bid.y * 3.2)) - .5) * 4. - 1.;   // cheap triangle waves
      float smear = .5 + .5 * sw2.x * sw2.y;
      float up = exp(-p.y * .08), up3 = up * up * up;
      vec3 wallC = cA * .22 + nC * .07 * up + nD * .03 * up3;
      vec3 glassC = cA * .05 + (refl * .45 + mix(cB, cD, smear) * .08 * smoothstep(.45, .9, smear)) * (.04 + .96 * fres) * mix(1., .45, mode)
                  + nC * .03 * up;
      col = mix(wallC, glassC, glassM) * (1. - min(litM * 1.5, 1.)) + e;
      // coloured light spill from the blade signs on the avenue walls
      if (abs(hCell.x) < 1.5 && abs(n.x) > .5 && abs(p.x) < AV + .05 && tHit < 70.)
        col += signSpill(p, sign(p.x)) * mix(.16, .05, glassM) * (1. - min(litM * 1.5, 1.)) * mix(.6, 1., I);
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
      float npulse = 1. + 1.1 * gKP;
      vec3 neon = ncol * (nl * isNeon * 4. + band * 3.) * npulse;
      neon += ncol * isNeon * .25 * (exp(-de * 2.5) + exp(-dt * 2.5)) * npulse;
      col += neon;
      col += (1. - isNeon) * cB * .15 * (lineAA(de, .05, fp) + lineAA(dt, .05, fp));
    } else {
      // roof
      vec2 r2 = p.xz - cen.xz;
      vec2 dd = he.xz - abs(r2);
      float de = min(dd.x, dd.y);
      col = cA * .18 + refl * .08;
      col += ncol * isNeon * 4. * lineAA(de, .07, fp) * (1. + gKP);
      col += cB * .2 * (1. - isNeon) * lineAA(de, .05, fp);
      // parapet glow + rooftop machinery (dim grid) + helipad ring on some tall roofs
      col += nC * .05 * exp(-de * 1.5);
      vec2 gq = abs(fract(r2 * .5) - .5);
      col += cC * .035 * step(.42, max(gq.x, gq.y)) * step(1., de);
      if (bid.x > .6 && hb1.y > 50. * gHS && min(he.x, he.z) > 2.) {
        float rr = abs(length(r2) - min(he.x, he.z) * .6);
        col += ncol * 2.2 * lineAA(rr, .06, fp) * (.7 + .6 * gKP);
      }
      // corner warning lights
      float cl = length(dd - .3);
      float bl = step(.5, fract(iTime * .9 + bid.x));
      col += vec3(1., .1, .05) * bl * 3. * lineAA(cl, .12, fp);
    }
  } else if (exhausted < .5 && tG < FAR && tHit >= tG - .01) {
    // ---- ground: wet asphalt + traffic in the side streets ----
    float fp = tHit * gPix / max(-rd.y, .05);
    vec3 refl = skyCol(reflect(rd, vec3(0., 1., 0.)));
    float g1 = (1. + rd.y) * (1. + rd.y); g1 *= g1;
    col = cA * .12 + refl * .3 * g1;
    // street-light pools
    col += cC * .04 * (.5 + .5 * sin(p.x * .7) * sin(p.z * .3 + p.x * .2));
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
      // ---- avenue: wet mirror asphalt (puddles), lane markings, traffic ----
      gnd = 1.;
      float pud = smoothstep(.3, .7, vnoise(p.xz * vec2(.4, .09) + 3.1));
      gRefl = mix(.3, .75, pud) * mix(.75, 1.1, gRain) * (.25 + .75 * g1 * (1. + rd.y));
      gRough = mix(.09, .025, pud) * mix(1.3, .7, gRain);
      col *= 1. - .5 * pud;
      // reflected avenue walls (mirror world beyond the ground plane)
      float sw = sign(rd.x);
      float tw = (sw * AV - ro.x) / rd.x;
      vec3 rc = vec3(0.);
      if (tw > tHit) {
        float ym = -(ro.y + rd.y * tw);
        float zm = ro.z + rd.z * tw;
        rc += wallRefl(sw, zm, ym, .06 + (tw - tHit) * gRough);
      }
      // reflected vanishing-point glow (the light at the end of the avenue)
      vec2 vr = vec2(rd.x * 7., (-rd.y - .02) * 2.2);
      rc += (nB * .55 + nD * .12) * exp(-dot(vr, vr)) * (1. + .7 * gKP) * mix(.7, 1., I);
      col += rc * gRefl;
      float fpx = tHit * gPix;
      float ax = abs(p.x);
      float lm = lineAA(abs(ax - 1.4), .04, fpx) * smoothstep(.5 - fp * .25, .5, abs(fract(p.z * .25) - .5) * 2.);
      col += vec3(.6, .65, .8) * lm * .12;
      float lp = ax < 2.9 ? 2.2 : 3.6;
      float dl = abs(ax - lp);
      float sd = sign(p.x);
      float v = sd > 0. ? (lp < 3. ? 24. : 17.) : (lp < 3. ? -12. : -7.);
      float sc = (p.z - v * iTime) / 5.;
      float fz = fp / 5.;
      float cf = fract(sc);
      float car = step(.45, hash11(floor(sc) + lp * 7. + sd * 3.)) * smoothstep(0., .06 + fz, cf) * smoothstep(.5 + fz, .3, cf);
      vec3 lc = sd > 0. ? cD * vec3(1., .5, .5) + vec3(.35, 0., 0.) : mix(vec3(1.), cC, .25);
      col += lc * car * (3. * lineAA(dl, .1, fpx) + .25 * exp(-dl * 2.5));
      // light trails smeared on the wet road behind/ahead of each car
      col += lc * car * .5 * pud * exp(-dl * 6.) * smoothstep(.0, .5, cf);
    }
  } else {
    // ---- sky ----
    col = skyCol(rd);
    float tc2 = (160. - ro.y) / max(rd.y, .02);
    vec2 cp = (ro.xz + rd.xz * tc2) * .008 + vec2(0., iTime * .01);
    float cl = .5 * vnoise(cp) + .3 * vnoise(cp * 2.3 + 5.1) + .2 * vnoise(cp * 5.1 + 1.7);
    // low smog underlit by the city
    col += (nD * .06 + nC * .16) * smoothstep(.35, .85, cl) * exp(-tc2 * .0018) + cB * .04 * smoothstep(.5, .9, cl) * exp(-tc2 * .003);
    col += vec3(.7, .75, 1.) * gLight * (.3 + 2.5 * smoothstep(.35, .9, cl));
    // forked bolt in the visible sky slot
    if (gLight > .01) {
      float bs = floor(aBeatCount * .5);
      vec2 an = vec2(atan(rd.x, rd.z), asin(rd.y));
      float a0 = (hash11(bs * 3.7) - .5) * .25;
      float jag = (vnoise(vec2(an.y * 22., bs)) - .5) * .09 + (vnoise(vec2(an.y * 70., bs + 4.)) - .5) * .025;
      float db = abs(an.x - a0 - jag - (an.y - .2) * .3 * (hash11(bs) - .5));
      float wb = gPix * 1.5;
      col += vec3(.75, .8, 1.) * gLight * (lineAA(db, wb * .8, wb) * 6. + .05 / (db * 40. + .1)) * smoothstep(.04, .14, an.y);
    }
  }

  // ---- fog (height falloff, teal low / violet high) ----
  float H = 18.;
  float yb = ro.y, ye = ro.y + rd.y * tHit;
  float od = mix(.006, .0036, mode) * tHit + .05 * H * (exp(-yb / H) - exp(-ye / H)) / (rd.y + sign(rd.y + 1e-6) * 1e-3);
  od *= mix(.8, 1.35, gRain);
  float T = exp(-max(od, 0.));
  vec3 fogC = mix(nC * .065, cA * .4 + nB * .02, smoothstep(4., 50., .5 * (yb + ye)));
  fogC += nD * .015;
  float far = smoothstep(40., 200., tHit);
  vec2 vq = vec2(rd.x * 5.5, (rd.y - .02) * 9.);
  float vg = exp(-dot(vq, vq));
  fogC += far * (nB * .42 * vg * (1. + .7 * gKP) * mix(1., .55, mode) + nD * .25 * vg * vg * vg * vg + nC * mix(.12, .06, mode) * exp(-vq.y * vq.y * 2.));
  fogC += vec3(.5, .55, .8) * gLight * .4 * (.3 + .7 * far) * smoothstep(5., 40., ye);
  col = col * T + fogC * (1. - T);

  // ---- giant hologram bust floating in the avenue (every 300 units, we fly through it) ----
  if (rd.z > 0.) {
    float tH = (zH - ro.z) / rd.z;
    float mir = step(tHit, tH) * gnd;           // seen in the wet street
    if (tH > 1. && (tH < tHit || mir > .5)) {
      vec3 hp = ro + rd * tH;
      float S = 9.5 * mix(1., 1.25, iParams.y);
      vec2 q = vec2(hp.x / S, (abs(hp.y) - 3.) / S);
      if (abs(q.x) < .8 && q.y > 0. && q.y < 1.7) {
        float fpq = tH * gPix / S / max(rd.z, .3) + mir * (tH - tHit) * gRough / S;
        float gl = gGlitch + aSnare * .6 + smoothstep(14., 2., tH);
        vec3 he = holo(q, fpq, gl, smoothstep(35., 8., tH));
        float flick = .85 + .15 * hash11(floor(iTime * 24.));
        float fadeD = smoothstep(280., 180., tH) * smoothstep(1.5, 10., tH);
        col += he * flick * fadeD * (1. + .6 * aKick * I) * exp(-tH * .004) * mix(.6, 1.2, I) * mix(1., gRefl * 1.3, mir);
      }
    }
  }

  // ---- emissive extras along the avenue ----
  // vertical blade signs sticking out of the avenue walls (planes z = const); mirrored in the street
  float sgS = sign(rd.x);
  float tsA = max((sgS * (AV - 1.65) - ro.x) * ird.x, .2);
  float tsB = min(min((sgS * (AV - .25) - ro.x) * ird.x, gnd > .5 ? tHit + 55. : tHit), 90. / max(rd.z, .01));
  if (rd.z > 0. && tsA < tsB) {
    float k0 = floor((ro.z + rd.z * tsA) / CZ - .7), kE = floor((ro.z + rd.z * tsB) / CZ - .3);
    for (int k = 0; k < 11; k++) {
      float kk = k0 + float(k);
      if (kk > kE) break;
      float zk = (kk + .3 + .4 * hash11(kk * 1.7)) * CZ;
      float tk = (zk - ro.z) / rd.z;
      if (tk < tsA || tk > tsB) continue;
      vec2 sp = ro.xy + rd.xy * tk;
      float ax = abs(sp.x);
      float x0 = AV - .25, x1 = AV - 1.65;
      if (ax > x0 || ax < x1) continue;
      float mir = step(tHit, tk);
      sp.y = abs(sp.y);
      float side = sign(sp.x);
      vec3 sh = hash33(vec3(kk, side, 5.3));
      float y0 = mix(3., 32., sh.y) * gHS, len = mix(5., 14., sh.z);
      if (sh.x < .35 || sp.y < y0 || sp.y > y0 + len) continue;
      vec2 su = vec2((x0 - ax) / (x0 - x1), (sp.y - y0) / 1.5);
      float fpS = tk * gPix / max(abs(rd.z), .2) / 1.4 + mir * (tk - tHit) * gRough;
      vec2 g = vec2(0., floor(su.y));
      float gl = glyph(g + kk * 3., vec2(su.x, fract(su.y)), sh.x * 50. + floor(iTime * .5 + sh.y * 4.));
      gl = mix(gl, .35, smoothstep(.15, .5, fpS * 4.));
      vec3 sc = neonCol(sh.y * 2.3 + sh.z);
      float fr = 1. - min(min(su.x, 1. - su.x) * 1.4, min(sp.y - y0, y0 + len - sp.y)) / max(fpS * 1.5, .06);
      float frame = clamp(fr, 0., 1.);
      float flash = aSnare * step(.5, fract(sh.z * 7. + aBeatCount * .5));
      vec3 e = sc * (gl * 2.2 + frame * 3. + .12) * (1. + flash * 3.);
      e *= .85 + .15 * sin(sp.y * 40. + iTime * 10.);           // holo scanlines
      col += e * exp(-tk * .009) * smoothstep(90., 72., zk - ro.z) * mix(1., gRefl, mir);
    }
  }

  // flat holo screens on the avenue walls (planes x = +-AV); mirrored in the street
  {
    float s = sign(rd.x);
    float tk = (s * (AV - .08) - ro.x) / rd.x;
    float mir = 0.;
    if (tk > .2 && tk < tHit + .5) {
      vec3 sp = ro + rd * tk;
      sp.y = abs(sp.y);
      float kz = floor(sp.z / CZ);
      vec3 sh = hash33(vec3(kz, s, 9.1));
      if (sh.x > .45) {
        float zc = (kz + .5) * CZ, hw = mix(2., 3.6, sh.y);
        float y0 = mix(4., 26., sh.z) * gHS, hh = hw * mix(.5, .9, sh.x);
        vec2 su = vec2((sp.z - zc) / hw, (sp.y - y0) / hh);
        if (abs(su.x) < 1. && su.y > 0. && su.y < 1.) {
          float fpS = tk * gPix / max(abs(rd.x), .1) + mir * (tk - tHit) * gRough * 3.;
          float typ = floor(sh.y * 3.);
          vec3 c1 = neonCol(sh.z * 3.1), c2 = neonCol(sh.z * 3.1 + .45);
          vec3 e;
          if (typ < 1.) {        // spectrum equalizer
            float bx = floor((su.x * .5 + .5) * 16.);
            float lv = spec(bx / 16. * .8 + .05);
            float bar = step(su.y, lv * 1.1) * step(.15, fract((su.x * .5 + .5) * 16.));
            e = mix(c1, c2, su.y) * bar * 2.5;
          } else if (typ < 2.) { // pulsing rings
            float r = length(su * vec2(hw / hh, 1.) - vec2(0., .5));
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
          // at grazing angles / distance fade to a dim average instead of a flat pastel slab
          float soft = smoothstep(.02, .12, fpS / hw);
          e = mix(e, mix(c1, c2, .5) * .35, soft);
          // bright frame
          vec2 fe = (1. - abs(vec2(su.x, su.y * 2. - 1.))) * vec2(hw, hh * .5);
          e += c1 * 2.5 * lineAA(min(fe.x, fe.y), .05, fpS);
          col += e * exp(-tk * .009) * mix(1., gRefl, mir);
        }
      }
    }
  }

  // flying traffic + avenue ground traffic (glowing streams along z)
  vec3 tail = cD * vec3(1., .6, .6) + vec3(.3, 0., 0.);
  vec3 head = mix(vec3(1.), cC, .3);
  float yLo = min(ro.y, ro.y + rd.y * tHit) - 1.5, yHi = max(ro.y, ro.y + rd.y * tHit) + 1.5;
  if (yLo < 7.5 && yHi > 7.5) glow += laneGlow(ro, rd, tHit, vec2(-1.2, 7.5), 9., .45, head, .05);
  if (yLo < 9.5 && yHi > 9.5) glow += laneGlow(ro, rd, tHit, vec2(1.4, 9.5), 0., .4, tail, .05);
  if (yLo < 20. && yHi > 20.) glow += laneGlow(ro, rd, tHit, vec2(-2.6, 20.), -14., .35, head, .06);
  if (yLo < 26. && yHi > 26.) glow += laneGlow(ro, rd, tHit, vec2(2.9, 26.), 30., .35, cB * 1.5, .06);
  // rooftop laser / searchlight beams sweeping the haze (rave in the sky)
  if (yHi > 38. * gHS) {
    float zb = floor(ro.z / 70.);
    for (int k = 0; k < 4; k++) {
      float kk = zb + float(k);
      float sd = mod(kk, 2.) < .5 ? -1. : 1.;
      vec3 bh = hash33(vec3(kk, sd, 2.7));
      vec3 P = vec3(sd * mix(14., 40., bh.x), mix(40., 70., bh.y) * gHS, kk * 70. + bh.z * 30.);
      float pz = P.z - ro.z;
      float fadeB = smoothstep(210., 150., pz) * smoothstep(-40., 0., pz);   // no popping as blocks recycle
      float beat = aBeatCount + aBeatPhase;
      float a = sin(beat * .25 * PI + bh.z * 6.28) * .9 - sd * .35;
      vec3 D = normalize(vec3(sin(a), 1.1 + .5 * bh.x, cos(a) * mix(-.6, .6, bh.y)));
      vec3 w0 = ro - P;
      float b = dot(rd, D), dd = dot(rd, w0), e = dot(D, w0);
      float den = max(1. - b * b, 1e-4);
      float tc = (b * e - dd) / den, sc = (e - b * dd) / den;
      if (tc > 0. && tc < tHit && sc > 0.) {
        float dist = length(w0 + rd * tc - D * sc);
        float wdt = .15 + sc * .012;
        float fpL = tc * gPix;
        float W = max(wdt, fpL);
        vec3 lc = sd < 0. ? cB : mix(cB, cC * 1.5, .5);
        float on = .25 + .75 * smoothstep(.3, .7, I);
        glow += lc * on * fadeB * (wdt / W) * (1.4 * exp(-dist * dist / (W * W)) + .05 / (1. + dist * dist * .5)) * exp(-sc * .006 - tc * .004) * (1. + aKick * I);
      }
    }
  }
  col += glow;

  // ---- rain: streaks on cylinders around the travel axis (radial hyperspeed rain) ----
  {
    float rl = length(rd.xy);
    float ang = atan(rd.y, rd.x);
    vec3 racc = vec3(0.);
    for (int L = 0; L < 3; L++) {
      if (L == 2 && gRain < .6) break;
      float R = 1.6 + float(L) * 1.9;
      float tr = R / max(rl, 1e-3);
      if (tr > tHit || tr > 60.) continue;
      float zr = ro.z + rd.z * tr;
      float a = ang * R;
      float cw = TAU * R / floor(TAU * R / .22);    // integer columns: no seam at the atan wrap
      float ca = floor(a / cw);
      float h1 = hash11(ca * 3.17 + float(L) * 19.3);
      float zz = zr * .12 + h1 * 7. + iTime * 1.5;
      float seg = fract(zz);
      float on = step(1. - (.1 + .3 * gRain), hash11(floor(zz) + ca * 1.3));
      float fpR = tr * gPix;
      float da = abs(fract(a / cw) - .5) * cw;
      float ln = lineAA(da, .004, fpR);
      float len = smoothstep(0., .05, seg) * smoothstep(gStreak, .05, seg);
      racc += mix(cC, cB, h1) * on * ln * len * exp(-tr * .03);
    }
    col += racc * (.5 + 1.2 * gRain) * (1. + aKick * I * .5);
  }

  fragColor = vec4(max(col, 0.), 1.);
}
