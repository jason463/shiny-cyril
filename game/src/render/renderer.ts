// Draws the page: paper, the accumulated painting, the live line, spirits, effects and HUD.
// Everything is generated in code; there are no image files.

import { Sim, Enemy, GameEvent, PLAYER_R, KOI_R, B_AIM, B_REEL, B_WIND, B_BURST, B_CHARGE } from '../sim/sim';
import { ARENA_W, ARENA_H, ENEMIES, NUMERALS, STAGES } from '../sim/data';
import { Pt, TAU, clamp, Rng } from '../sim/geom';

export const C = {
  desk: '#1b1a1d',
  paper: '#e4e1d6',
  paperHi: '#f1efe7',
  ink: '#16161b',
  inkSoft: '#4a4a55',
  red: '#c5341f',
  redDeep: '#8f2414',
  indigo: '#2c3b68',
  gold: '#b0862a',
};

const DISPLAY = '"Shippori Mincho B1", "Hiragino Mincho ProN", "Yu Mincho", Georgia, serif';
const BODY = '"Zen Kaku Gothic New", "Hiragino Sans", "Segoe UI", system-ui, sans-serif';
const DS = 0.5; // resolution of the painting layer relative to the page

interface Particle { x: number; y: number; vx: number; vy: number; r: number; life: number; max: number; color: string }
interface Flash { poly: Pt[]; t: number; max: number; color: string; strong: boolean }
interface Ring { x: number; y: number; r0: number; r1: number; t: number; max: number; color: string; w: number }
interface FloatText { x: number; y: number; text: string; t: number; max: number; size: number; color: string }
interface Bolt { pts: Pt[]; t: number }
interface Needle { x1: number; y1: number; x2: number; y2: number; t: number }

