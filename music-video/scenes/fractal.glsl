// ============================================================================
// fractal — flythrough of an endless glowing fractal cathedral / megastructure
// ----------------------------------------------------------------------------
// A recursive (KIFS-style) architecture: every level is a scaled, folded copy of
// the level above (nave arches -> wall arcades -> tracery), traced with neon
// filaments, a polished reflecting floor, a blinding light at the vanishing
// point, diagonal light shafts from the clerestory and depth fog to black.
//
// iParams (all 0..1, 0,0,0,0 = good default):
//   x : architecture   < .33 gothic KIFS cathedral (pointed arches, ribbed vault, arcade + tracery)
//                      .33-.67 brutalist halls (rounded-box portals, 2x2 recursive sub-portal facades)
//                      > .67 ring caverns (tunnel of rings with 8-fold recursive ring necklaces, no floor)
//   y : camera path    0 = centred glide down the nave axis (symmetric vanishing point)
//                      ~.5 = weaving lateral path with banking into the turns
//                      1 = low worm's-eye looking up into the vault + slow roll (also weaves)
//   z : morph speed    how fast the bass-driven morph runs (arch height / pointedness, portal
//                      roundness, ring radius, tracery twist): 0 = slow breathing, 1 = fast
//   w : glow amount    0 = normal filament glow, 1 = ~1.9x glow + stronger light shafts
// Audio: aKickAcc = travel surges, aKick = filament pump, aSnare (claps) = magenta (cD) shockwave
// ring sweeping down the nave, aBassAcc = architecture morph, aHat = light-shaft shimmer.
// iSeed offsets the travel position, the camera path and the morph phase.
// ============================================================================

int   gVar;
float gMorph;
vec4  gTrap;
float gLine;     // distance to emissive filaments
float gLvl;      // which IFS level the nearest filament belongs to
mat2  gR1;
float gAmp, gSOff;
vec3  gB, gC, gD;   // luminance-normalised section palette (keeps exposure stable across palettes)
vec3 lumNorm(vec3 c, float L) { return c * (L / max(dot(c, vec3(.2126, .7152, .0722)), .04)); }

// smooth seeded nave path (lateral offset as a function of z)
vec2 camPath(float z) {
  return vec2(sin(z * .085 + gSOff) * .55 + sin(z * .031 + gSOff * 1.7) * .45,
              sin(z * .061 + gSOff * 2.3)) * gAmp;
}

// ---- shared IFS-architecture helpers ----------------------------------------
// GW nave half-width, GB bay length, GF floor depth below the eye axis
const float GW = 2.4, GB = 2.4, GF = .9;
const float BH = 5.4;                // variant 1 portal height
const float RK = .36;                // variant 2 child ring scale
float gGH, gGC, gGR;                 // variant 0 arch springing height / centre offset / radius (bass-morphed)
float gBRC;                          // variant 1 portal corner radius (bass-morphed)
float gRR;                           // variant 2 ring radius (bass-morphed)
float gBound;
bool gKids = true;

float ribSD(float a, float qz, float th, float dz) {
  vec2 e = vec2(a - th, abs(qz) - dz);
  return length(max(e, 0.)) + min(max(e.x, e.y), 0.);
}

// variant 0 element: pointed gothic arch on two piers (+ diagonal vault ribs at level 0)
float elArch(vec3 q, float lvl) {
  float ax = abs(q.x);
  float a = q.y > gGH ? abs(length(vec2(ax + gGC, q.y - gGH)) - gGR) : abs(ax - GW);
  float rib = ribSD(a, q.z, q.y > gGH ? .15 : .22, .2);
  gLine = length(vec2(a, abs(q.z) - .23));
  if (lvl < .5 && q.y > gGH - .4) {
    float zb = GB * .5 - abs(q.z);
    const float L = 2.683;
    float u = (ax * GW + zb * GB * .5) / L, v = (ax * GB * .5 - zb * GW) / L;
    float ad = abs(length(vec2(u * GW / L + gGC, max(q.y, gGH) - gGH)) - gGR) + max(gGH - q.y, 0.);
    vec2 e2 = vec2(ad - .11, abs(v) - .13);
    rib = min(rib, length(max(e2, 0.)) + min(max(e2.x, e2.y), 0.));
    gLine = min(gLine, length(vec2(ad + .13, v)));
  }
  return max(rib, -q.y);
}

