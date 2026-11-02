// =============================================================================
// VORTEX — cosmic wormhole / black-hole whirlpool
//
// iParams (all 0..1; 0,0,0,0 = calm majestic swirl, medium-sparse particles, short trails):
//   x  spin speed: 0 = slow majestic rotation .. 1 = violent whirlpool (spin rate ~3-4x,
//      faster inflow, tighter-wound spiral arms)
//   y  particle density: 0 = sparse streaks .. 1 = dense swarm (more cells per layer, higher
//      fill, thicker gas); per-particle brightness is normalised so the frame doesn't blow out
//   z  trail length: 0 = short comet streaks .. 1 = long silky spiral light trails (longer
//      analytic tails + slower iPrev decay; the previous frame is advected along the
//      streamlines at a fraction of matter speed, so trails lie exactly on the spiral)
//   w  collapse: 0 = normal .. 1 = everything accelerates and drains into the centre,
//      outer matter empties out, the horizon shrinks, the photon ring tightens and
//      flares, feedback streaks converge hard into the hole. When w > 0.5 the last 25%
//      of the shot (iProgress .75..1) ignites the singularity: white-hot core, ring
//      flare and an anamorphic lens streak (meant for the end of the riser -> drop 2).
//      Use w either constant or ramped linearly with iProgress (e.g. w = p, w = .6 + .4p):
//      the feedback derives dw/dt from that so trails stay crisp while the collapse speeds up.
//      x / intensity may be animated freely (they only scale shot-local iLocal phases).
//   iSeed: number of spiral arms (2-4), pitch, disk tilt, doppler-bright side, drift.
//
// Recommended presets: 0,0,0,0 calm majestic; .25,.3,.6,0 cooldown (dream/afterglow, int .4-.6);
//   1,.3,.4,0 drop cut (fast, tight, intense); .5,.6,.8,.3 silky long-exposure swirl;
//   .25p,.3,.4,p riser collapse (noir, int .3->.6); 1,1,1,1 dense hyperspace drain (acid).
//
// Composition: a pure-black event horizon dead centre (slow drift), a razor-thin
//   white-hot photon ring hugging it, a dark gap, then a blazing, doppler-lopsided inner
//   accretion disk that winds tightly around the hole and opens into log-spiral gas arms
//   cut by dark dust lanes. Light streaks in three depth layers (fine far dust, main
//   streaks, a few big soft near streaks) pour into the void, coloured by temperature
//   (palette haze cC outside -> key cB -> hot accent cD -> white at the core). Behind it:
//   a lensed starfield (Einstein-ring warp) and dim swirling nebula.
//
// Space: everything lives on log-spiral streamlines. sigma = angle + K*log r - KW*rh/r
//   (streamline id, rotates rigidly with the spin phase S) and tau = log r + F (inflow
//   phase). Matter moves along tau -> it shrinks as it falls = infinite depth, and winds
//   faster near the horizon (KW term). iPrev feedback rotates with S and zooms along tau,
//   so trails stay exactly on the streamlines (crisp, no fanning). Only matter feeds back:
//   stars, nebula and the final lens streak are subtracted from iPrev and re-added on top.
//
// Audio: spin/inflow phases integrate aEnergy (aEnergyAcc) + aKickAcc -> the whole
//   whirlpool surges inward on every kick without jitter; every kick also launches a
//   bright pressure wave that lights the matter up as it ripples outward through the
//   spiral; claps flash the photon ring + inner disk; hats twinkle a random subset of
//   particles; bass swells the disk.
// =============================================================================

float INT, PX, RH, THE, SPIN, SD, FIN;
vec2 CTR;

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
  for (int i = 0; i < 3; i++) { s += a * pnoise(p, P); p = p * 2. + vec2(0., 7.31); P *= 2.; a *= .5; }
  return s / .875;
}

// temperature colour ramp: 0 = cold outer haze .. 1 = white-hot core
vec3 tempCol(float h) {
  vec3 c = mix(cC, cB, smoothstep(.12, .5, h));
  c = mix(c, mix(cB, cD, .75), smoothstep(.42, .75, h));
  return mix(c, mix(cD, vec3(1., .93, .9), .45), smoothstep(.72, .97, h));
}

