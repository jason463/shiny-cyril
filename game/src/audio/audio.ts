// All sound is synthesised at runtime with Web Audio: no audio files.
// Music is a sparse generative piece on an in-sen scale that thickens as the page fills.

const SCALE = [0, 1, 5, 7, 10]; // in-sen: D E♭ G A C
const ROOT = 146.83; // D3

function note(deg: number): number {
  const oct = Math.floor(deg / SCALE.length);
  const i = ((deg % SCALE.length) + SCALE.length) % SCALE.length;
  return ROOT * Math.pow(2, oct + SCALE[i] / 12);
}

export class AudioEngine {
  ctx: BaseAudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfx!: GainNode;
  private noise!: AudioBuffer;
  private timer: number | null = null;
  private nextBeat = 0;
  private beat = 0;
  private melody = 7;
  private rand = mulberry(99);
  private droneGain: GainNode | null = null;

  musicVol = 0.6;
  sfxVol = 0.8;
  /** 0 calm … 1 frantic; set every frame by the game */
  intensity = 0;
  /** music ducks while a menu is open */
  duck = 1;

  get ready(): boolean {
    return !!this.ctx;
  }

  /** Must be called from a user gesture the first time. */
  start(ctx?: BaseAudioContext): void {
    if (this.ctx) {
      const c = this.ctx as AudioContext;
      if (c.state === 'suspended' && c.resume) void c.resume();
      return;
    }
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = ctx ?? new AC();
    } catch {
      return;
    }
    this.build();
    if (!ctx) this.timer = window.setInterval(() => this.schedule(), 80);
  }

  /** Wires the graph onto any context, so tests can render it offline. */
  build(): void {
    const c = this.ctx!;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 14;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    this.master = c.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(comp);
    comp.connect(c.destination);
    this.music = c.createGain();
    this.sfx = c.createGain();
    this.music.connect(this.master);
    this.sfx.connect(this.master);
    this.applyVolumes();

    const len = c.sampleRate * 1.5;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    const r = mulberry(7);
    for (let i = 0; i < len; i++) d[i] = r() * 2 - 1;

    // drone: two low voices a fifth apart, slowly breathing
    this.droneGain = c.createGain();
    this.droneGain.gain.value = 0.0001;
    this.droneGain.connect(this.music);
    for (const [f, g] of [[ROOT / 2, 0.5], [(ROOT / 2) * 1.5, 0.22], [ROOT / 2 + 0.6, 0.3]] as const) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const og = c.createGain();
      og.gain.value = g;
      o.connect(og);
      og.connect(this.droneGain);
      o.start();
    }
    this.droneGain.gain.linearRampToValueAtTime(0.12, c.currentTime + 4);
    this.nextBeat = c.currentTime + 0.3;
  }

  applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(this.musicVol * 0.8 * this.duck, t, 0.15);
    this.sfx.gain.setTargetAtTime(this.sfxVol * 0.8, t, 0.05);
  }

  suspend(on: boolean): void {
    const c = this.ctx as AudioContext | null;
    if (!c || !c.suspend) return;
    if (on) void c.suspend();
    else void c.resume();
  }

  // ------------------------------------------------------------ music

  /** Schedules everything due before `until`. Called on a timer, or directly by tests. */
  schedule(until?: number): void {
    const c = this.ctx;
    if (!c) return;
    const horizon = until ?? c.currentTime + 0.25;
    const step = 60 / (66 + this.intensity * 30) / 2; // eighth notes
    while (this.nextBeat < horizon) {
      this.playBeat(this.nextBeat, this.beat);
      this.nextBeat += step;
      this.beat++;
    }
  }

  private playBeat(t: number, b: number): void {
    const I = this.intensity, r = this.rand;
    const inBar = b % 16;

    // plucked line: a slow random walk, more notes as things heat up
    const pPluck = inBar % 4 === 0 ? 0.62 : inBar % 2 === 0 ? 0.24 + I * 0.3 : 0.05 + I * 0.22;
    if (r() < pPluck) {
      const stepBy = Math.floor(r() * 5) - 2;
      this.melody = Math.max(3, Math.min(14, this.melody + stepBy));
      this.pluck(note(this.melody), t, 0.2 + I * 0.07, 1.5);
      if (r() < 0.16) this.pluck(note(this.melody + 2), t + 0.09, 0.11, 1.2);
    }
    // low string on the bar
    if (inBar === 0 || (inBar === 10 && r() < 0.5)) this.pluck(note(inBar === 0 ? 0 : 3) / 2, t, 0.26, 2.4);

    // drum: one heartbeat when calm, a pattern when the page is crowded
    if (inBar === 0) this.drum(t, 0.5 + I * 0.25);
    if (I > 0.3 && (inBar === 6 || inBar === 8)) this.drum(t, 0.3 + I * 0.2);
    if (I > 0.6 && (inBar === 3 || inBar === 11 || inBar === 14)) this.drum(t, 0.26);
    if (I > 0.45 && inBar % 2 === 1 && r() < 0.5) this.tick(t, 0.05 + I * 0.05);
  }

  private pluck(freq: number, t: number, vol: number, dur: number, dest?: AudioNode): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    const o2 = c.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = freq * 2.003;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 2.5;
    f.frequency.setValueAtTime(Math.min(9000, freq * 9), t);
    f.frequency.exponentialRampToValueAtTime(Math.max(180, freq * 1.2), t + dur * 0.5);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const g2 = c.createGain();
    g2.gain.value = 0.35;
    o.connect(f);
    o2.connect(g2);
    g2.connect(f);
    f.connect(g);
    g.connect(dest ?? this.music);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.05);
    o2.stop(t + dur + 0.05);
  }

  private drum(t: number, vol: number, dest?: AudioNode): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(118, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.16);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(g);
    g.connect(dest ?? this.music);
    o.start(t);
    o.stop(t + 0.5);
    this.burst(t, 0.03, vol * 0.25, 900, 1.2, dest ?? this.music);
  }

  private tick(t: number, vol: number): void {
    this.burst(t, 0.025, vol, 4200, 3, this.music);
  }

  /** Filtered noise burst; optional sweep to `f1`. */
  private burst(t: number, dur: number, vol: number, f0: number, q: number, dest: AudioNode, f1?: number, type: BiquadFilterType = 'bandpass'): void {
    const c = this.ctx!;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.012, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest);
    s.start(t, this.rand() * 0.8);
    s.stop(t + dur + 0.03);
  }

  private bell(freq: number, t: number, vol: number, dur: number): void {
    const c = this.ctx!;
    for (const [m, a] of [[1, 1], [2.76, 0.45], [5.4, 0.22], [8.93, 0.1]] as const) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq * m;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * a, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur / (1 + m * 0.25));
      o.connect(g);
      g.connect(this.sfx);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  // ------------------------------------------------------------ effects

  private now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /** A ring closing: a swish, then one rising note per sealed spirit. */
  loop(kills: number, enso: boolean): void {
    if (!this.ctx) return;
    const t = this.now();
    this.burst(t, 0.2, 0.3, 700, 0.8, this.sfx, 3200);
    const n = Math.min(kills, 12);
    for (let i = 0; i < n; i++) this.pluck(note(5 + i), t + 0.03 + i * 0.038, 0.2, 0.5, this.sfx);
    if (kills >= 5) this.drum(t + 0.02, Math.min(0.75, 0.35 + kills * 0.03), this.sfx);
    if (enso) {
      this.bell(note(5), t + 0.02, 0.2, 2.4);
      this.bell(note(8), t + 0.1, 0.11, 2.0);
    }
  }

  emptyLoop(): void {
    if (!this.ctx) return;
    this.burst(this.now(), 0.16, 0.16, 600, 0.8, this.sfx, 1800);
  }

  hurt(): void {
    if (!this.ctx) return;
    const c = this.ctx, t = this.now();
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.3);
    const g = c.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g);
    g.connect(this.sfx);
    o.start(t);
    o.stop(t + 0.5);
    this.burst(t, 0.22, 0.4, 1600, 0.6, this.sfx, 240);
  }

  dash(): void {
    if (!this.ctx) return;
    this.burst(this.now(), 0.13, 0.2, 1800, 0.9, this.sfx, 5200, 'highpass');
  }

  cut(): void {
    if (!this.ctx) return;
    const t = this.now();
    this.burst(t, 0.03, 0.22, 5200, 5, this.sfx);
    this.burst(t + 0.06, 0.03, 0.18, 6400, 5, this.sfx);
  }

  shot(): void {
    if (!this.ctx) return;
    this.pluck(note(1) / 2, this.now(), 0.13, 0.25, this.sfx);
  }

  bolt(): void {
    if (!this.ctx) return;
    this.burst(this.now(), 0.25, 0.26, 3000, 0.5, this.sfx, 300);
  }

  charm(): void {
    if (!this.ctx) return;
    this.bell(note(12), this.now(), 0.12, 1.2);
  }

  heal(): void {
    if (!this.ctx) return;
    const t = this.now();
    this.pluck(note(7), t, 0.2, 0.7, this.sfx);
    this.pluck(note(10), t + 0.1, 0.2, 0.9, this.sfx);
  }

  levelUp(): void {
    if (!this.ctx) return;
    const t = this.now();
    [5, 7, 8, 10].forEach((d, i) => this.pluck(note(d), t + i * 0.07, 0.22, 0.9, this.sfx));
    this.bell(note(10), t + 0.28, 0.1, 1.6);
  }

  stageClear(): void {
    if (!this.ctx) return;
    const t = this.now();
    [5, 8, 10, 12, 15].forEach((d, i) => this.pluck(note(d), t + i * 0.11, 0.24, 1.4, this.sfx));
    this.bell(note(5) / 2, t, 0.28, 3.5);
    this.drum(t, 0.6, this.sfx);
  }

  bossHit(): void {
    if (!this.ctx) return;
    const t = this.now();
    this.bell(note(0) / 2, t, 0.34, 3);
    this.drum(t, 0.8, this.sfx);
    this.burst(t, 0.5, 0.3, 500, 0.5, this.sfx, 90);
  }

  arrive(): void {
    if (!this.ctx) return;
    const t = this.now();
    this.drum(t, 0.7, this.sfx);
    this.drum(t + 0.32, 0.7, this.sfx);
    this.bell(note(1) / 2, t, 0.18, 2.6);
  }

  death(): void {
    if (!this.ctx) return;
    const t = this.now();
    [10, 8, 6, 5, 1].forEach((d, i) => this.pluck(note(d) / (i > 2 ? 2 : 1), t + i * 0.17, 0.24, 1.6, this.sfx));
    this.bell(note(0) / 2, t + 0.7, 0.24, 4);
  }

  win(): void {
    if (!this.ctx) return;
    const t = this.now();
    [5, 7, 10, 12, 15, 17].forEach((d, i) => this.pluck(note(d), t + i * 0.12, 0.25, 2, this.sfx));
    this.bell(note(5), t + 0.6, 0.22, 4);
    this.bell(note(10), t + 0.75, 0.14, 4);
  }

  ui(kind: 'move' | 'pick' | 'back' = 'pick'): void {
    if (!this.ctx) return;
    const t = this.now();
    if (kind === 'move') this.burst(t, 0.02, 0.1, 3000, 4, this.sfx);
    else if (kind === 'back') this.pluck(note(3), t, 0.12, 0.25, this.sfx);
    else {
      this.pluck(note(7), t, 0.16, 0.35, this.sfx);
      this.burst(t, 0.03, 0.1, 2400, 3, this.sfx);
    }
  }

  dispose(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
  }
}

function mulberry(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
