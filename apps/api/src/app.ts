import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
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
import { MetaService } from './meta/metaService.js';
import { PrismaMetaRepo } from './meta/prismaMetaRepo.js';
import type { MetaRepo } from './meta/repo.js';
import { registerMetaRoutes } from './meta/routes.js';

export interface AppDeps {
  dribbleService: DribbleService;
  metaService: MetaService;
  metaRepo: MetaRepo;
  /** Relógio injetável — testes usam clock fake. */
  nowMs: () => number;
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
  void app.register(jwt, { secret: env.JWT_SECRET });

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

  const nowMs = deps?.nowMs ?? (() => Date.now());
  const prisma = new PrismaClient();

  const dribbleService =
    deps?.dribbleService ??
    new DribbleService(
      new PrismaDribbleRepo(prisma),
      // seed imprevisível em produção; testes injetam serviço com seed fixa
      createRng((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0),
    );

  const metaRepo = deps?.metaRepo ?? new PrismaMetaRepo(prisma);
  const metaService = deps?.metaService ?? new MetaService(metaRepo, nowMs);

  registerDribbleRoutes(app, dribbleService);
  registerMetaRoutes(app, metaService, metaRepo);

  return app;
}
