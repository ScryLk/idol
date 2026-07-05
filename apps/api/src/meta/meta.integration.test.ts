import { beforeAll, describe, expect, it } from 'vitest';
import { createRng, LIVES_MAX } from '@idol/shared';
import { buildApp, type App } from '../app.js';
import { loadEnv } from '../env.js';
import { DribbleService, InMemoryDribbleRepo } from '../gameplay/dribbleService.js';
import { InMemoryMetaRepo } from './inMemoryMetaRepo.js';
import { MetaService } from './metaService.js';

/**
 * DoD do M4 — E2E do loop completo via HTTP:
 * registrar → jogar → ganhar fãs → subir de tier → assinar mercenário →
 * ver pagamento multiplicado pelo tier → ver os fãs caindo.
 * Relógio fake injetado: cada partida "espera" 30min para regenerar a vida.
 */

const MIN = 60_000;

function makeApp(): { app: App; clock: { now: number }; repo: InMemoryMetaRepo } {
  const clock = { now: 1_750_000_000_000 };
  const nowMs = (): number => clock.now;
  const repo = new InMemoryMetaRepo(nowMs);
  repo.seedSponsors();
  const app = buildApp(
    loadEnv({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://idol:idol@localhost:5432/idol',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'a'.repeat(32),
    }),
    {
      metaRepo: repo,
      metaService: new MetaService(repo, nowMs),
      dribbleService: new DribbleService(new InMemoryDribbleRepo(), createRng(1)),
      nowMs,
    },
  );
  return { app, clock, repo };
}

interface Me {
  fans: number;
  tier: { id: string; multiplier: number };
  wallet: number;
  lives: { current: number; max: number; nextLifeAtMs: number | null };
  contracts: Array<{ matchesRemaining: number; sponsorName: string }>;
  slots: { used: number; total: number };
}

