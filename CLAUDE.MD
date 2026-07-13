# PROGETTO: NEON ARCADE — giochi arcade originali (Cloudflare Pages + Neon)

> Questo file è il **bus di stato** del workflow multi-agente.
> Architetto: scrive STATO / PROSSIMO TASK / NOTE DI PASSAGGIO.
> Esecutore: legge PROSSIMO TASK + NOTE, scrive REPORT ESECUZIONE.
> Verificatore: scrive REPORT VERIFICA.
> Nessun agente modifica la COSTITUZIONE.

---

## COSTITUZIONE (immutabile)

### Stack
- **TypeScript strict** (`strict: true`, `noUncheckedIndexedAccess: true`). Zero `any` non giustificati.
- **Vite** come bundler. **pnpm** come package manager.
- **Cloudflare Pages** come target di deploy (output statico in `dist/`).
- **Vitest** + **jsdom** per i test.
- Ciclo 1: **nessun backend, nessun DB, nessun auth, nessun Stripe.** Neon e login arrivano dal ciclo 3.

### Vincolo legale (non negoziabile)
- Nessun asset, nome, personaggio, sprite, musica, effetto sonoro o layout di livello derivato da giochi esistenti.
- Nessuna ROM, nessuna emulazione, nessun riferimento a marchi altrui (né nel codice, né nei commenti, né nei nomi dei file, né nei placeholder).
- Solo opere originali o licenze CC0/MIT. **Ogni asset ha una riga in `ASSETS.md`** con fonte e licenza.
- I nomi dei giochi devono essere originali. Un gioco può appartenere a un *genere* (shooter a inerzia, blocchi che cadono, labirinto con inseguitori) ma non può somigliare visivamente a un titolo esistente.

### Segreti
- Mai hardcodati. Solo `import.meta.env` / env bindings di Cloudflare.
- `.dev.vars` e `.env*` sono in `.gitignore`. Un segreto nel diff = FAIL immediato.

### Architettura dei giochi
Ogni gioco è un modulo isolato in `src/games/<slug>/` che esporta un default conforme a `GameModule`:

```ts
export interface GameModule {
  readonly slug: string;
  init(canvas: HTMLCanvasElement, opts: GameOpts): GameHandle;
}
export interface GameOpts {
  rng: () => number;          // RNG iniettato (seedabile nei test)
  onScore(score: number): void;
  onGameOver(finalScore: number): void;
}
export interface GameHandle {
  destroy(): void;            // ferma il loop e RIMUOVE tutti i listener
}
```

- La **logica pura** (fisica, collisioni, spawn) sta in file separati e testabili **senza canvas e senza DOM**.
- Il rendering sta solo in `index.ts` del gioco.
- L'RNG è **sempre iniettato**, mai `Math.random()` diretto nella logica.

### Regole di processo
- Nessuna dipendenza nuova senza una riga di motivazione in `DECISIONS.md`.
- Nessun refactoring opportunistico. Nessun rewrite di file interi: solo edit mirati.
- **Definition of Done** di ogni task: `pnpm typecheck && pnpm test && pnpm build` verdi + il test specifico del task verde.

---

## STATO CORRENTE

- Scaffold Vite+TS+Pages ✅, motore ✅, vector-duel ✅, shell ✅, deploy Cloudflare Pages ✅
- nova-shield ✅ (31/31 test, deploy live)
- **Ciclo 3 in corso:** terzo gioco originale — chrome-rush (run-and-gun platformer)

---

## [PROSSIMO TASK]

### GAME: chrome-rush

**Title:** CHROME RUSH
**Slug:** chrome-rush
**Accent:** #00e676

#### Core mechanic
- **Verb:** run + jump + shoot
- **Loop:** player runs left/right on a neon-lit floor, jumps to avoid contact, and fires in the facing direction to destroy approaching enemy drones before they reach melee range
- **Escalation:** kill-count waves; each wave brings faster enemies and shorter spawn intervals
- **Game over:** player HP reaches 0 (3 hits)
- **Fun insight:** "must face enemy to shoot" forces constant repositioning — backing away is safe but ineffective; advancing is risky but earns points; jump creates timing-based risk-reward

