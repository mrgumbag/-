const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const difficultyDisplay = document.getElementById('difficulty-display');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');
const finalScore = document.getElementById('final-score');
const rankingButton = document.getElementById('ranking-button');
const rankingModal = document.getElementById('ranking-modal');
const rankingList = document.getElementById('ranking-list');
const gameBGM = document.getElementById('gameBGM');
const volumeSlider = document.getElementById('volume-slider');
const darkModeToggle = document.getElementById('dark-mode-toggle');

// Set initial BGM volume
gameBGM.volume = volumeSlider.value / 100;

// Add event listener for volume slider
volumeSlider.addEventListener('input', (e) => {
  gameBGM.volume = e.target.value / 100;
});

// Game settings
const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;
const PLAYER_WIDTH = 50;
const PLAYER_HEIGHT = 50;
const GROUND_OBSTACLE_WIDTH = 90;
const GROUND_OBSTACLE_HEIGHT = 90;
const AIR_OBSTACLE_WIDTH = 70;
const AIR_OBSTACLE_HEIGHT = 70;

const BIRD_OBSTACLE_WIDTH = 50;
const BIRD_OBSTACLE_HEIGHT = 50;
const BIRD_OBSTACLE_MIN_Y = GAME_HEIGHT - AIR_OBSTACLE_HEIGHT - 250; // Slightly above air obstacle
const BIRD_OBSTACLE_MAX_Y = 50; // Near the ceiling
const BIRD_SPAWN_MIN_FRAMES = 30; // 0.5 seconds at 60fps
const BIRD_SPAWN_MAX_FRAMES = 120; // 2 seconds at 60fps

const GRAVITY = 1 * 30; // Units per second squared (assuming 1 unit/frame at 60fps)
const BASE_JUMP_VELOCITY = -890; // Initial jump velocity
const DOUBLE_JUMP_MULTIPLIER = 0.75;

// Game state
let score = 0;
let player = {};
let obstacles = [];
let gameSpeed = 7; // Base speed in units per second
let accelerationActive = false;
let timeStopActive = false;
let timeStopCooldown = 0;
let timeFactor = 1; // Affects player movement and gravity
let lastObstacleType = 'none'; // 'none', 'ground', 'air'
const OBSTACLE_MIN_GAP_MS = 300; // Minimum 0.5 second gap between obstacles (in ms)
const BASE_OBSTACLE_SPAWN_CHANCE = 0.02; // Base chance to spawn an obstacle per frame
let consecutiveGroundObstaclesCount = 0; // Track consecutive ground obstacles
let spacebarPressed = false; // Track if spacebar is pressed
let timeSinceLastObstacle = 0; // New: Track time for obstacle spawning
let timeSinceLastBirdObstacle = 0; // New: Track time for bird obstacle spawning
const BIRD_SPAWN_MIN_MS = 500; // 0.5 seconds in ms
const BIRD_SPAWN_MAX_MS = 2000; // 2 seconds in ms
const SCORE_BASE_PER_SECOND = 60; // Base score gain per second
let nextBirdSpawnTime = 0; // New: Next time to spawn bird (in ms)
let gameState = 'start'; // 'start', 'playing', 'gameOver'
let gameLoopId;
let lastTime = 0; // For delta time calculation
let difficulty = 1; // New difficulty variable

// Assets
const assets = {};
const assetPaths = {
  player: 'assets/images/player.png',
  ground_obstacle: 'assets/images/ground_obstacle.png',
  air_obstacle: 'assets/images/air_obstacle.png',
  bird_obstacle: 'assets/images/bird_obstacle.png',
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
  this.jumpCount = 0; // Track current jumps
  this.maxJumps = 2; // Allow single and double jump

  this.draw = function() {
    ctx.drawImage(assets.player, this.x, this.y, this.width, this.height);
  };

  this.update = function(deltaTime) {
    if (this.isJumping) {
      this.y += this.velocityY * timeFactor * deltaTime;
      this.velocityY += GRAVITY * timeFactor * deltaTime; // Gravity affected by time stop

      if (this.y >= GAME_HEIGHT - this.height) {
        this.y = GAME_HEIGHT - this.height;
        this.isJumping = false;
        this.velocityY = 0;
        this.jumpCount = 0; // Reset jump count on landing
        if (spacebarPressed) {
          this.jump();
        }
      }
      if (this.y < 0) {
        this.y = 0;
      }
    }
  };

  this.jump = function() {
    if (this.jumpCount < this.maxJumps) {
      this.isJumping = true;
      this.velocityY = BASE_JUMP_VELOCITY; // Base jump velocity
      if (this.jumpCount === 1) { // If it's a double jump
        this.velocityY *= DOUBLE_JUMP_MULTIPLIER;
      }
      this.jumpCount++;
    }
  };
}

