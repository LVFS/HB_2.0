// Prefetch della schermata successiva durante i tempi morti — vedi
// `docs/PIANO_CARICAMENTO_ASSET.md`, Fase 3. Centralizza qui la logica che
// prima viveva sparsa negli `useEffect` di `MenuScene.tsx`/`LevelSelectScene.tsx`,
// così i due punti di chiamata restano una riga sola.
import { useTexture } from '@react-three/drei';
import { CUTSCENES } from '@/data/cutscenes/registry';
import type { CutsceneId } from '@/data/cutscenes/types';
import { getLevelMapImageUrl, levels } from '@/data/levels';

/**
 * Esegue `fn` quando il thread principale è altrimenti libero, non subito:
 * un prefetch lanciato a raffica competerebbe con animazioni GSAP/rendering
 * in corso proprio nell'istante in cui l'utente sta ancora guardando la
 * schermata attuale. Safari non implementa `requestIdleCallback` — fallback
 * a `setTimeout`, comunque fuori dal frame corrente.
 */
function runWhenIdle(fn: () => void): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => fn());
  } else {
    setTimeout(fn, 1);
  }
}

/**
 * Codice + asset della selezione livelli: da chiamare non appena il menu è
 * "a riposo" (fase `ready`), con largo anticipo sul cambio schermata vero
 * (restano ancora le fasi `punching`/`breaking`, diversi secondi di
 * coreografia — tempo gratis per il download). `Cinema Ariston` e la
 * capsula si autoregistrano già con `useGLTF.preload` al solo import del
 * modulo; la mappa statica del primo livello va invece precaricata a parte,
 * l'URL dipende dal livello e non è noto a livello di modulo.
 */
export function prefetchLevelSelectAssets(): void {
  runWhenIdle(() => {
    import('@/game/menu/levelSelect/LevelSelectScene').catch(() => {});
    const firstLevel = levels.find((level) => level.order === 1) ?? levels[0];
    useTexture.preload(getLevelMapImageUrl(firstLevel));
  });
}

/**
 * Codice della scena di gioco (Level1, 2D — vedi docs/PIANO_LIVELLO1_2D.md):
 * da chiamare non appena si entra nella selezione livelli, non solo al
 * click su "Avvia livello" — da quel momento l'utente può restare a
 * guardare l'elenco/la mappa per un tempo qualunque, tutto tempo gratis per
 * scaricare in background. Niente più pre-warming di Rapier da qui: il
 * livello 2D non usa il motore fisico (collisioni a mano, vedi
 * `@/game/render2d`).
 */
export function prefetchLevel1Assets(): void {
  runWhenIdle(() => {
    import('@/game/levels/Level1/SceneManager2D').catch(() => {});
  });
  prefetchCutsceneVideo('intro_level1');
  // Sfondo e navicella dell'esterno: scaldano la cache mentre si guarda il video (nessuna decodifica qui).
  for (const path of ['sprites/backgrounds/ariston_ingresso.webp', 'sprites/props/navicella.webp']) {
    runWhenIdle(() => {
      fetch(`${import.meta.env.BASE_URL}${path}`, { priority: 'low' }).catch(() => {});
    });
  }
}

/**
 * Le mappe statiche delle città NON mostrate all'ingresso in
 * `LevelSelectScene` (oggi sempre `order === 1`): senza questo, il primo
 * cambio città via `CloudTransition` scatta comunque la prima volta,
 * perché `IslandCapTexture` andrebbe a scaricare/decodificare quella
 * texture solo nel momento in cui la città diventa quella mostrata. Chiamata
 * una sola volta, al montaggio di `LevelSelectScene` — l'utente guarda
 * comunque la prima città per un po' prima di cambiarla.
 */
export function prefetchOtherCityMaps(currentLevelId: string): void {
  runWhenIdle(() => {
    levels
      .filter((level) => level.id !== currentLevelId)
      .forEach((level) => useTexture.preload(getLevelMapImageUrl(level)));
  });
}

const prefetched = new Set<string>();

/**
 * Scalda la cache HTTP con una cinematica video (e i suoi sottotitoli) PRIMA che serva: quando parte la cutscene il file è già
 * (in buona parte) scaricato. A riposo e a bassa priorità, una volta sola per id; se il download fallisce non succede nulla
 * (la cutscene avrà il suo caricamento con «Riprova / Salta»). Intro: da `prefetchLevel1Assets` (selezione livelli);
 * pre-boss: all'ingresso dell'interno dell'Ariston.
 */
export function prefetchCutsceneVideo(id: CutsceneId): void {
  const video = CUTSCENES[id].video;
  if (!video || prefetched.has(id)) return;
  prefetched.add(id);
  runWhenIdle(() => {
    for (const path of [video.subtitles, video.src]) {
      if (path) fetch(`${import.meta.env.BASE_URL}${path}`, { priority: 'low' } as RequestInit).catch(() => prefetched.delete(id));
    }
  });
}
