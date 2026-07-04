import { expect, test, type Page } from '@playwright/test';
import { FIELD_HEIGHT, FIELD_WIDTH } from '@idol/shared';
import '../src/e2eHook.js';

/**
 * E2E do M2: joga níveis reais (LevelScript + LevelRuntime) desenhando traços
 * com eventos reais de pointer e validando fase/estrelas/passes via hook.
 */

async function gameReady(page: Page, level = 1): Promise<void> {
  await page.goto(`/?level=${level}`);
  await page.waitForFunction(() => window.__IDOL_E2E__?.ready === true);
}

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

async function waitPhase(page: Page, phase: string, shots: number): Promise<void> {
  await page.waitForFunction(
    ([ph, sh]) => window.__IDOL_E2E__?.phase === ph && window.__IDOL_E2E__?.shots === sh,
    [phase, shots] as [string, number],
  );
}

const CORNER_SHOT: Array<[number, number]> = [
  [360, 940],
  [330, 700],
  [300, 400],
  [280, 150],
  [278, 42],
];

test('nível 1: gol de 3 estrelas e navegação para o nível 2', async ({ page }) => {
  await gameReady(page, 1);

  await drawTrace(page, CORNER_SHOT);
  await waitPhase(page, 'complete', 1);

  const hook = await page.evaluate(() => window.__IDOL_E2E__);
  expect(hook?.lastOutcome).toBe('goal');
  expect(hook?.touches).toBe(1);
  expect(hook?.stars).toBe(3);

  // toque em qualquer lugar → próximo nível
  const center = await toPage(page, 360, 640);
  await page.mouse.click(center.x, center.y);
  await page.waitForFunction(() => window.__IDOL_E2E__?.level === 2);
  expect(await page.evaluate(() => window.__IDOL_E2E__?.phase)).toBe('ready');
});

test('nível 3: interceptação, rewind e gol na segunda tentativa', async ({ page }) => {
  await gameReady(page, 3);

  // chute reto no zagueiro central (360,600 r55) → interceptado
  await drawTrace(page, [
    [360, 940],
    [360, 750],
    [360, 500],
  ]);
  await waitPhase(page, 'failed', 1);
  expect(await page.evaluate(() => window.__IDOL_E2E__?.lastOutcome)).toBe('intercepted');

  // botão REWIND (centro em 120, 1224)
  const rewind = await toPage(page, 120, FIELD_HEIGHT - 56);
  await page.mouse.click(rewind.x, rewind.y);
  await page.waitForFunction(() => window.__IDOL_E2E__?.phase === 'ready');
  expect(await page.evaluate(() => window.__IDOL_E2E__?.rewinds)).toBe(1);
  expect(await page.evaluate(() => window.__IDOL_E2E__?.touches)).toBe(0);

  // agora pela ala esquerda
  await drawTrace(page, [
    [360, 940],
    [300, 750],
    [252, 500],
    [258, 200],
    [272, 42],
  ]);
  await waitPhase(page, 'complete', 2);
  // completou, mas o rewind custou a 3ª estrela
  expect(await page.evaluate(() => window.__IDOL_E2E__?.stars)).toBe(2);
});

test('nível 5: passe obrigatório + finalização', async ({ page }) => {
  await gameReady(page, 5);

  // toque 1: passe para o ponta-esquerda (200,650)
  await drawTrace(page, [
    [360, 940],
    [280, 800],
    [208, 658],
  ]);
  await waitPhase(page, 'ready', 1);
  expect(await page.evaluate(() => window.__IDOL_E2E__?.passes)).toBe(1);

  // toque 2: do pé do ponta para o canto esquerdo
  await drawTrace(page, [
    [200, 650],
    [228, 400],
    [260, 150],
    [272, 42],
  ]);
  await waitPhase(page, 'complete', 2);

  const hook = await page.evaluate(() => window.__IDOL_E2E__);
  expect(hook?.lastOutcome).toBe('goal');
  expect(hook?.stars).toBe(3);
});
