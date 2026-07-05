import { FAN_TIERS, type FanTier, type FanTierId } from '../formulas/fans.js';

/**
 * Clubes para transferência — desbloqueados pelo tier de fãs.
 * Trocar de clube é cosmético no MVP (camisa/identidade); salário vem dos
 * patrocínios. Dois clubes por tier.
 */

export interface Club {
  id: string;
  name: string;
  minTier: FanTierId;
  /** Cor primária da camisa (hex, para a UI). */
  color: number;
}

export const CLUBS: readonly Club[] = [
  { id: 'varzea-fc', name: 'Várzea FC', minTier: 'amador', color: 0x8d6e63 },
  { id: 'unidos-da-vila', name: 'Unidos da Vila', minTier: 'amador', color: 0x789262 },
  { id: 'operario-local', name: 'Operário do Bairro', minTier: 'local', color: 0x455a64 },
  { id: 'estrela-do-norte', name: 'Estrela do Norte', minTier: 'local', color: 0xf9a825 },
  { id: 'atletico-regional', name: 'Atlético Regional', minTier: 'regional', color: 0xc62828 },
  { id: 'ferroviario-sc', name: 'Ferroviário SC', minTier: 'regional', color: 0x6a1b9a },
  { id: 'capital-united', name: 'Capital United', minTier: 'nacional', color: 0x1565c0 },
  { id: 'tricolor-nacional', name: 'Tricolor Nacional', minTier: 'nacional', color: 0x2e7d32 },
  { id: 'continental-fc', name: 'Continental FC', minTier: 'global', color: 0x00838f },
  { id: 'galacticos', name: 'Galácticos', minTier: 'global', color: 0xffd740 },
] as const;

const tierIndex = (id: FanTierId): number => FAN_TIERS.findIndex((t) => t.id === id);

/** Clubes elegíveis para um tier (o do jogador ou abaixo). */
export function clubsForTier(tier: FanTier): Club[] {
  return CLUBS.filter((c) => tierIndex(c.minTier) <= tierIndex(tier.id));
}
