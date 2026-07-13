import { CATALOG } from './catalog';
import type { GameHandle } from './engine/types';

// ── Web Audio (generative — zero external files) ──────────────────────────────
let audioCtx: AudioContext | null = null;
let menuGain: GainNode | null = null;

function initAudio(): AudioContext {
  if (audioCtx) return audioCtx;
  audioCtx = new AudioContext();

  menuGain = audioCtx.createGain();
  menuGain.gain.value = 0;
  menuGain.connect(audioCtx.destination);

  // LFO — slow volume swell
  const lfo = audioCtx.createOscillator();
  lfo.frequency.value = 0.18;
  const lfoG = audioCtx.createGain();
  lfoG.gain.value = 0.004;
  lfo.connect(lfoG);
  lfoG.connect(menuGain.gain);
  lfo.start();

  // three drone oscillators
  const defs: Array<[number, OscillatorType, number]> = [
    [55,  'triangle', 0.015],
    [110, 'sine',     0.008],
    [165, 'triangle', 0.005],
  ];
  for (const [freq, type, gain] of defs) {
    const osc = audioCtx.createOscillator();
    const g   = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g);
    g.connect(menuGain);
    osc.start();
  }

  menuGain.gain.setTargetAtTime(1, audioCtx.currentTime, 1.5);
  return audioCtx;
}

function startMenuAudio(): void {
  if (!audioCtx || !menuGain) return;
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  menuGain.gain.cancelScheduledValues(audioCtx.currentTime);
  menuGain.gain.setTargetAtTime(1, audioCtx.currentTime, 0.8);
}

function stopMenuAudio(): void {
  if (!audioCtx || !menuGain) return;
  menuGain.gain.cancelScheduledValues(audioCtx.currentTime);
  menuGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.3);
}

function playClickSound(): void {
  const ctx = initAudio();
  const buf  = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.06), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.015));
  }
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 880;
  filter.Q.value = 6;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = 0.18;
  src.connect(filter);
  filter.connect(g);
  g.connect(ctx.destination);
  src.start();
}

function playLaunchSound(): void {
  const ctx = initAudio();
  const freqs = [261, 330, 392, 523];
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    const t = ctx.currentTime + i * 0.04;
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  });
}

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

