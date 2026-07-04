import { describe, expect, it } from 'vitest';
import { clamp } from './math.js';

describe('clamp', () => {
  it('retorna o valor quando dentro do intervalo', () => {
    expect(clamp(10, 5, 95)).toBe(10);
  });
  it('trava no mínimo', () => {
    expect(clamp(-100, 5, 95)).toBe(5);
  });
  it('trava no máximo', () => {
    expect(clamp(1000, 5, 95)).toBe(95);
  });
  it('aceita bordas exatas', () => {
    expect(clamp(5, 5, 95)).toBe(5);
    expect(clamp(95, 5, 95)).toBe(95);
  });
  it('lança quando min > max', () => {
    expect(() => clamp(1, 10, 0)).toThrow(RangeError);
  });
});
