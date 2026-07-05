/**
 * Gates de estrelas da temporada 1 (mapa de carreira):
 * além de completar o nível anterior (≥1★), alguns níveis exigem um TOTAL
 * mínimo de estrelas na temporada — o jogador revisita níveis para melhorar.
 */

export const SEASON1_STAR_GATES: Readonly<Record<number, number>> = {
  4: 5,
  7: 10,
  10: 16,
};

/** Soma das melhores estrelas por nível. */
export function seasonTotalStars(starsByLevel: Readonly<Record<number, number>>): number {
  return Object.values(starsByLevel).reduce((sum, s) => sum + s, 0);
}

/**
 * Nível desbloqueado quando: é o primeiro, o anterior foi completado (≥1★)
 * e o total de estrelas cobre o gate (se houver).
 */
export function isLevelUnlocked(
  ordinal: number,
  starsByLevel: Readonly<Record<number, number>>,
): boolean {
  if (ordinal < 1) return false;
  if (ordinal === 1) return true;
  if ((starsByLevel[ordinal - 1] ?? 0) < 1) return false;
  return seasonTotalStars(starsByLevel) >= (SEASON1_STAR_GATES[ordinal] ?? 0);
}
