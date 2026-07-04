import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';

/** Resolução base portrait — requisito mobile-first do projeto. */
export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0a3d0a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: [BootScene],
});
