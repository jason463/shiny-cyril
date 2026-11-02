// =============================================================================
// CHROME — liquid-metal metaballs floating in a dark studio void.
// A cluster of morphing chrome blobs (smooth union of orbiting spheres + liquid
// wobble) mirror-reflects an analytic neon studio: overhead softbox, two coloured
// strip lights, a camera-mounted ring light (beauty-dish catchlights), sweeping
// laser lines and a palette-tinted horizon. Blobs also reflect each other
// (analytic sphere proxies, no second march). Slow orbiting camera, background
// haze + out-of-focus bokeh for a shallow depth-of-field feel.
//
// iParams (all 0..1; 0,0,0,0 = 4 fat blobs, mirror chrome, glassy surface, moody light):
//   x  blob count / complexity   0 = 4 big blobs, lazy drift, 3 droplets per clap
//                                1 = 8 smaller blobs, wider faster orbits, 4 droplets per clap
//   y  surface                   0 = mirror chrome .. 1 = iridescent oil-slick thin film
//                                (palette-tinted rainbow interference, darker base)
//   z  ripple / noise amount     0 = glassy smooth, gentle kick ripples
//                                1 = strong liquid wobble + big kick shockwaves
//   w  environment brightness    0 = low-key moody studio .. 1 = high-key bright studio
//                                (bigger, brighter softboxes, stronger lasers/horizon)
// Audio: bass (sidechain pump) swells the blobs; every kick fires a ripple shockwave
// across the surface from a random impact point + a radius punch + ring-light pulse;
// claps (beats 2 & 4) snap 3-4 droplets out of the mass that fly off and merge back;
// snare also flashes the softbox; lasers in the reflections sweep with the kick count.
// =============================================================================

#define NB 8
#define ND 4

vec4 gB[NB];          // blob centre xyz, radius w
vec4 gD[ND];          // droplet centre xyz, radius w
int gN;               // active blob count
float gK, gDk;        // smooth-union radii (blobs, droplets)
float gNz, gTm;       // wobble amount, wobble time
vec3 gRipC;           // kick shockwave origin
float gRipF, gRipA;   // shockwave front radius, amplitude
float gI, gEnvB, gBR;
vec3 gCamF;           // camera forward (ring light is camera-mounted)
vec3 gSoftCol;
float gSoftSz, gLaser;

// ---------------------------------------------------------------------------
// SDF
// ---------------------------------------------------------------------------
float map(vec3 p) {
  float d = length(p - gB[0].xyz) - gB[0].w;
  for (int i = 1; i < NB; i++) {
    if (i >= gN) break;
    d = smin(d, length(p - gB[i].xyz) - gB[i].w, gK);
  }
  for (int j = 0; j < ND; j++) {
    d = smin(d, length(p - gD[j].xyz) - gD[j].w, gDk);
  }
  // liquid wobble (cheap sine "noise")
  vec3 q = p * 2.1;
  float n = sin(q.x + gTm * 1.3) * sin(q.y * 1.1 - gTm) * sin(q.z * .9 + gTm * .8);
  n += .45 * sin(dot(p, vec3(4.1, -3.3, 2.9)) + gTm * 2.1) * sin(dot(p, vec3(-2.7, 3.9, 3.4)) - gTm * 1.7);
  d -= gNz * n;
  // kick shockwave: a wave packet travelling outward from the impact point
  float w = length(p - gRipC) - gRipF;
  d -= gRipA * sin(w * 12.) * exp(-w * w * 7.);
  return d;
}

vec3 calcNormal(vec3 p, float e) {
  vec2 k = vec2(1., -1.);
  return normalize(k.xyy * map(p + k.xyy * e) + k.yyx * map(p + k.yyx * e) +
                   k.yxy * map(p + k.yxy * e) + k.xxx * map(p + k.xxx * e));
}

// ---------------------------------------------------------------------------
// analytic studio environment (what the chrome reflects). fp = angular footprint
// ---------------------------------------------------------------------------
float soft(float sd, float ew) { return clamp(.5 - sd / ew, 0., 1.); }

