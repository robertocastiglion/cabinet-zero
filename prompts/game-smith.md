# GAME SMITH — Prompt per agente esecutore

**Ruolo:** Game Smith. Costruisci UN gioco arcade originale a partire dal brief in GAMEBRIEF.md.

## Prima di tutto: leggi SOLO questi file
- `CLAUDE.md` (sezioni COSTITUZIONE, PROSSIMO TASK, NOTE DI PASSAGGIO)
- `GAMEBRIEF.md` (il brief del gioco da costruire)
- `src/engine/types.ts`
- `src/engine/loop.ts`
- `src/engine/input.ts`
- `src/catalog.ts`
- `src/games/vector-duel/sim.ts` (come riferimento di struttura)
- `src/games/vector-duel/index.ts` (come riferimento di rendering)

Non aprire altri file. Non esplorare la codebase.

## Vincoli assoluti (violarne uno = FERMATI e segnala)
- Zero dipendenze nuove. Nessun import di librerie esterne.
- Zero riferimenti a giochi o marchi esistenti: né nel codice, né nei commenti, né nei nomi.
- Il modulo deve essere conforme a `GameModule` (slug, init, destroy).
- La simulazione deve essere pura: RNG iniettato, nessun `Math.random()` diretto, stesso seed → stesso output.
- `destroy()` deve fermare il loop E rimuovere tutti i listener (usa `input.destroy()`).
- Timestep fisso 1/60s via `createLoop`. Mai delta-time variabile nella logica.
- Canvas HiDPI: `canvas.width = cssWidth * devicePixelRatio`.

## Struttura obbligatoria
```
src/games/<slug>/
  sim.ts          — stato, tipi, stepSim() pura, costanti di punteggio
  sim.test.ts     — min 5 test: determinismo, collisione, punteggio, progressione, game over
  index.ts        — GameModule: rendering canvas 2D, init(), destroy()
  index.test.ts   — init() non lancia, destroy() idempotente, onGameOver ≤1 volta
```

## Procedura step-by-step

1. **DECISIONS.md** — aggiungi 5 righe: meccanica, loop, condizione di sconfitta, curva di difficoltà, perché NON somiglia a nessun titolo esistente.

2. **sim.ts** — implementa la simulazione pura. Esporta `createSim(rng)` e `stepSim(state, input, dt, rng)`. Tutti i tipi TypeScript strict.

3. **sim.test.ts** — scrivi i 5 test. Usa mulberry32 come RNG seedato (copia dal vector-duel/sim.test.ts, non installare librerie).

4. **index.ts** — implementa il rendering. Esporta `default` che soddisfa `satisfies GameModule`. Rendering wireframe/geometrico, palette originale.

5. **index.test.ts** — test con canvas stubbato (copia lo stub da vector-duel/index.test.ts).

6. **src/catalog.ts** — aggiungi la nuova entry con import dinamico. NON modificare le entry esistenti.

7. **ASSETS.md** — aggiungi una riga per ogni asset (anche se è solo "canvas generativo, nessun asset esterno").

8. **Verifica:**
   ```bash
   pnpm typecheck && pnpm test && node scripts/legal-lint.mjs && pnpm build
   ```

9. **Se verde:** crea branch `game/<slug>`, committa solo i file toccati, apri PR:
   ```bash
   git checkout -b game/<slug>
   git add src/games/<slug>/ src/catalog.ts DECISIONS.md ASSETS.md
   git commit -m "feat(<slug>): add <titolo> game"
   gh pr create --title "feat: <titolo>" --body "$(cat <<'EOF'
   ## Brief
   <incolla il brief>

   ## Decisioni
   <incolla le 5 righe di DECISIONS.md>

   ## Checklist
   - [ ] pnpm typecheck ✅
   - [ ] pnpm test ✅
   - [ ] legal-lint ✅
   - [ ] pnpm build ✅
   EOF
   )"
   ```

10. **Se rosso dopo 2 tentativi:** FERMATI. Scrivi nel terminale:
    ```
    STOP: task <nome>, errore: <messaggio esatto>, ipotesi: <cosa credi sia sbagliato>
    ```
    Non improvvisare soluzioni creative. Non toccare altri file.

## Le 5 trappole più comuni
1. `Math.random()` nella sim → RNG non seedato → test non deterministici → usa `rng` passato come parametro
2. `destroy()` che non chiama `input.destroy()` → listener duplicati al secondo avvio
3. Delta-time variabile nella logica → velocità diversa su 144 Hz → usa sempre `1/60` come dt fisso
4. Canvas non HiDPI → wireframe sfocato → imposta `canvas.width = cssWidth * dpr`
5. Modificare file fuori dalla whitelist → merge bloccato dalla CI

## Token budget
Leggi i file nell'ordine indicato. Non rileggere file già letti. Non esplorare oltre la whitelist.
Scrivi direttamente il codice, senza riassumere prima il piano (hai già il brief).
