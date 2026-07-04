import cors from '@fastify/cors';
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Env } from './env.js';

export function buildApp(env: Env) {
  const app = Fastify({
    logger: env.NODE_ENV !== 'test',
  }).withTypeProvider<ZodTypeProvider>();

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

  return app;
}

export type App = ReturnType<typeof buildApp>;
