import { z } from 'zod';
import type { App } from '../app.js';
import type { DribbleService } from './dribbleService.js';

export const DribbleRequest = z.object({
  userId: z.string().uuid(),
  /** Atributo de defesa do marcador da oportunidade (vem do LevelScript). */
  defense: z.number().min(0).max(200),
  levelId: z.string().uuid().optional(),
});

export const DribbleResponse = z.object({
  outcome: z.enum(['perfect', 'success', 'failure']),
  roll: z.number(),
  chance: z.number(),
  perfectZone: z.number(),
  fans: z.number().int(),
  pityAfter: z.number().int(),
  chainAfter: z.number().int(),
  chainBefore: z.number().int(),
});

const NotFound = z.object({ error: z.literal('user_not_found') });

export function registerDribbleRoutes(app: App, service: DribbleService): void {
  app.route({
    method: 'POST',
    url: '/gameplay/dribble',
    schema: {
      body: DribbleRequest,
      response: { 200: DribbleResponse, 404: NotFound },
    },
    handler: async (request, reply) => {
      const { userId, defense, levelId } = request.body;
      const result = await service.spin(userId, defense, levelId);
      if (!result) {
        return reply.status(404).send({ error: 'user_not_found' as const });
      }
      return result;
    },
  });
}
