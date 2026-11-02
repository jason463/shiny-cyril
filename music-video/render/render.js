#!/usr/bin/env node
// Full timeline render -> segmented H.264 files (resumable) -> concat + audio mux.
//
//   node render/render.js [--from 0] [--to 209.9] [--w 1280 --h 720] [--seg 20]
//        [--crf 14] [--dir out/segs] [--final out/music_video.mp4] [--audio song.mp3]
//        [--frames 100,200 --pngdir DIR]   (stills mode: render listed frames to PNG)
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { launch, writePNG, contactSheet, parseArgs, ROOT } = require('./lib');

function ffmpegWriter(file, W, H, crf) {
  const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', '30',
    '-i', '-', '-vf', 'vflip', '-c:v', 'libx264', '-preset', process.env.MV_PRESET || 'ultrafast', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-g', '60', file],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
  return {
    write: (buf) => new Promise((res) => { if (ff.stdin.write(buf)) res(); else ff.stdin.once('drain', res); }),
    end: async () => { ff.stdin.end(); await done; },
  };
}

(async () => {
  const a = parseArgs(process.argv);
  const W = +(a.w || 1280), H = +(a.h || 720);
  const { browser, page, info, server, origin } = await launch({ W, H });
  const FPS = info.fps;
  const tl = await page.evaluate((fb) => window.MV.useTimeline(window.MV_TIMELINE, { fallback: fb }), a.fallback || null);
  if (tl.missing && tl.missing.length) console.log('MISSING scenes (using fallback):', tl.missing.join(', '));
  console.log(`engine ${info.W}x${info.H}, ${tl.shots} shots, scenes: ${tl.scenes.join(', ')}`);

  if (a.frames) {           // stills mode
    const frames = String(a.frames).split(',').map(Number);
    const dir = path.resolve(a.pngdir || path.join(ROOT, 'out', 'stills'));
    fs.mkdirSync(dir, { recursive: true });
    const bufs = [];
    for (const fr of frames) {
      const warm = +(a.warm || 30);
      for (let f = Math.max(0, fr - warm); f < fr; f++) await page.evaluate((f) => window.MV.renderFrame(f), f);
      const buf = Buffer.from(await page.evaluate((f) => window.MV.renderAndRead(f), fr), 'base64');
      writePNG(path.join(dir, `f${String(fr).padStart(5, '0')}.png`), buf, W, H);
      bufs.push(buf);
      console.log('frame', fr, (fr / FPS).toFixed(2) + 's');
    }
    if (bufs.length > 1) contactSheet(path.join(dir, 'sheet.png'), bufs, W, H, Math.min(4, bufs.length), Math.min(1, 480 / W));
    await browser.close();
    return;
  }

  const NF = info.NF;
  const f0 = Math.round(+(a.from || 0) * FPS), f1 = Math.min(NF, Math.round(+(a.to || NF / FPS) * FPS));
  const segF = Math.round(+(a.seg || 20) * FPS);
  const dir = path.resolve(a.dir || path.join(ROOT, 'out', `segs_${W}x${H}`));
  fs.mkdirSync(dir, { recursive: true });
  const crf = +(a.crf || 14);
  const t0 = Date.now();
  let rendered = 0;
  const total = f1 - f0;
  for (let s = Math.floor(f0 / segF) * segF; s < f1; s += segF) {
    const e = Math.min(s + segF, NF);
    const file = path.join(dir, `seg_${String(s).padStart(5, '0')}_${String(e).padStart(5, '0')}.mp4`);
    if (fs.existsSync(file) && !a.force) { console.log('skip existing', path.basename(file)); continue; }
    if (a.defer) {   // --defer scene1,scene2 : skip segments that show these scenes (render them in a later run)
      const deferred = String(a.defer).split(',');
      const uses = await page.evaluate(([t0, t1]) => window.MV.timeline.shots.filter((x) => x.renderStart < t1 && x.end > t0).map((x) => x.scene), [(s - 45) / FPS, e / FPS]);
      if (uses.some((x) => deferred.includes(x))) { console.log('defer', path.basename(file), '(uses', [...new Set(uses)].join(','), ')'); continue; }
    }
    const tmp = file.replace('.mp4', '.part.mp4');
    // warm-up: feedback buffers only need history back to the start of the shots active at s
    const rsMin = await page.evaluate((t) => Math.min(...window.MV.timeline.shots.filter((x) => x.renderStart <= t && x.end > t).map((x) => x.renderStart), t), s / FPS);
    const warm = Math.max(0, Math.min(s - 8, Math.max(s - 45, Math.floor(rsMin * FPS))));
    for (let f = warm; f < s; f++) await page.evaluate((f) => window.MV.renderFrame(f), f);
    const w = ffmpegWriter(tmp, W, H, crf);
    // frames arrive via HTTP POST; write them to ffmpeg strictly in order
    const pending = new Map();
    let next = s;
    let chain = Promise.resolve();
    server.onFrame = (i, buf) => {
      pending.set(i, buf);
      chain = chain.then(async () => {
        while (pending.has(next)) {
          const b = pending.get(next); pending.delete(next);
          await w.write(b);
          next++; rendered++;
          if (rendered % 30 === 0) {
            const el = (Date.now() - t0) / 1000, rate = rendered / el;
            console.log(`frame ${next}/${NF} (${(next / FPS).toFixed(1)}s)  ${(1000 / rate).toFixed(0)} ms/frame  ETA ${((total - rendered) / rate / 60).toFixed(1)} min`);
          }
        }
      });
      return chain;
    };
    await page.evaluate(([a, b, url]) => window.MV.renderRangePost(a, b, url, 3), [s, e, origin + '/frame']);
    await chain;
    if (next !== e) throw new Error(`segment incomplete: got up to ${next}, expected ${e}`);
    await w.end();
    fs.renameSync(tmp, file);
    console.log('wrote', path.basename(file));
  }
  await browser.close();

  if (a.final) {
    const segs = fs.readdirSync(dir).filter((x) => /^seg_\d+_\d+\.mp4$/.test(x)).sort();
    const list = path.join(dir, 'list.txt');
    fs.writeFileSync(list, segs.map((x) => `file '${path.join(dir, x)}'`).join('\n'));
    const audio = a.audio;
    const final = path.resolve(a.final);
    const args = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list];
    if (audio) args.push('-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '320k', '-shortest');
    if (a.upscale) {
      const [UW, UH] = String(a.upscale).split('x');
      args.push('-vf', `scale=${UW}:${UH}:flags=lanczos`, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(a.finalcrf || 17), '-pix_fmt', 'yuv420p');
    } else args.push('-c:v', 'copy');
    args.push('-movflags', '+faststart', final);
    execFileSync('ffmpeg', args, { stdio: 'inherit' });
    console.log('final ->', final);
  }
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
