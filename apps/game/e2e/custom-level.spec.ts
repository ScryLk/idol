import { expect, test, type Page } from '@playwright/test';
import { encodeLevelScript, FIELD_HEIGHT, FIELD_WIDTH, type LevelScript } from '@idol/shared';
import '../src/e2eHook.js';

/**
 * DoD do M5: um nível criado NO EDITOR é jogado no game sem tocar em código.
 * O payload abaixo é exatamente o artefato que o editor exporta no link
 * "jogar no game" (?level=custom#<base64url do script_json validado>).
 */

const editorLevel: LevelScript = {
  version: 1,
  metadata: { name: 'Feito no Editor', season: 1, ordinal: 99, difficulty: 2 },
  ball: { x: 360, y: 940 },
  hero: { position: { x: 360, y: 990 } },
  teammates: [],
  defenders: [{ id: 'zagueiro-editor', position: { x: 360, y: 600 }, interceptRadius: 50 }],
  goalkeeper: {
    position: { x: 360, y: 110 },
    arc: { centerAngle: Math.PI / 2, halfAngle: 0.45, radius: 78 },
  },
  objective: { type: 'goal' },
  stars: { two: { maxTouches: 2 }, three: { maxTouches: 1, noRewind: true } },
  dribbleOpportunities: [],
};

async function toPage(page: Page, gx: number, gy: number): Promise<{ x: number; y: number }> {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('canvas não encontrado');
  return {
    x: box.x + (gx / FIELD_WIDTH) * box.width,
    y: box.y + (gy / FIELD_HEIGHT) * box.height,
  };
}

test('nível exportado pelo editor é jogável via ?level=custom#payload', async ({ page }) => {
  const payload = encodeLevelScript(editorLevel);
  await page.goto(`/?level=custom#${payload}`);
  await page.waitForFunction(() => window.__IDOL_E2E__?.ready === true);

  // o nível carregado é o do editor (ordinal 99), não um da temporada
  expect(await page.evaluate(() => window.__IDOL_E2E__?.level)).toBe(99);

  // gol pela ala esquerda desviando do zagueiro-editor
  const points: Array<[number, number]> = [
    [360, 940],
    [300, 750],
    [252, 500],
    [258, 200],
    [272, 42],
  ];
  const start = await toPage(page, points[0]![0], points[0]![1]);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (const [gx, gy] of points.slice(1)) {
    const p = await toPage(page, gx, gy);
    await page.mouse.move(p.x, p.y, { steps: 8 });
  }
  await page.mouse.up();

  await page.waitForFunction(() => window.__IDOL_E2E__?.phase === 'complete');
  expect(await page.evaluate(() => window.__IDOL_E2E__?.stars)).toBe(3);
});

test('payload adulterado cai com segurança para o nível 1', async ({ page }) => {
  await page.goto('/?level=custom#nao-e-um-payload-valido');
  await page.waitForFunction(() => window.__IDOL_E2E__?.ready === true);
  expect(await page.evaluate(() => window.__IDOL_E2E__?.level)).toBe(1);
});
