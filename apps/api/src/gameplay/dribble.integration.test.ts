import { beforeAll, describe, expect, it } from 'vitest';
import {
  createRng,
  dribbleChance,
  nextChain,
  nextPity,
  perfectZone,
  spinDribble,
  type DribbleContext,
} from '@idol/shared';
import { buildApp, type App } from '../app.js';
import { loadEnv } from '../env.js';
import { DribbleService, InMemoryDribbleRepo } from './dribbleService.js';

const USER = '11111111-1111-4111-8111-111111111111';
const SEED = 2026;
const N = 10_000;

const baseProfile = { dribble: 60, fatigue: 10, pity: 0, chain: 0, fans: 500 };
const DEFENSE = 45;

function makeService(): { service: DribbleService; repo: InMemoryDribbleRepo } {
  const repo = new InMemoryDribbleRepo();
  repo.seedProfile(USER, { ...baseProfile });
  return { service: new DribbleService(repo, createRng(SEED)), repo };
}

describe('DoD M3 — distribuição estatística em 10k giros com seed', () => {
  const counts = { perfect: 0, success: 0, failure: 0 };
  let expectedChanceSum = 0;
  let expectedZoneSum = 0;
  let repo: InMemoryDribbleRepo;

  beforeAll(async () => {
    const made = makeService();
    repo = made.repo;

    // Referência independente: mesmas fórmulas de @idol/shared, mesma seed,
    // evoluindo pity/cadeia — o serviço DEVE reproduzir esta sequência exata.
    const refRng = createRng(SEED);
    let refCtx: DribbleContext = { ...baseProfile, defense: DEFENSE };

    for (let i = 0; i < N; i++) {
      const expected = spinDribble(refCtx, refRng);
      expectedChanceSum += dribbleChance(refCtx);
      expectedZoneSum += perfectZone(dribbleChance(refCtx), refCtx.dribble);

      const actual = await made.service.spin(USER, DEFENSE);
      expect(actual).not.toBeNull();
      if (!actual) throw new Error('spin retornou null');

      // igualdade exata giro a giro (determinismo servidor = fórmulas canônicas)
      expect(actual.outcome).toBe(expected.outcome);
      expect(actual.roll).toBe(expected.roll);
      expect(actual.fans).toBe(expected.fans);
      expect(actual.pityAfter).toBe(expected.nextPity);
      expect(actual.chainAfter).toBe(expected.nextChain);

      counts[actual.outcome]++;
      refCtx = {
        ...refCtx,
        pity: nextPity(refCtx.pity, expected.outcome),
        chain: nextChain(refCtx.chain, expected.outcome),
      };
    }
  });

  it('taxa de sucesso total bate com a chance média analítica (±1.5pp)', () => {
    const successRate = ((counts.perfect + counts.success) / N) * 100;
    const expectedRate = expectedChanceSum / N;
    expect(Math.abs(successRate - expectedRate)).toBeLessThan(1.5);
  });

  it('taxa de perfeito bate com a zona perfeita média analítica (±1.5pp)', () => {
    const perfectRate = (counts.perfect / N) * 100;
    const expectedRate = expectedZoneSum / N;
    expect(Math.abs(perfectRate - expectedRate)).toBeLessThan(1.5);
  });

  it('todos os resultados aparecem em volume plausível', () => {
    expect(counts.perfect).toBeGreaterThan(N * 0.05);
    expect(counts.success).toBeGreaterThan(N * 0.2);
    expect(counts.failure).toBeGreaterThan(N * 0.2);
  });

  it('pity nunca estoura o teto e zera após sucesso; cadeia coerente', () => {
    let pity = 0;
    let chain = 0;
    for (const spin of repo.spins) {
      expect(spin.ctx.pity).toBe(pity);
      expect(spin.ctx.chain).toBe(chain);
      pity = spin.result.nextPity;
      chain = spin.result.nextChain;
      expect(pity).toBeLessThanOrEqual(20);
      if (spin.result.outcome !== 'failure') expect(spin.result.nextPity).toBe(0);
      if (spin.result.outcome !== 'perfect') expect(spin.result.nextChain).toBe(0);
    }
  });

  it('10k giros foram persistidos e os fãs respeitam o piso de 500', () => {
    expect(repo.spins).toHaveLength(N);
    const profile = repo.getProfileSync(USER);
    expect(profile).toBeDefined();
    expect(profile?.fans ?? 0).toBeGreaterThanOrEqual(500);
  });
});

describe('POST /gameplay/dribble', () => {
  let app: App;
  let repo: InMemoryDribbleRepo;

  beforeAll(async () => {
    repo = new InMemoryDribbleRepo();
    repo.seedProfile(USER, { ...baseProfile });
    app = buildApp(
      loadEnv({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://idol:idol@localhost:5432/idol',
        REDIS_URL: 'redis://localhost:6379',
        JWT_SECRET: 'a'.repeat(32),
      }),
      { dribbleService: new DribbleService(repo, createRng(7)) },
    );
    await app.ready();
    return async () => app.close();
  });

  it('gira e devolve payload validado pelo schema', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/gameplay/dribble',
      payload: { userId: USER, defense: 45 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ outcome: string; chance: number; fans: number }>();
    expect(['perfect', 'success', 'failure']).toContain(body.outcome);
    expect(body.chance).toBeGreaterThanOrEqual(5);
    expect(body.chance).toBeLessThanOrEqual(95);
  });

  it('404 para usuário sem perfil', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/gameplay/dribble',
      payload: { userId: '22222222-2222-4222-8222-222222222222', defense: 45 },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'user_not_found' });
  });

  it('400 para corpo inválido (defense fora do range, userId não-uuid)', async () => {
    const bad1 = await app.inject({
      method: 'POST',
      url: '/gameplay/dribble',
      payload: { userId: USER, defense: 999 },
    });
    expect(bad1.statusCode).toBe(400);

    const bad2 = await app.inject({
      method: 'POST',
      url: '/gameplay/dribble',
      payload: { userId: 'nope', defense: 45 },
    });
    expect(bad2.statusCode).toBe(400);
  });
});
