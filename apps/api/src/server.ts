import { PrismaClient } from '@prisma/client';
import { buildApp } from './app.js';
import { loadEnv } from './env.js';
import { startJobs } from './jobs/index.js';

const env = loadEnv();
const app = buildApp(env);

async function main(): Promise<void> {
  // jobs antes do listen (onClose só pode ser registrado antes de escutar)
  try {
    const jobs = await startJobs(env, new PrismaClient());
    app.addHook('onClose', async () => jobs.close());
    app.log.info('jobs BullMQ ativos (regeneração de vidas em lote)');
  } catch (err) {
    app.log.warn({ err }, 'BullMQ indisponível — seguindo sem jobs (regen lazy continua)');
  }

  const address = await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(`IDOL API no ar em ${address}`);
}

main().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
