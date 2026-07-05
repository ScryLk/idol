import type { DribbleOutcome, LevelPhase, ShotResult } from '@idol/shared';

/** Hook de teste E2E: cada cena publica o próprio estado aqui. */
export interface E2EHook {
  ready: boolean;
  /** Tela ativa (map | level | ...). Cenas de nível não setam obrigatoriamente. */
  screen?: string;
  // --- mapa ---
  totalStars?: number;
  unlockedLevels?: number[];
  // --- nível ---
  shots?: number;
  lastOutcome?: ShotResult['outcome'] | null;
  level?: number;
  phase?: LevelPhase;
  touches?: number;
  passes?: number;
  rewinds?: number;
  stars?: number;
  dribbleAvailable?: boolean;
  lastDribble?: DribbleOutcome | null;
  perfectDribbles?: number;
  dribbleChain?: number;
}

declare global {
  interface Window {
    __IDOL_E2E__?: E2EHook;
  }
}
