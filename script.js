const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const difficultyDisplay = document.getElementById('difficulty-display');
const currentSongDisplay = document.getElementById('current-song-display');
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
const changeSongButton = document.getElementById('music-selection-button');
const musicSelectionModal = document.getElementById('music-selection-modal');
const musicList = document = document.getElementById('music-list');
const settingsButton = document.getElementById('settings-button');
const settingsModal = document.getElementById('settings-modal');
const fpsOptions = document.getElementById('fps-options');
const patchNotesButton = document.getElementById('patch-notes-button');
const patchNotesModal = document.getElementById('patch-notes-modal');
const closeButtons = document.querySelectorAll('.close-button');
const patchNotesText = document.getElementById('patch-notes-text');
const currentPatchNotes = `0.5.4V
더블 점프 추가
조류 장애물 추가
음악 추가 및 변경 추가
음악 볼륨 상세 조절 추가
기타 버그 수정`;

const bgmPaths = [
  { name: 'RUN', path: 'assets/audio/bgm.mp3' },
  { name: 'A Hat in Time', path: 'assets/audio/bgm2.mp3' },
  { name: 'ウワサのあの', path: 'assets/audio/bgm3.mp3' }
];
let currentBGMIndex = 0;

// ===================================
// 상수 (Constants)
// ===================================
const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;
const PLAYER_WIDTH = 50;
const PLAYER_HEIGHT = 50;
const DANA_WIDTH = 300;
const DANA_HEIGHT = 300;
const DANA_X = -100; // 왼쪽으로 100픽셀 이동
const DANA_Y = GAME_HEIGHT - DANA_HEIGHT;
const GROUND_OBSTACLE_WIDTH = 90;
const GROUND_OBSTACLE_HEIGHT = 90;
const AIR_OBSTACLE_WIDTH = 70;
const AIR_OBSTACLE_HEIGHT = 70;
const BIRD_OBSTACLE_WIDTH = 50;
const BIRD_OBSTACLE_HEIGHT = 50;
const BIRD_OBSTACLE_MIN_Y = GAME_HEIGHT - AIR_OBSTACLE_HEIGHT - 250;
const BIRD_OBSTACLE_MAX_Y = 50;
const GRAVITY = 1 * 30 * 60;
const BASE_JUMP_VELOCITY = -890;
const DOUBLE_JUMP_MULTIPLIER = 0.75;
const OBSTACLE_MIN_GAP_MS = 300;
const BASE_OBSTACLE_SPAWN_CHANCE = 0.02;
const BIRD_SPAWN_MIN_MS = 500;
const BIRD_SPAWN_MAX_MS = 2000;
const SCORE_BASE_PER_SECOND = 60;
const ANIMATION_SPEED = 100;

// ===================================
// 상태 변수 (State Variables)
// ===================================
let score = 0;
let player;
let obstacles = [];
let gameSpeed = 7 * 60;
let accelerationActive = false;
let timeStopActive = false;
let timeStopCooldown = 0;
let timeFactor = 1;
let lastObstacleType = 'none';
let consecutiveGroundObstaclesCount = 0;
let spacebarPressed = false;
let timeSinceLastObstacle = 0;
let timeSinceLastBirdObstacle = 0;
let nextBirdSpawnTime = 0;
let gameState = 'start';
let gameLoopId;
let targetFPS = 60;
let frameInterval = 1000 / targetFPS;
let lastFrameTime = 0;
let difficulty = 1;
let danaImage;

// ===================================
// 에셋 관리 (Asset Management)
// ===================================
const assets = {};
const assetPaths = {
  player: 'assets/images/player.png',
  player_2: 'assets/images/player_2.png',
  ground_obstacle: 'assets/images/ground_obstacle.png',
  air_obstacle: 'assets/images/air_obstacle.png',
  air_obstacle_2: 'assets/images/air_obstacle_2.png',
  bird_obstacle_1: 'assets/images/bird_obstacle_1.png',
  bird_obstacle_2: 'assets/images/bird_obstacle_2.png',
  bird_obstacle_3: 'assets/images/bird_obstacle_3.png',
  bird_obstacle_4: 'assets/images/bird_obstacle_4.png',
  dana_image: 'assets/images/dana.png',
  dana_image_2: 'assets/images/dana_2.png'
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
    }
  });
}

