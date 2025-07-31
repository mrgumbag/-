const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');
const finalScore = document.getElementById('final-score');

// Game settings
const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;
const PLAYER_WIDTH = 50;
const PLAYER_HEIGHT = 50;
const GROUND_OBSTACLE_WIDTH = 100;
const GROUND_OBSTACLE_HEIGHT = 100;
const AIR_OBSTACLE_WIDTH = 70;
const AIR_OBSTACLE_HEIGHT = 70;

// Game state
let score = 0;
let player = {};
let obstacles = [];
let gameSpeed = 5; // Base speed
let accelerationActive = false;
let timeStopActive = false;
let timeStopCooldown = 0;
let timeFactor = 1; // Affects player movement and gravity
let gameState = 'start'; // 'start', 'playing', 'gameOver'
let gameLoopId;

// Assets
const assets = {};
const assetPaths = {
  player: 'assets/player.png',
  ground_obstacle: 'assets/ground_obstacle.png',
  air_obstacle: 'assets/air_obstacle.png',
};

function loadAssets() {
  let loadedCount = 0;
  const totalAssets = Object.keys(assetPaths).length;

  return new Promise((resolve) => {
    for (const key in assetPaths) {
      const img = new Image();
      img.src = assetPaths[key];
      img.onload = () => {
        assets[key] = img;
        loadedCount++;
        if (loadedCount === totalAssets) {
          resolve();
        }
      };
      img.onerror = () => {
        console.error(`Failed to load image: ${assetPaths[key]}`);
        loadedCount++; // Still increment to avoid infinite loading
        if (loadedCount === totalAssets) {
          resolve();
        }
      };
    }
  });
}

// --- Player Object ---
function Player() {
  this.x = 50;
  this.y = GAME_HEIGHT - PLAYER_HEIGHT;
  this.width = PLAYER_WIDTH;
  this.height = PLAYER_HEIGHT;
  this.velocityY = 0;
  this.isJumping = false;

  this.draw = function() {
    ctx.drawImage(assets.player, this.x, this.y, this.width, this.height);
  };

  this.update = function() {
    if (this.isJumping) {
      this.y += this.velocityY * timeFactor;
      this.velocityY += 1 * timeFactor; // Gravity affected by time stop

      if (this.y >= GAME_HEIGHT - this.height) {
        this.y = GAME_HEIGHT - this.height;
        this.isJumping = false;
        this.velocityY = 0;
      }
      if (this.y < 0) {
        this.y = 0;
        this.velocityY = 0;
      }
    }
  };

  this.jump = function() {
    if (!this.isJumping) {
      this.isJumping = true;
      this.velocityY = -20;
    }
  };
}

// --- Obstacle Object ---
function Obstacle(type) {
  this.type = type;
  this.width = type === 'ground' ? GROUND_OBSTACLE_WIDTH : AIR_OBSTACLE_WIDTH;
  this.height = type === 'ground' ? GROUND_OBSTACLE_HEIGHT : AIR_OBSTACLE_HEIGHT;
  this.x = GAME_WIDTH;
  this.y = type === 'ground' ? GAME_HEIGHT - this.height : GAME_HEIGHT - this.height - 200; // Air obstacle higher

  this.draw = function() {
    const img = type === 'ground' ? assets.ground_obstacle : assets.air_obstacle;
    ctx.drawImage(img, this.x, this.y, this.width, this.height);
  };

  this.update = function() {
    this.x -= gameSpeed;
  };
}

