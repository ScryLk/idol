import { describe, expect, it } from 'vitest';
import {
  computeLives,
  consumeLife,
  LIVES_MAX,
  LIVES_REGEN_MINUTES,
  nextLifeAtMs,
} from './lives.js';

const MIN = 60_000;
const T0 = 1_000_000_000;

describe('computeLives', () => {
  it('estoque cheio não regenera e reancora o timer', () => {
    const s = computeLives({ lives: 5, updatedAtMs: T0 }, T0 + 90 * MIN);
    expect(s.lives).toBe(LIVES_MAX);
    expect(s.updatedAtMs).toBe(T0 + 90 * MIN);
  });

  it('regenera 1 vida por intervalo completo de 30min', () => {
    expect(computeLives({ lives: 2, updatedAtMs: T0 }, T0 + 29 * MIN).lives).toBe(2);
    expect(computeLives({ lives: 2, updatedAtMs: T0 }, T0 + 30 * MIN).lives).toBe(3);
    expect(computeLives({ lives: 2, updatedAtMs: T0 }, T0 + 89 * MIN).lives).toBe(4);
  });

  it('não passa do teto', () => {
    expect(computeLives({ lives: 2, updatedAtMs: T0 }, T0 + 600 * MIN).lives).toBe(LIVES_MAX);
  });

  it('preserva o progresso parcial do intervalo (âncora avança em passos)', () => {
    const s = computeLives({ lives: 2, updatedAtMs: T0 }, T0 + 45 * MIN);
    expect(s.lives).toBe(3);
    expect(s.updatedAtMs).toBe(T0 + 30 * MIN); // 15min de progresso preservados
  });

  it('relógio no passado não desconta vidas', () => {
    const s = computeLives({ lives: 3, updatedAtMs: T0 }, T0 - 10 * MIN);
    expect(s.lives).toBe(3);
  });
});

describe('consumeLife', () => {
  it('consome do estoque cheio e inicia o timer agora', () => {
    const s = consumeLife({ lives: 5, updatedAtMs: T0 - 500 * MIN }, T0);
    expect(s).toEqual({ lives: 4, updatedAtMs: T0 });
  });

  it('consome preservando o timer em andamento', () => {
    const s = consumeLife({ lives: 3, updatedAtMs: T0 }, T0 + 10 * MIN);
    expect(s).toEqual({ lives: 2, updatedAtMs: T0 });
  });

  it('regenera antes de consumir', () => {
    const s = consumeLife({ lives: 0, updatedAtMs: T0 }, T0 + 31 * MIN);
    expect(s?.lives).toBe(0); // regenerou 1, consumiu 1
  });

  it('retorna null sem vidas', () => {
    expect(consumeLife({ lives: 0, updatedAtMs: T0 }, T0 + 5 * MIN)).toBeNull();
  });
});

describe('nextLifeAtMs', () => {
  it('null com estoque cheio', () => {
    expect(nextLifeAtMs({ lives: 5, updatedAtMs: T0 }, T0)).toBeNull();
  });

  it('aponta o fim do intervalo corrente', () => {
    expect(nextLifeAtMs({ lives: 2, updatedAtMs: T0 }, T0 + 10 * MIN)).toBe(
      T0 + LIVES_REGEN_MINUTES * MIN,
    );
    // após regenerar uma no meio do caminho, a próxima é o intervalo seguinte
    expect(nextLifeAtMs({ lives: 2, updatedAtMs: T0 }, T0 + 45 * MIN)).toBe(T0 + 60 * MIN);
  });
});