// ===================================
// 클래스 (Classes)
// ===================================
class Player {
  constructor() {
    this.x = 300;
    this.y = GAME_HEIGHT - PLAYER_HEIGHT;
    this.width = PLAYER_WIDTH;
    this.height = PLAYER_HEIGHT;
    this.velocityY = 0;
    this.isJumping = false;
    this.jumpCount = 0;
    this.maxJumps = 2;
    this.frameImages = [assets.player, assets.player_2];
    this.animationFrame = 0;
    this.lastFrameTime = 0;
  }

  draw(timestamp) {
    if (timestamp - this.lastFrameTime > ANIMATION_SPEED) {
      this.animationFrame = (this.animationFrame + 1) % this.frameImages.length;
      this.lastFrameTime = timestamp;
    }
    ctx.drawImage(this.frameImages[this.animationFrame], this.x, this.y, this.width, this.height);
  }

  update(deltaTime) {
    if (this.isJumping) {
      this.y += this.velocityY * timeFactor * deltaTime;
      this.velocityY += GRAVITY * timeFactor * deltaTime;

      if (this.y >= GAME_HEIGHT - this.height) {
        this.y = GAME_HEIGHT - this.height;
        this.isJumping = false;
        this.velocityY = 0;
        this.jumpCount = 0;
      }
      if (this.y < 0) {
        this.y = 0;
      }
    }
  }

  jump() {
    if (this.jumpCount < this.maxJumps) {
      this.isJumping = true;
      this.velocityY = BASE_JUMP_VELOCITY;
      if (this.jumpCount === 1) {
        this.velocityY *= DOUBLE_JUMP_MULTIPLIER;
      }
      this.jumpCount++;
    }
  }
}

class StaticImage {
  constructor(x, y, width, height, images) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.frameImages = images;
    this.animationFrame = 0;
    this.lastFrameTime = 0;
  }

  draw(timestamp) {
    if (timestamp - this.lastFrameTime > ANIMATION_SPEED) {
      this.animationFrame = (this.animationFrame + 1) % this.frameImages.length;
      this.lastFrameTime = timestamp;
    }
    ctx.drawImage(this.frameImages[this.animationFrame], this.x, this.y, this.width, this.height);
  }
}

class Obstacle {
  constructor(type) {
    this.type = type;
    this.width = 0;
    this.height = 0;
    this.x = GAME_WIDTH;
    this.y = 0;
    this.animationFrame = 0;
    this.lastFrameTime = 0;
    this.frameImages = [];
    this.image = null;

    if (type === 'ground') {
      this.width = GROUND_OBSTACLE_WIDTH;
      this.height = GROUND_OBSTACLE_HEIGHT;
      this.y = GAME_HEIGHT - this.height;
      this.image = assets.ground_obstacle;
    } else if (type === 'air') {
      this.width = AIR_OBSTACLE_WIDTH;
      this.height = AIR_OBSTACLE_HEIGHT;
      this.y = GAME_HEIGHT - this.height - 200;
      this.frameImages = [assets.air_obstacle, assets.air_obstacle_2];
    } else if (type === 'bird') {
      this.width = BIRD_OBSTACLE_WIDTH;
      this.height = BIRD_OBSTACLE_HEIGHT;
      this.y = Math.random() * (BIRD_OBSTACLE_MIN_Y - BIRD_OBSTACLE_MAX_Y) + BIRD_OBSTACLE_MAX_Y;
      this.frameImages = [
        assets.bird_obstacle_1,
        assets.bird_obstacle_2,
        assets.bird_obstacle_3,
        assets.bird_obstacle_4,
      ];
    }
  }