// ── score count-up animation ──────────────────────────────────────────────────
function animateCounter(el: HTMLElement, target: number, ms = 950) {
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
    return `<svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg"
      style="width:100%;height:100%;opacity:.8;overflow:visible">
      <defs><style>
        .vd-ship{transform-origin:100px 75px;animation:vd-spin 12s linear infinite}
        .vd-r1{transform-origin:100px 75px;animation:vd-cw 8s linear infinite}
        .vd-r2{transform-origin:100px 75px;animation:vd-ccw 13s linear infinite}
        .vd-r3{transform-origin:100px 75px;animation:vd-cw 18s linear infinite reverse}
        @keyframes vd-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes vd-cw  {from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes vd-ccw {from{transform:rotate(0)}to{transform:rotate(-360deg)}}
      </style></defs>
      <g class="vd-ship">
        <polygon points="100,60 90,84 96,78 96,90 104,90 104,78 110,84"
          fill="none" stroke="${ac}" stroke-width="1.5"/>
      </g>
      <g class="vd-r1">
        <polygon points="154,75 150,65 157,58 165,61 168,70 163,78 156,78"
          fill="none" stroke="${ac}" stroke-width="1.3" opacity=".8"/>
      </g>
      <g class="vd-r2">
        <polygon points="100,30 94,23 100,17 107,19 109,27 103,32"
          fill="none" stroke="${ac}" stroke-width="1.1" opacity=".6"/>
      </g>
      <g class="vd-r3">
        <polygon points="47,75 44,69 48,64 54,66 55,72 50,77"
          fill="none" stroke="${ac}" stroke-width="1" opacity=".5"/>
      </g>
      <circle cx="132" cy="50" r="1.5" fill="${ac}" opacity=".9"/>
      <circle cx="70"  cy="95" r="1.5" fill="${ac}" opacity=".7"/>
      <circle cx="143" cy="105" r="1" fill="${ac}" opacity=".5"/>
    </svg>`;
  }

  if (slug === 'nova-shield') {
    return `<svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg"
      style="width:100%;height:100%;opacity:.85;overflow:visible">
      <defs><style>
        .ns-shield{transform-origin:100px 75px;animation:ns-rot 3s linear infinite}
        .ns-b1{animation:ns-b1k 3.8s linear infinite}
        .ns-b2{animation:ns-b2k 5.2s linear infinite 1.4s}
        .ns-b3{animation:ns-b3k 4.5s linear infinite 2.6s}
        .ns-core{animation:ns-pulse 1.9s ease-in-out infinite}
        @keyframes ns-rot{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes ns-b1k{0%{opacity:0;transform:translate(0,0)}15%{opacity:1}85%{opacity:.9}100%{opacity:0;transform:translate(-40px,20px)}}
        @keyframes ns-b2k{0%{opacity:0;transform:translate(0,0)}15%{opacity:1}85%{opacity:.8}100%{opacity:0;transform:translate(18px,-34px)}}
        @keyframes ns-b3k{0%{opacity:0;transform:translate(0,0)}15%{opacity:.9}85%{opacity:.7}100%{opacity:0;transform:translate(32px,24px)}}
        @keyframes ns-pulse{0%,100%{r:6;fill:white}50%{r:9;fill:#ff5577}}
      </style></defs>
      <circle cx="100" cy="75" r="44" fill="none" stroke="${ac}" stroke-width=".7" stroke-dasharray="4 3" opacity=".3"/>
      <circle cx="100" cy="75" r="11" fill="none" stroke="#ff2244" stroke-width=".9" opacity=".55"/>
      <g class="ns-shield">
        <path d="M144,75 A44,44 0 0,0 122,37" fill="none" stroke="${ac}" stroke-width="4" stroke-linecap="round" opacity=".95"/>
        <path d="M144,75 A44,44 0 0,0 122,37" fill="none" stroke="${ac}" stroke-width="9" stroke-linecap="round" opacity=".12"/>
      </g>
      <circle class="ns-b1" cx="172" cy="28" r="3.5" fill="#4488ff" opacity="0"/>
      <circle class="ns-b2" cx="28"  cy="108" r="3.5" fill="#6644ff" opacity="0"/>
      <circle class="ns-b3" cx="162" cy="118" r="3" fill="#ff6644" opacity="0"/>
      <circle class="ns-core" cx="100" cy="75" r="6" fill="white" opacity=".9"/>
    </svg>`;
  }

  if (slug === 'chrome-rush') {
    return `<svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg"
      style="width:100%;height:100%;opacity:.85;overflow:visible">
      <defs><style>
        .cr-player{animation:cr-run .6s steps(2) infinite}
        .cr-e1{animation:cr-walk1 2.4s linear infinite}
        .cr-e2{animation:cr-walk2 3.1s linear infinite 0.8s}
        .cr-bul{animation:cr-shot 1.1s linear infinite}
        @keyframes cr-run{0%{transform:translateY(0)}50%{transform:translateY(-2px)}}
        @keyframes cr-walk1{0%{transform:translateX(0)}100%{transform:translateX(-80px)}}
        @keyframes cr-walk2{0%{transform:translateX(0)}100%{transform:translateX(-100px)}}
        @keyframes cr-shot{0%{transform:translateX(0);opacity:1}100%{transform:translateX(90px);opacity:0}}
      </style></defs>
      <!-- floor -->
      <line x1="10" y1="118" x2="190" y2="118" stroke="${ac}" stroke-width="1.5" opacity=".6"/>
      <!-- city silhouette bg -->
      <rect x="10" y="88" width="18" height="30" fill="#0a0a1e" opacity=".8"/>
      <rect x="35" y="78" width="12" height="40" fill="#0a0a1e" opacity=".8"/>
      <rect x="155" y="82" width="20" height="36" fill="#0a0a1e" opacity=".8"/>
      <rect x="178" y="72" width="14" height="46" fill="#0a0a1e" opacity=".8"/>
      <!-- enemy 1 (walker, red) -->
      <g class="cr-e1" transform-origin="160px 118px">
        <circle cx="160" cy="104" r="8" fill="none" stroke="#ff4422" stroke-width="1.2"/>
        <rect x="154" y="112" width="12" height="6" fill="none" stroke="#ff4422" stroke-width="1.1"/>
        <line x1="156" y1="118" x2="153" y2="124" stroke="#ff4422" stroke-width="1"/>
        <line x1="162" y1="118" x2="165" y2="124" stroke="#ff4422" stroke-width="1"/>
      </g>
      <!-- enemy 2 (runner, orange) -->
      <g class="cr-e2" transform-origin="178px 118px">
        <polygon points="178,96 172,110 184,110" fill="none" stroke="#ff9900" stroke-width="1.2"/>
        <line x1="174" y1="110" x2="172" y2="118" stroke="#ff9900" stroke-width="1"/>
        <line x1="182" y1="110" x2="184" y2="118" stroke="#ff9900" stroke-width="1"/>
      </g>
      <!-- player -->
      <g class="cr-player" transform-origin="80px 118px">
        <circle cx="80" cy="97" r="6" fill="none" stroke="${ac}" stroke-width="1.3"/>
        <polygon points="80,103 72,116 88,116" fill="none" stroke="${ac}" stroke-width="1.2"/>
        <line x1="74" y1="116" x2="72" y2="124" stroke="${ac}" stroke-width="1"/>
        <line x1="86" y1="116" x2="88" y2="124" stroke="${ac}" stroke-width="1"/>
        <!-- arm pointing right -->
        <line x1="86" y1="108" x2="94" y2="108" stroke="${ac}" stroke-width="1.3"/>
      </g>
      <!-- bullet -->
      <g class="cr-bul" transform-origin="96px 108px">
        <rect x="96" y="106" width="12" height="4" rx="1" fill="#00ffcc" opacity=".9"/>
      </g>
    </svg>`;
  }

  // generic starfield
  const pts = Array.from({ length: 24 }, (_, i) => {
    const x = ((i * 41 + 17) % 180) + 10;
    const y = ((i * 59 + 11) % 130) + 10;
    const r = i % 4 === 0 ? 2 : 1;
    const op = (.3 + (i % 5) * .12).toFixed(2);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${ac}" opacity="${op}"/>`;
  }).join('');
  return `<svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg"
    style="width:100%;height:100%">${pts}</svg>`;
}