export interface Hud {
  attract: boolean;
  hint: string;
  touch: boolean;
  stick: { ox: number; oy: number; x: number; y: number } | null;
  dashBtn: { x: number; y: number; r: number } | null;
  insetL: number;
  insetR: number;
}

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  W = 1280;
  H = 720;
  dpr = 1;
  scale = 1;
  cam = { x: ARENA_W / 2, y: ARENA_H / 2 };
  shake = 0;
  reducedMotion = false;
  shakeScale = 1;
  /** where on screen the camera's centre sits, as a fraction of the view (0.5 = middle) */
  focus = { x: 0.5, y: 0.5 };

  private paper: CanvasPattern | null = null;
  private paperTile: HTMLCanvasElement;
  private decal: HTMLCanvasElement;
  private dctx: CanvasRenderingContext2D;
  private vignette: HTMLCanvasElement | null = null;
  private particles: Particle[] = [];
  private flashes: Flash[] = [];
  private rings: Ring[] = [];
  private texts: FloatText[] = [];
  private bolts: Bolt[] = [];
  private needles: Needle[] = [];
  private fx = new Rng(12345);
  private t = 0;
  private hurtFlash = 0;
  private banner = { title: '', sub: '', num: '', t: 99, max: 4 };
  private koiPrev = { x: 0, y: 0, a: 0 };
  private scoreShown = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.paperTile = makePaperTile();
    this.decal = document.createElement('canvas');
    this.decal.width = ARENA_W * DS;
    this.decal.height = ARENA_H * DS;
    this.dctx = this.decal.getContext('2d')!;
    this.reset();
  }

  resize(w: number, h: number): void {
    this.W = Math.max(200, w);
    this.H = Math.max(200, h);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.scale = clamp(Math.sqrt((this.W * this.H) / (1180 * 720)), 0.5, 1.5);
    this.paper = this.ctx.createPattern(this.paperTile, 'repeat');
    this.vignette = makeVignette(this.W, this.H);
  }

  /** Fresh sheet for a new painting. */
  reset(): void {
    this.dctx.setTransform(1, 0, 0, 1, 0, 0);
    this.dctx.clearRect(0, 0, this.decal.width, this.decal.height);
    this.particles = [];
    this.flashes = [];
    this.rings = [];
    this.texts = [];
    this.bolts = [];
    this.needles = [];
    this.hurtFlash = 0;
    this.shake = 0;
    this.scoreShown = 0;
    this.banner.t = 99;
    // a few pale washes so an untouched sheet still has depth
    const r = new Rng(Math.floor(Math.random() * 1e9));
    const d = this.dctx;
    d.save();
    d.scale(DS, DS);
    for (let i = 0; i < 9; i++) {
      const x = r.range(0, ARENA_W), y = r.range(0, ARENA_H), rad = r.range(140, 420);
      const g = d.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(60,62,74,0.05)');
      g.addColorStop(1, 'rgba(60,62,74,0)');
      d.fillStyle = g;
      d.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    d.restore();
  }

  snap(sim: Sim): void {
    this.cam.x = sim.player.x;
    this.cam.y = sim.player.y;
    this.clampCam();
  }

  showBanner(num: string, title: string, sub: string, max = 4.2): void {
    this.banner = { num, title, sub, t: 0, max };
  }

  // ------------------------------------------------------------ events → effects

  handle(ev: GameEvent, sim: Sim): void {
    switch (ev.type) {
      case 'loop': {
        const strong = ev.enso;
        const color = ev.stamped ? C.red : C.ink;
        this.flashes.push({ poly: ev.poly, t: 0, max: strong ? 0.75 : 0.5, color, strong });
        this.stampLoop(ev.poly, ev.src === 'brush' ? (strong ? 0.36 : 0.2) : 0.12, ev.src === 'brush' ? (strong ? 7 : 4.5) : 3, color);
        if (ev.src === 'brush') {
          if (ev.n >= 2) this.text(ev.cx, ev.cy - 6, `×${ev.n}`, 22 + Math.min(ev.n, 20) * 1.6, C.ink, 1.1);
          if (strong) this.text(ev.cx, ev.cy - ev.radius - 18, 'ENSŌ', 20, C.red, 1.3);
          if (ev.kills >= 3) this.shake = Math.min(14, this.shake + 2 + ev.kills * 0.5);
          if (strong) this.rings.push({ x: ev.cx, y: ev.cy, r0: ev.radius, r1: ev.radius + 46, t: 0, max: 0.5, color: C.ink, w: 3 });
        }
        break;
      }
      case 'kill': {
        const n = ev.quiet ? 4 : 7 + Math.floor(ev.r / 4);
        for (let i = 0; i < n; i++) {
          const a = this.fx.range(0, TAU), v = this.fx.range(40, 230) * (ev.r > 30 ? 1.8 : 1);
          this.particles.push({
            x: ev.x, y: ev.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
            r: this.fx.range(1.5, 2.5 + ev.r * 0.22), life: 0, max: this.fx.range(0.3, 0.7), color: C.ink,
          });
        }
        if (!ev.quiet) this.splat(ev.x, ev.y, ev.r, 'rgba(22,22,27,0.16)');
        break;
      }
      case 'hit':
        this.rings.push({ x: ev.x, y: ev.y, r0: 6, r1: 30, t: 0, max: 0.25, color: C.paperHi, w: 3 });
        break;
      case 'hurt': {
        this.hurtFlash = 1;
        this.shake = 20;
        this.rings.push({ x: ev.x, y: ev.y, r0: 10, r1: 210, t: 0, max: 0.4, color: C.red, w: 5 });
        this.splat(ev.x, ev.y, 26, 'rgba(197,52,31,0.5)');
        for (let i = 0; i < 16; i++) {
          const a = this.fx.range(0, TAU), v = this.fx.range(80, 320);
          this.particles.push({ x: ev.x, y: ev.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: this.fx.range(2, 5), life: 0, max: 0.6, color: C.red });
        }
        break;
      }
      case 'shield':
        this.shake = 10;
        this.rings.push({ x: ev.x, y: ev.y, r0: 10, r1: 210, t: 0, max: 0.45, color: C.gold, w: 4 });
        this.text(ev.x, ev.y - 30, 'charm spent', 15, C.gold, 1);
        break;
      case 'charm':
        this.text(sim.player.x, sim.player.y - 30, 'charm', 15, C.gold, 1);
        break;
      case 'heal':
        this.text(sim.player.x, sim.player.y - 30, '+1', 20, C.red, 1);
        break;
      case 'burst':
        this.rings.push({ x: ev.x, y: ev.y, r0: 14, r1: ev.r, t: 0, max: 0.3, color: C.ink, w: 3 });
        break;
      case 'dash':
        for (let i = 0; i < 6; i++) {
          this.particles.push({ x: ev.x, y: ev.y, vx: this.fx.range(-90, 90), vy: this.fx.range(-90, 90), r: this.fx.range(1.5, 3.5), life: 0, max: 0.35, color: C.ink });
        }
        break;
      case 'cut':
        this.text(ev.x, ev.y - 18, 'cut', 15, C.inkSoft, 0.8);
        this.rings.push({ x: ev.x, y: ev.y, r0: 4, r1: 34, t: 0, max: 0.25, color: C.inkSoft, w: 2 });
        break;
      case 'splash':
        this.rings.push({ x: ev.x, y: ev.y, r0: ev.r * 0.7, r1: ev.r, t: 0, max: 0.35, color: C.ink, w: 4 });
        break;
      case 'bolt': {
        const pts: Pt[] = [];
        let x = ev.x + this.fx.range(-120, 120);
        const top = ev.y - 700;
        for (let i = 0; i <= 8; i++) {
          const k = i / 8;
          pts.push({ x: x + (ev.x - x) * k + (i > 0 && i < 8 ? this.fx.range(-26, 26) : 0), y: top + (ev.y - top) * k });
        }
        x = ev.x;
        this.bolts.push({ pts, t: 0 });
        this.rings.push({ x: ev.x, y: ev.y, r0: 6, r1: 44, t: 0, max: 0.3, color: C.indigo, w: 3 });
        break;
      }
      case 'needle':
        this.needles.push({ x1: ev.x1, y1: ev.y1, x2: ev.x2, y2: ev.y2, t: 0 });
        break;
      case 'arrive':
        this.rings.push({ x: ev.x, y: ev.y, r0: 20, r1: 220, t: 0, max: 1.2, color: C.ink, w: 4 });
        break;
      case 'bossReel':
        this.shake = 16;
        this.splat(ev.x, ev.y, 80, 'rgba(22,22,27,0.2)');
        this.rings.push({ x: ev.x, y: ev.y, r0: 40, r1: 260, t: 0, max: 0.6, color: C.ink, w: 6 });
        break;
      case 'bossDown':
        this.shake = 28;
        for (let i = 0; i < 5; i++) this.splat(ev.x + this.fx.range(-90, 90), ev.y + this.fx.range(-90, 90), 90, 'rgba(22,22,27,0.2)');
        for (let i = 0; i < 70; i++) {
          const a = this.fx.range(0, TAU), v = this.fx.range(60, 620);
          this.particles.push({ x: ev.x, y: ev.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: this.fx.range(2, 9), life: 0, max: this.fx.range(0.5, 1.4), color: C.ink });
        }
        this.rings.push({ x: ev.x, y: ev.y, r0: 40, r1: 520, t: 0, max: 1.1, color: C.ink, w: 8 });
        break;
      case 'stage': {
        const st = STAGES[ev.index];
        if (!sim.attract) this.showBanner(NUMERALS[ev.index] ?? '', st.name, st.sub);
        break;
      }
      case 'levelup':
        this.rings.push({ x: sim.player.x, y: sim.player.y, r0: 12, r1: 120, t: 0, max: 0.5, color: C.gold, w: 3 });
        break;
      default:
        break;
    }
  }

  private text(x: number, y: number, text: string, size: number, color: string, max: number): void {
    this.texts.push({ x, y, text, t: 0, max, size, color });
  }

  // ------------------------------------------------------------ the painting layer

  private stampLoop(poly: Pt[], alpha: number, width: number, color: string): void {
    const d = this.dctx;
    d.save();
    d.scale(DS, DS);
    d.lineJoin = 'round';
    d.lineCap = 'round';
    d.strokeStyle = color;
    d.fillStyle = color;
    d.globalAlpha = 0.03;
    tracePoly(d, poly);
    d.fill();
    // three passes with small offsets read as one uneven brush stroke
    for (let pass = 0; pass < 3; pass++) {
      d.globalAlpha = alpha * (pass === 0 ? 1 : 0.45);
      d.lineWidth = width * (pass === 0 ? 1 : 0.55);
      const ox = pass === 0 ? 0 : this.fx.range(-2.5, 2.5), oy = pass === 0 ? 0 : this.fx.range(-2.5, 2.5);
      d.beginPath();
      // leave a small gap: an ensō is never quite closed
      const gap = Math.max(1, Math.floor(poly.length * 0.04));
      for (let i = 0; i < poly.length - gap; i++) {
        const q = poly[i];
        if (i === 0) d.moveTo(q.x + ox, q.y + oy);
        else d.lineTo(q.x + ox, q.y + oy);
      }
      d.stroke();
    }
    d.restore();
  }

  private splat(x: number, y: number, r: number, color: string): void {
    const d = this.dctx;
    d.save();
    d.scale(DS, DS);
    d.fillStyle = color;
    const n = 4 + Math.floor(r / 6);
    for (let i = 0; i < n; i++) {
      const a = this.fx.range(0, TAU), dist = this.fx.range(0, r * 1.5) * this.fx.next();
      d.beginPath();
      d.arc(x + Math.cos(a) * dist, y + Math.sin(a) * dist, this.fx.range(1, r * 0.42), 0, TAU);
      d.fill();
    }
    d.restore();
  }

  /** The finished sheet, for the results screen. */
  painting(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.decal.width;
    c.height = this.decal.height;
    const g = c.getContext('2d')!;
    g.fillStyle = g.createPattern(this.paperTile, 'repeat')!;
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(this.decal, 0, 0);
    // margin rule
    g.strokeStyle = 'rgba(22,22,27,0.35)';
    g.lineWidth = 1.5;
    g.strokeRect(14, 14, c.width - 28, c.height - 28);
    // the painter's seal
    const s = 44, x = c.width - 30 - s, y = c.height - 30 - s;
    g.fillStyle = C.red;
    g.globalAlpha = 0.88;
    roundRect(g, x, y, s, s, 5);
    g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = C.paperHi;
    g.lineWidth = 3.2;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(x + s / 2, y + s / 2, s * 0.27, -1.2, 4.3);
    g.stroke();
    return c;
  }

  // ------------------------------------------------------------ frame

  private clampCam(): void {
    const vw = this.W / this.scale, vh = this.H / this.scale;
    const m = 70;
    if (vw >= ARENA_W + m * 2) this.cam.x = ARENA_W / 2;
    else this.cam.x = clamp(this.cam.x, vw / 2 - m, ARENA_W - vw / 2 + m);
    if (vh >= ARENA_H + m * 2) this.cam.y = ARENA_H / 2;
    else this.cam.y = clamp(this.cam.y, vh / 2 - m, ARENA_H - vh / 2 + m);
  }

  toScreen(x: number, y: number): Pt {
    return { x: (x - this.cam.x) * this.scale + this.W * this.focus.x, y: (y - this.cam.y) * this.scale + this.H * this.focus.y };
  }

  draw(sim: Sim, dt: number, hud: Hud): void {
    const g = this.ctx, p = sim.player;
    this.t += dt;

    // camera
    const lead = hud.attract ? 0 : 0.2;
    const f = 1 - Math.exp(-dt * 5);
    this.cam.x += (p.x + p.vx * lead - this.cam.x) * f;
    this.cam.y += (p.y + p.vy * lead - this.cam.y) * f;
    this.clampCam();
    this.shake *= Math.exp(-dt * 9);
    const sh = this.reducedMotion ? 0 : this.shake * this.shakeScale;
    const sx = sh > 0.2 ? (this.fx.next() - 0.5) * sh : 0;
    const sy = sh > 0.2 ? (this.fx.next() - 0.5) * sh : 0;

    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = C.desk;
    g.fillRect(0, 0, this.W, this.H);

    const s = this.scale;
    const ox = this.W * this.focus.x - this.cam.x * s + sx, oy = this.H * this.focus.y - this.cam.y * s + sy;
    g.setTransform(this.dpr * s, 0, 0, this.dpr * s, this.dpr * ox, this.dpr * oy);

    // visible world rectangle
    const vx0 = -ox / s, vy0 = -oy / s, vw = this.W / s, vh = this.H / s;

    // paper + its shadow on the desk
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(8, 10, ARENA_W, ARENA_H);
    g.fillStyle = this.paper ?? C.paper;
    g.fillRect(0, 0, ARENA_W, ARENA_H);

    // the painting so far (only the visible part)
    const cx0 = clamp(vx0, 0, ARENA_W), cy0 = clamp(vy0, 0, ARENA_H);
    const cx1 = clamp(vx0 + vw, 0, ARENA_W), cy1 = clamp(vy0 + vh, 0, ARENA_H);
    if (cx1 > cx0 && cy1 > cy0) {
      g.drawImage(this.decal, cx0 * DS, cy0 * DS, (cx1 - cx0) * DS, (cy1 - cy0) * DS, cx0, cy0, cx1 - cx0, cy1 - cy0);
    }

    // margin rules, like a mounted scroll
    g.strokeStyle = 'rgba(22,22,27,0.42)';
    g.lineWidth = 2;
    g.strokeRect(26, 26, ARENA_W - 52, ARENA_H - 52);
    g.strokeStyle = 'rgba(22,22,27,0.2)';
    g.lineWidth = 1;
    g.strokeRect(33, 33, ARENA_W - 66, ARENA_H - 66);

    this.drawZones(g, sim);
    this.drawFlashes(g, dt);
    this.drawOrbs(g, sim);
    this.drawTrail(g, sim);
    if (sim.koi.on) this.drawKoi(g, sim, dt);
    for (const e of sim.enemies) {
      if (e.dead) continue;
      if (e.x < vx0 - 320 || e.x > vx0 + vw + 320 || e.y < vy0 - 320 || e.y > vy0 + vh + 320) continue;
      this.drawEnemy(g, e, sim);
    }
    this.drawShots(g, sim);
    if (sim.phase !== 'dead') this.drawPlayer(g, sim);
    this.drawEffects(g, dt);

    // screen space
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (sim.slowT > 0) {
      g.fillStyle = `rgba(44,59,104,${0.07 * Math.min(1, sim.slowT)})`;
      g.fillRect(0, 0, this.W, this.H);
    }
    if (this.vignette) g.drawImage(this.vignette, 0, 0, this.W, this.H);
    if (this.hurtFlash > 0) {
      this.hurtFlash -= dt * 2.2;
      g.fillStyle = `rgba(197,52,31,${0.28 * Math.max(0, this.hurtFlash)})`;
      g.fillRect(0, 0, this.W, this.H);
    }
    if (!hud.attract) {
      this.drawEdgeArrows(g, sim, vx0, vy0, vw, vh);
      this.drawHud(g, sim, dt, hud);
    }
  }

  // ------------------------------------------------------------ world pieces

  private drawTrail(g: CanvasRenderingContext2D, sim: Sim): void {
    const t = sim.trail, p = sim.player;
    if (t.length < 1) return;
    const n = t.length + 1;
    const w0 = sim.stats.width;
    const L: number[] = new Array(n * 2), R: number[] = new Array(n * 2);
    let arc = 0;
    const full = Math.max(sim.trailLen, 1);
    for (let i = 0; i < n; i++) {
      const a = i === 0 ? t[0] : i < t.length ? t[i - 1] : t[t.length - 1];
      const c = i < t.length ? t[i] : p;
      const b = i + 1 < t.length ? t[i + 1] : p;
      if (i > 0) arc += Math.hypot(c.x - a.x, c.y - a.y);
      let nx = -(b.y - a.y), ny = b.x - a.x;
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl;
      ny /= nl;
      // thin where the stroke is oldest, full in the body, with a slight tremor
      const tail = clamp(arc / 110, 0.12, 1);
      const od = sim.trailOdo + arc;
      const tremor = 0.86 + 0.14 * Math.sin(od * 0.045) + 0.06 * Math.sin(od * 0.21);
      const head = arc > full - 14 ? 1.12 : 1;
      const w = w0 * 0.5 * tail * tremor * head;
      L[i * 2] = c.x + nx * w;
      L[i * 2 + 1] = c.y + ny * w;
      R[i * 2] = c.x - nx * w;
      R[i * 2 + 1] = c.y - ny * w;
    }
    g.fillStyle = C.ink;
    g.beginPath();
    g.moveTo(L[0], L[1]);
    for (let i = 1; i < n; i++) g.lineTo(L[i * 2], L[i * 2 + 1]);
    for (let i = n - 1; i >= 0; i--) g.lineTo(R[i * 2], R[i * 2 + 1]);
    g.closePath();
    g.fill();

    // dry-brush: broken pale streaks inside the stroke
    if (n > 6) {
      g.save();
      g.strokeStyle = 'rgba(228,225,214,0.26)';
      g.lineWidth = Math.max(1, w0 * 0.13);
      g.setLineDash([22, 9, 6, 14, 34, 11]);
      g.lineDashOffset = sim.trailOdo;
      for (const k of [0.45, -0.38]) {
        g.beginPath();
        for (let i = 2; i < n - 1; i++) {
          const x = (L[i * 2] + R[i * 2]) / 2 + ((L[i * 2] - R[i * 2]) / 2) * k;
          const y = (L[i * 2 + 1] + R[i * 2 + 1]) / 2 + ((L[i * 2 + 1] - R[i * 2 + 1]) / 2) * k;
          if (i === 2) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
        g.lineDashOffset += 37;
      }
      g.restore();
    }
  }

  private drawPlayer(g: CanvasRenderingContext2D, sim: Sim): void {
    const p = sim.player;
    if (p.inv > 0 && p.dashT <= 0 && !sim.attract && Math.floor(this.t * 14) % 2 === 0) g.globalAlpha = 0.35;
    const a = Math.atan2(p.fy, p.fx);
    const r = PLAYER_R;
    g.save();
    g.translate(p.x, p.y);
    g.rotate(a);
    const stretch = p.dashT > 0 ? 1.5 : 1 + Math.min(0.25, Math.hypot(p.vx, p.vy) / 1400);
    g.scale(stretch, 1 / Math.sqrt(stretch));
    g.beginPath();
    g.moveTo(r * 1.55, 0);
    g.quadraticCurveTo(r * 0.6, r * 1.05, -r * 0.55, r * 0.92);
    g.quadraticCurveTo(-r * 1.25, 0, -r * 0.55, -r * 0.92);
    g.quadraticCurveTo(r * 0.6, -r * 1.05, r * 1.55, 0);
    g.closePath();
    g.fillStyle = C.red;
    g.fill();
    g.lineWidth = 1.6;
    g.strokeStyle = C.ink;
    g.stroke();
    g.fillStyle = 'rgba(255,240,225,0.55)';
    g.beginPath();
    g.ellipse(-r * 0.1, -r * 0.34, r * 0.34, r * 0.17, -0.3, 0, TAU);
    g.fill();
    g.restore();
    g.globalAlpha = 1;

    if (p.charm) {
      g.strokeStyle = C.gold;
      g.lineWidth = 2;
      g.setLineDash([7, 5]);
      g.lineDashOffset = -this.t * 20;
      g.beginPath();
      g.arc(p.x, p.y, r + 9, 0, TAU);
      g.stroke();
      g.setLineDash([]);
    }
    // flick recharge
    if (p.dashCd > 0 && !sim.attract) {
      const k = 1 - clamp(p.dashCd / sim.stats.dashCd, 0, 1);
      g.strokeStyle = 'rgba(22,22,27,0.4)';
      g.lineWidth = 2.2;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(p.x, p.y, r + 15, -Math.PI / 2, -Math.PI / 2 + TAU * k);
      g.stroke();
      g.lineCap = 'butt';
    }
  }

  private drawEnemy(g: CanvasRenderingContext2D, e: Enemy, sim: Sim): void {
    const t = this.t;
    if (e.spawn > 0) {
      // seeping onto the page
      const k = 1 - e.spawn / e.spawnMax;
      g.fillStyle = `rgba(22,22,27,${0.08 + 0.25 * k})`;
      g.beginPath();
      g.arc(e.x, e.y, e.r * (0.35 + 0.85 * k), 0, TAU);
      g.fill();
      g.fillStyle = `rgba(22,22,27,${0.3 + 0.4 * k})`;
      for (let i = 0; i < 4; i++) {
        const a = e.seed + i * 1.7 + k * 2;
        g.beginPath();
        g.arc(e.x + Math.cos(a) * e.r * (1.6 - k), e.y + Math.sin(a) * e.r * (1.6 - k), 1.6 + k * 1.5, 0, TAU);
        g.fill();
      }
      return;
    }

    const body = e.flash > 0.08 ? C.paperHi : e.stun > 0 ? '#34343d' : C.ink;
    const look = e.face;
    const r = e.r;

    // telegraphs sit under the body
    if (e.kind === 'darter' && e.state === 1) {
      const k = 1 - clamp(e.st / 0.9, 0, 1);
      g.strokeStyle = `rgba(197,52,31,${0.15 + 0.5 * k})`;
      g.lineWidth = 1.5 + 3 * k;
      g.setLineDash(e.st > 0.25 ? [10, 8] : []);
      g.beginPath();
      g.moveTo(e.x, e.y);
      g.lineTo(e.x + e.ax * 270, e.y + e.ay * 270);
      g.stroke();
      g.setLineDash([]);
    }
    if (e.kind === 'boss') {
      if (e.state === B_AIM) {
        const k = 1 - clamp(e.st / 1.05, 0, 1);
        g.strokeStyle = `rgba(197,52,31,${0.12 + 0.35 * k})`;
        g.lineWidth = r * 1.7 * (0.3 + 0.7 * k);
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(e.x, e.y);
        g.lineTo(e.x + e.ax * 520, e.y + e.ay * 520);
        g.stroke();
        g.lineCap = 'butt';
      } else if (e.state === B_WIND) {
        const k = 1 - clamp(e.st / 0.95, 0, 1);
        g.strokeStyle = `rgba(197,52,31,${0.2 + 0.5 * k})`;
        g.lineWidth = 3;
        g.beginPath();
        g.arc(e.x, e.y, r + 60 - 40 * k, 0, TAU);
        g.stroke();
      }
    }

    g.save();
    g.translate(e.x, e.y);
    g.fillStyle = body;

    switch (e.kind) {
      case 'drifter':
        blob(g, r, e.seed, t, 0.1, 9);
        g.fill();
        eyes(g, look, r, 2, 0.24);
        break;
      case 'mite':
        blob(g, r, e.seed, t * 2, 0.16, 7);
        g.fill();
        eyes(g, look, r, 1, 0.4);
        break;
      case 'splitter': {
        g.rotate(Math.sin(t * 0.8 + e.seed) * 0.4);
        g.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * TAU;
          const pr = r * (0.62 + 0.05 * Math.sin(t * 3 + i * 2 + e.seed));
          g.moveTo(Math.cos(a) * r * 0.5 + pr, Math.sin(a) * r * 0.5);
          g.arc(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, pr, 0, TAU);
        }
        g.fill();
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * TAU;
          g.fillStyle = C.paperHi;
          g.beginPath();
          g.arc(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.17, 0, TAU);
          g.fill();
        }
        break;
      }
      case 'shell': {
        blob(g, r, e.seed, t, 0.07, 9);
        g.fill();
        if (e.hp >= e.maxHp) {
          g.strokeStyle = e.flash > 0.08 ? C.paperHi : C.indigo;
          g.lineWidth = r * 0.34;
          g.lineCap = 'round';
          for (let i = 0; i < 3; i++) {
            const a = e.seed + (i / 3) * TAU + t * 0.5;
            g.beginPath();
            g.arc(0, 0, r * 1.02, a, a + 1.5);
            g.stroke();
          }
          g.lineCap = 'butt';
        } else {
          g.strokeStyle = C.paperHi;
          g.lineWidth = 1.4;
          g.beginPath();
          g.moveTo(-r * 0.5, -r * 0.6);
          g.lineTo(-r * 0.1, -r * 0.1);
          g.lineTo(-r * 0.45, r * 0.3);
          g.moveTo(r * 0.5, r * 0.6);
          g.lineTo(r * 0.2, r * 0.15);
          g.stroke();
        }
        eyes(g, look, r, 2, 0.22);
        break;
      }
      case 'darter': {
        const a = e.state === 1 || e.state === 2 ? Math.atan2(e.ay, e.ax) : Math.atan2(e.vy, e.vx);
        g.rotate(a);
        const sq = e.state === 1 ? 0.8 : e.state === 2 ? 1.5 : 1.15;
        g.scale(sq, 1 / sq);
        g.beginPath();
        g.moveTo(r * 1.5, 0);
        g.quadraticCurveTo(r * 0.3, r * 1.05, -r * 1.1, r * 0.5);
        g.quadraticCurveTo(-r * 0.6, 0, -r * 1.1, -r * 0.5);
        g.quadraticCurveTo(r * 0.3, -r * 1.05, r * 1.5, 0);
        g.fill();
        g.fillStyle = C.paperHi;
        g.beginPath();
        g.arc(r * 0.45, 0, r * 0.24, 0, TAU);
        g.fill();
        g.fillStyle = C.ink;
        g.beginPath();
        g.arc(r * 0.53, 0, r * 0.11, 0, TAU);
        g.fill();
        break;
      }
      case 'cutter': {
        g.rotate(e.age * 6.5);
        g.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU;
          const rr = i % 2 === 0 ? r * 1.45 : r * 0.5;
          if (i === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
          else g.lineTo(Math.cos(a + 0.35) * rr, Math.sin(a + 0.35) * rr);
        }
        g.closePath();
        g.fill();
        g.strokeStyle = C.paperHi;
        g.lineWidth = 1.2;
        g.beginPath();
        g.arc(0, 0, r * 0.42, 0, TAU);
        g.stroke();
        break;
      }
      case 'spitter': {
        const puff = e.state === 1 ? 1 + 0.3 * (1 - clamp(e.st / 0.6, 0, 1)) : 1;
        g.scale(puff, puff);
        blob(g, r, e.seed, t, 0.08, 10);
        g.fill();
        g.strokeStyle = e.state === 1 ? C.red : C.paperHi;
        g.lineWidth = r * 0.16;
        g.beginPath();
        g.arc(Math.cos(look) * r * 0.5, Math.sin(look) * r * 0.5, r * 0.26, 0, TAU);
        g.stroke();
        eyes(g, look + Math.PI, r * 0.8, 2, 0.16);
        break;
      }
      case 'wisp': {
        const a = Math.atan2(e.vy, e.vx);
        g.rotate(a);
        g.beginPath();
        g.moveTo(r, 0);
        g.quadraticCurveTo(r * 0.4, r * 1.1, -r * 0.6, r * 0.6);
        g.quadraticCurveTo(-r * 2.2, r * 0.3 + Math.sin(t * 14 + e.seed) * r * 0.5, -r * 4, Math.sin(t * 9 + e.seed) * r * 0.8);
        g.quadraticCurveTo(-r * 2.2, -r * 0.3 + Math.sin(t * 14 + e.seed) * r * 0.5, -r * 0.6, -r * 0.6);
        g.quadraticCurveTo(r * 0.4, -r * 1.1, r, 0);
        g.fill();
        g.fillStyle = C.paperHi;
        g.beginPath();
        g.arc(r * 0.15, 0, r * 0.3, 0, TAU);
        g.fill();
        break;
      }
      case 'giant': {
        blob(g, r, e.seed, t * 0.6, 0.06, 13);
        g.fill();
        // drips
        for (let i = 0; i < 5; i++) {
          const a = e.seed + i * 1.26;
          const dr = r * (1.05 + 0.12 * Math.sin(t * 1.5 + i));
          g.beginPath();
          g.arc(Math.cos(a) * dr, Math.sin(a) * dr, r * 0.16, 0, TAU);
          g.fill();
        }
        eyes(g, look, r, 3, 0.15);
        // remaining layers
        g.fillStyle = C.paperHi;
        for (let i = 0; i < e.hp; i++) {
          g.beginPath();
          g.arc((i - (e.hp - 1) / 2) * 9, r * 0.5, 2.6, 0, TAU);
          g.fill();
        }
        break;
      }
      case 'boss': {
        const reel = e.state === B_REEL;
        const k = reel ? 0.35 + 0.65 * Math.abs(Math.cos(clamp(e.st / 2.4, 0, 1) * Math.PI)) * (e.st < 0.5 ? 1 : 0.4) : 1;
        if (reel) g.globalAlpha = 0.55;
        g.scale(k, k);
        const busy = e.state === B_BURST || e.state === B_CHARGE ? 0.13 : 0.075;
        blob(g, r, e.seed, t * 0.8, busy, 16);
        g.fill();
        for (let i = 0; i < 9; i++) {
          const a = e.seed + i * 0.7 + t * 0.2;
          const dr = r * (1.04 + 0.1 * Math.sin(t * 1.3 + i * 2));
          g.beginPath();
          g.arc(Math.cos(a) * dr, Math.sin(a) * dr, r * (0.1 + 0.05 * Math.sin(i * 3)), 0, TAU);
          g.fill();
        }
        if (!reel) {
          // a scatter of eyes that all watch the brush
          const er = new Rng(Math.floor(e.seed) + 5);
          for (let i = 0; i < 9; i++) {
            const a = er.range(0, TAU), d = er.range(0.1, 0.68) * r, size = er.range(0.06, 0.13) * r;
            const blink = Math.sin(t * 1.1 + i * 1.9) > 0.94;
            const ex = Math.cos(a) * d, ey = Math.sin(a) * d;
            g.fillStyle = e.state === B_AIM || e.state === B_WIND ? '#f3d9d2' : C.paperHi;
            g.beginPath();
            g.ellipse(ex, ey, size, blink ? size * 0.15 : size, 0, 0, TAU);
            g.fill();
            if (!blink) {
              g.fillStyle = C.ink;
              g.beginPath();
              g.arc(ex + Math.cos(look) * size * 0.4, ey + Math.sin(look) * size * 0.4, size * 0.45, 0, TAU);
              g.fill();
            }
          }
        }
        break;
      }
    }
    g.restore();
    void sim;
  }

  private drawShots(g: CanvasRenderingContext2D, sim: Sim): void {
    for (const s of sim.shots) {
      g.fillStyle = C.ink;
      g.beginPath();
      g.arc(s.x, s.y, s.r, 0, TAU);
      g.fill();
      g.strokeStyle = C.red;
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(s.x, s.y, s.r + 2.5, 0, TAU);
      g.stroke();
      g.fillStyle = C.paperHi;
      g.beginPath();
      g.arc(s.x - s.r * 0.25, s.y - s.r * 0.25, s.r * 0.28, 0, TAU);
      g.fill();
    }
  }

  private drawOrbs(g: CanvasRenderingContext2D, sim: Sim): void {
    for (const o of sim.orbs) {
      if (o.heal) {
        g.fillStyle = C.red;
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU + this.t * 2;
          g.beginPath();
          g.arc(o.x + Math.cos(a) * 5, o.y + Math.sin(a) * 5, 4, 0, TAU);
          g.fill();
        }
        g.fillStyle = C.gold;
        g.beginPath();
        g.arc(o.x, o.y, 2.5, 0, TAU);
        g.fill();
        continue;
      }
      const r = 2.6 + Math.min(4, Math.sqrt(o.value));
      g.fillStyle = C.gold;
      g.beginPath();
      g.arc(o.x, o.y, r, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(22,22,27,0.55)';
      g.lineWidth = 1;
      g.stroke();
    }
  }

  private drawZones(g: CanvasRenderingContext2D, sim: Sim): void {
    for (const z of sim.zones) {
      const k = clamp(z.t / z.max, 0, 1);
      g.fillStyle = `rgba(197,82,31,${0.1 * k + 0.04 * Math.sin(this.t * 9) * k})`;
      tracePoly(g, z.poly);
      g.fill();
      g.strokeStyle = `rgba(197,52,31,${0.55 * k})`;
      g.lineWidth = 2;
      g.setLineDash([3, 9]);
      g.lineDashOffset = this.t * 30;
      g.stroke();
      g.setLineDash([]);
    }
  }

  private drawFlashes(g: CanvasRenderingContext2D, dt: number): void {
    for (const f of this.flashes) {
      f.t += dt;
      const k = clamp(f.t / f.max, 0, 1), inv = 1 - k;
      tracePoly(g, f.poly);
      g.globalAlpha = (f.strong ? 0.42 : 0.26) * inv * inv;
      g.fillStyle = f.color;
      g.fill();
      g.globalAlpha = inv;
      g.strokeStyle = f.color;
      g.lineJoin = 'round';
      g.lineWidth = 3 + (f.strong ? 16 : 9) * inv;
      g.stroke();
      g.globalAlpha = 1;
    }
    if (this.flashes.length && this.flashes[0].t >= this.flashes[0].max) this.flashes = this.flashes.filter((f) => f.t < f.max);
  }

  private drawKoi(g: CanvasRenderingContext2D, sim: Sim, dt: number): void {
    const k = sim.koi, kp = this.koiPrev;
    const dx = k.x - kp.x, dy = k.y - kp.y;
    if (dx * dx + dy * dy > 0.01) {
      const target = Math.atan2(dy, dx);
      let da = target - kp.a;
      while (da > Math.PI) da -= TAU;
      while (da < -Math.PI) da += TAU;
      kp.a += da * (1 - Math.exp(-dt * 12));
    }
    kp.x = k.x;
    kp.y = k.y;
    if (k.mode === 2) {
      g.strokeStyle = 'rgba(22,22,27,0.75)';
      g.lineWidth = 4;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(k.cx, k.cy, KOI_R, 0, clamp(k.t, 0, 1) * TAU);
      g.stroke();
      g.lineCap = 'butt';
    }
    g.save();
    g.translate(k.x, k.y);
    g.rotate(kp.a);
    const wag = Math.sin(this.t * 11) * 0.35;
    g.fillStyle = C.paperHi;
    g.strokeStyle = C.ink;
    g.lineWidth = 1.3;
    g.beginPath();
    g.ellipse(0, 0, 13, 5.5, 0, 0, TAU);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(-11, 0);
    g.lineTo(-21, -6 + wag * 8);
    g.lineTo(-18, wag * 8);
    g.lineTo(-21, 6 + wag * 8);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = C.red;
    g.beginPath();
    g.ellipse(3, -1, 5, 3.4, 0.3, 0, TAU);
    g.fill();
    g.beginPath();
    g.ellipse(-6, 1.5, 3, 2, 0, 0, TAU);
    g.fill();
    g.fillStyle = C.ink;
    g.beginPath();
    g.arc(9, -1.6, 1.1, 0, TAU);
    g.fill();
    g.restore();
  }

  private drawEffects(g: CanvasRenderingContext2D, dt: number): void {
    // droplets
    let alive = 0;
    for (const p of this.particles) {
      p.life += dt;
      if (p.life >= p.max) continue;
      alive++;
      const f = Math.exp(-dt * 3.2);
      p.vx *= f;
      p.vy *= f;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const k = 1 - p.life / p.max;
      g.fillStyle = p.color;
      g.globalAlpha = Math.min(1, k * 1.6);
      g.beginPath();
      g.arc(p.x, p.y, p.r * (0.4 + 0.6 * k), 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
    if (alive < this.particles.length) this.particles = this.particles.filter((p) => p.life < p.max);
    if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);

    for (const r of this.rings) {
      r.t += dt;
      const k = clamp(r.t / r.max, 0, 1), e = 1 - (1 - k) * (1 - k);
      g.globalAlpha = 1 - k;
      g.strokeStyle = r.color;
      g.lineWidth = r.w * (1 - k * 0.6);
      g.beginPath();
      g.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * e, 0, TAU);
      g.stroke();
    }
    g.globalAlpha = 1;
    this.rings = this.rings.filter((r) => r.t < r.max);

    for (const b of this.bolts) {
      b.t += dt;
      const k = clamp(b.t / 0.28, 0, 1);
      g.globalAlpha = 1 - k;
      g.strokeStyle = C.indigo;
      g.lineWidth = 5 * (1 - k) + 1;
      g.lineJoin = 'miter';
      g.beginPath();
      b.pts.forEach((q, i) => (i === 0 ? g.moveTo(q.x, q.y) : g.lineTo(q.x, q.y)));
      g.stroke();
      g.strokeStyle = C.paperHi;
      g.lineWidth = 1.5;
      g.stroke();
    }
    g.globalAlpha = 1;
    this.bolts = this.bolts.filter((b) => b.t < 0.28);

    for (const n of this.needles) {
      n.t += dt;
      const k = clamp(n.t / 0.22, 0, 1);
      g.globalAlpha = 1 - k;
      g.strokeStyle = C.ink;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(n.x1 + (n.x2 - n.x1) * k * 0.6, n.y1 + (n.y2 - n.y1) * k * 0.6);
      g.lineTo(n.x2, n.y2);
      g.stroke();
    }
    g.globalAlpha = 1;
    this.needles = this.needles.filter((n) => n.t < 0.22);

    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const x of this.texts) {
      x.t += dt;
      const k = clamp(x.t / x.max, 0, 1);
      const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.5 : 1.1 - Math.min(0.1, (k - 0.12) * 0.5);
      g.globalAlpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
      g.font = `700 ${Math.round(x.size * pop)}px ${DISPLAY}`;
      g.lineWidth = 4;
      g.strokeStyle = 'rgba(241,239,231,0.85)';
      g.strokeText(x.text, x.x, x.y - k * 26);
      g.fillStyle = x.color;
      g.fillText(x.text, x.x, x.y - k * 26);
    }
    g.globalAlpha = 1;
    this.texts = this.texts.filter((x) => x.t < x.max);
  }

  /** Small markers at the edge of the view for the big things you cannot see. */
  private drawEdgeArrows(g: CanvasRenderingContext2D, sim: Sim, vx0: number, vy0: number, vw: number, vh: number): void {
    for (const e of sim.enemies) {
      if (e.dead || (e.kind !== 'boss' && e.kind !== 'giant')) continue;
      if (e.x > vx0 && e.x < vx0 + vw && e.y > vy0 && e.y < vy0 + vh) continue;
      const cx = this.W / 2, cy = this.H / 2;
      const sp = this.toScreen(e.x, e.y);
      const a = Math.atan2(sp.y - cy, sp.x - cx);
      const m = 34;
      const kx = Math.abs(Math.cos(a)) > 1e-6 ? (cx - m) / Math.abs(Math.cos(a)) : Infinity;
      const ky = Math.abs(Math.sin(a)) > 1e-6 ? (cy - m) / Math.abs(Math.sin(a)) : Infinity;
      const k = Math.min(kx, ky);
      g.save();
      g.translate(cx + Math.cos(a) * k, cy + Math.sin(a) * k);
      g.rotate(a);
      g.fillStyle = e.kind === 'boss' ? C.red : C.ink;
      g.beginPath();
      g.moveTo(12, 0);
      g.lineTo(-8, 9);
      g.lineTo(-3, 0);
      g.lineTo(-8, -9);
      g.closePath();
      g.fill();
      g.restore();
    }
  }

  // ------------------------------------------------------------ HUD

  private drawHud(g: CanvasRenderingContext2D, sim: Sim, dt: number, hud: Hud): void {
    const p = sim.player, W = this.W, H = this.H;
    const left = 18 + hud.insetL, right = W - 18 - hud.insetR;
    const compact = W < 560;

    // a pale band keeps the HUD readable wherever the camera is
    const band = g.createLinearGradient(0, 0, 0, 78);
    band.addColorStop(0, 'rgba(228,225,214,0.92)');
    band.addColorStop(0.7, 'rgba(228,225,214,0.6)');
    band.addColorStop(1, 'rgba(228,225,214,0)');
    g.fillStyle = band;
    g.fillRect(0, 0, W, 78);

    // essence: a single line across the top of the sheet
    const need = sim.need, frac = clamp(sim.essence / need, 0, 1);
    g.fillStyle = 'rgba(22,22,27,0.16)';
    g.fillRect(0, 0, W, 4);
    g.fillStyle = C.gold;
    g.fillRect(0, 0, W * frac, 4);

    // health drops
    for (let i = 0; i < p.maxHp; i++) {
      const x = left + 9 + i * 24, y = 30;
      g.beginPath();
      g.moveTo(x, y - 11);
      g.bezierCurveTo(x + 9, y - 1, x + 8, y + 9, x, y + 9);
      g.bezierCurveTo(x - 8, y + 9, x - 9, y - 1, x, y - 11);
      g.closePath();
      if (i < p.hp) {
        g.fillStyle = C.red;
        g.fill();
      } else {
        g.fillStyle = 'rgba(22,22,27,0.1)';
        g.fill();
      }
      g.strokeStyle = C.ink;
      g.lineWidth = 1.4;
      g.stroke();
    }
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.fillStyle = C.ink;
    g.font = `500 12px ${BODY}`;
    const lv = `STROKE ${sim.level + 1}`;
    g.fillText(spaced(lv), left, 56);

    // stage + time
    const st = sim.stageDef;
    g.textAlign = 'center';
    if (!st.boss) {
      const remain = Math.max(0, st.dur - sim.stageT);
      g.font = `600 ${compact ? 15 : 18}px ${DISPLAY}`;
      g.fillStyle = C.ink;
      g.fillText(`${NUMERALS[sim.stage]}  ·  ${st.name}`, W / 2, 26);
      g.font = `500 12px ${BODY}`;
      g.fillStyle = remain < 10 ? C.red : C.inkSoft;
      g.fillText(clock(remain), W / 2, 46);
    }

    // score
    this.scoreShown += (sim.tally.score - this.scoreShown) * (1 - Math.exp(-dt * 8));
    g.textAlign = 'right';
    g.font = `600 ${compact ? 18 : 22}px ${DISPLAY}`;
    g.fillStyle = C.ink;
    const scoreRight = right - 46;
    g.fillText(Math.round(this.scoreShown).toLocaleString('en-US'), scoreRight, 27);
    g.font = `500 11px ${BODY}`;
    g.fillStyle = C.inkSoft;
    g.fillText(spaced(`${sim.tally.kills} SEALED`), scoreRight, 47);

    // the boss's remaining layers
    const boss = sim.boss;
    if (boss && boss.spawn <= 0) {
      const n = boss.maxHp, pw = Math.min(30, (W - 80) / n - 6), total = n * (pw + 6) - 6;
      const y = H - (hud.touch ? 126 : 46);
      g.textAlign = 'center';
      g.font = `600 16px ${DISPLAY}`;
      g.fillStyle = C.ink;
      g.fillText(ENEMIES.boss.name, W / 2, y - 20);
      for (let i = 0; i < n; i++) {
        const x = W / 2 - total / 2 + i * (pw + 6);
        g.fillStyle = i < boss.hp ? C.ink : 'rgba(22,22,27,0.14)';
        g.fillRect(x, y, pw, 7);
      }
    }

    // banner
    const b = this.banner;
    if (b.t < b.max) {
      b.t += dt;
      const k = b.t / b.max;
      const a = k < 0.12 ? k / 0.12 : k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      const y = H * 0.3;
      g.globalAlpha = a;
      g.textAlign = 'center';
      const big = clamp(W / 13, 30, 68);
      g.fillStyle = 'rgba(228,225,214,0.72)';
      g.fillRect(0, y - big * 1.25, W, big * 2.7);
      g.fillStyle = C.red;
      g.font = `600 ${Math.round(big * 0.34)}px ${DISPLAY}`;
      g.fillText(b.num, W / 2, y - big * 0.82);
      g.fillStyle = C.ink;
      g.font = `700 ${Math.round(big)}px ${DISPLAY}`;
      g.fillText(b.title, W / 2, y);
      g.font = `500 ${compact ? 13 : 15}px ${BODY}`;
      g.fillStyle = C.inkSoft;
      wrapText(g, b.sub, W / 2, y + big * 0.85, W - 48, 20);
      g.globalAlpha = 1;
    }

    // hint
    if (hud.hint) {
      g.font = `500 ${compact ? 14 : 16}px ${BODY}`;
      g.textAlign = 'center';
      const y = H - (hud.touch ? 150 : 78) - (boss ? 64 : 0);
      const w = Math.min(W - 32, g.measureText(hud.hint).width + 44);
      g.fillStyle = 'rgba(22,22,27,0.86)';
      roundRect(g, W / 2 - w / 2, y - 19, w, 38, 19);
      g.fill();
      g.fillStyle = C.paperHi;
      g.fillText(hud.hint, W / 2, y + 1, W - 60);
    }

    // touch controls
    if (hud.stick) {
      const s = hud.stick;
      g.strokeStyle = 'rgba(22,22,27,0.35)';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(s.ox, s.oy, 46, 0, TAU);
      g.stroke();
      g.fillStyle = 'rgba(22,22,27,0.45)';
      g.beginPath();
      g.arc(s.x, s.y, 20, 0, TAU);
      g.fill();
    }
    if (hud.dashBtn) {
      const d = hud.dashBtn;
      const k = 1 - clamp(p.dashCd / sim.stats.dashCd, 0, 1);
      g.fillStyle = k >= 1 ? 'rgba(22,22,27,0.82)' : 'rgba(22,22,27,0.3)';
      g.beginPath();
      g.arc(d.x, d.y, d.r, 0, TAU);
      g.fill();
      if (k < 1) {
        g.strokeStyle = C.ink;
        g.lineWidth = 4;
        g.beginPath();
        g.arc(d.x, d.y, d.r - 2, -Math.PI / 2, -Math.PI / 2 + TAU * k);
        g.stroke();
      }
      g.fillStyle = C.paperHi;
      g.font = `700 12px ${BODY}`;
      g.textAlign = 'center';
      g.fillText(spaced('FLICK'), d.x, d.y + 1);
    }
  }
}

