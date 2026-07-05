import Phaser from 'phaser';
import { sound } from '../audio/SoundService.js';

/**
 * Botão arredondado padrão (alvo de toque ≥ 44px). A ÁREA INTERATIVA é
 * idêntica à dos botões antigos (mesmo centro/tamanho) — só o visual mudou.
 */
export function makeRoundedButton(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  w: number,
  h: number,
  label: string,
  onTap: () => void,
  options: { fill?: number; textColor?: string; fontSize?: string } = {},
): Phaser.GameObjects.Container {
  const fill = options.fill ?? 0x1c262e;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35);
  g.fillRoundedRect(-w / 2 + 2, -h / 2 + 4, w, h, 14); // sombra
  g.fillStyle(fill, 0.95);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
  g.fillStyle(0xffffff, 0.07);
  g.fillRoundedRect(-w / 2, -h / 2, w, h / 2, { tl: 14, tr: 14, bl: 0, br: 0 });
  g.lineStyle(2, 0xffffff, 0.35);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);

  const txt = scene.add
    .text(0, 0, label, {
      fontSize: options.fontSize ?? '24px',
      fontStyle: 'bold',
      color: options.textColor ?? '#eceff1',
    })
    .setOrigin(0.5);

  const c = scene.add.container(cx, cy, [g, txt]).setDepth(20).setSize(w, h);
  c.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
  c.on(
    Phaser.Input.Events.POINTER_DOWN,
    (
      _pointer: Phaser.Input.Pointer,
      _x: number,
      _y: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      sound.click();
      scene.tweens.add({ targets: c, scale: 0.94, duration: 60, yoyo: true });
      onTap();
    },
  );
  return c;
}
