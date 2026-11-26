// A simple self-playing brush. It drives the title-screen demo and lets the
// automated tests play whole runs to check pacing and catch crashes.

import { Sim, SimInput } from './sim';
import { ARENA_W, ARENA_H } from './data';
import { TAU, clamp } from './geom';

export class Bot {
  private spin = 1;
  private wanderA = 0;

  /** `skill` 0..1 scales how well it dodges. */
  constructor(private skill = 1) {}

  think(sim: Sim, dt: number): SimInput {
    const p = sim.player;

    // nearest spirit that is actually on the page
    let near = null as null | { x: number; y: number; r: number };
    let nd = Infinity;
    for (const e of sim.enemies) {
      if (e.dead || e.spawn > 0.3) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y) - e.r;
      if (d < nd) {
        nd = d;
        near = e;
      }
    }

    let tx: number, ty: number;
    if (!near || nd > 700) {
      // nothing to seal: paint lazy circles around the middle of the page
      this.wanderA += dt * 0.9 * this.spin;
      tx = ARENA_W / 2 + Math.cos(this.wanderA) * 170;
      ty = ARENA_H / 2 + Math.sin(this.wanderA) * 170;
    } else {
      // Grow a group outward from that spirit, but only as large as the line can ring.
      const maxR = (sim.reach / TAU) * 0.78;
      const live = sim.enemies.filter((e) => !e.dead && e.spawn <= 0.3);
      live.sort((a, b) => Math.hypot(a.x - near!.x, a.y - near!.y) - Math.hypot(b.x - near!.x, b.y - near!.y));
      let cx = near.x, cy = near.y, sx = 0, sy = 0, n = 0, spread = near.r;
      for (const e of live) {
        const nx = (sx + e.x) / (n + 1), ny = (sy + e.y) / (n + 1);
        let sp = 0;
        for (let i = 0; i <= n; i++) {
          const q = i < n ? live[i] : e;
          sp = Math.max(sp, Math.hypot(q.x - nx, q.y - ny) + q.r);
        }
        if (n > 0 && sp + 46 > maxR) break;
        sx += e.x;
        sy += e.y;
        n++;
        cx = nx;
        cy = ny;
        spread = sp;
        if (n >= 40) break;
      }
      const R = clamp(spread + 46, 70, maxR);
      // the group is drifting with the wind: ring where it will be, not where it is
      cx += sim.wind.x * 0.9;
      cy += sim.wind.y * 0.9;
      // keep the whole orbit on the page, even when the group hugs an edge
      const pad = 58;
      cx = clamp(cx, pad + R, ARENA_W - pad - R);
      cy = clamp(cy, pad + R, ARENA_H - pad - R);
      const a = Math.atan2(p.y - cy, p.x - cx);
      const na = a + this.spin * 0.75;
      tx = cx + Math.cos(na) * R;
      ty = cy + Math.sin(na) * R;
    }

    // The Other Brush: break the ring it is drawing, then ring it while it reels.
    const rival = sim.boss && sim.boss.kind === 'rival' && sim.boss.spawn <= 0 ? sim.boss : null;
    if (rival && rival.state === 1) {
      const a = Math.atan2(p.y - rival.y, p.x - rival.x) + this.spin * 0.8;
      tx = rival.x + Math.cos(a) * 62;
      ty = rival.y + Math.sin(a) * 62;
    } else if (rival && rival.state === 0 && sim.rivalTrail.length > 36) {
      // go and break its line at the nearest point
      let best = sim.rivalTrail[0], bd = Infinity;
      for (const q of sim.rivalTrail) {
        const dd = Math.hypot(q.x - p.x, q.y - p.y);
        if (dd < bd) {
          bd = dd;
          best = q;
        }
      }
      tx = best.x;
      ty = best.y;
    }

    let mx = tx - p.x, my = ty - p.y;
    const m = Math.hypot(mx, my) || 1;
    mx /= m;
    my /= m;

    // dodge whatever is close
    let danger = Infinity;
    const reachD = 42 + 38 * this.skill;
    for (const e of sim.enemies) {
      if (e.dead || e.spawn > 0) continue;
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) - e.r;
      if (d < reachD) {
        const w = ((reachD - d) / reachD) * 2.4 * this.skill;
        mx += (dx / (d + e.r || 1)) * w;
        my += (dy / (d + e.r || 1)) * w;
      }
      if (d < danger) danger = d;
    }
    // step off the line a darter (or the boss) is about to charge down
    for (const e of sim.enemies) {
      if (e.dead || e.spawn > 0) continue;
      const aiming = (e.kind === 'darter' && (e.state === 1 || e.state === 2)) || (e.kind === 'boss' && (e.state === 3 || e.state === 4))
        || (e.kind === 'rival' && (e.state === 3 || e.state === 4)) || (e.kind === 'eel' && (e.state === 1 || e.state === 2));
      if (!aiming) continue;
      const rx = p.x - e.x, ry = p.y - e.y;
      const along = rx * e.ax + ry * e.ay;
      if (along < 0 || along > (e.kind === 'darter' ? 340 : 620)) continue;
      const side = rx * -e.ay + ry * e.ax;
      const lane = e.r + 34;
      if (Math.abs(side) < lane) {
        const w = ((lane - Math.abs(side)) / lane) * 3 * this.skill;
        const sgn = side >= 0 ? 1 : -1;
        mx += -e.ay * sgn * w;
        my += e.ax * sgn * w;
      }
    }
    // keep out of standing water, which would wash the line away
    for (const q of sim.puddles) {
      const dx = p.x - q.x, dy = p.y - q.y, dd = Math.hypot(dx, dy) || 1;
      const edge = dd - q.r;
      if (edge < 46) {
        const w = ((46 - edge) / 46) * 3.2 * this.skill;
        mx += (dx / dd) * w;
        my += (dy / dd) * w;
      }
    }
    // a leech about to arrive along the line: flick it off
    const headOdo = sim.trailOdo + sim.trailLen;
    for (const e of sim.enemies) {
      if (e.kind === 'leech' && e.state === 1 && !e.dead && headOdo - e.ay < 130) danger = Math.min(danger, 10);
    }
    for (const s of sim.shots) {
      const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy);
      if (d < 70) {
        const w = ((70 - d) / 70) * 2 * this.skill;
        mx += (dx / (d || 1)) * w;
        my += (dy / (d || 1)) * w;
      }
      if (d - 8 < danger) danger = d - 8;
    }

    const mm = Math.hypot(mx, my) || 1;
    return { x: mx / mm, y: my / mm, dash: danger < 16 && this.skill > 0.5 };
  }
}
