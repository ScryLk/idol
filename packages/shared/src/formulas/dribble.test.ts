import { describe, expect, it } from 'vitest';
import { createRng } from '../rng.js';
import {
  CHANCE_MAX,
  CHANCE_MIN,
  PITY_CAP,
  dribbleChance,
  dribbleFans,
  dribbleFansBase,
  nextChain,
  nextPity,
  perfectFanMultiplier,
  perfectZone,
  spinDribble,
  type DribbleContext,
} from './dribble.js';

const ctx = (overrides: Partial<DribbleContext> = {}): DribbleContext => ({
  dribble: 50,
  defense: 50,
  fatigue: 0,
  pity: 0,
  chain: 0,
  ...overrides,
});

describe('dribbleChance', () => {
  it('caso neutro: atributos iguais, sem fadiga/pity/cadeia → 50', () => {
    expect(dribbleChance(ctx())).toBe(50);
  });

  it('aplica cada termo da fórmula', () => {
    // 50 + (70-40)*0.6 - 20*0.25 + 10 - 1*12 = 50 + 18 - 5 + 10 - 12 = 61
    expect(dribbleChance(ctx({ dribble: 70, defense: 40, fatigue: 20, pity: 10, chain: 1 }))).toBe(
      61,
    );
  });

  it('trava no piso de 5', () => {
    expect(dribbleChance(ctx({ dribble: 0, defense: 100, fatigue: 100, chain: 3 }))).toBe(
      CHANCE_MIN,
    );
  });

  it('trava no teto de 95', () => {
    expect(dribbleChance(ctx({ dribble: 150, defense: 0, pity: 20 }))).toBe(CHANCE_MAX);
  });
});

describe('perfectZone', () => {
  it('segue round(chance * (0.25 + drible * 0.001))', () => {
    // 50 * (0.25 + 50*0.001) = 50 * 0.3 = 15
    expect(perfectZone(50, 50)).toBe(15);
  });

  it('nunca fica abaixo de 2', () => {
    expect(perfectZone(5, 0)).toBe(2); // round(5*0.25)=1 → mínimo 2
    expect(perfectZone(CHANCE_MIN, 0)).toBe(2);
  });

  it('cresce com o atributo de drible', () => {
    expect(perfectZone(80, 100)).toBe(Math.round(80 * 0.35));
    expect(perfectZone(80, 100)).toBeGreaterThan(perfectZone(80, 10));
  });
});

describe('nextPity', () => {
  it('soma 5 por falha', () => {
    expect(nextPity(0, 'failure')).toBe(5);
    expect(nextPity(5, 'failure')).toBe(10);
  });
  it('respeita o teto de 20', () => {
    expect(nextPity(20, 'failure')).toBe(PITY_CAP);
    expect(nextPity(18, 'failure')).toBe(PITY_CAP);
  });
  it('zera em qualquer sucesso', () => {
    expect(nextPity(15, 'success')).toBe(0);
    expect(nextPity(20, 'perfect')).toBe(0);
  });
});

describe('nextChain', () => {
  it('perfeito estende a cadeia', () => {
    expect(nextChain(0, 'perfect')).toBe(1);
    expect(nextChain(3, 'perfect')).toBe(4);
  });
  it('sucesso normal encerra', () => {
    expect(nextChain(3, 'success')).toBe(0);
  });
  it('falha encerra', () => {
    expect(nextChain(2, 'failure')).toBe(0);
  });
});

describe('dribbleFans', () => {
  it('base = 100 + defesa * 3', () => {
    expect(dribbleFansBase(50)).toBe(250);
    expect(dribbleFansBase(0)).toBe(100);
  });

  it('falha paga 0', () => {
    expect(dribbleFans(50, 'failure', 2)).toBe(0);
  });

  it('sucesso normal paga a base, sem multiplicador', () => {
    expect(dribbleFans(50, 'success', 3)).toBe(250);
  });

  it('perfeito paga base * 1.5 * (1 + cadeia * 0.5), cadeia da ENTRADA do giro', () => {
    expect(perfectFanMultiplier(0)).toBe(1);
    expect(perfectFanMultiplier(2)).toBe(2);
    expect(dribbleFans(50, 'perfect', 0)).toBe(375); // 250 * 1.5 * 1
    expect(dribbleFans(50, 'perfect', 1)).toBe(Math.round(250 * 1.5 * 1.5)); // 563
    expect(dribbleFans(50, 'perfect', 2)).toBe(750); // 250 * 1.5 * 2
  });
});

describe('spinDribble', () => {
  it('é determinístico com a mesma seed', () => {
    const a = spinDribble(ctx(), createRng(42));
    const b = spinDribble(ctx(), createRng(42));
    expect(a).toEqual(b);
  });

  it('classifica corretamente pelas faixas da rolagem', () => {
    const c = ctx(); // chance 50, zona perfeita 15
    for (let seed = 0; seed < 500; seed++) {
      const r = spinDribble(c, createRng(seed));
      if (r.roll < r.perfectZone) expect(r.outcome).toBe('perfect');
      else if (r.roll < r.chance) expect(r.outcome).toBe('success');
      else expect(r.outcome).toBe('failure');
    }
  });

  it('propaga pity e cadeia coerentes com o resultado', () => {
    for (let seed = 0; seed < 200; seed++) {
      const c = ctx({ pity: 10, chain: 1 });
      const r = spinDribble(c, createRng(seed));
      if (r.outcome === 'failure') {
        expect(r.nextPity).toBe(15);
        expect(r.nextChain).toBe(0);
        expect(r.fans).toBe(0);
      } else {
        expect(r.nextPity).toBe(0);
        expect(r.nextChain).toBe(r.outcome === 'perfect' ? 2 : 0);
        expect(r.fans).toBeGreaterThan(0);
      }
    }
  });

  it('distribuição estatística em 10k giros com seed bate com chance/zona (±1.5pp)', () => {
    const c = ctx({ dribble: 60, defense: 45 }); // chance = 59, zona = round(59*0.31) = 18
    const chance = dribbleChance(c);
    const zone = perfectZone(chance, c.dribble);
    const rng = createRng(2026);
    const counts = { perfect: 0, success: 0, failure: 0 };
    const n = 10_000;
    for (let i = 0; i < n; i++) counts[spinDribble(c, rng).outcome]++;
    expect(Math.abs((counts.perfect / n) * 100 - zone)).toBeLessThan(1.5);
    expect(Math.abs(((counts.perfect + counts.success) / n) * 100 - chance)).toBeLessThan(1.5);
    expect(Math.abs((counts.failure / n) * 100 - (100 - chance))).toBeLessThan(1.5);
  });
});
