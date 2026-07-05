import Phaser from 'phaser';
import { FIELD_HEIGHT, FIELD_WIDTH } from '@idol/shared';
import { EditScene } from './scenes/EditScene.js';
import { PlaytestScene } from './scenes/PlaytestScene.js';
import { mountSidebar } from './ui/sidebar.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'editor-canvas',
  backgroundColor: '#10141a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: FIELD_WIDTH,
    height: FIELD_HEIGHT,
  },
  scene: [EditScene, PlaytestScene],
});

const sidebar = document.getElementById('sidebar');
if (sidebar) {
  mountSidebar(sidebar, () => {
    game.scene.stop('edit');
    game.scene.start('playtest');
  });
}

// hook de E2E/depuração
import type { EditorStore } from './state/editorStore.js';
import { editorStore } from './state/editorStore.js';
declare global {
  interface Window {
    __IDOL_EDITOR__?: EditorStore;
  }
}
window.__IDOL_EDITOR__ = editorStore;
