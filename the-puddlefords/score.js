// THE SCORE — the single source of truth for sound AND picture.
// The dialogue decides the timing: build-voice.js measures every spoken line and writes timeline.js
// (scenes, lines, tags). This file adds the music on top (the theme tune, the stings, the hits) and
// names the moments. song.js and film.js both read it, so they cannot drift apart.
(function () {
  const node = typeof require !== 'undefined';
  const U = node ? require('./engine/util') : globalThis.U;
  const MU = node ? require('./engine/music') : globalThis.MUSIC;
  const TL = node ? require('./timeline') : globalThis.TIMELINE;
  const { m, makeClock, placeBar } = MU;

  const FPS = 30;
  const FORMAT = '16:9';
  const STYLE = 'paper'; // film.js turns the hatching and the line boil off: clean ink outlines, flat colour
  const [W, H] = U.formatSize(FORMAT);
  const SAFE = U.safeArea(W, H);
  const DURATION = TL.duration;

  const scene = (id) => TL.scenes.find((s) => s.id === id);
  const tag = (name) => { if (TL.tags[name] == null) throw new Error('no tag ' + name); return TL.tags[name]; };
  const S = Object.fromEntries(TL.scenes.map((s) => [s.id, [s.t0, s.t1]])); // sections = scenes

  // ---------- the theme tune: 8 bars at 152 bpm, played in the titles and again under the credits ----------
  const BPM = 152;
  const clock = makeClock({ bpm: BPM, offset: scene('title').t0 + 0.15 });
  const credClock = makeClock({ bpm: BPM, offset: scene('credits').t0 + 0.25 });
  const { T, BEAT } = clock;
  const CHORDS = { // per bar
    F: { notes: ['A3', 'C4', 'F4'], bass: ['F2', 'A2', 'C3', 'D3'] },
    Dm: { notes: ['A3', 'D4', 'F4'], bass: ['D2', 'F2', 'A2', 'C3'] },
    Bb: { notes: ['Bb3', 'D4', 'F4'], bass: ['Bb1', 'D2', 'F2', 'G2'] },
    C: { notes: ['G3', 'C4', 'E4'], bass: ['C2', 'E2', 'G2', 'Bb2'] },
  };
  const PROG = ['F', 'Dm', 'Bb', 'C', 'F', 'Bb', 'C', 'F'];
  const TUNE = [ // 8th-note grid: [note, start8th, dur8ths]
    [['C5', 0, 1], ['F5', 1, 1], ['A5', 2, 2], ['F5', 4, 1], ['A5', 5, 1], ['C6', 6, 2]],
    [['A5', 0, 2], ['G5', 2, 1], ['F5', 3, 1], ['D5', 4, 2], ['F5', 6, 2]],
    [['D5', 0, 1], ['F5', 1, 1], ['Bb5', 2, 2], ['A5', 4, 1], ['G5', 5, 1], ['F5', 6, 2]],
    [['E5', 0, 2], ['G5', 2, 2], ['C6', 4, 3], ['Bb5', 7, 1]],
    [['A5', 0, 2], ['F5', 2, 1], ['A5', 3, 1], ['C6', 4, 2], ['A5', 6, 2]],
    [['Bb5', 0, 2], ['G5', 2, 1], ['Bb5', 3, 1], ['D6', 4, 2], ['Bb5', 6, 2]],
    [['E5', 0, 1], ['G5', 1, 1], ['C6', 2, 2]],
    [['F5', 0, 5]],
  ];
  const theme = (ck) => ({
    clock: ck,
    melody: TUNE.flatMap((bar, i) => placeBar(ck, bar, i)),
    // the sung tag: "the Pud-dle-FORDS!", three pickup 8ths into the last downbeat
    sung: [
      { t: ck.T(6, 2.5), dur: ck.BEAT / 2, midi: m('C4'), syl: 'thuh' }, { t: ck.T(6, 3), dur: ck.BEAT / 2, midi: m('F4'), syl: 'pud' },
      { t: ck.T(6, 3.5), dur: ck.BEAT / 2, midi: m('A4'), syl: 'dul' }, { t: ck.T(7), dur: ck.BEAT * 2.4, midi: m('C5'), syl: 'fords' },
    ],
    hit: ck.T(7), end: ck.T(8),
  });
  const titles = theme(clock), credits = theme(credClock);
  // who pops onto the title card, one per bar
  const titleCast = ['frij', 'gary', 'denise', 'mabel', 'otis', 'lou', 'cat'].map((who, i) => ({ who, t: T(i) }));

  // ---------- the moments (every sound effect and every piece of action hangs off one of these) ----------
  const ev = {
    reveal: tag('cold.reveal') + 0.45, // the sheet comes off the fridge: ta-da
    boot: tag('cold.boot') + 0.35, // the fridge wakes up
    logo: titles.hit,
    deny: tag('cheese.deny') + 0.25, // the buzzer
    waveRise: tag('beach.wave'), waveCrash: tag('beach.wave') + 0.95, gull: tag('beach.after') + 1.0,
    otisIn: tag('deal.start'), louIn: tag('deal.louIn'),
    clunk: tag('lock.clunk') + 0.4, // every lock in the house, and the lights go red
    beep1: tag('checkout.beep1') + 0.1, beep2: tag('checkout.beep2') + 0.1, weeks: tag('checkout.weeks'), later: tag('checkout.later'),
    launch: tag('kale.splat') + 0.3, splat: tag('kale.splat') + 0.75,
    drive: tag('lake.splash'), splash: tag('lake.splash') + 1.05,
    catlook: tag('manual.catlook') + 0.5, catwalk: tag('manual.catwalk'), paw: tag('manual.paw') + 0.45, open: tag('manual.open') + 0.5,
    dinner: tag('dinner.start'),
    pop: tag('toaster.pop') + 0.35,
    credits: scene('credits').t0,
  };
  const stings = TL.scenes.filter((s) => s.set === 'exterior').map((s) => ({ t: s.t0 + 0.2, tod: s.tod }));

  const markers = {
    reveal: { t: ev.reveal, sync: 'av' },
    boot: ev.boot,
    logo: { t: ev.logo, sync: 'av' },
    deny: ev.deny,
    wave: { t: ev.waveCrash, sync: 'av' },
    clunk: { t: ev.clunk, sync: 'av' },
    weeks: ev.weeks,
    splat: { t: ev.splat, sync: 'av' },
    splash: { t: ev.splash, sync: 'av' },
    catlook: ev.catlook,
    paw: ev.paw,
    open: { t: ev.open, sync: 'av' },
    pop: ev.pop,
    credits: { t: ev.credits, sync: 'v' },
  };

  const SCORE = { FPS, FORMAT, STYLE, W, H, SAFE, DURATION, clock, T, BEAT, BPM, S, m, TL, scene, tag, CHORDS, PROG, titles, credits, titleCast, ev, stings, markers };
  if (node) module.exports = SCORE; else globalThis.SCORE = SCORE;
})();
