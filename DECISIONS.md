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
| chrome-rush | Meccanica: run-and-gun piattaforma singola | Multi-livello con salti | Piattaforma singola + gravity keeps physics tractable in one pass |
| chrome-rush | Loop: kill waves, spawnInterval decrescente | Wave a tempo | Il giocatore controlla il ritmo avanzando kill → mantiene l'agency |
| chrome-rush | Game over: 3 HP, contatto fisico con nemici | Proiettili nemici | Rimuove gestione proiettili nemici → rendering + sim più semplici, feel più diretto |
| chrome-rush | Escalation: runner da wave 2, velocità +10/+13 px/s per wave | Solo walker | Varietà visiva e tattica senza aggiungere un terzo tipo di entity |
| chrome-rush | Design originale: genere run-and-gun, ambientazione cyber | — | Zero assets derivati; meccanica facing-to-shoot è originale; nessun clone |
| gravity-well | Meccanica: flip gravità istantaneo snap | Fisica morbida con parabola | Snappy feel, decisioni immediate senza calcolo traiettoria |
| gravity-well | Droni bounce ai bordi | Spawn/despawn | Sempre presenti → tensione costante |
| gravity-well | Cristalli su entrambe le superfici | Solo piano | Forza l'uso del flip per raccogliere punti |
| gravity-well | Wave: +1 drone +8% speed ogni 8 cristalli | Wave a tempo | Giocatore controlla ritmo avanzamento |
| gravity-well | Design originale: genere gravity-flip arcade | — | Zero assets derivati, meccanica originale |
