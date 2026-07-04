import { describe, expect, it } from 'vitest';
import { FAN_TIERS, tierForFans } from './fans.js';
import {
  CONTRACT_DURATION_MATCHES,
  SPONSOR_ARCHETYPES,
  sponsorFanDelta,
  sponsorPayout,
  sponsorSlots,
} from './sponsorship.js';

const tier = (id: string) => {
  const t = FAN_TIERS.find((t) => t.id === id);
  if (!t) throw new Error(`tier ${id} não existe`);
  return t;
};

describe('arquétipos de patrocínio', () => {
  it('valores canônicos', () => {
    expect(SPONSOR_ARCHETYPES.autentico).toMatchObject({ fansPerMatch: 150, basePayPerMatch: 250 });
    expect(SPONSOR_ARCHETYPES.equilibrado).toMatchObject({
      fansPerMatch: 40,
      basePayPerMatch: 600,
    });
    expect(SPONSOR_ARCHETYPES.mercenario).toMatchObject({
      fansPerMatch: -120,
      basePayPerMatch: 1500,
    });
  });

  it('contratos duram 10 partidas', () => {
    expect(CONTRACT_DURATION_MATCHES).toBe(10);
  });
});

describe('sponsorPayout', () => {
  it('multiplica o pagamento base pelo multiplicador do tier', () => {
    expect(sponsorPayout('autentico', tier('amador'))).toBe(250);
    expect(sponsorPayout('autentico', tier('local'))).toBe(375);
    expect(sponsorPayout('equilibrado', tier('regional'))).toBe(1200);
    expect(sponsorPayout('mercenario', tier('nacional'))).toBe(4500);
    expect(sponsorPayout('mercenario', tier('global'))).toBe(7500);
  });

  it('composição com tierForFans', () => {
    expect(sponsorPayout('mercenario', tierForFans(250_000))).toBe(7500);
  });
});

describe('sponsorFanDelta', () => {
  it('NÃO aplica multiplicador de tier ao delta de fãs', () => {
    expect(sponsorFanDelta('autentico')).toBe(150);
    expect(sponsorFanDelta('equilibrado')).toBe(40);
    expect(sponsorFanDelta('mercenario')).toBe(-120);
  });
});

describe('sponsorSlots', () => {
  it('progride 1 → 2 → 3 conforme o tier', () => {
    expect(sponsorSlots(tier('amador'))).toBe(1);
    expect(sponsorSlots(tier('local'))).toBe(1);
    expect(sponsorSlots(tier('regional'))).toBe(2);
    expect(sponsorSlots(tier('nacional'))).toBe(3);
    expect(sponsorSlots(tier('global'))).toBe(3);
  });
});
