# Fase 3 — Sprite e animazione 2D di D0/D1/Eve

Nota su come procedere: ho preparato qui gli asset e la specifica, ma il codice per
implementarli lo scrivi tu (o il tuo assistente in VS Code) — coerente con la scelta di
tenere un solo posto alla volta a toccare il repo lato codice.

## Cosa ho preparato

Dalle turnaround sheet già fatte (`D0.jpg`, `D1.jpg`, `Eve/eve.jpg`) ho ritagliato le 4
pose (fronte/retro/lato/azione) e tolto lo sfondo grigio uniforme (chroma-key con alpha
sfumata sui bordi, non un taglio netto — i capelli di Eve e la lama di D1 restano puliti).
12 file PNG con trasparenza, già copiati nel repo in:

```
public/sprites/characters/D0/{D0_front,D0_back,D0_side,D0_action}.png
public/sprites/characters/D1/{D1_front,D1_back,D1_side,D1_action}.png
public/sprites/characters/Eve/{Eve_front,Eve_back,Eve_side,Eve_action}.png
```

## Il limite reale da sapere prima di scrivere codice

Le 4 pose per personaggio bastano per uno **swap di pose intere** (idle, attacco,
transizione D0→D1), NON per un vero rig a pezzi separati (torso/braccio/gamba
indipendenti) come immaginato nel piano originale. Il motivo è semplice: le pose sono
illustrazioni composite, non livelli separati — segmentare in automatico un braccio da un
busto dipinto in modo affidabile non è fattibile senza rifare l'arte a pezzi (o senza
mascherare a mano in un editor tipo GIMP/Krita, lavoro umano vero, non un problema di
codice). Quindi propongo un approccio a due livelli, il primo utilizzabile SUBITO con
quello che c'è già:

**3a — Pose swap (con questi 12 file, si comincia oggi)**: ogni stato del personaggio è
UNA delle 4 pose (o la stessa pose specchiata per girarsi, `scale.x = -1`, mai una texture
duplicata). Scoperta utile guardando gli export: la 4ª posa di `D0` NON è una posa d'azione
come nelle altre due sheet, è già una posa a metà passo (braccia e gambe in contrapposto,
tipica di un ciclo di camminata) — quindi per D0 (il civile) un ciclo cammino a 2
fotogrammi VERO (`D0_front` ↔ `D0_action`, alternati con un GSAP `yoyo` a ritmo del passo)
è già possibile oggi, non serve il trucco del dondolio procedurale. Per `D1` ed `Eve`
invece la 4ª posa è un affondo di combattimento (arma pronta), non un passo — per il loro
cammino resta valido il dondolio procedurale sulla posa `front` finché non si producono
pose dedicate. L'attacco di D1/Eve usa la loro `action`; hit reaction può essere `action`
(o `front`) con un flash bianco veloce invece di un fotogramma dedicato. Il cambio D0→D1
quando riceve l'arma è un crossfade diretto tra le due cartelle di sprite, non
un'animazione — un taglio netto (magari con un lampo/dissolvenza) è più onesto di una
finta transizione fluida che non abbiamo i fotogrammi per fare.

**3b — Rig a pezzi veri (più avanti, richiede arte nuova)**: se in futuro si vuole un vero
ciclo di camminata/attacco con arti che si muovono indipendentemente, serve produrre pezzi
ISOLATI (torso da solo, braccio superiore da solo, ecc.) con lo stesso strumento/stile
usato per le turnaround sheet — non estraibili da quelle che ci sono già. Non è un blocco
per partire, è solo onesto segnalarlo ora invece che scoprirlo a metà implementazione.

## Contratto per il codice (Fase 3a)

- `Character2D.tsx` (in `src/game/render2d/`, riusabile per D e per Eve): props
  `{ variant: 'D0' | 'D1' | 'Eve', pose: 'front' | 'back' | 'side' | 'action', facing: 1 | -1 }`,
  carica la texture da `public/sprites/characters/{variant}/{variant}_{pose}.png` con lo
  stesso `Sprite2D` già costruito in Fase 1 (piano texturizzato), applica `scale.x = facing`.
- Stati/azioni da coprire per lo storyboard (nomi indicativi, da rifinire quando si scrive
  la macchina a stati del livello):
  - `idle` → posa `front`, nessun dondolio o dondolio minimo
  - `walk` → per `D0`: vero ciclo a 2 fotogrammi, `front` ↔ `action` alternati (`action` è
    di fatto una posa a metà passo, non un'azione di combattimento, per questo personaggio).
    Per `D1`/`Eve`: dondolio procedurale su `front` (nessuna posa a metà passo disponibile
    per loro, vedi sotto)
  - `attack` → posa `action`, hold breve + rientro a `idle`
  - `hit` → `action` (o `front`) + flash bianco veloce (tint via materiale, non una texture)
  - `transformToD1` → crossfade `D0_*` → `D1_*` (dissolvenza GSAP, ~0.3-0.5s, non istantaneo
    secco)
- Eve segue lo stesso componente (`variant: 'Eve'`), utile fin da subito per il
  cammino-libero-Ariston (Fase 4) dove deve solo seguire D dietro di lui.

## Cosa manca ancora, onestamente

Nessuna posa di "cammino a metà passo" per `D1`/`Eve` (solo per `D0` c'è già, vedi sopra),
nessuna posa di schivata per nessuno dei tre, nessuna posa per la doppia spada in
movimento (solo l'affondo statico già visto). Se vuoi migliorare il feel del cammino di
D1/Eve o della schivata prima di 3b, l'investimento più economico non è il rig a pezzi ma
generare 2-3 pose aggiuntive nello stesso stile (mid-stride per D1/Eve, schivata laterale
per tutti) con lo stesso strumento usato finora — restano comunque pose intere, compatibili
con 3a senza riscrivere nulla.
