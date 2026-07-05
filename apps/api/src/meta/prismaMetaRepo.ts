import type { PrismaClient } from '@prisma/client';
import type { FanTierId, SponsorArchetype } from '@idol/shared';
import type {
  ContractRecord,
  ContractStatus,
  FanEventType,
  LedgerType,
  MetaRepo,
  ProfileRecord,
  SponsorRecord,
  UserRecord,
} from './repo.js';

const toDbContractStatus = {
  active: 'ACTIVE',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
} as const;
const fromDbContractStatus = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;
const toDbLedger = {
  match_reward: 'MATCH_REWARD',
  sponsor_payout: 'SPONSOR_PAYOUT',
  purchase: 'PURCHASE',
  adjustment: 'ADJUSTMENT',
} as const;
const toDbFanEvent = {
  match_performance: 'MATCH_PERFORMANCE',
  dribble: 'DRIBBLE',
  sponsor_effect: 'SPONSOR_EFFECT',
  decay: 'DECAY',
  adjustment: 'ADJUSTMENT',
} as const;

export class PrismaMetaRepo implements MetaRepo {
  constructor(private readonly prisma: PrismaClient) {}

  async createUser(email: string, passwordHash: string, displayName: string): Promise<UserRecord> {
    const user = await this.prisma.user.create({
      data: { email, passwordHash, profile: { create: { displayName } } },
    });
    return { id: user.id, email: user.email, passwordHash: user.passwordHash };
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const u = await this.prisma.user.findUnique({ where: { email } });
    return u ? { id: u.id, email: u.email, passwordHash: u.passwordHash } : null;
  }

  async getProfile(userId: string): Promise<ProfileRecord | null> {
    const p = await this.prisma.playerProfile.findUnique({ where: { userId } });
    if (!p) return null;
    return {
      userId: p.userId,
      displayName: p.displayName,
      dribble: p.dribble,
      passing: p.passing,
      finish: p.finish,
      fatigue: p.fatigue,
      fans: p.fans,
      lives: p.lives,
      livesUpdatedAtMs: p.livesUpdatedAt.getTime(),
    };
  }

  async saveProfile(profile: ProfileRecord): Promise<void> {
    await this.prisma.playerProfile.update({
      where: { userId: profile.userId },
      data: {
        fans: profile.fans,
        lives: profile.lives,
        livesUpdatedAt: new Date(profile.livesUpdatedAtMs),
      },
    });
  }

  async listSponsors(): Promise<SponsorRecord[]> {
    const rows = await this.prisma.sponsor.findMany();
    return rows.map((s) => this.mapSponsor(s));
  }

  async getSponsor(id: string): Promise<SponsorRecord | null> {
    const s = await this.prisma.sponsor.findUnique({ where: { id } });
    return s ? this.mapSponsor(s) : null;
  }

  private mapSponsor(s: {
    id: string;
    name: string;
    archetype: string;
    minTier: string;
    fansPerMatch: number;
    basePayPerMatch: number;
  }): SponsorRecord {
    return {
      id: s.id,
      name: s.name,
      archetype: s.archetype.toLowerCase() as SponsorArchetype,
      minTier: s.minTier.toLowerCase() as FanTierId,
      fansPerMatch: s.fansPerMatch,
      basePayPerMatch: s.basePayPerMatch,
    };
  }

  async listContracts(userId: string, status?: ContractStatus): Promise<ContractRecord[]> {
    const rows = await this.prisma.contract.findMany({
      where: { userId, ...(status ? { status: toDbContractStatus[status] } : {}) },
    });
    return rows.map((c) => ({
      id: c.id,
      userId: c.userId,
      sponsorId: c.sponsorId,
      status: fromDbContractStatus[c.status],
      matchesRemaining: c.matchesRemaining,
    }));
  }

  async createContract(
    userId: string,
    sponsorId: string,
    matches: number,
  ): Promise<ContractRecord> {
    const c = await this.prisma.contract.create({
      data: { userId, sponsorId, matchesRemaining: matches },
    });
    return {
      id: c.id,
      userId: c.userId,
      sponsorId: c.sponsorId,
      status: 'active',
      matchesRemaining: c.matchesRemaining,
    };
  }

  async saveContract(contract: ContractRecord): Promise<void> {
    await this.prisma.contract.update({
      where: { id: contract.id },
      data: {
        status: toDbContractStatus[contract.status],
        matchesRemaining: contract.matchesRemaining,
        ...(contract.status !== 'active' ? { endedAt: new Date() } : {}),
      },
    });
  }

  async addLedger(
    userId: string,
    amount: number,
    type: LedgerType,
    reference?: string,
  ): Promise<void> {
    await this.prisma.ledgerEntry.create({
      data: { userId, amount, type: toDbLedger[type], reference: reference ?? null },
    });
  }

  async walletBalance(userId: string): Promise<number> {
    const agg = await this.prisma.ledgerEntry.aggregate({
      where: { userId },
      _sum: { amount: true },
    });
    return agg._sum.amount ?? 0;
  }

  async addFanEvent(
    userId: string,
    delta: number,
    type: FanEventType,
    reference?: string,
  ): Promise<void> {
    await this.prisma.fanEvent.create({
      data: { userId, delta, type: toDbFanEvent[type], reference: reference ?? null },
    });
  }
}
