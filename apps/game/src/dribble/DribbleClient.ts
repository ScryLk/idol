import {
  createRng,
  spinDribble,
  type DribbleContext,
  type DribbleOutcome,
  type Rng,
} from '@idol/shared';

/** Atributo de drible do herói até o perfil real chegar do servidor (M4). */
export const HERO_DRIBBLE = 50;

export interface DribbleSessionState {
  pity: number;
  chain: number;
}

export interface SpinView {
  outcome: DribbleOutcome;
  roll: number;
  chance: number;
  perfectZone: number;
  fans: number;
  chainBefore: number;
  pityAfter: number;
  chainAfter: number;
  /** De onde veio o sorteio: 'server' (produção) ou 'local' (dev/E2E). */
  source: 'server' | 'local';
}

/**
 * O sorteio OFICIAL roda no servidor (POST /gameplay/dribble) — o cliente só
 * anima. O fallback local (mesmas fórmulas de @idol/shared, RNG seedável via
 * ?seed=) existe para dev sem API e para E2E determinístico; ele nunca deve
 * ser a fonte de verdade de fãs/economia.
 */
export class DribbleClient {
  private readonly rng: Rng;
  private readonly apiUrl: string | undefined;
  private readonly userId: string | undefined;

  constructor(options: { seed?: number; apiUrl?: string; userId?: string } = {}) {
    this.rng = createRng(options.seed ?? (Math.random() * 0xffffffff) >>> 0);
    this.apiUrl = options.apiUrl;
    this.userId = options.userId;
  }

  async spin(defense: number, state: DribbleSessionState): Promise<SpinView> {
    if (this.apiUrl && this.userId) {
      try {
        const res = await fetch(`${this.apiUrl}/gameplay/dribble`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ userId: this.userId, defense }),
        });
        if (res.ok) {
          const body = (await res.json()) as Omit<SpinView, 'source'>;
          return { ...body, source: 'server' };
        }
      } catch {
        // sem rede/API: cai para o fallback local de dev
      }
    }

    const ctx: DribbleContext = {
      dribble: HERO_DRIBBLE,
      defense,
      fatigue: 0,
      pity: state.pity,
      chain: state.chain,
    };
    const r = spinDribble(ctx, this.rng);
    return {
      outcome: r.outcome,
      roll: r.roll,
      chance: r.chance,
      perfectZone: r.perfectZone,
      fans: r.fans,
      chainBefore: ctx.chain,
      pityAfter: r.nextPity,
      chainAfter: r.nextChain,
      source: 'local',
    };
  }
}
