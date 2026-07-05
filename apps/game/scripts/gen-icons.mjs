/**
 * Gera ícones/splash placeholder desenhando num canvas headless (Chromium via
 * Playwright) — sem assets binários no repo além dos PNGs resultantes.
 * Uso: node scripts/gen-icons.mjs  (respeita PLAYWRIGHT_CHROMIUM_PATH)
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const drawIcon = (size) => `
  const c = document.createElement('canvas');
  c.width = ${size}; c.height = ${size};
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, ${size});
  grad.addColorStop(0, '#2e7d32');
  grad.addColorStop(1, '#0a3d0a');
  g.fillStyle = grad;
  g.fillRect(0, 0, ${size}, ${size});
  // bola
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(${size} * 0.5, ${size} * 0.42, ${size} * 0.2, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#222222';
  g.lineWidth = ${size} * 0.015;
  g.stroke();
  // traço curvo (a assinatura do jogo)
  g.strokeStyle = '#ffd740';
  g.lineWidth = ${size} * 0.045;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(${size} * 0.2, ${size} * 0.88);
  g.quadraticCurveTo(${size} * 0.28, ${size} * 0.55, ${size} * 0.5, ${size} * 0.42);
  g.stroke();
  // nome
  g.fillStyle = '#ffffff';
  g.font = 'bold ' + ${size} * 0.16 + 'px sans-serif';
  g.textAlign = 'center';
  g.fillText('IDOL', ${size} * 0.5, ${size} * 0.85);
  document.body.style.margin = '0';
  document.body.appendChild(c);
`;

const targets = [
  { size: 1024, path: 'resources/icon.png' },
  { size: 512, path: 'public/icons/icon-512.png' },
  { size: 192, path: 'public/icons/icon-192.png' },
  { size: 2732, path: 'resources/splash.png' },
];

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
    : {},
);
const page = await browser.newPage();

for (const { size, path } of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent('<body></body>');
  await page.evaluate(drawIcon(size));
  const out = join(root, path);
  mkdirSync(dirname(out), { recursive: true });
  await page.locator('canvas').screenshot({ path: out });
  console.log('✓', path);
}

await browser.close();
