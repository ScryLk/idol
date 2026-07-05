import { Capacitor } from '@capacitor/core';

/**
 * Costura de plataforma: uma interface única com implementação Capacitor no
 * nativo e fallback web silencioso — o gameplay NUNCA depende de plugin.
 * Plugins carregados dinamicamente só quando rodando nativo.
 */

export type HapticKind = 'light' | 'success' | 'error';

export interface PlatformService {
  readonly isNative: boolean;
  /** Configura status bar/splash, back button Android e deep links. */
  init(options: { onBack: () => boolean }): Promise<void>;
  vibrate(kind: HapticKind): void;
}

class CapacitorPlatform implements PlatformService {
  readonly isNative = true;

  async init(options: { onBack: () => boolean }): Promise<void> {
    try {
      const [{ StatusBar, Style }, { SplashScreen }, { App }] = await Promise.all([
        import('@capacitor/status-bar'),
        import('@capacitor/splash-screen'),
        import('@capacitor/app'),
      ]);

      await StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
      await SplashScreen.hide().catch(() => undefined);

      // back button Android: a cena decide (voltar de tela / pausar); se não
      // consumir, minimiza o app em vez de fechar abrupto
      void App.addListener('backButton', ({ canGoBack }) => {
        if (options.onBack()) return;
        if (canGoBack) window.history.back();
        else void App.minimizeApp();
      });

      // deep link básico: idol://… ou https link com ?level=custom#payload
      void App.addListener('appUrlOpen', ({ url }) => {
        try {
          const incoming = new URL(url);
          const level = incoming.searchParams.get('level');
          if (level) {
            window.location.href = `${window.location.pathname}?level=${level}${incoming.hash}`;
          }
        } catch {
          // URL inválida: ignora
        }
      });
    } catch {
      // plugins ausentes: segue sem recursos nativos
    }
  }

  vibrate(kind: HapticKind): void {
    void import('@capacitor/haptics')
      .then(({ Haptics, ImpactStyle, NotificationType }) => {
        if (kind === 'light') return Haptics.impact({ style: ImpactStyle.Light });
        return Haptics.notification({
          type: kind === 'success' ? NotificationType.Success : NotificationType.Error,
        });
      })
      .catch(() => undefined);
  }
}

class WebPlatform implements PlatformService {
  readonly isNative = false;

  init(_options: { onBack: () => boolean }): Promise<void> {
    return Promise.resolve();
  }

  vibrate(kind: HapticKind): void {
    // fallback web: Vibration API quando existir (Android/Chrome)
    try {
      navigator.vibrate?.(kind === 'light' ? 15 : kind === 'success' ? [20, 40, 20] : [60, 40, 60]);
    } catch {
      // sem vibração: silencioso
    }
  }
}

export const platform: PlatformService = Capacitor.isNativePlatform()
  ? new CapacitorPlatform()
  : new WebPlatform();
