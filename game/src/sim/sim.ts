// The whole game as a pure simulation: no DOM, no canvas, no audio.
// The renderer, the sound engine and the UI only read state and consume `events`,
// which is what lets the same code run headless in tests and under a bot.

import {
  Pt, Rng, TAU, clamp, lerp, segIntersect, polyArea, polyCentroid, pointInPoly,
  distToSegSq, roundness, circlePoly, scalePoly,
} from './geom';
import {
  ARENA_W, ARENA_H, ARENA_PAD, ENEMIES, EnemyKind, BRUSHES, BrushDef, BrushId,
  TECHS, TechId, RELICS, RelicId, STAGES, essenceFor,
} from './data';

export const PLAYER_R = 9;
const TRAIL_STEP = 6;
const MIN_LOOP_AREA = 1500;
const ENEMY_CAP = 120;
const KOI_R = 95;

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number; y: number; vx: number; vy: number;
  r: number; hp: number; maxHp: number;
  age: number;
  /** > 0 while still seeping onto the page: harmless and unsealable */
  spawn: number;
  spawnMax: number;
  grace: number;
  stun: number;
  flash: number;
  wet: number;
  state: number;
  st: number;
  cd: number;
  ax: number; ay: number;
  face: number;
  seed: number;
  dead: boolean;
}

export interface Shot { x: number; y: number; vx: number; vy: number; life: number; r: number; dead: boolean }
export interface Orb { x: number; y: number; vx: number; vy: number; value: number; age: number; heal: boolean; dead: boolean }
export interface Zone { poly: Pt[]; minx: number; miny: number; maxx: number; maxy: number; t: number; max: number; tick: number }

export type LoopSource = 'brush' | 'echo' | 'koi';

export type GameEvent =
  | { type: 'loop'; poly: Pt[]; cx: number; cy: number; radius: number; n: number; kills: number; q: number; enso: boolean; stamped: boolean; src: LoopSource }
  | { type: 'kill'; x: number; y: number; r: number; kind: EnemyKind; quiet: boolean }
  | { type: 'hit'; x: number; y: number; kind: EnemyKind }
  | { type: 'hurt'; x: number; y: number; hp: number }
  | { type: 'shield'; x: number; y: number }
  | { type: 'charm' }
  | { type: 'heal' }
  | { type: 'death' }
  | { type: 'dash'; x: number; y: number }
  | { type: 'burst'; x: number; y: number; r: number }
  | { type: 'cut'; x: number; y: number }
  | { type: 'shot'; x: number; y: number }
  | { type: 'bolt'; x: number; y: number }
  | { type: 'needle'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'splash'; x: number; y: number; r: number }
  | { type: 'orb'; value: number }
  | { type: 'levelup'; level: number }
  | { type: 'stage'; index: number }
  | { type: 'stageClear'; index: number; untouched: boolean }
  | { type: 'arrive'; kind: EnemyKind; x: number; y: number }
  | { type: 'bossReel'; x: number; y: number; hp: number }
  | { type: 'bossDown'; x: number; y: number }
  | { type: 'win' };

export interface Choice {
  kind: 'tech' | 'relic' | 'boon';
  id: string;
  name: string;
  desc: string;
  rank: number;
  max: number;
}

export interface SimInput { x: number; y: number; dash: boolean }

export interface SimOptions {
  seed: number;
  brush: BrushId;
  depth: number;
  /** attract mode: endless calm first stage, an untouchable brush, no level-ups */
  attract?: boolean;
}

export type Phase = 'play' | 'levelup' | 'relic' | 'dead' | 'won';

// boss states
const B_CHASE = 0, B_WIND = 1, B_BURST = 2, B_AIM = 3, B_CHARGE = 4, B_REST = 5, B_REEL = 9;

export class Sim {
  readonly rng: Rng;
  readonly brush: BrushDef;
  readonly depth: number;
  readonly attract: boolean;

  phase: Phase = 'play';
  time = 0;
  stage = 0;
  stageT = 0;
  stageHits = 0;

  player = {
    x: ARENA_W / 2, y: ARENA_H / 2, vx: 0, vy: 0, fx: 1, fy: 0,
    hp: 3, maxHp: 3, inv: 0, dashCd: 0, dashT: 0, dashX: 1, dashY: 0, charm: false,
  };

  trail: Pt[] = [];
  trailLen = 0;
  /** total length of line that has faded off the tail; keeps brush texture from crawling */
  trailOdo = 0;

  enemies: Enemy[] = [];
  shots: Shot[] = [];
  orbs: Orb[] = [];
  zones: Zone[] = [];
  pending: { poly: Pt[]; t: number }[] = [];
  events: GameEvent[] = [];

  koi = { x: 0, y: 0, mode: 0, t: 0, cx: 0, cy: 0, a: 0, cd: 4, on: false };

  level = 0;
  essence = 0;
  choices: Choice[] = [];
  techs: Partial<Record<TechId, number>> = {};
  relics: RelicId[] = [];

  stats = {
    trail: 600, speed: 250, power: 1, splash: 0, ember: 0, thread: 0, dashCd: 2.6,
    ensoQ: 0.86, essenceMul: 1, ensoMul: 1.5, wet: 0, burst: 0, width: 9,
  };

  tally = { kills: 0, loops: 0, ensos: 0, best: 0, score: 0, hits: 0, stagesCleared: 0 };

  /** what last struck the brush, and a count of every blow by kind */
  lastHurtBy: EnemyKind | 'bead' | null = null;
  hurtLog: Partial<Record<EnemyKind | 'bead', number>> = {};

  boss: Enemy | null = null;
  bossSpawned = false;
  winT = -1;
  slowT = 0;
  hungry = 0;
  blossomCd = 0;

  private budget = 0;
  private nextKind: EnemyKind = 'drifter';
  private nextSize = 3;
  private giantIdx = 0;
  private nextId = 1;
  private mult = 1;
  private speedMul: number;
  private rateMul: number;

