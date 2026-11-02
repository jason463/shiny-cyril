// =============================================================================
// KALEIDO — infinite psychedelic mandala tunnel
//
// iParams (all 0..1; 0,0,0,0 = 6 segments, light warp, short trails, liquid style):
//   x  base segment count: 0 -> 6 .. 1 -> 16 mirrored segments (each bar picks
//      base-2 / base / base+2 / base+4 around it, so the mandala re-folds on the downbeat)
//   y  domain-warp amount: 0 = gentle flowing liquid .. 1 = heavily warped, melting
//      ribbons and bent geometry
//   z  feedback trail strength: 0 = short afterglow .. 1 = long iPrev trails that
//      over-zoom outward like hyperspace streaks
//   w  style: 0 = organic liquid (rim-lit warped ripple ribbons dominate, geometry bends)
//             1 = hard geometric (stained-glass star-polygon shards, rings, log-spiral
//             lattice, nearly unwarped). Continuous blend; both layers always exist.
//
// Space: everything lives in kaleidoscope-folded LOG-POLAR coordinates
//   q = (folded angle, log r - travel). The map is conformal, so shapes stay crisp and
//   self-similar; scrolling "travel" in log r = an infinite dive into the centre.
//
// Audio: travel = f(time, aKickAcc) -> the dive surges on every kick, plus a zoom punch;
//   every kick fires a star-shaped shock ring from the core out of frame;
//   claps (beats 2/4) flip the accent layer (star polygons swap colour B<->D and rotate
//   half a segment) and invert the stained-glass shards for an instant;
//   hats sparkle glints on star vertices; spec() drives a radial equaliser corona around
//   the white-hot vanishing point; colours cycle through the section palette every bar.
// =============================================================================

float INT, SEG, NSEG, PER, EPER, WQ, FLIP, BAR;

// anti-aliased line, dist >= 0, half width hw, pixel footprint w (energy-preserving when thin)
float lineAA(float d, float hw, float w) {
  w = max(w, 1e-5);
  return (1. - smoothstep(hw - w, hw + w, d)) * min(1., hw / w);
}

float fbmS(vec2 p) {               // smooth 2-octave fbm for liquid shapes (~0..1)
  float s = 0., a = .55;
  for (int i = 0; i < 2; i++) { s += a * vnoise(p); p = rot(.7) * p * 1.93 + 11.7; a *= .45; }
  return s / .8;
}

vec3 cyc3(float t) {               // cycle through the bright palette entries B -> C -> D
  t = fract(t) * 3.;
  if (t < 1.) return mix(cB, cC, smoothstep(0., 1., t));
  if (t < 2.) return mix(cC, cD, smoothstep(0., 1., t - 1.));
  return mix(cD, cB, smoothstep(0., 1., t - 2.));
}

