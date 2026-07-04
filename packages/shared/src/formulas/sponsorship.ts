import type { FanTier } from './fans.js';

/**
 * Patrocínios com trade-off — fórmulas canônicas (valores base por partida;
 * o PAGAMENTO em dinheiro é multiplicado pelo multiplicador do tier de fãs).
 *
 * Autêntico:   +150 fãs/partida, $250/partida
 * Equilibrado: +40 fãs/partida,  $600/partida
 * Mercenário:  -120 fãs/partida, $1500/partida
 * Contratos duram 10 partidas; slots: 1 (início) → 3 (late game).
 */

export type SponsorArchetype = 'autentico' | 'equilibrado' | 'mercenario';

export interface SponsorArchetypeSpec {
  id: SponsorArchetype;
  name: string;
  /** Delta de fãs por partida (pode ser negativo — o trade-off). */
  fansPerMatch: number;
  /** Pagamento base em dinheiro por partida, antes do multiplicador de tier. */
  basePayPerMatch: number;
}

export const SPONSOR_ARCHETYPES: Readonly<Record<SponsorArchetype, SponsorArchetypeSpec>> = {
  autentico: { id: 'autentico', name: 'Autêntico', fansPerMatch: 150, basePayPerMatch: 250 },
  equilibrado: { id: 'equilibrado', name: 'Equilibrado', fansPerMatch: 40, basePayPerMatch: 600 },
  mercenario: { id: 'mercenario', name: 'Mercenário', fansPerMatch: -120, basePayPerMatch: 1500 },
} as const;

export const CONTRACT_DURATION_MATCHES = 10;

/** Pagamento em dinheiro de uma partida sob contrato, já multiplicado pelo tier. */
export function sponsorPayout(archetype: SponsorArchetype, tier: FanTier): number {
  return Math.round(SPONSOR_ARCHETYPES[archetype].basePayPerMatch * tier.multiplier);
}

/** Delta de fãs de uma partida sob contrato (NÃO é multiplicado pelo tier). */
export function sponsorFanDelta(archetype: SponsorArchetype): number {
  return SPONSOR_ARCHETYPES[archetype].fansPerMatch;
}

/**
 * Slots de contrato simultâneos por tier de fãs.
 * Decisão de projeto (doc omisso): 1 slot (Amador/Local) → 2 (Regional) → 3 (Nacional/Global).
 */
export function sponsorSlots(tier: FanTier): number {
  switch (tier.id) {
    case 'amador':
    case 'local':
      return 1;
    case 'regional':
      return 2;
    case 'nacional':
    case 'global':
      return 3;
  }
}
