// ==================== STATE ====================
const state = {
  score: 0,
  best: parseInt(localStorage.getItem('snakeBest') || '0'),
  leaderboard: JSON.parse(localStorage.getItem('snakeLeaderboard') || '[]'),
  soundOn: true,
  paused: false,
  running: false,
};

// ==================== SCREENS ====================
const screens = {
  title: document.getElementById('title-screen'),
  instructions: document.getElementById('instruction-screen'),
  game: document.getElementById('game-screen'),
  gameover: document.getElementById('gameover-screen'),
};

function showScreen(name) {
  Object.entries(screens).forEach(([k, el]) => el.classList.toggle('hidden', k !== name));
}

// ==================== SOUND ====================
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioCtx();
  return audioCtx;
}

function playTone(freq, type = 'sine', duration = 0.12, vol = 0.18) {
  if (!state.soundOn) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + duration);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

function playEat() {
  playTone(880, 'sine', 0.1, 0.2);
  setTimeout(() => playTone(1100, 'sine', 0.08, 0.15), 60);
}

function playDie() {
  playTone(200, 'sawtooth', 0.3, 0.3);
  setTimeout(() => playTone(140, 'sawtooth', 0.4, 0.25), 200);
}

function playMove() {
  playTone(220, 'sine', 0.04, 0.04);
}

// ==================== CANVAS ====================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const CELL = 20;
let COLS, ROWS;

function resizeCanvas() {
  const size = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.72, 520);
  const snapped = Math.floor(size / CELL) * CELL;
  canvas.width = snapped;
  canvas.height = snapped;
  COLS = canvas.width / CELL;
  ROWS = canvas.height / CELL;
}

// ==================== GAME STATE ====================
let snake, dir, nextDir, fruit, gameLoop, speed, frameCount;

const FRUITS = [
  { emoji: '🍎', color: '#e53935', pts: 1 },
  { emoji: '🍊', color: '#FF6F00', pts: 1 },
  { emoji: '🍋', color: '#FFD600', pts: 2 },
  { emoji: '🍇', color: '#8e24aa', pts: 2 },
  { emoji: '🫐', color: '#1565c0', pts: 3 },
];

function initGame() {
  resizeCanvas();
  const startX = Math.floor(COLS / 2);
  const startY = Math.floor(ROWS / 2);
  snake = [
    { x: startX,     y: startY },
    { x: startX - 1, y: startY },
    { x: startX - 2, y: startY },
  ];
  dir      = { x: 1, y: 0 };
  nextDir  = { x: 1, y: 0 };
  state.score = 0;
  speed    = 150;
  frameCount = 0;
  spawnFruit();
  updateHUD();
  state.running = true;
  state.paused  = false;
  if (gameLoop) clearInterval(gameLoop);
  gameLoop = setInterval(tick, speed);
  drawGame();
}

function spawnFruit() {
  let pos;
  do {
    pos = {
      x: Math.floor(Math.random() * COLS),
      y: Math.floor(Math.random() * ROWS),
    };
  } while (snake.some(s => s.x === pos.x && s.y === pos.y));
  fruit = { ...pos, ...FRUITS[Math.floor(Math.random() * FRUITS.length)] };
}

// ==================== GAME LOOP ====================
function tick() {
  if (state.paused || !state.running) return;
  dir = { ...nextDir };

  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  // Wall collision
  if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
    endGame(); return;
  }
  // Self collision
  if (snake.some(s => s.x === head.x && s.y === head.y)) {
    endGame(); return;
  }

  snake.unshift(head);

  if (head.x === fruit.x && head.y === fruit.y) {
    state.score += fruit.pts;
    playEat();
    showFruitPop(fruit);
    spawnFruit();
    updateHUD();
    // Speed up every 5 points
    if (state.score % 5 === 0 && speed > 60) {
      speed = Math.max(60, speed - 12);
      clearInterval(gameLoop);
      gameLoop = setInterval(tick, speed);
    }
  } else {
    snake.pop();
  }

  drawGame();
}