// gravitationally lensed background coordinate (point-lens: beta = theta - thE^2/theta)
vec2 lensBG(vec2 q) {
  float r2 = max(dot(q, q), 1e-5);
  vec2 qb = q * (1. - THE * THE / r2);
  return rot(.35 * RH / (sqrt(r2) + .05) + SPIN * .04) * qb;     // + frame-dragging swirl
}

// dim lensed nebula + central haze (q = hole-centred coords). Static, so like the stars it is
// kept out of the feedback (otherwise strong collapse zoom smears it into banded wedges).
vec3 nebula(vec2 q) {
  vec2 qb = lensBG(q);
  vec2 nq = qb * 2. + vec2(SD, SD * .7);
  float n = .5 * vnoise(nq) + .3 * vnoise(nq * 2.03 + 17.1) + .2 * vnoise(nq * 4.1 + 31.7);
  float n2 = vnoise(qb * 6. - vec2(SD * .3, 3.1));
  float neb = smoothstep(.42, .95, n) * (.3 + .7 * n2);
  float r = length(q);
  return ((cA * 1.2 + cC * .06 + cB * .03 * n2) * neb * (.35 + .4 * INT) + cA * .3 * exp(-r * 2.))
       * smoothstep(RH - PX * 1.2, RH + PX * 1.2, r);
}

// lensed starfield (q = hole-centred coords). Kept separate so it can be removed from
// the feedback buffer exactly (static points would otherwise stamp dotted trails).
vec3 stars(vec2 q) {
  vec2 qb = lensBG(q);
  float r = length(q);
  vec3 c = vec3(0.);
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float sc = 24. + 26. * fi;
    vec2 g = qb * sc + fi * 17.3 + SD;
    vec2 id = floor(g), f = fract(g) - .5;
    vec3 h = hash33(vec3(id, fi + 3.1));
    vec2 o = (h.xy - .5) * .7;
    float d = length(f - o) / sc;
    float re = PX * .8;
    float b = pow(h.z, 9.) * (1.3 - .6 * fi);
    c += b * exp(-d * d / (re * re)) * mix(vec3(1.), cB * 1.4 + .25, h.x * .7);
  }
  // too compressed right at the Einstein ring -> fade (disk covers it anyway)
  return c * (.4 + .5 * INT) * smoothstep(THE * .95, THE * 1.6, r);
}

// cheap test: is any star within ~3px of q? (lets the feedback skip the 4-tap removal)
float starNear(vec2 q) {
  vec2 qb = lensBG(q);
  float s = 0.;
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float sc = 24. + 26. * fi;
    vec2 g = qb * sc + fi * 17.3 + SD;
    vec2 id = floor(g), f = fract(g) - .5;
    vec3 h = hash33(vec3(id, fi + 3.1));
    float d = length(f - (h.xy - .5) * .7) / sc;
    s += pow(h.z, 9.) * step(d, PX * 4.);
  }
  return s;
}

