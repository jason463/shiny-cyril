// THE SETS — the Puddleford kitchen, the house from the street, and the places the cutaways go.
// Each is drawn on a 1920x1080 stage; the camera in stage.js frames it.
(function () {
  const U = globalThis.U, G = globalThis.G, PF = globalThis.PF;
  const { clamp, lerp } = U;
  const { box, poly, oval, line, text, grad, INK, W, H } = PF;
  const SETS = (PF.SETS = {});

  const sky = (ctx, tod, x, y, w, h) => {
    const stops = tod === 'night' ? [[0, '#141A3C'], [1, '#33346B']] : tod === 'evening' ? [[0, '#F28C5B'], [1, '#F9D58B']] : tod === 'morning' ? [[0, '#8FD3F4'], [1, '#FCE9B8']] : [[0, '#6EC3F0'], [1, '#C9ECFA']];
    ctx.fillStyle = grad(ctx, 0, y, 0, y + h, stops); ctx.fillRect(x, y, w, h);
  };
  const cloud = (ctx, x, y, s, c = '#FFFFFF') => { ctx.fillStyle = c; for (const [dx, dy, r] of [[0, 0, 40], [44, -16, 50], [96, 0, 42], [50, 12, 46]]) { ctx.beginPath(); ctx.ellipse(x + dx * s, y + dy * s, r * s, r * 0.7 * s, 0, 0, Math.PI * 2); ctx.fill(); } };
  const stars = (ctx, x, y, w, h, n, seed) => { ctx.fillStyle = '#FFF6D6'; for (let i = 0; i < n; i++) { const r = 1.5 + U.hash(i, seed) * 2.5; ctx.beginPath(); ctx.arc(x + U.hash(i, seed + 1) * w, y + U.hash(i, seed + 2) * h, r, 0, 7); ctx.fill(); } };

  // ---------- the kitchen ----------
  // o: { tod: 'day' | 'morning' | 'night', red: 0..1 (the lockdown lighting) }
  SETS.kitchen = (ctx, t, o = {}) => {
    const tod = o.tod || 'day', night = tod === 'night';
    const FLOOR = 770;
    // wall + a stripe of tiles
    ctx.fillStyle = night ? '#D9C48E' : '#F6DFA4'; ctx.fillRect(-200, -200, W + 400, FLOOR + 200);
    ctx.fillStyle = night ? '#C9B27A' : '#EFD28D'; for (let x = -200; x < W + 200; x += 120) ctx.fillRect(x, -200, 60, FLOOR + 200);
    // floor: checker tiles
    ctx.fillStyle = '#E8E1D0'; ctx.fillRect(-200, FLOOR, W + 400, H - FLOOR + 200);
    for (let r = 0; r < 4; r++) { const y0 = FLOOR + [0, 46, 110, 196][r], hh = [46, 64, 86, 250][r], tw = 130; ctx.fillStyle = '#5FA8A0'; for (let i = -3; i < 20; i++) if ((i + r) % 2 === 0) ctx.fillRect(i * tw - 70, y0, tw, hh); }
    line(ctx, [[-200, FLOOR], [W + 200, FLOOR]], { lw: 6 });
    // window over the counter
    const wx = 250, wy = 170, ww = 380, wh = 300;
    sky(ctx, tod, wx, wy, ww, wh);
    if (night) { stars(ctx, wx, wy, ww, wh, 22, 5); oval(ctx, wx + 290, wy + 80, 34, 34, { fill: '#FFF3C4', lw: 0 }); }
    else { oval(ctx, wx + 290, wy + 84, 40, 40, { fill: '#FFE066', lw: 0 }); cloud(ctx, wx + 40 + ((t * 6) % 420) - 60, wy + 90, 0.8); }
    ctx.fillStyle = night ? '#23305A' : '#7BC96F'; ctx.beginPath(); ctx.ellipse(wx + 120, wy + wh + 40, 260, 110, 0, 0, 7); ctx.save(); ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip(); ctx.beginPath(); ctx.ellipse(wx + 120, wy + wh + 40, 260, 110, 0, 0, 7); ctx.fill(); ctx.restore();
    box(ctx, wx, wy, ww, wh, { lw: 12, stroke: '#FFFFFF' }); box(ctx, wx - 6, wy - 6, ww + 12, wh + 12, { lw: 5 });
    line(ctx, [[wx + ww / 2, wy], [wx + ww / 2, wy + wh]], { lw: 8, color: '#FFFFFF' });
    for (const sd of [0, 1]) poly(ctx, [[wx + sd * ww - 30 + sd * 60 - sd * 0, wy - 20], [wx + sd * ww + (sd ? -90 : 90), wy - 20], [wx + sd * ww + (sd ? -40 : 40), wy + wh + 14], [wx + sd * ww + (sd ? 30 : -30), wy + wh + 14]], { fill: '#E4572E', lw: 5 });
    box(ctx, wx - 50, wy - 34, ww + 100, 22, { fill: '#8C5A2B', r: 8, lw: 5 });
    // upper cabinets
    for (let i = 0; i < 2; i++) { box(ctx, 720 + i * 170, 140, 170, 250, { fill: '#7FB7BE', r: 6, lw: 5 }); oval(ctx, 720 + i * 170 + (i ? 26 : 144), 330, 9, 9, { fill: '#F4EDE0', lw: 3 }); }
    // a clock, and a sign every home has
    oval(ctx, 1190, 230, 62, 62, { fill: '#FFFFFF', lw: 6 }); const hr = tod === 'morning' ? 7 : night ? 9.2 : 5.5;
    line(ctx, [[1190, 230], [1190 + Math.sin((hr / 12) * 6.283) * 30, 230 - Math.cos((hr / 12) * 6.283) * 30]], { lw: 6 }); line(ctx, [[1190, 230], [1190 + Math.sin(t * 0.02) * 46, 230 - Math.cos(t * 0.02) * 46]], { lw: 4 });
    box(ctx, 1100, 340, 190, 120, { fill: '#FDF6E3', r: 4, lw: 6, stroke: '#8C5A2B' });
    G.decor(() => { text(ctx, 'LIVE', 1195, 378, { size: 24, color: '#8E5FBF' }); text(ctx, 'LAUGH', 1195, 408, { size: 24, color: '#8E5FBF' }); text(ctx, 'LOAN', 1195, 438, { size: 24, color: '#E4572E' }); });
    // counter: cabinets, worktop, a fruit bowl
    box(ctx, 40, 560, 860, 250, { fill: '#7FB7BE', r: 4, lw: 5 });
    for (let i = 0; i < 4; i++) { box(ctx, 60 + i * 210, 590, 190, 200, { fill: '#8FC6CC', r: 6, lw: 4 }); oval(ctx, 60 + i * 210 + 160, 690, 9, 9, { fill: '#F4EDE0', lw: 3 }); }
    box(ctx, 20, 536, 900, 30, { fill: '#F4EDE0', r: 6, lw: 5 });
    poly(ctx, [[800, 536], [812, 500], [888, 500], [900, 536]], { fill: '#E9D5A1', lw: 4 });
    oval(ctx, 830, 496, 18, 17, { fill: '#E4572E', lw: 3.5 }); oval(ctx, 862, 494, 18, 17, { fill: '#F2C94C', lw: 3.5 }); oval(ctx, 846, 480, 17, 16, { fill: '#7BC96F', lw: 3.5 });
    // a plant by the fridge
    box(ctx, 1740, 690, 90, 90, { fill: '#C96F4A', r: 8, lw: 5 });
    for (const [dx, dy, r] of [[-40, -70, 0.5], [0, -110, 0], [40, -70, -0.5]]) oval(ctx, 1785 + dx, 690 + dy, 26, 60, { fill: '#4E9F5B', lw: 4.5, rot: -r });
  };
  // the lockdown light: a red wash over the room, pulsing a little
  SETS.redWash = (ctx, t, k) => { if (k <= 0) return; ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(255,${Math.round(lerp(255, 168, k))},${Math.round(lerp(255, 172, k))},1)`; ctx.fillRect(-400, -400, W + 800, H + 800); ctx.restore(); ctx.save(); ctx.globalAlpha = 0.05 * k * (1 + Math.sin(t * 3)); ctx.fillStyle = '#FF2A2A'; ctx.fillRect(-400, -400, W + 800, H + 800); ctx.restore(); };
  // the dinner table in the foreground
  SETS.table = (ctx) => {
    box(ctx, 90, 842, 1560, 60, { fill: '#B5763E', r: 14, lw: 6 });
    box(ctx, 130, 900, 1480, 260, { fill: '#96602F', r: 0, lw: 6 });
    for (const [x, c] of [[250, '#F2C94C'], [540, '#E4572E'], [870, '#7BC96F'], [1110, '#F2C94C'], [1360, '#E4572E']]) { oval(ctx, x, 850, 88, 20, { fill: '#FFFFFF', lw: 4.5 }); box(ctx, x - 46, 806, 92, 40, { fill: '#E9C98A', r: 10, lw: 4 }); box(ctx, x - 50, 822, 100, 12, { fill: c, r: 4, lw: 3 }); }
  };

  // ---------- the house from the street ----------
  SETS.exterior = (ctx, t, tod, u) => {
    const night = tod === 'night';
    sky(ctx, tod, 0, 0, W, H);
    if (night) { stars(ctx, 0, 0, W, 520, 70, 9); oval(ctx, 1560, 190, 70, 70, { fill: '#FFF3C4', lw: 0 }); oval(ctx, 1530, 170, 62, 62, { fill: '#141A3C', lw: 0 }); }
    else { oval(ctx, 320, 210, 84, 84, { fill: '#FFE066', lw: 0 }); cloud(ctx, 1300 + t * 8 - u * 0, 180, 1.3); cloud(ctx, 760 + t * 5, 110, 0.9); }
    // far houses, hedge, lawn, street
    for (let i = 0; i < 6; i++) { const x = -60 + i * 380, c = night ? '#2B2F5E' : ['#F7B7A3', '#B5D8CC', '#F9E3A0'][i % 3]; box(ctx, x, 470, 240, 190, { fill: c, lw: 0 }); poly(ctx, [[x - 20, 472], [x + 120, 390], [x + 260, 472]], { fill: night ? '#22254D' : '#B86B5A', lw: 0 }); }
    ctx.fillStyle = night ? '#1E3A3F' : '#5FAF63'; ctx.fillRect(0, 640, W, H - 640);
    ctx.fillStyle = night ? '#2A2E4A' : '#8D8F98'; ctx.fillRect(0, 930, W, 150);
    ctx.fillStyle = night ? '#C9C4A0' : '#FFFFFF'; for (let x = 40; x < W; x += 240) ctx.fillRect(x, 1000, 120, 12);
    line(ctx, [[0, 930], [W, 930]], { lw: 6 });
    // the Puddleford house
    const hx = 560, hy = 330, hw = 800, hh = 500;
    box(ctx, hx + hw - 40, hy + 200, 300, hh - 200, { fill: night ? '#6E6A8C' : '#E9C98A', lw: 6 }); // garage
    box(ctx, hx + hw - 6, hy + 290, 232, 210, { fill: night ? '#4E4B6B' : '#FDF6E3', r: 6, lw: 5 });
    for (let i = 1; i < 4; i++) line(ctx, [[hx + hw - 6, hy + 290 + i * 52], [hx + hw + 226, hy + 290 + i * 52]], { lw: 3.5 });
    poly(ctx, [[hx + hw - 70, hy + 204], [hx + hw + 110, hy + 100], [hx + hw + 290, hy + 204]], { fill: night ? '#3B2F4F' : '#B5503A', lw: 6 });
    box(ctx, hx, hy, hw, hh, { fill: night ? '#7A7598' : '#F6DFA4', lw: 6 });
    poly(ctx, [[hx - 60, hy + 6], [hx + hw / 2, hy - 230], [hx + hw + 60, hy + 6]], { fill: night ? '#3B2F4F' : '#C8553D', lw: 6 });
    box(ctx, hx + 600, hy - 190, 70, 130, { fill: night ? '#56496B' : '#B86B5A', lw: 5 }); // chimney
    const lit = night ? '#FFE28A' : '#BFE8F7';
    box(ctx, hx + 340, hy + 250, 130, 250, { fill: '#E4572E', r: 6, lw: 6 }); oval(ctx, hx + 446, hy + 380, 9, 9, { fill: '#F2C94C', lw: 3 });
    // windows: the kitchen one (left) glows red during the lockdown
    const kwin = night ? '#FF5A4D' : lit;
    ctx.save(); if (night) { ctx.shadowColor = '#FF3B30'; ctx.shadowBlur = 60 + 20 * Math.sin(t * 5); }
    box(ctx, hx + 70, hy + 240, 200, 150, { fill: kwin, lw: 6 }); ctx.restore();
    box(ctx, hx + 540, hy + 240, 200, 150, { fill: lit, lw: 6 });
    for (const x of [hx + 70, hx + 540]) { line(ctx, [[x + 100, hy + 240], [x + 100, hy + 390]], { lw: 5 }); line(ctx, [[x, hy + 315], [x + 200, hy + 315]], { lw: 5 }); }
    oval(ctx, hx + hw / 2, hy - 80, 50, 50, { fill: lit, lw: 6 });
    // path, mailbox, tree
    poly(ctx, [[hx + 350, hy + hh], [hx + 460, hy + hh], [hx + 560, 930], [hx + 300, 930]], { fill: night ? '#57557A' : '#E8E1D0', lw: 5 });
    box(ctx, 300, 760, 16, 170, { fill: '#8C5A2B', lw: 4 }); box(ctx, 240, 716, 140, 70, { fill: '#2E86AB', r: 30, lw: 5 });
    G.decor(() => text(ctx, 'PUDDLEFORD', 310, 760, { size: 15, color: '#FFFFFF' }));
    box(ctx, 1540, 640, 46, 290, { fill: '#8C5A2B', lw: 5 }); for (const [dx, dy, r] of [[0, -120, 130], [-90, -40, 90], [90, -50, 100]]) oval(ctx, 1563 + dx, 640 + dy, r, r * 0.9, { fill: night ? '#234B45' : '#4E9F5B', lw: 6 });
  };

  // ---------- cutaway: the beach ----------
  SETS.beach = (ctx, t) => {
    sky(ctx, 'day', 0, 0, W, 520);
    oval(ctx, 1500, 190, 90, 90, { fill: '#FFE066', lw: 0 }); cloud(ctx, 300 + t * 10, 160, 1.2); cloud(ctx, 1000 + t * 6, 110, 0.8);
    ctx.fillStyle = '#2E86AB'; ctx.fillRect(0, 430, W, 330);
    for (let r = 0; r < 5; r++) { ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; for (let i = 0; i < 9; i++) { const x = ((i * 260 + r * 90 + t * (30 + r * 14)) % (W + 300)) - 150, y = 470 + r * 54; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 40, y - 14, x + 80, y); ctx.stroke(); } }
    // sand and the foam line
    ctx.fillStyle = '#F5DFA0'; ctx.beginPath(); ctx.moveTo(0, 760); for (let x = 0; x <= W; x += 60) ctx.lineTo(x, 740 + Math.sin(x * 0.01 + t * 1.6) * 14); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 16; ctx.beginPath(); for (let x = 0; x <= W; x += 60) { const y = 740 + Math.sin(x * 0.01 + t * 1.6) * 14; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    for (let i = 0; i < 26; i++) oval(ctx, U.hash(i, 1) * W, 820 + U.hash(i, 2) * 240, 5, 3, { fill: '#DDBF78', lw: 0 });
    // a towel-less beach umbrella far left, a bucket
    line(ctx, [[220, 560], [200, 860]], { lw: 8 }); poly(ctx, [[60, 600], [220, 480], [390, 590], [300, 570], [220, 596], [140, 574]], { fill: '#E4572E', lw: 5 });
  };
  // the mattress (upright at rot 0; lying at rot -PI/2)
  SETS.mattress = (ctx, x, y, rot, wet) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    box(ctx, -150, -520, 300, 520, { fill: wet ? '#B9C7D8' : '#E8EEF7', r: 30, lw: 6 });
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) oval(ctx, -70 + c * 140, -440 + r * 120, 7, 7, { fill: '#8FA3BF', lw: 0 });
    for (let i = 0; i < 5; i++) line(ctx, [[-150, -480 + i * 110], [150, -480 + i * 110]], { lw: 2.5, color: '#B4C2D6' });
    ctx.restore();
  };

  // ---------- cutaway: the self-checkout ----------
  SETS.store = (ctx, t, o = {}) => {
    const old = o.old;
    ctx.fillStyle = old ? '#CFCBB8' : '#EAF2F4'; ctx.fillRect(0, 0, W, 760);
    ctx.fillStyle = old ? '#B9B4A0' : '#D5E3E6'; ctx.fillRect(0, 760, W, 320);
    for (let i = 0; i < 12; i++) line(ctx, [[i * 180 - 40, 760], [i * 220 - 300, H]], { lw: 3, color: old ? '#A39E8A' : '#BFD0D4' });
    line(ctx, [[0, 760], [W, 760]], { lw: 6 });
    // shelves of groceries
    for (let s = 0; s < 2; s++) {
      const x0 = s ? 1380 : 40, w = s ? 500 : 520;
      box(ctx, x0, 150, w, 560, { fill: '#FFFFFF', r: 6, lw: 5 });
      for (let r = 0; r < 4; r++) { const y = 280 + r * 140; line(ctx, [[x0, y], [x0 + w, y]], { lw: 5 }); for (let i = 0; i < 7; i++) { const c = ['#E4572E', '#F2C94C', '#7BC96F', '#2E86AB', '#8E5FBF', '#F28C28'][(i * 3 + r * 5 + s) % 6], hh = 56 + ((i * 7 + r * 3) % 4) * 14; box(ctx, x0 + 16 + i * (w - 30) / 7, y - hh - 3, (w - 30) / 7 - 12, hh, { fill: old ? G.tint(c, -0.25) : c, r: 6, lw: 3.5 }); } }
    }
    box(ctx, 640, 60, 640, 110, { fill: '#2FA4A0', r: 14, lw: 6 });
    G.decor(() => text(ctx, 'SAVE-A-LOT-ISH', 960, 136, { size: 58, color: '#FFFFFF' }));
    if (old) { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2.5; for (const [cx, cy] of [[1380, 150], [560, 150]]) for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + (cx > 1000 ? -1 : 1) * Math.cos(i * 0.3) * 150, cy + Math.sin(i * 0.3) * 150); ctx.stroke(); } }
  };
  // the kiosk. talk 0..1 lights its screen; alert makes the pole light flash
  SETS.kiosk = (ctx, t, x, y, talk, alert, old) => {
    box(ctx, x - 150, y - 300, 300, 300, { fill: '#59626B', r: 12, lw: 6 });
    box(ctx, x + 150, y - 150, 260, 150, { fill: '#8E9AA6', r: 8, lw: 6 }); // the bagging area
    poly(ctx, [[x + 200, y - 150], [x + 216, y - 290], [x + 344, y - 290], [x + 360, y - 150]], { fill: '#FDF6E3', lw: 5 });
    G.decor(() => text(ctx, 'THANK YOU', x + 280, y - 205, { size: 17, color: '#E4572E' }));
    box(ctx, x - 130, y - 520, 260, 200, { fill: '#2B3038', r: 14, lw: 6 });
    const red = alert > 0.02;
    box(ctx, x - 112, y - 502, 224, 164, { fill: red ? '#C62828' : '#2FA4A0', r: 8, lw: 0 });
    G.decor(() => { text(ctx, red ? 'UNEXPECTED' : 'WELCOME!', x, y - 440, { size: 26, color: '#FFFFFF' }); text(ctx, red ? 'ITEM' : 'SCAN ITEM', x, y - 404, { size: 26, color: '#FFFFFF' }); });
    for (let i = -4; i <= 4; i++) { const a = 3 + 16 * talk * (0.4 + 0.6 * Math.abs(Math.sin(i * 1.9 + t * 25))); line(ctx, [[x + i * 14, y - 366 - a], [x + i * 14, y - 366 + a]], { lw: 6, color: '#FFFFFF' }); }
    box(ctx, x - 100, y - 250, 200, 90, { fill: '#10151F', r: 8, lw: 5 }); line(ctx, [[x - 80, y - 205], [x + 80, y - 205]], { lw: 4, color: '#FF4D4D' });
    box(ctx, x - 8, y - 640, 16, 120, { fill: '#8E9AA6', lw: 4 });
    const on = red && Math.sin(t * 14) > 0;
    ctx.save(); if (on) { ctx.shadowColor = '#FF3B30'; ctx.shadowBlur = 50; } oval(ctx, x, y - 660, 30, 30, { fill: on ? '#FF3B30' : old ? '#6B7480' : '#7CFFB2', lw: 5 }); ctx.restore();
    if (old) { ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2.5; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(x - 150, y - 300); ctx.lineTo(x - 150 - Math.cos(i * 0.26) * 190, y - 300 - Math.sin(i * 0.26) * 190 + 190); ctx.stroke(); } for (let r = 1; r < 4; r++) { ctx.beginPath(); ctx.arc(x - 150, y - 300 + 190, r * 55, Math.PI, Math.PI * 1.5); ctx.stroke(); } }
  };

  // ---------- cutaway: the road to the lake ----------
  SETS.lake = (ctx, t) => {
    sky(ctx, 'evening', 0, 0, W, 640);
    oval(ctx, 1380, 470, 110, 110, { fill: '#FFE9A8', lw: 0 });
    for (let i = 0; i < 5; i++) poly(ctx, [[-100 + i * 460, 640], [130 + i * 460, 400 + (i % 2) * 60], [380 + i * 460, 640]], { fill: '#7C6A9A', lw: 0 });
    ctx.fillStyle = '#5FAF63'; ctx.fillRect(0, 640, W, 440);
    // the lake on the right
    ctx.fillStyle = '#2E86AB'; ctx.beginPath(); ctx.moveTo(1040, 700); ctx.quadraticCurveTo(1200, 640, W + 40, 650); ctx.lineTo(W + 40, H); ctx.lineTo(980, H); ctx.quadraticCurveTo(940, 860, 1040, 700); ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 5; ctx.lineCap = 'round'; for (let i = 0; i < 12; i++) { const x = 1100 + U.hash(i, 3) * 760 + Math.sin(t * 1.2 + i) * 14, y = 720 + U.hash(i, 4) * 320; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 30, y - 10, x + 60, y); ctx.stroke(); }
    // the road
    poly(ctx, [[-40, 800], [1010, 800], [985, 960], [-40, 960]], { fill: '#6B6E78', lw: 6 });
    ctx.fillStyle = '#F2C94C'; for (let x = 20; x < 940; x += 190) ctx.fillRect(x, 874, 100, 10);
    // signs
    box(ctx, 820, 560, 14, 240, { fill: '#8C5A2B', lw: 4 }); box(ctx, 720, 520, 220, 90, { fill: '#FFFFFF', r: 8, lw: 6 });
    G.decor(() => { text(ctx, 'LAKE', 830, 560, { size: 30, color: '#2E86AB' }); text(ctx, '(IT IS A LAKE)', 830, 592, { size: 17, color: INK }); });
  };
  // a small car, side view. y = road level under the wheels
  SETS.car = (ctx, t, x, y, rot, driver) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    poly(ctx, [[-210, -70], [-200, -150], [-120, -160], [-70, -250], [110, -250], [170, -160], [220, -146], [226, -70]], { fill: '#E4572E', lw: 6 });
    poly(ctx, [[-98, -166], [-58, -234], [16, -234], [16, -166]], { fill: '#BFE8F7', lw: 5 }); poly(ctx, [[34, -166], [34, -234], [100, -234], [142, -166]], { fill: '#BFE8F7', lw: 5 });
    if (driver) { ctx.save(); ctx.beginPath(); ctx.rect(30, -238, 116, 76); ctx.clip(); driver(ctx); ctx.restore(); }
    for (const wx of [-130, 140]) { oval(ctx, wx, -62, 56, 56, { fill: '#2A2320', lw: 5 }); oval(ctx, wx, -62, 24, 24, { fill: '#C9D3DC', lw: 4 }); }
    box(ctx, 214, -132, 20, 26, { fill: '#FFE066', r: 6, lw: 4 });
    ctx.restore();
  };

  // ---------- a rotating sunburst (titles, credits) ----------
  SETS.burst = (ctx, t, c1, c2, cx = W / 2, cy = H / 2) => {
    ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.12); ctx.fillStyle = c2;
    for (let i = 0; i < 12; i++) { const a0 = (i / 12) * 6.2832, a1 = a0 + 6.2832 / 24; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a0) * 2400, Math.sin(a0) * 2400); ctx.lineTo(Math.cos(a1) * 2400, Math.sin(a1) * 2400); ctx.fill(); }
    ctx.restore();
  };
})();