vec3 env(vec3 r, float fp) {
  float y = r.y;
  float az = atan(r.x, r.z);
  vec3 col = vec3(0.);

  // studio sky: bright palette gradient above the horizon, dark floor below
  float up = max(y, 0.);
  float hzHue = .5 + .5 * sin(az * 1. + gTm * .15);
  vec3 hzCol = mix(cC, cB, hzHue);
  vec3 sky = mix(hzCol * 1.1, cA * .5 + cB * .06, smoothstep(0., .7, up));
  sky += cD * .3 * exp(-abs(mod(az - 2.6 + PI, TAU) - PI) * 1.5) * exp(-up * 3.);
  // big soft coloured light walls (cyclorama panels)
  float w1 = soft(abs(mod(az - .55 + PI, TAU) - PI) - .5, .35) * soft(abs(y - .22) - .2, .18);
  float w2 = soft(abs(mod(az + 1.1 + PI, TAU) - PI) - .35, .3) * soft(abs(y - .3) - .18, .2);
  sky += cC * 1.1 * w1 + cB * .9 * w2;
  col += sky * smoothstep(-.012 - fp, .012 + fp, y);
  float hw = .006 + fp;
  col += mix(hzCol, vec3(1.), .25) * 1.6 * exp(-abs(y - .004) / hw) * .006 / hw;
  // ground: near-black floor, faint stage rings + one bright LED ring around the base
  if (y < 0.) {
    float g = smoothstep(0., -.25, y);
    col += hzCol * .08 * exp(y * 12.);
    vec2 fq = r.xz / max(-y, .03);
    float rr = length(fq);
    float fw = .03 + fp / max(y * y, .002) * 1.2;
    float ring = abs(fract(rr * .5) - .5) * 2.;
    col += cB * .1 * smoothstep(fw * .5 + .05, 0., ring) * exp(-rr * .15) * g;
    float led = abs(rr - 1.9) / (.07 + fw * 2.);
    col += mix(cD, cB, .5 + .5 * sin(atan(fq.y, fq.x) * 2. + gTm * .5)) * 2.2 * exp(-led * led) * (.7 + .6 * aBass) * g;
  }

  // overhead softbox (slowly rotating)
  if (y > .15) {
    vec2 q = r.xz / y;
    q = rot(gTm * .07) * q;
    float sd = sdBox2(q, vec2(1.0, .42) * gSoftSz) - .05;
    float ew = .03 + fp / (y * y) * 1.5;
    float m = soft(sd, ew);
    float grad = .75 + .25 * exp(-dot(q, q) * 1.5);
    col += gSoftCol * m * grad;
    // thin secondary panel
    float sd2 = sdBox2(q - vec2(0., 1.25 * gSoftSz), vec2(1.1, .07) * gSoftSz);
    col += gSoftCol * .6 * soft(sd2, ew);
  }

  // vertical strip lights (key colours)
  float cy = sqrt(max(1. - y * y, .05));
  float ewS = .012 + fp * 1.3 / cy;
  {
    float da = abs(mod(az - 1.95 + PI, TAU) - PI);
    float m = soft(da - .085 * gSoftSz, ewS) * soft(abs(y - .25) - .55, .03 + fp);
    col += cB * 4.2 * m;
  }
  {
    float da = abs(mod(az + 2.05 + PI, TAU) - PI);
    float m = soft(da - .06 * gSoftSz, ewS) * soft(abs(y - .18) - .5, .03 + fp);
    col += cD * 3.6 * m;
  }
  {
    float da = abs(mod(az - PI + PI, TAU) - PI);
    float m = soft(da - .05, ewS) * soft(abs(y - .1) - .32, .03 + fp);
    col += mix(cC, vec3(1.), .4) * 1.6 * m;
  }

  // camera-mounted ring light -> ring catchlights on every blob, pulses with the kick
  {
    float cr = dot(r, -gCamF);
    float a = sqrt(max(2. - 2. * cr, 0.));
    float ew = .012 + fp;
    float m = soft(abs(a - .78) - .025, ew);
    col += mix(vec3(1.), cC, .3) * m * (.25 + 3.5 * aKick * gI);
  }

  // laser lines: great circles sweeping with the kick count
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float a = aKickAcc * .22 + fk * 2.1 + gTm * .05;
    vec3 nk = normalize(vec3(sin(a) , .35 * cos(a * .7 + fk * 1.7), cos(a)));
    nk = normalize(nk + vec3(0., 1.5 * (fk - 1.), 0.) * .5);
    float dl = abs(dot(r, nk));
    float lw = .004;
    float ef = sqrt(lw * lw + fp * fp * .6);
    float ln = exp(-dl * dl / (ef * ef)) * lw / ef;
    vec3 lc = k == 1 ? cD : cB;
    col += lc * ln * gLaser * smoothstep(-.1, .2, y + .1);
  }

  // a few hot point bulbs (tiny sparkly speculars)
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    vec3 dk = normalize(vec3(sin(fk * 2.4 + 1.), .55 + .2 * fk, cos(fk * 2.4 + 1.)));
    float c = 1. - dot(r, dk);
    float sz = .00015 + fp * fp * .5;
    col += mix(cD, vec3(1.), .5) * 2.5 * exp(-c / sz) * .00015 / sz * 6.;
  }

  return col * gEnvB;
}

