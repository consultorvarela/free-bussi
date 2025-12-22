import Phaser from 'phaser';
import { loadHighScores, saveHighScore, qualifiesForHighScore } from '../firebase.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.player = null;
    this.ground = null;
    this.obstacles = null;
    this.cursors = null;
    this.jumpKey = null;
    this.levelWidth = 20000;
    this.gameOver = false;
    this.playerState = 'idle';
    this.lastGroundedAt = 0;
    this.jumpBufferedAt = 0;
    this.pointerJumpQueued = false;
    this.coyoteTime = 120; // ms of leeway after leaving the ground
    this.jumpBuffer = 120; // ms to buffer jump input before landing
    this.baseJumpVelocity = -660;
    this.jumpVelocity = this.baseJumpVelocity;
    this.jumpCutMultiplier = 0.35; // stronger cut for tighter short hops
    this.fallGravityBoost = 420; // extra gravity applied when falling for snappier landings
    this.baseSpeed = 260; // starting forward speed
    this.speedRamp = 0.02; // base speed gain factor
    this.maxSpeed = 520; // capped to keep difficulty fair
    this.playerSpeed = this.baseSpeed;
    this.runStartTime = 0;
    this.nextSpawnAt = 0;
    this.spawnBaseInterval = 1400; // ms at start (easier)
    this.spawnMinInterval = 700; // ms cap to avoid unfair spam
    this.score = 0;
    this.scoreText = null;
    this.scoreSpeedFactor = 0.25; // additional speed per 100 points
    this.gameOverText = null;
    this.gameOverPanel = null;
    this.isEnteringInitials = false;
    this.initials = ['_', '_', '_', '_', '_', '_'];
    this.initialsIndex = 0;
    this.initialsText = null;
    this.initialsOverlay = null;
    this.initialsKeyHandler = null;
    this.initialsPointerHandler = null;
    this.powerIcon = null;
    this.powerMessage = null;
    this.powerMessageTween = null;
    this.powerRing = null;
    this.activePowerKey = null;
    this.activePowerEndsAt = 0;
    this.activePowerDuration = 0;
    this.powerups = null;
    this.powerSpawnAt = 0;
    this.powerSpawnMin = 5000;
    this.powerSpawnMax = 9000;
    this.isInvincible = false;
    this.isJumpBoosted = false;
    this.powerTimer = null;
    this.isSpinning = false;
    this.spinEndAt = 0;
    this.spinCooldownAt = 0;
    this.jumpSpinTween = null;
    this.baseBody = { width: 40, height: 28, offsetX: 7, offsetY: 6 };
    this.jumpSpinTween = null;
    this.currentLevel = 1;
    this.levelTransitionTriggered = false;
    this.finishLine = null;
    this.fireworks = null;
    this.isRestarting = false;
  }

  preload() {
    this.load.image('bus', 'assets/images/bus.png');
    this.load.image('background', 'assets/images/background.png');
    this.load.image('ground', 'assets/images/ground.png');
  }

  create() {
    try {
      // Build simple textures at runtime so no external assets are needed
      this.createPlaceholderTextures();
      
      this.resetState();
      this.createBackground();
      this.createWorld();
      this.createPlayer();
      this.createObstacles();
      this.createPowerups();
      this.createCamera();
      this.createControls();
      this.addHUD();
    } catch (e) {
      console.error(e);
      this.add.text(10, 10, 'Error: ' + e.message, { fill: '#ff0000', backgroundColor: '#000' }).setScrollFactor(0).setDepth(999);
    }
  }

  resetState() {
    // Reset per-run values so scene.restart() fully rebuilds state without a page refresh
    this.gameOver = false;
    this.score = 0;
    this.playerState = 'idle';
    this.playerSpeed = this.baseSpeed;
    this.runStartTime = this.time.now;
    this.nextSpawnAt = this.time.now + 800;
    this.lastGroundedAt = 0;
    this.jumpBufferedAt = 0;
    this.pointerJumpQueued = false;
    this.scoreText = null;
    this.gameOverText = null;
    this.isEnteringInitials = false;
    this.initials = ['_', '_', '_', '_', '_', '_'];
    this.initialsIndex = 0;
    this.initialsText = null;
    this.initialsOverlay = null;
    if (this.gameOverPanel) {
      this.gameOverPanel.destroy(true);
      this.gameOverPanel = null;
    }
    this.teardownInitialsInput();
    this.powerSpawnAt = this.time.now + Phaser.Math.Between(this.powerSpawnMin, this.powerSpawnMax);
    this.isInvincible = false;
    this.isJumpBoosted = false;
    this.jumpVelocity = this.baseJumpVelocity;
    this.powerIcon = null;
    this.powerMessage = null;
    this.powerRing = null;
    this.activePowerKey = null;
    this.activePowerEndsAt = 0;
    this.activePowerDuration = 0;
    if (this.powerMessageTween) {
      this.powerMessageTween.stop();
      this.powerMessageTween = null;
    }
    if (this.powerTimer) {
      this.powerTimer.remove(false);
      this.powerTimer = null;
    }
    this.isSpinning = false;
    this.spinEndAt = 0;
    this.spinCooldownAt = 0;
    // Reset level variables
    this.currentLevel = 1;
    this.levelTransitionTriggered = false;
    this.finishLine = null; // Will be recreated if needed
    this.isRestarting = false;
  }

  update() {
    if (this.gameOver) {
      if (this.isEnteringInitials) {
        return;
      }
      // Restart loop: wait for SPACE, UP arrow, or click, then restart
      const spacePressed = Phaser.Input.Keyboard.JustDown(this.jumpKey);
      const upPressed = Phaser.Input.Keyboard.JustDown(this.cursors.up);
      const anyPressed = spacePressed || upPressed;

      if (anyPressed) {
        this.restartFromUI();
      }
      return;
    }
    // Core game loop: collect input, apply physics impulses, spawn/cleanup obstacles, then update visuals
    // Core game loop: collect input, apply physics impulses, spawn/cleanup obstacles, then update visuals
    this.updateScore();
    this.checkLevelTransition();
    this.updateRunnerSpeed();
    this.handlePlayerInput();
    this.spawnObstaclesIfNeeded();
    this.spawnPowerupsIfNeeded();
    this.cleanupPowerups();
    this.cleanupObstacles();
    this.updateSpin();
    this.updatePlayerState();
    this.updatePowerRing();
  }

  createBackground() {
    // Background using the new asset
    // We use a TileSprite so it can scroll if we wanted, but here we just stretch it to cover the screen
    // or use it as a static background with scroll factor 0
    this.bg = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'background')
      .setOrigin(0, 0)
      .setScrollFactor(0);
    
    // Scale background to fit height if needed
    // Assuming the background image is landscape
    this.bg.setDisplaySize(this.scale.width, this.scale.height);
    this.bg.depth = -3;
  }

  createPlaceholderTextures() {
    // Bike + rider rectangle with wheels
    // Enhanced Bus Graphics
    const playerGfx = this.add.graphics();
    
    // Main body (Yellow)
    playerGfx.fillStyle(0xffd700, 1); // Gold/Yellow
    playerGfx.fillRoundedRect(0, 0, 60, 40, 8);
    
    // Roof/Stripe (Red)
    playerGfx.fillStyle(0xff4d4d, 1);
    playerGfx.fillRoundedRect(0, 0, 60, 12, { tl: 8, tr: 8, bl: 0, br: 0 });
    
    // Windows (Light Blue)
    playerGfx.fillStyle(0x87ceeb, 1);
    playerGfx.fillRect(5, 14, 14, 12);
    playerGfx.fillRect(23, 14, 14, 12);
    playerGfx.fillRect(41, 14, 14, 12);
    
    // Wheels (Black + Grey hubcap)
    playerGfx.fillStyle(0x333333, 1);
    playerGfx.fillCircle(14, 40, 7);
    playerGfx.fillCircle(46, 40, 7);
    playerGfx.fillStyle(0xcccccc, 1);
    playerGfx.fillCircle(14, 40, 3);
    playerGfx.fillCircle(46, 40, 3);

    playerGfx.generateTexture('player-bus-gfx', 60, 48);
    playerGfx.destroy();

    // Low obstacle: Traffic Cone
    const obstacleGfx = this.add.graphics();
    // Base
    obstacleGfx.fillStyle(0xff8c00, 1); // Dark Orange
    obstacleGfx.fillRoundedRect(4, 38, 38, 8, 2);
    // Cone body
    obstacleGfx.fillStyle(0xffa500, 1); // Orange
    obstacleGfx.beginPath();
    obstacleGfx.moveTo(8, 38);
    obstacleGfx.lineTo(23, 0);
    obstacleGfx.lineTo(38, 38);
    obstacleGfx.fillPath();
    // Stripes
    obstacleGfx.fillStyle(0xffffff, 1);
    obstacleGfx.beginPath();
    obstacleGfx.moveTo(13, 26);
    obstacleGfx.lineTo(23, 26);
    obstacleGfx.lineTo(33, 26);
    obstacleGfx.lineTo(31, 20);
    obstacleGfx.lineTo(15, 20);
    obstacleGfx.fillPath();
    
    obstacleGfx.generateTexture('obstacle', 46, 46);
    obstacleGfx.destroy();

    // High obstacle: Traffic Barrier / Sign
    const obstacleHighGfx = this.add.graphics();
    // Posts
    obstacleHighGfx.fillStyle(0x555555, 1);
    obstacleHighGfx.fillRect(8, 40, 6, 50);
    obstacleHighGfx.fillRect(32, 40, 6, 50);
    // Sign Board
    obstacleHighGfx.fillStyle(0xffd700, 1); // Yellow background
    obstacleHighGfx.fillRoundedRect(0, 0, 46, 46, 4);
    obstacleHighGfx.lineStyle(2, 0x000000);
    obstacleHighGfx.strokeRoundedRect(0, 0, 46, 46, 4);
    // Symbol (!)
    obstacleHighGfx.fillStyle(0x000000, 1);
    obstacleHighGfx.fillRect(21, 10, 4, 18);
    obstacleHighGfx.fillCircle(23, 34, 2.5);

    obstacleHighGfx.generateTexture('obstacle-high', 46, 90);
    obstacleHighGfx.destroy();

    // Ground patch - REMOVED (using image asset 'ground')
    /*
    const groundGfx = this.add.graphics();
    groundGfx.fillStyle(0x8dd16a, 1);
    groundGfx.fillRect(0, 0, 128, 32);
    groundGfx.generateTexture('ground', 128, 32);
    groundGfx.destroy();
    */

    // Power-ups
    const invGfx = this.add.graphics();
    invGfx.fillStyle(0xfff066, 1);
    invGfx.fillCircle(16, 16, 16);
    invGfx.lineStyle(3, 0xffb347);
    invGfx.strokeCircle(16, 16, 16);
    invGfx.generateTexture('power-invincible', 32, 32);
    invGfx.destroy();

    const boostGfx = this.add.graphics();
    boostGfx.fillStyle(0x7fffd4, 1);
    boostGfx.fillRoundedRect(0, 0, 32, 32, 8);
    boostGfx.lineStyle(3, 0x1fa27a);
    boostGfx.strokeRoundedRect(0, 0, 32, 32, 8);
    boostGfx.generateTexture('power-jump', 32, 32);
    boostGfx.destroy();

    // HUD icons (lightweight placeholders)
    const hudJump = this.add.graphics();
    hudJump.fillStyle(0xffe066, 1);
    hudJump.fillCircle(12, 12, 12);
    hudJump.lineStyle(3, 0xffc247);
    hudJump.strokeCircle(12, 12, 12);
    hudJump.generateTexture('hud-power-jump', 24, 24);
    hudJump.destroy();

    const hudInv = this.add.graphics();
    hudInv.fillStyle(0xfff7a7, 1);
    hudInv.fillRoundedRect(0, 0, 24, 24, 8);
    hudInv.lineStyle(3, 0xf0c94f);
    hudInv.strokeRoundedRect(0, 0, 24, 24, 8);
    hudInv.generateTexture('hud-power-inv', 24, 24);
    hudInv.destroy();

    // Procedural Desert Background
    const desertGfx = this.add.graphics();
    // Sky
    desertGfx.fillStyle(0x87CEEB, 1);
    desertGfx.fillRect(0, 0, 800, 600);
    // Sun
    desertGfx.fillStyle(0xFFD700, 1);
    desertGfx.fillCircle(700, 100, 40);
    // Dunes (Back)
    desertGfx.fillStyle(0xDEB887, 1); // Burlywood
    desertGfx.beginPath();
    desertGfx.moveTo(0, 400);
    desertGfx.lineTo(200, 350);
    desertGfx.lineTo(400, 420);
    desertGfx.lineTo(600, 380);
    desertGfx.lineTo(800, 400);
    desertGfx.lineTo(800, 600);
    desertGfx.lineTo(0, 600);
    desertGfx.fillPath();
    // Dunes (Front)
    desertGfx.fillStyle(0xD2B48C, 1); // Tan
    desertGfx.beginPath();
    desertGfx.moveTo(0, 500);
    desertGfx.lineTo(250, 450);
    desertGfx.lineTo(500, 520);
    desertGfx.lineTo(800, 480);
    desertGfx.lineTo(800, 600);
    desertGfx.lineTo(0, 600);
    desertGfx.fillPath();
    desertGfx.generateTexture('background-desert', 800, 600);
    desertGfx.destroy();

    // Finish Line Arch
    const finishGfx = this.add.graphics();
    // Poles
    finishGfx.fillStyle(0x888888, 1);
    finishGfx.fillRect(0, 0, 10, 200);
    finishGfx.fillRect(90, 0, 10, 200);
    // Banner
    finishGfx.fillStyle(0xFFFFFF, 1);
    finishGfx.fillRect(0, 20, 100, 40);
    // Checkers
    finishGfx.fillStyle(0x000000, 1);
    for(let r=0; r<2; r++) {
        for(let c=0; c<5; c++) {
            if ((r+c)%2===0) finishGfx.fillRect(10 + c*16, 20 + r*20, 16, 20);
        }
    }
    finishGfx.generateTexture('finish-line', 100, 200);
    finishGfx.destroy();
  }

  createWorld() {
    this.ground = this.physics.add.staticGroup();
    const groundY = this.scale.height - 40;
    for (let x = 0; x < this.levelWidth; x += 128) {
      const tile = this.ground.create(x + 64, groundY, 'ground');
      tile.setOrigin(0.5, 0.5);
      // Force size to match the loop spacing to avoid gaps/overlaps
      tile.setDisplaySize(128, 32);
      tile.refreshBody();
    }

    // Set world bounds so the camera and physics know the level size
    this.physics.world.setBounds(0, 0, this.levelWidth, this.scale.height);
  }

  createPlayer() {
    this.player = this.physics.add.sprite(120, this.scale.height - 140, 'player-bus-gfx');
    
    // Reset any previous scaling
    this.player.setScale(1);
    this.baseScaleX = 1;
    this.baseScaleY = 1;

    this.player.setCollideWorldBounds(true);
    // Adjust body to fit the new graphics (60x48 visual, but hitbox slightly smaller)
    this.player.body.setSize(50, 40);
    this.player.body.setOffset(5, 4);
    
    this.player.setDragX(1400);
    this.player.setMaxVelocity(360, 1000);
    this.player.body.setAllowRotation(false);

    this.physics.add.collider(this.player, this.ground);
  }

  createObstacles() {
    this.obstacles = this.physics.add.staticGroup();
    // Collide and restart when hitting an obstacle
    this.physics.add.collider(this.player, this.obstacles, (player, obstacle) => this.handleObstacleHit(player, obstacle));
  }

  createPowerups() {
    // Overlap (not collide) so collection doesn't resolve physics or pause movement
    this.powerups = this.physics.add.group({ allowGravity: false, immovable: true });
    this.physics.add.overlap(this.player, this.powerups, (player, power) => {
      // Defensive: power-ups should never trigger game over or pauses
      if (!power || this.gameOver) return;
      const key = power.texture.key;
      power.destroy();
      // Defer activation one tick so we exit the overlap resolution safely (prevents freezes)
      this.time.delayedCall(0, () => this.handlePowerupPickup(key));
    });
  }

  createCamera() {
    const camera = this.cameras.main;
    camera.setBounds(0, 0, this.levelWidth, this.scale.height);
    camera.startFollow(this.player, true, 0.15, 0.0); // Follow horizontally; keep y steady for readability
    camera.setDeadzone(this.scale.width * 0.25, this.scale.height);
  }

  createControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.jumpKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    // Touch/tap support: enqueue a jump attempt on pointer down to reuse the same buffered jump logic
    this.input.on('pointerdown', () => {
      if (!this.gameOver) {
        this.pointerJumpQueued = true;
      }
    });
  }

  addHUD() {
    this.add.text(16, 16, 'FRIENDS BUSSI', { fontSize: '20px', color: '#0b4b5a', fontStyle: 'bold' }).setScrollFactor(0);
    this.add.text(16, 42, 'Auto-run right. Jump to avoid obstacles.', { fontSize: '14px', color: '#0b4b5a' }).setScrollFactor(0);
    this.scoreText = this.add.text(this.scale.width - 16, 16, 'Score: 0', { fontSize: '20px', color: '#0b4b5a', fontStyle: 'bold' })
      .setScrollFactor(0)
      .setOrigin(1, 0);

    // Power-up HUD (fixed to screen)
    this.powerIcon = this.add.image(this.scale.width - 16, 48, 'hud-power-jump')
      .setScrollFactor(0)
      .setOrigin(1, 0)
      .setVisible(false)
      .setDepth(5);
    this.powerRing = this.add.graphics().setScrollFactor(0).setDepth(4);

    this.powerMessage = this.add.text(this.scale.width / 2, 18, '', {
      fontSize: '18px',
      color: '#0b4b5a',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(6).setAlpha(0);
  }

  updateScore() {
    if (!this.player) return;
    const distanceScore = Math.floor(this.player.x * 0.1);
    if (distanceScore !== this.score) {
      this.score = distanceScore;
      if (this.scoreText) {
        this.scoreText.setText(`Score: ${this.score}`);
      }
    }
  }

  updateRunnerSpeed() {
    // Difficulty factor grows over time but eases out and clamps to keep runs fair
    const elapsed = this.time.now - this.runStartTime;
    const normalized = Phaser.Math.Clamp(elapsed / 30000, 0, 1); // 0..1 over 30s
    const difficultyEase = Phaser.Math.Easing.Quadratic.Out(normalized);

    // Score still nudges speed but both contributions are capped by maxSpeed
    const scoreBoost = (this.score / 100) * this.scoreSpeedFactor;
    const rampFromTime = difficultyEase * 180; // add up to ~180 units from time ramp
    const target = this.baseSpeed + rampFromTime + scoreBoost;
    this.playerSpeed = Phaser.Math.Clamp(target, this.baseSpeed, this.maxSpeed);
  }

  handlePlayerInput() {
    if (!this.player || !this.player.body || this.gameOver) return;

    const now = this.time.now;
    const onGround = this.player.body.blocked.down;
    if (onGround) {
      this.lastGroundedAt = now;
    }

    // Auto-run forward; no manual horizontal input in runner mode
    this.player.setVelocityX(this.playerSpeed);
    this.player.setFlipX(false);

    // Buffer jump input and allow a tiny coyote window so jumps feel responsive
    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      Phaser.Input.Keyboard.JustDown(this.jumpKey) ||
      this.consumePointerJump();
    if (jumpPressed) {
      this.jumpBufferedAt = now;
    }

    const canUseBufferedJump = this.jumpBufferedAt && (onGround || now - this.lastGroundedAt <= this.coyoteTime);
    const bufferedStillValid = this.jumpBufferedAt && now - this.jumpBufferedAt <= this.jumpBuffer;

    if (bufferedStillValid && canUseBufferedJump) {
      this.player.setVelocityY(this.jumpVelocity);
      this.jumpBufferedAt = 0;
      this.playJumpSpin();
    }

    // Variable jump height: releasing jump early shortens airtime
    const jumpReleased = Phaser.Input.Keyboard.JustUp(this.cursors.up) || Phaser.Input.Keyboard.JustUp(this.jumpKey);
    if (jumpReleased && this.player.body.velocity.y < 0) {
      this.player.setVelocityY(this.player.body.velocity.y * this.jumpCutMultiplier);
    }

    // Spin/slide on ground with cooldown
    // Mid-air fast fall spin (down only works in-air)
    const downPressed = Phaser.Input.Keyboard.JustDown(this.cursors.down);
    if (downPressed && !onGround && !this.isSpinning && now >= this.spinCooldownAt) {
      this.startSpin(now);
      this.player.setVelocityY(Math.max(this.player.body.velocity.y, 600)); // nudge downward speed
    }

    // Stronger gravity when falling for snappier landings
    const falling = this.player.body.velocity.y > 0 && !onGround;
    this.player.body.setGravityY(falling ? this.fallGravityBoost : 0);
  }

  spawnObstaclesIfNeeded() {
    if (this.gameOver || !this.player) return;
    const now = this.time.now;
    if (now < this.nextSpawnAt) return;

    // Safe zone before Level 2 transition (at 500)
    // Stop spawning at 400 to give ~3 seconds of clear running before the finish line
    if (this.currentLevel === 1 && this.score > 400) {
        return;
    }

    // Frequency ramps up slowly with an eased, clamped difficulty factor to stay predictable
    const normalized = Phaser.Math.Clamp((now - this.runStartTime) / 30000, 0, 1); // 30s to full difficulty
    const difficultyEase = Phaser.Math.Easing.Cubic.Out(normalized);
    const interval = Phaser.Math.Linear(this.spawnBaseInterval, this.spawnMinInterval, difficultyEase);
    this.spawnRandomObstacle();
    this.nextSpawnAt = now + interval;
  }

  spawnPowerupsIfNeeded() {
    if (this.gameOver || !this.player) return;
    const now = this.time.now;
    if (now < this.powerSpawnAt) return;

    this.spawnRandomPowerup();
    this.powerSpawnAt = now + Phaser.Math.Between(this.powerSpawnMin, this.powerSpawnMax);
  }

  spawnRandomObstacle() {
    const camera = this.cameras.main;
    const spawnX = camera.scrollX + this.scale.width + Phaser.Math.Between(80, 220);
    const baseY = this.scale.height - 70;

    // High obstacles unlock after a short time; they will be used for a slide mechanic later.
    const allowHigh = (this.time.now - this.runStartTime) > 3000;
    const isHigh = allowHigh && Math.random() < 0.25;
    const key = isHigh ? 'obstacle-high' : 'obstacle';
    const obstacle = this.obstacles.create(spawnX, baseY, key);
    obstacle.setOrigin(0.5, 1);

    // Adjust hitbox to match visible area (not the full 46x46 texture)
    if (isHigh) {
      // High obstacle: sign board area
      obstacle.body.setSize(40, 80);
      obstacle.body.setOffset(3, 10);
    } else {
      // Low obstacle: cone triangle (x:8-38, y:0-38) = 30x38 visual
      // Hitbox slightly smaller for fair gameplay
      obstacle.body.setSize(26, 36);
      obstacle.body.setOffset(10, 6);
    }

    obstacle.refreshBody();
  }

  cleanupObstacles() {
    if (!this.obstacles || !this.obstacles.children) return;
    const cameraLeft = this.cameras.main.scrollX;
    this.obstacles.children.iterate((child) => {
      if (!child || !child.active) return;
      if (child.x < cameraLeft - 200) {
        child.destroy();
      }
    });
  }

  spawnRandomPowerup() {
    const camera = this.cameras.main;
    const spawnX = camera.scrollX + this.scale.width + Phaser.Math.Between(200, 420);
    const spawnY = this.scale.height - Phaser.Math.Between(120, 180); // hover above ground
    const key = Math.random() < 0.5 ? 'power-invincible' : 'power-jump';
    const power = this.powerups.create(spawnX, spawnY, key);
    power.setOrigin(0.5, 0.5);
    power.setImmovable(true);
    power.body.allowGravity = false;
  }

  cleanupPowerups() {
    if (!this.powerups || !this.powerups.children) return;
    const cameraLeft = this.cameras.main.scrollX;
    this.powerups.children.iterate((child) => {
      if (!child || !child.active) return;
      if (child.x < cameraLeft - 200) {
        child.destroy();
      }
    });
  }

  consumePointerJump() {
    if (this.pointerJumpQueued) {
      this.pointerJumpQueued = false;
      return true;
    }
    return false;
  }

  updatePlayerState() {
    if (!this.player || !this.player.body) return;

    const onGround = this.player.body.blocked.down;
    const moving = Math.abs(this.player.body.velocity.x) > 20;
    let newState = 'idle';

    if (!onGround) {
      newState = 'jump';
    } else if (moving) {
      newState = 'move';
    }

    if (newState !== this.playerState) {
      this.applyStateVisual(newState);
      this.playerState = newState;
    }

    // Reset angle when landing if any spin tween was active
    if (onGround) {
      if (this.jumpSpinTween) {
        this.jumpSpinTween.stop();
        this.jumpSpinTween = null;
      }
      if (!this.isSpinning && this.player.angle !== 0) {
        this.player.setAngle(0);
      }
    }

    this.applyRunEffects(onGround, moving);
  }

  applyStateVisual(state) {
    this.player.setTint(this.getActiveTint());
    this.player.setAlpha(1);
  }

  applyRunEffects(onGround, moving) {
    // Lightweight “animation” using scale/rotation; no external assets or spritesheets
    if (!this.player) return;
    if (this.isSpinning) return;
    const now = this.time.now;
    if (onGround && moving) {
      const bobScaleY = 1 + Math.sin(now * 0.02) * 0.04; // subtle vertical bob
      const leanBase = 5;
      const leanOsc = Math.sin(now * 0.08) * 2; // tiny oscillation to imply wheel spin
      this.player.setScale(this.baseScaleX, this.baseScaleY * bobScaleY);
      this.player.setAngle(leanBase + leanOsc);
    } else {
      // Reset visuals when idle or in-air (no double-tilt while jumping)
      this.player.setScale(this.baseScaleX, this.baseScaleY);
    }
  }

  handleObstacleHit(player, obstacle) {
    if (this.gameOver || !this.player || !this.player.body) return;
    if (this.isInvincible) {
      // Consume shield on first hit, restore normal color
      this.isInvincible = false;
      this.activePowerKey = null;
      this.applyStateVisual(this.playerState);
      if (obstacle && obstacle.destroy) obstacle.destroy();
      this.showPowerFeedback('shield-spent');
      return;
    }
    this.gameOver = true;
    this.isEnteringInitials = true; // Block input temporarily while loading

    this.physics.world.pause();
    this.cameras.main.shake(120, 0.01);
    this.player.setTint(0xff5252);
    this.player.setVelocity(0, 0);
    this.player.body.setGravityY(0);

    // Show loading message immediately
    const { centerX, centerY } = this.cameras.main;
    const loadingText = this.add.text(centerX, centerY, 'Loading...', {
      fontSize: '24px',
      color: '#0b4b5a',
      fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100);

    // Enter a paused state; load scores and show panel
    this.showGameOverMessage().then(() => {
      // Remove loading text
      if (loadingText) loadingText.destroy();
    });
  }

  async showGameOverMessage() {
    const { centerX, centerY } = this.cameras.main;
    const qualifies = await qualifiesForHighScore(this.score);
    if (qualifies) {
      this.showInitialsEntry(centerX, centerY);
      // isEnteringInitials already set to true in showInitialsEntry
      return;
    }
    const highScores = await loadHighScores();
    this.showGameOverPanel(centerX, centerY, highScores);
    // Unblock input so user can press SPACE to restart
    this.isEnteringInitials = false;
  }

  showGameOverPanel(centerX, centerY, highScores) {
    const panelWidth = 360;
    const panelHeight = 260;
    const baseY = centerY - panelHeight / 2;

    const bg = this.add.rectangle(centerX, centerY, panelWidth, panelHeight, 0xffffff, 0.92)
      .setStrokeStyle(3, 0x0b4b5a, 0.9)
      .setScrollFactor(0)
      .setDepth(9);

    const titleY = baseY + 30;
    const title = this.add.text(centerX, titleY, 'GAME OVER', {
      fontSize: '28px',
      color: '#0b4b5a',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10).setWordWrapWidth(panelWidth - 40);

    const listTitleY = titleY + 36;
    const listTitle = this.add.text(centerX, listTitleY, 'TOP 5', {
      fontSize: '18px',
      color: '#0b4b5a',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10);

    const listItems = highScores.map((entry, idx) => `${idx + 1}. ${(entry?.initials || '------').padEnd(6, ' ')} - ${entry?.score ?? 0}`);
    const listY = listTitleY + 26;
    const listText = this.add.text(centerX, listY, listItems.join('\n'), {
      fontSize: '16px',
      color: '#0b4b5a',
      align: 'center'
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(10).setWordWrapWidth(panelWidth - 40);

    const restartY = listY + (listItems.length * 18) + 24;
    const restart = this.add.text(centerX, restartY, 'Press SPACE to restart', {
      fontSize: '16px',
      color: '#0b4b5a',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10).setWordWrapWidth(panelWidth - 40);

    const restartHit = this.add.rectangle(centerX, restartY, panelWidth - 40, 44, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0)
      .setDepth(11);
    restartHit.on('pointerdown', () => this.restartFromUI());

    this.gameOverPanel = this.add.container(0, 0, [bg, title, listTitle, listText, restartHit, restart]);
  }

  showInitialsEntry(centerX, centerY) {
    this.isEnteringInitials = true;
    this.initials = ['_', '_', '_', '_', '_', '_'];
    this.initialsIndex = 0;

    const panelWidth = 420;
    const panelHeight = 220;
    const baseY = centerY - panelHeight / 2;

    const bg = this.add.rectangle(centerX, centerY, panelWidth, panelHeight, 0xffffff, 0.95)
      .setStrokeStyle(3, 0x0b4b5a, 0.9)
      .setScrollFactor(0)
      .setDepth(11);

    const title = this.add.text(centerX, baseY + 28, 'NEW HIGH SCORE!', {
      fontSize: '24px',
      color: '#0b4b5a',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(12);

    const prompt = this.add.text(centerX, baseY + 64, 'ENTER YOUR NAME', {
      fontSize: '16px',
      color: '#0b4b5a',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(12);

    this.initialsText = this.add.text(centerX, baseY + 110, this.initials.join(''), {
      fontSize: '28px',
      color: '#0b4b5a',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(12);

    const hint = this.add.text(centerX, baseY + 150, 'Keyboard: letters/backspace/enter\nTouch: tap LEFT to change letter, RIGHT to next/confirm', {
      fontSize: '12px',
      color: '#0b4b5a',
      align: 'center'
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(12).setWordWrapWidth(panelWidth - 40);

    this.initialsOverlay = this.add.container(0, 0, [bg, title, prompt, this.initialsText, hint]);

    this.initialsKeyHandler = (event) => this.handleInitialsKey(event);
    this.initialsPointerHandler = (pointer) => this.handleInitialsPointer(pointer);
    this.input.keyboard.on('keydown', this.initialsKeyHandler);
    this.input.on('pointerdown', this.initialsPointerHandler);
  }

  handleInitialsKey(event) {
    if (!this.isEnteringInitials) return;
    const key = event.key.toUpperCase();
    if (key === 'BACKSPACE') {
      this.initialsIndex = Math.max(0, this.initialsIndex - 1);
      this.initials[this.initialsIndex] = '_';
      this.updateInitialsText();
      return;
    }
    if (key === 'ENTER' || key === ' ') {
      this.submitInitials();
      return;
    }
    if (/^[A-Z]$/.test(key)) {
      this.initials[this.initialsIndex] = key;
      if (this.initialsIndex < 5) {
        this.initialsIndex += 1;
      }
      this.updateInitialsText();
    }
  }

  handleInitialsPointer(pointer) {
    if (!this.isEnteringInitials) return;
    const leftSide = pointer.x < this.scale.width / 2;
    if (leftSide) {
      // Cycle current letter forward (including underscore)
      const currentChar = this.initials[this.initialsIndex];
      if (currentChar === '_') {
        this.initials[this.initialsIndex] = 'A';
      } else {
        const current = currentChar.charCodeAt(0) - 65;
        const next = (current + 1) % 26;
        this.initials[this.initialsIndex] = String.fromCharCode(65 + next);
      }
      this.updateInitialsText();
    } else {
      // Move to next letter or submit
      if (this.initialsIndex < 5) {
        this.initialsIndex += 1;
      } else {
        this.submitInitials();
      }
      this.updateInitialsText();
    }
  }

  async submitInitials() {
    if (!this.isEnteringInitials) return;
    // Reemplazar guiones bajos con espacios vacíos
    const initials = this.initials.join('').replace(/_/g, ' ').trim();

    // Validar que tenga al menos un carácter
    if (initials.length === 0) {
      console.warn('No initials entered, using default');
      this.teardownInitialsInput();
      const updated = await saveHighScore(this.score, 'PLAYER');
      this.showGameOverPanel(this.cameras.main.centerX, this.cameras.main.centerY, updated);
      return;
    }

    console.log('Submitting score:', this.score, 'with initials:', initials);
    this.teardownInitialsInput();
    const updated = await saveHighScore(this.score, initials);
    console.log('High scores updated:', updated);
    this.showGameOverPanel(this.cameras.main.centerX, this.cameras.main.centerY, updated);
  }

  updateInitialsText() {
    if (!this.initialsText) return;
    this.initialsText.setText(this.initials.join(''));
  }

  teardownInitialsInput() {
    if (this.initialsKeyHandler) {
      this.input.keyboard.off('keydown', this.initialsKeyHandler);
      this.initialsKeyHandler = null;
    }
    if (this.initialsPointerHandler) {
      this.input.off('pointerdown', this.initialsPointerHandler);
      this.initialsPointerHandler = null;
    }
    if (this.initialsOverlay) {
      this.initialsOverlay.destroy(true);
      this.initialsOverlay = null;
    }
    this.isEnteringInitials = false;
  }

  restartFromUI() {
    if (!this.gameOver || this.isEnteringInitials || this.isRestarting) return;

    // Marcar que estamos reiniciando para evitar doble click
    this.isRestarting = true;

    // Destruir panel de Game Over primero
    if (this.gameOverPanel) {
      this.gameOverPanel.destroy(true);
      this.gameOverPanel = null;
    }

    // Limpiar cualquier input handler que pueda quedar
    this.teardownInitialsInput();

    // Pequeño delay para asegurar que todo se destruya antes de reiniciar
    this.time.delayedCall(100, () => {
      this.physics.world.resume();
      this.scene.restart();
    });
  }

  startSpin(now) {
    this.isSpinning = true;
    this.spinEndAt = now + 350;
    this.spinCooldownAt = now + 650; // small buffer to avoid spam
    this.tweens.add({
      targets: this.player,
      angle: this.player.angle + 360,
      duration: 350,
      ease: 'Cubic.InOut'
    });
  }

  updateSpin() {
    if (!this.isSpinning) return;
    const now = this.time.now;
    if (now >= this.spinEndAt) {
      this.isSpinning = false;
      if (this.jumpSpinTween) {
        this.jumpSpinTween.stop();
        this.jumpSpinTween = null;
      }
    }
  }

  handlePowerupPickup(key) {
    if (this.gameOver) return;
    if (key === 'power-invincible') {
      // Invincibility is a single-hit shield; ignore if already active
      if (this.isInvincible) return;
      this.isJumpBoosted = false; // cancel other power to keep single active
      this.activateInvincibility();
    } else if (key === 'power-jump') {
      // Ignore jump boost if shield active
      if (this.isInvincible) return;
      this.activateJumpBoost();
    }
  }

  playJumpSpin() {
    // Prevent stacking; skip if fast-fall spin is active
    if (this.isSpinning) return;
    if (this.jumpSpinTween && this.jumpSpinTween.isPlaying()) return;
    this.jumpSpinTween = this.tweens.add({
      targets: this.player,
      angle: 360,
      duration: 400,
      ease: 'Quad.Out',
      onComplete: () => {
        this.jumpSpinTween = null;
      }
    });
  }

  getActiveTint() {
    if (this.isInvincible) return 0xfff066;
    if (this.isJumpBoosted) return 0x7fffd4;
    return 0xffffff;
  }

  activateInvincibility() {
    // Single-hit shield; no duration, ignore if already active
    if (this.isInvincible) return;
    this.isInvincible = true;
    this.activePowerKey = 'power-invincible';
    this.activePowerDuration = 0;
    this.activePowerEndsAt = 0;
    this.applyStateVisual(this.playerState);
    this.showPowerFeedback('power-invincible');
    this.playPowerSound();
  }

  activateJumpBoost() {
    this.isJumpBoosted = true;
    this.jumpVelocity = this.baseJumpVelocity * 1.25;
    this.activePowerKey = 'power-jump';
    this.activePowerDuration = 4000;
    this.activePowerEndsAt = this.time.now + this.activePowerDuration;
    this.applyStateVisual(this.playerState);
    this.showPowerFeedback('power-jump');
    this.playPowerSound();
    this.schedulePowerClear(4000);
  }

  schedulePowerClear(durationMs) {
    if (this.powerTimer) {
      this.powerTimer.remove(false);
    }
    this.powerTimer = this.time.delayedCall(durationMs, () => this.clearPowerups());
  }

  clearPowerups() {
    this.isInvincible = false;
    this.isJumpBoosted = false;
    this.jumpVelocity = this.baseJumpVelocity;
    this.applyStateVisual(this.playerState);
    if (this.powerIcon) {
      this.powerIcon.setVisible(false);
    }
    if (this.powerMessage) {
      this.powerMessage.setAlpha(0);
    }
    if (this.powerRing) {
      this.powerRing.clear();
    }
    this.activePowerKey = null;
    this.activePowerDuration = 0;
    this.activePowerEndsAt = 0;
    this.powerTimer = null;
  }

  showPowerFeedback(key) {
    const meta = this.getPowerMeta(key);
    if (this.powerIcon && meta.icon) {
      this.powerIcon.setTexture(meta.icon);
      this.powerIcon.setVisible(true);
    }
    if (!this.powerMessage) return;
    this.powerMessage.setText(meta.message || '');
    if (this.powerMessageTween) {
      this.powerMessageTween.stop();
    }
    this.powerMessage.setAlpha(0);
    this.powerMessageTween = this.tweens.add({
      targets: this.powerMessage,
      alpha: 1,
      duration: 200,
      ease: 'Quad.Out',
      yoyo: true,
      hold: 900,
      onComplete: () => { this.powerMessageTween = null; }
    });
  }

  getPowerMeta(key) {
    const map = {
      'power-invincible': {
        icon: 'hud-power-inv',
        message: 'ESCUDO ACTIVO'
      },
      'shield-spent': {
        icon: 'hud-power-inv',
        message: 'ESCUDO CONSUMIDO'
      },
      'power-jump': {
        icon: 'hud-power-jump',
        message: 'SUPER SALTO ACTIVADO'
      }
    };
    return map[key] || {};
  }


  checkLevelTransition() {
    if (this.currentLevel === 1 && this.score >= 500 && !this.levelTransitionTriggered) {
      this.triggerLevelTransition();
    }
  }

  triggerLevelTransition() { 
    this.levelTransitionTriggered = true;
    
    // Spawn Finish Line ahead of player
    const camera = this.cameras.main;
    const spawnX = camera.scrollX + this.scale.width + 100;
    const groundY = this.scale.height - 40;
    
    this.finishLine = this.physics.add.image(spawnX, groundY, 'finish-line');
    this.finishLine.setOrigin(0.5, 1);
    this.finishLine.body.setAllowGravity(false);
    this.finishLine.body.setImmovable(true);
    
    // Detect overlap to trigger fireworks and switch
    this.physics.add.overlap(this.player, this.finishLine, () => {
        if (this.currentLevel === 1) {
            this.completeLevelOne();
        }
    });
  }

  completeLevelOne() {
    this.currentLevel = 2; // Prevent multiple triggers
    
    // Fireworks Effect
    const particles = this.add.particles(0, 0, 'power-jump', {
        speed: { min: -200, max: 200 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.5, end: 0 },
        blendMode: 'ADD',
        lifespan: 1000,
        gravityY: 200,
        quantity: 20,
        emitting: false
    });
    
    // Burst 1
    particles.explode(50, this.player.x, this.player.y - 100);
    // Burst 2
    this.time.delayedCall(300, () => particles.explode(50, this.player.x + 50, this.player.y - 150));
    // Burst 3
    this.time.delayedCall(600, () => particles.explode(50, this.player.x - 50, this.player.y - 120));

    // Text Feedback
    const levelText = this.add.text(this.player.x, this.player.y - 100, 'LEVEL 2: DESERT!', {
        fontSize: '32px',
        color: '#ff0000',
        fontStyle: 'bold',
        stroke: '#ffffff',
        strokeThickness: 4
    }).setOrigin(0.5);
    
    this.tweens.add({
        targets: levelText,
        y: levelText.y - 50,
        alpha: 0,
        duration: 2000,
        onComplete: () => levelText.destroy()
    });

    // Change Background
    if (this.bg) {
        this.bg.setTexture('background-desert');
    }

    // Tint Ground to look like sand
    if (this.ground) {
        this.ground.children.iterate((child) => {
            if (child) child.setTint(0xddc98c);
        });
    }

    // Pause obstacle spawning for 3 seconds (Safe Zone)
    this.nextSpawnAt = this.time.now + 3000;
    
    // Cleanup finish line after it passes screen
    this.time.delayedCall(3000, () => {
        if (this.finishLine) {
            this.finishLine.destroy();
            this.finishLine = null;
        }
        particles.destroy();
    });
  }

  updatePowerRing() {
    if (!this.powerRing) return;
    this.powerRing.clear();
    if (!this.activePowerKey || !this.activePowerEndsAt || !this.activePowerDuration) return;
    const remaining = this.activePowerEndsAt - this.time.now;
    if (remaining <= 0) return;
    const ratio = Phaser.Math.Clamp(remaining / this.activePowerDuration, 0, 1);
    const centerX = this.scale.width - 40;
    const centerY = 60;
    const radius = 16;
    this.powerRing.lineStyle(3, 0x0b4b5a, 0.9);
    this.powerRing.beginPath();
    this.powerRing.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio, false);
    this.powerRing.strokePath();
  }

  playPowerSound() {
    // Lightweight synth beep; runs without pausing or assets
    const ctx = this.sound.context;
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(760, now);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }
}
