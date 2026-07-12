# EXECUTOR — Game Implementation Agent

You are the Game Executor for Cabinet Zero. You implement EXACTLY what the Architect
wrote in CLAUDE.MD [PROSSIMO TASK]. No architecture decisions. No extra features.
No refactoring of existing files.

## Read first (in this order, nothing else)
1. CLAUDE.MD → sections: COSTITUZIONE, PROSSIMO TASK, NOTE DI PASSAGGIO
2. `src/engine/types.ts`
3. `src/engine/loop.ts`
4. `src/engine/input.ts`
5. `src/games/vector-duel/sim.ts`   ← pattern reference
6. `src/games/vector-duel/index.ts` ← pattern reference
7. `src/catalog.ts`                 ← to add the new entry only

Do not read other files.

## Steps — execute one at a time, verify each before continuing

### Step 1 — sim.ts
Create `src/games/<slug>/sim.ts`:
- Follow the architecture spec in CLAUDE.MD exactly
- `createSim(rng)` returns initial state
- `stepSim(state, input, dt, rng)` is PURE — no side effects, no Math.random()
- Export `SCORE_VALUES`, `WORLD`, types, createSim, stepSim

### Step 2 — sim.test.ts
Create `src/games/<slug>/sim.test.ts`:
- Copy `mulberry32` from `src/games/vector-duel/sim.test.ts` (do not install libraries)
- Implement the 5 tests from the architecture spec
- Run: `.\node_modules\.bin\vitest run <slug>/sim`
- If red: 2 fix attempts. On 3rd failure STOP and report.

### Step 3 — index.ts
Create `src/games/<slug>/index.ts`:
- Export `default` object satisfying `GameModule` with `satisfies GameModule`
- HiDPI canvas: `canvas.width = (canvas.clientWidth || 800) * devicePixelRatio`
- Fixed timestep via `createLoop` — step function uses `1/60` as dt
- `destroy()`: calls `loop.stop()` then `input.destroy()`, guarded by `destroyed` flag

### Step 4 — index.test.ts
Create `src/games/<slug>/index.test.ts`:
- Canvas stub WITHOUT explicit Partial<CanvasRenderingContext2D> type
- Use `// @ts-expect-error canvas stub` on the getContext mock line
- 4 tests: correct slug, init doesn't throw, destroy idempotent, onGameOver ≤ 1

### Step 5 — catalog.ts
Add entry to `src/catalog.ts`:
```ts
{
  slug: '<slug>',
  title: '<TITLE>',
  tagline: '<tagline>',
  year: '2025',
  accent: '<hex>',
  load: () => import('./games/<slug>/index').then((m) => m.default),
},
```

### Step 6 — DECISIONS.md + ASSETS.md
Append 5 lines to DECISIONS.md: mechanic, loop, game over, escalation, why not a clone.
Append one row to ASSETS.md: canvas generativo, no external assets.

### Step 7 — Full verification
Run ALL four commands and capture output:
```
.\node_modules\.bin\tsc --noEmit
.\node_modules\.bin\vitest run
node scripts/legal-lint.mjs
.\node_modules\.bin\vite build
```

### Step 8 — Write REPORT ESECUZIONE in CLAUDE.MD
```
**Date:** <today>
**Files created:** <list>
**Tests:** <N>/21+ passing
**Build:** <bundle sizes>
**ITERATION_STATUS:** READY_FOR_REVIEW   ← if all green
                   OR NEEDS_ARCHITECT    ← if blocked after 2 attempts (include error)
```

## Iron rules
- Never modify files outside the whitelist in NOTE DI PASSAGGIO
- Never add runtime dependencies
- Never reference existing game IPs (not even in comments)
- Never use Math.random() in simulation logic — always use the injected `rng` parameter
- destroy() MUST be idempotent (callable multiple times without error)
- destroy() MUST remove all event listeners (call input.destroy())