// ==================== RENDERING ====================
function drawGame() {
  const c = ctx;

  // Background grid
  c.fillStyle = '#111d11';
  c.fillRect(0, 0, canvas.width, canvas.height);

  // Grid dots
  c.fillStyle = 'rgba(76,175,80,0.07)';
  for (let i = 0; i < COLS; i++) {
    for (let j = 0; j < ROWS; j++) {
      c.beginPath();
      c.arc(i * CELL + CELL / 2, j * CELL + CELL / 2, 1.2, 0, Math.PI * 2);
      c.fill();
    }
  }

  // Fruit (bouncing)
  c.font = `${CELL * 1.1}px serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const fruitBounce = Math.sin(Date.now() / 300) * 2;
  c.fillText(fruit.emoji, fruit.x * CELL + CELL / 2, fruit.y * CELL + CELL / 2 + fruitBounce);

  // Snake body
  snake.forEach((seg, i) => {
    const t = i / snake.length;
    const green = Math.round(175 - t * 80);
    c.fillStyle = i === 0
      ? '#8BC34A'
      : `rgb(${Math.round(30 + t * 20)}, ${green}, ${Math.round(40 + t * 10)})`;
    const pad = i === 0 ? 1 : 2;
    const r   = i === 0 ? 8 : 6;
    roundRect(c, seg.x * CELL + pad, seg.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, r);
    c.fill();

    // Head eyes
    if (i === 0) {
      c.fillStyle = '#fff';
      if (dir.x !== 0) {
        c.beginPath(); c.arc(seg.x*CELL+CELL/2 + (dir.x>0?5:-5), seg.y*CELL+CELL/2-3, 2.5, 0, Math.PI*2); c.fill();
        c.beginPath(); c.arc(seg.x*CELL+CELL/2 + (dir.x>0?5:-5), seg.y*CELL+CELL/2+3, 2.5, 0, Math.PI*2); c.fill();
        c.fillStyle = '#222';
        c.beginPath(); c.arc(seg.x*CELL+CELL/2 + (dir.x>0?6:-6), seg.y*CELL+CELL/2-3, 1.3, 0, Math.PI*2); c.fill();
        c.beginPath(); c.arc(seg.x*CELL+CELL/2 + (dir.x>0?6:-6), seg.y*CELL+CELL/2+3, 1.3, 0, Math.PI*2); c.fill();
      } else {
        c.beginPath(); c.arc(seg.x*CELL+CELL/2-3, seg.y*CELL+CELL/2 + (dir.y>0?5:-5), 2.5, 0, Math.PI*2); c.fill();
        c.beginPath(); c.arc(seg.x*CELL+CELL/2+3, seg.y*CELL+CELL/2 + (dir.y>0?5:-5), 2.5, 0, Math.PI*2); c.fill();
        c.fillStyle = '#222';
        c.beginPath(); c.arc(seg.x*CELL+CELL/2-3, seg.y*CELL+CELL/2 + (dir.y>0?6:-6), 1.3, 0, Math.PI*2); c.fill();
        c.beginPath(); c.arc(seg.x*CELL+CELL/2+3, seg.y*CELL+CELL/2 + (dir.y>0?6:-6), 1.3, 0, Math.PI*2); c.fill();
      }
    }
  });

  // Border glow
  c.strokeStyle = 'rgba(76,175,80,0.3)';
  c.lineWidth = 2;
  c.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ==================== GAME OVER ====================
function endGame() {
  clearInterval(gameLoop);
  state.running = false;
  playDie();

  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem('snakeBest', state.best);
  }

  // Update leaderboard
  state.leaderboard.push(state.score);
  state.leaderboard.sort((a, b) => b - a);
  state.leaderboard = state.leaderboard.slice(0, 5);
  localStorage.setItem('snakeLeaderboard', JSON.stringify(state.leaderboard));

  document.getElementById('go-score').textContent = state.score;
  document.getElementById('go-best').textContent  = state.best;
  renderLeaderboard();
  showScreen('gameover');
}

function renderLeaderboard() {
  const list = document.getElementById('lb-list');
  list.innerHTML = state.leaderboard
    .map((s, i) => `<div class="lb-row"><span class="lb-rank">#${i + 1}</span><span>${s} pts</span></div>`)
    .join('') || '<div class="lb-row" style="color:#666">No scores yet</div>';
}