// ---------------------------------------------------------------- helpers

function spaced(s: string): string {
  return s.split('').join(' ');
}

function clock(sec: number): string {
  const s = Math.ceil(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function tracePoly(g: CanvasRenderingContext2D, poly: readonly Pt[]): void {
  g.beginPath();
  for (let i = 0; i < poly.length; i++) {
    if (i === 0) g.moveTo(poly[i].x, poly[i].y);
    else g.lineTo(poly[i].x, poly[i].y);
  }
  g.closePath();
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function wrapText(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number): void {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, y);
      y += lh;
      line = w;
    } else {
      line = test;
    }
  }
  if (line) g.fillText(line, x, y);
}

/** A wobbling ink blob centred on the origin. Leaves the path open for fill(). */
function blob(g: CanvasRenderingContext2D, r: number, seed: number, t: number, amp: number, n: number): void {
  const xs: number[] = [], ys: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr = r * (1 + amp * Math.sin(t * 2.3 + seed + i * 1.7) + amp * 0.6 * Math.sin(t * 3.4 + seed * 2 + i * 2.9));
    xs.push(Math.cos(a) * rr);
    ys.push(Math.sin(a) * rr);
  }
  g.beginPath();
  g.moveTo((xs[n - 1] + xs[0]) / 2, (ys[n - 1] + ys[0]) / 2);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    g.quadraticCurveTo(xs[i], ys[i], (xs[i] + xs[j]) / 2, (ys[i] + ys[j]) / 2);
  }
  g.closePath();
}

