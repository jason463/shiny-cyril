// THE STAGE — everything the scenes share: drawing helpers, the camera, the acting system that turns
// script directions (emotion, gesture, who is speaking) into poses, and the non-human cast
// (FRIJ the fridge, the toaster, Mr. Biscuit's extras). Pure functions of t.
(function () {
  const U = globalThis.U, G = globalThis.G, Ch = globalThis.Ch, S = globalThis.SCORE, Subs = globalThis.Subs;
  const TL = S.TL, ev = S.ev;
  const { clamp, lerp, ease } = U;
  const W = G.W, H = G.H;
  const INK = '#2A2320';
  const PF = (globalThis.PF = { INK, W, H });

  // clean TV-cartoon look: ink outlines and flat colour, no hatching, no line boil, no paper grain
  PF.look = () => G.setStyle('paper', { amp: 0, second: false, hatch: false, textBoil: 0, post: { paper: 0, grain: 0, vignette: 0.1 } });
  PF.look();

  // ---------- drawing helpers (crisp shapes with an ink outline) ----------
  const paint = (ctx, o) => {
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
    const lw = o.lw ?? 5;
    if (lw > 0 && o.stroke !== null) { ctx.lineWidth = lw; ctx.strokeStyle = o.stroke || INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
  };
  const box = (PF.box = (ctx, x, y, w, h, o = {}) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, o.r || 0); paint(ctx, o); });
  const poly = (PF.poly = (ctx, pts, o = {}) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); if (o.closed !== false) ctx.closePath(); paint(ctx, o); });
  const oval = (PF.oval = (ctx, x, y, rx, ry, o = {}) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, o.rot || 0, 0, Math.PI * 2); paint(ctx, o); });
  const line = (PF.line = (ctx, pts, o = {}) => poly(ctx, pts, { closed: false, fill: null, lw: o.lw ?? 5, stroke: o.color || INK }));
  const text = (PF.text = (ctx, str, x, y, o = {}) => G.text(ctx, str, x, y, { fam: 'Bungee', weight: 400, align: 'center', boil: 0, ...o }));
  PF.grad = (ctx, x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([p, c]) => g.addColorStop(p, c)); return g; };

  // ---------- the cast ----------
  const CAST = globalThis.CAST;
  PF.SIZE = { gary: 1.4, denise: 1.28, mabel: 1.2, otis: 0.94, lou: 1.1 };
  const EMO = {
    neutral: { eyes: 'normal', brows: 'neutral', mouth: 'smile' },
    happy: { eyes: 'happy', brows: 'up', mouth: 'grin' },
    angry: { eyes: 'normal', brows: 'determined', mouth: 'flat' },
    worried: { eyes: 'normal', brows: 'worried', mouth: 'wavy', sweat: 0.7 },
    shock: { eyes: 'wide', brows: 'up', mouth: 'o' },
    smug: { eyes: 'normal', brows: 'determined', mouth: 'smirk' },
    deadpan: { eyes: 'normal', brows: 'neutral', mouth: 'flat', lid: 0.5 },
    sad: { eyes: 'normal', brows: 'worried', mouth: 'wavy', lookY: 0.5 },
  };
  // the line that sets the mood at time t in a scene: the latest one that has started
  const lineAt = (PF.lineAt = (t, sc) => { let cur = null; for (const l of TL.lines) { if (l.scene !== sc.id) continue; if (l.t - 0.12 <= t) cur = l; else break; } return cur; });
  PF.find = (start) => { const l = TL.lines.find((q) => q.text.startsWith(start)); if (!l) throw new Error('no line: ' + start); return l; };
  PF.speaking = (who, t) => TL.lines.some((l) => l.who === who && t >= l.t - 0.03 && t <= l.end + 0.05);
  PF.mouth = (who, t) => Subs.mouth(TL, t, who);

  // acting for one character at time t: face, gesture, eye-line, lip-sync, blinks
  PF.act = (name, t, sc, pos) => {
    const cur = lineAt(t, sc);
    const me = cur && cur.who === name, talking = me && t <= cur.end + 0.05;
    let emo = 'neutral';
    if (cur) emo = me ? cur.emo || 'neutral' : (cur.react && cur.react[name]) || 'neutral';
    const e = EMO[emo] || EMO.neutral;
    const o = { eyes: e.eyes, brows: e.brows, mouth: e.mouth, sweat: e.sweat || 0, lookY: e.lookY || 0, blush: emo === 'happy' ? 0.5 : 0 };
    // blinks (not while the eyes are already shut or wide)
    const period = 2.6 + U.hash(name.length, name.charCodeAt(0)) * 1.8, ph = (t + U.hash(name.charCodeAt(1), 7) * 3) % period;
    o.blink = e.eyes === 'normal' ? Math.max(e.lid || 0, ph < 0.13 ? 1 : 0) : 0;
    // look at whoever is speaking
    if (cur && !me && pos && pos[cur.who] && pos[name]) o.look = clamp((pos[cur.who].x - pos[name].x) / 300, -1, 1) * 0.9;
    else if (me && pos && pos.frij && pos[name] && /frij|\+/.test(String(cur.cam || ''))) o.look = 0.6;
    if (talking) {
      o.mouth = PF.mouth(name, t);
      o.headRot = Math.sin(t * 7.3 + name.length) * 0.035;
      o.bob = Math.abs(Math.sin(t * 9)) * 4 * (o.mouth.open || 0);
    }
    if (me && cur.g && t <= cur.end + 0.35) o.gesture = cur.g;
    if (cur && cur.hold && cur.hold[name] && t <= cur.end + 0.2) o.gesture = cur.hold[name];
    if (emo === 'shock' && cur) { const k = clamp((t - cur.t) / 0.25); o.sy = 1 + 0.05 * Math.sin(k * Math.PI); }
    return o;
  };
  // draw a family member. p: { x, y, s, pose, walk, ...overrides }
  PF.person = (ctx, name, t, sc, pos, over = {}) => {
    const p = pos[name];
    if (!p || p.hidden) return;
    const a = PF.act(name, t, sc, pos);
    const s = p.s || PF.SIZE[name];
    const o = { x: p.x, y: (p.y ?? 900) - (a.bob || 0), s, pose: p.pose || 'stand', walk: p.walk || 0, style: p.style || CAST[name], seed: 300 + name.charCodeAt(0) * 7, ...a, ...over };
    if (p.pose === 'walk') { delete o.gesture; }
    Ch.person(ctx, o);
  };
  // walk on from x0 to x1, arriving `dur` seconds after t0
  PF.enter = (t, t0, x0, x1, dur = 0.9, s = 1) => {
    if (t < t0) return { x: x0, hidden: true };
    const u = clamp((t - t0) / dur);
    if (u >= 1) return { x: x1 };
    return { x: lerp(x0, x1, ease.outQuad(u)), pose: 'walk', walk: ((t - t0) * 2.6) % 1 };
  };

  // ---------- the camera ----------
  // a shot is named after what it frames: 'wide', 'gary', 'frij', 'gary+frij', 'cat', 'toaster'
  PF.focus = (name, pos) => {
    const p = pos[name];
    if (!p) return null;
    if (name === 'frij') return { x: p.x, y: p.y - 420, r: 270 };
    if (name === 'cat') return { x: p.x, y: p.y - 95 * (p.s || 1), r: 190 };
    if (name === 'toaster') return { x: p.x, y: p.y - 60, r: 150 };
    if (p.r) return { x: p.x, y: p.y, r: p.r }; // a free-standing camera target
    const s = p.s || PF.SIZE[name] || 1;
    return { x: p.x, y: (p.y ?? 900) - 335 * s, r: 225 * s };
  };
  PF.camFor = (shot, pos) => {
    if (!shot || shot === 'wide') return { cx: W / 2, cy: H / 2, z: 1 };
    const fs = shot.split('+').map((n) => PF.focus(n, pos)).filter(Boolean);
    if (!fs.length) return { cx: W / 2, cy: H / 2, z: 1 };
    const x0 = Math.min(...fs.map((f) => f.x - f.r)), x1 = Math.max(...fs.map((f) => f.x + f.r));
    const y0 = Math.min(...fs.map((f) => f.y - f.r)), y1 = Math.max(...fs.map((f) => f.y + f.r));
    const z = clamp(Math.min(W / (x1 - x0 + 220), H / (y1 - y0 + 70)), 1, 2.1);
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 + 30 / z, z };
  };
  PF.shotAt = (t, sc) => { let s = sc.shots[0]; for (const q of sc.shots) if (q.t <= t) s = q; return s; };
  // the camera transform for scene `sc` at t (hard cuts between shots, a slow push-in inside each)
  PF.camera = (ctx, t, sc, pos) => {
    const sh = PF.shotAt(t, sc);
    const c = PF.camFor(sh.cam, pos);
    const z = c.z * (1 + 0.03 * clamp((t - sh.t) / 6));
    const cx = clamp(c.cx, W / 2 / z, W - W / 2 / z), cy = clamp(c.cy, H / 2 / z, H - H / 2 / z);
    ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-cx, -cy);
    return { cx, cy, z, shot: sh };
  };

  // ---------- FRIJ, the Frost Lord 9000 ----------
  // o: { x, y (floor), on, emo, red (0..1), talk (0..1), open (0..1 door), sheet (0 = covered .. 1 = gone), deny (0..1 flash), paw }
  PF.frij = (ctx, t, o) => {
    const { x, y, on = true, emo = 'neutral', red = 0, talk = 0, open = 0, deny = 0 } = o;
    const w = 340, h = 680, L = x - w / 2, T = y - h;
    ctx.save();
    ctx.fillStyle = 'rgba(20,10,20,0.2)'; ctx.beginPath(); ctx.ellipse(x, y + 4, w * 0.6, 20, 0, 0, Math.PI * 2); ctx.fill();
    const steel = '#CBD5DE', steelD = '#A9B6C2';
    box(ctx, L, T, w, h, { fill: steel, r: 26, lw: 6 });
    box(ctx, L + w - 46, T + 8, 38, h - 16, { fill: steelD, r: 16, lw: 0 }); // side shading
    line(ctx, [[L + 4, T + 190], [L + w - 4, T + 190]], { lw: 5 }); // freezer / fridge split
    // feet
    box(ctx, L + 24, y - 6, 50, 16, { fill: '#4A4A55', r: 5, lw: 4 }); box(ctx, L + w - 74, y - 6, 50, 16, { fill: '#4A4A55', r: 5, lw: 4 });
    if (open > 0.02) {
      // the open door: the inside glows, shelves full of food
      const iw = w - 50, ih = h - 190 - 36, ix = L + 25, iy = T + 190 + 14;
      ctx.save(); ctx.shadowColor = '#FFE38A'; ctx.shadowBlur = 90 * open;
      box(ctx, ix, iy, iw, ih, { fill: '#FFF4C2', r: 12, lw: 5 }); ctx.restore();
      const food = [['#E4572E', 0, 0, 44, 44, 22], ['#F2C94C', 60, 6, 70, 38, 6], ['#7BC96F', 150, -6, 40, 50, 12], ['#F7A8B8', 210, 8, 60, 36, 8],
        ['#F2C94C', 6, 0, 54, 40, 4], ['#B5651D', 80, -4, 44, 44, 22], ['#E0E7EE', 150, -24, 34, 64, 6], ['#E4572E', 204, 0, 70, 40, 8],
        ['#7BC96F', 10, -6, 60, 46, 20], ['#F28C28', 96, 0, 46, 40, 20], ['#F7A8B8', 170, -14, 90, 54, 10]];
      food.forEach(([c, fx, fy, fw, fh, r], i) => { const row = Math.floor(i / 4); const sy = iy + 110 + row * 130; if (i % 4 === 0) line(ctx, [[ix + 6, sy], [ix + iw - 6, sy]], { lw: 4, color: '#C9B36B' }); box(ctx, ix + 12 + fx, sy - fh + fy * 0 - 3, fw, fh, { fill: c, r, lw: 3.5 }); });
      // the door, swung to the left
      const dw = lerp(w, 70, ease.outCubic(open));
      poly(ctx, [[L, T + 196], [L - dw * 0.55, T + 196 + 30 * open], [L - dw * 0.55, y - 8 + 26 * open], [L, y - 8]], { fill: steelD, lw: 6 });
    } else {
      // handles
      box(ctx, L + 22, T + 60, 18, 100, { fill: '#8E9AA6', r: 9, lw: 4 }); box(ctx, L + 22, T + 250, 18, 220, { fill: '#8E9AA6', r: 9, lw: 4 });
      // the screen: FRIJ's face
      const sx = x - 100 + 14, sy = T + 226, sw = 200, sh = 150;
      const glow = on ? (red > 0.5 ? '#FF4D4D' : '#5CE1E6') : null;
      ctx.save(); if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 26; }
      box(ctx, sx, sy, sw, sh, { fill: on ? '#10151F' : '#2B3038', r: 20, lw: 6 }); ctx.restore();
      if (deny > 0.02) {
        ctx.save(); ctx.globalAlpha = deny; box(ctx, sx + 6, sy + 6, sw - 12, sh - 12, { fill: '#C62828', r: 15, lw: 0 });
        line(ctx, [[sx + 70, sy + 45], [sx + 130, sy + 105]], { lw: 14, color: '#FFFFFF' }); line(ctx, [[sx + 130, sy + 45], [sx + 70, sy + 105]], { lw: 14, color: '#FFFFFF' }); ctx.restore();
      } else if (o.paw > 0.02) {
        ctx.save(); ctx.globalAlpha = o.paw; const c = '#7CFFB2', px = sx + sw / 2, py = sy + sh / 2 + 10;
        oval(ctx, px, py + 10, 26, 22, { fill: c, lw: 0 }); for (const [dx, dy] of [[-30, -18], [-11, -34], [11, -34], [30, -18]]) oval(ctx, px + dx, py + dy, 10, 12, { fill: c, lw: 0 }); ctx.restore();
      } else if (on) {
        const c = glow, ex = sx + sw / 2, ey = sy + 56, blink = (t * 0.37 + 0.2) % 1 < 0.035;
        for (const sd of [-1, 1]) {
          const px = ex + sd * 44;
          if (emo === 'happy') line(ctx, [[px - 17, ey + 6], [px, ey - 10], [px + 17, ey + 6]], { lw: 8, color: c });
          else if (blink) line(ctx, [[px - 16, ey], [px + 16, ey]], { lw: 7, color: c });
          else oval(ctx, px, ey, 15, emo === 'smug' ? 9 : 17, { fill: c, lw: 0 });
          // brows
          if (emo === 'angry') line(ctx, [[px - sd * 22, ey - 34], [px + sd * 14, ey - 20]], { lw: 7, color: c });
          if (emo === 'worried') line(ctx, [[px - sd * 22, ey - 22], [px + sd * 14, ey - 34]], { lw: 7, color: c });
          if (emo === 'smug') line(ctx, [[px - 20, ey - 26 - sd * 5], [px + 20, ey - 26 - sd * 5]], { lw: 7, color: c });
        }
        // the mouth: a voice waveform when it talks, a line when it does not
        const my = sy + 110;
        if (talk > 0.04) { for (let i = -5; i <= 5; i++) { const a = (6 + 30 * talk * (0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + t * 23)))) * (1 - Math.abs(i) / 9); line(ctx, [[ex + i * 13, my - a], [ex + i * 13, my + a]], { lw: 7, color: c }); } }
        else if (emo === 'happy' || emo === 'smug') line(ctx, [[ex - 36, my - 6], [ex - 12, my + 8], [ex + 12, my + 8], [ex + 36, my - 6]], { lw: 7, color: c });
        else if (emo === 'angry' || emo === 'worried') line(ctx, [[ex - 34, my + 8], [ex - 12, my - 4], [ex + 12, my - 4], [ex + 34, my + 8]], { lw: 7, color: c });
        else line(ctx, [[ex - 34, my], [ex + 34, my]], { lw: 7, color: c });
      }
      G.decor(() => text(ctx, 'FROST LORD 9000', sx + sw / 2, sy + sh + 30, { size: 17, color: '#5A6672' }));
      // the dispenser
      box(ctx, sx + 40, sy + sh + 46, 120, 96, { fill: '#7E8A96', r: 12, lw: 5 }); box(ctx, sx + 78, sy + sh + 46, 44, 26, { fill: '#4A4A55', r: 6, lw: 3 });
    }
    // the status light on the freezer door
    oval(ctx, L + w - 70, T + 60, 10, 10, { fill: !on ? '#59626B' : red > 0.5 ? '#FF4D4D' : '#7CFFB2', lw: 3 });
    ctx.restore();
  };
  // the dust sheet over the fridge in the cold open (u: 0 on .. 1 flown away)
  PF.sheet = (ctx, t, x, y, u) => {
    if (u >= 1) return;
    const k = u; // the caller eases it: fastest in the first frame, so the reveal lands on its sting
    ctx.save();
    ctx.translate(x + k * 520, y - 360 - k * 900); ctx.rotate(k * 1.3); ctx.globalAlpha = 1 - clamp((u - 0.7) / 0.3);
    const sh = u <= 0 ? Math.sin(t * 30) * 2 * clamp((t - (ev.reveal - 0.45)) / 0.4) : 0;
    poly(ctx, [[-200 + sh, -370], [200 + sh, -370], [232, -150], [222, 120], [250, 372], [150, 356], [60, 374], [-40, 354], [-140, 374], [-246, 360], [-224, 100], [-236, -140]], { fill: '#EDE7DA', lw: 6 });
    for (const dx of [-120, -20, 90]) line(ctx, [[dx, -330], [dx - 14, -60], [dx + 6, 300]], { lw: 3.5, color: '#C9C0AE' });
    ctx.restore();
  };
  // the smart toaster: wakes at ev.pop
  PF.toaster = (ctx, t, x, y, awake, talk) => {
    ctx.save();
    const up = awake ? ease.outBack(clamp((t - ev.pop) / 0.25), 2.2) : 0;
    for (const dx of [-34, 34]) box(ctx, x + dx - 24, y - 150 - up * 46 + 46, 48, 80, { fill: '#D9A45B', r: 8, lw: 4 }); // toast
    box(ctx, x - 95, y - 110, 190, 110, { fill: '#E4572E', r: 22, lw: 5.5 });
    box(ctx, x - 80, y - 110, 160, 16, { fill: '#8C2F17', r: 6, lw: 3 });
    box(ctx, x + 95, y - 86, 14, 34, { fill: '#4A4A55', r: 4, lw: 3 });
    const c = awake ? '#FFE066' : '#7A2A14';
    ctx.save(); if (awake) { ctx.shadowColor = '#FFE066'; ctx.shadowBlur = 18; }
    for (const sd of [-1, 1]) { oval(ctx, x + sd * 36, y - 62, 11, awake ? 13 : 3, { fill: c, lw: 0 }); if (awake) line(ctx, [[x + sd * 54, y - 88], [x + sd * 22, y - 78]], { lw: 5, color: c }); }
    if (talk > 0.04) for (let i = -3; i <= 3; i++) { const a = 3 + 14 * talk * (0.4 + 0.6 * Math.abs(Math.sin(i * 1.9 + t * 25))); line(ctx, [[x + i * 10, y - 30 - a], [x + i * 10, y - 30 + a]], { lw: 5, color: c }); }
    else line(ctx, [[x - 26, y - 30], [x + 26, y - 30]], { lw: 5, color: c });
    ctx.restore();
    for (const dx of [-70, 70]) box(ctx, x + dx - 12, y - 4, 24, 10, { fill: '#4A4A55', r: 3, lw: 3 });
    ctx.restore();
  };
  // Mr. Biscuit: the engine's cat, orange, optionally crowned
  PF.cat = (ctx, t, p, o = {}) => {
    Ch.cat(ctx, { x: p.x, y: p.y, s: p.s || 1, color: '#E8943A', t, look: o.look || 0, happy: o.happy ?? 0.3, seed: 740 });
    if (o.crown) { const s = p.s || 1, cx = p.x, cy = p.y - 172 * s; poly(ctx, [[cx - 30 * s, cy], [cx - 36 * s, cy - 34 * s], [cx - 16 * s, cy - 16 * s], [cx, cy - 42 * s], [cx + 16 * s, cy - 16 * s], [cx + 36 * s, cy - 34 * s], [cx + 30 * s, cy]], { fill: '#F2C94C', lw: 4 }); oval(ctx, cx, cy - 10 * s, 5 * s, 5 * s, { fill: '#E4572E', lw: 2 }); }
  };
  // a thought, in a cloud
  PF.thought = (ctx, str, x, y, u) => {
    if (u <= 0) return;
    const k = ease.outBack(clamp(u / 0.3), 2);
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    const w = G.measure(ctx, str, 54, 'Patrick Hand', 400) + 90;
    box(ctx, -w / 2, -52, w, 104, { fill: '#FFFFFF', r: 52, lw: 5 });
    oval(ctx, -w / 2 + 34, 74, 16, 13, { fill: '#FFFFFF', lw: 4 }); oval(ctx, -w / 2 + 8, 104, 9, 8, { fill: '#FFFFFF', lw: 4 });
    G.text(ctx, str, 0, 18, { size: 54, fam: 'Patrick Hand', weight: 400, align: 'center', color: INK, boil: 0 });
    ctx.restore();
  };
  // a lower-third caption for the establishing shots
  PF.slug = (ctx, str, t, t0) => {
    const u = clamp((t - t0) / 0.3);
    if (u <= 0) return;
    const w = G.measure(ctx, str, 44, 'Bungee', 400) + 70, x = 110 - (1 - ease.outCubic(u)) * 700, y = 860;
    box(ctx, x, y, w, 78, { fill: '#F2C94C', r: 10, lw: 6 });
    text(ctx, str, x + w / 2, y + 55, { size: 44, color: INK });
  };
})();
