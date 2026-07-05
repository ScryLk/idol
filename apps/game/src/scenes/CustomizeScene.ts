import Phaser from 'phaser';
import { FIELD_HEIGHT, FIELD_WIDTH } from '@idol/shared';
import { sound } from '../audio/SoundService.js';

const COLOR_KEY = 'idol:hero-color';
const NUMBER_KEY = 'idol:hero-number';

export function heroColor(): number {
  const raw = window.localStorage.getItem(COLOR_KEY);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : 0x1976d2;
}

export function heroNumber(): number {
  const parsed = Number(window.localStorage.getItem(NUMBER_KEY) ?? '10');
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 99 ? parsed : 10;
}

const SWATCHES = [0x1976d2, 0xc62828, 0x2e7d32, 0xf9a825, 0x6a1b9a, 0x00838f];

/** M6 — customização básica do craque: cor da camisa e número. */
export class CustomizeScene extends Phaser.Scene {
  constructor() {
    super('customize');
  }

  create(): void {
    this.add.rectangle(0, 0, FIELD_WIDTH, FIELD_HEIGHT, 0x10141a).setOrigin(0);
    this.add
      .text(FIELD_WIDTH / 2, 50, 'SEU CRAQUE', {
        fontSize: '38px',
        fontStyle: 'bold',
        color: '#fff',
      })
      .setOrigin(0.5);

    const back = this.add
      .rectangle(90, 50, 150, 56, 0x263238)
      .setStrokeStyle(2, 0xffffff, 0.5)
      .setInteractive();
    this.add.text(90, 50, '◀ MAPA', { fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);
    back.on(Phaser.Input.Events.POINTER_DOWN, () => this.scene.start('map'));

    // preview
    const preview = this.add
      .circle(FIELD_WIDTH / 2, 340, 90, heroColor())
      .setStrokeStyle(6, 0xffffff, 0.6);
    const numberText = this.add
      .text(FIELD_WIDTH / 2, 340, String(heroNumber()), {
        fontSize: '72px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // cores
    this.add
      .text(FIELD_WIDTH / 2, 500, 'Cor da camisa', { fontSize: '26px', color: '#90a4ae' })
      .setOrigin(0.5);
    SWATCHES.forEach((color, i) => {
      const x = 135 + i * 90;
      const swatch = this.add
        .rectangle(x, 580, 70, 70, color)
        .setStrokeStyle(3, 0xffffff, heroColor() === color ? 1 : 0.25)
        .setInteractive();
      swatch.on(Phaser.Input.Events.POINTER_DOWN, () => {
        sound.click();
        window.localStorage.setItem(COLOR_KEY, String(color));
        preview.setFillStyle(color);
        this.scene.restart();
      });
    });

    // número
    this.add
      .text(FIELD_WIDTH / 2, 700, 'Número', { fontSize: '26px', color: '#90a4ae' })
      .setOrigin(0.5);
    const stepper = (x: number, label: string, delta: number): void => {
      const btn = this.add
        .rectangle(x, 780, 90, 70, 0x263238)
        .setStrokeStyle(2, 0xffffff, 0.5)
        .setInteractive();
      this.add.text(x, 780, label, { fontSize: '40px', color: '#ffffff' }).setOrigin(0.5);
      btn.on(Phaser.Input.Events.POINTER_DOWN, () => {
        sound.click();
        const next = Math.min(99, Math.max(1, heroNumber() + delta));
        window.localStorage.setItem(NUMBER_KEY, String(next));
        numberText.setText(String(next));
      });
    };
    stepper(FIELD_WIDTH / 2 - 120, '−', -1);
    stepper(FIELD_WIDTH / 2 + 120, '+', +1);
  }
}
