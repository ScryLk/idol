import type Phaser from 'phaser';
import { FIELD_HEIGHT, FIELD_WIDTH } from '@idol/shared';
import type { SpinView } from '../dribble/DribbleClient.js';

const WHEEL_RADIUS = 150;
const COLORS = { perfect: 0xffd740, success: 0x66bb6a, failure: 0xef5350 };

/**
 * Roleta visual: os três setores são proporcionais à zona perfeita/chance
 * reais do giro, e a roda para exatamente na rolagem sorteada NO SERVIDOR —
 * a animação nunca inventa resultado. Velocidade cresce com a cadeia;
 * Perfeito ganha hit-stop + zoom.
 */
export class RouletteOverlay {
  constructor(private readonly scene: Phaser.Scene) {}

  show(spin: SpinView, onDone: () => void): void {
    const cx = FIELD_WIDTH / 2;
    const cy = 560;

    const backdrop = this.scene.add
      .rectangle(0, 0, FIELD_WIDTH, FIELD_HEIGHT, 0x000000, 0.55)
      .setOrigin(0)
      .setDepth(30);

    const wheel = this.scene.add.container(cx, cy).setDepth(31);
    const g = this.scene.add.graphics();
    wheel.add(g);

    // setores: perfeito [0, zona), sucesso [zona, chance), falha [chance, 100)
    const frac = (v: number): number => (v / 100) * Math.PI * 2;
    const top = -Math.PI / 2;
    g.fillStyle(COLORS.perfect, 1);
    g.slice(0, 0, WHEEL_RADIUS, top, top + frac(spin.perfectZone));
    g.fillPath();
    g.fillStyle(COLORS.success, 1);
    g.slice(0, 0, WHEEL_RADIUS, top + frac(spin.perfectZone), top + frac(spin.chance));
    g.fillPath();
    g.fillStyle(COLORS.failure, 1);
    g.slice(0, 0, WHEEL_RADIUS, top + frac(spin.chance), top + Math.PI * 2);
    g.fillPath();
    g.lineStyle(4, 0xffffff, 0.9);
    g.strokeCircle(0, 0, WHEEL_RADIUS);

    // ponteiro fixo no topo
    const pointer = this.scene.add
      .triangle(cx, cy - WHEEL_RADIUS - 8, 0, 0, 28, 0, 14, 26, 0xffffff)
      .setOrigin(0.5, 0)
      .setDepth(32);

    const label = this.scene.add
      .text(cx, cy + WHEEL_RADIUS + 56, `Chance ${Math.round(spin.chance)}%`, {
        fontSize: '30px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(32);

    // giro: para exatamente na rolagem; mais rápido e com mais voltas por cadeia
    const extraSpins = 3 + spin.chainBefore;
    const duration = Math.max(700, 1500 - spin.chainBefore * 250);
    const targetRotation = -(extraSpins * Math.PI * 2 + frac(spin.roll));

    this.scene.tweens.add({
      targets: wheel,
      rotation: targetRotation,
      duration,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        const finish = (): void => {
          this.scene.tweens.add({
            targets: [backdrop, wheel, pointer, label],
            alpha: 0,
            duration: 220,
            delay: 500,
            onComplete: () => {
              backdrop.destroy();
              wheel.destroy(true);
              pointer.destroy();
              label.destroy();
              onDone();
            },
          });
        };

        if (spin.outcome === 'perfect') {
          // hit-stop + zoom: o Perfeito precisa "bater"
          label.setText('PERFEITO!').setColor('#ffd740').setFontSize(44);
          const cam = this.scene.cameras.main;
          cam.zoomTo(1.18, 90, 'Sine.easeOut');
          this.scene.time.delayedCall(240, () => {
            cam.zoomTo(1, 160, 'Sine.easeIn');
            finish();
          });
        } else {
          label.setText(spin.outcome === 'success' ? 'DRIBLOU!' : 'PERDEU A BOLA!');
          label.setColor(spin.outcome === 'success' ? '#b9f6ca' : '#ff8a80');
          finish();
        }
      },
    });
  }
}