// screen-space overlays that must not feed back: stars + final anamorphic lens streak
vec3 overlay(vec2 q) {
  vec3 c = stars(q);
  if (FIN > 0.) {
    float an = exp(-abs(q.y) / (.003 + .006 * FIN)) * exp(-abs(q.x) * (2.5 - 1.5 * FIN));
    c += mix(cB, vec3(1.), .5) * an * 1.2 * FIN;
  }
  return c;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  INT = clamp(iIntensity, 0., 1.);
  vec2 res = iResolution;
  PX = 1. / res.y;
  vec2 p = (fragCoord - .5 * res) / res.y;

  float X = clamp(iParams.x, 0., 1.);
  float Y = clamp(iParams.y, 0., 1.);
  float Z = clamp(iParams.z, 0., 1.);
  float Wc = clamp(iParams.w, 0., 1.);
  float clp = Wc * Wc * (3. - 2. * Wc);
  float fin = Wc > .5 ? sq(smoothstep(.75, 1., iProgress)) * smoothstep(.5, 1., Wc) : 0.;
  FIN = fin;

  SD = iSeed * 17.31;
  float ARMS = 2. + floor(hash11(iSeed * 91.7 + 3.) * 2.99);
  float K = .95 + .5 * hash11(iSeed * 53.1 + 1.) + .5 * X;      // spiral pitch
  float KW = 1.6 + 1.2 * X;                                    // extra winding near horizon
  float beamA = PI + (hash11(iSeed * 21.3) - .5) * 1.4;         // doppler-bright side

  // ---------------------------------------------------------------- motion phases
  // spin S (rad) and inflow F (log-radius units): monotonic integrals -> silky motion.
  // Param/intensity-dependent rates only ever multiply iLocal, never the song-long audio
  // integrals (aEnergyAcc ~70 by mid-song): animating x/intensity across a shot (riser)
  // must not add hidden phase velocity that the feedback advection doesn't know about.
  float rSp = (.04 + .25 * X) * INT + .3 * X * (.4 + .6 * INT);   // param-driven spin rate
  float rIn = .15 * INT + .22 * X * (.4 + .6 * INT);              // param-driven inflow rate
  float S = iTime * .05 + aEnergyAcc * .14 + aKickAcc * .14 + iLocal * rSp
          + clp * clp * iLocal * 1.6 + SD;
  float F = iTime * .06 + aEnergyAcc * .14 + aKickAcc * .9 + iLocal * rIn
          + clp * clp * iLocal * 1.3 + SD * 3.;
  // instantaneous rates (for feedback advection). w is meant to be constant or ramped
  // linearly with iProgress (from 0, or up to 1, e.g. w = p or .6 + .4p): estimate dw/dt
  // from that so the extra phase velocity of the clp^2 * iLocal terms is known too.
  float pr = clamp(iProgress, 1e-3, .999);
  float dWdt = min(Wc / pr, (1. - Wc) / (1. - pr)) / max(iShotLen, .1);
  float cRate = clp * clp + 2. * clp * 6. * Wc * (1. - Wc) * dWdt * iLocal;   // d(clp^2 iLocal)/dt
  float Sd = .05 + aEnergy * .14 + aKick * .14 + rSp + cRate * 1.6;
  float Fd = .06 + aEnergy * .14 + aKick * .9 + rIn + cRate * 1.3;
  SPIN = S;

  // ---------------------------------------------------------------- geometry
  CTR = .03 * vec2(sin(iTime * .13 + SD), .6 * cos(iTime * .11 + SD * 1.3)) * (1. - clp);
  vec2 q = p - CTR;
  float r = length(q);
  float a = atan(q.y, q.x);
  float rh = .085 * (1. - .32 * clp);                // event horizon radius
  RH = rh;
  THE = rh * 1.45 * (1. + .35 * clp);
  float ct = cos(.14 + .2 * hash11(iSeed * 7.7 + 5.));   // disk inclination
  vec2 qd = vec2(q.x, q.y / ct);                      // disk plane coords
  float rd = max(length(qd), 1e-4);
  float ad = atan(qd.y, qd.x);
  float u = log(rd);
  float uh = log(rh);

  // kick pressure wave: travels outward from the horizon through the spiral and lights
  // the matter up as it passes (sharp leading edge, soft afterglow behind)
  float tk = -.14 * log(max(aKick, 1e-4));           // seconds since kick
  float kAmp = (1. - smoothstep(.12, .46, tk)) * (.55 + .6 * INT);
  float uw = uh + .55 + tk * 5.5;
  float xw = u - uw;
  float bump = (xw > 0. ? exp(-sq(xw / .05)) : exp(xw / (.06 + .3 * tk))) * kAmp;
  float uR = u - .05 * bump;                         // ripple pushes matter outward along the flow

  float kEff = K + KW * rh / rd;
  float sig = ad + K * u - KW * rh / rd - S;          // (unrippled: no sideways jumps vs. feedback)
  float tau = uR + F;
  float heat = clamp(1. - (u - uh) / 2.3, 0., 1.);    // 1 at horizon .. 0 far out

  // ---------------------------------------------------------------- background
  vec3 col = vec3(0.);                                // matter only (feeds back); nebula/stars added last

  // spiral arm density (shared by gas + particle clustering)
  float drainR = mix(1.6, rh * 3.2, clp);             // collapse: matter drains inward
  float drain = 1. - smoothstep(drainR * .55, drainR, rd) * (.92 * clp);
  // relativistic doppler beaming: the approaching side of the inner disk blazes white, the
  // receding side sinks into deep accent colour -> lopsided M87-style crescent
  float bc = smoothstep(-1., 1., cos(ad - beamA));
  float beam = mix(1., .2 + 2.3 * bc * sqrt(bc), smoothstep(rh * 6., rh * 1.5, rd));

  // ---------------------------------------------------------------- spiral gas / accretion disk
  float nf = pfbm(vec2(sig * (20. / TAU), tau * 1.4), 20.);              // filaments along streamlines
  float nd = pnoise(vec2(sig * (5. / TAU), tau * .5 + 2.), 5.);         // big clumps
  float armPh = ARMS * sig + nd * 1.6;
  // dark dust lane hugging the leading edge of each arm (absorbs gas, streaks and nebula)
  float lane = pow(max(cos(armPh + 1.2), 0.), 6.)
             * smoothstep(.2, .7, pnoise(vec2(sig * (14. / TAU), tau * 1.1 + 9.), 14.));
  float dust = 1. - .88 * lane * (1. - smoothstep(.55, .85, heat)) * drain;
  {
    float arm = .5 + .5 * cos(armPh);
    arm = arm * arm * arm;
    float dens = (.03 + 1.15 * arm) * sq(nf) * (.35 + 1.1 * nd) * (1. + .3 * Y);
    float rIs = rh * (1.38 - .18 * clp);               // inner disk edge (ISCO)
    float inner = smoothstep(rIs * .985, rIs * 1.12, rd);
    float prof = pow(rh / rd, 1.15) * inner;
    // colour by temperature: hot inner (accent -> white), key mid, haze outer
    vec3 cHot = mix(cD, vec3(1., .93, .9), .4);
    vec3 gc = mix(cC * .8 + cA * .5, cB, smoothstep(.1, .5, heat));
    gc = mix(gc, mix(cB, cD, .7), smoothstep(.45, .78, heat));
    gc = mix(gc, cHot, smoothstep(.75, .97, heat));
    gc = mix(gc, vec3(1.) * dot(gc, vec3(.4)) + gc * .4, clamp(bump * .5, 0., .6));   // shock-heated
    float gasB = (.3 + .8 * INT) * (1. + 3.5 * bump) * (1. + .4 * aBass * heat);
    col += gc * dens * prof * gasB * 1.1 * beam * drain;
    // inner disk: tightly wound white-hot filaments with a blazing inner rim
    if (rd < rh * 4.3) {
      float hot = smoothstep(rh * 4.2, rh * 1.4, rd) * inner;
      float st1 = pnoise(vec2(sig * (36. / TAU), tau * 1.1), 36.);
      float st2 = pnoise(vec2(sig * (90. / TAU), tau * 2.3 + 5.), 90.);
      float streak = st1 * .65 + st2 * .35;
      streak = smoothstep(.3, .85, streak);
      streak = streak * streak * (.5 + nf);
      float rim = exp(-max(rd - rIs, 0.) / (rh * .07)) * inner;
      float hB = (1. + .7 * INT + 1.5 * aSnare + 1.2 * aKick * INT + .7 * clp) * (1. + .5 * aBass);
      float hotD = hot * pow(rh / rd, 2.4) * (.15 + 2.6 * streak);
      float hotR = rim * (1. + 1.6 * streak);
      vec3 hc = mix(cD * .9 + cB * .1, vec3(1., .95, .92), clamp((hotD + hotR) * beam * .4, 0., .9));
      // rim gets softer beaming so its bloom doesn't wash into the void
      col += hc * (hotD * beam + hotR * (.45 + .55 * sqrt(beam))) * hB;
      // smooth luminous base under the filaments -> the core glows like a lamp
      col += mix(cD, vec3(1., .9, .9), .25) * exp(-max(rd - rIs, 0.) / (rh * .55)) * inner * smoothstep(rh * 4.2, rh * 2.2, rd)
           * (.14 + .18 * INT + .35 * aKick * INT + .3 * aSnare) * beam;
    }
  }

  // ---------------------------------------------------------------- light streaks (3 depth layers)
  {
    float met = sqrt(1. + kEff * kEff);
    float trailC = mix(1.4, 3., Z) * (1. + clp);                       // streak length in cells
    float fill = (.25 + .3 * INT) * (.5 + .7 * Y);
    // temperature colours either side of this pixel's heat -> per-particle variation along the ramp
    vec3 tc0 = tempCol(heat - .16), tc1 = tempCol(heat + .1);
    vec3 pc = vec3(0.);
    for (int L = 0; L < 3; L++) {
      float fl = float(L);
      // L0 = far fine dust (dense, thin, slow), L1 = main streaks, L2 = near: few, big, soft, fast
      float N = floor(mix(56., 84., Y) * (L == 0 ? 1.8 : (L == 1 ? 1. : .42)));
      float cs = TAU / N;
      float spd = L == 0 ? .8 : (L == 1 ? 1. : 1.35);
      float wf = L == 0 ? .8 : 1.;
      float lb = L == 0 ? .6 : (L == 1 ? 1. : .7);
      vec2 g = vec2(sig + fl * 1.7, uR + F * spd + fl * 3.1) / cs;
      vec2 ic = floor(g);
      float cellPx = cs * rd / PX;
      float vis = smoothstep(2.5, 7., cellPx);
      if (vis <= 0.) continue;
      for (int j = 0; j < 3; j++) {
        vec2 c = ic - vec2(0., float(j));
        vec2 cid = vec2(mod(c.x, N), c.y);
        vec3 h = hash33(vec3(cid, fl * 7.13 + 1.7));
        float hx = .3 + .4 * h.x;
        // cluster particles inside the spiral arms
        float armP = .5 + .5 * cos(ARMS * ((c.x + hx) * cs - fl * 1.7));
        if (h.z > fill * (.1 + 1.6 * armP * armP)) continue;
        float h4 = fract(h.z * 71.3 + h.x * 13.1);
        vec2 head = c + vec2(hx, h.y);
        vec2 dg = g - head;
        float len = trailC * (.5 + .9 * h4);
        float along = clamp(dg.y, 0., len);
        float tt = along / len;
        float rad = cs * rd * (.013 + .02 * h.y) * wf * (1. - .65 * tt);
        vec2 ds = vec2(dg.x / met, (dg.y - along) * met) * cs * rd;
        float re = max(rad, PX * .7) * (L == 2 ? 1.8 : 1.);            // near layer: defocused
        float fade = (1. - tt) * (1. - tt);
        float I = exp(-dot(ds, ds) / (re * re)) * min(rad / re, 1.) * (fade * .8 + .45 * exp(-tt * 25.));
        float br = .6 + 3. * pow(fract(h.x * 37.1), 6.);
        // hats: a random subset twinkles each offbeat
        float tw = step(.8, hash13(vec3(cid, aBeatCount + fl)));
        br *= 1. + 5. * tw * aHat * (.4 + .6 * INT);
        vec3 c0 = mix(tc0, tc1, h.y);
        c0 = mix(c0, mix(cD, vec3(1.), .25), step(.9, h4));                 // rare hot sparks
        pc += c0 * I * br * vis * lb;
      }
    }
    float pB = (.45 + 1.15 * INT) / (.75 + .5 * Y) * (1. + 4. * bump) * pow(rh * 3. / max(rd, rh * 1.4), .6);
    pB *= smoothstep(rh * 1.3, rh * 1.9, rd);
    pc = mix(pc, vec3(dot(pc, vec3(.45))) + pc * .3, clamp(bump * .6, 0., .7));  // shock-heated -> white
    col += pc * pB * (drain * .8 + .2);
  }
  col *= dust;

  // ---------------------------------------------------------------- horizon + photon ring
  float shadow = smoothstep(rh - PX * 1.2, rh + PX * 1.2, r);
  col *= shadow;
  {
    float rp = rh * (1.05 - .02 * clp);
    float wr = rh * (.02 + .02 * aSnare + .015 * fin);
    float wre = max(wr, PX * .8);
    float ringI = exp(-sq((r - rp) / wre)) * (wr / wre);
    float flick = pnoise(vec2((a + S * 3.) * (14. / TAU), iTime * .9), 14.);
    float bR = smoothstep(-1., 1., cos(a - beamA));
    float beamR = .25 + 1.5 * bR * bR;
    float rB = (2.5 + 1.5 * INT + 4. * aSnare + 3. * clp + 10. * fin) * (.6 + .7 * flick) * beamR;
    vec3 rc = mix(cD, vec3(1.), .6 + .3 * aSnare);
    col += rc * ringI * rB;
    // thin glow just outside the ring (lensed light), flashes on claps
    float halo = exp(-max(r - rp, 0.) / (rh * (.06 + .2 * aSnare + .3 * fin))) * smoothstep(rh * .98, rp, r);
    col += mix(cD, cB, .4) * halo * (.15 + 1.2 * aSnare + .5 * clp + 2. * fin) * beamR;
    // secondary lensed image of the disk (dimmer ring, brighter top/bottom)
    float r2 = rh * 1.19;
    float ring2 = exp(-sq((r - r2) / max(rh * .035, PX)));
    col += mix(cD, cB, .3) * ring2 * (.06 + .3 * sq(q.y / max(r, 1e-4))) * (.5 + .5 * INT + 1.5 * aSnare + .8 * clp);
  }

  // ---------------------------------------------------------------- final flare (collapse end): singularity ignites
  col += mix(cD, vec3(1.), .7) * fin * fin * fin * .02 / (r * r + .002);

  // ---------------------------------------------------------------- feedback trails
  // previous frame advected along the spiral flow (in the disk plane), with decay.
  // The rotation always includes the full pattern spin (Sd) and the inflow is a fraction
  // m of matter speed: a point on streamline sigma stays on sigma, so trails lie exactly
  // behind each streak (no sideways fanning / serrated feathers).
  // Stars/lens streak are subtracted from it exactly (bilinear over the 4 source texels)
  // and re-added after, so only the moving matter leaves trails.
  vec3 st = overlay(q);
  {
    float m = mix(.55, .3, Z) + 1.6 * clp * clp;              // inflow relative to matter (<1: trails lag)
    float dt = 1. / 30.;
    float zin = Fd * m * dt;
    float om = Sd * dt + kEff * zin;
    vec2 sd2 = rot(-om) * qd * exp(zin);
    vec2 src = vec2(sd2.x, sd2.y * ct) + CTR;
    vec2 sp = src * res.y + .5 * res - .5;              // source position in texel space
    vec2 i0 = floor(sp), fr = sp - i0;
    vec3 prev = texture(iPrev, (sp + .5) / res).rgb;
    if (FIN > 0. || starNear(src - CTR) > .004) {
      vec3 s00 = overlay((i0 + .5 - .5 * res) * PX - CTR);
      vec3 s10 = overlay((i0 + vec2(1.5, .5) - .5 * res) * PX - CTR);
      vec3 s01 = overlay((i0 + vec2(.5, 1.5) - .5 * res) * PX - CTR);
      vec3 s11 = overlay((i0 + 1.5 - .5 * res) * PX - CTR);
      prev -= mix(mix(s00, s10, fr.x), mix(s01, s11, fr.x), fr.y);
    }
    prev -= nebula(src - CTR);                          // smooth -> one sample at the source is enough
    prev = max(prev, 0.);
    vec2 uv = (sp + .5) / res;
    float edge = smoothstep(0., .02, min(min(uv.x, uv.y), min(1. - uv.x, 1. - uv.y)));
    float decay = (mix(.8, .935, Z) + .03 * clp) * (1. - .04 * Y);
    prev *= decay * edge * smoothstep(rh * .95, rh * 1.15, r);
    col = max(col, prev);
  }
  col += st + nebula(q) * (1. - .7 * lane * drain);

  fragColor = vec4(col, 1.);
}
