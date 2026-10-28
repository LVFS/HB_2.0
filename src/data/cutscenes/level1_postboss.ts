// Intermezzo dopo il QTE del finale dell'arena (FASE 11): Checco è a terra, poi si rivela la marionetta. 8 disegni
// (docs/storyboard/Frame/Scena post-boss 1). Parte fra `land` e `transform` (vedi `finale.ts`) ed è saltabile; a fine,
// l'arena riprende con lo scaraventamento in-engine. ~45 s. Tono: D scoglionato, Eve burocratica. Battute sostituibili.

import type { CutsceneSet } from './types';

export const LEVEL1_POSTBOSS: CutsceneSet = {
  id: 'postboss',
  folder: 'postboss',
  beats: [
    {
      image: '01.webp',
      camera: { from: { x: 0, y: 0, scale: 1 }, to: { x: 0, y: 0, scale: 1.14 }, duration: 10, ease: 'none' },
      lines: [
        { speaker: 'narratore', text: 'Checco è a terra. Il silenzio dura quasi un secondo.' },
        { speaker: 'Eve', text: 'Bersaglio neutralizzato.' },
        { speaker: 'D', text: 'Non dirlo. Ogni volta che lo dici, poi succede qualcosa.' }
      ]
    },
    {
      image: '02.webp',
      camera: { from: { x: 0, y: 0, scale: 1.02 }, to: { x: 0, y: 0, scale: 1.04 }, duration: 6, ease: 'none' },
      lines: [{ speaker: 'narratore', text: 'Nessun sangue. Strano.' }]
    },
    {
      image: '03.webp',
      camera: { from: { x: -3, y: 0, scale: 1.1 }, to: { x: 3, y: 0, scale: 1.1 }, duration: 9, ease: 'none' },
      lines: [
        { speaker: 'D', text: 'Ce la fai a camminare?' },
        { speaker: 'Eve', text: 'Sto calcolando.' },
        { speaker: 'D', text: 'Quindi no.' }
      ]
    },
    {
      image: '04.webp',
      sfx: 'crack',
      camera: { from: { x: 0, y: 0, scale: 1 }, to: { x: 0, y: 0, scale: 1.3 }, duration: 7, ease: 'power1.inOut' },
      lines: [{ speaker: 'narratore', text: 'L’anello d’oro, sul dito di Checco, si spezza.' }]
    },
    {
      // Il disegno è quasi quadrato: riempiendo lo schermo si ritaglia, quindi si tiene in vista la parte con i due volti.
      image: '05.webp',
      cut: true,
      focus: { y: 36 },
      fx: ['shake'],
      camera: { from: { x: 0, y: 0, scale: 1 }, to: { x: 0, y: 0, scale: 1.08 }, duration: 8, ease: 'none' },
      lines: [
        { speaker: 'Eve', text: 'Segnale in aumento. Dietro di noi.' },
        { speaker: 'D', text: 'Io rilevo un brutto presentimento.' }
      ]
    },
    {
      image: '06.webp',
      cut: true,
      camera: { from: { x: 0, y: -2, scale: 1 }, to: { x: 0, y: 2, scale: 1.25 }, duration: 7, ease: 'power1.inOut' },
      lines: [{ speaker: 'narratore', text: 'La faccia di Checco si crepa. Sotto, un’altra. Di legno.' }]
    },
    {
      image: '07.webp',
      fx: ['dim'],
      camera: { from: { x: 0, y: 6, scale: 1.14 }, to: { x: 0, y: -6, scale: 1.14 }, duration: 7, ease: 'power1.inOut' },
      lines: [{ speaker: 'Checco', text: 'Il film non finisce… finché non lo dico io.' }]
    },
    {
      image: '08.webp',
      fxEnd: ['whiteout'],
      camera: { from: { x: 0, y: 0, scale: 1 }, to: { x: 0, y: 0, scale: 1.3 }, duration: 6, ease: 'power2.in' },
      lines: [{ speaker: 'Checco', text: 'Sipario.' }]
    }
  ]
};
