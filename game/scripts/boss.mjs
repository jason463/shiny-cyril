// Jumps to the final stage, hands the brush to the bot, and records how the fight goes.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const file = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const out = fileURLToPath(new URL('../.shots/', import.meta.url));
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('file://' + file);
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const k = window.__inkwake;
  k.begin();
  k.skipTo(4);
  // a mid-run build, so the fight is representative
  Object.assign(k.sim.techs, { long: 3, swift: 2, vital: 2, splash: 1 });
  k.sim.relics.push('echo', 'koi');
  k.sim.player.maxHp = k.sim.player.hp = 5;
  k.sim.recompute();
  k.autoplay(true);
});
const frames = [];
for (const [t, name] of [[9, 'a'], [8, 'b'], [10, 'c'], [14, 'd']]) {
  await page.waitForTimeout(t * 1000);
  await page.screenshot({ path: `${out}boss-${name}.png` });
  frames.push(await page.evaluate(() => { const s = window.__inkwake.sim; return { mode: window.__inkwake.mode, t: Math.round(s.stageT), boss: s.boss ? [s.boss.hp, s.boss.state] : null, hp: s.player.hp, enemies: s.enemies.length, shots: s.shots.length }; }));
}
console.log(JSON.stringify(frames));
// frame pacing while the page is busy
const pace = await page.evaluate(() => new Promise((res) => {
  const ts = []; let last = performance.now();
  const f = (now) => { ts.push(now - last); last = now; ts.length < 120 ? requestAnimationFrame(f) : res({ avg: ts.reduce((a, b) => a + b) / ts.length, max: Math.max(...ts) }); };
  requestAnimationFrame(f);
}));
console.log('frame ms', JSON.stringify(pace));
try {
  await page.waitForFunction(() => window.__inkwake.mode === 'results', null, { timeout: 150000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}boss-results.png` });
  console.log('ended:', await page.evaluate(() => document.querySelector('.screen h2')?.textContent));
} catch { console.log('still fighting after 150s'); }
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
