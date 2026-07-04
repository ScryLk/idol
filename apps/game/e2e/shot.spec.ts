import { expect, test, type Page } from '@playwright/test';
import { FIELD_HEIGHT, FIELD_WIDTH } from '@idol/shared';

/**
 * E2E do M1: desenha traços com eventos REAIS de pointer sobre o canvas
 * (mesmo caminho de input do dedo/mouse) e valida o resultado determinístico
 * exposto pelo hook window.__IDOL_E2E__.
 */

import '../src/e2eHook.js';

async function gameReady(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => window.__IDOL_E2E__?.ready === true);
}

/** Converte coordenadas de jogo (720×1280) em coordenadas de página do canvas FIT. */
async function toPage(page: Page, gx: number, gy: number): Promise<{ x: number; y: number }> {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('canvas não encontrado');
  return {
    x: box.x + (gx / FIELD_WIDTH) * box.width,
    y: box.y + (gy / FIELD_HEIGHT) * box.height,
  };
}

/** Desenha um traço da bola através dos pontos dados (coordenadas de jogo). */
async function drawTrace(page: Page, points: Array<[number, number]>): Promise<void> {
  const first = points[0] as [number, number];
  const start = await toPage(page, first[0], first[1]);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (const [gx, gy] of points.slice(1)) {
    const p = await toPage(page, gx, gy);
    await page.mouse.move(p.x, p.y, { steps: 8 });
  }
  await page.mouse.up();
}

test('chute curvado ao canto esquerdo marca GOL', async ({ page }) => {
  await gameReady(page);

  // da bola (360,940), desvia dos zagueiros e cruza a linha de gol no canto
  await drawTrace(page, [
    [360, 940],
    [340, 760],
    [310, 560],
    [290, 350],
    [280, 160],
    [280, 42],
  ]);

  await page.waitForFunction(() => window.__IDOL_E2E__?.lastOutcome !== null);
  const hook = await page.evaluate(() => window.__IDOL_E2E__);
  expect(hook?.shots).toBe(1);
  expect(hook?.lastOutcome).toBe('goal');
});

test('chute reto no meio é DEFENDIDO pelo goleiro', async ({ page }) => {
  await gameReady(page);

  await drawTrace(page, [
    [360, 940],
    [360, 700],
    [360, 450],
    [360, 200],
    [360, 42],
  ]);

  await page.waitForFunction(() => window.__IDOL_E2E__?.lastOutcome !== null);
  expect(await page.evaluate(() => window.__IDOL_E2E__?.lastOutcome)).toBe('saved');
});

test('traço cruzando um zagueiro é INTERCEPTADO e o toque reinicia o lance', async ({ page }) => {
  await gameReady(page);

  await drawTrace(page, [
    [360, 940],
    [300, 800],
    [230, 650],
    [205, 520],
    [200, 400],
  ]);

  await page.waitForFunction(() => window.__IDOL_E2E__?.lastOutcome !== null);
  expect(await page.evaluate(() => window.__IDOL_E2E__?.lastOutcome)).toBe('intercepted');

  // toque para reiniciar → novo chute válido funciona
  const center = await toPage(page, 360, 640);
  await page.mouse.click(center.x, center.y);
  await drawTrace(page, [
    [360, 940],
    [340, 760],
    [310, 560],
    [290, 350],
    [280, 160],
    [280, 42],
  ]);
  await page.waitForFunction(() => window.__IDOL_E2E__?.shots === 2);
  expect(await page.evaluate(() => window.__IDOL_E2E__?.lastOutcome)).toBe('goal');
});
