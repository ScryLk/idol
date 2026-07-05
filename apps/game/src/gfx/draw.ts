import type Phaser from 'phaser';

/** Escurece/clareia uma cor 0xRRGGBB por um fator (0..2). */
export function shade(color: number, factor: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

export interface Kit {
  base: number;
}

/**
 * "Ficha" de jogador top-down: sombra projetada, camisa em dois tons,
 * brilho e contorno — legível a 18px de raio num celular.
 */
export function drawPlayerChip(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  r: number,
  kit: Kit,
): void {
  g.fillStyle(0x000000, 0.28);
  g.fillEllipse(x + 3, y + r * 0.42, r * 2.15, r * 1.05); // sombra
  g.fillStyle(shade(kit.base, 0.55), 1);
  g.fillCircle(x, y, r);
  g.fillStyle(kit.base, 1);
  g.fillCircle(x, y, r - 3);
  g.fillStyle(0xffffff, 0.2);
  g.fillCircle(x - r * 0.3, y - r * 0.34, r * 0.45); // brilho
  g.lineStyle(2, 0x0d1117, 0.85);
  g.strokeCircle(x, y, r);
}

/** Círculo tracejado (Phaser Graphics não tem dash nativo). */
export function drawDashedCircle(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radius: number,
  color: number,
  alpha: number,
  width = 2,
  dashes = 24,
): void {
  g.lineStyle(width, color, alpha);
  const step = (Math.PI * 2) / dashes;
  for (let i = 0; i < dashes; i += 2) {
    g.beginPath();
    g.arc(x, y, radius, i * step, (i + 1) * step);
    g.strokePath();
  }
}
