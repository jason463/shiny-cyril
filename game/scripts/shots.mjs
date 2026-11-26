// Play-test harness: opens the built game in headless Chromium, lets the bot play,
// and saves screenshots. Usage: node scripts/shots.mjs [desktop|phone] [seconds...]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { fileURLToPath } from 'node:url';

const which = process.argv[2] ?? 'desktop';
const marks = process.argv.slice(3).map(Number);
const file = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const out = fileURLToPath(new URL('../.shots/', import.meta.url));

const browser = await chromium.launch();
const ctx = await browser.newContext(which === 'phone'
  ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }
  : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('file://' + file);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}${which}-title.png` });

await page.evaluate(() => { window.__inkwake.begin(); window.__inkwake.autoplay(true); });
let t = 0;
for (const m of marks) {
  await page.waitForTimeout((m - t) * 1000);
  t = m;
  const info = await page.evaluate(() => {
    const k = window.__inkwake, s = k.sim;
    return { mode: k.mode, stage: s.stage, t: Math.round(s.time), hp: s.player.hp, lvl: s.level, kills: s.tally.kills, enemies: s.enemies.length };
  });
  console.log(m, JSON.stringify(info));
  await page.screenshot({ path: `${out}${which}-${String(m).padStart(3, '0')}.png` });
}
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
