// =============================================================================
// VORTEX — cosmic wormhole / black-hole whirlpool
//
// iParams (all 0..1; 0,0,0,0 = calm majestic swirl, medium density, short trails):
//   x  spin speed: 0 = slow majestic rotation .. 1 = violent whirlpool (~3-4x angular
//      speed of the rigid spin, faster inflow, tighter-wound spiral)
//   y  particle density: 0 = sparse (~2-3k particles) .. 1 = dense swarm (~10k+),
//      also thickens the spiral gas a little
//   z  trail length: 0 = short afterglow .. 1 = long spiral light trails (iPrev
//      feedback: slower decay + stronger spiral zoom/rotation of the previous frame)
//   w  collapse: 0 = normal .. 1 = everything accelerates and drains into the centre,
//      outer matter empties out, the horizon shrinks, the photon ring tightens and
//      flares white-hot, feedback streaks converge hard. When w > 0.5 the last ~25%
//      of the shot (iProgress) adds a final flare + anamorphic streak (end of riser).
//
// Composition: a pure-black event horizon dead centre (slow drift), a razor-thin
//   white-hot photon ring hugging it, a dark gap, then a blazing inner accretion disk
//   that winds tightly around the hole and opens into log-spiral arms of gas plus
//   thousands of streaking particles that pour into the void. Behind it: a lensed
//   starfield (Einstein-ring warp) and dim swirling nebula.
//
// Space: everything lives on log-spiral streamlines. sigma = angle + K*log r - KW*rh/r
//   (streamline id, rotates rigidly with the spin phase S) and tau = log r + F (inflow
//   phase). Matter moves along tau -> it shrinks as it falls = infinite depth, and winds
//   faster near the horizon (KW term).
//
// Audio: spin/inflow phases integrate aEnergy (aEnergyAcc) + aKickAcc -> the whole
//   whirlpool surges inward on every kick without jitter; every kick also launches a
//   bright pressure wave rippling outward through the spiral; claps flash the photon
//   ring + inner disk; hats twinkle a random subset of particles; bass swells the disk.
// =============================================================================

float INT;

float sq(float x) { return x * x; }

