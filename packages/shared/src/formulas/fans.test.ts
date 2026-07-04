import { describe, expect, it } from 'vitest';
import { FAN_FLOOR, FAN_TIERS, applyFanDelta, matchPerformanceFans, tierForFans } from './fans.js';

describe('tierForFans', () => {
  it('mapeia as bordas exatas de cada tier', () => {
    expect(tierForFans(0).id).toBe('amador');
    expect(tierForFans(9_999).id).toBe('amador');
    expect(tierForFans(10_000).id).toBe('local');
    expect(tierForFans(29_999).id).toBe('local');
    expect(tierForFans(30_000).id).toBe('regional');
    expect(tierForFans(79_999).id).toBe('regional');
    expect(tierForFans(80_000).id).toBe('nacional');
    expect(tierForFans(199_999).id).toBe('nacional');
    expect(tierForFans(200_000).id).toBe('global');
    expect(tierForFans(5_000_000).id).toBe('global');
  });

  it('multiplicadores canônicos', () => {
    expect(FAN_TIERS.map((t) => t.multiplier)).toEqual([1, 1.5, 2, 3, 5]);
  });

  it('rejeita valores inválidos', () => {
    expect(() => tierForFans(-1)).toThrow(RangeError);
    expect(() => tierForFans(Number.NaN)).toThrow(RangeError);
  });
});

describe('applyFanDelta', () => {
  it('soma deltas positivos', () => {
    expect(applyFanDelta(1000, 250)).toBe(1250);
  });
  it('nunca deixa cair abaixo do piso de 500', () => {
    expect(applyFanDelta(600, -300)).toBe(FAN_FLOOR);
    expect(applyFanDelta(500, -120)).toBe(FAN_FLOOR);
    expect(applyFanDelta(10_000, -100_000)).toBe(FAN_FLOOR);
  });
  it('permite exatamente o piso', () => {
    expect(applyFanDelta(620, -120)).toBe(500);
  });
  it('arredonda para inteiro', () => {
    expect(applyFanDelta(1000, 0.4)).toBe(1000);
    expect(applyFanDelta(1000, 0.6)).toBe(1001);
  });
});

describe('matchPerformanceFans', () => {
  it('rating 0 → 60, rating 1 → 140', () => {
    expect(matchPerformanceFans(0)).toBe(60);
    expect(matchPerformanceFans(1)).toBe(140);
  });
  it('rating 0.5 → 100', () => {
    expect(matchPerformanceFans(0.5)).toBe(100);
  });
  it('clampa ratings fora de [0,1]', () => {
    expect(matchPerformanceFans(-5)).toBe(60);
    expect(matchPerformanceFans(2)).toBe(140);
  });
});
