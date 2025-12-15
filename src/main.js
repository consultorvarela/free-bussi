import Phaser from 'phaser';
import StartScene from './scenes/StartScene.js';
import GameScene from './scenes/GameScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 960,
  height: 540,
  backgroundColor: '#def2ff',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 1200 },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [StartScene, GameScene]
};

window.addEventListener('load', () => {
  // Boot the Phaser game once the page is ready
  new Phaser.Game(config);
});