// variant 1 element: brutalist rounded-box portal (centred), + longitudinal light rails at level 0
float elBox(vec3 q, float lvl) {
  vec2 b = abs(q.xy) - vec2(GW, BH * .5) + gBRC;
  float a = abs(length(max(b, 0.)) + min(max(b.x, b.y), 0.) - gBRC);
  float rib = ribSD(a, q.z, .19, .21);
  gLine = length(vec2(a, abs(q.z) - .24));
  if (lvl < .5) {
    float lb = length(vec2(abs(q.x) - (GW - .75), q.y - (BH * .5 - .45)));
    rib = min(rib, lb - .07);
    gLine = min(gLine, max(lb - .07, 0.) + .01);
  }
  return rib;
}

// variant 2 element: full ring portal
float elRing(vec3 q) {
  float a = abs(length(q.xy) - gRR);
  gLine = length(vec2(a, abs(q.z) - .2));
  return ribSD(a, q.z, .14, .17);
}

float deNave(vec3 p) {
  vec3 q = p;
  q.z = mod(q.z + GB * .5, GB) - GB * .5;
  float d, lm, lv = 0.;
  gTrap = vec4(0.);
  if (gVar == 2) {
    // ring tunnel; finer rings form 8-fold necklaces in the mid-bay planes
    d = elRing(q);
    lm = gLine;
    float bd = max(abs(length(q.xy) - gRR) - gBound, GB * .5 - abs(q.z) - .11);
    if (gKids && bd < max(d, lm)) {
      float s = 1.;
      q.z = abs(q.z) - GB * .5;
      for (int i = 1; i < 3; i++) {
        q.xy = abs(q.xy);
        if (q.x < q.y) q.xy = q.yx;
        q.xy -= vec2(.9239, .3827) * gRR;
        q.xy *= gR1;
        q /= RK; s /= RK;
        float fi = float(i);
        float e = elRing(q) / s;
        float l = gLine / s;
        if (l < lm) { lm = l; lv = fi; }
        if (e < d) { d = e; gTrap.x = fi; }
      }
    }
    gLine = lm; gLvl = lv;
    return d;
  }
  q.x = mod(q.x + GW * 2., GW * 4.) - GW * 2.;
  if (gVar == 0) { q.y += GF; d = elArch(q, 0.); }
  else { q.y += GF - BH * .5; d = elBox(q, 0.); }
  lm = gLine;
  // all finer IFS levels (arcades + tracery) lie in a thin slab around the wall plane |x| = GW
  float bd = abs(abs(q.x) - GW) - gBound;
  if (gKids && bd < max(d, lm)) {
    q.x = abs(q.x) - GW;
    q.z = abs(q.z) - GB * .5;
    q.xz = vec2(q.z, -q.x);
    float s = 1.;
    for (int i = 1; i < 3; i++) {
      q.xy *= gR1;
      q *= 2.; s *= 2.;
      float fi = float(i);
      float e = (gVar == 0 ? elArch(q, fi) : elBox(q, fi)) / s;
      float l = gLine / s;
      if (l < lm) { lm = l; lv = fi; }
      if (e < d) { d = e; gTrap.x = fi; }
      q.x = abs(q.x) - GW * .5;
      if (gVar == 1) q.y = abs(q.y) - BH * .25;
    }
  }
  gLine = lm; gLvl = lv;
  return d;
}

float map(vec3 p) { return deNave(p); }

vec3 calcNormal(vec3 p, float e, float d0) {
  return normalize(vec3(map(p + vec3(e, 0., 0.)), map(p + vec3(0., e, 0.)), map(p + vec3(0., 0., e))) - d0);
}

