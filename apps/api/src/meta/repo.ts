import type { FanTierId, SponsorArchetype } from '@idol/shared';

/**
 * Porta única de persistência do meta-jogo (auth, perfil, patrocínios,
 * contratos, ledger, eventos de fãs). Implementações: Prisma (produção) e
 * memória (testes de integração rápidos e determinísticos).
 */

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
}

export interface ProfileRecord {
  userId: string;
  displayName: string;
  dribble: number;
  passing: number;
  finish: number;
  fatigue: number;
  fans: number;
  lives: number;
  livesUpdatedAtMs: number;
}

export interface SponsorRecord {
  id: string;
  name: string;
  archetype: SponsorArchetype;
  minTier: FanTierId;
  fansPerMatch: number;
  basePayPerMatch: number;
}

export type ContractStatus = 'active' | 'completed' | 'cancelled';

export interface ContractRecord {
  id: string;
  userId: string;
  sponsorId: string;
  status: ContractStatus;
  matchesRemaining: number;
}

export type LedgerType = 'match_reward' | 'sponsor_payout' | 'purchase' | 'adjustment';
export type FanEventType =
  | 'match_performance'
  | 'dribble'
  | 'sponsor_effect'
  | 'decay'
  | 'adjustment';

export interface MetaRepo {
  createUser(email: string, passwordHash: string, displayName: string): Promise<UserRecord>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  getProfile(userId: string): Promise<ProfileRecord | null>;
  saveProfile(profile: ProfileRecord): Promise<void>;
  listSponsors(): Promise<SponsorRecord[]>;
  getSponsor(id: string): Promise<SponsorRecord | null>;
  listContracts(userId: string, status?: ContractStatus): Promise<ContractRecord[]>;
  createContract(userId: string, sponsorId: string, matches: number): Promise<ContractRecord>;
  saveContract(contract: ContractRecord): Promise<void>;
  addLedger(userId: string, amount: number, type: LedgerType, reference?: string): Promise<void>;
  walletBalance(userId: string): Promise<number>;
  addFanEvent(userId: string, delta: number, type: FanEventType, reference?: string): Promise<void>;
}