// --- Obstacle Object ---
function Obstacle(type) {
  this.type = type;
  this.width = 0;
  this.height = 0;
  this.x = GAME_WIDTH;
  this.y = 0;

  if (type === 'ground') {
    this.width = GROUND_OBSTACLE_WIDTH;
    this.height = GROUND_OBSTACLE_HEIGHT;
    this.y = GAME_HEIGHT - this.height;
  } else if (type === 'air') {
    this.width = AIR_OBSTACLE_WIDTH;
    this.height = AIR_OBSTACLE_HEIGHT;
    this.y = GAME_HEIGHT - this.height - 200; // Air obstacle higher
  } else if (type === 'bird') {
    this.width = BIRD_OBSTACLE_WIDTH;
    this.height = BIRD_OBSTACLE_HEIGHT;
    this.y = Math.random() * (BIRD_OBSTACLE_MIN_Y - BIRD_OBSTACLE_MAX_Y) + BIRD_OBSTACLE_MAX_Y; // Random height
  }

  this.draw = function() {
    let img;
    if (this.type === 'ground') {
      img = assets.ground_obstacle;
    } else if (this.type === 'air') {
      img = assets.air_obstacle;
    } else if (this.type === 'bird') {
      img = assets.bird_obstacle;

      ctx.save(); // Save the current canvas state
      ctx.translate(this.x + this.width / 2, this.y + this.height / 2); // Move origin to center of image
      ctx.rotate(-Math.PI / 2); // Rotate -90 degrees (counter-clockwise)
      ctx.drawImage(img, -this.width / 2, -this.height / 2, this.width, this.height); // Draw image at new origin
      ctx.restore(); // Restore the canvas state
      return; // Skip default drawImage
    }
    ctx.drawImage(img, this.x, this.y, this.width, this.height);
  };

  this.update = function(deltaTime) {
    this.x -= gameSpeed * deltaTime;
  };
}

// --- Pixel-perfect Collision Detection ---
function checkCollision(obj1, obj2) {
  // 1. Bounding box collision (fast check)
  if (Math.floor(obj1.x) < Math.floor(obj2.x) + obj2.width &&
      Math.floor(obj1.x) + obj1.width > Math.floor(obj2.x) &&
      Math.floor(obj1.y) < Math.floor(obj2.y) + obj2.height &&
      Math.floor(obj1.y) + obj1.height > Math.floor(obj2.y)) {

    // 2. Pixel-perfect collision (slow, precise check)
    const img1 = obj1 === player ? assets.player : (obj1.type === 'ground' ? assets.ground_obstacle : (obj1.type === 'air' ? assets.air_obstacle : assets.bird_obstacle));
    const img2 = obj2 === player ? assets.player : (obj2.type === 'ground' ? assets.ground_obstacle : (obj2.type === 'air' ? assets.air_obstacle : assets.bird_obstacle));

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
    const xOverlap = Math.max(0, Math.min(Math.floor(obj1.x) + obj1.width, Math.floor(obj2.x) + obj2.width) - Math.max(Math.floor(obj1.x), Math.floor(obj2.x)));
    const yOverlap = Math.max(0, Math.min(Math.floor(obj1.y) + obj1.height, Math.floor(obj2.y) + obj2.height) - Math.max(Math.floor(obj1.y), Math.floor(obj2.y)));

    if (xOverlap === 0 || yOverlap === 0) return false; // No actual overlap

    const xStart = Math.max(0, Math.floor(Math.max(obj1.x, obj2.x)) - Math.floor(obj1.x));
    const yStart = Math.max(0, Math.floor(Math.max(obj1.y, obj2.y)) - Math.floor(obj1.y));

    for (let y = 0; y < yOverlap; y++) {
      for (let x = 0; x < xOverlap; x++) {
        const pixel1Alpha = data1[((yStart + y) * obj1.width + (xStart + x)) * 4 + 3];
        // Calculate the corresponding pixel coordinates in obj2's local space
        // The x and y here are relative to the overlap area, so we need to convert them
        // to the local coordinates of obj2.
        const obj2PixelX = (Math.floor(Math.max(obj1.x, obj2.x)) - Math.floor(obj2.x)) + x;
        const obj2PixelY = (Math.floor(Math.max(obj1.y, obj2.y)) - Math.floor(obj2.y)) + y;
        const pixel2Alpha = data2[(obj2PixelY * obj2.width + obj2PixelX) * 4 + 3];

        if (pixel1Alpha > 0 && pixel2Alpha > 0) {
          console.log('Pixel-perfect collision detected! Calling endGame()...');
          return true; // Collision detected
        }
      }
    }
  }
  return false;
}