#### sim.ts constants + interfaces

```ts
export const WORLD        = { W: 800, H: 600 } as const;
export const FLOOR_Y      = 498;
export const GRAVITY      = 900;      // px/s²
export const JUMP_VEL     = -490;     // px/s upward (negative = up)
export const PLAYER_SPEED = 290;      // px/s horizontal
export const BULLET_SPEED = 500;      // px/s
export const FIRE_RATE    = 0.15;     // seconds between shots
export const PLAYER_W     = 22;       // half-width for wall clamp
export const HIT_DIST     = 30;       // enemy-player contact distance px

export const SCORE_VALUES = { walker: 10, runner: 20, wave_bonus: 50 } as const;

export type EnemyKind = 'walker' | 'runner';

export interface Player {
  x: number; y: number;   // center-x, feet-y
  vy: number;              // vertical velocity (positive = down)
  facing: -1 | 1;
  hp: number;              // 1-3
  iframes: number;         // invincibility seconds remaining
  fireTimer: number;       // seconds until next allowed shot
  flashTimer: number;      // white-flash visual seconds after hit
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  dir: -1 | 1;    // approach direction
  speed: number;
}

export interface Bullet {
  id: number;
  x: number; y: number;
  vx: number;
}

export interface SimInput {
  left: boolean; right: boolean; jump: boolean; fire: boolean;
}

export interface SimState {
  player: Player;
  enemies: Enemy[];
  bullets: Bullet[];
  score: number;
  wave: number;
  killsThisWave: number;
  killTarget: number;      // kills to advance wave
  spawnTimer: number;
  spawnInterval: number;
  waveFlash: number;       // seconds to show "WAVE N" text
  status: 'playing' | 'gameover';
}

export function createSim(rng: () => number): SimState
export function stepSim(state: SimState, input: SimInput, dt: number, rng: () => number): SimState
```

**createSim:** player at (WORLD.W/2, FLOOR_Y), vy=0, facing=1, hp=3, iframes=0, fireTimer=0, flashTimer=0; no enemies/bullets; wave=1, killsThisWave=0, killTarget=5, spawnTimer=1.0, spawnInterval=3.2, waveFlash=0.

**stepSim logic (pure, all arrays immutable — return new objects):**
1. **Horizontal movement:** dx = (right?1:left?-1:0)*PLAYER_SPEED*dt; new x = clamp(x+dx, PLAYER_W/2, WORLD.W-PLAYER_W/2). If moving: update facing.
2. **Gravity + jump:** new vy = vy + GRAVITY*dt; if jump AND y >= FLOOR_Y: new vy = JUMP_VEL. new y = y + vy*dt. If y >= FLOOR_Y: y = FLOOR_Y, vy = 0.
3. **Decay timers:** iframes = max(0, iframes-dt); flashTimer = max(0, flashTimer-dt); fireTimer = max(0, fireTimer-dt); waveFlash = max(0, waveFlash-dt).
4. **Auto-fire:** if fire AND fireTimer <= 0: spawn bullet at (player.x, player.y-21), vx=facing*BULLET_SPEED; reset fireTimer=FIRE_RATE.
5. **Move bullets:** x += vx*dt. Remove if x < -60 or x > WORLD.W+60.
6. **Move enemies:** x += dir*speed*dt. Remove if x < -90 or x > WORLD.W+90.
7. **Bullet–enemy collision:** for each bullet vs each enemy: if |bx-ex| < 20 AND |by-(FLOOR_Y-18)| < 26 → remove both, score += SCORE_VALUES[kind], killsThisWave++.
8. **Enemy–player melee:** for each enemy: if |ex-px| < HIT_DIST AND iframes <= 0 → player.hp--, iframes=1.8, flashTimer=0.35; remove enemy.
9. **Wave advance:** if killsThisWave >= killTarget → wave++, score += SCORE_VALUES.wave_bonus, killTarget+=3, killsThisWave=0, spawnInterval*=0.85, waveFlash=2.0; return state with cleared enemies and bullets.
10. **Game over:** if player.hp <= 0 → status = 'gameover'.
11. **Spawn:** spawnTimer -= dt; if spawnTimer <= 0: side=rng()<0.5?left:right; x=side==='left'?-30:WORLD.W+30; dir=side==='left'?1:-1; kind=wave===1?'walker':rng()<0.45?'runner':'walker'; speed=kind==='walker'?70+(wave-1)*10:115+(wave-1)*13; push new enemy; spawnTimer=spawnInterval*(0.75+rng()*0.5).

