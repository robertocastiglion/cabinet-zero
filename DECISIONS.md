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
| nova-shield | Meccanica: scudo rotante che deflette proiettili | Sparatutto a mira libera | Solo left/right → decisioni split-second chiare, accessibile |
| nova-shield | Loop: proiettili da bordo verso centro | Timer spawn + wave | Tensione costante, escalation naturale con spawnInterval × 0.85 |
| nova-shield | Game over: proiettile dentro r=18 (core) | Vite limitata | Visivamente chiaro: zona rossa al centro = morte |
| nova-shield | Escalation: +1 wave ogni N deflect, velocità +18px/s | Wave a tempo | Il giocatore controlla il ritmo — più è bravo più è dura |
| nova-shield | Design originale: nessun clone | — | Non emula nessun titolo; genere "deflettore concentrico" originale |
