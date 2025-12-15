import Phaser from 'phaser';

export default class StartScene extends Phaser.Scene {
  constructor() {
    super('StartScene');
    this.startButton = null;
    this.titleText = null;
    this.hintText = null;
  }

  create() {
    const { width, height } = this.scale;

    // Simple background
    this.add.rectangle(0, 0, width * 2, height * 2, 0xdaf0ff).setOrigin(0, 0);

    this.titleText = this.add.text(width / 2, height * 0.32, 'BUSSI RUNNER', {
      fontSize: '40px',
      color: '#0b4b5a',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const btnWidth = 220;
    const btnHeight = 80;
    const btnY = height * 0.52;

    const buttonBg = this.add.rectangle(width / 2, btnY, btnWidth, btnHeight, 0x0b4b5a, 1)
      .setStrokeStyle(3, 0x08323d, 1)
      .setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
    const buttonLabel = this.add.text(width / 2, btnY, 'START', {
      fontSize: '26px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.startButton = this.add.container(0, 0, [buttonBg, buttonLabel]);

    this.hintText = this.add.text(width / 2, height * 0.68, 'Tap to Jump • Space to Jump', {
      fontSize: '18px',
      color: '#0b4b5a'
    }).setOrigin(0.5);

    buttonBg.on('pointerdown', () => this.startGame());
    this.input.keyboard.once('keydown-SPACE', () => this.startGame());
  }

  startGame() {
    this.scene.start('GameScene');
  }
}
