import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import { Bot } from '../src/sim/bot';
import { circlePoly, pointInPoly, polyArea, roundness, segIntersect } from '../src/sim/geom';
import { SCROLLS, STAGES } from '../src/sim/data';

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

function playRun(seed: number, depth: number, skill: number, maxMinutes = 14, scroll = 0): RunResult {
  const sim = new Sim({ seed, brush: 'bamboo', depth, scroll });
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
    expect(STAGES[STAGES.length - 1].boss).toBe('boss');
  });
});

describe('the later scrolls', () => {
  it('every scroll has five stages and ends in its own finale', () => {
    expect(SCROLLS.map((s) => s.stages.length)).toEqual([5, 5, 5]);
    expect(SCROLLS.map((s) => s.stages[4].boss)).toEqual(['boss', 'eel', 'rival']);
  });

  it('plays the Rain and Gale scrolls under the bot without bad numbers', () => {
    for (const scroll of [1, 2]) {
      const rows = [1, 2, 3, 4, 5, 6].map((s) => playRun(s * 4391, 1, 1, 14, scroll));
      console.log(`scroll ${scroll + 1}`);
      console.table(rows.map((r) => ({ ...r, time: Math.round(r.time) })));
      for (const r of rows) expect(r.loops).toBeGreaterThan(1);
    }
  });

  it('a ring around one Bound Twin seals neither; a ring around both seals both', () => {
    const make = () => {
      const sim = new Sim({ seed: 5, brush: 'bamboo', depth: 1, scroll: 1 });
      const mk = (sim as unknown as { makeEnemy: Function }).makeEnemy.bind(sim);
      const a = mk('twin', 1000, 800, 0), b = mk('twin', 1400, 800, 0);
      a.link = b.id;
      b.link = a.id;
      return { sim, a, b };
    };
    const ring = (x: number, y: number, r: number) => Array.from({ length: 24 }, (_, i) => ({ x: x + Math.cos((i / 24) * 6.2832) * r, y: y + Math.sin((i / 24) * 6.2832) * r }));
    const one = make();
    one.sim.closeLoop(ring(1000, 800, 80), 'brush');
    expect(one.a.dead).toBe(false);
    expect(one.b.dead).toBe(false);
    const both = make();
    both.sim.closeLoop(ring(1200, 800, 320), 'brush');
    expect(both.a.dead).toBe(true);
    expect(both.b.dead).toBe(true);
  });

  it('standing water washes the line away', () => {
    const sim = new Sim({ seed: 9, brush: 'bamboo', depth: 1, scroll: 1 });
    const p = sim.player;
    for (let i = 0; i < 40; i++) sim.update(DT, { x: 1, y: 0, dash: false });
    expect(sim.trail.length).toBeGreaterThan(5);
    sim.puddles.push({ x: p.x, y: p.y, r: 90, age: 2, life: 30 });
    for (let i = 0; i < 5; i++) sim.update(DT, { x: 1, y: 0, dash: false });
    expect(sim.inPuddle).toBe(true);
    expect(sim.trail.length).toBe(1);
  });

  it('The Undertow can only be sealed once its coils are gone', () => {
    const sim = new Sim({ seed: 11, brush: 'bamboo', depth: 1, scroll: 1 });
    sim.stage = 4;
    sim.stageT = 0;
    for (let i = 0; i < 60 * 9; i++) sim.update(DT, { x: 0, y: 0, dash: false });
    const head = sim.boss!;
    expect(head.kind).toBe('eel');
    const coils = () => sim.enemies.filter((e) => e.kind === 'coil' && !e.dead);
    expect(coils().length).toBeGreaterThan(8);
    const ring = (x: number, y: number, r: number) => Array.from({ length: 24 }, (_, i) => ({ x: x + Math.cos((i / 24) * 6.2832) * r, y: y + Math.sin((i / 24) * 6.2832) * r }));
    const hp = head.hp;
    sim.player.inv = 99;
    sim.closeLoop(ring(head.x, head.y, 50), 'brush');
    expect(head.hp).toBe(hp); // still armoured by its body
    for (const c of coils()) c.grace = 0;
    sim.closeLoop(ring(head.x, head.y, 1200), 'brush'); // everything at once: coils go
    expect(coils().length).toBe(0);
    sim.update(DT, { x: 0, y: 0, dash: false });
    sim.closeLoop(ring(head.x, head.y, 60), 'brush');
    expect(head.hp).toBe(hp - 1);
  });
});
