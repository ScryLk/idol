import { Queue, Worker } from 'bullmq';
import type { PrismaClient } from '@prisma/client';
import { computeLives, LIVES_MAX } from '@idol/shared';
import type { Env } from '../env.js';

/**
 * Jobs BullMQ do meta-jogo. A regeneração de vidas é calculada de forma LAZY
 * nas leituras (fonte de verdade: computeLives em shared); o job em lote só
 * materializa o valor no banco para consultas frias/rankings. Filas de decay
 * de fãs e expiração de contratos entram quando essas regras forem ativadas.
 */

export const LIVES_REGEN_QUEUE = 'lives-regen-batch';

export interface JobsHandle {
  close(): Promise<void>;
}

export async function startJobs(env: Env, prisma: PrismaClient): Promise<JobsHandle> {
  const url = new URL(env.REDIS_URL);
  const connection = {
    host: url.hostname,
    port: Number(url.port || 6379),
    maxRetriesPerRequest: null,
  };

  const queue = new Queue(LIVES_REGEN_QUEUE, { connection });
  await queue.upsertJobScheduler(LIVES_REGEN_QUEUE, { every: 5 * 60_000 });

  const worker = new Worker(
    LIVES_REGEN_QUEUE,
    async () => {
      const now = Date.now();
      const stale = await prisma.playerProfile.findMany({
        where: { lives: { lt: LIVES_MAX } },
        select: { userId: true, lives: true, livesUpdatedAt: true },
      });
      for (const p of stale) {
        const next = computeLives({ lives: p.lives, updatedAtMs: p.livesUpdatedAt.getTime() }, now);
        if (next.lives !== p.lives) {
          await prisma.playerProfile.update({
            where: { userId: p.userId },
            data: { lives: next.lives, livesUpdatedAt: new Date(next.updatedAtMs) },
          });
        }
      }
      return { updated: stale.length };
    },
    { connection },
  );

  return {
    async close(): Promise<void> {
      await worker.close();
      await queue.close();
    },
  };
}
