// Cutscene pre-boss (FASE 11): l'ingresso nella Sala 1, 14 disegni (docs/storyboard/Frame/Scena pre-boss,
// varianti A di 13 e 14). Va fra la porta della Sala boss e l'arena (`dialogo_pre_boss` → `boss_fase1`).
// ~50 s, saltabile. Tono: D scoglionato, Eve burocratica, Checco mattatore. Le battute sono dati sostituibili.
// Le camere sono in % dello schermo: con `scale` s il disegno può spostarsi al massimo di (s - 1) × 50 % per lato senza mostrare il nero.

import type { CutsceneSet } from './types';

export const LEVEL1_PREBOSS: CutsceneSet = {
  id: 'preboss',
  folder: 'preboss',
  beats: [
    {
      image: '01.webp',
      camera: { from: { x: 0, y: 0, scale: 1 }, to: { x: 0, y: 1.5, scale: 1.16 }, duration: 9, ease: 'none' },
      lines: [
        { speaker: 'narratore', text: 'Sala 1. Vuota. Lo schermo è acceso, ma non proietta niente.' },
        { speaker: 'D', text: 'Eve? Sei corsa avanti senza aspettarmi, come al solito… Eve?' }
      ]
    },
    {
      image: '02.webp',
      fx: ['dim'],
      camera: { from: { x: 0, y: 0, scale: 1.04 }, to: { x: 0, y: -3, scale: 1.24 }, duration: 6, ease: 'power1.in' },
      lines: [{ speaker: 'narratore', text: 'Lo schermo si piega, come l’acqua in uno scarico.' }]
    },
    { image: '03.webp', cut: true, hold: 2.2, sfx: 'whoosh', camera: { from: { x: 0, y: 0, scale: 1.1 }, to: { x: 0, y: 0, scale: 1 }, ease: 'power2.out' } },
    { image: '04.webp', cut: true, hold: 2.2, fx: ['shake', 'flash'], sfx: 'crash', camera: { from: { x: 0, y: 0, scale: 1.1 }, to: { x: 0, y: 0, scale: 1.02 } } },
    {
      image: '05.webp',
      cut: true,
      sfx: 'thud',
      camera: { from: { x: 0, y: 0, scale: 1 }, to: { x: 0, y: 0, scale: 1.22 }, duration: 0.7, ease: 'power3.out' },
      lines: [{ speaker: 'D', text: 'EVE!' }]
    },
    {
      image: '06.webp',
      camera: { from: { x: 0, y: 0, scale: 1.02 }, to: { x: 0, y: 0, scale: 1.04 }, duration: 8, ease: 'none' },
      lines: [{ speaker: 'Eve', text: 'Sistemi… in riavvio. Non… guardare lo schermo.' }]
    },
    {
      image: '07.webp',
      camera: { from: { x: 0, y: 6, scale: 1.14 }, to: { x: 0, y: -6, scale: 1.14 }, duration: 6, ease: 'power1.inOut' },
      lines: [{ speaker: 'narratore', text: 'Dal vortice scende qualcuno. Con calma. Come chi ha il biglietto d’oro.' }]
    },
    {
      image: '08.webp',
      camera: { from: { x: 0, y: 0, scale: 1 }, to: { x: 0, y: 0, scale: 1.14 }, duration: 7, ease: 'none' },
      lines: [{ speaker: 'Checco', text: 'Siete in ritardo. Il film è già cominciato.' }]
    },
    {
      image: '09.webp',
      cut: true,
      camera: { from: { x: 2, y: 0, scale: 1.06 }, to: { x: -2, y: 0, scale: 1.06 }, duration: 7, ease: 'none' },
      lines: [{ speaker: 'D', text: 'Di solito mi lamento e basta. Stasera faccio un’eccezione.' }]
    },
    {
      image: '10.webp',
      camera: { from: { x: 0, y: 0, scale: 1.04 }, to: { x: 0, y: 0, scale: 1.04 }, duration: 7 },
      lines: [{ speaker: 'Checco', text: 'Ah! Un’eccezione. Mi piaci. Ti metto nel film.' }]
    },
    { image: '11.webp', cut: true, hold: 1.6, fx: ['shake'], sfx: 'whoosh', camera: { from: { x: -5, y: 0, scale: 1.12 }, to: { x: 5, y: 0, scale: 1.12 }, duration: 0.8, ease: 'power3.in' } },
    {
      image: '12.webp',
      camera: { from: { x: 0, y: 0, scale: 1 }, to: { x: 0, y: 0, scale: 1.3 }, duration: 8, ease: 'power1.inOut' },
      lines: [{ speaker: 'Checco', text: 'Non volevo. Ma la proiezione deve continuare.' }]
    },
    { image: '13.webp', cut: true, hold: 2.4, sfx: 'whoosh', camera: { from: { x: -1, y: 0, scale: 1.1 }, to: { x: 5, y: 0, scale: 1.1 }, ease: 'power2.in' } },
    {
      image: '14.webp',
      cut: true,
      fx: ['shake'],
      fxEnd: ['whiteout'],
      sfx: 'thud',
      camera: { from: { x: 0, y: 0, scale: 1.1 }, to: { x: 0, y: 0, scale: 1.0 }, duration: 1.2, ease: 'power3.out' },
      lines: [{ speaker: 'D', text: 'Ahi.' }]
    }
  ]
};
