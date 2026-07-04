import type { ShotResult } from '@idol/shared';

/** Hook de teste E2E: o Playwright lê o resultado do último chute daqui. */
export interface E2EHook {
  ready: boolean;
  shots: number;
  lastOutcome: ShotResult['outcome'] | null;
}

declare global {
  interface Window {
    __IDOL_E2E__?: E2EHook;
  }
}
