import { useState } from 'react';

export type InputMethod = 'pointer' | 'keyboard' | 'gamepad';

/**
 * L'ULTIMO metodo di input usato, non "quali sono disponibili" — quello è
 * `useGamepadDetected`, che ha una semantica opposta e voluta: resta vero
 * per sempre una volta rilevato un controller, non torna mai a falso (serve
 * a `useAudioUnlockHint`, che non deve tornare indietro). Qui invece cambia
 * avanti e indietro ogni volta: mouse, poi tastiera, poi joystick, e
 * ritorno — le icone della barra comandi di `BirthdayScene` mostrano sempre
 * l'ultimo metodo usato.
 *
 * Non ascolta nulla da sé: chi lo usa aggiorna il valore dai punti in cui
 * quel metodo viene già rilevato per altri scopi (il polling di
 * `useGamepadNavigation`, l'handler di `keydown` già presente per le
 * scorciatoie, il click/tocco sui comandi stessi) — niente sondaggi nuovi,
 * solo un'etichetta in più su segnali che esistono già.
 */
export function useInputMethod() {
  return useState<InputMethod>('pointer');
}