// --- Pixel-perfect Collision Detection ---
function checkCollision(obj1, obj2) {
  console.log('checkCollision called');
  // 1. Bounding box collision (fast check)
  if (obj1.x < obj2.x + obj2.width &&
      obj1.x + obj1.width > obj2.x &&
      obj1.y < obj2.y + obj2.height &&
      obj1.y + obj1.height > obj2.y) {
    console.log('Bounding box collision detected');

    // 2. Pixel-perfect collision (slow, precise check)
    const img1 = obj1 === player ? assets.player : (obj1.type === 'ground' ? assets.ground_obstacle : assets.air_obstacle);
    const img2 = obj2 === player ? assets.player : (obj2.type === 'ground' ? assets.ground_obstacle : assets.air_obstacle);

    // Create temporary canvases to draw images and get pixel data
    const tempCanvas1 = document.createElement('canvas');
    const tempCtx1 = tempCanvas1.getContext('2d');
    tempCanvas1.width = obj1.width;
    tempCanvas1.height = obj1.height;
    tempCtx1.drawImage(img1, 0, 0, obj1.width, obj1.height);
    const data1 = tempCtx1.getImageData(0, 0, obj1.width, obj1.height).data;

    const tempCanvas2 = document.createElement('canvas');
    const tempCtx2 = tempCanvas2.getContext('2d');
    tempCanvas2.width = obj2.width;
    tempCanvas2.height = obj2.height;
    tempCtx2.drawImage(img2, 0, 0, obj2.width, obj2.height);
    const data2 = tempCtx2.getImageData(0, 0, obj2.width, obj2.height).data;

    // Calculate overlap area
    const xOverlap = Math.max(0, Math.min(obj1.x + obj1.width, obj2.x + obj2.width) - Math.max(obj1.x, obj2.x));
    const yOverlap = Math.max(0, Math.min(obj1.y + obj1.height, obj2.y + obj2.height) - Math.max(obj1.y, obj2.y));

    if (xOverlap === 0 || yOverlap === 0) return false; // No actual overlap

    const xStart = Math.max(0, Math.max(obj1.x, obj2.x) - obj1.x);
    const yStart = Math.max(0, Math.max(obj1.y, obj2.y) - obj1.y);

    for (let y = 0; y < yOverlap; y++) {
      for (let x = 0; x < xOverlap; x++) {
        const pixel1Alpha = data1[((yStart + y) * obj1.width + (xStart + x)) * 4 + 3];
        const pixel2Alpha = data2[((Math.max(0, Math.max(obj1.x, obj2.x) - obj2.x) + x) + (Math.max(0, Math.max(obj1.y, obj2.y) - obj2.y) + y) * obj2.width) * 4 + 3];

        if (pixel1Alpha > 0 && pixel2Alpha > 0) {
          console.log('Pixel-perfect collision detected!');
          return true; // Collision detected
        }
      }
    }
  }
  return false;
}

// --- Game Functions ---
function initGame() {
  player = new Player();
  obstacles = [];
  score = 0;
  gameSpeed = 5;
  accelerationActive = false;
  timeStopActive = false;
  timeStopCooldown = 0;
  timeFactor = 1;
  scoreDisplay.textContent = 'Score: 0';
}

function startGame() {
  initGame();
  startScreen.style.display = 'none';
  gameOverScreen.style.display = 'none';
  gameState = 'playing';
  if (gameLoopId) cancelAnimationFrame(gameLoopId);
  gameLoop();
}

function endGame() {
  gameState = 'gameOver';
  finalScore.textContent = score;
  gameOverScreen.style.display = 'flex';
}

function gameLoop() {
  // Clear canvas
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  if (gameState === 'playing') {
    // Update and draw player
    player.update();
    player.draw();

    // Create obstacles
    if (Math.random() < 0.02) {
      const type = Math.random() < 0.5 ? 'ground' : 'air';
      obstacles.push(new Obstacle(type));
    }

    // Update and draw obstacles, check collision
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obstacle = obstacles[i];
      obstacle.update();
      obstacle.draw();

      if (obstacle.x + obstacle.width < 0) {
        obstacles.splice(i, 1);
      }

      if (checkCollision(player, obstacle)) {
        endGame();
        // Do not return here, let the loop continue to draw game over screen
      }
    }

    // Update score
    score += accelerationActive ? 2 : 1;
    scoreDisplay.textContent = `Score: ${score}`;

    // Update cooldown
    if (timeStopCooldown > 0) {
      timeStopCooldown -= 1000 / 60; // roughly 1 second per frame at 60fps
    }
  }

  gameLoopId = requestAnimationFrame(gameLoop);
}

// --- Event Listeners ---
document.addEventListener('keydown', (e) => {
  if (gameState === 'start') {
    // Any key press starts the game from start screen
    startGame();
    return;
  }

  if (gameState !== 'playing') return;

  if (e.code === 'Space') {
    player.jump();
  }
  if (e.code === 'KeyA') {
    accelerationActive = !accelerationActive;
    gameSpeed = accelerationActive ? 10 : 5;
  }
  if (e.code === 'KeyS' && timeStopCooldown <= 0) {
    timeStopActive = true;
    timeStopCooldown = 30000; // 30 seconds cooldown
    gameSpeed = 2.5;
    timeFactor = 0.5;
    setTimeout(() => {
      timeStopActive = false;
      gameSpeed = accelerationActive ? 10 : 5;
      timeFactor = 1;
    }, 3000);
  }
});

startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);

// Initial setup
loadAssets().then(() => {
  console.log('All assets loaded successfully!');
  initGame();
  // Display start screen initially
  startScreen.style.display = 'flex';
  // Start the game loop to draw the initial state (e.g., start screen)
  gameLoop();
});