  constructor(opts: SimOptions) {
    this.rng = new Rng(opts.seed);
    this.brush = BRUSHES.find((b) => b.id === opts.brush) ?? BRUSHES[0];
    this.depth = clamp(Math.round(opts.depth), 1, 9);
    this.attract = !!opts.attract;
    this.speedMul = 1 + 0.06 * (this.depth - 1);
    this.rateMul = 1 + 0.2 * (this.depth - 1);
    this.player.hp = this.player.maxHp = this.brush.hp;
    this.koi.x = this.player.x;
    this.koi.y = this.player.y;
    this.recompute();
    this.planNext();
    this.events.push({ type: 'stage', index: 0 });
  }

  // ------------------------------------------------------------ derived stats

  rank(id: TechId): number {
    return this.techs[id] ?? 0;
  }

  has(id: RelicId): boolean {
    return this.relics.includes(id);
  }

  recompute(): void {
    const b = this.brush, s = this.stats;
    s.trail = b.trail * (1 + 0.2 * this.rank('long'));
    s.speed = b.speed * (1 + 0.09 * this.rank('swift'));
    s.power = 1 + this.rank('heavy');
    s.splash = this.rank('splash') ? 40 + 40 * this.rank('splash') : 0;
    s.ember = this.rank('ember') ? 1.5 + 1.5 * this.rank('ember') : 0;
    s.thread = this.rank('thread') * 2;
    s.dashCd = b.dashCd * Math.pow(0.8, this.rank('flick'));
    s.ensoQ = 0.86 - 0.035 * this.rank('steady');
    s.ensoMul = 1.5 + 0.25 * this.rank('steady');
    s.essenceMul = 1 + 0.2 * this.rank('well');
    s.wet = this.rank('wet') ? 0.2 + 0.15 * this.rank('wet') : 0;
    s.burst = this.rank('burst') + (b.id === 'reed' ? 1 : 0);
    s.width = b.width;
    this.koi.on = this.has('koi');
  }

  /** Current reach of the line, including Hungry Ink. */
  get reach(): number {
    return this.stats.trail * (1 + this.hungry);
  }

  get need(): number {
    return essenceFor(this.level);
  }

  get stageDef() {
    return STAGES[this.stage];
  }

  // ------------------------------------------------------------ main update

  update(dt: number, input: SimInput): void {
    if (this.phase !== 'play') return;
    this.time += dt;
    this.stageT += dt;
    if (this.slowT > 0) this.slowT -= dt;
    if (this.blossomCd > 0) this.blossomCd -= dt;

    this.updatePlayer(dt, input);
    this.updateTrail();
    this.updateDirector(dt);
    this.updateEnemies(dt);
    this.updateShots(dt);
    this.updateOrbs(dt);
    this.updateZones(dt);
    this.updatePending(dt);
    if (this.koi.on) this.updateKoi(dt);

    if (this.enemies.some((e) => e.dead)) this.enemies = this.enemies.filter((e) => !e.dead);
    if (this.shots.some((s) => s.dead)) this.shots = this.shots.filter((s) => !s.dead);
    if (this.orbs.some((o) => o.dead)) this.orbs = this.orbs.filter((o) => !o.dead);

    if (this.phase !== 'play') return;

    if (this.winT >= 0) {
      this.winT -= dt;
      if (this.winT < 0) {
        this.phase = 'won';
        this.tally.stagesCleared = STAGES.length;
        this.events.push({ type: 'win' });
      }
      return;
    }

    const st = this.stageDef;
    if (!st.boss && !this.attract && this.stageT >= st.dur) {
      this.clearStage();
      return;
    }

    if (!this.attract && this.essence >= this.need) {
      this.essence -= this.need;
      this.level++;
      this.choices = this.rollTechs();
      this.phase = 'levelup';
      this.events.push({ type: 'levelup', level: this.level });
    }
  }

  // ------------------------------------------------------------ player

  private updatePlayer(dt: number, input: SimInput): void {
    const p = this.player, s = this.stats;
    let mx = input.x, my = input.y;
    const m = Math.hypot(mx, my);
    if (m > 1) {
      mx /= m;
      my /= m;
    }
    if (m > 0.08) {
      p.fx = mx / Math.min(m, 1);
      p.fy = my / Math.min(m, 1);
    }

    p.dashCd -= dt;
    p.inv -= dt;

    if (input.dash && p.dashCd <= 0 && p.dashT <= 0) {
      p.dashT = 0.17;
      p.dashCd = s.dashCd;
      p.dashX = p.fx;
      p.dashY = p.fy;
      p.inv = Math.max(p.inv, 0.3);
      this.events.push({ type: 'dash', x: p.x, y: p.y });
      if (s.burst > 0) {
        const R = 150, dur = 0.5 + 0.5 * s.burst;
        for (const e of this.enemies) {
          if (e.dead || e.spawn > 0 || e.kind === 'boss') continue;
          const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
          if (d < R + e.r) {
            e.stun = Math.max(e.stun, dur);
            e.vx = (dx / d) * 180;
            e.vy = (dy / d) * 180;
          }
        }
        this.events.push({ type: 'burst', x: p.x, y: p.y, r: R });
      }
    }

    if (p.dashT > 0) {
      p.dashT -= dt;
      const v = s.speed * 3.5;
      p.vx = p.dashX * v;
      p.vy = p.dashY * v;
    } else {
      const k = 1 - Math.exp(-dt * 11);
      p.vx += (mx * s.speed - p.vx) * k;
      p.vy += (my * s.speed - p.vy) * k;
    }
    p.x = clamp(p.x + p.vx * dt, ARENA_PAD, ARENA_W - ARENA_PAD);
    p.y = clamp(p.y + p.vy * dt, ARENA_PAD, ARENA_H - ARENA_PAD);
  }

  // ------------------------------------------------------------ the line

  private resetTrail(): void {
    this.trail = [{ x: this.player.x, y: this.player.y }];
    this.trailLen = 0;
  }

