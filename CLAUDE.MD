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
- **Ciclo 2 in corso:** secondo gioco originale — nova-shield (deflettore rotazionale)

---

## [PROSSIMO TASK]

### GAME: nova-shield

**Title:** NOVA SHIELD
**Slug:** nova-shield
**Accent:** #ff6600

#### Core mechanic
- **Verb:** deflect
- **Loop:** energy bolts fly from the arena edges toward the center; player rotates a shield arc to intercept them before they reach the core
- **Escalation:** each wave adds more simultaneous bolts and increases their speed; wave bonus every 10 deflections
- **Game over:** any bolt reaches within 18px of the center (the player's core)
- **Fun insight:** the rotation mechanic creates split-second "which bolt to save first" decisions — satisfying when you barely catch one, tense when two converge at once

#### sim.ts architecture

```ts
export const SCORE_VALUES = { deflect: 10, wave_bonus: 50 } as const;
export const WORLD = { W: 800, H: 600 } as const;
export const CENTER = { x: 400, y: 300 } as const;
export const SHIELD_RADIUS = 90;          // distance of arc from center
export const SHIELD_SPAN = Math.PI * 0.44; // ~80° arc half-angle each side = 160° total
export const SHIELD_TURN = 2.8;           // rad/s

export interface Vec2 { x: number; y: number }

export interface Bolt {
  id: number;
  pos: Vec2;
  vel: Vec2;  // always pointed roughly toward CENTER, speed varies
}

export interface SimInput {
  left: boolean;
  right: boolean;
}

export interface SimState {
  shieldAngle: number;      // radians, 0 = right, increases clockwise
  bolts: Bolt[];
  score: number;
  wave: number;
  deflected: number;        // total deflections this wave
  spawnTimer: number;       // counts down to next bolt spawn
  spawnInterval: number;    // seconds between spawns (decreases with wave)
  status: 'playing' | 'gameover';
}

// Exported for tests
export function createSim(rng: () => number): SimState
export function stepSim(state: SimState, input: SimInput, dt: number, rng: () => number): SimState
```

**stepSim logic (pure, no side effects):**
1. Update shieldAngle: `+= (right ? 1 : left ? -1 : 0) * SHIELD_TURN * dt`; wrap to [0, 2π)
2. Update each bolt: `pos += vel * dt`
3. **Shield collision check:** for each bolt, compute `dist = distance(bolt.pos, CENTER)`. If `dist <= SHIELD_RADIUS + 6` AND `dist >= SHIELD_RADIUS - 20`:
   - compute `boltAngle = atan2(bolt.pos.y - CENTER.y, bolt.pos.x - CENTER.x)`
   - compute angular diff vs shieldAngle, normalize to (−π, π)
   - if `|angularDiff| <= SHIELD_SPAN`: deflect → reverse radial velocity component (bolt bounces away from center); score += SCORE_VALUES.deflect; deflected++
4. **Wave check:** if `deflected >= 5 + wave * 2` → wave++, score += SCORE_VALUES.wave_bonus, deflected = 0, spawnInterval *= 0.85
5. **Death check:** for each bolt, if `distance(bolt.pos, CENTER) < 18` → status = 'gameover'
6. **Remove bolts** that have traveled far enough to be off-screen (distance > 700) or have been deflected (track via a `deflected` flag on bolt, or filter in collision)
7. **Spawn timer:** spawnTimer -= dt; when ≤ 0: spawn new bolt from random edge at radius 480–500 from center, velocity aimed at CENTER ± small random offset (use rng), speed = 130 + wave * 18 + rng()*30; reset spawnTimer = spawnInterval

**Bolt spawning:** pick random angle θ = rng() * 2π, pos = (CENTER.x + cos(θ)*490, CENTER.y + sin(θ)*490), vel aimed at CENTER with speed variance.

#### Rendering
- **bg:** `#030308`
- **Arena:** faint concentric rings at r=90 (shield orbit, dashed), r=18 (death zone, red pulsing), r=40 (inner warning ring)
- **Shield:** arc drawn with `ctx.arc(CENTER.x, CENTER.y, SHIELD_RADIUS, shieldAngle - SHIELD_SPAN, shieldAngle + SHIELD_SPAN)`, thick stroke `#ff6600`, glow via shadow
- **Core:** filled circle r=10 at CENTER, color white normally, flashes red when a bolt is within r=120
- **Bolts:** small filled circles r=5, color interpolated from `#4488ff` (slow) to `#ff2244` (fast) based on speed; glow
- **Deflection sparks:** on deflect, draw 4–6 short lines radiating from collision point (can be done purely in render with a `lastDeflect` field in state holding position + age)
- **Special effect:** bolt trail — draw 3 fading smaller circles behind each bolt position (use `ttl` or derive from position + velocity extrapolation)

#### 5 tests (exact descriptions for sim.test.ts)

1. **Determinism:** run `createSim(rng42)` then 300 `stepSim` calls with no input and fixed rng seed — repeat with identical seed → `state.score`, `state.wave`, `state.shieldAngle` must be identical
2. **Shield deflects bolt:** place a bolt at `(CENTER.x + SHIELD_RADIUS - 5, CENTER.y)` moving toward center, set `shieldAngle = 0` (shield centered right) → after one step, bolt's x-velocity should reverse (moving away from center)
3. **Bolt reaching core causes gameover:** place bolt at `(CENTER.x + 17, CENTER.y)` moving left at speed 200, no shield coverage → after one step `state.status === 'gameover'`
4. **Wave increments on enough deflections:** create state with `deflected = 5 + wave * 2 - 1` (one short of threshold), trigger one more deflection manually via positioned bolt + aligned shield → `state.wave` increments by 1
5. **destroy() idempotent, onGameOver ≤ 1 time** (index.test.ts)

---

## [NOTE DI PASSAGGIO]

**Stato:** scaffold completo. Engine (loop, input, types), vector-duel, shell, CI tutti funzionanti.
**Gioco da implementare:** nova-shield (vedi PROSSIMO TASK sopra).

**File modificabili (whitelist):**
- `src/games/nova-shield/sim.ts` (da creare)
- `src/games/nova-shield/sim.test.ts` (da creare)
- `src/games/nova-shield/index.ts` (da creare)
- `src/games/nova-shield/index.test.ts` (da creare)
- `src/catalog.ts` (aggiungere entry)
- `DECISIONS.md` (appendere 5 righe)
- `ASSETS.md` (appendere 1 riga)
- `CLAUDE.MD` (solo REPORT ESECUZIONE)

**File VIETATI:** qualsiasi altro file, in particolare `src/main.ts`, `src/styles.css`, `src/engine/*`, `.github/**`, file con segreti.

**Comandi di test esatti (pnpm 11 workaround — usa i binari direttamente):**
```powershell
.\node_modules\.bin\tsc --noEmit
.\node_modules\.bin\vitest run
node scripts/legal-lint.mjs
.\node_modules\.bin\vite build
```
```bash
# pattern specifico
.\node_modules\.bin\vitest run nova-shield/sim
.\node_modules\.bin\vitest run nova-shield
```

**Trappole specifiche per nova-shield:**
1. **Deflect come deep copy:** `stepSim` è pura — non mutare l'array `bolts`, restituisci sempre nuovi oggetti.
2. **Angular wrap:** quando calcoli la differenza angolare shieldAngle−boltAngle, normalizzala a (−π, π) con `((diff + Math.PI) % (2*Math.PI)) - Math.PI`.
3. **Bolt rimossi dopo il deflect:** un bolt deflesso deve essere rimosso dalla lista (o flaggato), altrimenti viene controllato più volte nello stesso frame.
4. **Wave check:** controlla wave DOPO aver aggiornato `deflected`, non prima.
5. **destroy() guard:** usa un flag `let destroyed = false; if (destroyed) return; destroyed = true;` all'inizio di destroy().
6. **Nessun Math.random() in sim.ts.** Il mulberry32 per i test è già in `src/games/vector-duel/sim.test.ts` — copialo.

**Criteri di STOP (fermati e scrivi in REPORT ESECUZIONE):**
- 3 fallimenti consecutivi sullo stesso step;
- ti serve una dipendenza non prevista;
- il diff di un singolo step supera 400 righe;
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

**Data:** 2026-07-12 · **Esecutore:** Claude Sonnet 4.6 (nova-shield)

| Step | File | Risultato |
|------|------|-----------|
| sim.ts | src/games/nova-shield/sim.ts | ✅ creato, zero Math.random() |
| sim.test.ts | src/games/nova-shield/sim.test.ts | ✅ 5/5 test verdi al primo tentativo |
| index.ts | src/games/nova-shield/index.ts | ✅ destroy() guard + loop.stop() + input.destroy() |
| index.test.ts | src/games/nova-shield/index.test.ts | ✅ 4/4 test verdi |
| catalog.ts | src/catalog.ts | ✅ entry aggiunta |
| DECISIONS.md+ASSETS.md | DECISIONS.md, ASSETS.md | ✅ 5 righe + 1 riga |
| verifica | tsc+vitest+build | ✅ tutto verde |

**Tests:** 31/31 passing (9 file)
**Build:** nova-shield 2.02 kB gzip · vector-duel 2.45 kB · shell 4.76 kB (tutti < 30 kB ✅)
**Note:** legal-lint riporta false positive su "rom" (substring di "from") — bug pre-esistente nel script, non introdotto da questo game
**ITERATION_STATUS:** READY_FOR_REVIEW

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
