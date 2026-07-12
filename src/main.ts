import { CATALOG } from './catalog';
import type { GameHandle } from './engine/types';

// ── localStorage high score ───────────────────────────────────────────────────
const HS_KEY = 'cabinet-zero-hs';
function loadScores(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(HS_KEY) ?? '{}'); } catch { return {}; }
}
function saveScore(slug: string, score: number): boolean {
  const scores = loadScores();
  if (score > (scores[slug] ?? 0)) {
    scores[slug] = score;
    localStorage.setItem(HS_KEY, JSON.stringify(scores));
    return true;
  }
  return false;
}

// ── counter animation ─────────────────────────────────────────────────────────
function animateCounter(el: HTMLElement, target: number, ms = 900) {
  const t0 = Date.now();
  function tick() {
    const p = Math.min((Date.now() - t0) / ms, 1);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = String(Math.round(target * e));
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ── animated SVG art per card ─────────────────────────────────────────────────
function makeArt(slug: string, ac: string): string {
  if (slug === 'vector-duel') {
    return `<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg"
      style="width:100%;height:100%;opacity:.75;overflow:visible">
      <defs><style>
        .vd-ship{transform-origin:100px 70px;animation:ship-spin 12s linear infinite}
        .vd-r1{transform-origin:100px 70px;animation:rock-cw 8s linear infinite}
        .vd-r2{transform-origin:100px 70px;animation:rock-ccw 13s linear infinite}
        .vd-r3{transform-origin:100px 70px;animation:rock-cw 18s linear infinite reverse}
        @keyframes ship-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes rock-cw  {from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes rock-ccw {from{transform:rotate(0)}to{transform:rotate(-360deg)}}
      </style></defs>
      <g class="vd-ship">
        <polygon points="100,57 91,79 96,75 96,85 104,85 104,75 109,79"
          fill="none" stroke="${ac}" stroke-width="1.4"/>
      </g>
      <g class="vd-r1">
        <polygon points="152,70 148,62 154,56 162,58 165,66 161,74 154,74"
          fill="none" stroke="${ac}" stroke-width="1.2" opacity=".8"/>
      </g>
      <g class="vd-r2">
        <polygon points="100,28 95,22 100,17 106,19 108,26 103,31"
          fill="none" stroke="${ac}" stroke-width="1.1" opacity=".65"/>
      </g>
      <g class="vd-r3">
        <polygon points="48,70 45,65 48,61 53,63 54,68 50,72"
          fill="none" stroke="${ac}" stroke-width="1" opacity=".5"/>
      </g>
      <circle cx="130" cy="48" r="1.5" fill="${ac}" opacity=".9"/>
      <circle cx="72"  cy="88" r="1.5" fill="${ac}" opacity=".7"/>
      <circle cx="140" cy="100" r="1" fill="${ac}" opacity=".5"/>
    </svg>`;
  }

  if (slug === 'nova-shield') {
    return `<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg"
      style="width:100%;height:100%;opacity:.8;overflow:visible">
      <defs>
        <style>
          .ns-shield{transform-origin:100px 70px;animation:ns-rot 3s linear infinite}
          .ns-b1{animation:ns-bolt1 4s linear infinite}
          .ns-b2{animation:ns-bolt2 5.5s linear infinite 1.2s}
          .ns-b3{animation:ns-bolt3 4.8s linear infinite 2.8s}
          .ns-core{animation:ns-pulse 1.8s ease-in-out infinite}
          @keyframes ns-rot{from{transform:rotate(0)}to{transform:rotate(360deg)}}
          @keyframes ns-bolt1{0%{opacity:0;transform:translate(0,0)}20%{opacity:1}80%{opacity:.9}100%{opacity:0;transform:translate(-38px,18px)}}
          @keyframes ns-bolt2{0%{opacity:0;transform:translate(0,0)}20%{opacity:1}80%{opacity:.8}100%{opacity:0;transform:translate(15px,-32px)}}
          @keyframes ns-bolt3{0%{opacity:0;transform:translate(0,0)}20%{opacity:.9}80%{opacity:.7}100%{opacity:0;transform:translate(30px,22px)}}
          @keyframes ns-pulse{0%,100%{r:6;fill:white}50%{r:8;fill:#ff6688}}
        </style>
      </defs>
      <!-- orbit ring -->
      <circle cx="100" cy="70" r="42" fill="none" stroke="${ac}" stroke-width=".6" stroke-dasharray="4 3" opacity=".3"/>
      <!-- death ring -->
      <circle cx="100" cy="70" r="10" fill="none" stroke="#ff2244" stroke-width=".8" opacity=".5"/>
      <!-- shield arc -->
      <g class="ns-shield">
        <path d="M142,70 A42,42 0 0,0 121,33.6" fill="none" stroke="${ac}" stroke-width="3.5" stroke-linecap="round" opacity=".9"/>
        <path d="M142,70 A42,42 0 0,0 121,33.6" fill="none" stroke="${ac}" stroke-width="7" stroke-linecap="round" opacity=".15"/>
      </g>
      <!-- bolts -->
      <circle class="ns-b1" cx="170" cy="30" r="3" fill="#4488ff" opacity="0"/>
      <circle class="ns-b2" cx="30"  cy="100" r="3" fill="#6644ff" opacity="0"/>
      <circle class="ns-b3" cx="160" cy="110" r="2.5" fill="#ff6644" opacity="0"/>
      <!-- core -->
      <circle class="ns-core" cx="100" cy="70" r="6" fill="white" opacity=".9"/>
    </svg>`;
  }

  // generic starfield
  const pts = Array.from({ length: 22 }, (_, i) => {
    const x = ((i * 41 + 17) % 180) + 10;
    const y = ((i * 59 + 11) % 120) + 10;
    const r = i % 4 === 0 ? 2 : 1;
    const op = (.3 + (i % 5) * .12).toFixed(2);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${ac}" opacity="${op}"/>`;
  }).join('');
  return `<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg"
    style="width:100%;height:100%">${pts}</svg>`;
}

// ── starfield ─────────────────────────────────────────────────────────────────
function buildStarfield(container: HTMLElement) {
  for (let i = 0; i < 40; i++) {
    const s = document.createElement('span');
    const dur = 6 + Math.random() * 14;
    s.style.cssText = `left:${Math.random()*100}%;width:${Math.random()<.15?2:1}px;height:${Math.random()<.15?2:1}px;
      opacity:${(.2 + Math.random() * .5).toFixed(2)};
      animation-duration:${dur.toFixed(1)}s;animation-delay:${(-(Math.random()*dur)).toFixed(1)}s`;
    container.appendChild(s);
  }
}

// ── ticker content ─────────────────────────────────────────────────────────────
function buildTicker(track: HTMLElement) {
  const items: string[] = [];
  for (const e of CATALOG) {
    items.push(`<span class="ticker-item accent">◆ ${e.title.toUpperCase()}</span>`);
    items.push(`<span class="ticker-item">${e.tagline}</span>`);
    items.push(`<span class="ticker-sep">///</span>`);
  }
  items.push(`<span class="ticker-item">CABINET ZERO</span>`);
  items.push(`<span class="ticker-item">GIOCHI ORIGINALI</span>`);
  items.push(`<span class="ticker-sep">///</span>`);
  items.push(`<span class="ticker-item">ZERO IP DI TERZI</span>`);
  items.push(`<span class="ticker-sep">///</span>`);
  items.push(`<span class="ticker-item accent">INSERT COIN TO CONTINUE</span>`);
  items.push(`<span class="ticker-sep">///</span>`);
  // duplicate for seamless loop
  const html = items.join('');
  track.innerHTML = html + html;
}

// ── app shell ─────────────────────────────────────────────────────────────────
const app = document.getElementById('app')!;

app.innerHTML = `
  <div id="progress-bar"><div id="progress-fill"></div></div>

  <header id="site-header">
    <div class="stars" id="stars"></div>
    <div class="retro-grid"></div>
    <h1 class="site-title" data-text="CABINET ZERO">CABINET ZERO</h1>
    <p class="site-sub">giochi arcade originali &mdash; zero IP di terzi</p>
    <span class="insert-coin">▶ INSERT COIN ◀</span>
  </header>

  <div id="ticker"><div class="ticker-track" id="ticker-track"></div></div>

  <main id="grid-view">
    <div class="grid-header">
      <p class="grid-label">SELECT GAME</p>
      <span class="grid-count" id="grid-count"></span>
    </div>
    <div class="games-grid" id="games-grid"></div>
  </main>

  <div id="game-view" class="hidden">
    <div id="game-hud">
      <button id="btn-back">◀ EXIT</button>
      <span id="game-title-hud"></span>
      <span id="wave-display"></span>
      <div id="score-wrap">
        <span class="score-label">SCORE</span>
        <span id="score-display">0</span>
      </div>
    </div>
    <div id="monitor-frame">
      <div id="canvas-wrap">
        <canvas id="game-canvas"></canvas>
        <div id="controls-hint">
          <span class="hint-key"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>&nbsp;/&nbsp;<kbd>↑←↓→</kbd>&nbsp;MOVE</span>
          <span class="hint-key"><kbd>SPACE</kbd>&nbsp;FIRE</span>
          <span class="hint-key"><kbd>ESC</kbd>&nbsp;EXIT</span>
        </div>
        <div id="game-over-overlay">
          <p class="go-title">GAME OVER</p>
          <div class="go-divider"></div>
          <div class="go-score-row">
            <span class="go-score-label">SCORE</span>
            <p class="go-score" id="go-score-val">0</p>
          </div>
          <div class="go-hs-row" id="go-hs-row">
            <span class="go-hs-label">BEST</span>
            <span class="go-hs-val" id="go-hs-val">0</span>
          </div>
          <p class="go-new-hs hidden" id="go-new-hs">★ NEW HIGH SCORE ★</p>
          <button id="btn-restart">▶ PLAY AGAIN</button>
          <p class="go-hint">— press ESC to exit —</p>
        </div>
      </div>
      <span id="monitor-brand">CABINET ZERO MK.I</span>
      <div id="monitor-led"></div>
    </div>
  </div>

  <footer id="site-footer">
    <span><span class="credits-dot"></span>CABINET ZERO &mdash; opere originali, zero IP di terzi</span>
    <span>Cloudflare Pages &bull; Vite &bull; TypeScript</span>
  </footer>
`;

buildStarfield(document.getElementById('stars')!);
buildTicker(document.getElementById('ticker-track')!);

// ── refs ──────────────────────────────────────────────────────────────────────
const gridView    = document.getElementById('grid-view')!;
const gameView    = document.getElementById('game-view')!;
const gamesGrid   = document.getElementById('games-grid')!;
const gridCount   = document.getElementById('grid-count')!;
const titleHud    = document.getElementById('game-title-hud')!;
const waveDsp     = document.getElementById('wave-display')!;
const scoreDsp    = document.getElementById('score-display')!;
const canvas      = document.getElementById('game-canvas') as HTMLCanvasElement;
const overlay     = document.getElementById('game-over-overlay')!;
const goScoreVal  = document.getElementById('go-score-val')!;
const goHsVal     = document.getElementById('go-hs-val')!;
const goNewHs     = document.getElementById('go-new-hs')!;
const btnBack     = document.getElementById('btn-back')!;
const btnRestart  = document.getElementById('btn-restart')!;
const progressFill = document.getElementById('progress-fill')!;

let activeHandle: GameHandle | null = null;
let activeSlug   = '';
let currentScore = 0;

// ── score pop ─────────────────────────────────────────────────────────────────
function popScore(val: number) {
  currentScore = val;
  scoreDsp.textContent = String(val);
  scoreDsp.classList.remove('pop');
  void scoreDsp.offsetWidth;
  scoreDsp.classList.add('pop');
}

// ── build grid ────────────────────────────────────────────────────────────────
const scores = loadScores();
gridCount.textContent = `${CATALOG.length} GAME${CATALOG.length !== 1 ? 'S' : ''} AVAILABLE`;

for (const entry of CATALOG) {
  const card = document.createElement('div');
  card.className = 'game-card';
  card.style.setProperty('--ac', entry.accent);

  const hs = scores[entry.slug] ?? 0;
  const hsHtml = hs > 0
    ? `<div class="card-hs">
         <span class="card-hs-label">BEST</span>
         <span class="card-hs-val">${hs}</span>
       </div>`
    : '';

  card.innerHTML = `
    <div class="corner-tl"></div>
    <div class="corner-br"></div>
    ${hsHtml}
    <div class="card-screen">
      <div class="card-art">${makeArt(entry.slug, entry.accent)}</div>
      <div class="card-screen-sweep"></div>
      <span class="card-screen-title">${entry.title}</span>
    </div>
    <div class="card-body">
      <p class="card-tag">▸ ${entry.year} &nbsp;/&nbsp; ${entry.slug}</p>
      <h3 class="card-title">${entry.title}</h3>
      <p class="card-tagline">${entry.tagline}</p>
      <div class="card-footer">
        <span class="card-year">${entry.accent}</span>
        <span class="card-play">PLAY ▶</span>
      </div>
    </div>
  `;

  card.addEventListener('click', () => launchGame(entry.slug));
  gamesGrid.appendChild(card);
}

// "coming soon" ghost cards
const soonsNeeded = Math.max(0, 3 - CATALOG.length);
for (let i = 0; i < soonsNeeded; i++) {
  const ghost = document.createElement('div');
  ghost.className = 'game-card card-soon';
  ghost.innerHTML = `
    <div class="card-screen">
      <span class="card-screen-title" style="color:#1e1e38;opacity:1">???</span>
    </div>
    <div class="card-body">
      <p class="soon-label">COMING SOON</p>
    </div>
  `;
  gamesGrid.appendChild(ghost);
}

// ── progress bar ──────────────────────────────────────────────────────────────
function progressStart() { progressFill.style.width = '35%'; }
function progressDone()  {
  progressFill.style.width = '100%';
  setTimeout(() => { progressFill.style.width = '0%'; }, 350);
}

// ── launch ────────────────────────────────────────────────────────────────────
async function launchGame(slug: string) {
  const entry = CATALOG.find((e) => e.slug === slug);
  if (!entry) return;
  activeSlug = slug;
  currentScore = 0;

  titleHud.textContent = 'LOADING…';
  waveDsp.textContent = '';
  waveDsp.classList.remove('visible');
  gridView.classList.add('hidden');
  gameView.classList.remove('hidden');
  progressStart();

  const mod = await entry.load();
  progressDone();

  overlay.classList.remove('visible');
  scoreDsp.textContent = '0';
  titleHud.textContent = entry.title;

  // re-trigger controls hint animation
  const hintEl = document.getElementById('controls-hint');
  if (hintEl) {
    hintEl.style.animation = 'none';
    void hintEl.offsetWidth;
    hintEl.style.animation = '';
  }

  activeHandle?.destroy();
  activeHandle = mod.init(canvas, {
    rng: Math.random,
    onScore(score) { popScore(score); },
    onGameOver(finalScore) {
      const isNew = saveScore(slug, finalScore);
      const best  = loadScores()[slug] ?? 0;

      animateCounter(goScoreVal, finalScore);
      goHsVal.textContent    = String(best);
      goNewHs.classList.toggle('hidden', !isNew);
      overlay.classList.add('visible');

      refreshCardBadge(slug, best);
    },
  });
}

function refreshCardBadge(slug: string, best: number) {
  const cards = gamesGrid.querySelectorAll('.game-card');
  const idx = CATALOG.findIndex((e) => e.slug === slug);
  const card = cards[idx] as HTMLElement | undefined;
  if (!card) return;
  let badge = card.querySelector('.card-hs') as HTMLElement | null;
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'card-hs';
    card.insertBefore(badge, card.firstChild);
  }
  badge.innerHTML = `
    <span class="card-hs-label">BEST</span>
    <span class="card-hs-val">${best}</span>
  `;
}

// ── exit ──────────────────────────────────────────────────────────────────────
function exitGame() {
  activeHandle?.destroy();
  activeHandle = null;
  overlay.classList.remove('visible');
  waveDsp.classList.remove('visible');
  gameView.classList.add('hidden');
  gridView.classList.remove('hidden');
  activeSlug = '';
}

btnBack.addEventListener('click', exitGame);
btnRestart.addEventListener('click', () => { if (activeSlug) launchGame(activeSlug); });
document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && activeHandle) exitGame();
});