  private updateTrail(): void {
    const p = this.player, t = this.trail;
    if (t.length === 0) {
      this.resetTrail();
      return;
    }
    const a = t[t.length - 1];
    const d = Math.hypot(p.x - a.x, p.y - a.y);
    if (d < TRAIL_STEP) return;
    const b = { x: p.x, y: p.y };

    // Did this new piece of line cross an older piece? Search newest to oldest.
    for (let j = t.length - 4; j >= 0; j--) {
      const hit = segIntersect(a.x, a.y, b.x, b.y, t[j].x, t[j].y, t[j + 1].x, t[j + 1].y);
      if (!hit) continue;
      const poly: Pt[] = [hit];
      for (let k = j + 1; k < t.length; k++) poly.push(t[k]);
      if (Math.abs(polyArea(poly)) >= MIN_LOOP_AREA) {
        this.closeLoop(poly, 'brush');
        this.trail = [b];
        this.trailLen = 0;
        return;
      }
      break;
    }

    // Open Hand: coming close to your own line is enough.
    if (this.has('openhand') && t.length > 30) {
      let arc = d;
      for (let j = t.length - 1; j >= 1; j--) {
        arc += Math.hypot(t[j].x - t[j - 1].x, t[j].y - t[j - 1].y);
        if (arc < 280) continue;
        const q = t[j - 1];
        if ((q.x - b.x) * (q.x - b.x) + (q.y - b.y) * (q.y - b.y) < 34 * 34) {
          const poly = t.slice(j - 1);
          poly.push(b);
          if (Math.abs(polyArea(poly)) >= MIN_LOOP_AREA) {
            this.closeLoop(poly, 'brush');
            this.trail = [b];
            this.trailLen = 0;
            return;
          }
        }
      }
    }

    t.push(b);
    this.trailLen += d;
    const reach = this.reach;
    while (this.trailLen > reach && t.length > 2) {
      const seg = Math.hypot(t[1].x - t[0].x, t[1].y - t[0].y);
      this.trailLen -= seg;
      this.trailOdo += seg;
      t.shift();
    }
  }

  /** Sever the line at segment `j`: everything older than the cut is lost. */
  private cutTrail(j: number): void {
    this.trail = this.trail.slice(j + 1);
    let l = 0;
    for (let i = 1; i < this.trail.length; i++) {
      l += Math.hypot(this.trail[i].x - this.trail[i - 1].x, this.trail[i].y - this.trail[i - 1].y);
    }
    this.trailLen = l;
  }

  // ------------------------------------------------------------ sealing

  closeLoop(poly: Pt[], src: LoopSource): void {
    const s = this.stats, p = this.player;
    const area = Math.abs(polyArea(poly));
    const q = roundness(poly);
    const c = polyCentroid(poly);
    const radius = Math.sqrt(area / Math.PI);
    const enso = src === 'brush' && q >= s.ensoQ && area >= 5200;

    let power = s.power;
    let stamped = false;
    if (src === 'brush') {
      this.tally.loops++;
      if (this.has('stamp') && this.tally.loops % 5 === 0) {
        power += 2;
        stamped = true;
      }
      if (enso) {
        power += this.brush.id === 'wolf' ? 2 : 1;
        this.tally.ensos++;
      }
    }

    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const v of poly) {
      if (v.x < minx) minx = v.x;
      if (v.x > maxx) maxx = v.x;
      if (v.y < miny) miny = v.y;
      if (v.y > maxy) maxy = v.y;
    }

    const inside: Enemy[] = [];
    for (const e of this.enemies) {
      if (e.dead || e.spawn > 0 || e.grace > 0) continue;
      if (e.x < minx || e.x > maxx || e.y < miny || e.y > maxy) continue;
      if (pointInPoly(e.x, e.y, poly)) inside.push(e);
    }
    const n = inside.length;
    this.mult = Math.max(1, n) * (enso ? 2 : 1);

    let kills = 0;
    const fallen: Pt[] = [];
    const essMul = enso ? s.ensoMul : 1;
    for (const e of inside) {
      const at = { x: e.x, y: e.y };
      if (this.damage(e, power, c, essMul, src !== 'koi')) {
        kills++;
        fallen.push(at);
      }
    }

    for (const sh of this.shots) {
      if (!sh.dead && sh.x >= minx && sh.x <= maxx && sh.y >= miny && sh.y <= maxy && pointInPoly(sh.x, sh.y, poly)) sh.dead = true;
    }

    if (s.splash > 0 && src !== 'koi') {
      const R = radius + s.splash;
      for (const e of this.enemies) {
        if (e.dead || e.spawn > 0 || e.grace > 0 || inside.includes(e)) continue;
        const d = Math.hypot(e.x - c.x, e.y - c.y);
        if (d < R + e.r && d > radius * 0.7) {
          if (this.damage(e, 1, c, 1)) kills++;
        }
      }
      this.events.push({ type: 'splash', x: c.x, y: c.y, r: R });
    }

    if (s.thread > 0 && fallen.length) {
      let left = s.thread;
      for (const f of fallen) {
        if (left <= 0) break;
        let best: Enemy | null = null, bd = 280 * 280;
        for (const e of this.enemies) {
          if (e.dead || e.spawn > 0 || e.grace > 0) continue;
          const dd = (e.x - f.x) * (e.x - f.x) + (e.y - f.y) * (e.y - f.y);
          if (dd < bd) {
            bd = dd;
            best = e;
          }
        }
        if (!best) break;
        this.events.push({ type: 'needle', x1: f.x, y1: f.y, x2: best.x, y2: best.y });
        if (this.damage(best, 1, f, 1)) kills++;
        left--;
      }
    }

    if (enso && this.has('thunder')) {
      const live = this.enemies.filter((e) => !e.dead && e.spawn <= 0 && e.grace <= 0);
      this.rng.shuffle(live);
      for (const e of live.slice(0, 5)) {
        this.events.push({ type: 'bolt', x: e.x, y: e.y });
        if (this.damage(e, 1, c, 1)) kills++;
      }
    }

    this.mult = 1;

