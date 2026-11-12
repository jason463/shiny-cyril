// THE SOUNDTRACK — the dialogue track plus every note and sound effect, all synthesized from score.js.
//   node build-voice.js && node song.js      (STEMS=1 also writes out/stem-*.wav, LUFS=-14 sets the loudness)
const path = require('path');
const { SR, Bus, reverb } = require('./engine/audio/dsp');
const I = require('./engine/audio/instruments');
const MIX = require('./engine/audio/mix');
const Sing = require('./engine/audio/sing');
const U = require('./engine/util');
const sc = require('./score');
const { ev, TL, m, DURATION, CHORDS, PROG } = sc;

const out = path.join(__dirname, 'out');
const voice = MIX.loadAudio(path.join(out, 'voice.wav'), { length: DURATION });
const bus = () => new Bus(voice.n);
const drums = bus(), bass = bus(), brass = bus(), keys = bus(), choir = bus(), bed = bus(), fx = bus(), verb = bus();
const rng = U.mulberry32(11);
const stereo = (b, x, t, g) => b.addStereo(x.L, x.R, t, g);
const lineEnd = (start) => { const l = TL.lines.find((q) => q.text.startsWith(start)); if (!l) throw new Error('no line ' + start); return l.end; };
const lineAt = (start) => { const l = TL.lines.find((q) => q.text.startsWith(start)); if (!l) throw new Error('no line ' + start); return l.t; };

// ---------- the theme tune (titles: full band + the sung tag; credits: the same, a little lighter) ----------
const K = I.kick(), SN = I.snare(), CL = I.clap(), HC = [I.hat(false, 11), I.hat(false, 12)], CR = I.crash(18);
function playTheme(th, { g = 1, voices = 5 } = {}) {
  const ck = th.clock, B = ck.BEAT;
  ck.eachStep(0, 7, 8, (t, bar, s) => {
    const c = CHORDS[PROG[bar]];
    if (s % 4 === 0) drums.addMono(K, t, 0.9 * g);
    if (s % 4 === 2) { drums.addMono(SN, t, 0.5 * g); drums.addMono(CL, t, 0.28 * g); verb.addMono(CL, t, 0.1 * g); }
    drums.addMono(HC[s % 2], t, (s % 2 ? 0.2 : 0.11) * g, 0.3);
    if (s % 2 === 0) bass.addMono(I.bass(m(c.bass[s / 2]) + 12, B * 0.85, { sub: 0.7 }), t, 0.6 * g); // walking bass
    if (s % 2 === 1) c.notes.forEach((n, i) => keys.addMono(I.pluck(m(n) + 12, { decay: 0.12 }), t, 0.2 * g, (i - 1) * 0.4)); // offbeat comp
  });
  // tom pickup under the sung pickup, then the last bar: the big chord and a button
  [2.5, 3, 3.5].forEach((b, i) => drums.addMono(I.tom(150 - i * 22, 0.16), ck.T(6, b), 0.5 * g, -0.3 + i * 0.3));
  for (const n of th.melody) {
    const short = n.dur < B * 0.6;
    const a = I.brassNote(n.midi, n.dur * 0.9, { stab: short, bright: 1.1, seed: n.midi }), b = I.brassNote(n.midi - 12, n.dur * 0.9, { bright: 0.8, seed: n.midi + 50 });
    stereo(brass, a, n.t, 0.3 * g); stereo(brass, b, n.t, 0.17 * g); verb.addStereo(a.L, a.R, n.t, 0.08 * g);
    keys.addMono(I.marimba(n.midi, { thock: 0.2 }), n.t, 0.3 * g, 0.2);
  }
  for (const [t, len, gg] of [[th.hit, B * 2.3, 1], [ck.T(7, 3), B * 0.35, 0.9]]) {
    drums.addMono(K, t, 1 * g); drums.addMono(CR, t, 0.42 * g * gg, -0.1); drums.addMono(SN, t, 0.35 * g);
    for (const n of ['F3', 'A3', 'C4', 'F4', 'A4', 'C5']) stereo(brass, I.brassNote(m(n), len, { bright: 1.15, stab: len < 0.3, seed: m(n) + 7 }), t, 0.13 * g);
    bass.addMono(I.bass(m('F2'), len, { sub: 0.9 }), t, 0.7 * g);
  }
  // "the Pud-dle-FORDS!": a small unison choir from the formant singer
  const notes = th.sung.map((n) => ({ ...n, t: n.t - th.sung[0].t }));
  for (let k = 0; k < voices; k++) {
    const x = Sing.phrase(notes.map((n) => ({ ...n, midi: n.midi + (k === 3 ? 12 : 0) + (rng() - 0.5) * 0.25 })), { type: ['tenor', 'alto', 'tenor', 'soprano', 'alto'][k], vib: 0.14, breath: 0.1, seed: 40 + k, bright: 1.25 });
    choir.addMono(x, th.sung[0].t - x.lead + k * 0.008, 0.3 * g, (k - 2) * 0.3);
    verb.addMono(x, th.sung[0].t - x.lead, 0.07 * g);
  }
}
playTheme(sc.titles);
playTheme(sc.credits, { g: 0.9 });

