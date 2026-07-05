import Phaser from 'phaser';
import { CLUBS, FIELD_HEIGHT, FIELD_WIDTH, tierForFans, type FanTier } from '@idol/shared';
import { apiClient } from '../api/ApiClient.js';
import { sound } from '../audio/SoundService.js';

const CLUB_KEY = 'idol:club';

export function currentClubId(): string {
  return window.localStorage.getItem(CLUB_KEY) ?? (CLUBS[0]?.id as string);
}

/**
 * M6 — transferências: clubes desbloqueados pelo tier de fãs (do servidor
 * quando a API está disponível; senão assume Amador). Cosmético no MVP.
 */
export class TransferScene extends Phaser.Scene {
  constructor() {
    super('transfer');
  }

  create(): void {
    this.add.rectangle(0, 0, FIELD_WIDTH, FIELD_HEIGHT, 0x10141a).setOrigin(0);
    this.add
      .text(FIELD_WIDTH / 2, 50, 'TRANSFERÊNCIAS', {
        fontSize: '38px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const back = this.add
      .rectangle(90, 50, 150, 56, 0x263238)
      .setStrokeStyle(2, 0xffffff, 0.5)
      .setInteractive();
    this.add.text(90, 50, '◀ MAPA', { fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);
    back.on(Phaser.Input.Events.POINTER_DOWN, () => this.scene.start('map'));

    void this.loadTier().then((tier) => this.renderClubs(tier));
  }

  private async loadTier(): Promise<FanTier> {
    if (apiClient.available && (await apiClient.ensureSession())) {
      const me = await apiClient.me();
      if (me) return tierForFans(me.fans);
    }
    return tierForFans(500);
  }

  private renderClubs(tier: FanTier): void {
    this.add
      .text(FIELD_WIDTH / 2, 110, `Seu alcance: ${tier.name}`, {
        fontSize: '24px',
        color: '#90a4ae',
      })
      .setOrigin(0.5);

    const tierIdx = (id: string): number =>
      ['amador', 'local', 'regional', 'nacional', 'global'].indexOf(id);
    const selected = currentClubId();

    CLUBS.forEach((club, i) => {
      const y = 190 + i * 100;
      const eligible = tierIdx(club.minTier) <= tierIdx(tier.id);
      const isCurrent = club.id === selected;

      const bg = this.add
        .rectangle(FIELD_WIDTH / 2, y, FIELD_WIDTH - 80, 84, club.color, eligible ? 0.35 : 0.1)
        .setStrokeStyle(isCurrent ? 4 : 2, isCurrent ? 0xffd740 : club.color, eligible ? 1 : 0.4);
      this.add
        .text(120, y, club.name, {
          fontSize: '26px',
          color: eligible ? '#ffffff' : '#546e7a',
        })
        .setOrigin(0, 0.5);
      this.add
        .text(
          FIELD_WIDTH - 120,
          y,
          isCurrent ? 'SEU CLUBE' : eligible ? 'ASSINAR' : `tier ${club.minTier}`,
          {
            fontSize: '20px',
            color: isCurrent ? '#ffd740' : eligible ? '#b9f6ca' : '#546e7a',
          },
        )
        .setOrigin(1, 0.5);

      if (eligible && !isCurrent) {
        bg.setInteractive();
        bg.on(Phaser.Input.Events.POINTER_DOWN, () => {
          sound.click();
          window.localStorage.setItem(CLUB_KEY, club.id);
          this.scene.restart();
        });
      }
    });
  }
}
