import type { LevelPhase, ShotResult } from '@idol/shared';

/** Hook de teste E2E: o Playwright lê o estado do nível daqui. */
export interface E2EHook {
  ready: boolean;
  shots: number;
  lastOutcome: ShotResult['outcome'] | null;
  level: number;
  phase: LevelPhase;
  touches: number;
  passes: number;
  rewinds: number;
  stars: number;
}

declare global {
  interface Window {
    __IDOL_E2E__?: E2EHook;
  }
}