// ---------- the establishing-shot stings ----------
for (const s of sc.stings) {
  if (s.tod === 'night') {
    ['D4', 'F4', 'A4', 'D5'].forEach((n, i) => { const x = I.pizz(m(n)); keys.addMono(x, s.t + i * 0.2, 0.5, -0.3 + i * 0.2); verb.addMono(x, s.t + i * 0.2, 0.15); });
    drums.addMono(I.timpani(m('D2')), s.t, 0.5);
    for (const n of ['D3', 'A3', 'F4']) stereo(bed, I.strings(m(n), 1.9, { attack: 0.3, release: 0.5, bright: 0.7, seed: m(n) }), s.t + 0.1, 0.12);
  } else {
    ['C5', 'F5', 'A5', 'C6'].forEach((n, i) => { const x = I.marimba(m(n)); keys.addMono(x, s.t + i * 0.14, 0.55, -0.3 + i * 0.2); verb.addMono(x, s.t + i * 0.14, 0.12); });
    ['A5', 'C6', 'F6'].forEach((n, i) => keys.addMono(I.marimba(m(n)), s.t + 0.95 + i * 0.14, 0.5, 0.3 - i * 0.2));
    bass.addMono(I.bass(m('F2'), 0.5), s.t, 0.5); bass.addMono(I.bass(m('C3'), 0.3), s.t + 0.95, 0.45); bass.addMono(I.bass(m('F2'), 0.6), s.t + 1.23, 0.5);
    keys.addMono(I.bell(1397, 0.5), s.t + 1.23, 0.12);
  }
}

