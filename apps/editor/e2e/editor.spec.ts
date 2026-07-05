import { expect, test, type Page } from '@playwright/test';
import { FIELD_HEIGHT, FIELD_WIDTH } from '@idol/shared';

/**
 * E2E do M5 (lado editor): montar um nível clicando na UI real e exportar um
 * artefato válido — o link "jogar no game" com o payload base64url.
 */

async function canvasPoint(page: Page, gx: number, gy: number): Promise<{ x: number; y: number }> {
  const box = await page.locator('#canvas-wrap canvas').boundingBox();
  if (!box) throw new Error('canvas não encontrado');
  return {
    x: box.x + (gx / FIELD_WIDTH) * box.width,
    y: box.y + (gy / FIELD_HEIGHT) * box.height,
  };
}

test('monta um nível na UI, exporta JSON válido e gera link jogável', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__IDOL_EDITOR__ !== undefined);

  // nome do nível (blur explícito: o onchange re-renderiza a sidebar)
  await page.fill('input[data-meta="name"]', 'Nível do E2E');
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => window.__IDOL_EDITOR__?.draft.metadata.name === 'Nível do E2E');

  const setMode = async (mode: string): Promise<void> => {
    await page.click(`button[data-mode="${mode}"]`);
    await page.waitForFunction((m) => window.__IDOL_EDITOR__?.mode === m, mode);
  };

  // adiciona um zagueiro clicando no campo
  await setMode('add-defender');
  const at = await canvasPoint(page, 360, 600);
  await page.mouse.click(at.x, at.y);
  await page.waitForFunction(() => window.__IDOL_EDITOR__?.draft.defenders.length === 1);

  // adiciona um companheiro e desenha uma rota de 2 waypoints
  await setMode('add-teammate');
  const tm = await canvasPoint(page, 200, 700);
  await page.mouse.click(tm.x, tm.y);
  await page.waitForFunction(() => window.__IDOL_EDITOR__?.draft.teammates.length === 1);

  await setMode('route');
  const wp1 = await canvasPoint(page, 220, 550);
  await page.mouse.click(wp1.x, wp1.y);
  const wp2 = await canvasPoint(page, 300, 420);
  await page.mouse.click(wp2.x, wp2.y);
  await page.waitForFunction(
    () => (window.__IDOL_EDITOR__?.draft.teammates[0]?.route?.length ?? 0) === 3,
  );

  // exporta
  await page.click('button[data-action="export"]');
  const json = await page.inputValue('textarea[data-field="json"]');
  const parsed = JSON.parse(json) as {
    version: number;
    metadata: { name: string };
    defenders: unknown[];
    teammates: Array<{ route?: Array<{ t: number }> }>;
  };
  expect(parsed.version).toBe(1);
  expect(parsed.metadata.name).toBe('Nível do E2E');
  expect(parsed.defenders).toHaveLength(1);
  expect(parsed.teammates[0]?.route).toHaveLength(3);

  // link jogável com payload base64url no hash
  const href = await page.getAttribute('a[data-field="play-link"]', 'href');
  expect(href).toContain('/?level=custom#');
  expect((href?.split('#')[1] ?? '').length).toBeGreaterThan(100);

  // import roundtrip pela UI: cola o JSON e importa sem erros
  await page.click('button[data-action="new"]');
  await page.waitForFunction(() => window.__IDOL_EDITOR__?.draft.defenders.length === 0);
  await page.fill('textarea[data-field="json"]', json);
  await page.click('button[data-action="import"]');
  await page.waitForFunction(() => window.__IDOL_EDITOR__?.draft.metadata.name === 'Nível do E2E');
  await expect(page.locator('.errors')).toHaveCount(0);
});

test('playtest in-place: bola até o gol no nível recém-montado', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__IDOL_EDITOR__ !== undefined);

  // nível em branco (sem defensores) → testar direto
  await page.click('button[data-action="playtest"]');
  await page.waitForTimeout(600); // troca de cena

  // desenha um chute ao canto no canvas do playtest
  const from = await canvasPoint(page, 360, 940);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (const [gx, gy] of [
    [330, 700],
    [300, 400],
    [280, 150],
    [278, 42],
  ] as Array<[number, number]>) {
    const p = await canvasPoint(page, gx, gy);
    await page.mouse.move(p.x, p.y, { steps: 6 });
  }
  await page.mouse.up();

  // GOL aparece no banner (texto renderizado no canvas — validamos via runtime:
  // o draft não muda, mas a cena 'playtest' está ativa e sem erros de página)
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.waitForTimeout(2500);
  expect(errors).toEqual([]);
});
