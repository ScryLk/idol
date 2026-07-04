import { describe, expect, it } from 'vitest';
import { createRng } from './rng.js';

describe('createRng (mulberry32)', () => {
  it('é determinístico para a mesma seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('seeds diferentes divergem', () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('next() fica em [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 10_000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('nextInt respeita o limite', () => {
    const rng = createRng(99);
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextInt(6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('nextInt rejeita limites inválidos', () => {
    const rng = createRng(1);
    expect(() => rng.nextInt(0)).toThrow(RangeError);
    expect(() => rng.nextInt(-5)).toThrow(RangeError);
    expect(() => rng.nextInt(2.5)).toThrow(RangeError);
  });

  it('distribuição aproximadamente uniforme (média ~0.5)', () => {
    const rng = createRng(123);
    let sum = 0;
    const n = 50_000;
    for (let i = 0; i < n; i++) sum += rng.next();
    expect(sum / n).toBeCloseTo(0.5, 1);
  });
});
