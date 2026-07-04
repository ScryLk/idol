import { clamp } from '../math.js';
import type { Rng } from '../rng.js';

/**
 * Roleta de Drible com Zona Perfeita — fórmulas canônicas.
 *
 * chance   = clamp(50 + (drible - defesa) * 0.6 - fadiga * 0.25 + pity - cadeia * 12, 5, 95)
 * perfeito = max(2, round(chance * (0.25 + drible * 0.001)))
 * pity: +5 por falha, teto 20, zera em qualquer sucesso
 * cadeia: sucesso normal encerra; perfeito estende (+1) e multiplica fãs em (1 + cadeia * 0.5)
 * fãs: base = 100 + defesa * 3; sucesso paga base; perfeito paga base * 1.5 * multiplicador
 *
 * Decisão de projeto: o multiplicador do perfeito usa a cadeia VIGENTE NA ENTRADA
 * do giro (1º perfeito: cadeia 0 → x1.0; 2º: cadeia 1 → x1.5; ...).
 */

export const PITY_STEP = 5;
export const PITY_CAP = 20;
export const CHAIN_PENALTY = 12;
export const PERFECT_ZONE_MIN = 2;
export const CHANCE_MIN = 5;
export const CHANCE_MAX = 95;

export type DribbleOutcome = 'perfect' | 'success' | 'failure';

export interface DribbleContext {
  /** Atributo de drible do herói (>= 0). */
  dribble: number;
  /** Atributo de defesa do marcador (>= 0). */
  defense: number;
  /** Fadiga acumulada do herói (>= 0). */
  fatigue: number;
  /** Pity acumulado (0..PITY_CAP). */
  pity: number;
  /** Tamanho atual da cadeia de perfeitos (>= 0). */
  chain: number;
}

export interface DribbleSpinResult {
  outcome: DribbleOutcome;
  /** Rolagem uniforme em [0, 100). */
  roll: number;
  /** Chance total de sucesso (perfeito + normal), em pontos percentuais. */
  chance: number;
  /** Fatia da chance que é zona perfeita, em pontos percentuais. */
  perfectZone: number;
  /** Fãs ganhos neste giro. */
  fans: number;
  /** Pity após o giro. */
  nextPity: number;
  /** Cadeia após o giro. */
  nextChain: number;
}

/** Chance total de sucesso do drible, em pontos percentuais [5, 95]. */
export function dribbleChance(ctx: DribbleContext): number {
  const raw =
    50 +
    (ctx.dribble - ctx.defense) * 0.6 -
    ctx.fatigue * 0.25 +
    ctx.pity -
    ctx.chain * CHAIN_PENALTY;
  return clamp(raw, CHANCE_MIN, CHANCE_MAX);
}

/** Fatia (pontos percentuais) da chance que resulta em Perfeito. Mínimo 2. */
export function perfectZone(chance: number, dribble: number): number {
  return Math.max(PERFECT_ZONE_MIN, Math.round(chance * (0.25 + dribble * 0.001)));
}

/** Pity após um giro: +5 por falha (teto 20); qualquer sucesso zera. */
export function nextPity(pity: number, outcome: DribbleOutcome): number {
  if (outcome === 'failure') return Math.min(PITY_CAP, pity + PITY_STEP);
  return 0;
}

/** Cadeia após um giro: perfeito estende (+1); sucesso normal ou falha encerra. */
export function nextChain(chain: number, outcome: DribbleOutcome): number {
  return outcome === 'perfect' ? chain + 1 : 0;
}

/** Base de fãs do drible em função da defesa enfrentada. */
export function dribbleFansBase(defense: number): number {
  return 100 + defense * 3;
}

/** Multiplicador de fãs do perfeito para a cadeia vigente na entrada do giro. */
export function perfectFanMultiplier(chain: number): number {
  return 1 + chain * 0.5;
}

/** Fãs pagos por um giro, dado o resultado e a cadeia vigente na ENTRADA do giro. */
export function dribbleFans(defense: number, outcome: DribbleOutcome, chainBefore: number): number {
  if (outcome === 'failure') return 0;
  const base = dribbleFansBase(defense);
  if (outcome === 'success') return Math.round(base);
  return Math.round(base * 1.5 * perfectFanMultiplier(chainBefore));
}

/**
 * Executa um giro completo da roleta (SERVIDOR APENAS).
 * Rolagem r em [0,100): r < perfeito → Perfeito; r < chance → Sucesso; senão Falha.
 */
export function spinDribble(ctx: DribbleContext, rng: Rng): DribbleSpinResult {
  const chance = dribbleChance(ctx);
  const zone = perfectZone(chance, ctx.dribble);
  const roll = rng.next() * 100;
  const outcome: DribbleOutcome = roll < zone ? 'perfect' : roll < chance ? 'success' : 'failure';
  return {
    outcome,
    roll,
    chance,
    perfectZone: zone,
    fans: dribbleFans(ctx.defense, outcome, ctx.chain),
    nextPity: nextPity(ctx.pity, outcome),
    nextChain: nextChain(ctx.chain, outcome),
  };
}