// ── starfield ─────────────────────────────────────────────────────────────────
function buildStarfield(container: HTMLElement) {
  for (let i = 0; i < 44; i++) {
    const s = document.createElement('span');
    const size = Math.random() < .12 ? 2 : 1;
    const dur  = 7 + Math.random() * 16;
    s.style.cssText = `
      left:${(Math.random()*100).toFixed(1)}%;
      width:${size}px;height:${size}px;
      opacity:${(.15 + Math.random()*.5).toFixed(2)};
      animation-duration:${dur.toFixed(1)}s;
      animation-delay:${(-(Math.random()*dur)).toFixed(1)}s`;
    container.appendChild(s);
  }
}

// ── ticker ────────────────────────────────────────────────────────────────────
function buildTicker(track: HTMLElement) {
  const items: string[] = [];
  for (const e of CATALOG) {
    items.push(`<span class="ticker-item accent">◆ ${e.title}</span>`);
    items.push(`<span class="ticker-item">${e.tagline}</span>`);
    items.push(`<span class="ticker-sep">///</span>`);
  }
  items.push(`<span class="ticker-item">CABINET ZERO</span>`);
  items.push(`<span class="ticker-sep">///</span>`);
  items.push(`<span class="ticker-item accent">GIOCHI ORIGINALI — ZERO IP DI TERZI</span>`);
  items.push(`<span class="ticker-sep">///</span>`);
  const html = items.join('');
  track.innerHTML = html + html;
}

// ── app shell ─────────────────────────────────────────────────────────────────
const app = document.getElementById('app')!;

app.innerHTML = `
  <div class="bg-grid"><div class="bg-grid-inner"></div></div>
  <div id="progress-bar"><div id="progress-fill"></div></div>

  <header id="site-header">
    <div class="stars" id="stars"></div>
    <div class="retro-grid"></div>
    <h1 class="site-title" data-text="CABINET ZERO">CABINET ZERO</h1>
    <p class="site-sub">giochi arcade originali &mdash; zero IP di terzi</p>
    <div class="hero-meta">
      <div class="hero-chip">
        <span class="hero-chip-label">GIOCHI</span>
        <span class="hero-chip-val" id="chip-games">0</span>
      </div>
      <div class="hero-divider"></div>
      <div class="hero-chip hl">
        <span class="hero-chip-label">RECORD</span>
        <span class="hero-chip-val" id="chip-best">—</span>
      </div>
      <div class="hero-divider"></div>
      <div class="hero-chip">
        <span class="hero-chip-label">ANNO</span>
        <span class="hero-chip-val">2025</span>
      </div>
    </div>
  </header>

  <div id="ticker"><div class="ticker-track" id="ticker-track"></div></div>

  <main id="grid-view">
    <div class="section-head">
      <span class="section-label">LIBRERIA GIOCHI</span>
      <span class="section-count" id="grid-count"></span>
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
          <span class="hint-key"><kbd>←</kbd><kbd>→</kbd>&nbsp;MOVE</span>
          <span class="hint-key"><kbd>W</kbd>&nbsp;JUMP</span>
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
          <div class="go-hs-row">
            <span class="go-hs-label">BEST</span>
            <span class="go-hs-val" id="go-hs-val">0</span>
          </div>
          <p class="go-new-hs hidden" id="go-new-hs">★ NEW HIGH SCORE ★</p>
          <button id="btn-restart">▶ PLAY AGAIN</button>
          <p class="go-hint">— ESC per uscire —</p>
        </div>
      </div>
      <span id="monitor-brand">CABINET ZERO MK.I</span>
      <div id="monitor-led"></div>
    </div>
  </div>

  <footer id="site-footer">
    <span>CABINET ZERO &mdash; opere originali, zero IP di terzi</span>
    <span>Cloudflare Pages &bull; Vite &bull; TypeScript</span>
  </footer>
`;

