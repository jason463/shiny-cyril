// Bot-played captures of the later scrolls: mid-run stages and both finales.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const file = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const out = fileURLToPath(new URL('../.shots/', import.meta.url));
const browser = await chromium.launch();
const errors = [];
const shots = [
  { name: 'rain-mid', scroll: 1, stage: 3, wait: 26 },
  { name: 'rain-boss', scroll: 1, stage: 4, wait: 17 },
  { name: 'gale-mid', scroll: 2, stage: 3, wait: 26 },
  { name: 'gale-boss', scroll: 2, stage: 4, wait: 16 },
];
for (const sh of shots) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(sh.name + ': ' + m.text()));
  page.on('pageerror', (e) => errors.push(sh.name + ': ' + String(e)));
  await page.goto('file://' + file);
  await page.waitForTimeout(1200);
  if (sh.name === 'rain-mid') {
    await page.evaluate(() => window.__inkwake.pickScroll(1));
    await page.getByRole('button', { name: 'Brushes', exact: true }).click();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Begin a painting', exact: true }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}scroll-picker.png` });
  }
  await page.evaluate(({ scroll, stage }) => {
    const k = window.__inkwake;
    k.pickScroll(scroll);
    k.begin();
    k.skipTo(stage);
    Object.assign(k.sim.techs, { long: 2, swift: 1, vital: 2, flick: 1 });
    k.sim.player.maxHp = k.sim.player.hp = 5;
    k.sim.recompute();
    k.autoplay(true);
  }, sh);
  await page.waitForTimeout(sh.wait * 1000);
  await page.screenshot({ path: `${out}${sh.name}.png` });
  console.log(sh.name, JSON.stringify(await page.evaluate(() => { const s = window.__inkwake.sim; return { mode: window.__inkwake.mode, t: Math.round(s.stageT), hp: s.player.hp, enemies: s.enemies.length, boss: s.boss ? [s.boss.kind, s.boss.hp, s.boss.state] : null, puddles: s.puddles.length, wind: s.windPhase }; })));
  await page.close();
}
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