// --- Game Functions ---
function initGame() {
  console.log('initGame() called.');
  player = new Player();
  obstacles = [];
  score = 0;
  gameSpeed = 7;
  accelerationActive = false;
  timeStopActive = false;
  timeStopCooldown = 0;
  timeFactor = 1;
  lastObstacleType = 'none';
  consecutiveGroundObstaclesCount = 0;
  timeSinceLastObstacle = 0; // Initialize time for obstacle spawning
  timeSinceLastBirdObstacle = 0; // Initialize time for bird obstacle spawning
  nextBirdSpawnTime = Math.floor(Math.random() * (BIRD_SPAWN_MAX_MS - BIRD_SPAWN_MIN_MS + 1)) + BIRD_SPAWN_MIN_MS; // Set initial random spawn time for bird
  console.log(`  initGame - timeSinceLastObstacle: ${timeSinceLastObstacle}, timeSinceLastBirdObstacle: ${timeSinceLastBirdObstacle}, nextBirdSpawnTime: ${nextBirdSpawnTime}`);
  scoreDisplay.textContent = 'Score: 0';
  difficulty = 1; // Initialize difficulty
  difficultyDisplay.textContent = `Difficulty: ${difficulty.toFixed(1)}`;
}

function startGame() {
  initGame();
  startScreen.style.display = 'none';
  gameOverScreen.style.display = 'none';
  gameState = 'playing';
  if (gameLoopId) cancelAnimationFrame(gameLoopId);
  lastTime = 0; // Reset lastTime for delta time calculation
  gameBGM.play(); // Play BGM
  gameLoopId = requestAnimationFrame(gameLoop); // Call via requestAnimationFrame
}

function endGame() {
  gameState = 'gameOver';
  finalScore.textContent = score;
  gameOverScreen.style.display = 'flex';
  saveHighScore(score);
  gameBGM.pause(); // Pause BGM
  gameBGM.currentTime = 0; // Reset BGM to start
}

// --- High Score Functions ---
function getHighScores() {
  const highScores = JSON.parse(localStorage.getItem('highScores') || '[]');
  return highScores.sort((a, b) => b - a).slice(0, 10); // Top 10 scores
}

function saveHighScore(newScore) {
  const highScores = getHighScores();
  highScores.push(newScore);
  highScores.sort((a, b) => b - a);
  localStorage.setItem('highScores', JSON.stringify(highScores.slice(0, 10)));
}

function displayHighScores() {
  const highScores = getHighScores();
  rankingList.innerHTML = ''; // Clear previous list
  if (highScores.length === 0) {
    rankingList.innerHTML = '<li>아직 최고 점수가 없습니다.</li>';
  } else {
    highScores.forEach((s, index) => {
      const li = document.createElement('li');
      li.textContent = `${index + 1}. ${s} 점`;
      rankingList.appendChild(li);
    });
  }
  rankingModal.style.display = 'flex';
}

