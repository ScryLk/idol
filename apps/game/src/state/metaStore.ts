import { createStore } from 'zustand/vanilla';
import { tierForFans, type FanTier } from '@idol/shared';

/**
 * Estado meta-jogo FORA do Phaser (Zustand vanilla — o cliente não usa React).
 * O M0 traz apenas o esqueleto; carteira/contratos/vidas entram no M4.
 */
interface MetaState {
  fans: number;
  tier: FanTier;
  setFans(fans: number): void;
}

export const metaStore = createStore<MetaState>((set) => ({
  fans: 500,
  tier: tierForFans(500),
  setFans: (fans) => set({ fans, tier: tierForFans(fans) }),
}));
