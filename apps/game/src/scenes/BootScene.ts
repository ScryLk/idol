import Phaser from 'phaser';

/**
 * Placeholder do M0: prova que o pipeline Phaser+Vite+TS funciona.
 * A cena de gameplay real (traço, bola, defensores) chega no M1.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, 'IDOL\nM0 — fundação pronta', {
        fontSize: '48px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5);
  }
}
