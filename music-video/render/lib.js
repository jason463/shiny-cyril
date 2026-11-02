// Shared Node helpers: launch headless Chromium (SwiftShader WebGL2), serve the project, write PNGs.
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
let chromium;
try { chromium = require('playwright').chromium; } catch (e) { chromium = require('/opt/node-tools/node_modules/playwright').chromium; }

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.glsl': 'text/plain',
  '.u8': 'application/octet-stream', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg' };

const http = require('http');
// tiny static server + binary frame sink (fetch POST from the page avoids slow CDP base64 transfer)
function startServer(onFrame) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'POST' && u.pathname === '/frame') {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', async () => {
          try { await (srv.onFrame ? srv.onFrame(+u.searchParams.get('i'), Buffer.concat(chunks)) : null); res.writeHead(200); res.end('ok'); }
          catch (e) { res.writeHead(500); res.end(String(e)); }
        });
        return;
      }
      const p = path.join(ROOT, decodeURIComponent(u.pathname));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end('nf'); }
      res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(fs.readFileSync(p));
    });
    srv.keepAliveTimeout = 0;
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

async function launch({ W = 1280, H = 720, verbose = false } = {}) {
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
      '--disable-gpu-watchdog', '--no-proxy-server', '--disable-background-timer-throttling', '--js-flags=--max-old-space-size=4096'],
  });
  const page = await browser.newPage({ viewport: { width: 320, height: 180 } });
  page.setDefaultTimeout(0);
  page.on('console', (m) => { if (verbose || m.type() === 'error') console.log('[page]', m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  const server = await startServer();
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.goto(origin + '/engine/index.html');
  const info = await page.evaluate(([W, H]) => window.MV.init({ W, H, base: '..' }), [W, H]);
  const close = browser.close.bind(browser);
  browser.close = async () => { await close(); server.close(); };
  return { browser, page, info, server, origin };
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
// rgba: Buffer of W*H*4, bottom-up (GL order) when flip=true
function writePNG(file, rgba, W, H, flip = true) {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    const sy = flip ? H - 1 - y : y;
    raw[y * (W * 3 + 1)] = 0;
    for (let x = 0; x < W; x++) {
      const si = (sy * W + x) * 4, di = y * (W * 3 + 1) + 1 + x * 3;
      raw[di] = rgba[si]; raw[di + 1] = rgba[si + 1]; raw[di + 2] = rgba[si + 2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
  fs.writeFileSync(file, png);
}
// build a contact sheet (top-down RGBA tiles) -> PNG
function contactSheet(file, frames, W, H, cols, scale, labels) {
  const tw = Math.floor(W * scale), th = Math.floor(H * scale);
  const rows = Math.ceil(frames.length / cols);
  const SW = tw * cols + (cols + 1) * 4, SH = th * rows + (rows + 1) * 4;
  const out = Buffer.alloc(SW * SH * 4, 24);
  frames.forEach((fr, i) => {
    const cx = 4 + (i % cols) * (tw + 4), cy = 4 + Math.floor(i / cols) * (th + 4);
    for (let y = 0; y < th; y++) {
      const sy = H - 1 - Math.floor(y / scale);
      for (let x = 0; x < tw; x++) {
        const sx = Math.floor(x / scale);
        const si = (sy * W + sx) * 4, di = ((cy + y) * SW + cx + x) * 4;
        out[di] = fr[si]; out[di + 1] = fr[si + 1]; out[di + 2] = fr[si + 2]; out[di + 3] = 255;
      }
    }
  });
  writePNG(file, out, SW, SH, false);
}
function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const k = argv[i].slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      a[k] = v;
    }
  }
  return a;
}
module.exports = { launch, writePNG, contactSheet, parseArgs, ROOT };
