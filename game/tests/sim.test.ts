import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import { Bot } from '../src/sim/bot';
import { circlePoly, pointInPoly, polyArea, roundness, segIntersect } from '../src/sim/geom';
import { STAGES } from '../src/sim/data';

const DT = 1 / 60;

describe('geometry', () => {
  it('finds a crossing and ignores parallel or distant segments', () => {
    expect(segIntersect(0, 0, 10, 10, 0, 10, 10, 0)).toEqual({ x: 5, y: 5 });
    expect(segIntersect(0, 0, 10, 0, 0, 5, 10, 5)).toBeNull();
    expect(segIntersect(0, 0, 1, 1, 5, 0, 5, 9)).toBeNull();
  });
  it('scores a circle as round and a sliver as not', () => {
    expect(roundness(circlePoly(0, 0, 100, 64))).toBeGreaterThan(0.99);
    const sliver = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 10 }, { x: 0, y: 10 }];
    expect(roundness(sliver)).toBeLessThan(0.15);
    expect(Math.abs(polyArea(sliver))).toBe(3000);
  });
  it('tests points against a polygon', () => {
    const c = circlePoly(50, 50, 40);
    expect(pointInPoly(50, 50, c)).toBe(true);
    expect(pointInPoly(120, 50, c)).toBe(false);
  });
});

/** Walks the brush in a circle and checks the line seals what is inside. */
describe('the line', () => {
  it('seals a spirit when the brush crosses its own line', () => {
    const sim = new Sim({ seed: 7, brush: 'bamboo', depth: 1 });
    const p = sim.player;
    // park one drifter 80 paces to the right, already on the page
    sim.update(DT, { x: 0, y: 0, dash: false });
    (sim as unknown as { makeEnemy: Function }).makeEnemy('drifter', p.x + 80, p.y, 0);
    const target = sim.enemies[sim.enemies.length - 1];
    target.stun = 99; // hold it still
    const cx = p.x + 80, cy = p.y;
    let loops = 0, sealed = false;
    for (let i = 0; i < 60 * 8 && !sealed; i++) {
      const a = Math.atan2(p.y - cy, p.x - cx) + 0.5;
      const tx = cx + Math.cos(a) * 80, ty = cy + Math.sin(a) * 80;
      const m = Math.hypot(tx - p.x, ty - p.y) || 1;
      sim.update(DT, { x: (tx - p.x) / m, y: (ty - p.y) / m, dash: false });
      for (const ev of sim.events) {
        if (ev.type === 'loop') loops++;
        if (ev.type === 'kill' && !ev.quiet) sealed = true;
      }
      sim.events.length = 0;
    }
    expect(loops).toBeGreaterThan(0);
    expect(sealed).toBe(true);
    expect(sim.tally.kills).toBe(1);
  });

  it('never grows the line past its reach', () => {
    const sim = new Sim({ seed: 3, brush: 'bamboo', depth: 1, attract: true });
    for (let i = 0; i < 600; i++) {
      sim.update(DT, { x: 1, y: i % 200 < 100 ? 0.05 : -0.05, dash: false });
      expect(sim.trailLen).toBeLessThanOrEqual(sim.reach + 12);
    }
  });
});

interface RunResult { won: boolean; time: number; stage: number; level: number; kills: number; loops: number; ensos: number; best: number; hits: number }

function playRun(seed: number, depth: number, skill: number, maxMinutes = 14): RunResult {
  const sim = new Sim({ seed, brush: 'bamboo', depth });
  const bot = new Bot(skill);
  const maxSteps = maxMinutes * 60 * 60;
  for (let i = 0; i < maxSteps; i++) {
    if (sim.phase === 'levelup' || sim.phase === 'relic') sim.choose(i % sim.choices.length);
    if (sim.phase === 'dead' || sim.phase === 'won') break;
    sim.update(DT, bot.think(sim, DT));
    sim.events.length = 0;
    const p = sim.player;
    if (!Number.isFinite(p.x + p.y + p.vx + p.vy)) throw new Error(`player went non-finite at step ${i}`);
    if (i % 600 === 0) {
      for (const e of sim.enemies) {
        if (!Number.isFinite(e.x + e.y + e.vx + e.vy)) throw new Error(`${e.kind} went non-finite at step ${i}`);
      }
    }
  }
  return {
    won: sim.phase === 'won', time: sim.time, stage: sim.stage, level: sim.level,
    kills: sim.tally.kills, loops: sim.tally.loops, ensos: sim.tally.ensos, best: sim.tally.best, hits: sim.tally.hits,
  };
}

describe('whole runs under the bot', () => {
  it('plays many seeded runs without crashing or producing bad numbers', () => {
    const rows: RunResult[] = [];
    for (let seed = 1; seed <= 12; seed++) rows.push(playRun(seed * 977, 1, 1));
    const avg = (f: (r: RunResult) => number) => rows.reduce((a, r) => a + f(r), 0) / rows.length;
    console.log('depth 1, skilled bot');
    console.table(rows.map((r) => ({ ...r, time: Math.round(r.time) })));
    console.log(`avg time ${avg((r) => r.time).toFixed(0)}s  stage ${avg((r) => r.stage).toFixed(1)}  level ${avg((r) => r.level).toFixed(1)}  kills ${avg((r) => r.kills).toFixed(0)}  wins ${rows.filter((r) => r.won).length}/${rows.length}`);
    // every run should get somewhere and seal things
    for (const r of rows) {
      expect(r.kills).toBeGreaterThan(10);
      expect(r.loops).toBeGreaterThan(3);
    }
  });

  it('is harder for a clumsy brush and at greater depth', () => {
    const clumsy = [1, 2, 3, 4, 5, 6].map((s) => playRun(s * 131, 1, 0.25));
    const deep = [1, 2, 3, 4, 5, 6].map((s) => playRun(s * 131, 5, 1));
    const skilled = [1, 2, 3, 4, 5, 6].map((s) => playRun(s * 131, 1, 1));
    const t = (rs: RunResult[]) => rs.reduce((a, r) => a + r.time, 0) / rs.length;
    console.log(`avg survival  skilled d1: ${t(skilled).toFixed(0)}s   clumsy d1: ${t(clumsy).toFixed(0)}s   skilled d5: ${t(deep).toFixed(0)}s`);
    expect(t(clumsy)).toBeLessThan(t(skilled));
  });

  it('has a finale that can be reached', () => {
    expect(STAGES[STAGES.length - 1].boss).toBe(true);
  });
});
