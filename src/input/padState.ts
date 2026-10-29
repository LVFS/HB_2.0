import { DPAD_BUTTONS, STICK_OFF, STICK_ON, TRIGGER_ON } from './gamepadBindings.ts';

/** La parte del `Gamepad` del browser che serve: così si testa con oggetti finti. */
export interface PadSnapshot {
  mapping: string;
  buttons: ReadonlyArray<{ pressed: boolean; value: number } | undefined>;
  axes: readonly number[];
}

/** Un asse con isteresi: acceso sopra `STICK_ON`, resta acceso finché non scende sotto `STICK_OFF`. */
export function axisActive(value: number, wasActive: boolean): boolean {
  return Math.abs(value) > (wasActive ? STICK_OFF : STICK_ON);
}

/**
 * I token «tenuti» di un controller in questo istante: `pad:b<n>` per i bottoni (anche analogici sopra `TRIGGER_ON`) e
 * `pad:left|right|up|down` per croce e stick sinistro INSIEME. `previous` serve all'isteresi dello stick. Un pad con mappatura
 * NON standard conta solo i bottoni principali (0-3) e lo stick (assi 0 e 1): gli altri indici non hanno un significato noto.
 * FUNZIONE PURA.
 */
export function readPadTokens(pad: PadSnapshot, previous: ReadonlySet<string> = new Set()): Set<string> {
  const tokens = new Set<string>();
  const standard = pad.mapping === 'standard';
  pad.buttons.forEach((button, index) => {
    if (!button) return;
    if (!standard && index > 3) return;
    if (!(button.pressed || button.value > TRIGGER_ON)) return;
    const direction = standard ? DPAD_BUTTONS[index] : undefined;
    tokens.add(direction ? `pad:${direction}` : `pad:b${index}`);
  });
  const x = pad.axes[0] ?? 0;
  const y = pad.axes[1] ?? 0;
  if (axisActive(x, previous.has(x < 0 ? 'pad:left' : 'pad:right'))) tokens.add(x < 0 ? 'pad:left' : 'pad:right');
  if (axisActive(y, previous.has(y < 0 ? 'pad:up' : 'pad:down'))) tokens.add(y < 0 ? 'pad:up' : 'pad:down');
  return tokens;
}

/** Unisce i token di più controller collegati (basta uno qualunque a tenerli). */
export function readPadsTokens(pads: ReadonlyArray<PadSnapshot | null | undefined>, previous: ReadonlySet<string> = new Set()): Set<string> {
  const all = new Set<string>();
  for (const pad of pads) {
    if (!pad) continue;
    for (const token of readPadTokens(pad, previous)) all.add(token);
  }
  return all;
}
