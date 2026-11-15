// Renders public/icons/icon.svg into the PNG sizes the phone needs.
// Dev tool only: needs Playwright (npx playwright install chromium) and `npm i` for the Inter font.
// Usage: node scripts/make-icons.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const svg = readFileSync(resolve(root, 'public/icons/icon.svg'), 'utf8');
const font = resolve(root, 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2');
mkdirSync(resolve(root, 'public/icons'), { recursive: true });

const targets = [
  { file: 'apple-touch-icon.png', size: 180, radius: 0, scale: 1 },        // iOS rounds it itself
  { file: 'icon-192.png', size: 192, radius: 0.225, scale: 1 },
  { file: 'icon-512.png', size: 512, radius: 0.225, scale: 1 },
  { file: 'icon-maskable-512.png', size: 512, radius: 0, scale: 0.8 },     // artwork inside the 80% safe zone
  { file: 'favicon-32.png', size: 32, radius: 0.225, scale: 1 },
];

const browser = await chromium.launch();
for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: t.size, height: t.size } });
  const inner = Math.round(t.size * t.scale);
  const html = `<style>
    @font-face{font-family:Inter;src:url(file://${font});font-weight:100 900}
    html,body{margin:0;background:transparent}
    .w{width:${t.size}px;height:${t.size}px;display:grid;place-items:center;background:${t.scale < 1 ? '#0f8b97' : 'transparent'}}
    .i{width:${inner}px;height:${inner}px;border-radius:${t.radius * inner}px;overflow:hidden}
    svg{width:100%;height:100%;display:block}
  </style><div class="w"><div class="i">${svg}</div></div>`;
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(root, 'public/icons', t.file), omitBackground: true });
  await page.close();
  console.log('made', t.file);
}
await browser.close();
