# DECISIONS

## Dipendenze

| Data | Pacchetto | Motivo |
|------|-----------|--------|
| — | — | Nessuna dipendenza runtime. Zero. |

## Scelte architetturali

| Data | Scelta | Alternativa scartata | Motivo |
|------|--------|---------------------|--------|
| T0 | Vite bundler | Parcel, esbuild puro | Ottimo DX, tree-shaking nativo, supporto import dinamici per code-split dei giochi |
| T0 | Vitest + jsdom | Jest | Integrazione nativa con Vite, stessa config, ES modules senza transpilazione |
| T1 | Timestep fisso 1/60s + accumulatore | dt variabile | Delta-time variabile causa velocità diversa su monitor 144 Hz |
| T2 | event.code | event.keyCode | keyCode è deprecated; code è indipendente dal layout tastiera |
