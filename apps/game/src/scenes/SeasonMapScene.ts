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
import { loadProgress } from '../state/progressStore.js';
import '../e2eHook.js';

/**
 * M6 — mapa da temporada: 10 cards com estrelas conquistadas, cadeado e
 * gates de total de estrelas. Progresso local (offline-first).
 */
export class SeasonMapScene extends Phaser.Scene {
  constructor() {
    super('map');
  }

  create(): void {
    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => sound.unlock());

    const progress = loadProgress();
    const total = seasonTotalStars(progress);

    this.add.rectangle(0, 0, FIELD_WIDTH, FIELD_HEIGHT, 0x101a12).setOrigin(0);
    this.add
      .text(FIELD_WIDTH / 2, 60, 'TEMPORADA 1', {
        fontSize: '44px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.add
      .text(FIELD_WIDTH / 2, 112, `★ ${total} de ${SEASON1_LEVELS.length * 3}`, {
        fontSize: '28px',
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

    this.menuButton(130, FIELD_HEIGHT - 56, 'CARREIRA', () => this.scene.start('meta'));
    this.menuButton(360, FIELD_HEIGHT - 56, 'TRANSFERIR', () => this.scene.start('transfer'));
    this.menuButton(590, FIELD_HEIGHT - 56, 'CRAQUE', () => this.scene.start('customize'));

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

    const bg = this.add
      .rectangle(x, y, 310, 165, isOpen ? 0x1b5e20 : 0x263238, isOpen ? 0.9 : 0.6)
      .setStrokeStyle(3, isOpen ? 0x66bb6a : 0x455a64);
    this.add
      .text(x, y - 48, `Nível ${ordinal}`, {
        fontSize: '26px',
        fontStyle: 'bold',
        color: isOpen ? '#ffffff' : '#78909c',
      })
      .setOrigin(0.5);
    this.add
      .text(x, y - 12, name, { fontSize: '20px', color: isOpen ? '#c8e6c9' : '#607d8b' })
      .setOrigin(0.5);

    if (isOpen) {
      this.add
        .text(x, y + 34, `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`, {
          fontSize: '32px',
          color: '#ffd740',
        })
        .setOrigin(0.5);
      bg.setInteractive();
      bg.on(Phaser.Input.Events.POINTER_DOWN, () => {
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

  private menuButton(cx: number, cy: number, label: string, onTap: () => void): void {
    const bg = this.add
      .rectangle(cx, cy, 214, 60, 0x263238, 0.95)
      .setStrokeStyle(2, 0xffffff, 0.5)
      .setInteractive();
    this.add.text(cx, cy, label, { fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);
    bg.on(Phaser.Input.Events.POINTER_DOWN, () => {
      sound.click();
      onTap();
    });
  }
}
