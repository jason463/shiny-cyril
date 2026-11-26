// Not a pass/fail test so much as a report: how far does the bot get, and how fast?
// Mirrors the browser's stepping (one decision per frame, two half-steps) to keep the two honest.
import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import { Bot } from '../src/sim/bot';

const blows: Record<string, number> = {};

function run(seed: number, depth: number, skill: number, marks: number[]) {
  const sim = new Sim({ seed, brush: 'bamboo', depth });
  const bot = new Bot(skill);
  const frame = 1 / 60;
  const snaps: string[] = [];
  let mi = 0;
  for (let i = 0; i < 16 * 60 * 60; i++) {
    if (sim.phase === 'levelup' || sim.phase === 'relic') sim.choose(i % sim.choices.length);
    if (sim.phase === 'dead' || sim.phase === 'won') break;
    const cmd = bot.think(sim, frame);
    for (let k = 0; k < 2; k++) {
      sim.update(frame / 2, { x: cmd.x, y: cmd.y, dash: cmd.dash && k === 0 });
      sim.events.length = 0;
      if (sim.phase !== 'play') break;
    }
    if (mi < marks.length && sim.time >= marks[mi]) {
      snaps.push(`${marks[mi]}s:k${sim.tally.kills}/e${sim.enemies.length}/L${sim.level}`);
      mi++;
    }
  }
  for (const k in sim.hurtLog) blows[k] = (blows[k] ?? 0) + (sim.hurtLog as Record<string, number>)[k];
  return { phase: sim.phase, time: Math.round(sim.time), stage: sim.stage + 1, level: sim.level, kills: sim.tally.kills, loops: sim.tally.loops, best: sim.tally.best, hits: sim.tally.hits, snaps: snaps.join('  ') };
}

describe('balance report', () => {
  it('depth 1', () => {
    const rows = [];
    for (let s = 1; s <= 10; s++) rows.push(run(s * 7919, 1, 1, [30, 60, 90, 180, 300]));
    console.table(rows);
    const wins = rows.filter((r) => r.phase === 'won').length;
    console.log(`depth 1: ${wins}/10 wins, avg kills ${Math.round(rows.reduce((a, r) => a + r.kills, 0) / 10)}`);
    console.log('blows by kind', JSON.stringify(blows));
    expect(rows.length).toBe(10);
  });
});
