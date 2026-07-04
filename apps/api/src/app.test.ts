import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, type App } from './app.js';
import { loadEnv } from './env.js';

describe('GET /health', () => {
  let app: App;

  beforeAll(async () => {
    const env = loadEnv({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://idol:idol@localhost:5432/idol',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'a'.repeat(32),
    });
    app = buildApp(env);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde ok com uptime', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ status: string; uptime: number }>();
    expect(body.status).toBe('ok');
    expect(body.uptime).toBeGreaterThan(0);
  });
});
