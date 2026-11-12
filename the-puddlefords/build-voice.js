// THE VOICES + THE TIMELINE:   node build-voice.js
// Speaks every line of script.js with offline text-to-speech (flite, pico2wave, espeak-ng + mbrola:
// all free, all local), measures each recording, and lays the episode out end to end.
//   -> timeline.js      scenes, lines (with word times), tags and the lip-sync track: what score.js reads
//   -> out/voice.wav    all the dialogue on one track, for song.js to mix under the music
// Every line is cached in out/.vo-cache, so only changed lines are spoken again.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { SR, Bus, OnePole } = require('./engine/audio/dsp');
const Voice = require('./engine/audio/voice');
const MIX = require('./engine/audio/mix');
const SCRIPT = require('./script');

const OUT = path.join(__dirname, 'out');
const CACHE = path.join(OUT, '.vo-cache');
fs.mkdirSync(CACHE, { recursive: true });
const GAP = 0.32; // the default pause after a line
const FPS = 30;

// ---------- one line -> a mono 48 kHz Float32Array ----------
function synth(text, v) {
  const key = crypto.createHash('sha1').update(JSON.stringify([v, text])).digest('hex').slice(0, 16);
  const f32 = path.join(CACHE, key + '.f32');
  if (fs.existsSync(f32)) { const b = fs.readFileSync(f32); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); }
  const raw = path.join(CACHE, key + '.raw.wav'), wav = path.join(CACHE, key + '.wav');
  if (v.eng === 'flite') execFileSync('flite', ['-voice', v.voice, '--setf', `duration_stretch=${v.stretch || 1}`, '-t', text, '-o', raw]);
  else if (v.eng === 'pico') execFileSync('pico2wave', ['-l', v.lang || 'en-US', '-w', raw, `<speed level='${v.speed || 100}'><pitch level='${v.pitch || 100}'>${text}</pitch></speed>`]);
  else if (v.eng === 'espeak') execFileSync('espeak-ng', ['-v', v.voice, '-s', String(v.rate || 150), '-p', String(v.pitch ?? 50), '-w', raw, text], { stdio: ['ignore', 'ignore', 'ignore'] });
  else throw new Error('unknown voice engine ' + v.eng);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-af', ['aresample=48000', v.fx].filter(Boolean).join(','), '-ac', '1', '-ar', '48000', wav]);
  const x = trim(Voice.decode(wav));
  fs.writeFileSync(f32, Buffer.from(x.buffer, x.byteOffset, x.byteLength));
  fs.rmSync(raw, { force: true }); fs.rmSync(wav, { force: true });
  return x;
}
// cut the silence at both ends (keeping 30 ms)
function trim(x) {
  const hop = SR / 100, n = Math.floor(x.length / hop), e = new Float32Array(n);
  let pk = 0;
  for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < hop; j++) { const q = x[i * hop + j]; s += q * q; } e[i] = Math.sqrt(s / hop); pk = Math.max(pk, e[i]); }
  let a = 0, b = n;
  while (a < b && e[a] < pk * 0.03) a++;
  while (b > a && e[b - 1] < pk * 0.03) b--;
  return x.slice(Math.max(0, (a - 3) * hop), Math.min(x.length, (b + 3) * hop));
}
const wordsOf = (s) => String(s).replace(/\s+/g, ' ').trim().split(' ').filter((w) => /[\p{L}\p{N}]/u.test(w));

// ---------- lay the episode out ----------
let t = 0;
const scenes = [], lines = [], tags = {}, placed = [];
for (const sc of SCRIPT.scenes) {
  const scene = { id: sc.id, set: sc.set, ...(sc.tod ? { tod: sc.tod } : {}), t0: +t.toFixed(3), shots: [] };
  let cam = 'wide';
  const shot = (c, at) => { if (c && (c !== cam || !scene.shots.length)) { cam = c; scene.shots.push({ t: +at.toFixed(3), cam: c }); } };
  shot('wide', t);
  for (const b of sc.beats) {
    if (b.wait != null) {
      if (b.tag) tags[`${sc.id}.${b.tag}`] = +t.toFixed(3);
      shot(b.cam, t);
      t += b.wait;
      continue;
    }
    const v = SCRIPT.voices[b.who];
    if (!v) throw new Error(`no voice for "${b.who}"`);
    const audio = synth(b.say || b.text, v);
    const dur = audio.length / SR;
    t += b.pre || 0;
    shot(b.cam, t - 0.06);
    // word times: share the line's time by syllables, snapped to quiet moments (captions + lip-sync)
    const ws = wordsOf(b.text);
    const fit = Voice.fit(audio, wordsOf(b.say || b.text), null);
    const words = ws.map((w, i) => { const f = fit[Math.min(i, fit.length - 1)] || { t: 0, end: dur }; return { w, t: +(t + f.t).toFixed(3), end: +(t + f.end).toFixed(3) }; });
    const line = { t: +t.toFixed(3), end: +(t + dur).toFixed(3), who: b.who, text: b.text, scene: sc.id, words };
    for (const k of ['emo', 'g', 'react', 'hold']) if (b[k]) line[k] = b[k];
    lines.push(line);
    placed.push({ at: t, audio, who: b.who });
    t += dur + (b.gap ?? GAP);
  }
  scene.t1 = +t.toFixed(3);
  scenes.push(scene);
}
const duration = +t.toFixed(3);

// ---------- the dialogue track: every line at the same loudness ----------
const bus = new Bus(Math.ceil((duration + 1) * SR));
for (const p of placed) {
  let s = 0, c = 0;
  for (let i = 0; i < p.audio.length; i++) if (Math.abs(p.audio[i]) > 0.01) { s += p.audio[i] * p.audio[i]; c++; }
  const g = c ? Math.min(8, 0.13 / Math.sqrt(s / c)) : 0;
  const hp = new OnePole();
  const x = new Float32Array(p.audio.length);
  const fade = Math.round(0.006 * SR);
  for (let i = 0; i < x.length; i++) x[i] = hp.hp(p.audio[i] * g, 90) * Math.min(1, i / fade, (x.length - 1 - i) / fade);
  bus.addMono(x, p.at, 1, 0);
}
MIX.writeWav(path.join(OUT, 'voice.wav'), bus);
const mouth = Voice.mouthTrack(bus, FPS);

const TL = { duration, scenes, lines, tags, mouth };
fs.writeFileSync(path.join(__dirname, 'timeline.js'),
  '// GENERATED by build-voice.js from script.js: do not edit. The measured timeline of the episode.\n' +
  '(function () { const TIMELINE = ' + JSON.stringify(TL) + ';\n' +
  "if (typeof module !== 'undefined') module.exports = TIMELINE; else globalThis.TIMELINE = TIMELINE; })();\n");

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
for (const s of scenes) console.log(`${mmss(s.t0).padStart(5)}  ${s.id.padEnd(9)} ${(s.t1 - s.t0).toFixed(1).padStart(5)}s  ${lines.filter((l) => l.scene === s.id).length} lines`);
const nw = lines.reduce((a, l) => a + l.words.length, 0);
console.log(`total ${mmss(duration)} (${duration}s), ${lines.length} lines, ${nw} words, speech ${lines.reduce((a, l) => a + l.end - l.t, 0).toFixed(1)}s`);
