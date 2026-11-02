#!/usr/bin/env node
// Scene development preview. Renders ONE scene as a single shot through the full
// post pipeline and writes PNG stills + a contact sheet, with timing.
//
//   node render/preview.js --scene NAME --times 20,56.3,120 [--out DIR]
//        [--w 960 --h 540] [--warmup 1.5] [--params 0,0,0,0] [--seed 0.37]
//        [--intensity 0.8] [--fx neutral|drop|raw] [--pal afterglow|ice|acid|ember|noir|dream] [--strip T0,T1,N]
//
// --times: song times (s) to capture; each capture renders `warmup` seconds of
//          frames before it (so feedback / iPrev effects are realistic).
// --strip: additionally render N evenly spaced frames from T0..T1 (contiguous
//          render, captures every k-th frame) into strip.png to judge motion/beat sync.
const fs = require('fs');
const path = require('path');
const { launch, writePNG, contactSheet, parseArgs } = require('./lib');

(async () => {
  const a = parseArgs(process.argv);
  if (!a.scene) { console.error('usage: --scene NAME --times t1,t2,...'); process.exit(1); }
  const W = +(a.w || 960), H = +(a.h || 540);
  const out = path.resolve(a.out || path.join(__dirname, '..', 'out', 'preview', a.scene));
  fs.mkdirSync(out, { recursive: true });
  const times = String(a.times || '20,60,100,125,150').split(',').map(Number);
  const warm = a.warmup != null ? +a.warmup : 1.0;
  const params = a.params ? String(a.params).split(',').map(Number) : [0, 0, 0, 0];
  while (params.length < 4) params.push(0);
  const { browser, page, info } = await launch({ W, H });
  const FPS = info.fps;
  const captured = [], labels = [];
  let msTotal = 0, nTimed = 0;
  try {
    for (const t of times) {
      const fEnd = Math.round(t * FPS);
      const shotLen = +(a.shotlen || 8);
      const start = Math.max(0, t - Math.max(warm, 0.0001) - (a.local ? +a.local : 0));
      await page.evaluate((o) => window.MV.useSingleScene(o), {
        scene: a.scene, start, end: start + Math.max(shotLen, t - start + 0.5), params, seed: a.seed != null ? +a.seed : 0.37,
        intensity: a.intensity != null ? +a.intensity : 0.8, fxPreset: a.fx || 'neutral', pal: a.pal || null,
      });
      const f0 = Math.round(start * FPS);
      const tStart = Date.now();
      for (let f = f0; f < fEnd; f++) await page.evaluate((f) => window.MV.renderFrame(f), f);
      await page.evaluate((f) => window.MV.timeRender(f), fEnd);   // renders fEnd + forces GPU sync
      const ms = (Date.now() - tStart) / (fEnd - f0 + 1);
      msTotal += ms; nTimed++;
      const b64 = await page.evaluate(() => window.MV.readFrameB64());
      const buf = Buffer.from(b64, 'base64');
      const file = path.join(out, `${a.scene}_t${t.toFixed(2)}.png`);
      writePNG(file, buf, W, H);
      captured.push(buf); labels.push(t);
      console.log(`t=${t.toFixed(2)}s  frame=${fEnd}  ${ms.toFixed(0)} ms/frame  -> ${file}`);
    }
    if (captured.length > 1) {
      const cols = Math.min(3, captured.length);
      const sheet = path.join(out, 'sheet.png');
      contactSheet(sheet, captured, W, H, cols, Math.min(1, 640 / W), labels);
      console.log('contact sheet ->', sheet);
    }
    if (a.strip) {
      const [t0, t1, n] = String(a.strip).split(',').map(Number);
      const start = Math.max(0, t0 - warm);
      await page.evaluate((o) => window.MV.useSingleScene(o), {
        scene: a.scene, start, end: t1 + 1, params, seed: a.seed != null ? +a.seed : 0.37,
        intensity: a.intensity != null ? +a.intensity : 0.8, fxPreset: a.fx || 'neutral', pal: a.pal || null,
      });
      const f0 = Math.round(start * FPS), fa = Math.round(t0 * FPS), fb = Math.round(t1 * FPS);
      const step = Math.max(1, Math.floor((fb - fa) / Math.max(1, n - 1)));
      const frames = [];
      for (let f = f0; f <= fb; f++) {
        await page.evaluate((f) => window.MV.renderFrame(f), f);
        if (f >= fa && (f - fa) % step === 0 && frames.length < n) frames.push(Buffer.from(await page.evaluate(() => window.MV.readFrameB64()), 'base64'));
      }
      const sheet = path.join(out, 'strip.png');
      contactSheet(sheet, frames, W, H, Math.min(6, frames.length), Math.min(0.5, 400 / W));
      console.log(`strip ${t0}..${t1} (${frames.length} frames, every ${step} frames) -> ${sheet}`);
    }
    console.log(`avg render ${(msTotal / Math.max(1, nTimed)).toFixed(0)} ms/frame at ${W}x${H} (${info.renderer})`);
  } catch (e) {
    console.error('ERROR:', e.message || e);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
})();
