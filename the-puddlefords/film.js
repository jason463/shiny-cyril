// THE FILM — "The Puddlefords: Cold War". One director function per scene; each draws frame t as a
// pure function of t, reading every time from score.js / timeline.js (so sound and picture agree).
(function () {
  const U = globalThis.U, G = globalThis.G, Ch = globalThis.Ch, S = globalThis.SCORE, Studio = globalThis.Studio, Subs = globalThis.Subs, PF = globalThis.PF;
  const { TL, ev } = S, SETS = PF.SETS, CAST = globalThis.CAST;
  const { clamp, lerp, ease, pulse } = U;
  const { box, poly, oval, line, text, INK, W, H } = PF;
  const SUBS = Subs.fromVoice(TL, { maxWords: 9, hold: 0.3 });
  for (const s of SUBS) { const sc = TL.scenes.find((q) => s.t >= q.t0 && s.t < q.t1); if (sc) s.end = Math.min(s.end, sc.t1 - 0.2); }
  const FLOOR = 900; // where the family stands
  const FRIJ = { x: 1500, y: 800 };
  const PERCH = { x: 900, y: 142, s: 0.8 }; // Mr. Biscuit's spot: on top of the cabinets, above everyone
  const LINEUP = { lou: 190, mabel: 430, denise: 680, otis: 900, gary: 1150 };
  const lineup = (xs = LINEUP) => Object.fromEntries(Object.entries(xs).map(([k, x]) => [k, typeof x === 'number' ? { x } : x]));
  const F = (start) => PF.find(start);

  // FRIJ's face at time t: its own line's emotion, held until it speaks again
  function frijState(t, sc) {
    let emo = 'neutral';
    for (const l of TL.lines) if (l.scene === sc.id && l.who === 'frij' && l.t - 0.1 <= t) emo = l.emo || 'neutral';
    const m = PF.mouth('frij', t);
    return { emo, talk: m.talking ? m.open : 0 };
  }

  // ---------- the kitchen, with whoever is in it ----------
  // o: { tod, red, pos, frij: {...}, counter(ctx), behind(ctx), front(ctx), over: { name: overrides }, catOn: 'counter' | false, shake }
  function kitchen(ctx, t, sc, o) {
    const pos = { frij: FRIJ, cat: { ...PERCH }, toaster: { x: 720, y: 536 }, ...o.pos };
    ctx.save();
    if (o.shake) ctx.translate(U.noise1(t * 60, 1) * o.shake, U.noise1(t * 60, 2) * o.shake);
    PF.camera(ctx, t, sc, pos);
    SETS.kitchen(ctx, t, { tod: o.tod });
    if (o.counter) o.counter(ctx, pos);
    if (o.cat !== false && !o.catFront) PF.cat(ctx, t, pos.cat, o.catLook || {});
    if (o.behind) o.behind(ctx, pos);
    PF.frij(ctx, t, { ...FRIJ, ...frijState(t, sc), red: o.red || 0, ...(o.frij || {}) });
    if (o.mid) o.mid(ctx, pos);
    for (const name of Object.keys(pos).filter((n) => CAST[n]).sort((a, b) => (pos[a].y ?? FLOOR) - (pos[b].y ?? FLOOR) || pos[a].x - pos[b].x)) PF.person(ctx, name, t, sc, pos, (o.over && o.over[name]) || {});
    if (o.front) o.front(ctx, pos);
    SETS.redWash(ctx, t, o.red || 0);
    ctx.restore();
  }

  const SC = {};

  SC.cold = (ctx, t, sc) => {
    const u = clamp((t - ev.reveal) / 0.5);
    kitchen(ctx, t, sc, {
      tod: 'day', pos: lineup(),
      frij: { on: t >= ev.boot },
      behind: () => { const a = pulse(t, ev.reveal, 3); if (t >= ev.reveal && a > 0.02) G.rays(ctx, FRIJ.x, FRIJ.y - 340, { n: 22, r0: 300, r1: 620, color: '#FFD23F', lw: 26, alpha: a }); },
      mid: () => PF.sheet(ctx, t, FRIJ.x, FRIJ.y, ease.outQuad(u)),
    });
    const fl = pulse(t, ev.reveal, 8); if (t >= ev.reveal && fl > 0.02) { ctx.fillStyle = `rgba(255,255,255,${0.75 * fl})`; ctx.fillRect(0, 0, W, H); }
  };

  SC.cheese = (ctx, t, sc) => {
    const reach = clamp((t - (sc.t0 + 0.5)) / 0.5) * (t < ev.deny ? 1 : 1 - clamp((t - ev.deny) / 0.12));
    const jump = pulse(t, ev.deny, 5);
    kitchen(ctx, t, sc, {
      tod: 'morning', pos: { gary: { x: 1130 } },
      frij: { deny: t >= ev.deny ? clamp(1.6 - (t - ev.deny) * 2) : 0 },
      over: { gary: { ...(reach > 0.02 ? { handR: [lerp(60, 152, reach), lerp(-160, -282, reach)], look: 0.8 } : {}), ...(t >= ev.deny && t < ev.deny + 0.7 ? { eyes: 'wide', brows: 'up', mouth: 'o', handR: [120, -330], handL: [-120, -330], sy: 1 + 0.06 * jump } : {}) } },
    });
  };

  SC.deal = (ctx, t, sc) => {
    const dIn = F('Gary. Just return it.').t - 1.1;
    kitchen(ctx, t, sc, {
      tod: 'day',
      pos: { gary: { x: 1150 }, otis: PF.enter(t, ev.otisIn, -140, 900, 0.85), lou: PF.enter(t, ev.louIn, -160, 200, 0.95), mabel: PF.enter(t, ev.louIn + 0.3, -160, 440, 1.05), denise: PF.enter(t, dIn, -160, 680, 0.95) },
    });
  };

  SC.lock = (ctx, t, sc) => {
    const on = t >= ev.clunk;
    kitchen(ctx, t, sc, { tod: 'night', pos: lineup(), red: on ? 1 : 0, shake: on ? 14 * Math.exp(-(t - ev.clunk) * 5) : 0 });
  };

  SC.kale = (ctx, t, sc) => {
    const pos = lineup(), g = pos.gary, hx = g.x, hy = FLOOR - 388 * PF.SIZE.gary;
    kitchen(ctx, t, sc, {
      tod: 'night', pos, red: 1,
      over: { gary: t >= ev.splat && t < ev.splat + 0.5 ? { sy: 1 - 0.06 * pulse(t, ev.splat, 6), headRot: -0.12 * pulse(t, ev.splat, 4) } : {} },
      front: () => {
        const kale = '#5DBB4A', kd = '#3E8F33';
        if (t >= ev.launch && t < ev.splat) { // the glob in flight
          const u = (t - ev.launch) / (ev.splat - ev.launch), x = lerp(FRIJ.x - 40, hx, u), y = lerp(FRIJ.y - 260, hy - 110, u) - Math.sin(u * Math.PI) * 120;
          oval(ctx, x, y, 44, 34, { fill: kale, lw: 5, rot: u * 3 }); oval(ctx, x + 50, y + 10, 14, 10, { fill: kale, lw: 4 });
        }
        if (t >= ev.splat) { // ...and on Gary
          const a = t - ev.splat, k = ease.outBack(clamp(a / 0.15), 2.5);
          ctx.save(); ctx.translate(hx - 10, hy - 118); ctx.scale(k * 0.9, k * 0.9);
          poly(ctx, [[-96, -30], [-50, -78], [10, -60], [64, -84], [100, -30], [84, 20], [40, 34], [30, 16], [-4, 30], [-40, 16], [-70, 36], [-100, 14]], { fill: kale, lw: 5 });
          for (const [dx, len] of [[-78, 44], [-4, 30], [62, 56]]) box(ctx, dx - 9, 16, 18, 14 + len * clamp(a / 3), { fill: kale, r: 9, lw: 4 });
          oval(ctx, -30, -34, 16, 9, { fill: kd, lw: 0 }); oval(ctx, 40, -40, 12, 7, { fill: kd, lw: 0 });
          ctx.restore();
          const b = pulse(t, ev.splat, 4); if (b > 0.03) for (let i = 0; i < 9; i++) { const an = i * 0.7, r = 90 + (1 - b) * 190; oval(ctx, hx + Math.cos(an) * r, hy - 110 + Math.sin(an) * r * 0.7, 12 * b + 3, 9 * b + 3, { fill: kale, lw: 3 }); }
        }
      },
    });
  };

  SC.manual = (ctx, t, sc) => {
    const pos = lineup(), open = clamp((t - ev.open) / 0.45);
    // Mr. Biscuit: down off the counter, across the floor, up to the panel
    const cw = t - ev.catwalk, leap = ev.paw - 0.42, cat = { ...PERCH };
    let onFloor = false;
    if (cw > 0) {
      onFloor = true;
      const X1 = 1310, Y = 968;
      if (cw < 0.9) { const u = cw / 0.9; cat.x = lerp(PERCH.x, 520, u); cat.y = lerp(PERCH.y, Y, ease.inQuad(u)) - Math.sin(u * Math.PI) * 110; }
      else if (t < leap) { const u = clamp((cw - 0.9) / 3.6); cat.x = lerp(520, X1, ease.inOutQuad(u)); cat.y = Y - (u < 1 ? Math.abs(Math.sin(u * Math.PI * 7)) * 16 : 0); }
      else { const u = clamp((t - leap) / 0.84); cat.x = X1 + 40 * Math.sin(u * Math.PI); cat.y = Y - Math.sin(u * Math.PI) * 300; }
    }
    pos.cat = cat;
    pos.catwalk = { x: cat.x + 60, y: cat.y - 230, r: 330 }; // the camera walks with him
    const cheer = t >= ev.open + 0.15;
    const over = {};
    for (const n of Object.keys(LINEUP)) {
      over[n] = {};
      if (cw > 0 && t < F('Welcome back').t) over[n].look = clamp((cat.x - pos[n].x) / 320, -1, 1);
      if (cheer) Object.assign(over[n], { eyes: 'happy', brows: 'up', mouth: 'grin', gesture: 'cheer', look: 0 });
    }
    const pawLit = clamp(1 - (t - ev.paw) / 1.1) * (t >= ev.paw ? 1 : 0);
    kitchen(ctx, t, sc, {
      tod: 'night', pos, red: t >= ev.open ? 0 : 1, over, cat: !onFloor, catFront: onFloor,
      catLook: { look: t >= ev.catlook - 0.5 ? 0.6 : 0, happy: 0.8 },
      frij: { open: ease.outCubic(open), paw: pawLit, ...(t >= ev.open ? { emo: 'happy' } : {}) },
      behind: () => { if (t >= ev.open) G.rays(ctx, FRIJ.x, FRIJ.y - 300, { n: 26, r0: 330, r1: 900, color: '#FFE38A', lw: 30, alpha: 0.55 + 0.25 * Math.sin(t * 5), spin: t * 0.2 }); },
      front: () => {
        // Otis's manual
        if (t < ev.catwalk) { const o = pos.otis, s = PF.SIZE.otis; ctx.save(); ctx.translate(o.x - 92 * s, FLOOR - 196 * s); ctx.rotate(-0.2); box(ctx, -44, -58, 88, 116, { fill: '#FDF6E3', r: 6, lw: 5 }); G.decor(() => text(ctx, 'MANUAL', 0, -20, { size: 15, color: '#2E86AB' })); for (let i = 0; i < 4; i++) line(ctx, [[-28, -2 + i * 13], [28, -2 + i * 13]], { lw: 3, color: '#9AA5B1' }); ctx.restore(); }
        if (onFloor) PF.cat(ctx, t, cat, { look: 0.7, happy: 0.9 });
        if (t >= ev.catlook && t < ev.catwalk) PF.thought(ctx, 'Finally.', 1150, 96, t - ev.catlook);
      },
    });
    const fl = pulse(t, ev.open, 3.5); if (t >= ev.open && fl > 0.02) { ctx.fillStyle = `rgba(255,236,160,${0.85 * fl})`; ctx.fillRect(0, 0, W, H); }
  };

  SC.dinner = (ctx, t, sc) => {
    kitchen(ctx, t, sc, {
      tod: 'night', pos: lineup({ lou: 230, mabel: 500, otis: 800, denise: 1050, gary: 1280 }), cat: false, frij: { emo: 'happy' },
      front: () => {
        SETS.table(ctx);
        PF.cat(ctx, t, { x: 655, y: 846, s: 0.78 }, { crown: true, happy: 1 });
        oval(ctx, 655, 884, 96, 20, { fill: '#FFFFFF', lw: 4.5 }); poly(ctx, [[600, 876], [650, 858], [700, 876], [650, 890]], { fill: '#F7A8B8', lw: 4 });
      },
    });
  };

  SC.toaster = (ctx, t, sc) => {
    const m = PF.mouth('toaster', t);
    kitchen(ctx, t, sc, {
      tod: 'morning', pos: lineup({ mabel: 200, otis: 450, gary: 1000, denise: 1240 }), cat: false, frij: { emo: 'happy' },
      counter: (c, pos) => PF.toaster(ctx, t, pos.toaster.x, pos.toaster.y, t >= ev.pop, m.talking ? m.open : 0),
      mid: () => PF.cat(ctx, t, { x: FRIJ.x, y: FRIJ.y - 680, s: 0.72 }, { crown: true, happy: 0.9, look: -0.6 }),
      over: { gary: t >= ev.pop && t < F('Hello, Gary. We need').t ? { look: -0.9, eyes: 'wide', mouth: 'o', brows: 'up' } : {} },
    });
  };

  // ---------- the house from the street ----------
  const SLUG = { ext1: 'THE NEXT MORNING', ext2: 'THAT NIGHT', ext3: 'THE MORNING AFTER' };
  SC.ext1 = SC.ext2 = SC.ext3 = (ctx, t, sc) => {
    const u = (t - sc.t0) / (sc.t1 - sc.t0), z = 1.04 + 0.06 * u;
    ctx.save(); ctx.translate(W / 2, H * 0.55); ctx.scale(z, z); ctx.translate(-W / 2, -H * 0.55);
    SETS.exterior(ctx, t, sc.id === 'ext2' ? 'night' : 'morning', u);
    ctx.restore();
    PF.slug(ctx, SLUG[sc.id], t, sc.t0 + 0.25);
  };

  // ---------- cutaway: Gary returns a mattress to the ocean ----------
  SC.beach = (ctx, t, sc) => {
    const after = t >= ev.waveCrash, pos = { gary: { x: 700, y: 930, s: 1.3 } };
    const u = (t - sc.t0) / (sc.t1 - sc.t0), z = after ? 1.45 + 0.05 * u : 1 + 0.04 * u;
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(after ? -900 : -W / 2, after ? -H + H / 2 / z : -H / 2);
    SETS.beach(ctx, t);
    if (!after) {
      // the wave rears up behind him
      const r = ease.inQuad(clamp((t - ev.waveRise) / (ev.waveCrash - ev.waveRise)));
      if (r > 0) { const top = lerp(470, -260, r); ctx.beginPath(); ctx.moveTo(-50, 760); ctx.lineTo(-50, top + 240); ctx.bezierCurveTo(300, top - 60, 900, top - 120, 1400, top + 40); ctx.bezierCurveTo(1700, top + 130, 1900, top + 320, 1990, top + 520 + (1 - r) * 200); ctx.lineTo(1990, 760); ctx.closePath(); ctx.fillStyle = '#2E86AB'; ctx.fill(); ctx.lineWidth = 22; ctx.strokeStyle = '#FFFFFF'; ctx.stroke(); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke(); }
      SETS.mattress(ctx, 1080, 940, 0.05 + (r > 0 ? Math.sin(t * 40) * 0.02 : 0), false);
      PF.person(ctx, 'gary', t, sc, pos, r > 0.15 ? { eyes: 'wide', brows: 'up', mouth: 'o', gesture: null, lookY: -0.8 } : {});
    } else {
      // flat on the sand, under the mattress, with a visitor
      Ch.person(ctx, { x: 1120, y: 940, s: 1.3, pose: 'stand', rot: -Math.PI / 2, style: CAST.gary, eyes: 'closed', brows: 'worried', mouth: 'wavy', shadow: false, seed: 300 + 103 * 7 });
      ctx.save(); ctx.translate(1230, 930); ctx.scale(1, 0.52); SETS.mattress(ctx, 0, 0, -Math.PI / 2, true); ctx.restore();
      const b = clamp((t - (ev.gull - 0.7)) / 0.7);
      if (b > 0) Ch.bird(ctx, { x: lerp(1700, 960, ease.outQuad(b)), y: lerp(240, 826, ease.outQuad(b)), s: 1.5, color: '#F4F4F4', t, flap: b < 1 ? 1 : 0, facing: -1 });
      for (let i = 0; i < 5; i++) { const x = 560 + i * 150, a = (t * 0.7 + i * 0.3) % 1; oval(ctx, x, 990 + a * 60, 7 * (1 - a) + 3, 5, { fill: '#8FD3F4', lw: 0 }); }
    }
    ctx.restore();
    if (after) { // the water drains off the lens
      const a = t - ev.waveCrash, d = ease.inQuad(clamp(a / 0.8));
      if (d < 1) { ctx.fillStyle = '#2E86AB'; ctx.fillRect(0, H * d, W, H); ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.moveTo(0, H * d - 40); for (let x = 0; x <= W; x += 80) ctx.lineTo(x, H * d + Math.sin(x * 0.02 + t * 9) * 26); ctx.lineTo(W, H * d + 50); ctx.lineTo(0, H * d + 50); ctx.fill(); }
      const fl = pulse(t, ev.waveCrash, 6); if (fl > 0.02) { ctx.fillStyle = `rgba(255,255,255,${fl})`; ctx.fillRect(0, 0, W, H); }
    }
  };

  // ---------- cutaway: the self-checkout ----------
  SC.checkout = (ctx, t, sc) => {
    if (t >= ev.weeks && t < ev.later) { // the time card
      SETS.burst(ctx, t, '#3B2A6B', '#46337C');
      const k = ease.outBack(clamp((t - ev.weeks) / 0.3), 2);
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.rotate(-0.03);
      text(ctx, 'THREE WEEKS', 0, -20, { size: 150, color: '#FFE066', stroke: INK, strokeW: 22 }); text(ctx, 'LATER', 0, 150, { size: 150, color: '#FFFFFF', stroke: INK, strokeW: 22 });
      ctx.restore();
      return;
    }
    const old = t >= ev.later, m = PF.mouth('machine', t);
    const alert = !old && t >= ev.beep1 && t < F('Please wait').t - 0.2 ? 1 : 0;
    const pos = { gary: { x: 760, y: 950, s: 1.35, style: old ? { ...CAST.gary, facialHair: 'beard', hairStyle: 'long' } : CAST.gary }, machine: { x: 1180 } };
    const u = (t - (old ? ev.later : sc.t0)) / 12, z = 1 + 0.05 * u;
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
    SETS.store(ctx, t, { old });
    SETS.kiosk(ctx, t, 1180, 950, m.talking ? m.open : 0, alert, old);
    PF.person(ctx, 'gary', t, sc, pos, old ? { eyes: 'normal', brows: 'worried', mouth: 'wavy', blink: 0.55, look: 0.7 } : { look: 0.7 });
    if (old) { ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2.5; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(880, 520 + i * 26); ctx.lineTo(1030, 650 + i * 8); ctx.stroke(); } ctx.fillStyle = 'rgba(120,110,80,0.16)'; ctx.fillRect(-100, -100, W + 200, H + 200); }
    ctx.restore();
  };

  // ---------- cutaway: the GPS and the lake ----------
  SC.lake = (ctx, t, sc) => {
    const m = PF.mouth('gps', t), sunk = t >= ev.splash;
    const u = (t - sc.t0) / (sc.t1 - sc.t0), z = 1 + 0.04 * u;
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
    SETS.lake(ctx, t);
    const driver = (c) => PF.person(c, 'gary', t, sc, { gary: { x: 88, y: 42, s: 0.6 } }, { shadow: false, gesture: null, look: 0.8, ...(t >= ev.drive ? { eyes: 'wide', brows: 'up', mouth: 'o' } : {}) });
    let cx = 430, cy = 880, rot = 0;
    if (!sunk) {
      if (t >= ev.drive) { const d = ease.inQuad(clamp((t - ev.drive) / (ev.splash - ev.drive))); cx = lerp(430, 1420, d); const off = Math.max(0, cx - 1000); cy = 880 + off * off * 0.0009; rot = clamp(off / 700) * 0.5; }
      else cy += Math.sin(t * 30) * 2;
      SETS.car(ctx, t, cx, cy, rot, driver);
      // the GPS, talking
      if (m.talking) { const bx = cx + 120, by = cy - 400; box(ctx, bx - 150, by - 60, 300, 120, { fill: '#10151F', r: 24, lw: 6 }); poly(ctx, [[bx - 40, by + 58], [bx - 76, by + 120], [bx + 10, by + 58]], { fill: '#10151F', lw: 6 }); box(ctx, bx - 60, by + 50, 90, 14, { fill: '#10151F', lw: 0 }); G.decor(() => text(ctx, 'GPS', bx - 86, by + 16, { size: 38, color: '#7CFFB2' })); for (let i = 0; i < 6; i++) { const a = 6 + 34 * m.open * (0.4 + 0.6 * Math.abs(Math.sin(i * 1.9 + t * 25))); line(ctx, [[bx - 6 + i * 24, by - a], [bx - 6 + i * 24, by + a]], { lw: 9, color: '#7CFFB2' }); } }
    } else {
      const a = t - ev.splash, bob = Math.sin(t * 2) * 8;
      SETS.car(ctx, t, 1440, 1010 + bob, 0.32, null);
      PF.person(ctx, 'gary', t, sc, { gary: { x: 1400, y: 790 + bob, s: 0.95, pose: 'sit' } }, { shadow: false, brows: 'worried', mouth: 'wavy', eyes: 'normal', lookY: 0.4, sweat: 1, gesture: null });
      // water in front of the car
      ctx.fillStyle = '#2E86AB'; ctx.beginPath(); ctx.moveTo(1000, 1100); ctx.lineTo(1000, 900); for (let x = 1000; x <= 1960; x += 60) ctx.lineTo(x, 900 + Math.sin(x * 0.02 + t * 3) * 10); ctx.lineTo(1960, 1100); ctx.fill();
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 8; ctx.beginPath(); for (let x = 1000; x <= 1960; x += 60) { const y = 900 + Math.sin(x * 0.02 + t * 3) * 10; x === 1000 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
      for (let i = 0; i < 6; i++) { const b = ((a * 0.8 + i * 0.17) % 1); oval(ctx, 1300 + i * 46, 900 - b * 150, 8 + i % 3 * 3, 8 + i % 3 * 3, { fill: 'rgba(255,255,255,0.5)', lw: 3, stroke: '#FFFFFF' }); }
      Ch.bird(ctx, { x: lerp(1960, 1700, clamp((a - 1.2) / 1.6)), y: 890 + Math.sin(t * 3) * 6, s: 1.3, color: '#F2C94C', t, flap: 0, facing: -1 });
      if (m.talking) { const bx = 1180, by = 420; box(ctx, bx - 150, by - 60, 300, 120, { fill: '#10151F', r: 24, lw: 6 }); G.decor(() => text(ctx, 'GPS', bx - 86, by + 16, { size: 38, color: '#7CFFB2' })); for (let i = 0; i < 6; i++) { const q = 6 + 34 * m.open * (0.4 + 0.6 * Math.abs(Math.sin(i * 1.9 + t * 25))); line(ctx, [[bx - 6 + i * 24, by - q], [bx - 6 + i * 24, by + q]], { lw: 9, color: '#7CFFB2' }); } }
      // the splash itself
      const sp = clamp(a / 0.9);
      if (sp < 1) for (let i = 0; i < 14; i++) { const an = -Math.PI * (0.1 + 0.8 * (i / 13)), r = 120 + ease.outQuad(sp) * (260 + (i % 3) * 90); oval(ctx, 1400 + Math.cos(an) * r, 900 + Math.sin(an) * r + sp * sp * 260, 34 * (1 - sp) + 8, 44 * (1 - sp) + 8, { fill: '#FFFFFF', lw: 5, stroke: '#2E86AB' }); }
    }
    ctx.restore();
    const fl = pulse(t, ev.splash, 6); if (sunk && fl > 0.02) { ctx.fillStyle = `rgba(255,255,255,${0.9 * fl})`; ctx.fillRect(0, 0, W, H); }
  };

  // ---------- the titles ----------
  SC.title = (ctx, t) => {
    const T = S.T, ck = S.clock;
    SETS.burst(ctx, t, '#2FA4A0', '#39B3AE', W / 2, 620);
    const hop = (ph) => Math.abs(Math.sin(Math.PI * (ck.beatPos(t) + ph))) * 14;
    const spot = { lou: 250, mabel: 480, gary: 700, frij: 960, denise: 1230, otis: 1450, cat: 1680 };
    const pop = (who) => { const c = S.titleCast.find((q) => q.who === who); return t < c.t ? 0 : ease.outBack(clamp((t - c.t) / 0.22), 2.6); };
    const done = t >= ev.logo;
    // back row: the fridge
    let k = pop('frij');
    if (k > 0) { ctx.save(); ctx.translate(960, 940); ctx.scale(k, k); ctx.translate(-960, -940); PF.frij(ctx, t, { x: 960, y: 940, emo: done ? 'happy' : 'smug', talk: 0 }); ctx.restore(); }
    const emo = { gary: ['happy', 'grin'], denise: ['normal', 'smirk'], mabel: ['normal', 'flat'], otis: ['happy', 'grin'], lou: ['normal', 'smile'] };
    for (const n of ['lou', 'mabel', 'gary', 'denise', 'otis']) {
      k = pop(n); if (k <= 0) continue;
      Ch.person(ctx, { x: spot[n], y: 960 - hop(n.length * 0.13), s: PF.SIZE[n] * 0.92 * k, pose: 'stand', style: CAST[n], eyes: emo[n][0], mouth: emo[n][1], brows: n === 'denise' ? 'determined' : 'neutral', seed: 300 + n.charCodeAt(0) * 7,
        ...(done ? (n === 'mabel' ? { gesture: 'phone' } : { gesture: 'cheer' }) : n === 'gary' ? { gesture: 'wave' } : n === 'denise' ? { gesture: 'akimbo' } : n === 'mabel' ? { gesture: 'phone' } : n === 'otis' ? { gesture: 'thumbsUp' } : { gesture: 'akimbo' }) });
    }
    k = pop('cat'); if (k > 0) PF.cat(ctx, t, { x: spot.cat, y: 960 - hop(0.4), s: 1.25 * k }, { happy: 1 });
    // the logo stamps on the last downbeat; the episode title on the button
    if (done) {
      const a = t - ev.logo, z = 1 + 1.4 * Math.exp(-a * 22), sh = 10 * Math.exp(-a * 9);
      ctx.save(); ctx.translate(W / 2 + U.noise1(t * 50, 3) * sh, 250 + U.noise1(t * 50, 4) * sh); ctx.scale(z, z); ctx.rotate(-0.035);
      text(ctx, 'THE', -600, -152, { size: 64, color: '#FFFFFF', stroke: INK, strokeW: 16 });
      text(ctx, 'PUDDLEFORDS', 0, 40, { size: 186, color: '#FFE066', stroke: INK, strokeW: 30 });
      ctx.restore();
      const b = t - T(7, 3);
      if (b >= 0) { const q = ease.outBack(clamp(b / 0.2), 2.4); ctx.save(); ctx.translate(W / 2, 1010); ctx.scale(q, q); box(ctx, -330, -44, 660, 88, { fill: '#E4572E', r: 44, lw: 7 }); text(ctx, 'EPISODE 1: "COLD WAR"', 0, 17, { size: 44, color: '#FFFFFF' }); ctx.restore(); }
      const fl = pulse(t, ev.logo, 7); if (fl > 0.02) { ctx.fillStyle = `rgba(255,255,255,${0.8 * fl})`; ctx.fillRect(0, 0, W, H); }
    }
  };

  // ---------- the credits ----------
  const CARDS = [
    [['THE PUDDLEFORDS', 110, '#FFE066'], ['Episode 1: "Cold War"', 52, '#FFFFFF']],
    [['WRITTEN, DRAWN, ANIMATED', 70, '#FFFFFF'], ['AND SCORED IN CODE', 70, '#FFE066'], ['Every frame is a function. Every note is arithmetic.', 40, '#C9D3DC']],
    [['STARRING', 60, '#FFE066'], ['Gary · Denise · Mabel · Otis · Grandma Lou', 50, '#FFFFFF'], ['FRIJ 9000 as itself · Mr. Biscuit as management', 42, '#C9D3DC']],
    [['NO FRIDGES WERE HARMED.', 72, '#FFFFFF'], ['One toaster remains at large.', 48, '#FFE066']],
  ];
  SC.credits = (ctx, t, sc) => {
    const C = S.credits, ck = C.clock;
    SETS.burst(ctx, t, '#1F2547', '#272E5A', W / 2, 400);
    const bar = Math.floor(ck.beatPos(t) / 4), end = t >= C.hit;
    const card = end ? null : CARDS[clamp(Math.floor(bar / 2), 0, 3)];
    const fam = (f) => (/[a-z]/.test(f) ? { fam: 'Inter', weight: 700 } : {});
    if (card && t >= ck.T(0)) {
      const c0 = ck.T(Math.floor(bar / 2) * 2), k = ease.outBack(clamp((t - c0) / 0.22), 1.8);
      let y = 300 - (card.length - 1) * 50;
      ctx.save(); ctx.translate(W / 2, 0); ctx.scale(k, 1);
      for (const [str, size, color] of card) { text(ctx, str, 0, y, { size, color, ...fam(str) }); y += size * 0.8 + 50; }
      ctx.restore();
    }
    if (end) {
      const a = t - C.hit, z = 1 + 1.2 * Math.exp(-a * 20);
      ctx.save(); ctx.translate(W / 2, 330); ctx.scale(z, z); text(ctx, 'THE END', 0, 0, { size: 230, color: '#FFE066', stroke: INK, strokeW: 34 }); ctx.restore();
      if (t >= ck.T(7, 3)) text(ctx, 'voices: synthetic, generated offline · made with Claude Code', W / 2, 470, { size: 36, color: '#C9D3DC', fam: 'Inter', weight: 700 });
    }
    // the family dances it out along the bottom
    const names = ['lou', 'mabel', 'gary', 'denise', 'otis'], bp = ck.beatPos(t);
    names.forEach((n, i) => {
      const hop = Math.abs(Math.sin(Math.PI * (bp + i * 0.5))) * 22;
      Ch.person(ctx, { x: 330 + i * 250, y: 1050 - hop, s: PF.SIZE[n] * 0.7, pose: 'stand', style: CAST[n], eyes: n === 'mabel' ? 'normal' : 'happy', mouth: n === 'mabel' ? 'flat' : 'grin', gesture: n === 'mabel' ? 'phone' : end ? 'cheer' : i % 2 ? 'clap' : 'bhangra', seed: 300 + n.charCodeAt(0) * 7 });
    });
    PF.cat(ctx, t, { x: 1620, y: 1040 - Math.abs(Math.sin(Math.PI * bp)) * 10, s: 1.1 }, { crown: true, happy: 1 });
  };

  // ---------- the frame ----------
  const sceneAt = (t) => TL.scenes.find((s) => t >= s.t0 && t < s.t1) || TL.scenes[TL.scenes.length - 1];
  Studio.film({
    post: { paper: 0, grain: 0, vignette: 0.1 },
    fadeOut: 1.0,
    init() { PF.look(); },
    draw(ctx, t) {
      const sc = sceneAt(t);
      ctx.save();
      SC[sc.id](ctx, t, sc);
      ctx.restore();
      Subs.draw(ctx, t, SUBS, { style: 'box', size: 42, y: 1002, maxW: 1500 });
    },
  });
})();
