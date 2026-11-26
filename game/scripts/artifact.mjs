// Turns the single-file build into a page fragment (no doctype/html/head/body)
// for hosts that wrap the page in their own document skeleton.
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const head = /<head>([\s\S]*?)<\/head>/.exec(html)?.[1] ?? '';
const body = /<body>([\s\S]*?)<\/body>/.exec(html)?.[1] ?? '';

const styles = [...head.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map((m) => m[0]);
const scripts = [...head.matchAll(/<script[^>]*>[\s\S]*?<\/script>/g)].map((m) => m[0]);

const out = [
  '<title>Inkwake</title>',
  '<meta name="claude:viewport-fit-sides" content="cover">',
  ...styles,
  body.trim(),
  ...scripts,
].join('\n');

writeFileSync(new URL('../dist/inkwake-page.html', import.meta.url), out);
console.log(`page fragment: ${(out.length / 1024).toFixed(0)} KB`);
