import { CATALOG } from './catalog';
import type { GameHandle } from './engine/types';

const app = document.getElementById('app')!;

app.innerHTML = `
  <header>
    <h1>CABINET ZERO</h1>
    <p>giochi arcade originali — ciclo 1</p>
  </header>
  <div id="grid-view">
    <h2>Seleziona un gioco</h2>
    <div class="games-grid" id="games-grid"></div>
  </div>
  <div id="game-view" class="hidden">
    <div id="game-header">
      <button id="btn-back">← INDIETRO</button>
      <span id="game-title"></span>
      <span id="score-display">0</span>
    </div>
    <div id="canvas-wrap">
      <canvas id="game-canvas"></canvas>
      <div id="game-over-overlay">
        <h2>GAME OVER</h2>
        <p id="final-score-text"></p>
        <button id="btn-restart">RIGIOCA</button>
      </div>
    </div>
  </div>
`;

const gridView = document.getElementById('grid-view')!;
const gameView = document.getElementById('game-view')!;
const gamesGrid = document.getElementById('games-grid')!;
const gameTitle = document.getElementById('game-title')!;
const scoreDisplay = document.getElementById('score-display')!;
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const overlay = document.getElementById('game-over-overlay')!;
const finalScoreText = document.getElementById('final-score-text')!;
const btnBack = document.getElementById('btn-back')!;
const btnRestart = document.getElementById('btn-restart')!;

let activeHandle: GameHandle | null = null;
let activeSlug = '';

// build grid
for (const entry of CATALOG) {
  const card = document.createElement('div');
  card.className = 'game-card';
  card.style.setProperty('--accent-color', entry.accent);
  card.innerHTML = `
    <h3>${entry.title}</h3>
    <p>${entry.tagline}</p>
    <span class="year">${entry.year}</span>
  `;
  card.addEventListener('click', () => launchGame(entry.slug));
  gamesGrid.appendChild(card);
}

async function launchGame(slug: string) {
  const entry = CATALOG.find((e) => e.slug === slug);
  if (!entry) return;
  activeSlug = slug;

  const mod = await entry.load();

  overlay.classList.remove('visible');
  scoreDisplay.textContent = '0';
  gameTitle.textContent = entry.title;

  gridView.classList.add('hidden');
  gameView.classList.remove('hidden');

  activeHandle = mod.init(canvas, {
    rng: Math.random,
    onScore(score) { scoreDisplay.textContent = String(score); },
    onGameOver(finalScore) {
      finalScoreText.textContent = `Punteggio finale: ${finalScore}`;
      overlay.classList.add('visible');
    },
  });
}

function exitGame() {
  if (activeHandle) {
    activeHandle.destroy();
    activeHandle = null;
  }
  overlay.classList.remove('visible');
  gameView.classList.add('hidden');
  gridView.classList.remove('hidden');
  activeSlug = '';
}

btnBack.addEventListener('click', exitGame);

btnRestart.addEventListener('click', () => {
  if (activeSlug) {
    if (activeHandle) { activeHandle.destroy(); activeHandle = null; }
    launchGame(activeSlug);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && activeHandle) exitGame();
});
