import { GAMEPAD_BINDINGS } from './gamepadBindings';
import type { GameAction, InputDevice, PadFamily } from './inputActions';
import { KEYBOARD_BINDINGS, type KeyboardOverrides } from './keyboardBindings';
import { padFamily } from './padFamily';
import { readPadsTokens, type PadSnapshot } from './padState';
import { actionsForToken } from './tokenActions';

/**
 * Gestore UNICO dell'input (FASE 14), fuori da React: tastiera, mouse e controller diventano TOKEN («j», «mouse0», «pad:b2»,
 * «pad:left») e i token diventano AZIONI di gioco (`inputActions.ts`). Un solo `requestAnimationFrame` legge
 * `navigator.getGamepads()`; i listener della finestra si accendono col primo che li chiede (canale o abbonato) e si spengono con
 * l'ultimo. Tiene l'ULTIMO dispositivo usato e la famiglia del pad (Xbox / PlayStation / Switch) per scegliere le icone.
 *
 * Due modi di leggerlo:
 *  - un CANALE (`createChannel`): `isHeld` / `justPressed` / `consume` / `moveX`, con la propria coda di pressioni (così chi consuma
 *    non svuota la coda di un altro). È ciò che usa `usePlayerActions`.
 *  - un ABBONATO (`subscribe`): riceve ogni pressione e rilascio di un token con le azioni a cui corrisponde. Serve ai QTE, alla
 *    schivata delle cutscene (Esc/Start tenuti) e alle scelte a carte.
 * Pulizia: su `blur`/`visibilitychange` i tasti tenuti vengono rilasciati; se un pad sparisce i suoi token vengono rilasciati
 * (nessun tasto «incollato»).
 */

export type PressListener = (action: GameAction, down: boolean, token: string) => void;

export interface InputChannel {
  /** L'azione è tenuta da tastiera o da pad adesso. */
  isHeld: (action: GameAction) => boolean;
  /** L'azione è stata premuta da quando si è svuotata la coda (senza auto-repeat). */
  justPressed: (action: GameAction) => boolean;
  /** Pressione di un tasto grezzo di tastiera (anteprime dev). */
  keyJustPressed: (key: string) => boolean;
  /** -1 sinistra, 1 destra, 0 fermo (o entrambi): tastiera, croce e stick insieme. */
  moveX: () => -1 | 0 | 1;
  /** Svuota le pressioni in coda (i tasti tenuti restano tenuti). */
  consume: () => void;
  dispose: () => void;
}

export interface InputDeviceState {
  device: InputDevice;
  family: PadFamily;
}

class InputManager {
  private readonly keyHeld = new Set<string>();
  private padHeld = new Set<string>();
  private readonly channels = new Set<{ pressed: Set<string> }>();
  private readonly listeners = new Set<PressListener>();
  private readonly tokenListeners = new Set<(token: string, down: boolean) => void>();
  private readonly deviceListeners = new Set<() => void>();
  private refs = 0;
  private raf = 0;
  private warnedNonStandard = false;
  private snapshot: InputDeviceState = { device: 'keyboard', family: 'generic' };
  private blockContextMenu = 0;

  // ---------- Ciclo di vita ----------

