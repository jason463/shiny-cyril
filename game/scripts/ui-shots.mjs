// Screenshots of every menu at desktop and phone size.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const file = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const out = fileURLToPath(new URL('../.shots/', import.meta.url));
const browser = await chromium.launch();
for (const which of ['desktop', 'phone']) {
  const ctx = await browser.newContext(which === 'phone'
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }
    : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('file://' + file);
  await page.waitForTimeout(3500);
  const shot = (n) => page.screenshot({ path: `${out}ui-${which}-${n}.png` });
  const press = async (label) => { await page.getByRole('button', { name: label, exact: true }).click(); await page.waitForTimeout(450); };
  await shot('title');
  await press('Brushes'); await shot('brushes'); await press('Back');
  await press('Almanac'); await shot('almanac'); await press('Back');
  await press('Settings'); await shot('settings'); await press('Back');
  await page.evaluate(() => { window.__inkwake.begin(); });
  await page.waitForTimeout(1200);
  await shot('banner');
  await page.evaluate(() => window.__inkwake.autoplay(true));
  await page.waitForFunction(() => window.__inkwake.mode === 'choice', null, { timeout: 90000, polling: 30 });
  await page.evaluate(() => window.__inkwake.autoplay(false));
  await page.waitForTimeout(400);
  await shot('choice');
  await page.keyboard.press('Digit2');
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__inkwake.autoplay(true));
  await page.waitForTimeout(9000);
  await shot('play');
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.waitForTimeout(450);
  await shot('pause');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  console.log(which, 'errors:', errors.length ? errors : 'none', 'h-overflow:', overflow);
  await ctx.close();
}
await browser.close();
