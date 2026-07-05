import type { CapacitorConfig } from '@capacitor/cli';

/**
 * O app nativo embala o MESMO build do Vite (webDir: dist) — uma única base
 * de código web. Alvo primário: Android (Play Store); iOS preparado.
 */
const config: CapacitorConfig = {
  appId: 'dev.idol.game',
  appName: 'IDOL',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#0a3d0a',
      launchAutoHide: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a3d0a',
    },
  },
};

export default config;
