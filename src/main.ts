import { CATALOG } from './catalog';
import type { GameHandle } from './engine/types';

// ── card art generators (pure SVG, no external assets) ──────────────────────
function makeArt(slug: string, accent: string): string {
  if (slug === 'vector-duel') {
    return `<svg viewBox="0 0 200 130" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;opacity:.55">
      <polygon points="100,30 88,58 94,54 94,76 106,76 106,54 112,58" fill="none" stroke="${accent}" stroke-width="1.2"/>
      <circle cx="40"  cy="40"  r="22" fill="none" stroke="${accent}" stroke-width="1" opacity=".7"/>
      <circle cx="160" cy="90"  r="14" fill="none" stroke="${accent}" stroke-width="1" opacity=".6"/>
      <circle cx="60"  cy="95"  r="10" fill="none" stroke="${accent}" stroke-width="1" opacity=".5"/>
      <line x1="98" y1="32" x2="40" y2="40"  stroke="${accent}" stroke-width=".5" opacity=".4"/>
      <line x1="102" y1="32" x2="160" y2="90" stroke="${accent}" stroke-width=".5" opacity=".4"/>
      <circle cx="35" cy="60"  r="2" fill="${accent}" opacity=".8"/>
      <circle cx="155" cy="45" r="2" fill="${accent}" opacity=".8"/>
      <circle cx="80"  cy="108" r="2" fill="${accent}" opacity=".8"/>
    </svg>`;
  }
  // generic star-field art for future games
  const dots = Array.from({ length: 18 }, (_, i) => {
    const x = (i * 37 + 20) % 180 + 10;
    const y = (i * 53 + 15) % 110 + 10;
    const r = i % 3 === 0 ? 1.5 : 1;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${accent}" opacity="${.4 + (i % 3) * .2}"/>`;
  }).join('');
  return `<svg viewBox="0 0 200 130" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">${dots}</svg>`;
}

// ── build app shell ──────────────────────────────────────────────────────────
const app = document.getElementById('app')!;

app.innerHTML = `
  <header id="site-header">
    <h1 class="site-title" data-text="CABINET ZERO">CABINET ZERO</h1>
    <p class="site-sub">giochi arcade originali &mdash; zero IP di terzi</p>
    <span class="insert-coin">▶ INSERT COIN ◀</span>
  </header>

  <main id="grid-view">
    <p class="grid-label">SELECT GAME</p>
    <div class="games-grid" id="games-grid"></div>
  </main>

  <div id="game-view" class="hidden">
    <div id="game-hud">
      <button id="btn-back">◀ EXIT</button>
      <span id="game-title-hud"></span>
      <div id="score-wrap">
        <span class="score-label">SCORE</span>
        <span id="score-display">0</span>
      </div>
    </div>
    <div id="monitor-frame">
      <div id="canvas-wrap">
        <canvas id="game-canvas"></canvas>
        <div id="game-over-overlay">
          <p class="go-title">GAME OVER</p>
          <p class="go-score-label">FINAL SCORE</p>
          <p class="go-score" id="go-score-val">0</p>
          <button id="btn-restart">▶ PLAY AGAIN</button>
          <p class="go-hint">— or press ESC to exit —</p>
        </div>
      </div>
    </div>
  </div>

  <footer id="site-footer">
    <span><span class="credits-dot"></span>CABINET ZERO v1.0 &mdash; tutti i giochi sono opere originali</span>
    <span>Cloudflare Pages &bull; Vite &bull; TypeScript</span>
  </footer>
`;

// ── refs ─────────────────────────────────────────────────────────────────────
const gridView   = document.getElementById('grid-view')!;
const gameView   = document.getElementById('game-view')!;
const gamesGrid  = document.getElementById('games-grid')!;
const titleHud   = document.getElementById('game-title-hud')!;
const scoreDsp   = document.getElementById('score-display')!;
const canvas     = document.getElementById('game-canvas') as HTMLCanvasElement;
const overlay    = document.getElementById('game-over-overlay')!;
const goScoreVal = document.getElementById('go-score-val')!;
const btnBack    = document.getElementById('btn-back')!;
const btnRestart = document.getElementById('btn-restart')!;

let activeHandle: GameHandle | null = null;
let activeSlug   = '';

// ── score pop animation ───────────────────────────────────────────────────────
function popScore(val: number) {
  scoreDsp.textContent = String(val);
  scoreDsp.classList.remove('pop');
  void scoreDsp.offsetWidth; // force reflow
  scoreDsp.classList.add('pop');
}

// ── build grid ───────────────────────────────────────────────────────────────
for (const entry of CATALOG) {
  const card = document.createElement('div');
  card.className = 'game-card';
  card.style.setProperty('--ac', entry.accent);

  card.innerHTML = `
    <div class="card-screen">
      <div class="card-art">${makeArt(entry.slug, entry.accent)}</div>
      <span class="card-screen-title">${entry.title}</span>
    </div>
    <div class="card-body">
      <p class="card-tag">▸ ${entry.year}</p>
      <h3 class="card-title">${entry.title}</h3>
      <p class="card-tagline">${entry.tagline}</p>
      <div class="card-footer">
        <span class="card-year">${entry.slug}</span>
        <span class="card-play">PLAY ▶</span>
      </div>
    </div>
  `;

  card.addEventListener('click', () => launchGame(entry.slug));
  gamesGrid.appendChild(card);
}

// ── launch / exit ─────────────────────────────────────────────────────────────
async function launchGame(slug: string) {
  const entry = CATALOG.find((e) => e.slug === slug);
  if (!entry) return;
  activeSlug = slug;

  // show loading state
  titleHud.textContent = 'LOADING...';
  gridView.classList.add('hidden');
  gameView.classList.remove('hidden');

  const mod = await entry.load();

  overlay.classList.remove('visible');
  scoreDsp.textContent = '0';
  titleHud.textContent = entry.title;

  activeHandle?.destroy();
  activeHandle = mod.init(canvas, {
    rng: Math.random,
    onScore(score) { popScore(score); },
    onGameOver(finalScore) {
      goScoreVal.textContent = String(finalScore);
      overlay.classList.add('visible');
    },
  });
}

function exitGame() {
  activeHandle?.destroy();
  activeHandle = null;
  overlay.classList.remove('visible');
  gameView.classList.add('hidden');
  gridView.classList.remove('hidden');
  activeSlug = '';
}

btnBack.addEventListener('click', exitGame);

btnRestart.addEventListener('click', () => {
  if (activeSlug) launchGame(activeSlug);
});

document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && activeHandle) exitGame();
});
