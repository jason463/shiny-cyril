// =============================================================================
// KALEIDO — infinite backlit stained-glass mandala tunnel
//
// iParams (all 0..1; 0,0,0,0 = 6 segments, light warp, short trails, liquid style):
//   x  base segment count: 0 -> 6 .. 1 -> 16 mirrored segments (each bar picks
//      base-2 / base / base+2 / base+4 around it, so the mandala re-folds on the downbeat)
//   y  domain-warp amount: 0 = gentle flowing liquid .. 1 = heavily warped, melting
//      glass and bent geometry (stronger the lower w is)
//   z  feedback trail strength: 0 = short afterglow .. 1 = long iPrev trails that
//      over-zoom outward like hyperspace streaks
//   w  style: 0 = organic liquid (warped glass, marbled contour filaments, soft shards)
//             1 = hard geometric (straight star-polygon shards, engraved double lines,
//             log-spiral lattice, bead chains). Continuous blend; the skeleton always exists.
//
// Look: a stained-glass mandala tunnel BACKLIT by a white-hot light at the vanishing
//   point. Lit glass shards transmit the core light (bright deep inside, dim near the
//   camera), dark shards are opaque silhouettes, neon leading outlines the stars, rings
//   and beads. Laser fans (palette key colour B) radiate from the core through fog.
//
// Space: everything lives in kaleidoscope-folded LOG-POLAR coordinates
//   q = (folded angle, log r - travel). The map is conformal, so shapes stay crisp and
//   self-similar; scrolling "travel" in log r = an infinite dive into the centre.
//
// Audio: travel = f(time, aKickAcc) -> the dive surges on every kick, plus a zoom punch;
//   every kick fires a star-shaped shock ring from the core out of frame that flares
//   the glass and leading it passes; the core light swells with bass + kick.
//   Downbeat (bar index aligned to the real "one"): the mandala re-folds (segment count,
//   shard pattern, colours) and, at intensity > ~0.6, LURCHES one full level deeper in
//   ~0.3 s (with trails this reads as a hyperspace jump).
//   Claps (beats 2/4): lit and dark shards swap for ~3 frames (graphic inversion) and the
//   accent star outlines flip colour B<->D and orientation for the rest of the beat pair.
//   Hats: glints on star vertices. spec(): EQ ticks hanging from the rings of the quiet
//   levels + a fine iris corona around the vanishing point. Laser fans sweep on most bars
//   (intensity >= 0.4), flaring on kicks. Colours cycle through B -> C -> D every bar.
// =============================================================================

