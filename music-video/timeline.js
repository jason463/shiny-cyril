// =============================================================================
//  EDIT DECISION LIST — "U Weren't Here (Afterglow Remix)"
//  Shots (scene, bars, params), section palettes/intensity, post-FX automation
//  and kinetic typography. Built against the beat grid from analysis.json.
// =============================================================================
window.MV_TIMELINE = function (A, T) {
  'use strict';
  const PAL = window.MV_PALETTES;
  const DB = A.downbeats;
  const BAR = (DB[DB.length - 1] - DB[0]) / (DB.length - 1);
  const END = A.duration;
  // bar index (fractional ok) -> seconds, extrapolates past the analysed grid
  const bar = (k) => {
    if (k < 0) return DB[0] + k * BAR;
    const i = Math.floor(k), fr = k - i;
    const a = i < DB.length ? DB[i] : DB[DB.length - 1] + (i - DB.length + 1) * BAR;
    const b = i + 1 < DB.length ? DB[i + 1] : a + BAR;
    return a + (b - a) * fr;
  };
  const barAt = (t) => {
    if (t < DB[0]) return (t - DB[0]) / BAR;
    let i = 0; while (i + 1 < DB.length && DB[i + 1] <= t) i++;
    const b = i + 1 < DB.length ? DB[i + 1] : DB[i] + BAR;
    return i + (t - DB[i]) / (b - DB[i]);
  };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, x) => a + (b - a) * x;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  // ------------------------------------------------------------------ sections
  const SEC = [
    { name: 'cold', a: 0, b: bar(0), pal: 'afterglow', int: 0.1 },
    { name: 'intro', a: bar(0), b: bar(4), pal: 'afterglow', int: 0.3 },
    { name: 'groove', a: bar(4), b: bar(12), pal: 'afterglow', int: 0.5 },
    { name: 'build', a: bar(12), b: bar(24), pal: 'afterglow', int: 0.6 },
    { name: 'drop1', a: bar(24), b: bar(36), pal: 'afterglow', int: 1.0 },
    { name: 'post', a: bar(36), b: bar(44), pal: 'dream', int: 0.6 },
    { name: 'breakdown', a: bar(44), b: bar(52), pal: 'ice', int: 0.15 },
    { name: 'riser', a: bar(52), b: bar(56), pal: 'noir', int: 0.2 },
    { name: 'drop2a', a: bar(56), b: bar(64), pal: 'acid', int: 1.0 },
    { name: 'drop2b', a: bar(64), b: bar(72), pal: 'afterglow', int: 1.0 },
    { name: 'drop2c', a: bar(72), b: bar(80), pal: 'ember', int: 1.0 },
    { name: 'drop2d', a: bar(80), b: bar(88), pal: 'dream', int: 1.0 },
    { name: 'drop2e', a: bar(88), b: bar(94), pal: 'acid', int: 1.0 },
    { name: 'outro', a: bar(94), b: END + 1, pal: 'afterglow', int: 0.3 },
  ];
  const secAt = (t) => SEC.find((s) => t >= s.a && t < s.b) || SEC[SEC.length - 1];

  // ------------------------------------------------------------------ shots
  const shots = [];
  // S(scene, startBar, endBar, params, opts)  opts: pal, int, trans:[type,dur], flash, mirror, seed
  function S(scene, b0, b1, params, o = {}) {
    const start = typeof b0 === 'string' ? +b0 : bar(b0);
    const end = typeof b1 === 'string' ? +b1 : bar(b1);
    const sec = secAt(start + 0.01);
    shots.push({
      scene, start, end, params: params || [0, 0, 0, 0],
      seed: o.seed != null ? o.seed : hash(shots.length * 3.17 + 0.5),
      intensity: o.int != null ? o.int : sec.int,
      pal: PAL[o.pal || sec.pal],
      transIn: o.trans ? { type: o.trans[0], dur: o.trans[1] } : null,
      flash: o.flash || 0, mirror: o.mirror || 0, tag: o.tag || '',
    });
  }
  const ramp = (a, b) => (t, p) => lerp(a, b, p);

  // COLD OPEN — the figure that isn't there
  S('ghost', '0', 0, (t, p) => [lerp(0.85, 0.35, sstep(0, 0.9, p)), 0.0, 0.35, 0.0], { int: 0.1 });
  // INTRO — first lasers cut through the fog
  S('lasers', 0, 2, [0.0, 0.0, 0.25, 0.85], { int: ramp(0.15, 0.3), trans: [5, 1.2] });
  S('lasers', 2, 4, [0.15, 0.5, 0.55, 0.8], { int: ramp(0.3, 0.42) });
  // GROOVE
  S('tunnel', 4, 8, [0.0, 0.3, 0.45, 0.0], { int: 0.5, flash: 0.5 });
  S('lasers', 8, 10, [0.6, 0.5, 0.2, 0.6], { int: 0.55, trans: [3, 0.18] });
  S('lasers', 10, 12, [0.75, 0.0, 0.85, 0.7], { int: 0.6 });
  // BUILD — accelerating cuts
  S('city', 12, 16, [0.0, 0.55, 0.6, 0.35], { int: ramp(0.5, 0.62), trans: [4, 0.45] });
  S('kaleido', 16, 18, [0.25, 0.35, 0.6, 0.0], { int: 0.62, trans: [6, 0.3] });
  S('tunnel', 18, 20, [0.5, 0.6, 0.6, 1.0], { int: 0.7, flash: 0.35 });
  S('fractal', 20, 21, [0.0, 0.25, 0.3, 0.55], { int: 0.72, flash: 0.3 });
  S('city', 21, 22, [1.0, 0.7, 0.2, 0.7], { int: 0.76, flash: 0.3 });
  S('lasers', 22, 22.5, [0.8, 1.0, 0.6, 0.6], { int: 0.8, flash: 0.3 });
  S('kaleido', 22.5, 23, [0.6, 0.6, 0.7, 1.0], { int: 0.82, flash: 0.3 });
  S('tunnel', 23, 23.25, [1.0, 0.8, 0.8, 0.0], { int: 0.85, flash: 0.25 });
  S('fractal', 23.25, 23.5, [0.5, 0.6, 0.6, 0.8], { int: 0.85, flash: 0.25 });
  S('ghost', 23.5, 23.75, [0.5, 1.0, 0.2, 1.0], { int: 0.9, flash: 0.25 });
  S('vortex', 23.75, 24, (t, p) => [0.8, 0.8, 0.6, p], { int: 0.9 });
  // DROP 1
  S('fractal', 24, 28, [0.0, 0.0, 0.5, 0.85], { flash: 1.0, tag: 'drop' });
  S('lasers', 28, 30, [1.0, 0.5, 0.6, 0.7], { flash: 0.6 });
  S('tunnel', 30, 32, [0.5, 0.85, 0.7, 0.0], { flash: 0.6, pal: 'acid' });
  S('chrome', 32, 34, [0.5, 0.3, 0.6, 0.8], { flash: 0.5 });
  S('fractal', 34, 35, [0.5, 0.6, 0.5, 1.0], { flash: 0.5, pal: 'acid' });
  S('kaleido', 35, 36, [1.0, 0.6, 0.85, 1.0], { flash: 0.5, mirror: 2 });
  // POST-DROP cooldown
  S('grid', 36, 40, [0.6, 1.0, 0.45, 0.0], { int: 0.6, trans: [4, 0.5] });
  S('vortex', 40, 44, [0.35, 0.6, 0.7, 0.0], { int: ramp(0.55, 0.35), trans: [1, 1.2] });
  // BREAKDOWN — U WEREN'T HERE
  S('ghost', 44, 48, (t, p) => [lerp(0.1, 0.3, p), 0.5, 0.7, 0.0], { int: 0.15, trans: [5, 1.5] });
  S('ghost', 48, 50, (t, p) => [lerp(0.25, 0.45, p), 1.0, 0.5, 0.0], { int: 0.18, trans: [1, 1.0] });
  S('ghost', 50, 52, (t, p) => [lerp(0.35, 0.6, p), 0.0, 0.6, 1.0], { int: 0.2, trans: [1, 1.0] });
  // RISER — collapse
  S('vortex', 52, 55.5, (t, p) => [lerp(0.2, 1.0, p), 0.6, 0.85, sstep(0.15, 1.0, p)], { int: ramp(0.05, 0.6), trans: [7, 1.0] });
  // (55.5 -> 56: black, only text)
  // DROP 2 / A — acid
  S('fractal', 56, 58, [1.0, 0.3, 0.6, 1.0], { flash: 1.0, tag: 'drop' });
  S('lasers', 58, 60, [1.0, 1.0, 0.85, 0.8], { flash: 0.6 });
  S('fractal', 60, 62, [0.0, 0.7, 0.8, 0.9], { flash: 0.6 });
  S('kaleido', 62, 63, [0.8, 0.8, 0.8, 1.0], { flash: 0.5, mirror: 3 });
  S('lasers', 63, 64, [0.6, 0.0, 0.5, 0.5], { flash: 0.5 });
  // DROP 2 / B — afterglow city + tunnel
  S('city', 64, 66, [0.0, 0.8, 0.5, 1.0], { flash: 0.8, trans: [3, 0.15] });
  S('tunnel', 66, 68, [1.0, 0.4, 0.8, 1.0], { flash: 0.5 });
  S('city', 68, 70, [1.0, 0.6, 0.0, 0.8], { flash: 0.5 });
  S('tunnel', 70, 71, [0.0, 1.0, 0.5, 0.0], { flash: 0.5 });
  S('ghost', 71, 72, [0.6, 0.5, 0.3, 1.0], { flash: 0.5 });
  // DROP 2 / C — ember chrome
  S('chrome', 72, 74, [0.8, 1.0, 0.8, 1.0], { flash: 0.8, trans: [4, 0.4] });
  S('kaleido', 74, 76, [0.5, 0.5, 0.9, 0.0], { flash: 0.5 });
  S('chrome', 76, 78, [0.3, 0.0, 0.5, 0.6], { flash: 0.5 });
  S('fractal', 78, 80, [0.5, 0.2, 0.7, 1.0], { flash: 0.5 });
  // DROP 2 / D — dream drive
  S('grid', 80, 84, [1.0, 1.0, 1.0, 1.0], { flash: 0.8, trans: [6, 0.3] });
  S('lasers', 84, 86, [1.0, 0.5, 1.0, 0.9], { flash: 0.5 });
  S('vortex', 86, 88, [1.0, 1.0, 0.6, 0.0], { flash: 0.5 });
  // DROP 2 / E — peak montage
  S('fractal', 88, 89, [0.0, 0.9, 1.0, 1.0], { flash: 0.9 });
  S('lasers', 89, 90, [1.0, 1.0, 1.0, 1.0], { flash: 0.5, mirror: 1 });
  S('tunnel', 90, 90.5, [0.5, 1.0, 1.0, 0.0], { flash: 0.4 });
  S('city', 90.5, 91, [0.0, 1.0, 0.3, 1.0], { flash: 0.4 });
  S('kaleido', 91, 91.5, [1.0, 1.0, 1.0, 1.0], { flash: 0.4, mirror: 2 });
  S('chrome', 91.5, 92, [1.0, 1.0, 1.0, 1.0], { flash: 0.4 });
  const peak = ['fractal', 'grid', 'lasers', 'vortex', 'kaleido', 'tunnel', 'ghost', 'lasers'];
  const peakP = [[1, 0.5, 1, 1], [1, 1, 1, 0], [1, 0, 1, 1], [1, 1, 1, 0.3], [1, 1, 1, 1], [1, 1, 1, 1], [0.7, 1, 0.3, 1], [1, 1, 0, 1]];
  peak.forEach((sc, i) => S(sc, 92 + i * 0.25, 92 + (i + 1) * 0.25, peakP[i], { flash: 0.3, mirror: i % 3 === 1 ? 1 : 0 }));
  // OUTRO — afterglow
  S('lasers', 94, 99, [0.35, 0.0, 0.3, 0.9], { int: ramp(0.45, 0.15), flash: 0.9, trans: [2, 0.25] });
  S('ghost', 99, String(END + 0.5), (t, p) => [lerp(0.3, 1.0, sstep(0.1, 0.95, p)), 0.5, 0.5, 0.0], { int: ramp(0.2, 0.05), pal: 'dream', trans: [5, 1.5] });

  // ------------------------------------------------------------------ text
  const TXT = [];
  const E = (t0, t1, type, o) => TXT.push(Object.assign({ t0, t1, type }, o));
  // cold open titles
  E(1.0, 7.9, 'title', { lines: [
    { text: 'CULT MEMBER', font: 'black', size: 0.13, y: 0.40, at: 1.0 },
    { text: "U WEREN'T HERE", font: 'display', weight: 900, size: 0.085, y: 0.56, at: 3.2, spacing: 0.25 },
    { text: '— AFTERGLOW REMIX —', font: 'mono', weight: 400, size: 0.028, y: 0.65, at: 5.0, spacing: 0.6 },
  ], style: { mode: 2, color: [1.6, 1.4, 2.4], glow: 0.9, glitch: 0.05 } });
  // pre-drop slam (last beat of build)
  E(bar(23.75), bar(24), 'slam', { text: 'NOW', size: 0.5, style: { mode: 1, color: [1, 1, 1], glow: 0.3, glitch: 0.4 } });
  // breakdown
  E(bar(44.5), bar(47.6), 'scramble', { text: "U WEREN'T HERE", size: 0.075, y: 0.5, style: { mode: 2, color: [1.2, 1.5, 2.0], glow: 1.0, glitch: 0.1 } });
  E(bar(48.25), bar(51.6), 'scramble', { text: 'I REALLY MISS YOU', size: 0.07, y: 0.5, style: { mode: 2, color: [1.6, 1.4, 2.2], glow: 1.0, glitch: 0.1 } });
  // riser — countdown/blackout
  E(bar(54), bar(55.5), 'wall', { text: "U WEREN'T HERE", size: 0.11, style: { mode: 1, color: [1, 1, 1], glow: 0.2, glitch: 0.35 } });
  E(bar(55.5), bar(56), 'slam', { text: "U WEREN'T HERE", size: 0.16, style: { mode: 0, color: [3, 3, 3], glow: 0.8, glitch: 0.6 } });
  // drop 2 hits
  E(bar(64), bar(64.5), 'slam', { text: 'MISS YOU', size: 0.3, style: { mode: 1, color: [1, 1, 1], glow: 0.2, glitch: 0.3 } });
  E(bar(80), bar(80.5), 'slam', { text: 'AFTERGLOW', size: 0.22, style: { mode: 1, color: [1, 1, 1], glow: 0.2, glitch: 0.3 } });
  E(bar(88), bar(88.5), 'slam', { text: "U WEREN'T HERE", size: 0.16, style: { mode: 1, color: [1, 1, 1], glow: 0.2, glitch: 0.4 } });
  // outro credits
  E(bar(99.5), END - 0.3, 'title', { lines: [
    { text: "U WEREN'T HERE", font: 'display', weight: 900, size: 0.07, y: 0.47, at: bar(99.5), spacing: 0.3 },
    { text: 'CULT MEMBER · AFTERGLOW REMIX', font: 'mono', weight: 400, size: 0.026, y: 0.56, at: bar(100.5), spacing: 0.5 },
  ], style: { mode: 2, color: [1.4, 1.2, 2.0], glow: 1.0, glitch: 0.03 } });

  const activeText = (t) => TXT.filter((e) => t >= e.t0 && t < e.t1);

  function fontOf(name, weight) {
    if (name === 'black') return [T.FONTS.black, 400];
    if (name === 'mono') return [T.FONTS.mono, weight || 400];
    return [T.FONTS.display, weight || 900];
  }

  function drawTitle(ctx, e, t, W, H) {
    for (const L of e.lines) {
      const at = L.at != null ? L.at : e.t0;
      if (t < at) continue;
      const fin = sstep(at, at + 1.2, t), fout = 1 - sstep(e.t1 - 0.6, e.t1, t);
      let a = fin * fout;
      if (t > e.t1 - 0.6) a *= hash(Math.floor(t * 30) + L.y * 100) > 0.35 ? 1 : 0.15; // glitch-out flicker
      const [fam, wt] = fontOf(L.font, L.weight);
      const size = L.size * H;
      T.setFont(ctx, size, fam, wt, (L.spacing || 0) * size * (1 + (1 - fin) * 1.5));
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillText(L.text, W / 2, (L.y + (1 - fin) * 0.01) * H);
    }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  function drawSlam(ctx, e, t, W, H, au) {
    const p = clamp((t - e.t0) / 0.18, 0, 1);
    const [fam, wt] = fontOf(e.font || 'display', 900);
    let size = Math.min(e.size * H * 2.2, T.fitSize(ctx, e.text, fam, wt, W * 0.9, e.size * H * 2.2));
    size *= 1 + 0.35 * (1 - T.ease.outExpo(p)) + au.aKick * 0.05;
    T.setFont(ctx, size, fam, wt, size * 0.02);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const jx = (hash(Math.floor(t * 30)) - 0.5) * 6, jy = (hash(Math.floor(t * 30) + 9) - 0.5) * 6;
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.fillText(e.text, W / 2 + jx, H * (e.y || 0.5) + jy);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  function drawScramble(ctx, e, t, W, H) {
    const dur = e.t1 - e.t0;
    const p = clamp((t - e.t0) / Math.min(1.6, dur * 0.4), 0, 1);
    const fout = 1 - sstep(e.t1 - 0.5, e.t1, t);
    const txt = T.scramble(e.text, p, Math.floor(e.t0 * 10));
    const size = e.size * H;
    T.setFont(ctx, size, T.FONTS.mono, 700, size * 0.35);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(255,255,255,${fout})`;
    ctx.fillText(txt, W / 2, H * (e.y || 0.5));
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  function drawWall(ctx, e, t, W, H) {
    const size = e.size * H;
    T.setFont(ctx, size, T.FONTS.display, 900, size * 0.05);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const unit = e.text + '   ';
    const uw = ctx.measureText(unit).width;
    const rows = Math.ceil(H / (size * 1.05)) + 1;
    const fin = sstep(e.t0, e.t0 + 0.3, t);
    ctx.lineWidth = Math.max(1.5, size * 0.03);
    for (let r = 0; r < rows; r++) {
      const dir = r % 2 ? 1 : -1;
      const off = ((t - e.t0) * (180 + r * 37) * dir) % uw;
      const y = (r + 0.5) * size * 1.05;
      ctx.strokeStyle = `rgba(255,255,255,${0.9 * fin})`;
      ctx.fillStyle = `rgba(255,255,255,${0.9 * fin})`;
      for (let x = -uw + off; x < W + uw; x += uw) {
        if ((r + Math.floor(t * 2.04)) % 3 === 0) ctx.fillText(unit, x, y); else ctx.strokeText(unit, x, y);
      }
    }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  function drawWords(ctx, e, t, W, H) {
    // karaoke: words revealed at their timestamps, current word pops
    const vis = e.words.filter((w) => t >= w.s - 0.05);
    if (!vis.length) return false;
    const size = e.size * H;
    T.setFont(ctx, size, T.FONTS.display, 900, size * 0.04);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const full = e.words.map((w) => w.w.toUpperCase()).join(' ');
    const totalW = ctx.measureText(full).width;
    let x = (W - totalW) / 2;
    const fout = 1 - sstep(e.t1 - 0.4, e.t1, t);
    for (const w of e.words) {
      const word = w.w.toUpperCase();
      const ww = ctx.measureText(word + ' ').width;
      if (t >= w.s - 0.05) {
        const p = clamp((t - w.s + 0.05) / 0.15, 0, 1);
        const cur = t < w.e + 0.1;
        ctx.save();
        ctx.translate(x + ww / 2, H * (e.y || 0.5));
        const sc = 1 + 0.25 * (1 - T.ease.outBack(p));
        ctx.scale(sc, sc);
        ctx.fillStyle = `rgba(255,255,255,${(cur ? 1 : 0.55) * fout * p})`;
        ctx.fillText(word, -ww / 2, 0);
        ctx.restore();
      }
      x += ww;
    }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    return true;
  }

  function text(ctx, t, f, au, W, H) {
    const act = activeText(t);
    let drew = false;
    for (const e of act) {
      if (e.type === 'title') drawTitle(ctx, e, t, W, H);
      else if (e.type === 'slam') drawSlam(ctx, e, t, W, H, au);
      else if (e.type === 'scramble') drawScramble(ctx, e, t, W, H);
      else if (e.type === 'wall') drawWall(ctx, e, t, W, H);
      else if (e.type === 'words') { if (!drawWords(ctx, e, t, W, H)) continue; }
      drew = true;
    }
    return drew;
  }

  // ------------------------------------------------------------------ post FX automation
  function fx(t, f, au, shot) {
    const s = secAt(t);
    const k = au.aKick, sn = au.aSnare, hh = au.aHat;
    const bi = Math.floor(au.aBeatCount);
    const dir = [hash(bi * 1.7) - 0.5, hash(bi * 2.3 + 1) - 0.5];
    const o = {};
    const since = shot ? t - shot.start : 99;
    const flash = shot && shot.flash ? shot.flash * Math.exp(-Math.max(0, since) * 14) * (since >= 0 ? 1 : 0) : 0;
    o.uMirror = shot && shot.mirror ? shot.mirror : 0;
    switch (s.name) {
      case 'cold': {
        o.uExposure = sstep(0.0, 2.5, t) * (0.85 + 0.15 * au.aRms);
        o.uGrain = 0.12; o.uVignette = 0.65; o.uScan = 0.25; o.uAfter = 0.55; o.uBloom = 1.1;
        o.uChroma = 0.003; o.uGlitch = t > 7.6 ? 0.5 : 0;
        break;
      }
      case 'intro':
        o.uZoom = k * 0.015; o.uChroma = 0.002; o.uAfter = 0.35; o.uGrain = 0.08; o.uVignette = 0.5;
        break;
      case 'groove':
        o.uZoom = k * 0.025; o.uChroma = 0.002 + sn * 0.004; o.uAfter = 0.25;
        break;
      case 'build': {
        const p = (t - s.a) / (s.b - s.a);
        o.uZoom = k * lerp(0.02, 0.05, p); o.uChroma = 0.002 + sn * lerp(0.004, 0.012, p);
        o.uShake = [dir[0] * sn * 0.012 * p, dir[1] * sn * 0.012 * p];
        const phraseEnd = (barAt(t) - 12) % 4 > 3.5;
        o.uGlitch = phraseEnd ? 0.25 : 0;
        if (t > bar(23)) { o.uGlitch = 0.35 + 0.4 * sstep(bar(23), bar(24), t); o.uChroma = 0.01 + 0.02 * sstep(bar(23), bar(24), t); }
        o.uAfter = 0.2;
        break;
      }
      case 'drop1': case 'drop2a': case 'drop2b': case 'drop2c': case 'drop2d': case 'drop2e': {
        const big = s.name === 'drop2e' ? 1.3 : 1.0;
        o.uZoom = k * 0.06 * big; o.uChroma = 0.003 + sn * 0.014 * big;
        o.uShake = [dir[0] * sn * 0.02 * big, dir[1] * sn * 0.02 * big];
        o.uBloom = 1.05; o.uAfter = 0.3; o.uContrast = 1.1; o.uSat = 1.1;
        o.uRoll = (hash(Math.floor(barAt(t))) - 0.5) * 0.06 * big;
        // strobe on claps during the second half of each 8-bar phrase (max 2 flashes/s)
        const ph = (barAt(t) - (s.name === 'drop1' ? 24 : 56)) % 8;
        if (ph >= 6) o.uFlash = sn * 0.35 * big;
        if (s.name === 'drop2e' && barAt(t) >= 92) { o.uInvert = sn > 0.6 ? 0.8 : 0; o.uGlitch = 0.15; }
        break;
      }
      case 'post':
        o.uZoom = k * 0.02; o.uChroma = 0.002; o.uAfter = 0.45; o.uBloom = 1.0;
        break;
      case 'breakdown':
        o.uLetterbox = 0.24; o.uGrain = 0.1; o.uAfter = 0.6; o.uBloom = 1.25; o.uSat = 0.85; o.uScan = 0.12; o.uVignette = 0.55;
        o.uChroma = 0.002 + au.aHigh * 0.003;
        break;
      case 'riser': {
        const p = (t - s.a) / (s.b - s.a);
        o.uLetterbox = 0.24 * (1 - sstep(0.0, 0.25, p)); o.uGrain = 0.1 + 0.1 * p;
        o.uGlitch = 0.05 + 0.5 * p * p; o.uChroma = 0.002 + 0.03 * p * p;
        o.uShake = [dir[0] * 0.01 * p * p * (0.5 + hh), dir[1] * 0.01 * p * p * (0.5 + hh)];
        o.uAfter = 0.5; o.uZoom = 0.05 * p * p;
        if (t >= bar(55.5)) o.uAfter = 0;
        break;
      }
      case 'outro': {
        const p = clamp((t - s.a) / (END - s.a), 0, 1);
        o.uZoom = k * 0.02 * (1 - p); o.uAfter = 0.5; o.uGrain = 0.08 + 0.06 * p; o.uVignette = 0.4 + 0.4 * p;
        o.uExposure = 1 - sstep(END - 3.5, END - 0.2, t);
        break;
      }
    }
    o.uFlash = Math.max(o.uFlash || 0, flash);
    // text style from the top-most active text event
    const act = activeText(t);
    if (act.length) {
      const st = act[act.length - 1].style || {};
      o.uTextMode = st.mode || 0; o.uTextColor = st.color || [1, 1, 1]; o.uTextGlow = st.glow != null ? st.glow : 0.6;
      o.uTextGlitch = (st.glitch || 0) + (s.name.startsWith('drop') ? sn * 0.3 : 0);
    }
    return o;
  }

  return { shots, fx, text, sections: SEC, bar, barAt };
};
