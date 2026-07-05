/**
 * Vidas com regeneração por timer — determinístico e sem relógio embutido:
 * quem chama passa `nowMs` (a API injeta um clock; testes usam clock fake).
 * Regra: 1 vida a cada 30 minutos até o teto de 5. O timer só corre quando
 * há vidas faltando; consumir com o estoque cheio inicia o timer na hora.
 */

export const LIVES_MAX = 5;
export const LIVES_REGEN_MINUTES = 30;
const REGEN_INTERVAL_MS = LIVES_REGEN_MINUTES * 60_000;

export interface LivesState {
  lives: number;
  /** Âncora do timer de regeneração (epoch ms). */
  updatedAtMs: number;
}

/** Aplica a regeneração pendente até `nowMs`. */
export function computeLives(state: LivesState, nowMs: number): LivesState {
  if (state.lives >= LIVES_MAX) return { lives: LIVES_MAX, updatedAtMs: nowMs };
  const elapsed = Math.max(0, nowMs - state.updatedAtMs);
  const gained = Math.floor(elapsed / REGEN_INTERVAL_MS);
  const lives = Math.min(LIVES_MAX, state.lives + gained);
  // âncora avança apenas pelos intervalos consumidos (não "perde" progresso)
  const updatedAtMs = lives >= LIVES_MAX ? nowMs : state.updatedAtMs + gained * REGEN_INTERVAL_MS;
  return { lives, updatedAtMs };
}

/** Consome 1 vida (após regenerar). Retorna null se não há vidas. */
export function consumeLife(state: LivesState, nowMs: number): LivesState | null {
  const cur = computeLives(state, nowMs);
  if (cur.lives <= 0) return null;
  // saindo do estoque cheio, o timer começa agora
  const updatedAtMs = cur.lives >= LIVES_MAX ? nowMs : cur.updatedAtMs;
  return { lives: cur.lives - 1, updatedAtMs };
}

/** Instante (epoch ms) da próxima vida, ou null se o estoque está cheio. */
export function nextLifeAtMs(state: LivesState, nowMs: number): number | null {
  const cur = computeLives(state, nowMs);
  if (cur.lives >= LIVES_MAX) return null;
  return cur.updatedAtMs + REGEN_INTERVAL_MS;
}
