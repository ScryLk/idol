/**
 * Progresso local do jogador (best-of de estrelas por nível), persistido em
 * localStorage — offline-first: funciona sem API e será sincronizado pela
 * fila de ações pendentes no M7.
 */

const KEY = 'idol:progress';

export type ProgressMap = Record<number, number>;

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadProgress(): ProgressMap {
  try {
    const raw = storage()?.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const out: ProgressMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      const ordinal = Number(k);
      const stars = Number(v);
      if (Number.isInteger(ordinal) && ordinal >= 1 && stars >= 0 && stars <= 3) {
        out[ordinal] = stars;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** Grava o MELHOR resultado do nível e retorna o mapa atualizado. */
export function recordStars(ordinal: number, stars: number): ProgressMap {
  const progress = loadProgress();
  const clamped = Math.max(0, Math.min(3, Math.round(stars)));
  if (clamped > (progress[ordinal] ?? 0)) progress[ordinal] = clamped;
  try {
    storage()?.setItem(KEY, JSON.stringify(progress));
  } catch {
    // storage cheio/indisponível: progresso segue em memória nesta sessão
  }
  return progress;
}
