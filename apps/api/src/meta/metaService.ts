import {
  applyFanDelta,
  computeLives,
  consumeLife,
  CONTRACT_DURATION_MATCHES,
  FAN_TIERS,
  LIVES_MAX,
  matchPerformanceFans,
  nextLifeAtMs,
  sponsorPayout,
  sponsorSlots,
  tierForFans,
  type FanTier,
} from '@idol/shared';
import type { ContractRecord, MetaRepo, ProfileRecord, SponsorRecord } from './repo.js';

export type MetaErrorCode =
  | 'user_not_found'
  | 'sponsor_not_found'
  | 'tier_too_low'
  | 'no_slots'
  | 'duplicate_contract'
  | 'no_lives';

export class MetaError extends Error {
  constructor(readonly code: MetaErrorCode) {
    super(code);
  }
}

export interface MeView {
  displayName: string;
  fans: number;
  tier: { id: string; name: string; multiplier: number };
  wallet: number;
  lives: { current: number; max: number; nextLifeAtMs: number | null };
  attributes: { dribble: number; passing: number; finish: number; fatigue: number };
  contracts: Array<{
    id: string;
    sponsorName: string;
    archetype: string;
    matchesRemaining: number;
    fansPerMatch: number;
    payoutPerMatchNow: number;
  }>;
  slots: { used: number; total: number };
}

export interface SponsorView {
  id: string;
  name: string;
  archetype: string;
  minTier: string;
  fansPerMatch: number;
  basePayPerMatch: number;
  /** Pagamento por partida no tier ATUAL do jogador. */
  payoutPerMatchNow: number;
  canSign: boolean;
  reason: 'tier_too_low' | 'no_slots' | 'duplicate_contract' | null;
}

export interface MatchSummary {
  fansBefore: number;
  fansAfter: number;
  tierBefore: string;
  tierAfter: string;
  matchFans: number;
  sponsors: Array<{ sponsorName: string; payout: number; fansDelta: number; completed: boolean }>;
  wallet: number;
  lives: { current: number; max: number; nextLifeAtMs: number | null };
}

const tierIndex = (id: string): number => FAN_TIERS.findIndex((t) => t.id === id);

/**
 * Regras do meta-jogo. Invariantes:
 *  - Carteira NUNCA é mutada direto: só entradas no ledger; saldo = soma.
 *  - Fãs mudam só via eventos auditáveis, com piso aplicado passo a passo.
 *  - Tier do pagamento é o do INÍCIO da partida (fãs antes dos deltas dela).
 *  - Relógio injetado (`nowMs`) — nunca Date.now() inline; testes usam fake.
 */
export class MetaService {
  constructor(
    private readonly repo: MetaRepo,
    private readonly nowMs: () => number,
  ) {}

  private async requireProfile(userId: string): Promise<ProfileRecord> {
    const profile = await this.repo.getProfile(userId);
    if (!profile) throw new MetaError('user_not_found');
    return profile;
  }

  async me(userId: string): Promise<MeView> {
    const profile = await this.requireProfile(userId);
    const now = this.nowMs();
    const lives = computeLives(
      { lives: profile.lives, updatedAtMs: profile.livesUpdatedAtMs },
      now,
    );
    const tier = tierForFans(profile.fans);
    const contracts = await this.activeContractsWithSponsors(userId);

    return {
      displayName: profile.displayName,
      fans: profile.fans,
      tier: { id: tier.id, name: tier.name, multiplier: tier.multiplier },
      wallet: await this.repo.walletBalance(userId),
      lives: {
        current: lives.lives,
        max: LIVES_MAX,
        nextLifeAtMs: nextLifeAtMs(lives, now),
      },
      attributes: {
        dribble: profile.dribble,
        passing: profile.passing,
        finish: profile.finish,
        fatigue: profile.fatigue,
      },
      contracts: contracts.map(({ contract, sponsor }) => ({
        id: contract.id,
        sponsorName: sponsor.name,
        archetype: sponsor.archetype,
        matchesRemaining: contract.matchesRemaining,
        fansPerMatch: sponsor.fansPerMatch,
        payoutPerMatchNow: sponsorPayout(sponsor.archetype, tier),
      })),
      slots: { used: contracts.length, total: sponsorSlots(tier) },
    };
  }

