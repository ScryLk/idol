import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createRng } from '@idol/shared';
import type { Env } from './env.js';
import { registerDribbleRoutes } from './gameplay/dribbleRoutes.js';
import { DribbleService } from './gameplay/dribbleService.js';
import { PrismaDribbleRepo } from './gameplay/prismaDribbleRepo.js';

export interface AppDeps {
  dribbleService: DribbleService;
}

function buildBareApp(env: Env) {
  return Fastify({ logger: env.NODE_ENV !== 'test' }).withTypeProvider<ZodTypeProvider>();
}

export type App = ReturnType<typeof buildBareApp>;

export function buildApp(env: Env, deps?: Partial<AppDeps>): App {
  const app = buildBareApp(env);

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  void app.register(cors, { origin: true });

  app.route({
    method: 'GET',
    url: '/health',
    schema: {
      response: {
        200: z.object({
          status: z.literal('ok'),
          uptime: z.number(),
        }),
      },
    },
    handler: async () => ({ status: 'ok' as const, uptime: process.uptime() }),
  });

  const dribbleService =
    deps?.dribbleService ??
    new DribbleService(
      new PrismaDribbleRepo(new PrismaClient()),
      // seed imprevisível em produção; testes injetam serviço com seed fixa
      createRng((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0),
    );

  registerDribbleRoutes(app, dribbleService);

  return app;
}