vec3 lvlCol(float lvl) {
  return lvl < .5 ? gB : (lvl < 1.5 ? mix(gB, gC, .6) : (lvl < 2.5 ? gD * .6 : mix(gD, gC, .5) * .15));
}
vec3 glowMix(vec4 g) { return g.x * lvlCol(0.) + g.y * lvlCol(1.) + g.z * lvlCol(2.) + g.w * lvlCol(3.); }
float gPix;   // pixel footprint per unit distance (for distance-adaptive line width = no sparkle)
// filament glow kernel: core width never thinner than ~1.5 px, energy kept constant
float lineW(float l, float t) { float e = max(.0084, t * gPix); return .00016 * (.0084 / e) / (l * l + e * e); }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - .5 * iResolution) / iResolution.y;
  gVar = iParams.x < .33 ? 0 : (iParams.x < .67 ? 1 : 2);
  float I = iIntensity;
  gB = lumNorm(cB, .4); gC = lumNorm(cC, .33); gD = lumNorm(cD, .33);
  gMorph = aBassAcc * mix(.15, .9, iParams.z) + iSeed * 20.;
  gR1 = rot(.12 * sin(gMorph * .7));
  gGH = 3. + .35 * sin(gMorph * .41);
  gGC = 1.4 + .45 * sin(gMorph * .29 + 2.);
  gGR = GW + gGC;
  gBRC = .9 + .55 * sin(gMorph * .37);
  gRR = 2.75 + .22 * sin(gMorph * .33);
  gBound = gVar == 2 ? gRR * RK * 1.52 + .25 : .2;
  float cy = iParams.y;
  float weave = smoothstep(.2, .6, cy), low = smoothstep(.65, 1., cy);
  gAmp = mix(.12, gVar == 2 ? .8 : 1.35, weave);
  gSOff = iSeed * 37.;
  bool hasFloor = gVar != 2;

  // ---- camera --------------------------------------------------------------
  float spd = mix(.45, 1., I);
  float travel = iTime * .9 * spd + aKickAcc * 4. * spd + iSeed * 300.;
  vec2 cp = camPath(travel);
  vec3 ro = vec3(cp.x, cp.y * .35, travel);
  vec3 ta = vec3(camPath(travel + 6.).x * .5, 0., travel + 6.);
  float eye = hasFloor ? mix(.25, -GF + .45, low) : mix(0., -1.5, low);
  eye += .06 * sin(iTime * .5 + iSeed * 9.);
  ro.y += eye;
  ta.y += eye + (hasFloor ? mix(.45, 2.6, low) : mix(.1, 1.8, low));
  float bank = (camPath(travel + 3.).x - cp.x) * .5 * weave;
  float roll = bank + low * .45 * sin(iTime * .21 + iSeed * 6.);
  float fl = mix(1.05, .85, low);
  gPix = 1.5 / (iResolution.y * fl);
  vec3 rd = camRay(ro, ta, uv, fl, roll);

  // far light at the vanishing point (focal point)
  vec3 lp = vec3(0., gVar == 0 ? 2.4 : (gVar == 1 ? 1.8 : 0.), travel + 34.);
  vec3 lcol = mix(gC, vec3(1.), .35);

  // clap shockwave front sweeping down the nave; kick pump of the filaments
  float ringAmp = smoothstep(.02, .3, aSnare) * mix(.4, 1., I);
  float zf = ro.z + 3. + aBeatPhase * 30.;
  float kickB = mix(.35, .7, I) + aKick * mix(.8, 2.6, I);

  // analytic floor / ceiling exits
  float yTop = gVar == 0 ? gGH + sqrt(gGR * gGR - gGC * gGC) - GF + .2 : (gVar == 1 ? BH - GF + .35 : gRR * (1. + RK * 1.52) + .3);
  float yBot = hasFloor ? -GF : -yTop;
  float tFloor = rd.y < -1e-4 ? (yBot - ro.y) / rd.y : 1e5;
  float tCeil = rd.y > 1e-4 ? (yTop - ro.y) / rd.y : 1e5;
  float tMax = min(26., min(tFloor, tCeil));

  // ---- march with glow accumulation ------------------------------------------
  float t = .05, d = 0.;
  vec4 gl4 = vec4(0.);
  float ringGl = 0.;
  bool hit = false;
  float stp = 0.;
  float omega = 1.5, prevR = 0., sLen = 0.;
  for (int i = 0; i < 32; i++) {
    vec3 p = ro + rd * t;
    d = map(p);
    float dz = p.z - zf;
    float w = d * .9 * lineW(gLine, t) / (1. + t * .07);
    gl4 += vec4(equal(vec4(gLvl), vec4(0., 1., 2., 3.))) * w;
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
    if (t > tMax) break;
  }
  float hLine = gLine, hLvl = gLvl;
  bool escaped = !hit && t > tMax;
  bool floorHit = escaped && hasFloor && tFloor <= tMax;
  if (escaped) t = tMax;

  vec3 col = vec3(0.);
  vec3 pf = ro + rd * t;
  if (hit) {
    vec3 p = pf;
    // view-facing shading (no normal taps): form comes from the filaments' spill light,
    // a dim lantern near the camera and step-count occlusion
    float ao = clamp(1. - stp / 32., 0., 1.);
    ao = .35 + .65 * ao * ao;
    vec3 alb = cA * 1.2 + .01 + gC * .07;
    col = alb * gC * 1.6 / (1. + t * t * .08);
    col += alb * lcol * 2.5 * pow(max(dot(rd, normalize(lp - ro)), 0.), 6.);
    col *= ao;
    float l2 = hLine * hLine;
    vec3 lc = lvlCol(hLvl) * kickB;
    float lw = max(.012, t * gPix * 1.2);
    col += lc * (3.3 * .012 / lw) * lw * lw / (l2 + lw * lw);
    col += alb * lc * 2. / (1. + l2 * 500.);
    col += gD * ringAmp * exp(-abs(p.z - zf) * 4.) * 2.5;
  }
  if (floorHit) {
    // polished stone floor with inlaid light lines + short reflection march
    vec3 p = pf;
    float qx = p.x;
    float fw = t / (iResolution.y * fl * max(-rd.y, .02)) * 1.5;
    float lz = abs(mod(p.z + GB * .5, GB) - GB * .5);
    float lx = abs(abs(qx) - GW);
    float inlay = (1. - smoothstep(0., .03 + fw, lz)) * step(abs(qx), GW) + (1. - smoothstep(0., .03 + fw, lx));
    col = cA * .1 + lvlCol(0.) * inlay * kickB * .35 / (1. + .5 * fw * fw * 400.);
    col += gD * ringAmp * exp(-abs(p.z - zf) * 4.) * 1.5;
    vec3 rr = reflect(rd, normalize(vec3((vnoise(p.xz * 3.) - .5) * .04, 1., (vnoise(p.zx * 3. + 7.) - .5) * .04)));
    float tr = .02;
    vec4 rg = vec4(0.);
    gKids = false;
    for (int i = 0; i < 7; i++) {
      vec3 q = p + rr * tr;
      float dd = map(q);
      rg += vec4(equal(vec4(gLvl), vec4(0., 1., 2., 3.))) * (max(dd, .04) * lineW(gLine, t + tr) / (1. + (t + tr) * .07));
      if (dd < .01) break;
      tr += max(dd * 1.2, .04);
      if (tr > 14. || q.y > yTop) break;
    }
    float fres = .45 + .55 * pow(1. + rd.y, 5.);
    col += glowMix(rg) * kickB * fres * 1.6;
    vec3 lv = rr - normalize(lp - p);
    col += lcol * min(fres, .7) / (1. + lv.x * lv.x * 900. + lv.y * lv.y * 70.);
  }
  // depth fog to black + forward in-scatter toward the far light
  vec3 ldir = normalize(lp - ro);
  float mu = max(dot(rd, ldir), 0.);
  float fogK = gVar == 2 ? .11 : .085;
  float fogT = 1. - exp(-t * fogK);
  col *= exp(-t * fogK);
  float phase = .007 + .09 * pow(mu, 16.) + 1.1 * pow(mu, 260.);
  col += mix(gC, gB, .4) * phase * fogT * mix(.6, 1.2, I);
  if (escaped && !floorHit) col += lcol * pow(mu, 900.) * 3.5;
  // diagonal light shafts falling from the clerestory windows, one per bay
  // (analytic ray-to-beam glow, cut off by the hit distance -> occluded by the architecture)
  vec3 Lb = normalize(vec3(-.6, -1., .22));
  float bayZ = floor(ro.z / GB) * GB + GB * .5;
  float shaft = 0.;
  float wy = gVar == 2 ? 4.2 : 4.6;
  float bLen = (wy + GF) / -Lb.y;
  for (int k = 0; k < 6; k++) {
    vec3 a = vec3(gVar == 1 ? 2.1 : 2.6, wy, bayZ + float(k) * GB);
    vec3 w0 = ro - a;
    float b = dot(rd, Lb), dd = dot(rd, w0), e = dot(Lb, w0);
    float den = max(1. - b * b, 1e-3);
    float sr = (b * e - dd) / den, ul = (e - b * dd) / den;
    vec3 dv = w0 + rd * sr - Lb * ul;
    // soft visibility: in front of the hit, along the beam's length, and faded near the camera
    float vis = smoothstep(0., 1.5, sr) * smoothstep(t + .3, t - .3, sr) * smoothstep(0., .8, ul) * smoothstep(bLen, bLen - 1.5, ul)
              * smoothstep(1., 4., a.z - ro.z);
    shaft += vis * .02 / (dot(dv, dv) + .02) * exp(-sr * fogK);
  }
  col += mix(gC, lcol, .5) * shaft * .45 * (.5 + 1.5 * aHat) * mix(.3, 1., I) * (1. + iParams.w);
  vec3 glow = glowMix(gl4) * kickB + gD * ringGl * ringAmp * 5.;
  col += glow * mix(1., 1.9, iParams.w);
  fragColor = vec4(col, 1.);
}
