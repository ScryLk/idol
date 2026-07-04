import { buildApp } from './app.js';
import { loadEnv } from './env.js';

const env = loadEnv();
const app = buildApp(env);

app
  .listen({ port: env.PORT, host: env.HOST })
  .then((address) => {
    app.log.info(`IDOL API no ar em ${address}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
