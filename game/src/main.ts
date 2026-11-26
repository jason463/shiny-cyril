import './ui/styles.css';
import { Sim, GameEvent } from './sim/sim';
import { Bot } from './sim/bot';
import { ACHIEVEMENTS, AchDef, ENEMIES, MAX_DEPTH, STAGES } from './sim/data';
import { Renderer, Hud } from './render/renderer';
import { AudioEngine } from './audio/audio';
import { Input } from './input';
import { UI } from './ui/ui';
import { SaveData, defaultSave, loadSave, storeSave } from './save';

type Mode = 'title' | 'play' | 'pause' | 'choice' | 'ending' | 'results';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;

let save: SaveData = loadSave();
const renderer = new Renderer(canvas);
const audio = new AudioEngine();
const input = new Input(canvas);

let mode: Mode = 'title';
let sim = new Sim({ seed: Date.now() % 1e9, brush: 'bamboo', depth: 1, attract: true });
let bot = new Bot(1);
let autoplay = false;
let freeze = 0;
let endT = 0;
let attractT = 0;
let hint = '';
let tutorial = { step: 0, moved: 0, t: 0, lx: 0, ly: 0 };
let runDeeds: AchDef[] = [];
let framed = false;
try {
  framed = window.self !== window.top;
} catch {
  framed = true;
}