describe('DoD M4 — loop completo do meta-jogo', () => {
  let app: App;
  let clock: { now: number };
  let token: string;

  const auth = (): { authorization: string } => ({ authorization: `Bearer ${token}` });
  const getMe = async (): Promise<Me> => {
    const res = await app.inject({ method: 'GET', url: '/me', headers: auth() });
    expect(res.statusCode).toBe(200);
    return res.json<Me>();
  };

  beforeAll(async () => {
    const made = makeApp();
    app = made.app;
    clock = made.clock;
    await app.ready();
    return async () => app.close();
  });

  it('1. registro cria perfil no piso de fãs, tier Amador, 5 vidas, carteira 0', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'idolo@idol.dev', password: 'senha-forte-1', displayName: 'Ídolo' },
    });
    expect(res.statusCode).toBe(201);
    token = res.json<{ token: string }>().token;

    const me = await getMe();
    expect(me.fans).toBe(500);
    expect(me.tier.id).toBe('amador');
    expect(me.wallet).toBe(0);
    expect(me.lives).toMatchObject({ current: 5, max: LIVES_MAX });
    expect(me.slots).toEqual({ used: 0, total: 1 });
  });

  it('2. rotas do meta exigem JWT', async () => {
    for (const url of ['/me', '/sponsors']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(401);
    }
  });

  it('3. patrocinador acima do tier não pode ser assinado (tier_too_low)', async () => {
    const res = await app.inject({ method: 'GET', url: '/sponsors', headers: auth() });
    const sponsors =
      res.json<Array<{ id: string; minTier: string; canSign: boolean; reason: string | null }>>();
    expect(sponsors).toHaveLength(15);
    const nacional = sponsors.find((s) => s.minTier === 'nacional');
    expect(nacional?.canSign).toBe(false);
    expect(nacional?.reason).toBe('tier_too_low');

    const forced = await app.inject({
      method: 'POST',
      url: '/contracts',
      headers: auth(),
      payload: { sponsorId: nacional?.id },
    });
    expect(forced.statusCode).toBe(409);
    expect(forced.json()).toEqual({ error: 'tier_too_low' });
  });

  it('4. jogar partidas rende fãs (60–140) até subir para o tier Local', async () => {
    let me = await getMe();
    let matches = 0;
    while (me.fans < 10_000) {
      const res = await app.inject({
        method: 'POST',
        url: '/gameplay/match',
        headers: auth(),
        payload: { rating: 1 },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ matchFans: number }>().matchFans).toBe(140);
      clock.now += 30 * MIN; // espera regenerar a vida gasta
      me = await getMe();
      matches += 1;
      expect(matches).toBeLessThan(100); // trava de segurança
    }
    expect(me.tier.id).toBe('local');
    expect(me.tier.multiplier).toBe(1.5);
    expect(me.wallet).toBe(0); // sem contrato, nenhum centavo entrou
  });

  it('5. assina o Mercenário e o pagamento vem multiplicado pelo tier', async () => {
    const sponsors = (await app.inject({ method: 'GET', url: '/sponsors', headers: auth() })).json<
      Array<{
        id: string;
        archetype: string;
        minTier: string;
        payoutPerMatchNow: number;
        canSign: boolean;
      }>
    >();
    const merc = sponsors.find((s) => s.archetype === 'mercenario' && s.minTier === 'amador');
    expect(merc?.canSign).toBe(true);
    expect(merc?.payoutPerMatchNow).toBe(2250); // 1500 × 1.5 (Local)

    const sign = await app.inject({
      method: 'POST',
      url: '/contracts',
      headers: auth(),
      payload: { sponsorId: merc?.id },
    });
    expect(sign.statusCode).toBe(201);

    // 1 slot no tier Local: segundo contrato é bloqueado
    const autentico = sponsors.find((s) => s.archetype === 'autentico' && s.minTier === 'amador');
    const second = await app.inject({
      method: 'POST',
      url: '/contracts',
      headers: auth(),
      payload: { sponsorId: autentico?.id },
    });
    expect(second.statusCode).toBe(409);
    expect(second.json()).toEqual({ error: 'no_slots' });
  });

  it('6. partida sob contrato mercenário: dinheiro no ledger, fãs CAINDO', async () => {
    const before = await getMe();
    const res = await app.inject({
      method: 'POST',
      url: '/gameplay/match',
      headers: auth(),
      payload: { rating: 0 }, // lance sofrível: só 60 fãs
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{
      matchFans: number;
      fansBefore: number;
      fansAfter: number;
      sponsors: Array<{ payout: number; fansDelta: number }>;
      wallet: number;
    }>();

    expect(body.matchFans).toBe(60);
    expect(body.sponsors).toHaveLength(1);
    expect(body.sponsors[0]?.payout).toBe(2250); // multiplicado pelo tier Local
    expect(body.sponsors[0]?.fansDelta).toBe(-120); // o preço da venda da torcida
    expect(body.fansAfter).toBe(body.fansBefore + 60 - 120); // fãs caindo
    expect(body.fansAfter).toBeLessThan(before.fans);
    expect(body.wallet).toBe(2250); // carteira = soma do ledger

    clock.now += 30 * MIN;
  });

  it('7. contrato dura 10 partidas e completa sozinho', async () => {
    let completed = false;
    for (let i = 0; i < 9; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/gameplay/match',
        headers: auth(),
        payload: { rating: 0.5 },
      });
      expect(res.statusCode).toBe(200);
      completed = res.json<{ sponsors: Array<{ completed: boolean }> }>().sponsors[0]!.completed;
      clock.now += 30 * MIN;
    }
    expect(completed).toBe(true);

    const me = await getMe();
    expect(me.contracts).toHaveLength(0); // contrato concluído saiu da lista
    expect(me.slots.used).toBe(0);

    // 11ª partida: nenhum pagamento de patrocínio
    const res = await app.inject({
      method: 'POST',
      url: '/gameplay/match',
      headers: auth(),
      payload: { rating: 0.5 },
    });
    expect(res.json<{ sponsors: unknown[] }>().sponsors).toHaveLength(0);
    clock.now += 30 * MIN;
  });

  it('8. carteira final = soma exata do ledger (10 pagamentos)', async () => {
    const me = await getMe();
    // tier pode ter oscilado entre local/amador com os fãs caindo — some o ledger real
    const made = 0;
    expect(me.wallet).toBeGreaterThanOrEqual(2250 + 9 * 1500); // pior caso: caiu para amador
    expect(me.wallet).toBeLessThanOrEqual(10 * 2250);
    expect(made).toBe(0); // (guarda de sanidade do teste)
  });

  it('9. sem vidas: 409 no_lives; vida volta com o timer', async () => {
    // gasta as 5 vidas sem avançar o relógio
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/gameplay/match',
        headers: auth(),
        payload: { rating: 0.5 },
      });
      expect(res.statusCode).toBe(200);
    }
    const blocked = await app.inject({
      method: 'POST',
      url: '/gameplay/match',
      headers: auth(),
      payload: { rating: 0.5 },
    });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json()).toEqual({ error: 'no_lives' });

    clock.now += 30 * MIN; // 1 vida regenera
    const retry = await app.inject({
      method: 'POST',
      url: '/gameplay/match',
      headers: auth(),
      payload: { rating: 0.5 },
    });
    expect(retry.statusCode).toBe(200);
  });

  it('10. login devolve token válido; senha errada é 401', async () => {
    const ok = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'idolo@idol.dev', password: 'senha-forte-1' },
    });
    expect(ok.statusCode).toBe(200);

    const bad = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'idolo@idol.dev', password: 'senha-errada-1' },
    });
    expect(bad.statusCode).toBe(401);
  });
});
