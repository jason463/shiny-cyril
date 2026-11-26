// Draws the app icon in code (an ink ensō and a red seal) and writes every Android launcher size.
// Needs Playwright with Chromium. Run after changing the design: node scripts/icons.mjs
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const res = fileURLToPath(new URL('../android/app/src/main/res/', import.meta.url));
const shots = fileURLToPath(new URL('../.shots/', import.meta.url));

/** Runs in the page. `mode`: 'full' square with paper, 'round' circle, 'fg' transparent adaptive foreground. */
function draw(size, mode) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const paper = '#e4e1d6', ink = '#16161b', red = '#c5341f';
  if (mode === 'full') {
    const r = size * 0.2;
    g.beginPath();
    g.moveTo(r, 0); g.arcTo(size, 0, size, size, r); g.arcTo(size, size, 0, size, r); g.arcTo(0, size, 0, 0, r); g.arcTo(0, 0, size, 0, r);
    g.closePath();
    g.fillStyle = paper; g.fill();
  } else if (mode === 'round') {
    g.beginPath(); g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); g.fillStyle = paper; g.fill();
  }
  // In an adaptive icon only the middle two thirds is guaranteed visible.
  const k = mode === 'fg' ? 0.56 : 0.86;
  const cx = size / 2, cy = size / 2, R = size * 0.34 * k;
  // the ensō: one brush stroke, heavy where it lands and thinning to nothing, never quite closed
  g.fillStyle = ink;
  const a0 = -0.35, a1 = a0 + Math.PI * 2 * 0.9, steps = 700;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, a = a0 + (a1 - a0) * t;
    const press = t < 0.06 ? 0.55 + t * 7.5 : 1 - Math.pow(t, 2.4) * 0.86;
    const w = size * 0.064 * k * press * (1 + 0.07 * Math.sin(t * 37));
    const rr = R * (1 + 0.035 * Math.sin(t * 5.1 + 1));
    g.beginPath();
    g.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, w, 0, Math.PI * 2);
    g.fill();
  }
  // the painter's seal
  const s = size * 0.2 * k, sx = cx + R * 0.52, sy = cy + R * 0.5;
  g.save();
  g.translate(sx + s / 2, sy + s / 2);
  g.rotate(-0.07);
  g.fillStyle = red;
  const rr = s * 0.14;
  g.beginPath();
  g.moveTo(-s / 2 + rr, -s / 2); g.arcTo(s / 2, -s / 2, s / 2, s / 2, rr); g.arcTo(s / 2, s / 2, -s / 2, s / 2, rr); g.arcTo(-s / 2, s / 2, -s / 2, -s / 2, rr); g.arcTo(-s / 2, -s / 2, s / 2, -s / 2, rr);
  g.closePath(); g.fill();
  g.strokeStyle = '#f1efe7'; g.lineWidth = s * 0.11; g.lineCap = 'round';
  g.beginPath(); g.arc(0, 0, s * 0.25, -1.1, 4.2); g.stroke();
  g.restore();
  return c.toDataURL('image/png');
}

const browser = await chromium.launch();
const page = await browser.newPage();
const png = async (size, mode) => Buffer.from((await page.evaluate(([f, s, m]) => (0, eval)(`(${f})`)(s, m), [draw.toString(), size, mode])).split(',')[1], 'base64');
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [name, k] of Object.entries(dens)) {
  const dir = `${res}mipmap-${name}/`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(dir + 'ic_launcher.png', await png(Math.round(48 * k), 'full'));
  writeFileSync(dir + 'ic_launcher_round.png', await png(Math.round(48 * k), 'round'));
  writeFileSync(dir + 'ic_launcher_foreground.png', await png(Math.round(108 * k), 'fg'));
}
mkdirSync(shots, { recursive: true });
writeFileSync(shots + 'icon-512.png', await png(512, 'full'));
await browser.close();
console.log('icons written');
