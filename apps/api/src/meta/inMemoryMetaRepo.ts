import { FAN_TIERS, SPONSOR_ARCHETYPES } from '@idol/shared';
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

/** Repo em memória para testes: mesmos contratos da implementação Prisma. */
export class InMemoryMetaRepo implements MetaRepo {
  private seq = 0;
  readonly users = new Map<string, UserRecord>();
  readonly profiles = new Map<string, ProfileRecord>();
  readonly sponsors = new Map<string, SponsorRecord>();
  readonly contracts = new Map<string, ContractRecord>();
  readonly ledger: Array<{ userId: string; amount: number; type: LedgerType; reference?: string }> =
    [];
  readonly fanEvents: Array<{
    userId: string;
    delta: number;
    type: FanEventType;
    reference?: string;
  }> = [];

  constructor(private readonly nowMs: () => number = () => 0) {}

  private nextId(prefix: string): string {
    this.seq += 1;
    // uuid v4 sintético e estável para satisfazer validações de formato
    return `${prefix.padEnd(8, '0').slice(0, 8)}-0000-4000-8000-${String(this.seq).padStart(12, '0')}`;
  }

  /** Espelha o seed real: 3 arquétipos × 5 tiers. */
  seedSponsors(): void {
    for (const tier of FAN_TIERS) {
      for (const spec of Object.values(SPONSOR_ARCHETYPES)) {
        const id = this.nextId('55000000');
        this.sponsors.set(id, {
          id,
          name: `${spec.name} ${tier.name}`,
          archetype: spec.id,
          minTier: tier.id,
          fansPerMatch: spec.fansPerMatch,
          basePayPerMatch: spec.basePayPerMatch,
        });
      }
    }
  }

  createUser(email: string, passwordHash: string, displayName: string): Promise<UserRecord> {
    const user: UserRecord = { id: this.nextId('11000000'), email, passwordHash };
    this.users.set(user.id, user);
    this.profiles.set(user.id, {
      userId: user.id,
      displayName,
      dribble: 30,
      passing: 30,
      finish: 30,
      fatigue: 0,
      fans: 500,
      lives: 5,
      livesUpdatedAtMs: this.nowMs(),
    });
    return Promise.resolve(user);
  }

  findUserByEmail(email: string): Promise<UserRecord | null> {
    for (const u of this.users.values()) if (u.email === email) return Promise.resolve(u);
    return Promise.resolve(null);
  }

  getProfile(userId: string): Promise<ProfileRecord | null> {
    const p = this.profiles.get(userId);
    return Promise.resolve(p ? { ...p } : null);
  }

  saveProfile(profile: ProfileRecord): Promise<void> {
    this.profiles.set(profile.userId, { ...profile });
    return Promise.resolve();
  }

  listSponsors(): Promise<SponsorRecord[]> {
    return Promise.resolve([...this.sponsors.values()]);
  }

  getSponsor(id: string): Promise<SponsorRecord | null> {
    return Promise.resolve(this.sponsors.get(id) ?? null);
  }

  listContracts(userId: string, status?: ContractStatus): Promise<ContractRecord[]> {
    const out = [...this.contracts.values()].filter(
      (c) => c.userId === userId && (status === undefined || c.status === status),
    );
    return Promise.resolve(out.map((c) => ({ ...c })));
  }

  createContract(userId: string, sponsorId: string, matches: number): Promise<ContractRecord> {
    const contract: ContractRecord = {
      id: this.nextId('cc000000'),
      userId,
      sponsorId,
      status: 'active',
      matchesRemaining: matches,
    };
    this.contracts.set(contract.id, contract);
    return Promise.resolve({ ...contract });
  }

  saveContract(contract: ContractRecord): Promise<void> {
    this.contracts.set(contract.id, { ...contract });
    return Promise.resolve();
  }

  addLedger(userId: string, amount: number, type: LedgerType, reference?: string): Promise<void> {
    this.ledger.push({ userId, amount, type, ...(reference !== undefined ? { reference } : {}) });
    return Promise.resolve();
  }

  walletBalance(userId: string): Promise<number> {
    return Promise.resolve(
      this.ledger.filter((l) => l.userId === userId).reduce((sum, l) => sum + l.amount, 0),
    );
  }

  addFanEvent(
    userId: string,
    delta: number,
    type: FanEventType,
    reference?: string,
  ): Promise<void> {
    this.fanEvents.push({
      userId,
      delta,
      type,
      ...(reference !== undefined ? { reference } : {}),
    });
    return Promise.resolve();
  }
}
