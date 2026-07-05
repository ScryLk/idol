import type Phaser from 'phaser';

/**
 * Texturas procedurais geradas UMA vez por cena (zero assets binários,
 * zero alocação em hot path). Chaves idempotentes: regenerar é no-op.
 */

export function ensureGameTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists('ball')) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    // bola com gomos (vista de cima)
    g.fillStyle(0xffffff, 1);
    g.fillCircle(13, 13, 12);
    g.fillStyle(0xe3e8ee, 1);
    g.fillCircle(16, 16, 9); // meia-sombra
    g.fillStyle(0xffffff, 1);
    g.fillCircle(11, 11, 8);
    g.fillStyle(0x2b3138, 1);
    g.fillCircle(13, 13, 2.6); // gomo central
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      g.fillCircle(13 + Math.cos(a) * 7.4, 13 + Math.sin(a) * 7.4, 2.1);
    }
    g.lineStyle(1.5, 0x8a939e, 1);
    g.strokeCircle(13, 13, 12);
    g.generateTexture('ball', 26, 26);
    g.destroy();
  }

  if (!scene.textures.exists('spark')) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture('spark', 8, 8);
    g.destroy();
  }
}
