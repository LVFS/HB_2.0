import { useEffect, type RefObject } from 'react';
import { inputManager } from './inputManager';

/**
 * Navigazione dei menu HTML col controller (FASE 14b): croce o stick sinistro spostano il fuoco fra gli elementi marcati
 * `data-nav` DEL LIVELLO più in alto, X/✕ (A) li «clicca», ○ (B) chiama `onBack` del livello. Un livello è un pannello (menu,
 * impostazioni, conferma…); l'ultimo registrato comanda, così un pannello aperto sopra un altro lo mette in pausa da solo.
 * `data-nav-default` indica dove parte il fuoco. Solo i token del PAD: tastiera e mouse restano com'erano (Tab, frecce, click).
 */

interface NavLayer {
  root: HTMLElement;
  onBack?: () => void;
}

const layers: NavLayer[] = [];
let unsubscribe: (() => void) | null = null;

const FOCUS_ATTR = 'data-pad-focus';
type Direction = 'left' | 'right' | 'up' | 'down';
const DIRECTIONS: Partial<Record<string, Direction>> = { left: 'left', right: 'right', laneUp: 'up', laneDown: 'down' };

function candidates(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('[data-nav]')].filter((el) => {
    if ((el as HTMLButtonElement).disabled) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

function current(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[${FOCUS_ATTR}]`);
}

function setFocus(root: HTMLElement, el: HTMLElement): void {
  root.querySelectorAll(`[${FOCUS_ATTR}]`).forEach((other) => other.removeAttribute(FOCUS_ATTR));
  el.setAttribute(FOCUS_ATTR, 'true');
  el.focus({ preventScroll: false });
}

function focusDefault(root: HTMLElement): HTMLElement | null {
  const all = candidates(root);
  const target = all.find((el) => el.hasAttribute('data-nav-default')) ?? all[0] ?? null;
  if (target) setFocus(root, target);
  return target;
}

/** Il candidato più adatto nella direzione data: vicino sull'asse, poco spostato di lato. */
function neighbour(from: HTMLElement, all: HTMLElement[], direction: Direction): HTMLElement | null {
  const a = from.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of all) {
    if (el === from) continue;
    const b = el.getBoundingClientRect();
    const dx = b.left + b.width / 2 - ax;
    const dy = b.top + b.height / 2 - ay;
    const along = direction === 'right' ? dx : direction === 'left' ? -dx : direction === 'down' ? dy : -dy;
    const across = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (along <= 2) continue;
    const score = along + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

/** Su un cursore (`input[type=range]`) sinistra/destra cambiano il valore. */
function nudgeRange(input: HTMLInputElement, direction: 'left' | 'right'): void {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const step = (max - min) * 0.05;
  const next = Math.min(max, Math.max(min, Number(input.value) + (direction === 'right' ? step : -step)));
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, String(next));
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function handle(action: string, down: boolean, token: string): void {
  if (!down || !token.startsWith('pad:')) return;
  const layer = layers[layers.length - 1];
  if (!layer) return;
  const direction = DIRECTIONS[action];
  if (direction) {
    const focused = current(layer.root);
    if (!focused) {
      focusDefault(layer.root);
      return;
    }
    if (focused instanceof HTMLInputElement && focused.type === 'range' && (direction === 'left' || direction === 'right')) {
      nudgeRange(focused, direction);
      return;
    }
    const next = neighbour(focused, candidates(layer.root), direction);
    if (next) setFocus(layer.root, next);
  } else if (action === 'confirm' && token === 'pad:b0') {
    const focused = current(layer.root);
    if (!focused) focusDefault(layer.root);
    else focused.click();
  } else if (action === 'back') {
    layer.onBack?.();
  }
}

const clearOnPointer = (): void => {
  document.querySelectorAll(`[${FOCUS_ATTR}]`).forEach((el) => el.removeAttribute(FOCUS_ATTR));
};

function refresh(): void {
  if (layers.length > 0 && !unsubscribe) {
    const release = inputManager.subscribe(handle, { always: true });
    window.addEventListener('pointerdown', clearOnPointer);
    unsubscribe = () => {
      release();
      window.removeEventListener('pointerdown', clearOnPointer);
    };
  } else if (layers.length === 0 && unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}

export function registerNavLayer(layer: NavLayer): () => void {
  layers.push(layer);
  refresh();
  // Con un controller in mano il fuoco compare subito sul punto di partenza; col mouse aspetta la prima pressione.
  if (inputManager.getDeviceState().device === 'gamepad') focusDefault(layer.root);
  return () => {
    const index = layers.indexOf(layer);
    if (index >= 0) layers.splice(index, 1);
    layer.root.querySelectorAll(`[${FOCUS_ATTR}]`).forEach((el) => el.removeAttribute(FOCUS_ATTR));
    refresh();
  };
}

/** Il pannello `ref` diventa un livello di navigazione da controller finché `enabled`. `onBack` risponde a ○/B. */
export function usePadNavLayer(ref: RefObject<HTMLElement>, enabled: boolean, onBack?: () => void): void {
  useEffect(() => {
    const root = ref.current;
    if (!enabled || !root) return;
    return registerNavLayer({ root, onBack });
    // `onBack` cambia a ogni render del chiamante: il livello tiene l'ultimo senza ri-registrarsi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ref]);
  useEffect(() => {
    // Aggiorna `onBack` sul livello già registrato (stessa radice).
    const root = ref.current;
    const layer = layers.find((candidate) => candidate.root === root);
    if (layer) layer.onBack = onBack;
  });
}