float INT, SEG, NSEG, PER, EPER, WQ;

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
  float wy = clamp(iParams.y, 0., 1.);
  float zt = clamp(iParams.z, 0., 1.);
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
  PER = .5;                                       // log-r period of one mandala level
  EPER = exp(PER);
  // bar index that steps exactly on the detected downbeat (aBarCount steps one beat late
  // in this song), so the re-fold / colour cycle / lurch all land on the "one"
  float BAR = floor((iTime - 8.07) / 1.96 - aBarPhase + .5);
  float baseN = floor(mix(6., 16., clamp(iParams.x, 0., 1.)) + .5);
  float hb = hash11(BAR * 7.31 + floor(iSeed * 97.));
  NSEG = max(5., baseN + floor(hb * 4.) * 2. - 2.);
  SEG = TAU / NSEG;
  // claps on beats 2 & 4: accent layer flips (persistent), glass inverts (while the hit is hot)
  float clapOK = step(.25, INT);
  float FLIP = mod(floor(aBeatCount * .5 + .01), 2.) * clapOK;
  float INV = step(.5, aSnare) * clapOK;

  // ---------------------------------------------------------------- travel (infinite dive)
  float vT = .06 + .3 * INT, vK = .14 + .52 * INT;    // cruise speed / kick surge (log-r per s)
  // downbeat lurch (high intensity): the tunnel dives one full level in ~0.3 s as it re-folds.
  // Counted from the shot's first bar so a slowly ramping intensity never jumps the travel.
  float lg = smoothstep(.55, .9, INT);
  float bar0 = floor((iTime - iLocal - 8.07) / 1.96) - 1.;   // constant per shot
  float lx = clamp(aBarPhase * 6., 0., 1.);
  float lurch = lg * PER * (BAR - bar0 + 1. - pow(1. - lx, 3.));
  float lurchV = lg * PER * 3. * (1. - lx) * (1. - lx) * 6. / 1.96 * step(lx, .999);
  float trav = iTime * vT + aKickAcc * vK + iSeed * 5. + lurch;
  float rotA = iTime * (.03 + .05 * INT) * dir + sd;

  float a = atan(p.y, p.x) + rotA;
  float af = abs(mod(a, SEG) - .5 * SEG);        // folded angle 0..SEG/2
  vec2 q = vec2(af, L - trav);

  float detail = smoothstep(.1, .03, WQ);         // fade structure that shrinks below a pixel
  float outer = smoothstep(.15, .9, r);           // near-camera zone

  // ---------------------------------------------------------------- shared liquid warp
  float warpAmt = .2 + .8 * wy;
  vec2 qs = q * vec2(2.8, 1.7);
  float tw = iTime * (.06 + .08 * INT);
  vec2 o = vec2(fbmS(qs + vec2(1.3, tw)), fbmS(qs * 1.1 + vec2(5.2 - tw, 2.7))) - .5;
  float fld = fbmS(qs * 1.25 + o * 2.2 * warpAmt + vec2(0., tw * .5));
  vec2 D = o * warpAmt * mix(.42, .05, style);
  // counter-rotating levels: each ring band of the mandala spins against its neighbours
  float qWy = q.y + D.y;
  float lev = floor(qWy / PER);
  float lsgn = mod(lev, 2.) * 2. - 1.;
  float lrot = lsgn * (iTime * (.03 + .1 * INT) + aKickAcc * .05 * INT) + hash11(lev + 3.7) * SEG;
  float afl = abs(mod(a + lrot, SEG) - .5 * SEG);
  vec2 qW = vec2(afl + D.x, qWy);

  // ---------------------------------------------------------------- level geometry
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
  // some levels are "quiet" (rings + EQ ticks + lattice only) -> breathing room
  float full = step(.3, hash11(lev * 3.1 + floor(iSeed * 17.)));

  // kick: shock front position (it also flares the geometry it sweeps through)
  float tk = -.14 * log(max(aKick, 1e-3));        // seconds since the kick
  float Lb = log(.05) + tk * 11.;
  float kfade = pow(clamp(1. - tk / .42, 0., 1.), 1.5) * step(.004, aKick);
  float kwave = kfade * exp(-abs(L - Lb) * 3.) * (.3 + .7 * INT);

  // ---------------------------------------------------------------- backlight
  // light at the end of the tunnel: hot core, broad halo, faint far fill
  float kb = .7 + .35 * aBass + .45 * aKick * (.3 + .7 * INT);
  float light = (.85 * exp(-r / .055) + .42 * exp(-r / .2) + .045 * (1. - outer)) * kb;
  vec3 hot = mix(cD, vec3(1.), .45);
  vec3 glowC = mix(mix(cB, cC, .25), hot, exp(-r / .09));

  vec3 col = vec3(0.);

  // ---------------------------------------------------------------- stained glass
  float hs = hash12(vec2(st.y + alt * 8. + lev * 17., BAR + floor(iSeed * 31.)));
  float sl = step(mix(.72, .5, INT), hs) * full;
  sl = mix(sl, (1. - sl) * full, INV);
  {
    vec3 hue = cyc3(hs * .7 + lev * .27 + BAR * .25);
    float eg = exp(-edgeD / mix(.032, .018, style));           // inner rim of the shard
    float tex = mix(.5 + .8 * fld, .8 + .3 * fld, style);       // cathedral-glass mottling
    float trans = light * (1.2 + 1.4 * INT) * tex;
    // near the core: full transmitted glow; toward the camera: neon-rimmed, dark-hearted glass
    float body = mix(1., .04, smoothstep(.07, .32, r));
    float emis = (.09 + .3 * INT) * eg * (.6 + .4 * fld);
    vec3 lit = hue * (trans * mix(body, 1., eg) + emis) * (1. + 2.5 * kwave);
    // opaque shards: near-black silhouettes with a whisper of fog
    vec3 dark = cC * (.006 + .02 * fld * (1. - outer)) + glowC * light * .03;
    vec3 glass = mix(dark, lit, sl);
    // sub-pixel levels near the core average out into the glow
    vec3 avg = glowC * light * (.35 + .4 * INT);
    col += mix(avg, glass, detail);
  }

  // ---------------------------------------------------------------- organic: marbled filaments
  float wOrg = (1. - style) * (1. - style * .5);
  {
    float fk = fld * (1.6 + 3.4 * wy) + qW.y * 3.2;   // mostly concentric; melts into loops at high warp
    float bi = floor(fk), bf = fract(fk);
    float g = max(fwidth(fk), 1e-5);
    float cdq = min(bf, 1. - bf) / g * WQ;        // distance to contour in log-polar units
    float on = step(.5, hash11(bi * 1.37 + floor(iSeed * 13.)));
    float fil = lineAA(cdq, .0032, WQ) * smoothstep(.45, .12, g) * on * smoothstep(.0, .5, INT + .25 * wy);
    vec3 rc = mix(cyc3(bi * .23 + BAR * .25 + iSeed), vec3(1.), .15);
    // a soft sheen trailing each lit contour (liquid ribbon body), kept low so gaps stay dark
    float sheen = on * exp(-bf * 9.) * smoothstep(0., 2. * g, bf) * .12;
    col += wOrg * detail * rc * (fil * (.18 + .42 * INT) + sheen * (.15 + .3 * INT) * (.3 + light * 3.))
         * (1. - .75 * sl) * (1. - .5 * outer);
  }

  // ---------------------------------------------------------------- neon leading
  {
    float geoB = .3 + .62 * INT;
    float ring = lineAA(ringD, .005 + .003 * INT, WQ) * (1. + .6 * aKick + 3. * kwave);
    float ring2 = lineAA(abs(ringD - .05), .0018, WQ) * (.2 + .25 * INT);
    // bead chain just inside alternate rings
    float bsp = SEG * .5 / max(1., floor(30. / NSEG + .5));
    vec2 bq = vec2((fract(qW.x / bsp + .5) - .5) * bsp, fu * PER - .09);
    float bead = lineAA(length(bq), .011, WQ) * step(.5, mod(lev, 2.)) * (.4 + .6 * style);
    // hero star: thick neon outline + an engraved inner double line (geometric style)
    float star = lineAA(stq, .0045 + .0028 * style + .0015 * INT, WQ) * full;
    float star2 = lineAA(abs(stq - .028), .0016, WQ) * full * (.15 + .5 * style);
    vec3 accCol = mix(mix(cB, cD, FLIP), vec3(1.), .18);
    vec3 lines = levCol * (ring + ring2 + bead * 1.3)
               + accCol * (star * (1.5 + .8 * aSnare * clapOK + 3. * kwave) + star2);
    // log-spiral lattice (chevrons after mirroring) = the "spiral arms" of the quiet levels
    float k2 = 1. + floor(hb * 2.);
    float scv = u * 2. + qW.x / (SEG * .5) * k2;
    float gs = length(vec2(k2 / (SEG * .5), 2. / PER));
    float spD = min(fract(scv), 1. - fract(scv)) / gs;
    lines += mix(levCol, cC, .5) * lineAA(spD, .0024, WQ) * (.15 + .6 * style) * (1. - .8 * full);
    // spectrum EQ ticks hanging inward from the outer ring of the quiet levels
    float nbt = max(2., floor(26. / NSEG));
    float v = clamp(qW.x / (SEG * .5), 0., 1.);
    float bin = min(floor(v * nbt), nbt - 1.);
    float sv = spec((bin + .5) / nbt * .8 + .05);
    float th = PER * (.05 + .55 * sv * sv) * (.5 + .5 * INT);
    float bw = SEG * .5 / nbt;
    float yy = (1. - fu) * PER - .016;
    float bd = sdBox2(vec2((fract(v * nbt) - .5) * bw, yy - th * .5), vec2(min(bw * .12, .012), th * .5));
    float tick = (1. - smoothstep(-WQ, WQ, bd)) * (1. - full) * smoothstep(.55, .22, r);
    lines += mix(levCol, hot, clamp(1. - yy / max(th, .01), 0., 1.)) * tick * (.6 + .9 * sv);
    col += detail * lines * geoB * (1. + 1.2 * light) * (1. - .35 * outer);
  }

  // hat sparkles on star vertices (outer ring, fold axes)
  {
    float vx = alt > .5 ? SEG * .5 : 0.;
    vec2 dv = vec2(qW.x - vx, (1. - fu) * PER);
    float id = hash12(vec2(lev, BAR * 13. + floor(aBeatCount * 2.)));
    float sp = step(.4, id) * aHat * (.4 + .9 * INT) * full;
    float dd = length(dv);
    float glint = .0001 / (dd * dd + .0001) + .3 * lineAA(abs(dv.x), .0015, WQ) * exp(-abs(dv.y) * 25.);
    col += detail * mix(cD, vec3(1.), .5) * glint * sp * 1.6;
  }

  // ---------------------------------------------------------------- laser fans
  {
    float lon = smoothstep(.35, .6, INT) * step(.3, hash11(BAR * 3.7 + floor(iSeed * 11.)));
    // own fold with only 3-4 beam pairs, so it reads as club lasers, not wheel spokes
    float KL = 3. + step(.5, hash11(BAR * 1.9 + 4.1));
    float SL = TAU / KL;
    float aL = atan(p.y, p.x) - iTime * .11 * dir + sd * 2.;
    float afL = abs(mod(aL, SL) - .5 * SL);
    float sw = .5 + .45 * sin(iTime * (.5 + .6 * INT) + sd + BAR * 1.7);
    float da = abs(afL - SL * .5 * sw);
    float dpx = r * sin(min(da, 1.5));            // perpendicular screen distance to the beam
    float beam = lineAA(dpx, .0009 + .001 * r, px) * 1.4 + .16 * exp(-dpx / (.004 + .012 * r));
    float renv = smoothstep(.02, .07, r) * exp(-r * 1.3);
    vec3 lc = mix(cB, vec3(1.), .3);
    col += lc * beam * renv * lon * (.45 + 2. * aKick + .5 * aHigh);
  }

  // ---------------------------------------------------------------- kick shock ring
  {
    // star-shaped front: razor-thin leading edge + a soft wake trailing back toward the core
    float sh = .07 * (1. - cos(af / (SEG * .5) * PI));
    float sx = L - Lb - sh;                       // > 0 ahead of the front, < 0 behind it
    float front = lineAA(abs(sx), .0035 + .003 * tk, WQ);
    float wake = exp(min(sx, 0.) * 7.) * step(sx, 0.) * .22 + exp(-abs(sx) * 40.) * .25;
    vec3 sc = mix(hot, vec3(1.), .25);
    col += (sc * front * 1.6 + mix(cB, hot, .5) * wake) * kfade * (.6 + 1.6 * INT)
         * smoothstep(-4.2, -3., L) * (1. - .4 * outer);
  }

  // ---------------------------------------------------------------- iris corona + core
  {
    float R0 = log(.032);
    float nb = max(3., floor(48. / NSEG));
    float v = af / (SEG * .5);
    float x = (floor(v * nb) + .5) / nb;
    float sv = spec(x * .8 + .05);
    float h = (.08 + .75 * sv * sv) * (.5 + .5 * INT);
    float bw = SEG * .5 / nb;
    float cx = (fract(v * nb) - .5) * bw;
    float bd = sdBox2(vec2(cx, L - (R0 + h * .5)), vec2(bw * .16, h * .5));
    float bar = (1. - smoothstep(-WQ, WQ, bd)) * smoothstep(.5, .2, WQ * 2.);
    float along = clamp((L - R0) / max(h, .01), 0., 1.);
    col *= mix(.35, 1., smoothstep(R0 - .5, R0 + .2, L));   // dim collar so the core reads cleanly
    col += mix(cB, hot, along) * bar * (.5 + .7 * INT) * (.6 + .8 * sv);
  }

  // exposure-normalise bright palettes (acid / ember) so every section keeps its darks
  float palLum = dot(cB + cC + cD, vec3(.299, .587, .114)) / 3.;
  col *= clamp(.36 / max(palLum, .05), .5, 1.4);

  // white-hot vanishing point
  float core = .00022 / (r * r + .00022);
  col += hot * core * (1.4 + 1.4 * aKick + .8 * INT);

  // ---------------------------------------------------------------- feedback trails
  // iPrev is re-sampled with the zoom/rotation the mandala moved this frame
  // (z adds over-zoom -> trails shoot outward like hyperspace streaks)
  {
    vec2 asp = vec2(res.x / res.y, 1.);
    vec2 pc = (fragCoord / res - .5) * asp;
    float dTrav = (vT + aKick * vK + lurchV) / 30.;
    float zr = 1. - exp(-dTrav * (1. + .6 * zt) - .0015 * zt);
    pc = rot(-(.03 + .05 * INT) * dir / 30.) * pc * (1. - zr);
    vec3 prev = texture(iPrev, pc / asp + .5).rgb;
    prev *= (.25 + .42 * zt) * (1. - .35 * zt * outer) * mix(vec3(1.), normalize(cC + .05) * 1.5, .2);
    col = max(col, prev);
  }

  fragColor = vec4(col, 1.);
}
