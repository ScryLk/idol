import { expect, test, type Page } from '@playwright/test';
import { FIELD_HEIGHT, FIELD_WIDTH } from '@idol/shared';
import '../src/e2eHook.js';

/**
 * E2E do M3: roleta de drible no nível 7 com fallback local seedado (?seed=)
 * — seed 7 sorteia PERFEITO, seed 1 sorteia FALHA (chance 62 / zona 19 com
 * drible 50 vs defesa 30). O fluxo real de produção usa o servidor.
 */

async function toPage(page: Page, gx: number, gy: number): Promise<{ x: number; y: number }> {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('canvas não encontrado');
  return {
    x: box.x + (gx / FIELD_WIDTH) * box.width,
    y: box.y + (gy / FIELD_HEIGHT) * box.height,
  };
}

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

/** Para a bola na meia-lua do nível 7 e espera o DRIBLAR aparecer. */
async function stopAtOpportunity(page: Page, seed: number): Promise<void> {
  await page.goto(`/?level=7&seed=${seed}`);
  await page.waitForFunction(() => window.__IDOL_E2E__?.ready === true);
  await drawTrace(page, [
    [360, 940],
    [360, 800],
    [360, 712],
  ]);
  await page.waitForFunction(() => window.__IDOL_E2E__?.dribbleAvailable === true);
}

async function tapDribble(page: Page): Promise<void> {
  const btn = await toPage(page, FIELD_WIDTH - 120, FIELD_HEIGHT - 56);
  await page.mouse.click(btn.x, btn.y);
}

test('drible PERFEITO estende a cadeia e conta para as estrelas', async ({ page }) => {
  await stopAtOpportunity(page, 7);

  await tapDribble(page);
  await page.waitForFunction(() => window.__IDOL_E2E__?.lastDribble === 'perfect', undefined, {
    timeout: 15_000,
  });

  const hook = await page.evaluate(() => window.__IDOL_E2E__);
  expect(hook?.perfectDribbles).toBe(1);
  expect(hook?.dribbleChain).toBe(1); // perfeito estende a cadeia
  expect(hook?.phase).toBe('ready');
  // push-your-luck: o perfeito concede um drible EXTRA — oportunidade viva
  expect(hook?.dribbleAvailable).toBe(true);

  // termina o lance: gol pela ala esquerda
  await drawTrace(page, [
    [360, 712],
    [300, 500],
    [258, 200],
    [272, 42],
  ]);
  await page.waitForFunction(() => window.__IDOL_E2E__?.phase === 'complete');
  expect(await page.evaluate(() => window.__IDOL_E2E__?.stars)).toBe(2); // 2 toques
});

test('drible FALHO perde a bola; rewind devolve a oportunidade', async ({ page }) => {
  await stopAtOpportunity(page, 1);

  await tapDribble(page);
  await page.waitForFunction(() => window.__IDOL_E2E__?.lastDribble === 'failure', undefined, {
    timeout: 15_000,
  });
  await page.waitForFunction(() => window.__IDOL_E2E__?.phase === 'failed');

  // rewind: oportunidade volta a ficar acionável (retry contra o frame do shake)
  const rewind = await toPage(page, 120, FIELD_HEIGHT - 56);
  await expect(async () => {
    await page.mouse.click(rewind.x, rewind.y);
    await page.waitForFunction(
      () =>
        window.__IDOL_E2E__?.phase === 'ready' && window.__IDOL_E2E__?.dribbleAvailable === true,
      undefined,
      { timeout: 1_000 },
    );
  }).toPass({ timeout: 15_000 });
  expect(await page.evaluate(() => window.__IDOL_E2E__?.rewinds)).toBe(1);
});