  private retain(): () => void {
    if (this.refs === 0) this.start();
    this.refs += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.refs -= 1;
      if (this.refs === 0) this.stop();
    };
  }

  private start(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('blur', this.releaseAll);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.raf = requestAnimationFrame(this.poll);
  }

  private stop(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('blur', this.releaseAll);
    document.removeEventListener('visibilitychange', this.onVisibility);
    cancelAnimationFrame(this.raf);
    this.keyHeld.clear();
    this.padHeld.clear();
  }

  // ---------- API ----------

  /** Un canale con la sua coda di pressioni. `overrides` sostituisce i binding di TASTIERA (es. il tunnel: salto solo Spazio). */
  createChannel(overrides: KeyboardOverrides = {}, options: { blockContextMenu?: boolean } = {}): InputChannel {
    const release = this.retain();
    const entry = { pressed: new Set<string>() };
    this.channels.add(entry);
    if (options.blockContextMenu) this.blockContextMenu += 1;
    const keyboardTokens = (action: GameAction) => overrides[action] ?? KEYBOARD_BINDINGS[action];
    const anyOf = (set: ReadonlySet<string>, tokens: readonly string[]) => tokens.some((token) => set.has(token));
    return {
      isHeld: (action) => anyOf(this.keyHeld, keyboardTokens(action)) || anyOf(this.padHeld, GAMEPAD_BINDINGS[action]),
      justPressed: (action) => anyOf(entry.pressed, keyboardTokens(action)) || anyOf(entry.pressed, GAMEPAD_BINDINGS[action]),
      keyJustPressed: (key) => entry.pressed.has(key),
      moveX: () => {
        const left = anyOf(this.keyHeld, keyboardTokens('left')) || this.padHeld.has('pad:left');
        const right = anyOf(this.keyHeld, keyboardTokens('right')) || this.padHeld.has('pad:right');
        return (left === right ? 0 : left ? -1 : 1) as -1 | 0 | 1;
      },
      consume: () => entry.pressed.clear(),
      dispose: () => {
        this.channels.delete(entry);
        if (options.blockContextMenu) this.blockContextMenu -= 1;
        release();
      }
    };
  }

  /** Riceve ogni pressione (`down: true`, senza auto-repeat) e rilascio di un token, una volta per azione a cui corrisponde. */
  subscribe(listener: PressListener): () => void {
    const release = this.retain();
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
      release();
    };
  }

  /** Come `subscribe`, ma una volta per TOKEN (non per azione): per chi traduce il token a modo suo (QTE, cannone). */
  subscribeTokens(listener: (token: string, down: boolean) => void): () => void {
    const release = this.retain();
    this.tokenListeners.add(listener);
    return () => {
      this.tokenListeners.delete(listener);
      release();
    };
  }

  /** Dispositivo e famiglia correnti (per le icone): lo stesso oggetto finché non cambia, come vuole `useSyncExternalStore`. */
  getDeviceState = (): InputDeviceState => this.snapshot;

  subscribeDevice = (listener: () => void): (() => void) => {
    const release = this.retain();
    this.deviceListeners.add(listener);
    return () => {
      this.deviceListeners.delete(listener);
      release();
    };
  };

  /** Fa vibrare i controller collegati (Chrome/Edge; altrove non fa nulla, senza errori). */
  rumble(durationMs: number, strong: number, weak: number): void {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;
    for (const pad of navigator.getGamepads()) {
      const actuator = (pad as (Gamepad & { vibrationActuator?: { playEffect?: (type: string, params: object) => Promise<unknown> } }) | null)?.vibrationActuator;
      try {
        void actuator?.playEffect?.('dual-rumble', { startDelay: 0, duration: durationMs, strongMagnitude: strong, weakMagnitude: weak })?.catch?.(() => undefined);
      } catch {
        // un pad che non sa vibrare non è un errore
      }
    }
  }

  // ---------- Interno ----------

  private setDevice(device: InputDevice, family: PadFamily = this.snapshot.family): void {
    if (this.snapshot.device === device && this.snapshot.family === family) return;
    this.snapshot = { device, family };
    this.deviceListeners.forEach((listener) => listener());
  }

  private press(token: string): void {
    for (const channel of this.channels) channel.pressed.add(token);
    this.tokenListeners.forEach((listener) => listener(token, true));
    for (const action of actionsForToken(token)) this.listeners.forEach((listener) => listener(action, true, token));
  }

  private release(token: string): void {
    this.tokenListeners.forEach((listener) => listener(token, false));
    for (const action of actionsForToken(token)) this.listeners.forEach((listener) => listener(action, false, token));
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const token = event.key.toLowerCase();
    this.keyHeld.add(token);
    if (event.repeat) return;
    this.setDevice('keyboard');
    this.press(token);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const token = event.key.toLowerCase();
    if (this.keyHeld.delete(token)) this.release(token);
  };

  private readonly onMouseDown = (event: MouseEvent): void => {
    const token = event.button === 2 ? 'mouse2' : 'mouse0';
    this.keyHeld.add(token);
    this.setDevice('keyboard');
    this.press(token);
  };

  private readonly onMouseUp = (event: MouseEvent): void => {
    const token = event.button === 2 ? 'mouse2' : 'mouse0';
    if (this.keyHeld.delete(token)) this.release(token);
  };

  /** Il click destro è la parata: niente menu del browser (solo mentre un canale lo chiede). */
  private readonly onContextMenu = (event: MouseEvent): void => {
    if (this.blockContextMenu > 0) event.preventDefault();
  };

  private readonly releaseAll = (): void => {
    for (const token of [...this.keyHeld]) {
      this.keyHeld.delete(token);
      this.release(token);
    }
  };

  private readonly onVisibility = (): void => {
    if (document.hidden) this.releaseAll();
  };

  private readonly poll = (): void => {
    this.raf = requestAnimationFrame(this.poll);
    if (typeof navigator.getGamepads !== 'function') return;
    const pads = Array.from(navigator.getGamepads()).filter((pad): pad is Gamepad => !!pad && pad.connected !== false);
    const next = readPadsTokens(pads as unknown as PadSnapshot[], this.padHeld);
    if (pads.length > 0) {
      const family = padFamily(pads[0].id);
      if (pads[0].mapping !== 'standard' && !this.warnedNonStandard) {
        this.warnedNonStandard = true;
        console.warn('[input] controller con mappatura non standard: funzionano solo i bottoni principali e lo stick.');
      }
      if (family !== this.snapshot.family) this.setDevice(this.snapshot.device, family);
    }
    for (const token of next) {
      if (this.padHeld.has(token)) continue;
      this.setDevice('gamepad', pads[0] ? padFamily(pads[0].id) : this.snapshot.family);
      this.press(token);
    }
    const released = [...this.padHeld].filter((token) => !next.has(token));
    this.padHeld = next;
    released.forEach((token) => this.release(token));
  };
}

export const inputManager = new InputManager();