buildStarfield(document.getElementById('stars')!);
buildTicker(document.getElementById('ticker-track')!);

// ── hero stats ────────────────────────────────────────────────────────────────
const scores   = loadScores();
const allBests = Object.values(scores);
const bestScore = allBests.length > 0 ? Math.max(...allBests) : 0;
document.getElementById('chip-games')!.textContent = String(CATALOG.length);
document.getElementById('chip-best')!.textContent  = bestScore > 0 ? String(bestScore) : '—';

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
gridCount.textContent = `${CATALOG.length} GIOCH${CATALOG.length !== 1 ? 'I' : 'O'}`;

for (const entry of CATALOG) {
  const card = document.createElement('div');
  card.className = 'game-card';
  card.dataset['slug'] = entry.slug;
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
    <div class="corner-tr"></div>
    <div class="corner-bl"></div>
    <div class="corner-br"></div>
    ${hsHtml}
    <div class="card-screen">
      <div class="card-art">${makeArt(entry.slug, entry.accent)}</div>
      <div class="card-screen-sweep"></div>
      <span class="card-screen-title">${entry.title}</span>
    </div>
    <div class="card-body">
      <div class="card-accent-bar"></div>
      <h3 class="card-title">${entry.title}</h3>
      <p class="card-tagline">${entry.tagline}</p>
      <div class="card-footer">
        <span class="card-meta">${entry.year} &nbsp;·&nbsp; ${entry.slug}</span>
        <span class="card-play">GIOCA ▶</span>
      </div>
    </div>
  `;

  card.addEventListener('click', () => { playClickSound(); launchGame(entry.slug); });
  gamesGrid.appendChild(card);
}

// "coming soon" ghost cards to fill the row
const soonsNeeded = Math.max(0, 3 - CATALOG.length);
for (let i = 0; i < soonsNeeded; i++) {
  const ghost = document.createElement('div');
  ghost.className = 'game-card card-soon';
  ghost.innerHTML = `
    <div class="card-screen">
      <div class="soon-screen-inner">
        <span class="soon-qmark">?</span>
        <span class="soon-label">COMING SOON</span>
      </div>
    </div>
    <div class="card-body">
      <div class="card-accent-bar" style="opacity:.15"></div>
      <h3 class="card-title" style="color:#1a1a3a">??? ??? ???</h3>
      <p class="card-tagline" style="color:#0e0e28">In sviluppo...</p>
      <div class="card-footer">
        <span class="card-meta" style="color:#0e0e28">2025</span>
      </div>
    </div>
  `;
  gamesGrid.appendChild(ghost);
}

// ── progress ──────────────────────────────────────────────────────────────────
function progressStart() { progressFill.style.width = '35%'; }
function progressDone()  {
  progressFill.style.width = '100%';
  setTimeout(() => { progressFill.style.width = '0%'; }, 360);
}

// ── launch ────────────────────────────────────────────────────────────────────
async function launchGame(slug: string) {
  const entry = CATALOG.find((e) => e.slug === slug);
  if (!entry) return;
  activeSlug = slug;
  currentScore = 0;
  playLaunchSound();
  stopMenuAudio();

  titleHud.textContent = 'CARICAMENTO…';
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
      goHsVal.textContent = String(best);
      goNewHs.classList.toggle('hidden', !isNew);
      overlay.classList.add('visible');

      refreshCardBadge(slug, best);
      // update hero chip
      const allB = Object.values(loadScores());
      const topB = allB.length > 0 ? Math.max(...allB) : 0;
      const chipBest = document.getElementById('chip-best');
      if (chipBest) chipBest.textContent = topB > 0 ? String(topB) : '—';
    },
  });
}

function refreshCardBadge(slug: string, best: number) {
  const card = gamesGrid.querySelector(`.game-card[data-slug="${slug}"]`) as HTMLElement | null;
  if (!card) return;
  let badge = card.querySelector('.card-hs') as HTMLElement | null;
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'card-hs';
    card.insertBefore(badge, card.firstChild);
  }
  badge.innerHTML = `<span class="card-hs-label">BEST</span><span class="card-hs-val">${best}</span>`;
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
  startMenuAudio();
}

btnBack.addEventListener('click', exitGame);
btnRestart.addEventListener('click', () => { if (activeSlug) launchGame(activeSlug); });
document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && activeHandle) exitGame();
});
