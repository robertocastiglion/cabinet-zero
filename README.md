# CABINET ZERO

Giochi arcade originali — nessun IP di terzi, zero dipendenze runtime, deploy automatico su Cloudflare Pages.

## Stack

- TypeScript strict · Vite · Cloudflare Pages
- Vitest + jsdom per i test
- Zero dipendenze runtime

## Sviluppo locale

```bash
# richiede pnpm 11+ e Node 20+
pnpm install
pnpm dev         # http://localhost:5173
```

Se pnpm 11 blocca esbuild (ERR_PNPM_IGNORED_BUILDS), esegui `pnpm approve-builds` in modo interattivo.

## Comandi

```bash
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest run
pnpm build       # output in dist/
node scripts/legal-lint.mjs   # guardrail copyright
```

## Deploy

Il deploy avviene automaticamente:

- **Production:** ogni push su `main` → Cloudflare Pages deploya `dist/`
- **Preview:** ogni PR → Cloudflare Pages crea un URL di preview

Setup una tantum: Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git → seleziona `cabinet-zero`.

Build settings:
- Build command: `pnpm install && pnpm build`
- Build output directory: `dist`
- Production branch: `main`

## Aggiungere un nuovo gioco

1. Riempi `GAMEBRIEF.md` con il brief del gioco
2. Lancia Claude Code con `prompts/game-smith.md`
3. Attendi che la CI sia verde sulla PR
4. Gioca 3 minuti sulla preview Cloudflare
5. Mergia → online

## Struttura

```
src/
  engine/       # game loop, input, tipi
  games/
    vector-duel/   # sim.ts (logica pura) + index.ts (rendering)
  catalog.ts    # registro dei giochi
  main.ts       # shell: griglia + montaggio
tests/
  conformance.test.ts   # contratto GameModule per ogni gioco
scripts/
  legal-lint.mjs        # guardrail copyright (gira in CI)
prompts/
  game-smith.md         # prompt per generare nuovi giochi
```

## Licenza

MIT — vedi `ASSETS.md` per le licenze degli asset.
