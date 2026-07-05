import Phaser from 'phaser';
import { FIELD_HEIGHT, FIELD_WIDTH } from '@idol/shared';
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
