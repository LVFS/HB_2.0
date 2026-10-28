# FASE 9 — Tunnel: Slancio, bonus ed eventi

Obiettivo: rendere meno monotona la corsa del tunnel (FASE 8) senza toccarne le fondamenta.
Tono: epico + demenziale (battute da shonen scalcinato). Riferimenti: Dragon Ball, One Piece,
Frieren, Mario Kart, Indiana Jones, il Cammino di Santiago (frecce gialle).

Scelte dell'utente: Slancio con **velocità reale**; la marionetta **non si vede subito** (la
barra della distanza resta in alto) e quando un evento la tiene fuori scena si apre una
**finestra** che mostra cosa fa; al posto delle conchiglie, bonus a tema videogiochi/anime;
per ora solo gli elementi qui sotto.

## 1. Slancio (`tunnelSlancio.ts`)
- `noHitTime` = secondi di corsa senza danni (reali). Livello = `floor(noHitTime / SLANCIO_STEP)`,
  da 0 a `SLANCIO_TEMPO.length - 1`. Un colpo subito azzera tutto.
- `world.tempo` (1 → 1.3) rincorre il tempo del livello. **Tutto ciò che è del mondo** (tempo di
  corsa, minacce, detriti, proiettili, lanci) avanza di `delta * tempo`; **tutto ciò che è del
  giocatore** (salto, dash, parata, timer) resta in tempo reale: più Slancio = meno tempo per
  reagire. La deriva del `gap` cresce con il livello.
- `validateScript()` controlla la leggibilità anche al tempo massimo.

## 2. Marionetta nascosta e finestra
- Prima di `TUNNEL_PUPPET_REVEAL_T` (inizio della sezione del lanciatore) la marionetta sta fuori
  schermo: la barra "Distanza" è l'unico indizio. Poi entra di corsa e parla.
- Evento "Checco si stacca": per la durata dell'evento la marionetta resta fuori scena; la
  **finestra** (`PuppetWindow`) si apre in alto a destra e la mostra (scooter/razzo/leva).
- Gli avvisi dei lanci restano leggibili anche con la marionetta fuori schermo (bordo destro).

## 3. Bonus (`tunnelPickups.ts`, `world.pickups`)
| Bonus | Effetto |
|---|---|
| Sfera del Drago (Dragon Ball) | monete a righe/archi; 7 = SHENRON: cura piena, distanza −15, Slancio al massimo per 4 s |
| Fagiolo Senzu (Dragon Ball) | +40 vita subito |
| Frutto Gomu Gomu (One Piece) | 8 s: `J` diventa un pugno a gomma (portata ×4) che rompe e rimanda anche i colpi non parabili |
| Aura Super Saiyan (Dragon Ball) | 5 s: invincibile, Slancio al massimo, travolge ciò che tocca |
| Grimorio di Frieren | 1 carica di **Zoltraak** (`L`): raggio che polverizza tutto davanti a D |
| Ciak! (cinema) | 3 s di bullet-time (tempo del mondo ×0.45) |
| Freccia gialla (Cammino) | trampolino a terra: supersalto (raggiunge i bonus alti) |

## 4. Eventi (`tunnelEvents.ts`)
- **A — Checco si stacca** (34-48 s): la distanza sale (+30, mai oltre 85), la marionetta parte su
  uno scooter fuori scena, la finestra si apre e arrivano le **guardie del cinema** (un colpo di
  spada, oppure si saltano); ogni guardia abbattuta = distanza −4 e una Sfera. Finito, Checco riappare.
- **B — Il masso** (62-77 s): una palla d'acciaio rotola alle spalle di D. Per tutta la durata non
  ci si può curare. Ogni colpo subito la avvicina; due colpi ravvicinati e schiaccia (grosso
  danno) e si ritira. Sopravvivere = pioggia di Sfere. La finestra si apre solo i primi 3 s
  (Checco che tira la leva).