  async listSponsors(userId: string): Promise<SponsorView[]> {
    const profile = await this.requireProfile(userId);
    const tier = tierForFans(profile.fans);
    const active = await this.repo.listContracts(userId, 'active');
    const sponsors = await this.repo.listSponsors();

    return sponsors
      .map((s) => {
        const reason = this.signBlockReason(s, tier, active);
        return {
          id: s.id,
          name: s.name,
          archetype: s.archetype,
          minTier: s.minTier,
          fansPerMatch: s.fansPerMatch,
          basePayPerMatch: s.basePayPerMatch,
          payoutPerMatchNow: sponsorPayout(s.archetype, tier),
          canSign: reason === null,
          reason,
        };
      })
      .sort((a, b) => tierIndex(a.minTier) - tierIndex(b.minTier) || a.name.localeCompare(b.name));
  }

  private signBlockReason(
    sponsor: SponsorRecord,
    tier: FanTier,
    active: ContractRecord[],
  ): SponsorView['reason'] {
    if (tierIndex(tier.id) < tierIndex(sponsor.minTier)) return 'tier_too_low';
    if (active.some((c) => c.sponsorId === sponsor.id)) return 'duplicate_contract';
    if (active.length >= sponsorSlots(tier)) return 'no_slots';
    return null;
  }

  async signContract(userId: string, sponsorId: string): Promise<{ contractId: string }> {
    const profile = await this.requireProfile(userId);
    const sponsor = await this.repo.getSponsor(sponsorId);
    if (!sponsor) throw new MetaError('sponsor_not_found');
    const tier = tierForFans(profile.fans);
    const active = await this.repo.listContracts(userId, 'active');
    const reason = this.signBlockReason(sponsor, tier, active);
    if (reason) throw new MetaError(reason);

    const contract = await this.repo.createContract(userId, sponsorId, CONTRACT_DURATION_MATCHES);
    return { contractId: contract.id };
  }

  /**
   * Fecha uma partida: consome 1 vida, credita fãs de desempenho (60–140),
   * processa cada contrato ativo (pagamento × multiplicador do tier no ledger,
   * delta de fãs do trade-off, decremento e conclusão em 0).
   */
  async completeMatch(userId: string, rating: number, levelId?: string): Promise<MatchSummary> {
    const profile = await this.requireProfile(userId);
    const now = this.nowMs();

    const afterConsume = consumeLife(
      { lives: profile.lives, updatedAtMs: profile.livesUpdatedAtMs },
      now,
    );
    if (!afterConsume) throw new MetaError('no_lives');

    const fansBefore = profile.fans;
    const tierAtKickoff = tierForFans(fansBefore);

    let fans = fansBefore;
    const matchFans = matchPerformanceFans(rating);
    fans = applyFanDelta(fans, matchFans);
    await this.repo.addFanEvent(userId, matchFans, 'match_performance', levelId);

    const sponsorsSummary: MatchSummary['sponsors'] = [];
    for (const { contract, sponsor } of await this.activeContractsWithSponsors(userId)) {
      const payout = sponsorPayout(sponsor.archetype, tierAtKickoff);
      await this.repo.addLedger(userId, payout, 'sponsor_payout', contract.id);
      fans = applyFanDelta(fans, sponsor.fansPerMatch);
      await this.repo.addFanEvent(userId, sponsor.fansPerMatch, 'sponsor_effect', contract.id);

      contract.matchesRemaining -= 1;
      const completed = contract.matchesRemaining <= 0;
      if (completed) contract.status = 'completed';
      await this.repo.saveContract(contract);

      sponsorsSummary.push({
        sponsorName: sponsor.name,
        payout,
        fansDelta: sponsor.fansPerMatch,
        completed,
      });
    }

    await this.repo.saveProfile({
      ...profile,
      fans,
      lives: afterConsume.lives,
      livesUpdatedAtMs: afterConsume.updatedAtMs,
    });

    return {
      fansBefore,
      fansAfter: fans,
      tierBefore: tierAtKickoff.id,
      tierAfter: tierForFans(fans).id,
      matchFans,
      sponsors: sponsorsSummary,
      wallet: await this.repo.walletBalance(userId),
      lives: {
        current: afterConsume.lives,
        max: LIVES_MAX,
        nextLifeAtMs: nextLifeAtMs(afterConsume, now),
      },
    };
  }

  private async activeContractsWithSponsors(
    userId: string,
  ): Promise<Array<{ contract: ContractRecord; sponsor: SponsorRecord }>> {
    const contracts = await this.repo.listContracts(userId, 'active');
    const out: Array<{ contract: ContractRecord; sponsor: SponsorRecord }> = [];
    for (const contract of contracts) {
      const sponsor = await this.repo.getSponsor(contract.sponsorId);
      if (sponsor) out.push({ contract, sponsor });
    }
    return out;
  }
}