  draw(timestamp) {
    ctx.save();
    if (this.type === 'ground') {
      ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
    } else if (this.type === 'air') {
      if (timestamp - this.lastFrameTime > ANIMATION_SPEED) {
        this.animationFrame = (this.animationFrame + 1) % this.frameImages.length;
        this.lastFrameTime = timestamp;
      }
      ctx.drawImage(this.frameImages[this.animationFrame], this.x, this.y, this.width, this.height);
    } else if (this.type === 'bird') {
      if (timestamp - this.lastFrameTime > ANIMATION_SPEED) {
        this.animationFrame = (this.animationFrame + 1) % this.frameImages.length;
        this.lastFrameTime = timestamp;
      }
      let img = this.frameImages[this.animationFrame];
      ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.scale(1, -1);
      ctx.drawImage(img, -this.width / 2, -this.height / 2, this.width, this.height);
    }
    ctx.restore();
  }

  update(deltaTime) {
    this.x -= gameSpeed * deltaTime;
  }
}

// ===================================
// 게임 로직 및 유틸리티 함수 (Game Logic & Utility Functions)
// ===================================

function checkCollision(obj1, obj2) {
  // AABB (Axis-Aligned Bounding Box) 충돌 먼저 감지
  if (
    Math.floor(obj1.x) < Math.floor(obj2.x) + obj2.width &&
    Math.floor(obj1.x) + obj1.width > Math.floor(obj2.x) &&
    Math.floor(obj1.y) < Math.floor(obj2.y) + obj2.height &&
    Math.floor(obj1.y) + obj1.height > Math.floor(obj2.y)
  ) {
    // AABB 충돌 시에만 픽셀 충돌 감지 수행 (성능 개선)
    const img1 = (obj1.frameImages && obj1.frameImages.length > 0) ? obj1.frameImages[obj1.animationFrame] : obj1.image;
    const img2 = (obj2.frameImages && obj2.frameImages.length > 0) ? obj2.frameImages[obj2.animationFrame] : obj2.image;

    if (!img1 || !img2) return false;

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

    const xOverlap = Math.max(0, Math.min(Math.floor(obj1.x) + obj1.width, Math.floor(obj2.x) + obj2.width) - Math.max(Math.floor(obj1.x), Math.floor(obj2.x)));
    const yOverlap = Math.max(0, Math.min(Math.floor(obj1.y) + obj1.height, Math.floor(obj2.y) + obj2.height) - Math.max(Math.floor(obj1.y), Math.floor(obj2.y)));

    if (xOverlap === 0 || yOverlap === 0) return false;

    const xStart = Math.max(0, Math.floor(Math.max(obj1.x, obj2.x)) - Math.floor(obj1.x));
    const yStart = Math.max(0, Math.floor(Math.max(obj1.y, obj2.y)) - Math.floor(obj1.y));

    for (let y = 0; y < yOverlap; y++) {
      for (let x = 0; x < xOverlap; x++) {
        const pixel1Alpha = data1[((yStart + y) * obj1.width + (xStart + x)) * 4 + 3];
        const obj2PixelX = (Math.floor(Math.max(obj1.x, obj2.x)) - Math.floor(obj2.x)) + x;
        const obj2PixelY = (Math.floor(Math.max(obj1.y, obj2.y)) - Math.floor(obj2.y)) + y;
        const pixel2Alpha = data2[(obj2PixelY * obj2.width + obj2PixelX) * 4 + 3];

        if (pixel1Alpha > 0 && pixel2Alpha > 0) {
          return true;
        }
      }
    }
  }
  return false;
}

function updateCurrentSongDisplay() {
  currentSongDisplay.textContent = `재생중인 곡: ${bgmPaths[currentBGMIndex].name}`;
}

function displayMusicSelection() {
  musicList.innerHTML = '';
  bgmPaths.forEach((song, index) => {
    const li = document.createElement('li');
    li.textContent = song.name;
    li.dataset.index = index;
    li.addEventListener('click', () => {
      currentBGMIndex = index;
      gameBGM.src = song.path;
      updateCurrentSongDisplay();
      musicSelectionModal.style.display = 'none';
    });
    musicList.appendChild(li);
  });
  musicSelectionModal.style.display = 'flex';
}