// background seen directly: void + soft horizon haze + faint lasers (no light panels)
vec3 background(vec3 rd, vec2 uv) {
  float y = rd.y;
  float az = atan(rd.x, rd.z);
  vec3 col = cA * .06;
  vec3 hzCol = mix(cC, cB, .5 + .5 * sin(az + gTm * .15));
  col += hzCol * (exp(-abs(y + .03) / .1) * .05 + exp(-abs(y + .03) / .015) * .04);
  // spotlit backdrop glow behind the hero
  col += mix(cC, cB, .4) * .045 * exp(-dot(uv, uv) * 2.5) * (.7 + .3 * aEnergy);
  // distant laser lines in haze
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float a = aKickAcc * .22 + fk * 2.1 + gTm * .05;
    vec3 nk = normalize(vec3(sin(a), .35 * cos(a * .7 + fk * 1.7), cos(a)));
    nk = normalize(nk + vec3(0., 1.5 * (fk - 1.), 0.) * .5);
    float dl = abs(dot(rd, nk));
    vec3 lc = k == 1 ? cD : cB;
    col += lc * (exp(-dl * dl / .00003) * .35 + exp(-dl / .03) * .025) * gLaser * .25 * smoothstep(-.2, .1, y);
  }
  return col;
}

// soft out-of-focus bokeh discs (screen space, parallax with the orbit)
vec3 bokeh(vec2 uv, float camA, float layer) {
  float sc = mix(3.2, 1.8, layer);
  vec2 q = uv * sc + vec2(camA * mix(1.5, 4., layer), iTime * .03 * (1. + layer));
  vec2 id = floor(q), f = fract(q) - .5;
  vec2 h = hash22(id + layer * 31.7 + floor(iSeed * 50.));
  if (h.x > mix(.35, .18, layer)) return vec3(0.);
  vec2 o = (hash22(id * 1.7 + 3.1) - .5) * .5;
  float rad = mix(.09, .2, h.y) * mix(1., .8, layer);
  float d = length(f - o);
  float disk = smoothstep(rad, rad * .88, d);
  disk *= .55 + .45 * smoothstep(rad * .5, rad * .95, d);       // brighter rim (lens bokeh)
  vec3 c = mix(cB, mix(cC, cD, step(.5, fract(h.y * 7.3))), .6);
  return c * disk * mix(.035, .06, layer) * (.6 + .5 * aEnergy);
}