// ---------- underscore ----------
// the lockdown: a low drone and a nervous pizzicato pulse (through the lock scene and the kale dinner)
function tension(t0, t1, g = 1) {
  for (const n of ['D2', 'A2']) stereo(bed, I.strings(m(n), t1 - t0, { attack: 1.2, release: 1.2, bright: 0.5, seed: m(n) }), t0, 0.1 * g);
  const seq = ['D3', 'D3', 'F3', 'D3', 'D3', 'D3', 'Ab3', 'G3'];
  for (let i = 0, t = t0 + 0.6; t < t1 - 0.5; i++, t += 0.52) bed.addMono(I.pizz(m(seq[i % 8])), t, 0.16 * g, i % 2 ? 0.25 : -0.25);
}
tension(ev.clunk, sc.S.lock[1]);
tension(sc.S.kale[0], sc.S.kale[1], 0.8);
// supermarket muzak under the self-checkout
function muzak(t0, t1) {
  const ch = [['F4', 'A4', 'C5', 'E5'], ['G4', 'Bb4', 'D5', 'F5']];
  for (let i = 0, t = t0; t < t1 - 0.4; i++, t += 0.8) {
    const c = ch[Math.floor(i / 2) % 2];
    if (i % 2 === 0) bass.addMono(I.bass(m(c[0]) - 24, 0.6, { bright: 0.4 }), t, 0.2);
    for (const n of c) bed.addMono(I.epiano(m(n), 0.5, { decay: 0.7 }), t + (i % 2 ? 0.4 : 0), 0.05, 0.2);
    bed.addMono(HC[i % 2], t + 0.4, 0.04, -0.4);
  }
}
muzak(sc.S.checkout[0], ev.weeks);
muzak(ev.later, sc.S.checkout[1]);
// hold music under the support hotline
{ const t0 = lineAt('Thank you for calling'), t1 = lineEnd('Thank you for calling');
  const arp = ['E6', 'G6', 'C7', 'G6'];
  for (let i = 0, t = t0; t < t1; i++, t += 0.19) bed.addMono(I.musicBox(m(arp[i % 4]), { decay: 0.25 }), t, 0.06, 0.4); }
// the cat's walk: a slow march, the theme's first phrase in long notes, swelling
{ const t0 = ev.catwalk, beat = (ev.paw - 0.45 - t0) / 8;
  ['C4', 'F4', 'A4', 'C5', 'A4', 'C5', 'F5', 'F5'].forEach((n, i) => {
    const g = 0.5 + i * 0.07;
    drums.addMono(I.timpani(m(i % 2 ? 'C2' : 'F2')), t0 + i * beat, 0.4 * g);
    if (i < 7) { const a = I.brassNote(m(n), beat * (i === 6 ? 1.9 : 0.95), { bright: 0.9, seed: 80 + i }); stereo(brass, a, t0 + i * beat, 0.22 * g); verb.addStereo(a.L, a.R, t0 + i * beat, 0.1 * g); }
  });
  for (const n of ['F3', 'C4', 'A4']) stereo(bed, I.strings(m(n), beat * 8, { attack: 2.5, release: 0.4, seed: m(n) + 3 }), t0, 0.16); }
// the door opens: a choir, bells, a cymbal
drums.addMono(CR, ev.open, 0.4); drums.addMono(K, ev.open, 0.9);
['F3', 'A3', 'C4', 'F4', 'A4', 'C5'].forEach((n, i) => { const x = I.voice(m(n), 2.7, { syl: 'a', type: i < 3 ? 'tenor' : 'alto', seed: 60 + i, vib: 0.2, breath: 0.12 }); choir.addMono(x, ev.open, 0.2, (i - 2.5) * 0.3); verb.addMono(x, ev.open, 0.12); });
for (let i = 0; i < 14; i++) { const x = I.bell([1397, 1760, 2093, 2794][i % 4], 0.3); keys.addMono(x, ev.open + 0.1 + i * 0.16, 0.07, (rng() - 0.5) * 1.4); verb.addMono(x, ev.open + 0.1 + i * 0.16, 0.05); }
// dinner: the theme on a music box, far away
[['C5', 0], ['F5', 0.3], ['A5', 0.6], ['F5', 1.2], ['A5', 1.5], ['C6', 1.8], ['A5', 2.6], ['G5', 3.2], ['F5', 3.5]].forEach(([n, d]) => { const x = I.musicBox(m(n)); keys.addMono(x, ev.dinner + 0.2 + d, 0.2, 0.2); verb.addMono(x, ev.dinner + 0.2 + d, 0.15); });

