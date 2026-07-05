import { describe, expect, it } from 'vitest';
import { isLevelUnlocked, SEASON1_STAR_GATES, seasonTotalStars } from './gates.js';

describe('gates de estrelas', () => {
  it('todo gate é atingível com os níveis anteriores (≤ 3★ × níveis)', () => {
    for (const [ordinal, gate] of Object.entries(SEASON1_STAR_GATES)) {
      expect(gate).toBeLessThanOrEqual(3 * (Number(ordinal) - 1));
    }
  });

  it('nível 1 sempre desbloqueado; os demais exigem o anterior completado', () => {
    expect(isLevelUnlocked(1, {})).toBe(true);
    expect(isLevelUnlocked(2, {})).toBe(false);
    expect(isLevelUnlocked(2, { 1: 1 })).toBe(true);
    expect(isLevelUnlocked(3, { 1: 3 })).toBe(false); // 2 não completado
  });

  it('gate de total segura mesmo com o anterior completado', () => {
    // nível 4 exige total 5: com 1+1+1=3 fica trancado
    expect(isLevelUnlocked(4, { 1: 1, 2: 1, 3: 1 })).toBe(false);
    expect(isLevelUnlocked(4, { 1: 3, 2: 1, 3: 1 })).toBe(true); // total 5
  });

  it('seasonTotalStars soma as melhores estrelas', () => {
    expect(seasonTotalStars({})).toBe(0);
    expect(seasonTotalStars({ 1: 3, 2: 2, 7: 1 })).toBe(6);
  });

  it('ordinal inválido nunca desbloqueia', () => {
    expect(isLevelUnlocked(0, { 1: 3 })).toBe(false);
  });
});