function gameLoop(timestamp) {
  if (lastTime === 0) { // First frame
    lastTime = timestamp;
  }
  const deltaTime = (timestamp - lastTime) / 1000; // Convert to seconds
  lastTime = timestamp;

  // Clear canvas
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  if (gameState === 'playing') {
    // Ensure deltaTime is a valid number to prevent NaN issues
    if (isNaN(deltaTime) || !isFinite(deltaTime)) {
      console.warn("Invalid deltaTime detected:", deltaTime);
      // Optionally, you can skip this frame or set deltaTime to a default value
      // For now, we'll just return to prevent further issues with NaN
      gameLoopId = requestAnimationFrame(gameLoop);
      return;
    }
    console.log(`DeltaTime: ${deltaTime.toFixed(4)}, GameSpeed: ${gameSpeed.toFixed(2)}, Score: ${Math.floor(score)}, Obstacles: ${obstacles.length}`);

    // Update and draw player
    player.update(deltaTime);
    player.draw();

    // Create obstacles
    timeSinceLastObstacle += deltaTime * 1000; // Convert to milliseconds
    timeSinceLastBirdObstacle += deltaTime * 1000; // Convert to milliseconds
    console.log(`Obstacle Time: ${timeSinceLastObstacle}/${OBSTACLE_MIN_GAP_MS}, Bird Time: ${timeSinceLastBirdObstacle}/${nextBirdSpawnTime}`);

    if (timeSinceLastObstacle >= OBSTACLE_MIN_GAP_MS && Math.random() < (BASE_OBSTACLE_SPAWN_CHANCE * difficulty)) {
      let type;
      // If last was ground and less than 3 consecutive, prioritize ground
      if (lastObstacleType === 'ground' && consecutiveGroundObstaclesCount < 3) {
        type = 'ground';
      } else if (lastObstacleType === 'air') {
        type = 'ground'; // After air, always try ground
      } else {
        type = Math.random() < 0.5 ? 'ground' : 'air';
      }

      // Ensure not more than 3 consecutive ground obstacles
      if (type === 'ground') {
        consecutiveGroundObstaclesCount++;
      } else {
        consecutiveGroundObstaclesCount = 0;
      }

      obstacles.push(new Obstacle(type));
      lastObstacleType = type;
      timeSinceLastObstacle = 0; // Reset time
    }

    // Bird obstacle spawning logic
    if (timeSinceLastBirdObstacle >= nextBirdSpawnTime) {
      obstacles.push(new Obstacle('bird'));
      timeSinceLastBirdObstacle = 0; // Reset time
      nextBirdSpawnTime = Math.floor(Math.random() * (BIRD_SPAWN_MAX_MS - BIRD_SPAWN_MIN_MS + 1)) + BIRD_SPAWN_MIN_MS; // Set next random spawn time
    }

    // Update and draw obstacles, check collision
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obstacle = obstacles[i];
      obstacle.update(deltaTime);
      obstacle.draw();

      if (obstacle.x + obstacle.width < 0) {
        obstacles.splice(i, 1);
      }

      if (checkCollision(player, obstacle)) {
        endGame();
        return; // Stop further updates and drawing in this frame after game over
      }
    }

    // Update score
    console.log(`Score update: score=${score}, accelerationActive=${accelerationActive}, deltaTime=${deltaTime}`);
    const previousScore = score;
    score += (accelerationActive ? 2 : 1) * deltaTime * SCORE_BASE_PER_SECOND; // Scale score by deltaTime for consistent gain
    scoreDisplay.textContent = `Score: ${Math.floor(score)}`;

    // Increase difficulty every 2000 points
    if (Math.floor(score / 2000) > Math.floor(previousScore / 2000)) {
      difficulty = parseFloat((difficulty + 0.1).toFixed(1)); // Ensure one decimal place
      console.log(`Difficulty increased to: ${difficulty}`);
      difficultyDisplay.textContent = `Difficulty: ${difficulty.toFixed(1)}`;
    }

    // Update cooldown
    if (timeStopCooldown > 0) {
      timeStopCooldown -= deltaTime * 1000; // Convert deltaTime to milliseconds
    }

    gameLoopId = requestAnimationFrame(gameLoop);
  } else if (gameState === 'gameOver') {
    // Do not request next frame if game is over
    return;
  }
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
    spacebarPressed = true;
  }
  if (e.code === 'KeyA') {
    accelerationActive = !accelerationActive;
    gameSpeed = accelerationActive ? 10.5 : 7;
  }
  if (e.code === 'KeyS' && timeStopCooldown <= 0) {
    timeStopActive = true;
    timeStopCooldown = 30000; // 30 seconds cooldown
    gameSpeed = 3.5;
    timeFactor = 0.5;
    setTimeout(() => {
      timeStopActive = false;
      gameSpeed = accelerationActive ? 10.5 : 7;
      timeFactor = 1;
    }, 3000);
  }
});

document.addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    spacebarPressed = false;
  }
});

startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);
rankingButton.addEventListener('click', displayHighScores);

const patchNotesButton = document.getElementById('patch-notes-button');
const patchNotesModal = document.getElementById('patch-notes-modal');
const closeButtons = document.querySelectorAll('.close-button'); // Select all close buttons
const patchNotesText = document.getElementById('patch-notes-text');

const currentPatchNotes = `0.5.4V
더블 점프 추가
조류 장애물 추가
기타 버그 수정`;

patchNotesButton.addEventListener('click', () => {
  patchNotesText.textContent = currentPatchNotes;
  patchNotesModal.style.display = 'flex';
});

closeButtons.forEach(button => {
  button.addEventListener('click', (event) => {
    const modalToClose = event.target.dataset.modal;
    if (modalToClose === 'patch-notes-modal') {
      patchNotesModal.style.display = 'none';
    } else if (modalToClose === 'ranking-modal') {
      rankingModal.style.display = 'none';
    }
  });
});

// Close modal if clicked outside
window.addEventListener('click', (event) => {
  if (event.target === patchNotesModal) {
    patchNotesModal.style.display = 'none';
  } else if (event.target === rankingModal) {
    rankingModal.style.display = 'none';
  }
});

// Initial setup
loadAssets().then(() => {
  console.log('All assets loaded successfully!');
  initGame();
  // Display start screen initially
  startScreen.style.display = 'flex';
  // Start the game loop to draw the initial state (e.g., start screen)
  gameLoop();
});