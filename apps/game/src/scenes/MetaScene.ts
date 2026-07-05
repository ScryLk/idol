import Phaser from 'phaser';
import { FIELD_HEIGHT, FIELD_WIDTH } from '@idol/shared';
import { apiClient, type MeView, type SponsorView } from '../api/ApiClient.js';

const ARCHETYPE_COLOR: Record<string, number> = {
  autentico: 0x2e7d32,
  equilibrado: 0x1565c0,
  mercenario: 0xb71c1c,
};

const REASON_LABEL: Record<string, string> = {
  tier_too_low: 'tier insuficiente',
  no_slots: 'sem slot livre',
  duplicate_contract: 'já contratado',
};

/**
 * M4 — tela de contratos: fãs/tier/carteira/vidas + os 3 arquétipos de
 * patrocínio com o trade-off explícito (fãs/partida vs $/partida no tier
 * atual). Toda regra é do servidor; esta tela só lista e assina.
 */
export class MetaScene extends Phaser.Scene {
  constructor() {
    super('meta');
  }

  create(): void {
    this.add.rectangle(0, 0, FIELD_WIDTH, FIELD_HEIGHT, 0x10141a).setOrigin(0);
    this.add
      .text(FIELD_WIDTH / 2, 40, 'CARREIRA — PATROCÍNIOS', {
        fontSize: '36px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const back = this.add
      .rectangle(90, 40, 140, 56, 0x263238)
      .setStrokeStyle(2, 0xffffff, 0.5)
      .setInteractive();
    this.add.text(90, 40, '◀ JOGAR', { fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);
    back.on(Phaser.Input.Events.POINTER_DOWN, () => this.scene.start('level'));

    void this.loadData();
  }

  private async loadData(): Promise<void> {
    const status = this.add
      .text(FIELD_WIDTH / 2, 200, 'Conectando…', { fontSize: '28px', color: '#90a4ae' })
      .setOrigin(0.5);

    const ok = await apiClient.ensureSession();
    if (!ok) {
      status.setText(
        'Meta-jogo offline.\nSuba a API (docker compose up) e configure\nVITE_API_URL=http://localhost:3000',
      );
      status.setAlign('center');
      return;
    }

    const [me, sponsors] = await Promise.all([apiClient.me(), apiClient.sponsors()]);
    if (!me || !sponsors) {
      status.setText('Falha ao carregar o meta-jogo.');
      return;
    }
    status.destroy();
    this.renderHeader(me);
    this.renderSponsors(me, sponsors);
  }

  private renderHeader(me: MeView): void {
    const lines = [
      `${me.displayName} — ${me.tier.name} (x${me.tier.multiplier})`,
      `Fãs: ${me.fans.toLocaleString('pt-BR')}   $ ${me.wallet.toLocaleString('pt-BR')}   Vidas: ${me.lives.current}/${me.lives.max}`,
      `Contratos: ${me.slots.used}/${me.slots.total}` +
        (me.contracts.length > 0
          ? ` — ${me.contracts.map((c) => `${c.sponsorName} (${c.matchesRemaining} part.)`).join(', ')}`
          : ''),
    ];
    this.add.text(40, 90, lines.join('\n'), {
      fontSize: '24px',
      color: '#eceff1',
      lineSpacing: 8,
      wordWrap: { width: FIELD_WIDTH - 80 },
    });
  }

  private renderSponsors(me: MeView, sponsors: SponsorView[]): void {
    let y = 260;
    for (const s of sponsors) {
      const row = this.add.container(FIELD_WIDTH / 2, y);
      const bg = this.add
        .rectangle(0, 0, FIELD_WIDTH - 60, 58, ARCHETYPE_COLOR[s.archetype] ?? 0x37474f, 0.25)
        .setStrokeStyle(2, ARCHETYPE_COLOR[s.archetype] ?? 0xffffff, 0.8);
      const label = this.add
        .text(
          -(FIELD_WIDTH - 60) / 2 + 16,
          0,
          `${s.name}  ·  ${s.fansPerMatch >= 0 ? '+' : ''}${s.fansPerMatch} fãs/part.  ·  $${s.payoutPerMatchNow}/part.`,
          { fontSize: '21px', color: '#ffffff' },
        )
        .setOrigin(0, 0.5);
      row.add([bg, label]);

      if (s.canSign) {
        const btn = this.add
          .rectangle((FIELD_WIDTH - 60) / 2 - 80, 0, 140, 44, 0xffd740)
          .setInteractive();
        const btnText = this.add
          .text((FIELD_WIDTH - 60) / 2 - 80, 0, 'ASSINAR', {
            fontSize: '20px',
            fontStyle: 'bold',
            color: '#1a1a1a',
          })
          .setOrigin(0.5);
        btn.on(Phaser.Input.Events.POINTER_DOWN, async () => {
          const result = await apiClient.signContract(s.id);
          if (result) this.scene.restart();
        });
        row.add([btn, btnText]);
      } else {
        const why = this.add
          .text((FIELD_WIDTH - 60) / 2 - 80, 0, REASON_LABEL[s.reason ?? ''] ?? '', {
            fontSize: '18px',
            color: '#78909c',
          })
          .setOrigin(0.5);
        row.add(why);
      }

      y += 64;
    }
  }
}