const ui = new UI(uiRoot, save, {
  begin: () => beginRun(),
  resume: () => resume(),
  abandon: () => finishRun(false),
  toTitle: () => toTitle(),
  choose: (i) => {
    sim.choose(i);
    ui.hide();
    setMode('play');
  },
  pause: () => pause(),
  changed: () => {
    applySettings();
    storeSave(save);
  },
  resetProgress: () => {
    save = defaultSave();
    ui.setSave(save);
    storeSave(save);
    applySettings();
    ui.title();
  },
  fullscreen: (on) => {
    try {
      if (on) void document.documentElement.requestFullscreen?.().catch(() => undefined);
      else if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
    } catch {
      // fullscreen is optional
    }
  },
  savePainting: (c) => {
    c.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `inkwake-${Date.now()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
  },
  sound: (k) => {
    audio.start();
    audio.ui(k);
  },
});

function applySettings(): void {
  audio.musicVol = save.settings.music;
  audio.sfxVol = save.settings.sfx;
  audio.applyVolumes();
  renderer.shakeScale = save.settings.shake;
}

function setMode(m: Mode): void {
  mode = m;
  input.playing = m === 'play';
  if (m !== 'play') input.releaseAll();
  ui.playChrome(m === 'play');
  audio.duck = m === 'play' || m === 'ending' ? 1 : m === 'title' ? 0.7 : 0.45;
  audio.applyVolumes();
  canvas.style.cursor = m === 'play' ? 'crosshair' : 'default';
}

function toTitle(): void {
  sim = new Sim({ seed: Date.now() % 1e9, brush: save.brush, depth: 1, attract: true });
  bot = new Bot(1);
  renderer.reset();
  renderer.snap(sim);
  attractT = 0;
  hint = '';
  setMode('title');
  ui.title();
}

function beginRun(): void {
  audio.start();
  sim = new Sim({ seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0, brush: save.brush, depth: save.depth });
  bot = new Bot(1);
  renderer.reset();
  renderer.snap(sim);
  runDeeds = [];
  freeze = 0;
  tutorial = { step: save.tutorialDone ? 9 : 0, moved: 0, t: 0, lx: sim.player.x, ly: sim.player.y };
  hint = '';
  ui.hide();
  setMode('play');
  processEvents();
}

function pause(): void {
  if (mode !== 'play') return;
  setMode('pause');
  ui.pause(sim);
}

function resume(): void {
  ui.hide();
  setMode('play');
}

function deed(id: string): void {
  if (save.achievements.includes(id)) return;
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) return;
  save.achievements.push(id);
  runDeeds.push(a);
  if (mode === 'play') ui.toast(`Deed: ${a.name}`, 3);
}

function processEvents(): void {
  const evs = sim.events;
  if (!evs.length) return;
  sim.events = [];
  for (const ev of evs) {
    renderer.handle(ev, sim);
    if (sim.attract) continue;
    react(ev);
  }
}

function react(ev: GameEvent): void {
  switch (ev.type) {
    case 'loop':
      if (ev.src === 'brush' && ev.n === 0) audio.emptyLoop();
      else audio.loop(ev.kills, ev.enso);
      if (ev.kills >= 3) freeze = Math.max(freeze, Math.min(0.1, 0.02 + ev.kills * 0.007));
      if (ev.kills >= 1) deed('first');
      if (ev.n >= 5) deed('five');
      if (ev.n >= 12) deed('twelve');
      if (ev.n >= 20) deed('twenty');
      if (ev.enso) deed('enso');
      if (sim.tally.ensos >= 10) deed('enso10');
      if (sim.tally.loops >= 100) deed('hundred');
      if (tutorial.step === 1 && ev.kills >= 1) {
        tutorial.step = 2;
        tutorial.t = 0;
      }
      break;
    case 'kill':
      if (!ev.quiet) {
        if (!save.seen.includes(ev.kind)) save.seen.push(ev.kind);
        if (ev.kind === 'giant') deed('giant');
        if (ev.kind === 'boss') deed('boss');
      }
      break;
    case 'hurt':
      audio.hurt();
      freeze = Math.max(freeze, 0.09);
      break;
    case 'shield':
      audio.charm();
      break;
    case 'charm':
      audio.charm();
      break;
    case 'heal':
      audio.heal();
      break;
    case 'dash':
      audio.dash();
      break;
    case 'cut':
      audio.cut();
      break;
    case 'shot':
      audio.shot();
      break;
    case 'bolt':
      audio.bolt();
      break;
    case 'levelup':
      audio.levelUp();
      break;
    case 'stage':
      if (ev.index >= 1) deed('margin');
      break;
    case 'stageClear':
      audio.stageClear();
      if (ev.untouched) deed('untouched');
      break;
    case 'arrive':
      audio.arrive();
      ui.toast(ev.kind === 'boss' ? 'The Stain rises. Ring it while it is whole.' : 'A Great Blot is seeping in. It takes four rings.', 4.5);
      break;
    case 'bossReel':
      audio.bossHit();
      break;
    case 'bossDown':
      audio.bossHit();
      audio.win();
      freeze = 0.2;
      break;
    case 'death':
      audio.death();
      endT = 1.5;
      setMode('ending');
      break;
    case 'win':
      endT = 0.4;
      setMode('ending');
      break;
    default:
      break;
  }
}

function finishRun(won: boolean): void {
  const t = sim.tally;
  const depthMul = 1 + 0.25 * (sim.depth - 1);
  const earned = Math.round((Math.floor(t.kills / 8) + t.stagesCleared * 10 + (won ? 40 : 0)) * depthMul);
  const best = t.score > save.best;
  let newDepth: number | null = null;

  save.seals += earned;
  save.runs++;
  save.totalKills += t.kills;
  if (best) save.best = t.score;
  if (save.totalKills >= 1000) deed('thousand');
  if (won) {
    save.wins++;
    if (sim.brush.id !== 'bamboo') deed(sim.brush.id);
    if (sim.depth >= 3) deed('depth3');
    if (sim.depth >= 5) deed('depth5');
    if (sim.depth >= save.depthUnlocked && save.depthUnlocked < MAX_DEPTH) {
      save.depthUnlocked++;
      newDepth = save.depthUnlocked;
    }
  }
  if (tutorial.step > 1) save.tutorialDone = true;
  storeSave(save);

  setMode('results');
  ui.results({
    won, score: t.score, best: best && t.score > 0, kills: t.kills, loops: t.loops, ensos: t.ensos, biggest: t.best,
    time: sim.time, stageName: STAGES[Math.min(sim.stage, STAGES.length - 1)].name, earned,
    newDeeds: runDeeds, newDepth, painting: renderer.painting(), canSave: !framed,
  });
}

// ---------------------------------------------------------------- tutorial hints

function updateHints(dt: number): void {
  if (tutorial.step >= 9) {
    hint = '';
    return;
  }
  const p = sim.player;
  tutorial.moved += Math.hypot(p.x - tutorial.lx, p.y - tutorial.ly);
  tutorial.lx = p.x;
  tutorial.ly = p.y;
  tutorial.t += dt;
  const dev = input.device;
  if (tutorial.step === 0) {
    hint = dev === 'touch' ? 'Drag anywhere to guide the brush'
      : dev === 'keys' ? 'WASD or arrow keys guide the brush'
      : dev === 'pad' ? 'The left stick guides the brush'
      : 'The brush follows your pointer';
    if (tutorial.moved > 260) {
      tutorial.step = 1;
      tutorial.t = 0;
    }
  } else if (tutorial.step === 1) {
    hint = 'Circle the spirits, then cross your own line';
  } else if (tutorial.step === 2) {
    hint = 'Wider rings seal more. Rounder rings strike harder.';
    if (tutorial.t > 6) {
      tutorial.step = 3;
      tutorial.t = 0;
    }
  } else if (tutorial.step === 3) {
    hint = dev === 'touch' ? 'Tap with a second finger to flick out of danger'
      : dev === 'keys' ? 'Space flicks you out of danger'
      : dev === 'pad' ? 'Press A to flick out of danger'
      : 'Click to flick out of danger';
    if (tutorial.t > 6) {
      tutorial.step = 9;
      save.tutorialDone = true;
      storeSave(save);
    }
  }
}

// ---------------------------------------------------------------- frame loop

function stepSim(dt: number, mx: number, my: number, dash: boolean): void {
  const steps = Math.max(1, Math.ceil(dt / (1 / 60)));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    sim.update(h, { x: mx, y: my, dash: dash && i === 0 });
    processEvents();
    if (sim.phase !== 'play' || mode !== 'play' && mode !== 'title') break;
  }
}

let last = performance.now();

function frame(now: number): void {
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  ui.tick(dt);

  if (mode === 'title') {
    const cmd = bot.think(sim, dt);
    stepSim(dt, cmd.x * 0.8, cmd.y * 0.8, false);
    attractT += dt;
    if (attractT > 150) {
      // start a clean sheet now and then so the demo never turns solid black
      sim = new Sim({ seed: Date.now() % 1e9, brush: save.brush, depth: 1, attract: true });
      renderer.reset();
      attractT = 0;
    }
  } else if (mode === 'play') {
    if (input.takePause()) {
      pause();
    } else if (freeze > 0) {
      freeze -= dt;
      input.pollPad();
    } else {
      const sp = renderer.toScreen(sim.player.x, sim.player.y);
      let mv = input.move(sp.x, sp.y);
      let dash = input.takeDash();
      if (autoplay) {
        const cmd = bot.think(sim, dt);
        mv = { x: cmd.x, y: cmd.y };
        dash = cmd.dash;
      }
      stepSim(dt, mv.x, mv.y, dash);
      updateHints(dt);
      if (sim.phase === 'levelup' || sim.phase === 'relic') {
        setMode('choice');
        ui.choice(sim);
        if (autoplay) window.setTimeout(() => mode === 'choice' && (sim.choose(0), ui.hide(), setMode('play')), 600);
      }
    }
    const crowd = Math.min(1, sim.enemies.length / 60);
    audio.intensity += ((sim.boss ? Math.max(0.75, crowd) : crowd) - audio.intensity) * Math.min(1, dt * 0.8);
  } else if (mode === 'ending') {
    endT -= dt;
    if (endT <= 0) finishRun(sim.phase === 'won');
  }

  if (mode !== 'play') {
    input.pollPad(dt);
    const n = input.nav;
    if (n.dx || n.dy) ui.nav(n.dx + n.dy > 0 ? 1 : -1);
    if (n.ok) ui.activate();
    if (n.back) ui.goBack();
    if (mode !== 'ending') audio.intensity += (0 - audio.intensity) * Math.min(1, dt * 0.5);
  }

  // on the title screen the demo is framed beside (or above) the menu, not under it
  const portrait = renderer.H > renderer.W;
  const fx = mode === 'title' ? (portrait ? 0.5 : 0.7) : 0.5, fy = mode === 'title' && portrait ? 0.24 : 0.5;
  renderer.focus.x += (fx - renderer.focus.x) * Math.min(1, dt * 4);
  renderer.focus.y += (fy - renderer.focus.y) * Math.min(1, dt * 4);

  const ins = ui.insets();
  input.layout(renderer.W, renderer.H, ins.r);
  const hud: Hud = {
    attract: mode === 'title',
    hint: mode === 'play' ? hint : '',
    touch: input.device === 'touch',
    stick: mode === 'play' ? input.stick : null,
    dashBtn: mode === 'play' ? input.dashBtn : null,
    insetL: ins.l,
    insetR: ins.r,
  };
  // world effects keep animating under menus, but the world itself holds still
  renderer.draw(sim, mode === 'pause' || mode === 'choice' || mode === 'results' ? 0 : dt, hud);
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- boot

function resize(): void {
  const r = canvas.getBoundingClientRect();
  renderer.resize(r.width, r.height);
}

window.addEventListener('resize', resize);
if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (mode === 'play') pause();
    audio.suspend(true);
  } else {
    audio.suspend(false);
    last = performance.now();
  }
});
// sound may only start after a gesture
const unlock = () => audio.start();
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

renderer.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
applySettings();
resize();
renderer.snap(sim);
void document.fonts?.load?.('800 40px "Shippori Mincho B1"');
void document.fonts?.load?.('600 20px "Shippori Mincho B1"');
void document.fonts?.load?.('500 14px "Zen Kaku Gothic New"');
toTitle();
requestAnimationFrame(frame);

// A handle for automated play-testing: lets a script start a run and hand the brush to the bot.
(window as unknown as Record<string, unknown>).__inkwake = {
  get sim() {
    return sim;
  },
  get mode() {
    return mode;
  },
  begin: beginRun,
  autoplay(on: boolean) {
    autoplay = on;
  },
  /** renders 16 s of music plus a pile of simultaneous effects offline and reports levels */
  async audioProbe() {
    const rate = 44100, secs = 16;
    const off = new OfflineAudioContext(2, rate * secs, rate);
    const a = new AudioEngine();
    a.intensity = 0.8;
    a.start(off);
    a.schedule(secs);
    a.loop(12, true);
    a.hurt();
    a.stageClear();
    a.bossHit();
    const buf = await off.startRendering();
    const d = buf.getChannelData(0);
    let peak = 0, sum = 0, loud = 0;
    for (let i = 0; i < d.length; i++) {
      const v = Math.abs(d[i]);
      if (v > peak) peak = v;
      sum += v * v;
      if (v > 0.99) loud++;
    }
    const tail = d.subarray(rate * 8);
    let tsum = 0;
    for (let i = 0; i < tail.length; i++) tsum += tail[i] * tail[i];
    return { peak, rms: Math.sqrt(sum / d.length), musicRms: Math.sqrt(tsum / tail.length), clipped: loud };
  },
  /** jump straight to a stage (0-based) with a clean page */
  skipTo(stage: number) {
    sim.stage = Math.max(0, Math.min(STAGES.length - 1, stage));
    sim.stageT = 0;
    sim.enemies = [];
    sim.shots = [];
    sim.events.push({ type: 'stage', index: sim.stage });
  },
  spirits: Object.keys(ENEMIES),
};
