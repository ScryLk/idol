import {
  spinDribble,
  type DribbleContext,
  type DribbleOutcome,
  type DribbleSpinResult,
  type Rng,
} from '@idol/shared';

/**
 * Serviço da Roleta de Drible — O SORTEIO RODA AQUI, NO SERVIDOR (antifraude
 * desde o dia 1). O cliente apenas anima o resultado. O RNG é injetado e
 * seedável para testes determinísticos.
 */

export interface DribbleProfile {
  dribble: number;
  fatigue: number;
  pity: number;
  chain: number;
  fans: number;
}

export interface SpinCommit {
  userId: string;
  levelId: string | null;
  defense: number;
  ctx: DribbleContext;
  /** Fãs do perfil ANTES do giro (para aplicar o delta com piso). */
  fansBefore: number;
  result: DribbleSpinResult;
}

/** Porta de persistência — implementação Prisma em produção, memória em teste. */
export interface DribbleRepo {
  getProfile(userId: string): Promise<DribbleProfile | null>;
  commitSpin(commit: SpinCommit): Promise<void>;
}

export interface SpinPayload {
  outcome: DribbleOutcome;
  roll: number;
  chance: number;
  perfectZone: number;
  fans: number;
  pityAfter: number;
  chainAfter: number;
  /** Cadeia na ENTRADA do giro — o cliente usa para velocidade/multiplicador. */
  chainBefore: number;
}

export class DribbleService {
  constructor(
    private readonly repo: DribbleRepo,
    private readonly rng: Rng,
  ) {}

  /** Retorna null se o usuário não tem perfil. */
  async spin(userId: string, defense: number, levelId?: string): Promise<SpinPayload | null> {
    const profile = await this.repo.getProfile(userId);
    if (!profile) return null;

    const ctx: DribbleContext = {
      dribble: profile.dribble,
      defense,
      fatigue: profile.fatigue,
      pity: profile.pity,
      chain: profile.chain,
    };
    const result = spinDribble(ctx, this.rng);

    await this.repo.commitSpin({
      userId,
      levelId: levelId ?? null,
      defense,
      ctx,
      fansBefore: profile.fans,
      result,
    });

    return {
      outcome: result.outcome,
      roll: result.roll,
      chance: result.chance,
      perfectZone: result.perfectZone,
      fans: result.fans,
      pityAfter: result.nextPity,
      chainAfter: result.nextChain,
      chainBefore: ctx.chain,
    };
  }
}

/** Repositório em memória para testes de integração e distribuição. */
export class InMemoryDribbleRepo implements DribbleRepo {
  private readonly profiles = new Map<string, DribbleProfile>();
  readonly spins: SpinCommit[] = [];

  seedProfile(userId: string, profile: DribbleProfile): void {
    this.profiles.set(userId, { ...profile });
  }

  getProfileSync(userId: string): DribbleProfile | undefined {
    return this.profiles.get(userId);
  }

  getProfile(userId: string): Promise<DribbleProfile | null> {
    const p = this.profiles.get(userId);
    return Promise.resolve(p ? { ...p } : null);
  }

  commitSpin(commit: SpinCommit): Promise<void> {
    const p = this.profiles.get(commit.userId);
    if (!p) return Promise.reject(new Error('perfil sumiu no commit'));
    p.pity = commit.result.nextPity;
    p.chain = commit.result.nextChain;
    p.fans = Math.max(500, commit.fansBefore + commit.result.fans);
    this.spins.push(commit);
    return Promise.resolve();
  }
}
