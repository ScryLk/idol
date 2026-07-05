import type { PrismaClient } from '@prisma/client';
import { applyFanDelta } from '@idol/shared';
import type { DribbleProfile, DribbleRepo, SpinCommit } from './dribbleService.js';

const OUTCOME_TO_DB = {
  perfect: 'PERFECT',
  success: 'SUCCESS',
  failure: 'FAILURE',
} as const;

/**
 * Persistência da roleta: numa única transação atualiza pity/cadeia/fãs do
 * perfil, registra o evento de fãs (auditável) e loga o giro (antifraude).
 */
export class PrismaDribbleRepo implements DribbleRepo {
  constructor(private readonly prisma: PrismaClient) {}

  async getProfile(userId: string): Promise<DribbleProfile | null> {
    const p = await this.prisma.playerProfile.findUnique({ where: { userId } });
    if (!p) return null;
    return {
      dribble: p.dribble,
      fatigue: p.fatigue,
      pity: p.dribblePity,
      chain: p.dribbleChain,
      fans: p.fans,
    };
  }

  async commitSpin(commit: SpinCommit): Promise<void> {
    const { userId, result } = commit;
    const newFans = applyFanDelta(commit.fansBefore, result.fans);

    await this.prisma.$transaction([
      this.prisma.playerProfile.update({
        where: { userId },
        data: {
          dribblePity: result.nextPity,
          dribbleChain: result.nextChain,
          fans: newFans,
        },
      }),
      ...(result.fans !== 0
        ? [
            this.prisma.fanEvent.create({
              data: {
                userId,
                delta: result.fans,
                type: 'DRIBBLE',
                reference: commit.levelId,
              },
            }),
          ]
        : []),
      this.prisma.dribbleSpin.create({
        data: {
          userId,
          levelId: commit.levelId,
          outcome: OUTCOME_TO_DB[result.outcome],
          roll: result.roll,
          chance: result.chance,
          perfectZone: result.perfectZone,
          fansAwarded: result.fans,
          pityBefore: commit.ctx.pity,
          chainBefore: commit.ctx.chain,
        },
      }),
    ]);
  }
}
