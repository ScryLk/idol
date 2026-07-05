import { describe, expect, it } from 'vitest';
import { FAN_TIERS, tierForFans } from '../formulas/fans.js';
import { CLUBS, clubsForTier } from './clubs.js';

describe('clubes de transferência', () => {
  it('há 2 clubes por tier (10 no total) e ids únicos', () => {
    expect(CLUBS).toHaveLength(10);
    expect(new Set(CLUBS.map((c) => c.id)).size).toBe(10);
    for (const tier of FAN_TIERS) {
      expect(CLUBS.filter((c) => c.minTier === tier.id)).toHaveLength(2);
    }
  });

  it('clubsForTier libera acumulativamente', () => {
    expect(clubsForTier(tierForFans(500))).toHaveLength(2); // amador
    expect(clubsForTier(tierForFans(10_000))).toHaveLength(4); // local
    expect(clubsForTier(tierForFans(250_000))).toHaveLength(10); // global
  });
});