// ---------------------------------------------------------------------------
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - .5 * iResolution) / iResolution.y;
  float I = clamp(iIntensity, 0., 1.);
  gI = I;
  float cx = clamp(iParams.x, 0., 1.);
  float sy = clamp(iParams.y, 0., 1.);
  float rz = clamp(iParams.z, 0., 1.);
  float ew = clamp(iParams.w, 0., 1.);

  gEnvB = mix(.75, 1.5, ew) * mix(.6, 1., I);
  gSoftSz = mix(.85, 1.35, ew);
  gLaser = mix(1.5, 5., I) * mix(.8, 1.4, ew);
  gSoftCol = mix(vec3(1.), cC, .3) * 2.4 * (1. + 1.4 * aSnare * I) ;

  // ---- time bases
  float spd = mix(.22, .45, I) * mix(.85, 1.25, cx);
  gTm = iTime * spd + aBassAcc * .06 + iSeed * 40.;
  float bass = .5 * (aBass + aSub);
  float swell = 1. + .09 * bass * mix(.4, 1., I) + .07 * aKick * I;

  // ---- blobs
  gN = 4 + int(floor(cx * 4. + .5));
  float spread = mix(1.05, 1.45, cx) * (1. - .06 * aKick * I);
  float rs = mix(1., .78, cx);
  gK = mix(.5, .42, cx);
  gBR = 0.;
  for (int i = 0; i < NB; i++) {
    float fi = float(i);
    vec3 h = hash33(vec3(fi * 7.13 + 1.7, fi * 3.31 + floor(iSeed * 97.), 2.71));
    vec3 fr = .45 + h * .6;
    vec3 ph = h.zxy * TAU;
    vec3 c = sin(gTm * fr + ph) * vec3(1.25, .75, 1.25) * spread;
    float r = mix(.48, .74, h.x) * rs;
    if (i == 0) { c *= .2; r = .9 * rs; }
    r *= swell;
    gB[i] = vec4(c, r);
    if (i < gN) gBR = max(gBR, length(c) + r);
  }

  // ---- clap droplets: snap out on beats 2 & 4, fly, merge back by the next clap
  float cph = aBarPhase * 2. - .5;
  float cpt = fract(cph);
  float cid = floor(cph) + aBarCount * 2.;
  float dGate = smoothstep(.35, .7, I) * smoothstep(.25, .55, aEnergy);
  float fly = sin(PI * pow(cpt, .55));                     // quick ejection, slower fall-back
  int nD = 3 + int(cx > .5);
  gDk = .38;
  for (int j = 0; j < ND; j++) {
    float fj = float(j);
    vec3 h = hash33(vec3(cid * 1.31 + fj * 5.7, fj + 3.3, floor(iSeed * 61.)));
    vec3 dir = normalize(h * 2. - 1. + vec3(0., .35, 0.));
    vec3 c0 = gB[j % gN].xyz;
    float R0 = gB[j % gN].w;
    float travel = mix(1.1, 2.0, h.x) * mix(.8, 1.15, cx);
    float act = (j < nD) ? dGate : 0.;
    vec3 side = normalize(cross(dir, vec3(.3, 1., .2)));
    vec3 pos = c0 + dir * R0 * .3 + (dir * (R0 * .7 + travel) + side * .35 * sin(PI * cpt)) * fly * act;
    float rd = mix(.16, .27, h.y) * rs * (1. - .25 * cpt);
    gD[j] = vec4(pos, rd);
    gBR = max(gBR, length(pos) + rd);
  }
  gBR += .25;

  // ---- kick shockwave
  float beatT = aBeatPhase * (60. / 122.45);
  vec3 kh = hash33(vec3(aBeatCount * .713, 4.1, floor(iSeed * 37.)));
  gNz = mix(.015, .085, rz) * mix(.6, 1., I);
  gRipA = mix(.03, .075, rz) * pow(aKick, .8) * mix(.4, 1., I);
  gRipF = .15 + beatT * mix(4.5, 6., I);

  // ---- camera: slow orbit, gentle push-in over the shot
  float camA = iSeed * TAU + iTime * mix(.07, .16, I) + aKickAcc * .025;
  float el = .22 + .2 * sin(iTime * .11 + iSeed * 5.3);
  float dist = mix(8.4, 9.6, cx) * (1. - .06 * smoothstep(0., 1., iProgress));
  vec3 cen = vec3(0.);
  for (int i = 0; i < NB; i++) { if (i >= gN) break; cen += gB[i].xyz; }
  cen /= float(gN);
  vec3 ta = cen * .75;
  vec3 ro = ta + vec3(sin(camA) * cos(el), sin(el), cos(camA) * cos(el)) * dist;
  float fl = 1.85;
  vec3 rd = camRay(ro, ta, uv, fl, .05 * sin(iTime * .21 + iSeed * 3.));
  gCamF = normalize(ta - ro);
  vec3 toCam = -gCamF;
  // impact point on the main blob, biased towards the camera so the rings read
  vec3 kd = normalize(mix(normalize(kh * 2. - 1.), toCam, .55));
  gRipC = gB[0].xyz + kd * gB[0].w;

  // ---- raymarch inside the bounding sphere
  float pxA = 1. / (iResolution.y * fl);
  float b = dot(ro, rd);
  float hh = b * b - (dot(ro, ro) - gBR * gBR);   // bounding sphere about the origin
  float t = 0., tMin = 0., minR = 1e9;
  bool hit = false;
  if (hh > 0.) {
    float sq = sqrt(hh);
    t = max(-b - sq, 0.);
    float tEnd = -b + sq;
    for (int i = 0; i < 80; i++) {
      vec3 p = ro + rd * t;
      float d = map(p);
      float rr = d / t;
      if (rr < minR) { minR = rr; tMin = t; }
      if (d < pxA * t * .3) { hit = true; tMin = t; break; }
      t += d * .75;
      if (t > tEnd) break;
    }
  }
  float alpha = hit ? 1. : clamp(1. - minR / (pxA * 1.2), 0., 1.);

  vec3 nrm = vec3(0., 1., 0.), refl = rd, pos = ro;
  if (alpha > 0.) {
    pos = ro + rd * tMin;
    nrm = calcNormal(pos, max(.0015, pxA * tMin * .7));
    refl = reflect(rd, nrm);
  }
  // reflection footprint (derivatives in uniform control flow)
  float fp = clamp(length(fwidth(refl)), 0., .6);

  vec3 bg = background(rd, uv) + bokeh(uv, camA, 0.);
  vec3 col = bg;

  if (alpha > 0.) {
    float ndv = clamp(dot(nrm, -rd), 0., 1.);
    float fres = pow(1. - ndv, 5.);

    // surface tint: chrome .. thin-film oil slick
    float thick = .55 + .3 * sin(dot(pos, vec3(1.7, 2.3, -1.9)) + gTm * .6)
                + .2 * sin(dot(pos, vec3(-3.1, 1.3, 2.2)) - gTm * .9) + .25 * aBass;
    float ph = thick * (1.2 + 1.1 * ndv);
    vec3 rainbow = .5 + .5 * cos(TAU * (ph + vec3(0., .33, .67)));
    vec3 pf = secPal(ph * .7 + .15);
    pf /= max(max(pf.r, max(pf.g, pf.b)), .05);
    vec3 film = mix(rainbow, pf, .55) * 1.15;
    vec3 chromeT = mix(vec3(.9, .92, 1.), mix(vec3(1.), cC * 1.8, .12), .5);
    vec3 F0 = mix(chromeT * .92, film * .75, sy);
    vec3 F = F0 + (vec3(1.) - F0) * fres;

    // reflected ray: other blobs (analytic sphere proxies) or the studio environment
    vec3 rc;
    {
      float tb = 1e9; vec4 hb = vec4(0.);
      for (int i = 0; i < NB; i++) {
        if (i >= gN) break;
        vec3 oc = pos - gB[i].xyz;
        float r2 = gB[i].w * gB[i].w;
        float c2 = dot(oc, oc) - r2 * 1.35;
        if (c2 < 0.) continue;                 // the blob we are standing on
        float bb = dot(oc, refl);
        float h2 = bb * bb - (dot(oc, oc) - r2);
        if (h2 > 0. && bb < 0.) {
          float tt = -bb - sqrt(h2);
          if (tt > 0. && tt < tb) { tb = tt; hb = gB[i]; }
        }
      }
      if (tb < 1e8) {
        vec3 hp = pos + refl * tb;
        vec3 n2 = normalize(hp - hb.xyz);
        vec3 r2v = reflect(refl, n2);
        float f2 = .75 + .25 * pow(1. - clamp(dot(n2, -refl), 0., 1.), 5.);
        rc = env(r2v, fp * 2.5 + .02) * F0 * f2;
      } else {
        rc = env(refl, fp);
      }
    }
    vec3 c = rc * F;

    // cheap AO for the crevices between blobs
    float ao = clamp(map(pos + nrm * .12) / .12, 0., 1.) * .5 + clamp(map(pos + nrm * .35) / .35, 0., 1.) * .5;
    c *= mix(.35, 1., ao);

    // fresnel rim light (back-light from the strip side) for separation from the void
    vec3 rimDir = normalize(vec3(-gCamF.z, .4, gCamF.x));
    float rim = pow(1. - ndv, 4.) * clamp(dot(nrm, rimDir) * .7 + .3, 0., 1.);
    c += mix(cB, cD, .5 + .5 * sin(gTm * .4)) * rim * mix(.3, .8, I) * (1. + aKick * I);
    // snare: droplets / thin necks sparkle a touch
    c += cD * aSnare * I * .25 * pow(1. - ndv, 2.);

    col = mix(bg, c, alpha);
  }

  // near bokeh layer in front (shallow DOF foreground)
  col += bokeh(uv * .8 + .3, camA * 1.6, 1.) * .8;

  fragColor = vec4(max(col, 0.), 1.);
}