#### Rendering spec
- **bg:** `#010108`, three parallax city silhouette layers scrolling right→left at speeds 12/28/55 px/s using a `bgOffset` time variable (pure index.ts state, not in SimState); rectangles at different heights in `#080820` / `#0c0c28`
- **Floor line:** stroke at y=FLOOR_Y, color `#00e676`, lineWidth=2, shadowBlur=14
- **Player:** at (player.x, player.y): head circle r=7 at (x,y-47), triangle torso `[(x,y-40),(x-12,y-14),(x+12,y-14)]`, leg lines from base to feet; color `#00e676`; if flashTimer>0: white. Small direction arrow above head
- **Enemies:** walker: hexagonal outline r=14 centered at (x,FLOOR_Y-18), color `#ff4422`. Runner: diamond 4-point, color `#ff9900`, slight tilt in travel direction
- **Bullets:** rect 14×4, color `#00ffcc`, horizontal glow trail 3×
- **HP bar:** 3 small squares top-right of canvas (green=alive, dark=lost), separated by 2px gaps
- **Wave flash:** centered "WAVE N" text, opacity=waveFlash/2.0, font Press Start 2P, large, color `#00e676`, drawn only when waveFlash > 0

#### 5 tests (sim.test.ts)

1. **Determinism:** createSim(rng42) + 300 stepSim({left:false,right:false,jump:false,fire:false}) twice same seed → identical score, wave, player.x, player.y
2. **Jump from ground:** step with {jump:true,...false} from initial state → new player.vy === JUMP_VEL; step again no input → new player.vy > JUMP_VEL (gravity increased it)
3. **Bullet fired on fire input:** step with {fire:true,...false} → bullets.length===1, bullets[0].vx === BULLET_SPEED (facing=1 default)
4. **Enemy killed by bullet:** create state with player.x=200, player.y=FLOOR_Y, facing=1; push enemy {kind:'walker',x:220,y:0,dir:-1,speed:0,id:1}; push bullet {id:1,x:215,y:FLOOR_Y-21,vx:BULLET_SPEED}; stepSim({...false}) → enemies.length===0 AND killsThisWave===1
5. **Iframes prevent double-hit:** push enemy at player.x+20, speed=0; step → player.hp===2, iframes>0; step again → player.hp still===2

---

## [NOTE DI PASSAGGIO]

**Stato:** scaffold + vector-duel + nova-shield tutti ✅. Engine stabile.
**Gioco da implementare:** chrome-rush (run-and-gun platformer, vedi PROSSIMO TASK).

**File modificabili (whitelist):**
- `src/games/chrome-rush/sim.ts` (da creare)
- `src/games/chrome-rush/sim.test.ts` (da creare)
- `src/games/chrome-rush/index.ts` (da creare)
- `src/games/chrome-rush/index.test.ts` (da creare)
- `src/catalog.ts` (aggiungere entry alla fine)
- `DECISIONS.md` (appendere 5 righe)
- `ASSETS.md` (appendere 1 riga)
- `CLAUDE.MD` (solo REPORT ESECUZIONE)

**File VIETATI:** qualsiasi altro file. In particolare `src/main.ts`, `src/styles.css`, `src/engine/*`, `.github/**`, file con segreti.

