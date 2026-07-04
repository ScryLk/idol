import { clamp } from '../math.js';

/**
 * Tiers de fãs — fórmulas canônicas.
 * Amador 0 (x1) | Local 10_000 (x1.5) | Regional 30_000 (x2) | Nacional 80_000 (x3) | Global 200_000 (x5)
 * Piso de fãs: 500 (o total nunca cai abaixo disso ao aplicar deltas negativos).
 */

export const FAN_FLOOR = 500;

export type FanTierId = 'amador' | 'local' | 'regional' | 'nacional' | 'global';

export interface FanTier {
  id: FanTierId;
  /** Nome de exibição pt-BR. */
  name: string;
  /** Mínimo de fãs (inclusivo) para pertencer ao tier. */
  minFans: number;
  /** Multiplicador aplicado a pagamentos de patrocínio. */
  multiplier: number;
}

/** Ordenados por minFans crescente. */
export const FAN_TIERS: readonly FanTier[] = [
  { id: 'amador', name: 'Amador', minFans: 0, multiplier: 1 },
  { id: 'local', name: 'Local', minFans: 10_000, multiplier: 1.5 },
  { id: 'regional', name: 'Regional', minFans: 30_000, multiplier: 2 },
  { id: 'nacional', name: 'Nacional', minFans: 80_000, multiplier: 3 },
  { id: 'global', name: 'Global', minFans: 200_000, multiplier: 5 },
] as const;

/** Tier correspondente a um total de fãs. */
export function tierForFans(fans: number): FanTier {
  if (fans < 0 || !Number.isFinite(fans)) {
    throw new RangeError(`tierForFans: total de fãs inválido (${fans})`);
  }
  let current: FanTier = FAN_TIERS[0] as FanTier;
  for (const tier of FAN_TIERS) {
    if (fans >= tier.minFans) current = tier;
  }
  return current;
}

/** Aplica um delta de fãs respeitando o piso de 500. */
export function applyFanDelta(current: number, delta: number): number {
  return Math.max(FAN_FLOOR, Math.round(current + delta));
}

/**
 * Fãs por desempenho em partida: 60–140 conforme avaliação do lance.
 * `rating` é a avaliação normalizada em [0, 1] (0 = mínimo aceitável, 1 = perfeito).
 */
export const MATCH_FANS_MIN = 60;
export const MATCH_FANS_MAX = 140;

export function matchPerformanceFans(rating: number): number {
  const r = clamp(rating, 0, 1);
  return Math.round(MATCH_FANS_MIN + r * (MATCH_FANS_MAX - MATCH_FANS_MIN));
}