function updateHUD() {
  document.getElementById('score-display').textContent = state.score;
  document.getElementById('best-display').textContent  = state.best;
  document.getElementById('title-score').textContent   = state.score;
  document.getElementById('title-best').textContent    = state.best;
}

// ==================== FRUIT POP ANIMATION ====================
function showFruitPop(f) {
  const rect = canvas.getBoundingClientRect();
  const x = rect.left + f.x * CELL + CELL / 2;
  const y = rect.top  + f.y * CELL;

  const pop = document.createElement('div');
  pop.className = 'fruit-pop';
  pop.textContent = f.emoji;
  pop.style.left  = x + 'px';
  pop.style.top   = y + 'px';
  document.body.appendChild(pop);
  setTimeout(() => pop.remove(), 800);

  const pts = document.createElement('div');
  pts.className = 'score-pop';
  pts.textContent = `+${f.pts}`;
  pts.style.left  = (x + 20) + 'px';
  pts.style.top   = (y - 10) + 'px';
  document.body.appendChild(pts);
  setTimeout(() => pts.remove(), 900);
}

// ==================== KEYBOARD CONTROLS ====================
document.addEventListener('keydown', e => {
  switch (e.key) {
    case 'ArrowUp':    if (dir.y !== 1)  nextDir = { x: 0, y: -1 }; e.preventDefault(); break;
    case 'ArrowDown':  if (dir.y !== -1) nextDir = { x: 0, y:  1 }; e.preventDefault(); break;
    case 'ArrowLeft':  if (dir.x !== 1)  nextDir = { x: -1, y: 0 }; e.preventDefault(); break;
    case 'ArrowRight': if (dir.x !== -1) nextDir = { x:  1, y: 0 }; e.preventDefault(); break;
    case ' ':
      e.preventDefault();
      if (state.running) togglePause();
      break;
    case 'Escape':
      if (state.running) {
        clearInterval(gameLoop);
        state.running = false;
        showScreen('title');
      }
      break;
  }
});

// ==================== PAUSE ====================
function togglePause() {
  state.paused = !state.paused;
  document.getElementById('pause-overlay').classList.toggle('hidden', !state.paused);
  document.getElementById('hud-pause').textContent = state.paused ? '▶' : '⏸';
}

// ==================== SOUND TOGGLE ====================
function toggleSound() {
  state.soundOn = !state.soundOn;
  const icon = state.soundOn ? '🔊' : '🔇';
  document.getElementById('sound-btn').textContent  = icon;
  document.getElementById('hud-sound').textContent  = icon;
}

// ==================== BUTTON EVENTS ====================
document.getElementById('play-btn').addEventListener('click', () => showScreen('instructions'));
document.getElementById('instr-btn').addEventListener('click', () => showScreen('instructions'));
document.getElementById('sound-btn').addEventListener('click', toggleSound);
document.getElementById('exit-btn').addEventListener('click', () => {
  if (confirm('Exit game?')) window.close();
});
document.getElementById('start-game-btn').addEventListener('click', () => {
  showScreen('game');
  initGame();
});
document.getElementById('hud-sound').addEventListener('click', toggleSound);
document.getElementById('hud-pause').addEventListener('click', () => {
  if (state.running) togglePause();
});
document.getElementById('hud-exit').addEventListener('click', () => {
  clearInterval(gameLoop);
  state.running = false;
  document.getElementById('pause-overlay').classList.add('hidden');
  showScreen('title');
});
document.getElementById('go-restart').addEventListener('click', () => {
  showScreen('game');
  initGame();
});
document.getElementById('go-menu').addEventListener('click', () => showScreen('title'));

// ==================== INIT ====================
document.getElementById('title-best').textContent = state.best;
resizeCanvas();

// Draw idle canvas on load
(function idleDraw() {
  if (!state.running) {
    ctx.fillStyle = '#111d11';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
})();