## 5. Dove sta il codice
Nuovi: `tunnelSlancio.ts`, `tunnelPickups.ts`, `tunnelEvents.ts`, `tunnelSpecial.ts` (Zoltraak),
`tunnelHud.ts`, `PickupsLayer.tsx` (+ `pickupIcons.ts`), `PuppetWindow.tsx`, `PuppetFigure.tsx`,
`TunnelBoulder.tsx`, `TunnelBonusFx.tsx`. (Il componente dei bonus NON si chiama `TunnelPickups.tsx`:
su Windows confligge con `tunnelPickups.ts`.) Modificati: `tunnelConfig/State/Driver/Player/Combat/
Puppet/Director`, `TunnelHazards`, `TunnelFx`, `CheccoPuppetRunner`, `SceneManagerTunnel`,
`usePlayerActions` (azione `special` = `L`), `arenaStore` (+ campi HUD), `ArenaHud`.

## 6. Accettazione
- [x] `validateScript()` vuoto anche al tempo massimo.
- [x] Nessun danno per 8/16/24 s → tempo 1.1/1.2/1.3; un colpo → torna a 1 (il tempo scende in ~1 s).
- [x] Prima del reveal la marionetta non è visibile; dopo sì; durante l'evento A no, e la finestra è aperta.
- [x] Ogni bonus ha il suo effetto e scade; `L` senza Grimorio non fa nulla.
- [x] Il masso schiaccia al secondo colpo ravvicinato; le guardie si abbattono con un colpo.
- [x] Morire e ripartire azzera bonus, eventi, Slancio; salto e dash non cambiano di durata (sono in tempo reale).
- [x] tsc, lint, build, regressione arena (44 controlli) e un bot del tunnel verdi.

## 7. Stato di esecuzione
Eseguita. Verifica: bot che gioca la corsa intera. Perfetto (0 colpi): arriva alla raffica in ~77 s
reali (Slancio al massimo quasi sempre, i due eventi partono). Con il 35% di reazioni mancate: 13
colpi, nessuna sconfitta, ~97 s reali. Chunk `SceneManagerTunnel` ~49.7 kB (gzip 16).

### Scostamenti dal piano
- **Guardie: un colpo, non due.** A 9 u/s (fino a 11.7 con lo Slancio) una guardia resta nella
  portata della spada ~0.24 s e un fendente dura 0.36 s: due colpi sono impossibili. Con un colpo la
  differenza rispetto a una cassa è la ricompensa (distanza −4 e una Sfera).
- **Corsa più corta in tempo reale.** La durata resta 100 s di tempo del MONDO, ma con lo Slancio
  scorre a 1.1–1.3×: una corsa perfetta dura ~77 s reali invece di ~99. Se serve più lunga: alzare
  `TUNNEL_TOTAL_DURATION` e le sezioni in `tunnelConfig.ts` e allungare il copione.
- **Masso:** parte a 3.4 unità e si vede a sinistra di D (a 5.5 restava fuori schermo).
- **Distanza massima della marionetta** 11 → 16 unità (con il gap alto esce davvero di scena).
- La camera guarda più avanti con il tempo (`TUNNEL_CAMERA_LEAD_PER_TEMPO`): con lo Slancio si
  vedono arrivare le minacce.
- Il Ciak! rallenta solo il mondo: il giocatore resta in tempo reale, quindi dà un vantaggio vero.
- `jumpToTime` dentro un evento lo riavvia (la distanza risale): è solo un comodo per i test.

### Da tarare giocando
`SLANCIO_STEP`/`SLANCIO_TEMPO`/`SLANCIO_GAP_DRIFT`, durata dei bonus (`GOMU`, `SAIYAN`, `CIAK`),
`DETACH_GAP_BONUS`, `BOULDER`, e la posizione dei bonus in `tunnelDirector.TUNNEL_PICKUPS`. Le battute
degli eventi sono in `TUNNEL_EVENTS` (`tunnelConfig.ts`).
