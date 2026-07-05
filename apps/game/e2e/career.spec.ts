import { expect, test, type Page } from '@playwright/test';
import { FIELD_HEIGHT, FIELD_WIDTH } from '@idol/shared';
import '../src/e2eHook.js';

/**
 * E2E do M6 — carreira: mapa com gates de estrelas, progresso persistido e
 * desbloqueio após jogar. Fluxo: mapa → nível 1 → gol 3★ → volta ao mapa →
 * nível 2 aberto, nível 4 ainda trancado pelo gate de 5★.
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

/** Centro do card do nível N no mapa (2 colunas × 5 linhas). */
function cardCenter(ordinal: number): [number, number] {
  const col = (ordinal - 1) % 2;
  const row = Math.floor((ordinal - 1) / 2);
  return [190 + col * 340, 220 + row * 190];
}

test('mapa: só o nível 1 aberto; jogar desbloqueia o 2; gate segura o 4', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__IDOL_E2E__?.screen === 'map');

  let hook = await page.evaluate(() => window.__IDOL_E2E__);
  expect(hook?.totalStars).toBe(0);
  expect(hook?.unlockedLevels).toEqual([1]);

  // toca no card do nível 1 → cena de nível
  const [cx, cy] = cardCenter(1);
  const card = await toPage(page, cx, cy);
  await page.mouse.click(card.x, card.y);
  await page.waitForFunction(
    () => window.__IDOL_E2E__?.level === 1 && window.__IDOL_E2E__?.phase === 'ready',
  );

  // gol de 3 estrelas (dica de onboarding e demo não bloqueiam o traço)
  await drawTrace(page, [
    [360, 940],
    [330, 700],
    [300, 400],
    [280, 150],
    [278, 42],
  ]);
  await page.waitForFunction(() => window.__IDOL_E2E__?.phase === 'complete');
  expect(await page.evaluate(() => window.__IDOL_E2E__?.stars)).toBe(3);

  // botão MAPA → volta com progresso persistido
  const mapBtn = await toPage(page, FIELD_WIDTH - 110, 116);
  await page.mouse.click(mapBtn.x, mapBtn.y);
  await page.waitForFunction(() => window.__IDOL_E2E__?.screen === 'map');

  hook = await page.evaluate(() => window.__IDOL_E2E__);
  expect(hook?.totalStars).toBe(3);
  expect(hook?.unlockedLevels).toContain(1);
  expect(hook?.unlockedLevels).toContain(2);
  // gate: nível 4 precisa de 5★ no total (e do 3 completado)
  expect(hook?.unlockedLevels).not.toContain(4);

  // card trancado não navega
  const [lx, ly] = cardCenter(4);
  const locked = await toPage(page, lx, ly);
  await page.mouse.click(locked.x, locked.y);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__IDOL_E2E__?.screen)).toBe('map');
});

test('telas de transferência e customização abrem e voltam ao mapa', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__IDOL_E2E__?.screen === 'map');

  // TRANSFERIR (botão central do rodapé)
  const transfer = await toPage(page, 360, FIELD_HEIGHT - 56);
  await page.mouse.click(transfer.x, transfer.y);
  await page.waitForTimeout(600); // cena carrega (tier offline = Amador)

  const backFromTransfer = await toPage(page, 90, 50);
  await page.mouse.click(backFromTransfer.x, backFromTransfer.y);
  await page.waitForFunction(() => window.__IDOL_E2E__?.screen === 'map');

  // CRAQUE
  const customize = await toPage(page, 590, FIELD_HEIGHT - 56);
  await page.mouse.click(customize.x, customize.y);
  await page.waitForTimeout(400);
  const backFromCustomize = await toPage(page, 90, 50);
  await page.mouse.click(backFromCustomize.x, backFromCustomize.y);
  await page.waitForFunction(() => window.__IDOL_E2E__?.screen === 'map');
});