function getHighScores() {
  const highScores = JSON.parse(localStorage.getItem('highScores') || '[]');
  return highScores.sort((a, b) => b - a).slice(0, 10);
}

function saveHighScore(newScore) {
  const highScores = getHighScores();
  highScores.push(newScore);
  highScores.sort((a, b) => b - a);
  localStorage.setItem('highScores', JSON.stringify(highScores.slice(0, 10)));
}

function displayHighScores() {
  const highScores = getHighScores();
  rankingList.innerHTML = '';
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

function initGame() {
  player = new Player();
  obstacles = [];
  score = 0;
  gameSpeed = 7 * 60;
  accelerationActive = false;
  timeStopActive = false;
  timeStopCooldown = 0;
  timeFactor = 1;
  lastObstacleType = 'none';
  consecutiveGroundObstaclesCount = 0;
  timeSinceLastObstacle = 0;
  timeSinceLastBirdObstacle = 0;
  nextBirdSpawnTime = Math.floor(Math.random() * (BIRD_SPAWN_MAX_MS - BIRD_SPAWN_MIN_MS + 1)) + BIRD_SPAWN_MIN_MS;
  scoreDisplay.textContent = 'Score: 0';
  difficulty = 1;
  difficultyDisplay.textContent = `Difficulty: ${difficulty.toFixed(1)}`;
  gameBGM.src = bgmPaths[currentBGMIndex].path;
  updateCurrentSongDisplay();
}

function startGame() {
  initGame();
  startScreen.style.display = 'none';
  gameOverScreen.style.display = 'none';
  gameState = 'playing';
  if (gameLoopId) cancelAnimationFrame(gameLoopId);
  gameBGM.play();
  updateCurrentSongDisplay();
  gameLoopId = requestAnimationFrame(gameLoop);
}

function endGame() {
  gameState = 'gameOver';
  finalScore.textContent = Math.floor(score);
  gameOverScreen.style.display = 'flex';
  saveHighScore(score);
  gameBGM.pause();
  gameBGM.currentTime = 0;
}

function gameLoop(timestamp) {
  const elapsed = timestamp - lastFrameTime;
  if (elapsed < frameInterval) {
    gameLoopId = requestAnimationFrame(gameLoop);
    return;
  }
  const gameDeltaTime = elapsed / 1000;
  lastFrameTime = timestamp;

  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  if (gameState === 'playing') {
    if (isNaN(gameDeltaTime) || !isFinite(gameDeltaTime)) {
      gameLoopId = requestAnimationFrame(gameLoop);
      return;
    }

    danaImage.draw(timestamp);
    player.update(gameDeltaTime);
    player.draw(timestamp);

    timeSinceLastObstacle += gameDeltaTime * 1000;
    timeSinceLastBirdObstacle += gameDeltaTime * 1000;

    if (timeSinceLastObstacle >= OBSTACLE_MIN_GAP_MS && Math.random() < (BASE_OBSTACLE_SPAWN_CHANCE * difficulty)) {
      let type;
      if (lastObstacleType === 'ground' && consecutiveGroundObstaclesCount < 3) {
        type = 'ground';
      } else if (lastObstacleType === 'air') {
        type = 'ground';
      } else {
        type = Math.random() < 0.5 ? 'ground' : 'air';
      }

      if (type === 'ground') {
        consecutiveGroundObstaclesCount++;
      } else {
        consecutiveGroundObstaclesCount = 0;
      }

      obstacles.push(new Obstacle(type));
      lastObstacleType = type;
      timeSinceLastObstacle = 0;
    }

    if (timeSinceLastBirdObstacle >= nextBirdSpawnTime) {
      obstacles.push(new Obstacle('bird'));
      timeSinceLastBirdObstacle = 0;
      nextBirdSpawnTime = Math.floor(Math.random() * (BIRD_SPAWN_MAX_MS - BIRD_SPAWN_MIN_MS + 1)) + BIRD_SPAWN_MIN_MS;
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obstacle = obstacles[i];
      obstacle.update(gameDeltaTime);
      obstacle.draw(timestamp);

      if (obstacle.x + obstacle.width < 0) {
        obstacles.splice(i, 1);
      }

      if (checkCollision(player, obstacle)) {
        endGame();
        return;
      }
    }

    const previousScore = score;
    score += (accelerationActive ? 2 : 1) * gameDeltaTime * SCORE_BASE_PER_SECOND;
    scoreDisplay.textContent = `Score: ${Math.floor(score)}`;

    if (Math.floor(score / 2000) > Math.floor(previousScore / 2000)) {
      difficulty = parseFloat((difficulty + 0.1).toFixed(1));
      difficultyDisplay.textContent = `Difficulty: ${difficulty.toFixed(1)}`;
    }

    if (timeStopCooldown > 0) {
      timeStopCooldown -= gameDeltaTime * 1000;
    }

    gameLoopId = requestAnimationFrame(gameLoop);
  } else if (gameState === 'gameOver') {
    return;
  }
}

// ===================================
// 이벤트 리스너 (Event Listeners)
// ===================================
document.addEventListener('keydown', (e) => {
  if (gameState !== 'playing') return;

  if (e.code === 'Space') {
    player.jump();
    spacebarPressed = true;
  }
  if (e.code === 'KeyA') {
    accelerationActive = !accelerationActive;
    gameSpeed = accelerationActive ? 10.5 * 60 : 7 * 60;
  }
  if (e.code === 'KeyS' && timeStopCooldown <= 0) {
    timeStopActive = true;
    timeStopCooldown = 30000;
    timeFactor = 0.5;
    setTimeout(() => {
      timeStopActive = false;
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
    } else if (modalToClose === 'music-selection-modal') {
      musicSelectionModal.style.display = 'none';
    } else if (modalToClose === 'settings-modal') {
      settingsModal.style.display = 'none';
    }
  });
});

window.addEventListener('click', (event) => {
  if (event.target === patchNotesModal) {
    patchNotesModal.style.display = 'none';
  } else if (event.target === rankingModal) {
    rankingModal.style.display = 'none';
  } else if (event.target === musicSelectionModal) {
    musicSelectionModal.style.display = 'none';
  } else if (event.target === settingsModal) {
    settingsModal.style.display = 'none';
  }
});

settingsButton.addEventListener('click', () => {
  settingsModal.style.display = 'flex';
  document.querySelectorAll('#fps-options button').forEach(btn => {
    btn.classList.remove('active');
    if (parseInt(btn.dataset.fps) === targetFPS) {
      btn.classList.add('active');
    }
  });
});

fpsOptions.addEventListener('click', (event) => {
  if (event.target.tagName === 'BUTTON') {
    const newFPS = parseInt(event.target.dataset.fps);
    if (!isNaN(newFPS) && [30, 60, 120].includes(newFPS)) {
      targetFPS = newFPS;
      frameInterval = 1000 / targetFPS;
      console.log(`FPS 변경: ${targetFPS} FPS`);
      document.querySelectorAll('#fps-options button').forEach(btn => btn.classList.remove('active'));
      event.target.classList.add('active');
    }
    settingsModal.style.display = 'none';
  }
});

gameBGM.volume = volumeSlider.value / 100;
volumeSlider.addEventListener('input', (e) => {
  gameBGM.volume = e.target.value / 100;
});
changeSongButton.addEventListener('click', displayMusicSelection);


// ===================================
// 초기화 (Initialization)
// ===================================
loadAssets().then(() => {
  danaImage = new StaticImage(DANA_X, DANA_Y, DANA_WIDTH, DANA_HEIGHT, [assets.dana_image, assets.dana_image_2]);
  initGame();
  startScreen.style.display = 'flex';
  gameLoop();
});