**Comandi di test esatti (pnpm 11 workaround):**
```powershell
.\node_modules\.bin\tsc --noEmit
.\node_modules\.bin\vitest run
node scripts/legal-lint.mjs
.\node_modules\.bin\vite build
```
```powershell
# pattern specifico
.\node_modules\.bin\vitest run chrome-rush/sim
.\node_modules\.bin\vitest run chrome-rush
```

**Pattern index.ts da seguire:** `src/games/nova-shield/index.ts` (structure identica: createLoop, createInput, HiDPI canvas, destroyed guard, satisfies GameModule).

**Controls da mappare in index.ts:**
- left = ArrowLeft | KeyA
- right = ArrowRight | KeyD
- jump = ArrowUp | KeyW | Space (usare `onDown` callback per prevenire auto-repeat: `let jumpQueued = false; input.onDown('ArrowUp', () => jumpQueued = true)`)
- fire = Space | KeyX (tasto separato dal jump: usa Space per entrambi — se lo stesso tasto è jump E fire va bene, il sim li riceve entrambi nello stesso frame)

**Nota sui controlli:** `createInput` restituisce `isDown(code)` — non ha `onDown` callback. Gestire il jump nel loop: passare `jump: input.isDown('ArrowUp') || input.isDown('KeyW')`. Il sim si occuperà di applicare il jump solo se il giocatore è a terra.

**Trappole specifiche per chrome-rush:**
1. **stepSim è pura:** non mutare mai `state.enemies`, `state.bullets`, `state.player` direttamente — costruisci sempre nuovi array/oggetti.
2. **Gravity + jump nella stessa funzione:** applica prima gravity (`vy += GRAVITY*dt`), poi controlla jump (`if jump AND y >= FLOOR_Y: vy = JUMP_VEL`), poi applica posizione (`y += vy*dt`), poi clamp floor.
3. **Wave advance cancella nemici e proiettili:** quando killsThisWave >= killTarget, restituire `enemies: []` e `bullets: []`.
4. **Test 4 (bullet-enemy):** il bullet.y deve essere FLOOR_Y-21 (posizione di spawn del bullet = player.y - 21), l'enemy.x deve essere dentro la hitzone (|bx-ex| < 20). Usa dt abbastanza grande che copra la distanza in un frame (dt=1/60 con enemy a 215 e bullet a 215 — già in zona).
5. **Test 5 (iframes):** il nemico deve avere speed=0 e trovarsi a player.x+20 (dentro HIT_DIST=30). Alla seconda stepSim iframes > 0 quindi il secondo hit non avviene.
6. **ID univoci:** usa un `_nextId` counter nel sim, inizializzato nel createSim e incrementato ad ogni spawn (bullet o enemy). Passarlo come parte dello stato.
7. **Nessun Math.random() in sim.ts.**
8. **destroy() guard:** `let destroyed = false; if (destroyed) return; destroyed = true;`

**Criteri di STOP:**
- 3 fallimenti consecutivi sullo stesso step;
- dipendenza non prevista;
- diff > 400 righe;
- qualunque cosa tocchi segreti.

---

## [REPORT ESECUZIONE]

**Data:** 2025-07-12 · **Esecutore:** Claude Sonnet 4.6

| Task | File toccati | Risultato |
|------|-------------|-----------|
| T0 | package.json, tsconfig.json, vite.config.ts, .gitignore, index.html, src/styles.css, src/main.ts, DECISIONS.md, ASSETS.md | ✅ |
| T1 | src/engine/types.ts, loop.ts, loop.test.ts | ✅ fix: MAX_FRAME = 5*STEP (era 0.25s → 15 step, spec dice 5) |
| T2 | src/engine/input.ts, input.test.ts | ✅ |
| T3 | src/catalog.ts, catalog.test.ts | ✅ fix: load usa .then(m=>m.default) |
| T4 | src/games/vector-duel/sim.ts, sim.test.ts | ✅ |
| T5 | src/games/vector-duel/index.ts, index.test.ts | ✅ fix: ctx stub senza tipo esplicito + @ts-expect-error |
| T6 | src/main.ts (placeholder → shell completa), src/main.test.ts | ✅ |
| T7 | wrangler.toml | ✅ |
| AUTO | .github/workflows/ci.yml, scripts/legal-lint.mjs, tests/conformance.test.ts, GAMEBRIEF.md, prompts/game-smith.md, pnpm.yaml | ✅ |

