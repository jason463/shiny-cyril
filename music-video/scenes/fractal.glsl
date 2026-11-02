// ============================================================================
// fractal — flythrough of a gigantic glowing fractal cathedral / megastructure
// ----------------------------------------------------------------------------
// iParams (all 0..1, 0,0,0,0 = good default):
//   x : fractal variant   0 = KIFS cathedral, ~0.5 = Mandelbox halls, 1 = Apollonian caverns
//   y : camera path       0 = centred glide, 0.5 = weave + bank, 1 = low worm's-eye + roll
//   z : morph speed       0 = slow breathing, 1 = fast morph of the fold parameters
//   w : glow amount       0 = default glow, 1 = heavy glow fog
// ============================================================================

int   gVar;
float gMorph;
vec4  gTrap;

// smooth seeded camera / nave path (xy offset as a function of z)
vec2 pathXY(float z) {
  float s = iSeed * 37.;
  float amp = mix(.35, 1.4, smoothstep(.2, .6, iParams.y));
  return vec2(sin(z * .085 + s) * 1.3 * amp + sin(z * .031 + s * 1.7) * 1.6 * amp,
              sin(z * .061 + s * 2.3) * .45 * amp);
}

// pointed (gothic) arch tunnel, negative inside the nave
float tunnel(vec3 p) {
  vec2 q = p.xy - pathXY(p.z);
  float w = 1.35, h0 = 1.1, c = .9, R = w + c;
  float t = q.y > h0 ? length(vec2(abs(q.x) + c, q.y - h0)) - R : abs(q.x) - w;
  return max(t, -(q.y + 1.15));
}

// ---- variant 0: KIFS cathedral (Menger-style fold with morphing rotations)
float deKIFS(vec3 p) {
  vec4 tr = vec4(1e3);
  p.z = mod(p.z + 3., 6.) - 3.;
  p.x = mod(p.x + 3., 6.) - 3.;
  p /= 3.;
  float s = 1. / 3.;
  float a1 = .18 * sin(gMorph * .7), a2 = .12 * sin(gMorph * .53 + 1.);
  for (int i = 0; i < 6; i++) {
    p = abs(p);
    if (p.x < p.y) p.xy = p.yx;
    if (p.x < p.z) p.xz = p.zx;
    if (p.y < p.z) p.yz = p.zy;
    p.xy *= rot(a1);
    p.yz *= rot(a2);
    p = p * 3. - vec3(2., 2., 0.);
    if (p.z > 1.) p.z -= 2.;
    s *= 3.;
    tr = min(tr, vec4(abs(p), dot(p, p)));
  }
  gTrap = tr;
  return sdBox(p, vec3(1.)) / s;
}

// ---- variant 1: Mandelbox halls
float deBox(vec3 p) {
  vec4 tr = vec4(1e3);
  p *= .5;
  p.z = mod(p.z + 2., 4.) - 2.;
  vec3 o = p;
  float S = -1.6 + .25 * sin(gMorph * .6);
  float dr = 1.;
  for (int i = 0; i < 9; i++) {
    p = clamp(p, -1., 1.) * 2. - p;
    float r2 = dot(p, p);
    float k = clamp(1. / r2, 1., 4.);
    p *= k; dr *= k;
    p = p * S + o;
    dr = dr * abs(S) + 1.;
    tr = min(tr, vec4(abs(p), r2));
  }
  gTrap = tr;
  return 2. * (length(p) - 1.) / abs(dr);
}

// ---- variant 2: Apollonian caverns
float deApo(vec3 p) {
  vec4 tr = vec4(1e3);
  float W = 1.6;
  p /= W;
  float sc = 1.;
  float s = 1.25 + .08 * sin(gMorph * .5);
  for (int i = 0; i < 8; i++) {
    p = -1. + 2. * fract(.5 * p + .5);
    float r2 = dot(p, p);
    tr = min(tr, vec4(abs(p), r2));
    float k = s / r2;
    p *= k; sc *= k;
  }
  gTrap = tr;
  return W * .25 * abs(p.y) / sc;
}

float map(vec3 p) {
  float d;
  if (gVar == 0) d = deKIFS(p);
  else if (gVar == 1) d = deBox(p);
  else d = deApo(p);
  return max(d, -tunnel(p));
}

vec3 calcNormal(vec3 p, float e) {
  vec2 k = vec2(1., -1.);
  return normalize(k.xyy * map(p + k.xyy * e) + k.yyx * map(p + k.yyx * e) +
                   k.yxy * map(p + k.yxy * e) + k.xxx * map(p + k.xxx * e));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - .5 * iResolution) / iResolution.y;
  gVar = iParams.x < .33 ? 0 : (iParams.x < .67 ? 1 : 2);
  float I = iIntensity;
  gMorph = aBassAcc * mix(.15, .9, iParams.z) + iSeed * 20.;

  // ---- camera
  float spd = mix(.45, 1., I);
  float travel = iTime * .9 * spd + aKickAcc * 4. * spd + iSeed * 300.;
  vec3 ro = vec3(pathXY(travel), travel);
  vec3 ta = vec3(pathXY(travel + 4.), travel + 4.);
  ro.y += .1; ta.y += .25;
  float roll = .0;
  vec3 rd = camRay(ro, ta, uv, 1.1, roll);

  // ---- march
  float t = .05, d = 0.;
  float glow = 0.;
  bool hit = false;
  int steps = 0;
  for (int i = 0; i < 80; i++) {
    vec3 p = ro + rd * t;
    d = map(p);
    glow += exp(-d * 40.) * .03;
    if (d < .0008 * t) { hit = true; break; }
    t += d * .9;
    steps = i;
    if (t > 60.) break;
  }

  vec3 col = vec3(0.);
  vec4 trap = gTrap;
  if (hit) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p, .0005 * t + .0005);
    vec3 lp = vec3(pathXY(travel + 20.), travel + 20.) + vec3(0., .8, 0.);
    vec3 ld = normalize(lp - p);
    float ldist = length(lp - p);
    float dif = max(dot(n, ld), 0.);
    float ao = 1. - float(steps) / 80.;
    vec3 alb = mix(cA * 2. + .02, cC * .4, clamp(trap.w * .5, 0., 1.));
    col = alb * dif * 30. / (1. + ldist * ldist * .2) * ao;
    col += alb * .15 * max(dot(n, -rd), 0.);
    float vein = exp(-trap.y * 60.);
    col += cB * vein * (.5 + 4. * aKick);
  }
  col += cB * glow * .1;
  col *= exp(-t * .04);
  fragColor = vec4(col, 1.);
}