    if (n >= 3 && !this.attract) {
      this.orbs.push({ x: c.x, y: c.y, vx: 0, vy: 0, value: (n - 2) * 0.6 * s.essenceMul, age: 0, heal: false, dead: false });
    }
    if (s.ember > 0 && src === 'brush') {
      this.zones.push({ poly, minx, miny, maxx, maxy, t: s.ember, max: s.ember, tick: 0.25 });
    }
    if (src === 'brush') {
      if (this.has('echo')) this.pending.push({ poly: scalePoly(poly, 1.3), t: 0.42 });
      if (this.has('breath')) this.slowT = 2;
      if (this.has('hungry')) this.hungry = Math.min(0.6, this.hungry + 0.04);
    }
    if (n >= 6 && this.has('charm') && !p.charm) {
      p.charm = true;
      this.events.push({ type: 'charm' });
    }
    if (n >= 12 && this.has('blossom') && this.blossomCd <= 0 && p.hp < p.maxHp) {
      p.hp++;
      this.blossomCd = 25;
      this.events.push({ type: 'heal' });
    }

    if (n > this.tally.best) this.tally.best = n;
    this.events.push({ type: 'loop', poly, cx: c.x, cy: c.y, radius, n, kills, q, enso, stamped, src });
  }

  /** Returns true when the spirit was sealed for good. */
  private damage(e: Enemy, amount: number, from: Pt, essMul: number, direct = false): boolean {
    if (e.dead) return false;
    if (e.kind === 'boss') {
      // only a ring drawn around it counts: no chip damage from splashes, needles or the koi
      if (e.state === B_REEL || !direct) return false;
      amount = 1;
    } else if (e.kind === 'giant') {
      amount = Math.min(amount, 2);
    }
    e.hp -= amount;
    e.flash = 0.2;
    if (e.hp <= 0) {
      this.kill(e, essMul, false);
      return true;
    }
    const dx = e.x - from.x, dy = e.y - from.y, d = Math.hypot(dx, dy) || 1;
    if (e.kind === 'boss') {
      e.state = B_REEL;
      e.st = 2.4;
      const far = this.farPoint(520);
      e.ax = far.x;
      e.ay = far.y;
      this.events.push({ type: 'bossReel', x: e.x, y: e.y, hp: e.hp });
    } else {
      e.stun = e.kind === 'giant' ? 1.1 : 0.8;
      e.vx = (dx / d) * 240;
      e.vy = (dy / d) * 240;
      this.events.push({ type: 'hit', x: e.x, y: e.y, kind: e.kind });
    }
    return false;
  }

  private kill(e: Enemy, essMul: number, quiet: boolean): void {
    if (e.dead) return;
    e.dead = true;
    const def = ENEMIES[e.kind];
    this.events.push({ type: 'kill', x: e.x, y: e.y, r: e.r, kind: e.kind, quiet });
    if (quiet) return;
    this.tally.kills++;
    this.tally.score += Math.round(def.score * this.mult * (1 + 0.25 * (this.depth - 1)));
    if (!this.attract) {
      this.orbs.push({
        x: e.x, y: e.y, vx: this.rng.range(-60, 60), vy: this.rng.range(-60, 60),
        value: def.essence * this.stats.essenceMul * essMul, age: 0, heal: false, dead: false,
      });
    }
    if (e.kind === 'splitter') {
      for (let i = 0; i < 3; i++) {
        const a = e.seed + (i / 3) * TAU;
        const m = this.makeEnemy('mite', e.x + Math.cos(a) * 10, e.y + Math.sin(a) * 10, 0);
        m.grace = 0.55;
        m.stun = 0.4;
        m.vx = Math.cos(a) * 300;
        m.vy = Math.sin(a) * 300;
      }
    } else if (e.kind === 'giant') {
      this.orbs.push({ x: e.x, y: e.y, vx: 0, vy: -40, value: 0, age: 0, heal: true, dead: false });
    } else if (e.kind === 'boss') {
      this.boss = null;
      this.winT = 2.6;
      for (const o of this.enemies) if (!o.dead) this.kill(o, 1, true);
      for (const sh of this.shots) sh.dead = true;
      this.events.push({ type: 'bossDown', x: e.x, y: e.y });
    }
  }

  private hurt(by: EnemyKind | 'bead'): void {
    const p = this.player;
    if (this.attract || p.inv > 0 || p.dashT > 0 || this.winT >= 0) return;
    this.lastHurtBy = by;
    this.hurtLog[by] = (this.hurtLog[by] ?? 0) + 1;
    const shock = () => {
      for (const e of this.enemies) {
        if (e.dead || e.spawn > 0 || e.kind === 'boss') continue;
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
        if (d < 210) {
          e.stun = Math.max(e.stun, 0.7);
          e.vx = (dx / d) * 330;
          e.vy = (dy / d) * 330;
        }
      }
      for (const sh of this.shots) {
        if (Math.hypot(sh.x - p.x, sh.y - p.y) < 210) sh.dead = true;
      }
    };
    if (p.charm) {
      p.charm = false;
      p.inv = 1.0;
      shock();
      this.events.push({ type: 'shield', x: p.x, y: p.y });
      return;
    }
    p.hp--;
    p.inv = 1.5;
    this.tally.hits++;
    this.stageHits++;
    this.hungry = 0;
    this.resetTrail();
    shock();
    this.events.push({ type: 'hurt', x: p.x, y: p.y, hp: p.hp });
    if (p.hp <= 0) {
      this.phase = 'dead';
      this.events.push({ type: 'death' });
    }
  }

  // ------------------------------------------------------------ spawning

  private makeEnemy(kind: EnemyKind, x: number, y: number, spawn: number): Enemy {
    const def = ENEMIES[kind];
    const hp = kind === 'boss' ? def.hp + (this.depth - 1) : def.hp;
    const e: Enemy = {
      id: this.nextId++, kind,
      x: clamp(x, ARENA_PAD, ARENA_W - ARENA_PAD), y: clamp(y, ARENA_PAD, ARENA_H - ARENA_PAD),
      vx: 0, vy: 0, r: def.r, hp, maxHp: hp, age: 0, spawn, spawnMax: spawn || 1, grace: 0, stun: 0, flash: 0, wet: 0,
      state: 0, st: 0, cd: this.rng.range(0.6, 2.2), ax: 1, ay: 0, face: 0, seed: this.rng.range(0, 1000), dead: false,
    };
    this.enemies.push(e);
    return e;
  }

  /** A point at least `min` away from the brush, inside the page. */
  private farPoint(min: number): Pt {
    const p = this.player;
    let best = { x: p.x, y: p.y }, bd = -1;
    for (let i = 0; i < 8; i++) {
      const a = this.rng.range(0, TAU), d = this.rng.range(min, min + 240);
      const x = clamp(p.x + Math.cos(a) * d, ARENA_PAD + 30, ARENA_W - ARENA_PAD - 30);
      const y = clamp(p.y + Math.sin(a) * d, ARENA_PAD + 30, ARENA_H - ARENA_PAD - 30);
      const dd = Math.hypot(x - p.x, y - p.y);
      if (dd > bd) {
        bd = dd;
        best = { x, y };
      }
      if (dd >= min * 0.85) break;
    }
    return best;
  }

  private planNext(): void {
    const w = this.stageDef.weights;
    let total = 0;
    for (const k in w) total += w[k as EnemyKind] ?? 0;
    let roll = this.rng.next() * total;
    let kind: EnemyKind = 'drifter';
    for (const k in w) {
      roll -= w[k as EnemyKind] ?? 0;
      if (roll <= 0) {
        kind = k as EnemyKind;
        break;
      }
    }
    this.nextKind = kind;
    this.nextSize = kind === 'drifter' ? this.rng.int(3, 6) : kind === 'wisp' || kind === 'darter' ? this.rng.int(1, 2) : 1;
  }

  private updateDirector(dt: number): void {
    const st = this.stageDef;
    if (this.winT >= 0) return;

    if (st.boss && !this.bossSpawned && this.stageT > 5) {
      this.bossSpawned = true;
      const at = this.farPoint(480);
      this.boss = this.makeEnemy('boss', at.x, at.y, 2.2);
      this.boss.st = 3;
      this.events.push({ type: 'arrive', kind: 'boss', x: at.x, y: at.y });
    }
    if (this.giantIdx < st.giants.length && this.stageT >= st.giants[this.giantIdx]) {
      this.giantIdx++;
      const at = this.farPoint(460);
      this.makeEnemy('giant', at.x, at.y, 1.6);
      this.events.push({ type: 'arrive', kind: 'giant', x: at.x, y: at.y });
    }

    if (this.stageT < 2.5) return;
    const k = clamp(this.stageT / Math.min(st.dur, 120), 0, 1);
    let rate = lerp(st.rate[0], st.rate[1], k) * this.rateMul;
    rate *= 0.78 + 0.3 * Math.sin((this.stageT * TAU) / 24);
    if (this.attract) rate = 2.2;
    this.budget = Math.min(this.budget + rate * dt, 16);

    const cost = ENEMIES[this.nextKind].cost * this.nextSize;
    if (this.budget < cost || this.enemies.length >= ENEMY_CAP) return;
    this.budget -= cost;
    const at = this.farPoint(this.attract ? 260 : 430);
    for (let i = 0; i < this.nextSize; i++) {
      this.makeEnemy(this.nextKind, at.x + this.rng.range(-55, 55), at.y + this.rng.range(-55, 55), this.rng.range(0.8, 1.15));
    }
    this.planNext();
  }

  private clearStage(): void {
    for (const e of this.enemies) if (!e.dead) this.kill(e, 1, true);
    for (const s of this.shots) s.dead = true;
    this.enemies = [];
    this.shots = [];
    this.zones = [];
    this.pending = [];
    const untouched = this.stageHits === 0;
    this.events.push({ type: 'stageClear', index: this.stage, untouched });
    this.tally.stagesCleared = this.stage + 1;
    this.tally.score += 500 * (this.stage + 1);
    const p = this.player;
    if (p.hp < p.maxHp) p.hp++;
    this.stage++;
    this.stageT = 0;
    this.stageHits = 0;
    this.budget = 0;
    this.giantIdx = 0;
    this.planNext();
    this.choices = this.rollRelics();
    this.phase = 'relic';
  }

  // ------------------------------------------------------------ choices

  private rollTechs(): Choice[] {
    const pool = TECHS.filter((t) => this.rank(t.id) < t.max);
    const out: Choice[] = [];
    while (out.length < 3 && pool.length) {
      let total = 0;
      for (const t of pool) total += t.weight * (this.rank(t.id) > 0 ? 1.25 : 1);
      let roll = this.rng.next() * total;
      let idx = 0;
      for (let i = 0; i < pool.length; i++) {
        roll -= pool[i].weight * (this.rank(pool[i].id) > 0 ? 1.25 : 1);
        if (roll <= 0) {
          idx = i;
          break;
        }
      }
      const t = pool.splice(idx, 1)[0];
      const r = this.rank(t.id) + 1;
      out.push({ kind: 'tech', id: t.id, name: t.name, desc: t.desc(r), rank: r, max: t.max });
    }
    while (out.length < 3) {
      out.push(out.length % 2 === 0
        ? { kind: 'boon', id: 'mend', name: 'Fresh Ink', desc: 'Restore one drop of health.', rank: 0, max: 0 }
        : { kind: 'boon', id: 'offer', name: 'Offering', desc: 'Add 750 to your score.', rank: 0, max: 0 });
    }
    return out;
  }

  private rollRelics(): Choice[] {
    const pool = this.rng.shuffle(RELICS.filter((r) => !this.has(r.id)));
    return pool.slice(0, 3).map((r) => ({ kind: 'relic' as const, id: r.id, name: r.name, desc: r.desc, rank: 0, max: 0 }));
  }

  choose(i: number): void {
    if (this.phase !== 'levelup' && this.phase !== 'relic') return;
    const c = this.choices[i];
    if (!c) return;
    const p = this.player;
    if (c.kind === 'tech') {
      const id = c.id as TechId;
      this.techs[id] = this.rank(id) + 1;
      if (id === 'vital') {
        p.maxHp++;
        p.hp = Math.min(p.maxHp, p.hp + 1);
      }
    } else if (c.kind === 'relic') {
      this.relics.push(c.id as RelicId);
    } else if (c.id === 'mend') {
      p.hp = Math.min(p.maxHp, p.hp + 1);
    } else {
      this.tally.score += 750;
    }
    this.recompute();
    const wasRelic = this.phase === 'relic';
    this.choices = [];
    this.phase = 'play';
    p.inv = Math.max(p.inv, 0.8);
    if (wasRelic) {
      this.resetTrail();
      this.events.push({ type: 'stage', index: this.stage });
    }
  }

  // ------------------------------------------------------------ spirits

  private updateEnemies(dt: number): void {
    const p = this.player, s = this.stats;
    const slow = this.slowT > 0 ? 0.5 : 1;
    const t = this.trail;
    const waxed = this.has('waxed');

    // bounding box of the line, to skip most line checks cheaply
    let tminx = Infinity, tminy = Infinity, tmaxx = -Infinity, tmaxy = -Infinity;
    for (const v of t) {
      if (v.x < tminx) tminx = v.x;
      if (v.x > tmaxx) tmaxx = v.x;
      if (v.y < tminy) tminy = v.y;
      if (v.y > tmaxy) tmaxy = v.y;
    }

    for (const e of this.enemies) {
      if (e.dead) continue;
      e.age += dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.spawn > 0) {
        e.spawn -= dt;
        continue;
      }
      if (e.grace > 0) e.grace -= dt;
      if (e.wet > 0) e.wet -= dt;

      const def = ENEMIES[e.kind];
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d, uy = dy / d;
      e.face = Math.atan2(dy, dx);

      // contact with the line
      const touchR = e.r + s.width * 0.5;
      if (t.length > 3 && (s.wet > 0 || (e.kind === 'cutter' && !waxed)) &&
        e.x > tminx - touchR && e.x < tmaxx + touchR && e.y > tminy - touchR && e.y < tmaxy + touchR) {
        for (let j = 0; j < t.length - 1; j += 2) {
          const j2 = Math.min(j + 2, t.length - 1);
          if (distToSegSq(e.x, e.y, t[j].x, t[j].y, t[j2].x, t[j2].y) < touchR * touchR) {
            if (e.kind === 'cutter' && !waxed && e.cd <= 0 && e.stun <= 0) {
              this.cutTrail(j);
              e.cd = 1.2;
              this.events.push({ type: 'cut', x: e.x, y: e.y });
            } else if (s.wet > 0) {
              e.wet = 0.25;
            }
            break;
          }
        }
      }

      if (e.stun > 0) {
        e.stun -= dt;
        const f = Math.exp(-dt * 4.5);
        e.vx *= f;
        e.vy *= f;
        e.x = clamp(e.x + e.vx * dt, ARENA_PAD, ARENA_W - ARENA_PAD);
        e.y = clamp(e.y + e.vy * dt, ARENA_PAD, ARENA_H - ARENA_PAD);
        continue;
      }

      const sp = def.speed * this.speedMul * slow * (e.wet > 0 ? 1 - s.wet : 1);
      let tx = 0, ty = 0, accel = 5;
      e.cd -= dt;

      switch (e.kind) {
        case 'drifter':
        case 'splitter': {
          const w = Math.sin(e.age * 2.1 + e.seed) * 0.28;
          tx = (ux - uy * w) * sp;
          ty = (uy + ux * w) * sp;
          break;
        }
        case 'mite': {
          const w = Math.sin(e.age * 6 + e.seed) * 0.55;
          tx = (ux - uy * w) * sp;
          ty = (uy + ux * w) * sp;
          accel = 7;
          break;
        }
        case 'shell': {
          const v = e.hp < e.maxHp ? sp * 2.2 : sp;
          tx = ux * v;
          ty = uy * v;
          break;
        }
        case 'giant': {
          tx = ux * sp;
          ty = uy * sp;
          accel = 2.5;
          if (e.cd <= 0) {
            e.cd = 6.5;
            if (this.enemies.length < ENEMY_CAP) {
              for (let i = 0; i < 2; i++) {
                const a = this.rng.range(0, TAU);
                this.makeEnemy('drifter', e.x + Math.cos(a) * (e.r + 14), e.y + Math.sin(a) * (e.r + 14), 0.6);
              }
            }
          }
          break;
        }
        case 'darter': {
          if (e.state === 0) {
            tx = ux * sp;
            ty = uy * sp;
            if (d < 300 && e.cd <= 0) {
              e.state = 1;
              e.st = 0.9;
            }
          } else if (e.state === 1) {
            e.st -= dt;
            accel = 9;
            if (e.st > 0.25) {
              e.ax = ux;
              e.ay = uy;
            }
            if (e.st <= 0) {
              e.state = 2;
              e.st = 0.42;
              const v = 570 * Math.sqrt(this.speedMul) * slow;
              e.vx = e.ax * v;
              e.vy = e.ay * v;
            }
          } else if (e.state === 2) {
            e.st -= dt;
            tx = e.vx;
            ty = e.vy;
            accel = 0;
            if (e.st <= 0) {
              e.state = 3;
              e.st = 1.1;
            }
          } else {
            e.st -= dt;
            accel = 6;
            if (e.st <= 0) {
              e.state = 0;
              e.cd = 0.6;
            }
          }
          break;
        }
        case 'cutter': {
          if (t.length > 18 && !waxed) {
            const m = t[Math.floor(t.length * 0.45)];
            const mx = m.x - e.x, my = m.y - e.y, md = Math.hypot(mx, my) || 1;
            tx = (mx / md) * sp;
            ty = (my / md) * sp;
          } else {
            tx = ux * sp * 0.6;
            ty = uy * sp * 0.6;
          }
          accel = 4;
          break;
        }
        case 'spitter': {
          if (e.state === 1) {
            e.st -= dt;
            accel = 8;
            if (e.st <= 0) {
              e.state = 0;
              e.cd = 2.9 / this.speedMul;
              const v = 185 * slow;
              this.shots.push({ x: e.x + ux * e.r, y: e.y + uy * e.r, vx: ux * v, vy: uy * v, life: 4.2, r: 7, dead: false });
              this.events.push({ type: 'shot', x: e.x, y: e.y });
            }
          } else {
            const side = e.seed % 2 < 1 ? 1 : -1;
            if (d > 390) {
              tx = ux * sp;
              ty = uy * sp;
            } else if (d < 270) {
              tx = -ux * sp;
              ty = -uy * sp;
            } else {
              tx = -uy * side * sp * 0.6;
              ty = ux * side * sp * 0.6;
            }
            if (e.cd <= 0 && d < 540) {
              e.state = 1;
              e.st = 0.6;
            }
          }
          break;
        }
        case 'wisp': {
          const side = e.seed % 2 < 1 ? 1 : -1;
          if (d > 380) {
            tx = ux * sp;
            ty = uy * sp;
          } else {
            tx = (-uy * side * 0.93 + ux * 0.36) * sp;
            ty = (ux * side * 0.93 + uy * 0.36) * sp;
          }
          accel = 6;
          break;
        }
        case 'boss': {
          this.bossBrain(e, dt, d, ux, uy, sp, slow);
          tx = e.vx;
          ty = e.vy;
          accel = 0;
          break;
        }
      }

      if (accel > 0) {
        const k = 1 - Math.exp(-dt * accel);
        e.vx += (tx - e.vx) * k;
        e.vy += (ty - e.vy) * k;
      }
      const nx = e.x + e.vx * dt, ny = e.y + e.vy * dt;
      e.x = clamp(nx, ARENA_PAD, ARENA_W - ARENA_PAD);
      e.y = clamp(ny, ARENA_PAD, ARENA_H - ARENA_PAD);

      // touch
      if (e.grace <= 0 && !(e.kind === 'boss' && e.state === B_REEL) && d < e.r + PLAYER_R - 3) this.hurt(e.kind);
    }

    // soft separation so groups read as groups instead of one stacked blot
    const es = this.enemies;
    for (let i = 0; i < es.length; i++) {
      const a = es[i];
      if (a.dead || a.spawn > 0) continue;
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j];
        if (b.dead || b.spawn > 0) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const min = (a.r + b.r) * 0.8;
        if (dx > min || dx < -min || dy > min || dy < -min) continue;
        const dd = dx * dx + dy * dy;
        if (dd >= min * min || dd === 0) continue;
        const d = Math.sqrt(dd), push = (min - d) * 0.5;
        const ux = dx / d, uy = dy / d;
        const wa = a.kind === 'boss' || a.kind === 'giant' ? 0 : b.kind === 'boss' || b.kind === 'giant' ? 2 : 1;
        const wb = 2 - wa;
        a.x -= ux * push * wa;
        a.y -= uy * push * wa;
        b.x += ux * push * wb;
        b.y += uy * push * wb;
      }
    }
  }

  private bossBrain(e: Enemy, dt: number, d: number, ux: number, uy: number, sp: number, slow: number): void {
    const rage = 1 + (e.maxHp - e.hp) * 0.09;
    e.st -= dt * (e.state === B_REEL ? 1 : rage);
    switch (e.state) {
      case B_CHASE: {
        e.vx = lerp(e.vx, ux * sp, 1 - Math.exp(-dt * 2));
        e.vy = lerp(e.vy, uy * sp, 1 - Math.exp(-dt * 2));
        if (e.cd <= 0) {
          e.cd = 1.5 / rage;
          if (this.enemies.length < 70) {
            const a = this.rng.range(0, TAU);
            const m = this.makeEnemy('mite', e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r, 0);
            m.grace = 0.3;
            m.stun = 0.25;
            m.vx = Math.cos(a) * 220;
            m.vy = Math.sin(a) * 220;
          }
        }
        if (e.st <= 0) {
          const far = d > 430;
          e.state = far || this.rng.chance(0.5) ? B_AIM : B_WIND;
          e.st = e.state === B_AIM ? 1.05 : 0.95;
        }
        break;
      }
      case B_WIND: {
        e.vx *= Math.exp(-dt * 6);
        e.vy *= Math.exp(-dt * 6);
        if (e.st <= 0) {
          e.state = B_BURST;
          e.st = 1.0;
          e.cd = 0;
          e.ax = 0;
        }
        break;
      }
      case B_BURST: {
        e.vx = 0;
        e.vy = 0;
        // two rings of beads, the second offset to fill the gaps of the first
        if (e.cd <= 0 && e.ax < 2) {
          const n = 11 + (e.maxHp - e.hp) * 2;
          const off = e.ax * (Math.PI / n) + e.seed;
          for (let i = 0; i < n; i++) {
            const a = off + (i / n) * TAU, v = 150 * slow;
            this.shots.push({ x: e.x + Math.cos(a) * e.r, y: e.y + Math.sin(a) * e.r, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 6, r: 8, dead: false });
          }
          this.events.push({ type: 'shot', x: e.x, y: e.y });
          e.ax++;
          e.cd = 0.5;
        }
        if (e.st <= 0) {
          e.state = B_REST;
          e.st = 0.8;
        }
        break;
      }
      case B_AIM: {
        e.vx *= Math.exp(-dt * 6);
        e.vy *= Math.exp(-dt * 6);
        if (e.st > 0.3) {
          e.ax = ux;
          e.ay = uy;
        }
        if (e.st <= 0) {
          e.state = B_CHARGE;
          e.st = 0.8;
          e.vx = e.ax * 620 * slow;
          e.vy = e.ay * 620 * slow;
        }
        break;
      }
      case B_CHARGE: {
        if (e.st <= 0) {
          e.state = B_REST;
          e.st = 1.1;
          if (this.enemies.length < 80) {
            for (let i = 0; i < 4; i++) {
              const a = this.rng.range(0, TAU);
              this.makeEnemy('drifter', e.x + Math.cos(a) * (e.r + 20), e.y + Math.sin(a) * (e.r + 20), 0.5);
            }
          }
        }
        break;
      }
      case B_REST: {
        e.vx *= Math.exp(-dt * 5);
        e.vy *= Math.exp(-dt * 5);
        if (e.st <= 0) {
          e.state = B_CHASE;
          e.st = 4.2;
          e.cd = 0.8;
        }
        break;
      }
      case B_REEL: {
        // shrinks to a bead and slides somewhere far away; cannot be sealed or touched
        const mx = e.ax - e.x, my = e.ay - e.y, md = Math.hypot(mx, my) || 1;
        const v = Math.min(md * 3, 520);
        e.vx = (mx / md) * v;
        e.vy = (my / md) * v;
        if (e.st <= 0) {
          e.state = B_CHASE;
          e.st = 3.4;
          e.cd = 0.6;
          e.vx = 0;
          e.vy = 0;
        }
        break;
      }
    }
  }

  // ------------------------------------------------------------ everything else

  private updateShots(dt: number): void {
    const p = this.player, t = this.trail;
    const waxed = this.has('waxed');
    for (const s of this.shots) {
      if (s.dead) continue;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0 || s.x < 0 || s.y < 0 || s.x > ARENA_W || s.y > ARENA_H) {
        s.dead = true;
        continue;
      }
      if (waxed) {
        for (let j = 0; j < t.length - 1; j += 2) {
          const k = Math.min(j + 2, t.length - 1);
          if (distToSegSq(s.x, s.y, t[j].x, t[j].y, t[k].x, t[k].y) < (s.r + 5) * (s.r + 5)) {
            s.dead = true;
            break;
          }
        }
        if (s.dead) continue;
      }
      if (Math.hypot(s.x - p.x, s.y - p.y) < s.r + PLAYER_R - 3 && p.inv <= 0 && p.dashT <= 0) {
        s.dead = true;
        this.hurt('bead');
      }
    }
  }

  private updateOrbs(dt: number): void {
    const p = this.player;
    for (const o of this.orbs) {
      o.age += dt;
      const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy) || 1;
      if (o.age > 0.28) {
        const v = 240 + (o.age - 0.28) * 1500;
        o.vx = (dx / d) * v;
        o.vy = (dy / d) * v;
      } else {
        o.vx *= Math.exp(-dt * 4);
        o.vy *= Math.exp(-dt * 4);
      }
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      if (d < 18 && o.age > 0.28) {
        o.dead = true;
        if (o.heal) {
          if (p.hp < p.maxHp) p.hp++;
          this.events.push({ type: 'heal' });
        } else {
          this.essence += o.value;
          this.events.push({ type: 'orb', value: o.value });
        }
      }
    }
  }

  private updateZones(dt: number): void {
    for (const z of this.zones) {
      z.t -= dt;
      z.tick -= dt;
      if (z.tick > 0) continue;
      z.tick = 0.5;
      const c = polyCentroid(z.poly);
      for (const e of this.enemies) {
        if (e.dead || e.spawn > 0 || e.grace > 0 || e.kind === 'boss') continue;
        if (e.x < z.minx || e.x > z.maxx || e.y < z.miny || e.y > z.maxy) continue;
        if (pointInPoly(e.x, e.y, z.poly)) this.damage(e, 1, c, 1);
      }
    }
    if (this.zones.some((z) => z.t <= 0)) this.zones = this.zones.filter((z) => z.t > 0);
  }

  private updatePending(dt: number): void {
    if (!this.pending.length) return;
    const due: Pt[][] = [];
    this.pending = this.pending.filter((q) => {
      q.t -= dt;
      if (q.t <= 0) {
        due.push(q.poly);
        return false;
      }
      return true;
    });
    for (const poly of due) this.closeLoop(poly, 'echo');
  }

  private updateKoi(dt: number): void {
    const k = this.koi, p = this.player;
    if (k.mode === 0) {
      k.a += dt * 1.7;
      const tx = p.x + Math.cos(k.a) * 58, ty = p.y + Math.sin(k.a) * 58;
      const f = 1 - Math.exp(-dt * 5);
      k.x += (tx - k.x) * f;
      k.y += (ty - k.y) * f;
      k.cd -= dt;
      if (k.cd <= 0) {
        let best: Enemy | null = null, bd = 430 * 430;
        for (const e of this.enemies) {
          if (e.dead || e.spawn > 0 || e.kind === 'boss') continue;
          const dd = (e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y);
          if (dd < bd) {
            bd = dd;
            best = e;
          }
        }
        if (best) {
          k.mode = 1;
          k.cx = best.x;
          k.cy = best.y;
        } else {
          k.cd = 0.5;
        }
      }
    } else if (k.mode === 1) {
      const tx = k.cx + KOI_R, ty = k.cy;
      const dx = tx - k.x, dy = ty - k.y, d = Math.hypot(dx, dy);
      const step = 620 * dt;
      if (d <= step) {
        k.x = tx;
        k.y = ty;
        k.mode = 2;
        k.t = 0;
      } else {
        k.x += (dx / d) * step;
        k.y += (dy / d) * step;
      }
    } else {
      k.t += dt / 0.6;
      const a = Math.min(k.t, 1) * TAU;
      k.x = k.cx + Math.cos(a) * KOI_R;
      k.y = k.cy + Math.sin(a) * KOI_R;
      if (k.t >= 1) {
        this.closeLoop(circlePoly(k.cx, k.cy, KOI_R), 'koi');
        k.mode = 0;
        k.cd = 5.5;
        k.a = Math.atan2(k.y - p.y, k.x - p.x);
      }
    }
  }
}

export { B_AIM, B_BURST, B_CHARGE, B_CHASE, B_REEL, B_REST, B_WIND, KOI_R };