// {N/m} star polygon whose vertices sit on radius rv at folded angles j*SEG.
// phi = folded angle, rho = radius (band-normalised).
// returns x = distance to nearest chord (band units), y = shard id (which side of each chord)
vec2 starShard(float phi, float rho, float m, float rv) {
  float hm = m * SEG * .5;
  float c = rv * cos(hm);
  float th0 = mod(m, 2.) > .5 ? SEG * .5 : 0.;
  float best = 1e9, id = 0.;
  for (int i = -1; i <= 1; i++) {
    float th = th0 + float(i) * SEG;
    float da = phi - th;
    if (abs(da) <= hm) {
      float s = rho * cos(da) - c;
      best = min(best, abs(s));
      if (s < 0.) id += exp2(float(i + 1));
    }
  }
  return vec2(best, id);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  INT = clamp(iIntensity, 0., 1.);
  vec2 res = iResolution;
  float sd = iSeed * 37.13;
  float style = clamp(iParams.w, 0., 1.);
  float dir = iSeed > .5 ? 1. : -1.;

  // ---------------------------------------------------------------- camera
  float punch = 1. + .085 * aKick * (.35 + .65 * INT);
  vec2 p = (fragCoord - .5 * res) / res.y;
  p /= punch;
  float px = 1. / (res.y * punch);
  p -= .02 * vec2(sin(iTime * .21 + sd), cos(iTime * .17 + sd * 1.3)) * (.4 + .6 * INT);

  float r = max(length(p), 1e-5);
  float L = log(r);
  WQ = px / r;                                    // pixel footprint in log-polar units

  // ---------------------------------------------------------------- segments per bar
  BAR = floor(aBarCount + .001);
  float baseN = floor(mix(6., 16., clamp(iParams.x, 0., 1.)) + .5);
  float hb = hash11(BAR * 7.31 + floor(iSeed * 97.));
  NSEG = max(5., baseN + floor(hb * 4.) * 2. - 2.);
  SEG = TAU / NSEG;
  // claps on beats 2 & 4 toggle the accent layer (not in calm passages)
  FLIP = mod(floor(aBeatCount * .5 + .01), 2.) * step(.25, INT);

  // ---------------------------------------------------------------- travel (infinite dive)
  PER = .5;                                       // log-r period of one mandala level
  EPER = exp(PER);
  float trav = iTime * (.07 + .2 * INT) + aKickAcc * (.12 + .3 * INT) + iSeed * 5.;
  float rotA = iTime * (.03 + .05 * INT) * dir + sd;

  float a = atan(p.y, p.x) + rotA;
  float af = abs(mod(a, SEG) - .5 * SEG);        // folded angle 0..SEG/2
  vec2 q = vec2(af, L - trav);

  // depth fade: the far (central) part of the tunnel dissolves into darkness / core light
  float depth = smoothstep(-4.4, -1.4, L);
  float detail = smoothstep(.09, .025, WQ);       // kill structure that shrinks below a pixel

  // ---------------------------------------------------------------- shared liquid warp
  float warpAmt = .2 + .8 * clamp(iParams.y, 0., 1.);
  vec2 qs = q * vec2(2.8, 1.7);
  float tw = iTime * (.06 + .08 * INT);
  vec2 o = vec2(fbmS(qs + vec2(1.3, tw)), fbmS(qs * 1.1 + vec2(5.2 - tw, 2.7))) - .5;
  float fld = fbmS(qs * 1.25 + o * 2.2 * warpAmt + vec2(0., tw * .5));
  vec2 D = o * warpAmt * .3 * mix(1., .25, style);
  // counter-rotating levels: each ring band of the mandala spins against its neighbours
  float qWy = q.y + D.y;
  float lev = floor(qWy / PER);
  float lsgn = mod(lev, 2.) * 2. - 1.;
  float lrot = lsgn * (iTime * (.03 + .1 * INT) + aKickAcc * .05 * INT) + hash11(lev + 3.7) * SEG;
  float afl = abs(mod(a + lrot, SEG) - .5 * SEG);
  vec2 qW = vec2(afl + D.x, qWy);

  vec3 col = vec3(0.);

  // ---------------------------------------------------------------- organic ribbons
  float wOrg = 1. - .7 * style;
  {
    float fk = qW.y * 3.6 + (fld - .5) * warpAmt * 3.;
    float bi = floor(fk), bf = fract(fk);
    float gfk = max(fwidth(fk), 1e-5);
    float lit = step(.45, hash11(bi * 1.37 + floor(iSeed * 13.)));
    vec3 rc = cyc3(bi * .23 + BAR * .25 + iSeed);
    // crisp (AA'd) leading rim, light falling off across the ribbon into black
    float body = lit * smoothstep(0., 1.5 * gfk, bf) * (exp(-bf * 8.) * .6 + .05 * smoothstep(1., .3, bf));
    float cdq = min(bf, 1. - bf) * WQ / gfk;      // distance to band edge in log-polar units
    float fil = lineAA(cdq, .0035, WQ) * smoothstep(.5, .15, gfk) * (lit > .5 ? 1. : .25);
    col += wOrg * depth * (rc * body * (.3 + .5 * INT) + mix(rc, vec3(1.), .1) * fil * (.2 + .45 * INT));
  }

  // kick: shock front position (it also lights the geometry it sweeps through)
  float tk = -.14 * log(max(aKick, 1e-3));        // seconds since the kick
  float Lb = log(.09) + tk * 10.;
  float kfade = pow(clamp(1. - tk / .4, 0., 1.), 1.5) * step(.004, aKick);
  float kwave = kfade * exp(-abs(L - Lb) * 3.) * (.3 + .7 * INT);

  // ---------------------------------------------------------------- geometric mandala
  float wGeo = .3 + .7 * style;
  float u = qW.y / PER;
  float fu = fract(u);
  float rho = exp(fu * PER);                      // radius within the level band: 1..EPER
  float alt = mod(lev + FLIP, 2.);
  float phi = alt > .5 ? SEG * .5 - qW.x : qW.x;
  float m = clamp(floor(NSEG * .2 + .5), 2., ceil(NSEG * .5) - 1.);
  vec2 st = starShard(phi, rho, m, EPER);
  float stq = st.x / rho;                         // band units -> log-polar units
  float ringD = min(fu, 1. - fu) * PER;
  float edgeD = min(stq, ringD);
  vec3 levCol = cyc3(lev * .27 + BAR * .25 + iSeed * 2.);
  float geoB = .35 + .65 * INT;
  // some levels are "quiet" (rings + beads only) -> breathing room between the stars
  float full = step(.3, hash11(lev * 3.1 + floor(iSeed * 17.)));
  {
    // stained-glass shards: lit from their edges, every shard its own palette hue;
    // a clap inverts which shards are lit
    float hs = hash12(vec2(st.y + alt * 8. + lev * 17., BAR + floor(iSeed * 31.)));
    float sl = step(.45, hs);
    float inv = smoothstep(.05, .6, aSnare) * step(.25, INT);
    vec3 sc = cyc3(hs * .7 + lev * .27 + BAR * .25);
    float glow = exp(-edgeD / .03) * .8 + .05 + .08 * fld;
    col += wGeo * depth * detail * full * sl * (1. - inv) * sc * glow * (.18 + .3 * INT) * (1. + 2. * kwave);
    // clap: the dark shards light up solid in the accent colour (glass flash), lit ones go black
    vec3 ic = mix(cD, cB, FLIP);
    float iglow = exp(-edgeD / .04) * .9 + .12;
    col += depth * detail * full * (1. - sl) * inv * ic * iglow * (.5 + .9 * INT) * (.6 + .4 * wGeo);

    // neon line work
    float ring = lineAA(ringD, .009, WQ) * (1. + .5 * aKick + 3. * kwave);
    float ring2 = lineAA(abs(ringD - .045), .0025, WQ) * .5;
    // bead chain just inside each ring
    float bsp = SEG * .5 / max(1., floor(5. * 6. / NSEG + .5));
    vec2 bq = vec2((fract(qW.x / bsp + .5) - .5) * bsp, fu * PER - .085);
    float bead = lineAA(length(bq), .011, WQ) * step(.5, mod(lev, 2.));
    ring2 += bead * 1.2;
    float star = lineAA(stq, .0065, WQ) * full;
    vec3 accCol = mix(mix(cB, cD, FLIP), vec3(1.), .12);
    vec3 lines = levCol * (ring + ring2) + accCol * star * (.95 + 1.3 * aSnare + 2.5 * kwave);
    // log-spiral lattice (chevrons after mirroring) = the "spiral arms"
    float k2 = 1. + floor(hb * 2.);
    float scv = u * 2. + qW.x / (SEG * .5) * k2;
    float gs = length(vec2(k2 / (SEG * .5), 2. / PER));
    float spD = min(fract(scv), 1. - fract(scv)) / gs;
    lines += mix(levCol, cC, .5) * lineAA(spD, .003, WQ) * .7 * style;
    col += (.45 + .55 * wGeo) * depth * detail * lines * geoB;
  }

  // hat sparkles on star vertices (outer ring, fold axes)
  {
    float vx = alt > .5 ? SEG * .5 : 0.;
    vec2 dv = vec2(qW.x - vx, (1. - fu) * PER);
    float id = hash12(vec2(lev, BAR * 13. + floor(aBeatCount * 2.)));
    float sp = step(.4, id) * aHat * (.4 + .9 * INT);
    float dd = length(dv);
    float glint = .0001 / (dd * dd + .0001) + .3 * lineAA(abs(dv.x), .0015, WQ) * exp(-abs(dv.y) * 25.);
    col += depth * detail * mix(cD, vec3(1.), .5) * glint * sp * 1.6;
  }

  // ---------------------------------------------------------------- kick shock ring
  {
    float sh = .07 * (1. - cos(af / (SEG * .5) * PI));
    float db = abs(L - Lb - sh);
    float burst = lineAA(db, .008 + .012 * tk, WQ) * 2. + lineAA(abs(db - .07 - .06 * tk), .003, WQ) * .8 + .25 * exp(-db * 18.);
    col += mix(cD, vec3(1.), .25) * burst * kfade * (.8 + 2. * INT) * smoothstep(-4., -2.5, L);
  }

  // ---------------------------------------------------------------- spectrum corona
  {
    float R0 = log(.09);
    float nb = max(2., floor(40. / NSEG));
    float v = af / (SEG * .5);
    float x = (floor(v * nb) + .5) / nb;
    float sv = spec(x * .8 + .05);
    float h = (.06 + .9 * sv * sv) * (.45 + .55 * INT);
    float bw = SEG * .5 / nb;
    float cx = (fract(v * nb) - .5) * bw;
    float bd = sdBox2(vec2(cx, L - (R0 + h * .5)), vec2(bw * .22, h * .5));
    float bar = 1. - smoothstep(-WQ, WQ, bd);
    float along = clamp((L - R0) / max(h, .01), 0., 1.);
    vec3 bc = mix(cB, mix(cD, vec3(1.), .3), along * along);
    col *= smoothstep(R0 - 1.4, R0 + .1, L);      // dark collar so the core reads cleanly
    col += bc * bar * (.35 + .5 * INT) * (.5 + 1.5 * along * along) * (.6 + .8 * sv);
  }

  // exposure-normalise bright palettes (acid / ember) so every section keeps its darks
  float palLum = dot(cB + cC + cD, vec3(.299, .587, .114)) / 3.;
  col *= clamp(.36 / max(palLum, .05), .5, 1.4);

  // ---------------------------------------------------------------- core light
  float core = .00035 / (r * r + .00035);
  col += mix(cD, vec3(1.), .55) * core * (1.2 + 1.2 * aKick + INT);
  col += cB * .012 / (r + .012) * (.15 + .25 * aBass);

  // ---------------------------------------------------------------- feedback trails
  // iPrev is re-sampled with the zoom/rotation the mandala moved this frame
  // (z adds over-zoom -> trails shoot outward like hyperspace streaks)
  {
    float zt = clamp(iParams.z, 0., 1.);
    vec2 asp = vec2(res.x / res.y, 1.);
    vec2 pc = (fragCoord / res - .5) * asp;
    float dTrav = ((.07 + .2 * INT) + aKick * (.12 + .3 * INT)) / 30.;
    float zr = 1. - exp(-dTrav * (1. + .6 * zt) - .0015 * zt);
    pc = rot(-(.03 + .05 * INT) * dir / 30.) * pc * (1. - zr);
    vec3 prev = texture(iPrev, pc / asp + .5).rgb;
    prev *= (.25 + .52 * zt) * mix(vec3(1.), normalize(cC + .05) * 1.5, .2);
    col = max(col, prev);
  }

  fragColor = vec4(col, 1.);
}
