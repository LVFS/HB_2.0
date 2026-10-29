import { GAMEPAD_BINDINGS, padButtonOf } from './gamepadBindings.ts';
import type { GameAction, InputDevice, PadFamily } from './inputActions.ts';
import { KEYBOARD_LABELS } from './keyboardBindings.ts';
import { glyphFamily } from './padFamily.ts';

type GlyphFamily = Exclude<PadFamily, 'generic'>;

/** Nome di ogni bottone del pad per famiglia (indici della mappatura standard). Su Switch A/B e X/Y sono scambiati rispetto allo standard. */
const BUTTON_LABELS: Record<GlyphFamily, Record<number, string>> = {
  xbox: { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT', 8: 'View', 9: 'Menu' },
  playstation: { 0: '✕', 1: '○', 2: '□', 3: '△', 4: 'L1', 5: 'R1', 6: 'L2', 7: 'R2', 8: 'Share', 9: 'Options' },
  switch: { 0: 'B', 1: 'A', 2: 'Y', 3: 'X', 4: 'L', 5: 'R', 6: 'ZL', 7: 'ZR', 8: '−', 9: '+' }
};

const DIRECTION_LABELS: Record<string, string> = { 'pad:left': '←', 'pad:right': '→', 'pad:up': '↑', 'pad:down': '↓' };

/** Il token del pad che un'azione usa (il principale). */
export function padTokenFor(action: GameAction): string {
  return GAMEPAD_BINDINGS[action][0];
}

/** Come si scrive il tasto di un'azione sul dispositivo dato (testo semplice: per le frasi e per il riserva delle icone). */
export function actionLabel(action: GameAction, device: InputDevice, family: PadFamily): string {
  if (device === 'keyboard') return KEYBOARD_LABELS[action];
  const token = padTokenFor(action);
  const button = padButtonOf(token);
  if (button === null) return DIRECTION_LABELS[token] ?? token;
  return BUTTON_LABELS[glyphFamily(family)][button] ?? `B${button}`;
}

/**
 * Sostituisce i segnaposto `{attack}`, `{skill}`… di un testo con il tasto del dispositivo attuale: i testi dei messaggi
 * (gatto, bonus, desideri) restano veri su tastiera e su controller. Un segnaposto sconosciuto resta com'è. FUNZIONE PURA.
 */
export function formatActionText(text: string, device: InputDevice, family: PadFamily): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in KEYBOARD_LABELS ? actionLabel(name as GameAction, device, family) : match
  );
}
