/**
 * RNG seedável (mulberry32). Determinismo é regra de negócio:
 * passes/chutes NUNCA usam RNG; a ÚNICA fonte de aleatoriedade do jogo é a
 * roleta de drible, executada no servidor com um RNG desta fábrica.
 */
export interface Rng {
  /** Float uniforme em [0, 1). */
  next(): number;
  /** Inteiro uniforme em [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    nextInt(maxExclusive: number): number {
      if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
        throw new RangeError(
          `nextInt: maxExclusive deve ser inteiro positivo, recebeu ${maxExclusive}`,
        );
      }
      return Math.floor(next() * maxExclusive);
    },
  };
}
