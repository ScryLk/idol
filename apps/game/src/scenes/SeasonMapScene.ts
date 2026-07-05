import Phaser from 'phaser';
import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  SEASON1_LEVELS,
  SEASON1_STAR_GATES,
  isLevelUnlocked,
  seasonTotalStars,
} from '@idol/shared';
import { sound } from '../audio/SoundService.js';
import { makeRoundedButton } from '../gfx/ui.js';
import { loadProgress } from '../state/progressStore.js';
import '../e2eHook.js';

/**
 * M6 — mapa da temporada: 10 cards com estrelas conquistadas, cadeado e
 * gates de total de estrelas. Progresso local (offline-first).
 * Geometria dos cards/botões é ESTÁVEL (E2E clica por coordenada).
 */
export class SeasonMapScene extends Phaser.Scene {
  constructor() {
    super('map');
  }

  create(): void {
    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => sound.unlock());

    const progress = loadProgress();
    const total = seasonTotalStars(progress);

    // fundo: gradiente vertical simulado em faixas + textura sutil
    const bg = this.add.graphics();
    const top = Phaser.Display.Color.ValueToColor(0x14231a);
    const bottom = Phaser.Display.Color.ValueToColor(0x0b1210);
    for (let i = 0; i < 16; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, 16, i);
      bg.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      bg.fillRect(0, (FIELD_HEIGHT / 16) * i, FIELD_WIDTH, FIELD_HEIGHT / 16 + 1);
    }
    bg.lineStyle(2, 0xffffff, 0.03);
    for (let y = 0; y < FIELD_HEIGHT; y += 40) bg.lineBetween(0, y, FIELD_WIDTH, y);

    this.add
      .text(FIELD_WIDTH / 2, 60, 'TEMPORADA 1', {
        fontSize: '46px',
        fontStyle: 'bold',
        color: '#ffffff',
        shadow: { offsetY: 4, color: '#000000', blur: 8, fill: true },
      })
      .setOrigin(0.5);
    this.add
      .text(FIELD_WIDTH / 2, 114, `★ ${total} de ${SEASON1_LEVELS.length * 3}`, {
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#ffd740',
      })
      .setOrigin(0.5);

    const unlocked: number[] = [];
    for (const level of SEASON1_LEVELS) {
      const ordinal = level.metadata.ordinal;
      const isOpen = isLevelUnlocked(ordinal, progress);
      if (isOpen) unlocked.push(ordinal);
      this.drawCard(ordinal, level.metadata.name, progress[ordinal] ?? 0, isOpen);
    }

    // botões de rodapé (mesmos centros/tamanhos do M6)
    makeRoundedButton(this, 130, FIELD_HEIGHT - 56, 214, 60, 'CARREIRA', () =>
      this.scene.start('meta'),
    );
    makeRoundedButton(this, 360, FIELD_HEIGHT - 56, 214, 60, 'TRANSFERIR', () =>
      this.scene.start('transfer'),
    );
    makeRoundedButton(this, 590, FIELD_HEIGHT - 56, 214, 60, 'CRAQUE', () =>
      this.scene.start('customize'),
    );

    window.__IDOL_E2E__ = {
      ready: true,
      screen: 'map',
      totalStars: total,
      unlockedLevels: unlocked,
    };
  }

  private drawCard(ordinal: number, name: string, stars: number, isOpen: boolean): void {
    const col = (ordinal - 1) % 2;
    const row = Math.floor((ordinal - 1) / 2);
    const x = 190 + col * 340;
    const y = 220 + row * 190;
    const w = 310;
    const h = 165;

    const g = this.add.graphics();
    // sombra + corpo arredondado + faixa de topo
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(x - w / 2 + 3, y - h / 2 + 5, w, h, 18);
    g.fillStyle(isOpen ? 0x1d4a24 : 0x1c232b, isOpen ? 0.96 : 0.85);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 18);
    g.fillStyle(isOpen ? 0x2e7d32 : 0x27313c, 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, 46, { tl: 18, tr: 18, bl: 0, br: 0 });
    g.lineStyle(3, isOpen ? 0x66bb6a : 0x39434e, 1);
    g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 18);

    this.add
      .text(x, y - 60, `NÍVEL ${ordinal}`, {
        fontSize: '24px',
        fontStyle: 'bold',
        color: isOpen ? '#ffffff' : '#78909c',
      })
      .setOrigin(0.5);
    this.add
      .text(x, y - 16, name, { fontSize: '20px', color: isOpen ? '#c8e6c9' : '#607d8b' })
      .setOrigin(0.5);

    if (isOpen) {
      this.add
        .text(x, y + 34, `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`, {
          fontSize: '34px',
          color: '#ffd740',
          shadow: { offsetY: 2, color: '#000000', blur: 6, fill: true },
        })
        .setOrigin(0.5);
      const hit = this.add.zone(x, y, w, h).setInteractive();
      hit.on(Phaser.Input.Events.POINTER_DOWN, () => {
        sound.click();
        window.location.search = `level=${ordinal}`;
      });
    } else {
      const gate = SEASON1_STAR_GATES[ordinal];
      this.add
        .text(x, y + 34, gate ? `🔒 precisa de ${gate}★ no total` : '🔒 complete o anterior', {
          fontSize: '19px',
          color: '#90a4ae',
        })
        .setOrigin(0.5);
    }
  }
}