function eyes(g: CanvasRenderingContext2D, look: number, r: number, count: number, size: number): void {
  const lx = Math.cos(look), ly = Math.sin(look);
  const px = -ly, py = lx;
  const er = r * size;
  for (let i = 0; i < count; i++) {
    const off = (i - (count - 1) / 2) * er * 2.5;
    const ex = lx * r * 0.36 + px * off, ey = ly * r * 0.36 + py * off;
    g.fillStyle = C.paperHi;
    g.beginPath();
    g.arc(ex, ey, er, 0, TAU);
    g.fill();
    g.fillStyle = C.ink;
    g.beginPath();
    g.arc(ex + lx * er * 0.4, ey + ly * er * 0.4, er * 0.5, 0, TAU);
    g.fill();
  }
}

/** Washi-like paper: mottled tone plus short fibres. Tiles seamlessly. */
function makePaperTile(): HTMLCanvasElement {
  const S = 384;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const r = new Rng(4242);
  g.fillStyle = C.paper;
  g.fillRect(0, 0, S, S);
  const wrap = (fn: (ox: number, oy: number) => void) => {
    for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) fn(ox, oy);
  };
  for (let i = 0; i < 60; i++) {
    const x = r.range(0, S), y = r.range(0, S), rad = r.range(30, 110);
    const light = r.chance(0.5);
    wrap((ox, oy) => {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      gr.addColorStop(0, light ? 'rgba(248,246,238,0.16)' : 'rgba(150,146,130,0.10)');
      gr.addColorStop(1, 'rgba(200,196,184,0)');
      g.fillStyle = gr;
      g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
    });
  }
  for (let i = 0; i < 2600; i++) {
    const x = r.range(0, S), y = r.range(0, S);
    g.fillStyle = r.chance(0.5) ? 'rgba(255,255,250,0.10)' : 'rgba(90,86,74,0.07)';
    g.fillRect(x, y, r.range(0.6, 1.8), r.range(0.6, 1.8));
  }
  g.lineCap = 'round';
  for (let i = 0; i < 230; i++) {
    const x = r.range(0, S), y = r.range(0, S), a = r.range(0, TAU), len = r.range(6, 34), bend = r.range(-0.5, 0.5);
    const dark = r.chance(0.45);
    g.strokeStyle = dark ? `rgba(96,90,74,${r.range(0.05, 0.13)})` : `rgba(255,253,244,${r.range(0.12, 0.3)})`;
    g.lineWidth = r.range(0.5, 1.2);
    wrap((ox, oy) => {
      g.beginPath();
      g.moveTo(x + ox, y + oy);
      g.quadraticCurveTo(
        x + ox + Math.cos(a + bend) * len * 0.5, y + oy + Math.sin(a + bend) * len * 0.5,
        x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len,
      );
      g.stroke();
    });
  }
  return c;
}

function makeVignette(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(w / 4));
  c.height = Math.max(2, Math.round(h / 4));
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.35, c.width / 2, c.height / 2, Math.hypot(c.width, c.height) * 0.56);
  gr.addColorStop(0, 'rgba(20,18,16,0)');
  gr.addColorStop(1, 'rgba(20,18,16,0.3)');
  g.fillStyle = gr;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}
