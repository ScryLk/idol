import Phaser from 'phaser';
import { FIELD_HEIGHT, FIELD_WIDTH } from '@idol/shared';
import { apiClient } from './api/ApiClient.js';
import { platform } from './platform/PlatformService.js';
import { CustomizeScene } from './scenes/CustomizeScene.js';
import { LevelScene } from './scenes/LevelScene.js';
import { MetaScene } from './scenes/MetaScene.js';
import { SeasonMapScene } from './scenes/SeasonMapScene.js';
import { TransferScene } from './scenes/TransferScene.js';

/** Roteia a cena inicial: ?level=… vai direto ao nível; senão, mapa. */
class RouterScene extends Phaser.Scene {
  constructor() {
    super('router');
  }
  create(): void {
    const params = new URLSearchParams(window.location.search);
    this.scene.start(params.has('level') ? 'level' : 'map');
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0a3d0a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    // Resolução base portrait — requisito mobile-first do projeto
    width: FIELD_WIDTH,
    height: FIELD_HEIGHT,
  },
  scene: [RouterScene, SeasonMapScene, LevelScene, MetaScene, TransferScene, CustomizeScene],
});

// plataforma nativa: status bar/splash, back button Android e deep links.
// Back em cena de nível volta ao mapa; no mapa, deixa o SO minimizar.
void platform.init({
  onBack: () => {
    if (new URLSearchParams(window.location.search).has('level')) {
      window.location.href = window.location.pathname;
      return true;
    }
    return false;
  },
});

// sync da fila offline: ao voltar a conexão e no boot com sessão válida
async function syncPending(): Promise<void> {
  if (apiClient.available && (await apiClient.ensureSession())) {
    await apiClient.flushPending();
  }
}
window.addEventListener('online', () => void syncPending());
void syncPending();
