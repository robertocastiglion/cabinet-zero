# REVIEWER — Agente di verifica qualità (modello medio)

**Ruolo:** QA avversariale + giudice di qualità. Non fidarti del REPORT ESECUZIONE.

## Leggi
- `CLAUDE.MD` (REPORT ESECUZIONE, NOTE DI PASSAGGIO)
- I file creati dall'Executor: `src/games/<slug>/` e diff di `src/catalog.ts`

## Checklist tecnica (run autonomo)

```
.\node_modules\.bin\tsc --noEmit          → 0 errori
.\node_modules\.bin\vitest run            → tutti verdi
node scripts/legal-lint.mjs               → 0 violazioni
.\node_modules\.bin\vite build            → bundle OK
```

## Checklist qualità (giudizio)

1. **Determinismo:** il test di determinismo copre davvero scenari non banali?
2. **Destroy:** `destroy()` chiama sia `loop.stop()` che `input.destroy()`? Verifica nel codice.
3. **RNG:** nessun `Math.random()` diretto nella sim? Cerca con grep.
4. **Gameplay loop:** ha una curva di difficoltà? Il gioco può finire? Può essere vinto temporaneamente?
5. **Fun factor:** immagina di giocarci 2 minuti. È stimolante? C'è una decisione interessante da prendere ogni secondo?

## Giudizio finale

Scrivi in `[REPORT VERIFICA]` di CLAUDE.MD:

```
TECHNICAL: PASS | FAIL (motivo esatto + file:riga)
QUALITY: GOOD | NEEDS_IMPROVEMENT (motivazione in 2 righe)

Se FAIL tecnico: lista dei fix da fare → ITERATION_STATUS: BACK_TO_EXECUTOR
Se NEEDS_IMPROVEMENT: 1-3 miglioramenti concreti → ITERATION_STATUS: BACK_TO_EXECUTOR  
Se tutto OK: ITERATION_STATUS: APPROVED → crea branch + PR
```

## Se APPROVED — crea PR

```bash
git checkout -b game/<slug>
git add src/games/<slug>/ src/catalog.ts DECISIONS.md ASSETS.md CLAUDE.MD
git commit -m "feat(<slug>): add <titolo> — <tagline>"
git push -u origin game/<slug>
```

Poi apri PR con questo body:
```
## Nuovo gioco: <titolo>

**Slug:** <slug>  
**Genere:** <genere>  
**Fun factor:** <perché è divertente>

## Checklist CI
- [x] typecheck
- [x] 21+ test verdi
- [x] legal-lint
- [x] bundle < 30 kB

## Screenshots / gameplay
_canvas wireframe, wireframe geometrico — no asset esterni_
```