// value noise periodic in x with integer period P
float pnoise(vec2 p, float P) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3. - 2. * f);
  float i0 = mod(i.x, P), i1 = mod(i.x + 1., P);
  float a = hash12(vec2(i0, i.y)), b = hash12(vec2(i1, i.y));
  float c = hash12(vec2(i0, i.y + 1.)), d = hash12(vec2(i1, i.y + 1.));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float pfbm(vec2 p, float P) {
  float s = 0., a = .5;
  for (int i = 0; i < 4; i++) { s += a * pnoise(p, P); p = p * 2. + vec2(0., 7.31); P *= 2.; a *= .5; }
  return s / .9375;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  INT = clamp(iIntensity, 0., 1.);
  vec2 res = iResolution;
  float px = 1. / res.y;
  vec2 p = (fragCoord - .5 * res) / res.y;

  float X = clamp(iParams.x, 0., 1.);
  float Y = clamp(iParams.y, 0., 1.);
  float Z = clamp(iParams.z, 0., 1.);
  float Wc = clamp(iParams.w, 0., 1.);
  float clp = Wc * Wc * (3. - 2. * Wc);
  float fin = Wc > .5 ? smoothstep(.72, 1., iProgress) * smoothstep(.5, 1., Wc) : 0.;

  float sd = iSeed * 17.31;
  float ARMS = 2. + floor(hash11(iSeed * 91.7 + 3.) * 2.99);
  float K = .95 + .5 * hash11(iSeed * 53.1 + 1.) + .5 * X;      // spiral pitch
  float KW = 1.6 + 1.2 * X;                                    // extra winding near horizon
  float beamA = PI + (hash11(iSeed * 21.3) - .5) * 1.4;         // doppler-bright side

  // ---------------------------------------------------------------- motion phases
  // spin S (rad) and inflow F (log-radius units): monotonic integrals -> silky motion
  float S = iTime * .05 + aEnergyAcc * (.10 + .35 * X) + iLocal * (.04 + .25 * X) * INT
          + aKickAcc * .12 + clp * clp * iLocal * 1.6 + sd;
  float F = iTime * .06 + aEnergyAcc * (.12 + .22 * X) + iLocal * .15 * INT
          + aKickAcc * .9 + clp * clp * iLocal * 1.3 + sd * 3.;
  // instantaneous rates (for feedback advection)
  float Sd = .05 + aEnergy * (.10 + .35 * X) + (.04 + .25 * X) * INT + aKick * .12 + clp * clp * 1.6;
  float Fd = .06 + aEnergy * (.12 + .22 * X) + .15 * INT + aKick * .9 + clp * clp * 1.3;

  // ---------------------------------------------------------------- geometry
  vec2 ctr = .03 * vec2(sin(iTime * .13 + sd), .6 * cos(iTime * .11 + sd * 1.3)) * (1. - clp);
  vec2 q = p - ctr;
  float r = length(q);
  float a = atan(q.y, q.x);
  float rh = .085 * (1. - .32 * clp);                // event horizon radius
  float tilt = .14 + .2 * hash11(iSeed * 7.7 + 5.);
  vec2 qd = vec2(q.x, q.y / cos(tilt));              // disk plane (slightly inclined)
  float rd = max(length(qd), 1e-4);
  float ad = atan(qd.y, qd.x);
  float u = log(rd);
  float uh = log(rh);

  // kick pressure wave: travels outward from the horizon through the spiral
  float tk = -.14 * log(max(aKick, 1e-4));           // seconds since kick
  float kAmp = pow(aKick, .8) * (.5 + .7 * INT);
  float uw = uh + .25 + tk * 4.2;
  float bump = exp(-sq((u - uw) / (.10 + .12 * tk))) * kAmp;
  float uR = u - .06 * bump;                         // ripple displaces the spiral

  float kEff = K + KW * rh / rd;
  float sig = ad + K * uR - KW * rh / rd - S;
  float tau = uR + F;
  float heat = clamp(1. - (u - uh) / 2.4, 0., 1.);    // 1 at horizon .. 0 far out

  // ---------------------------------------------------------------- background (lensed)
  vec3 col = vec3(0.);
  {
    float thE = rh * 1.45 * (1. + .35 * clp);
    vec2 qb = q * (1. - thE * thE / max(r * r, 1e-4));
    float rb = length(qb);
    qb = rot(.35 * rh / (r + .05) + S * .04) * qb;   // frame dragging swirl
    // nebula
    float n = fbm(qb * 2.2 + vec2(sd, sd * .7));
    float n2 = fbm(qb * 4.5 - vec2(sd * .3, 3.1));
    float neb = smoothstep(.35, .9, n) * (.4 + .6 * n2);
    col += (cA * 1.6 + cC * .10 + cB * .04 * n2) * neb * (.35 + .4 * INT);
    col += cA * .25 * exp(-r * 1.5);
    // stars (two layers)
    for (int i = 0; i < 2; i++) {
      float fi = float(i);
      float sc = 26. + 30. * fi;
      vec2 g = qb * sc + fi * 17.3 + sd;
      vec2 id = floor(g), f = fract(g) - .5;
      vec3 h = hash33(vec3(id, fi + 3.1));
      vec2 o = (h.xy - .5) * .7;
      float d = length(f - o) / sc;
      float re = px * .75;
      float b = pow(h.z, 10.) * (1.2 - .5 * fi) * (.5 + .5 * INT);
      col += b * exp(-d * d / (re * re)) * mix(vec3(1.), cB * 1.5 + .2, h.x * .6);
    }
    // stars too compressed near the Einstein ring -> fade (disk covers it anyway)
    col *= smoothstep(thE * .9, thE * 1.5, r) * .9 + .1 * smoothstep(rh, rh * 1.3, r);
  }

  // ---------------------------------------------------------------- spiral gas / accretion disk
  float drainR = mix(1.6, rh * 3.2, clp);             // collapse: matter drains inward
  float drain = 1. - smoothstep(drainR * .55, drainR, rd) * (.9 * clp);
  {
    float nf = pfbm(vec2(sig * (20. / TAU), tau * 1.4), 20.);              // filaments along streamlines
    float nd = pnoise(vec2(sig * (6. / TAU), tau * .6 + 2.), 6.);         // big clumps
    float arm = .5 + .5 * cos(ARMS * sig + nd * 2.5);
    arm = pow(arm, 2.2);
    float dens = (.22 + .9 * arm) * sq(nf) * (.5 + .9 * nd);
    dens *= 1. + .3 * Y;
    // radial emission profile: bright inner disk with a sharp inner edge (ISCO), long falloff
    float rIn = rh * (1.32 - .15 * clp);
    float inner = smoothstep(rIn * .97, rIn * 1.18, rd);
    float prof = pow(rh / rd, 1.25) * inner;
    prof += .02 * exp(-rd * 2.);
    // inner disk: tightly wound hot streaks, extra glow
    float hot = smoothstep(rh * 4.5, rh * 1.3, rd) * inner;
    float streak = pnoise(vec2(sig * (48. / TAU), tau * .8), 48.);
    // colour by temperature: hot inner (accent -> white), key mid, haze outer
    vec3 cHot = mix(cD, vec3(1., .92, .9), .35);
    vec3 gc = mix(cC * .9 + cA, cB, smoothstep(.0, .45, heat));
    gc = mix(gc, cD * .9 + cB * .2, smoothstep(.45, .75, heat) * .8);
    gc = mix(gc, cHot, smoothstep(.72, .95, heat));
    float beam = mix(1., .45 + .9 * smoothstep(-1., 1., cos(ad - beamA)), hot);
    float gasB = (.55 + .8 * INT) * (1. + 2.4 * bump) * (1. + .5 * aBass * hot);
    vec3 gas = gc * dens * prof * gasB * 1.3;
    gas += cHot * hot * (.35 + .65 * streak * streak) * (.9 + .5 * INT + 1.2 * aSnare + .6 * aKick + 2. * clp) * pow(rh / rd, 2.) * .9;
    col += gas * beam * drain;
    // the wave itself: a faint glowing shock front
    col += mix(cB, cD, .4) * bump * .12 * smoothstep(rh * 1.2, rh * 2., rd);
  }

  // ---------------------------------------------------------------- particles / streaks
  {
    float met = sqrt(1. + kEff * kEff);
    float trailC = mix(1.2, 2.6, Z) * (1. + clp);                      // streak length in cells
    float fill = (.28 + .3 * INT) * (.55 + .9 * Y);
    vec3 pc = vec3(0.);
    for (int L = 0; L < 3; L++) {
      float fl = float(L);
      float N = floor(mix(60., 120., Y) * (1. + .55 * fl));
      float cs = TAU / N;
      float spd = 1.25 - .25 * fl;
      vec2 g = vec2(sig + fl * 1.7, uR + F * spd + fl * 3.1) / cs;
      vec2 ic = floor(g);
      float cellPx = cs * rd / px;
      float vis = smoothstep(2.5, 7., cellPx);
      if (vis <= 0.) continue;
      for (int j = 0; j < 3; j++) {
        vec2 c = ic - vec2(0., float(j));
        vec2 cid = vec2(mod(c.x, N), c.y);
        vec3 h = hash33(vec3(cid, fl * 7.13 + 1.7));
        if (h.z > fill) continue;
        float h4 = fract(h.z * 71.3 + h.x * 13.1);
        vec2 head = c + vec2(.3 + .4 * h.x, h.y);
        vec2 dg = g - head;
        float len = trailC * (.5 + .9 * h4);
        float along = clamp(dg.y, 0., len);
        vec2 ds = vec2(dg.x / met, (dg.y - along) * met) * cs * rd;
        float rad = cs * rd * (.035 + .05 * h.y);
        float re = max(rad, px * .7);
        float fade = 1. - along / len; fade *= fade;
        float I = exp(-dot(ds, ds) / (re * re)) * (rad / re) * fade;
        float br = .35 + 2.2 * pow(fract(h.x * 37.1), 5.);
        // hats: a random subset twinkles each offbeat
        float tw = step(.8, hash13(vec3(cid, aBeatCount + fl)));
        br *= 1. + 5. * tw * aHat * (.4 + .6 * INT);
        vec3 c0 = mix(cB, cC, h.y);
        c0 = mix(c0, cD, step(.86, h4));
        pc += c0 * I * br * vis;
      }
    }
    float pB = (.6 + .8 * INT) * (1. + 3. * bump) * pow(rh * 3. / max(rd, rh * 1.4), .6);
    pB *= smoothstep(rh * 1.25, rh * 1.8, rd);
    col += pc * pB * (drain * .75 + .25);
  }

  // ---------------------------------------------------------------- horizon + photon ring
  float shadow = smoothstep(rh - px * 1.2, rh + px * 1.2, r);
  col *= shadow;
  {
    float rp = rh * (1.05 - .02 * clp);
    float wr = rh * (.022 + .02 * aSnare + .015 * fin);
    float wre = max(wr, px * .8);
    float ringI = exp(-sq((r - rp) / wre)) * (wr / wre);
    float flick = pnoise(vec2((a + S * 3.) * (14. / TAU), iTime * .9), 14.);
    float beamR = .6 + .8 * smoothstep(-1., 1., cos(a - beamA));
    float rB = (2.2 + 1.4 * INT + 4. * aSnare + 5. * clp + 14. * fin) * (.6 + .7 * flick) * beamR;
    vec3 rc = mix(cD, vec3(1.), .55 + .3 * aSnare);
    col += rc * ringI * rB;
    // soft halo just outside the ring (lensed light), flashes on claps
    float halo = exp(-max(r - rp, 0.) / (rh * (.18 + .25 * aSnare + .3 * fin))) * smoothstep(rh * .98, rp, r);
    col += mix(cD, cB, .4) * halo * (.25 + .9 * aSnare + 1.2 * clp + 3. * fin) * beamR;
    // secondary lensed image of the disk (wider, dimmer ring, brighter top/bottom)
    float r2 = rh * 1.17;
    float ring2 = exp(-sq((r - r2) / max(rh * .05, px)));
    col += mix(cD, cB, .3) * ring2 * (.25 + .35 * sq(q.y / max(r, 1e-4))) * (.5 + .6 * INT + .8 * clp);
  }

  // ---------------------------------------------------------------- final flare (collapse end)
  {
    float fl = .12 * aSnare * INT + .25 * clp + 2.5 * fin;
    float an = exp(-abs(q.y) / (.0035 + .006 * fin)) * exp(-abs(q.x) * (2.5 - 1.5 * fin));
    col += mix(cB, vec3(1.), .5) * an * fl;
    col += mix(cD, vec3(1.), .7) * fin * fin * .05 / (r * r + .002);
  }

  // ---------------------------------------------------------------- feedback trails
  {
    float m = mix(.5, 1.4, Z) + 2.2 * clp;                   // advection relative to matter speed
    float dt = 1. / 30.;
    float om = (Sd + Fd * kEff) * m * dt;
    float zin = Fd * m * dt;
    vec2 src = rot(-om) * q * exp(zin) + ctr;
    vec2 asp = vec2(res.x / res.y, 1.);
    vec2 uv = src / asp + .5;
    vec3 prev = texture(iPrev, uv).rgb;
    float edge = smoothstep(0., .02, min(min(uv.x, uv.y), min(1. - uv.x, 1. - uv.y)));
    float decay = mix(.78, .945, Z) + .03 * clp;
    prev *= decay * edge * smoothstep(rh * .95, rh * 1.15, r);
    col = max(col, prev);
  }

  fragColor = vec4(col, 1.);
}
