import Phaser from 'phaser';
import { FIELD_HEIGHT, FIELD_WIDTH } from '@idol/shared';
import { PlayScene } from './scenes/PlayScene.js';

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
  scene: [PlayScene],
});
