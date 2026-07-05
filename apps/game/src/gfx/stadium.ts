import type Phaser from 'phaser';
import {
  createRng,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  GOAL_LINE_Y,
  GOAL_MOUTH_X_MAX,
  GOAL_MOUTH_X_MIN,
} from '@idol/shared';
import { drawDashedCircle } from './draw.js';

const GRASS_A = 0x2f8134;
const GRASS_B = 0x27702c;
const LINE = 0xf4f7f2;

const CROWD_PALETTE = [0xd7dbe0, 0xaab4c0, 0xe0c088, 0x8fb2d8, 0xc98f8f, 0x9fc79f];

/**
 * Estádio procedural: arquibancada com torcida atrás do gol, gol com traves
 * e rede, marcações reais de meio-campo de ataque (grande área, meia-lua,
 * escanteios, círculo central ao fundo) e gramado com faixas de corte.
 * Determinístico (RNG seedado) — mesma torcida em todo load.
 */
export function drawStadium(scene: Phaser.Scene): void {
  const g = scene.add.graphics();

  // ---- gramado com faixas de corte -------------------------------------
  const stripes = 12;
  const stripeH = (FIELD_HEIGHT - GOAL_LINE_Y) / stripes;
  g.fillStyle(GRASS_B, 1);
  g.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
  for (let i = 0; i < stripes; i++) {
    g.fillStyle(i % 2 === 0 ? GRASS_A : GRASS_B, 1);
    g.fillRect(0, GOAL_LINE_Y + i * stripeH, FIELD_WIDTH, stripeH);
  }
  // brilho sutil de refletor no topo
  g.fillStyle(0xffffff, 0.045);
  g.fillRect(0, GOAL_LINE_Y, FIELD_WIDTH, 220);

  // ---- arquibancada atrás do gol ----------------------------------------
  g.fillStyle(0x171a20, 1);
  g.fillRect(0, 0, FIELD_WIDTH, GOAL_LINE_Y - 4);
  const rng = createRng(20260705);
  for (let row = 0; row < 4; row++) {
    const y = 9 + row * 12;
    for (let x = 8; x < FIELD_WIDTH; x += 13) {
      const color = CROWD_PALETTE[rng.nextInt(CROWD_PALETTE.length)] as number;
      g.fillStyle(color, 0.35 + rng.next() * 0.45);
      g.fillCircle(x + rng.nextInt(6) - 3, y, 3);
    }
  }
  // placa de publicidade rente ao campo
  g.fillStyle(0x0d3b66, 1);
  g.fillRect(0, GOAL_LINE_Y - 8, FIELD_WIDTH, 8);
  g.fillStyle(0x9ad1d4, 0.8);
  for (let x = 20; x < FIELD_WIDTH; x += 90) g.fillRect(x, GOAL_LINE_Y - 6, 44, 4);

  // ---- gol: rede + traves ------------------------------------------------
  const mouthW = GOAL_MOUTH_X_MAX - GOAL_MOUTH_X_MIN;
  g.fillStyle(0x10131a, 1);
  g.fillRect(GOAL_MOUTH_X_MIN, GOAL_LINE_Y - 34, mouthW, 34);
  g.lineStyle(1, 0xcfd8dc, 0.35);
  for (let x = GOAL_MOUTH_X_MIN; x <= GOAL_MOUTH_X_MAX; x += 10) {
    g.lineBetween(x, GOAL_LINE_Y - 32, x, GOAL_LINE_Y);
  }
  for (let y = GOAL_LINE_Y - 32; y <= GOAL_LINE_Y; y += 8) {
    g.lineBetween(GOAL_MOUTH_X_MIN, y, GOAL_MOUTH_X_MAX, y);
  }
  g.fillStyle(0xffffff, 1); // traves
  g.fillCircle(GOAL_MOUTH_X_MIN, GOAL_LINE_Y, 5);
  g.fillCircle(GOAL_MOUTH_X_MAX, GOAL_LINE_Y, 5);
  g.fillRect(GOAL_MOUTH_X_MIN - 3, GOAL_LINE_Y - 36, 6, 36);
  g.fillRect(GOAL_MOUTH_X_MAX - 3, GOAL_LINE_Y - 36, 6, 36);

  // ---- marcações do campo ------------------------------------------------
  g.lineStyle(3, LINE, 0.85);
  g.strokeRect(10, GOAL_LINE_Y, FIELD_WIDTH - 20, FIELD_HEIGHT - GOAL_LINE_Y - 10);
  // grande área e pequena área
  g.strokeRect(160, GOAL_LINE_Y, 400, 240);
  g.strokeRect(272, GOAL_LINE_Y, 176, 110);
  // marca do pênalti + meia-lua
  g.fillStyle(LINE, 0.9);
  g.fillCircle(FIELD_WIDTH / 2, GOAL_LINE_Y + 192, 4);
  g.beginPath();
  g.arc(FIELD_WIDTH / 2, GOAL_LINE_Y + 192, 96, 0.28 * Math.PI, 0.72 * Math.PI);
  g.strokePath();
  // escanteios
  g.beginPath();
  g.arc(10, GOAL_LINE_Y, 16, 0, Math.PI / 2);
  g.strokePath();
  g.beginPath();
  g.arc(FIELD_WIDTH - 10, GOAL_LINE_Y, 16, Math.PI / 2, Math.PI);
  g.strokePath();
  // círculo central (metade visível ao fundo)
  g.beginPath();
  g.arc(FIELD_WIDTH / 2, FIELD_HEIGHT - 10, 110, Math.PI, Math.PI * 2);
  g.strokePath();
  g.fillCircle(FIELD_WIDTH / 2, FIELD_HEIGHT - 10, 4);

  // vinheta lateral sutil (foco no campo)
  g.fillStyle(0x000000, 0.1);
  g.fillRect(0, GOAL_LINE_Y, 10, FIELD_HEIGHT - GOAL_LINE_Y);
  g.fillRect(FIELD_WIDTH - 10, GOAL_LINE_Y, 10, FIELD_HEIGHT - GOAL_LINE_Y);
}

/** Arco de defesa do goleiro com degradê (3 camadas). */
export function drawKeeperArc(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radius: number,
  centerAngle: number,
  halfAngle: number,
): void {
  const layers: Array<[number, number]> = [
    [1, 0.08],
    [0.72, 0.1],
    [0.45, 0.12],
  ];
  for (const [k, alpha] of layers) {
    g.fillStyle(0xffe24d, alpha);
    g.slice(x, y, radius * k, centerAngle - halfAngle, centerAngle + halfAngle);
    g.fillPath();
  }
  drawDashedCircle(g, x, y, radius, 0xffe24d, 0.35, 2, 36);
}