// ---------- sound effects, each tied to a moment in the score ----------
// cold open: the sheet comes off (whoosh, ta-da), the fridge boots (chime)
fx.addMono(I.noiseSweep(0.4, 500, 5000, { q: 1, pink: true, shape: (x) => x * x }), ev.reveal - 0.42, 0.3);
drums.addMono(K, ev.reveal, 0.9); drums.addMono(CR, ev.reveal, 0.3);
for (const n of ['F4', 'A4', 'C5', 'F5']) stereo(brass, I.brassNote(m(n), 0.9, { bright: 1.2, seed: m(n) + 20 }), ev.reveal, 0.16);
[880, 1108.7, 1318.5].forEach((f, i) => { const x = I.bell(f, 0.45); fx.addMono(x, ev.boot + i * 0.12, 0.3); verb.addMono(x, ev.boot + i * 0.12, 0.1); });
// access denied
for (const d of [0, 0.22]) fx.addMono(I.pulse(m('A2'), 0.17, { duty: 0.5 }), ev.deny + d, 0.3);
// the beach: surf, a gull, then the wave
{ const t0 = sc.S.beach[0];
  for (let i = 0; i < 3; i++) fx.addMono(I.noiseSweep(2.4, 400, 1400, { q: 0.7, pink: true }), t0 + i * 1.9, 0.1, i % 2 ? 0.4 : -0.4);
  for (const d of [0.35, 0.6]) fx.addMono(I.pulse(m('F6'), 0.14, { duty: 0.2, slide: -6 }), t0 + d, 0.07, 0.5);
  fx.addMono(I.noiseSweep(0.93, 200, 3200, { q: 0.9, pink: true, shape: (x) => x * x * x }), ev.waveRise, 0.3);
  fx.addMono(I.noiseSweep(1.6, 6000, 300, { q: 0.6, pink: true, shape: (x) => Math.pow(1 - x, 1.5) }), ev.waveCrash, 0.7);
  fx.addMono(I.subBoom(1.0, 80, 36), ev.waveCrash, 0.6); fx.addMono(I.thud(90, 0.12), ev.waveCrash, 0.8);
  fx.addMono(I.pop(1400), ev.gull, 0.4);
  for (const d of [0.25, 0.5]) fx.addMono(I.pulse(m('F6'), 0.14, { duty: 0.2, slide: -6 }), ev.gull + d, 0.1, 0.2); }
// footsteps: Otis runs in, Grandma Lou shuffles in
for (let i = 0; i < 5; i++) fx.addMono(I.woodTick(1.3 + (i % 2) * 0.2), ev.otisIn + 0.05 + i * 0.15, 0.2, -0.6 + i * 0.1);
for (let i = 0; i < 4; i++) fx.addMono(I.woodTick(0.7 + (i % 2) * 0.1), ev.louIn + 0.05 + i * 0.19, 0.22, -0.8 + i * 0.1);
// "The new password is: Gary cries." -> a sad trombone
{ const t = lineEnd('The new password') + 0.12;
  [['Bb3', 0, 0.26], ['A3', 0.28, 0.26], ['Ab3', 0.56, 0.9]].forEach(([n, d, len]) => stereo(brass, I.brassNote(m(n), len, { bright: 0.7, seed: m(n) }), t + d, 0.3)); }