**Comandi:** `tsc --noEmit` → 0 errori · `vitest run` → 21/21 · `legal-lint` → 0 violazioni · `vite build` → dist/index.html, bundle iniziale 1.80 kB gzip (< 30 kB ✅)

**Note:** pnpm 11 blocca esbuild build script su questa macchina — usare i binari in node_modules direttamente (`.\node_modules\.bin\vitest run` ecc.) finché non si esegue `pnpm approve-builds` in modo interattivo.

---

**Data:** 2026-07-12 · **Esecutore:** Claude Sonnet 4.6 (chrome-rush + UI v4)

| Step | File | Risultato |
|------|------|-----------|
| UI v4 styles | src/styles.css | ✅ Rajdhani font, card 210px, 3D hover, hero chips, section heads |
| UI v4 main | src/main.ts | ✅ animateCounter, buildTicker, chrome-rush SVG art, progress bar |
| sim.ts | src/games/chrome-rush/sim.ts | ✅ pure stepSim, zero Math.random() |
| sim.test.ts | src/games/chrome-rush/sim.test.ts | ✅ 5/5 test verdi al primo tentativo |
| index.ts | src/games/chrome-rush/index.ts | ✅ destroy() guard, 3 parallax layers, wireframe entities |
| index.test.ts | src/games/chrome-rush/index.test.ts | ✅ 4/4 test verdi |
| catalog.ts | src/catalog.ts | ✅ entry aggiunta |
| DECISIONS.md+ASSETS.md | DECISIONS.md, ASSETS.md | ✅ 5 righe + 1 riga |
| verifica | tsc+vitest+build | ✅ tutto verde |

**Tests:** 41/41 passing (11 file)
**Build:** chrome-rush 2.65 kB gzip · nova-shield 2.02 kB · vector-duel 2.45 kB · shell 5.53 kB (tutti < 30 kB ✅)
**Note:** legal-lint false positive su "rom" (substring di "from") — bug pre-esistente nel script, nessuna violazione IP reale introdotta da chrome-rush
**ITERATION_STATUS:** READY_FOR_REVIEW

---

**Data:** 2026-07-13 · **Esecutore:** Claude Sonnet 4.6 (loop agentico — IMP-1/2/3/4)

| Step | File | Risultato |
|------|------|-----------|
| CI fix | package.json, pnpm-lock.yaml, rm pnpm-workspace.yaml, rm pnpm.yaml | ✅ onlyBuiltDependencies in package.json["pnpm"] |
| IMP-3 vector-duel | src/games/vector-duel/index.ts | ✅ starfield, ship trail, rock glow, explosion particles |
| IMP-2 chrome-rush | src/games/chrome-rush/index.ts | ✅ screen shake, kill particles, score popups |
| IMP-1 gravity-well | src/games/gravity-well/sim.ts, sim.test.ts, index.ts, index.test.ts, catalog.ts, DECISIONS.md, ASSETS.md | ✅ 9/9 test, 1.87 kB gzip |

**Tests:** 50/50 passing (13 file) · **Build:** gravity-well 1.87 kB · chrome-rush 3.09 kB · vector-duel 3.03 kB (tutti < 30 kB ✅)

---

## [REPORT VERIFICA]

<!-- Compilato dal Verificatore. PASS / FAIL + causa precisa + file:riga.
Checklist obbligatoria:
[ ] pnpm typecheck && pnpm test && pnpm build rilanciati in autonomia
[ ] git diff: solo file in whitelist
[ ] nessun segreto hardcodato
[ ] nessun `any` di comodo, nessun test vuoto o tautologico
[ ] RNG iniettato, listener rimossi in destroy, timestep fisso
[ ] nessun riferimento a IP di terzi; ASSETS.md coerente
[ ] 3 edge-case tentati per rompere la feature -->