// lockdown: three locks, a low blare
[[0, 70, 0.9], [0.24, 105, 0.6], [0.48, 120, 0.6]].forEach(([d, f, g]) => { fx.addMono(I.thud(f, 0.11), ev.clunk + d, g); fx.addMono(I.woodTick(0.5), ev.clunk + d, 0.4 * g); });
fx.addMono(I.subBoom(0.9, 70, 34), ev.clunk, 0.55);
fx.addMono(I.bwomp(), ev.clunk + 0.05, 0.3);
// self-checkout: beeps, then the "three weeks later" card
for (const t of [ev.beep1, ev.beep2]) fx.addMono(I.pulse(m('C6'), 0.11, { duty: 0.5 }), t, 0.16);
['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6'].forEach((n, i) => { const x = I.musicBox(m(n)); keys.addMono(x, ev.weeks + i * 0.07, 0.22, -0.5 + i * 0.12); verb.addMono(x, ev.weeks + i * 0.07, 0.15); });
// the kale cannon
fx.addMono(I.pop(900), ev.launch, 0.5); fx.addMono(I.noiseSweep(0.42, 700, 2600, { q: 1.5 }), ev.launch, 0.22);
fx.addMono(I.thud(140, 0.09), ev.splat, 0.9); fx.addMono(I.noiseSweep(0.4, 2800, 220, { q: 0.8, pink: true, shape: (x) => 1 - x }), ev.splat, 0.55); fx.addMono(I.pop(420), ev.splat + 0.02, 0.5);
// the lake: an engine, the plunge, bubbles, a duck
{ const t0 = sc.S.lake[0];
  fx.addMono(I.pulse(m('E2'), ev.drive - t0, { duty: 0.3, vib: 0.6 }), t0, 0.07);
  fx.addMono(I.pulse(m('E2'), ev.splash - ev.drive, { duty: 0.3, slide: 12 }), ev.drive, 0.1);
  fx.addMono(I.noiseSweep(1.5, 5000, 260, { q: 0.6, pink: true, shape: (x) => Math.pow(1 - x, 1.4) }), ev.splash, 0.7);
  fx.addMono(I.subBoom(1.1, 75, 34), ev.splash, 0.6); fx.addMono(I.thud(85, 0.12), ev.splash, 0.8);
  for (let i = 0; i < 7; i++) fx.addMono(I.pop(900 - i * 70, 30 + i), ev.splash + 0.7 + i * 0.21, 0.22, (rng() - 0.5));
  for (const d of [2.6, 2.85]) fx.addMono(I.pulse(m('A4'), 0.1, { duty: 0.14, slide: -4 }), ev.splash + d, 0.12, 0.5); }
// the cat: a drum for the look, a bell for the paw
drums.addMono(I.timpani(m('D2')), ev.catlook, 0.55);
{ const x = I.bell(1568, 0.9); fx.addMono(x, ev.paw, 0.4); verb.addMono(x, ev.paw, 0.2); }
// the toaster pops up; something low and ominous under it
fx.addMono(I.pop(1300), ev.pop, 0.6); fx.addMono(I.boing(), ev.pop, 0.3);
for (const n of ['D2', 'A2', 'D3', 'F3']) stereo(brass, I.brassNote(m(n), 2.2, { bright: 0.6, seed: m(n) + 31 }), ev.pop + 0.25, 0.14);
drums.addMono(I.timpani(m('D2')), ev.pop + 0.25, 0.5);

// ---------- mix: the music dips under every line; the dialogue sits on top ----------
const music = [drums, bass, brass, keys, choir, bed];
MIX.duck(music, voice, { depth: 0.6, release: 0.3 });
MIX.gate(bed, ev.credits - 0.05, DURATION); // the smash cut to the credits
const stems = { voice, drums, bass, brass, keys, choir, bed, fx, verb: reverb(verb, { room: 0.7, damp: 0.4 }) };
const GAIN = { voice: 1.9, drums: 0.36, bass: 0.6, brass: 1.35, keys: 0.6, choir: 1.5, bed: 2.0, fx: 0.9, verb: 0.8 }; // set with engine/tools/levels.js
const mix = MIX.mixdown(stems, GAIN, { stemDir: process.env.STEMS ? out : null });
MIX.highpass(mix, 28);
MIX.fadeOut(mix, DURATION - 1.2, DURATION);
const M = MIX.master(mix, 0.8, undefined, { lufs: process.env.LUFS ? parseFloat(process.env.LUFS) : -14 });
MIX.writeWav(path.join(out, 'music.wav'), mix);
console.log(`wrote out/music.wav (${DURATION.toFixed(2)}s, ${M.lufs.toFixed(1)} LUFS at drive ${M.drive.toFixed(2)})`);
