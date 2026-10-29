import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useSettingsStore, type GlyphSetting } from '@/store/settingsStore';
import type { GameAction, InputDevice, PadFamily } from './inputActions';
import { inputManager, type InputDeviceState, type PressListener } from './inputManager';

/** Dispositivo e famiglia dell'ULTIMO input usato (cambia da solo passando da tastiera a pad e viceversa). */
export function useInputDevice(): InputDeviceState {
  return useSyncExternalStore(inputManager.subscribeDevice, inputManager.getDeviceState, inputManager.getDeviceState);
}

/** Ciò che mostrano le icone: l'ultimo dispositivo usato, salvo che l'impostazione `glyphs` ne imponga uno. */
export function glyphDevice(actual: InputDeviceState, setting: GlyphSetting): { device: InputDevice; family: PadFamily } {
  if (setting === 'auto') return actual;
  if (setting === 'keyboard') return { device: 'keyboard', family: actual.family };
  return { device: 'gamepad', family: setting };
}

export function useGlyphDevice(): { device: InputDevice; family: PadFamily } {
  const actual = useInputDevice();
  const setting = useSettingsStore((state) => state.glyphs);
  return glyphDevice(actual, setting);
}

interface UseActionEventsOptions {
  /** Ascolta solo quando `true`. */
  enabled?: boolean;
  /** Solo i token del controller (per aggiungere il pad a un'interfaccia che gestisce già la tastiera per conto suo). */
  padOnly?: boolean;
  /** Riceve le pressioni anche durante la pausa del gioco (i menu). */
  always?: boolean;
}

/** Ogni pressione (`down: true`) e rilascio di un'azione, da qualunque dispositivo. `handler` può cambiare a ogni render. */
export function useActionEvents(handler: PressListener, { enabled = true, padOnly = false, always = false }: UseActionEventsOptions = {}): void {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    if (!enabled) return;
    return inputManager.subscribe(
      (action, down, token) => {
        if (padOnly && !token.startsWith('pad:')) return;
        latest.current(action, down, token);
      },
      { always }
    );
  }, [enabled, padOnly, always]);
}

/** Solo le PRESSIONI di un'azione. */
export function useActionPress(handler: (action: GameAction, token: string) => void, options: UseActionEventsOptions = {}): void {
  useActionEvents((action, down, token) => {
    if (down) handler(action, token);
  }, options);
}

/**
 * Un TOCCO breve (sotto maxMs) su un'azione: scatta al rilascio. Serve ai tasti che fanno due cose a seconda di quanto li tieni
 * (Options/Esc: un tocco apre le impostazioni o la pausa, tenuto salta la cutscene: vedi SkipCutscene).
 */
export function useTapAction(
  action: GameAction,
  onTap: () => void,
  { enabled = true, always = false, maxMs = 350 }: { enabled?: boolean; always?: boolean; maxMs?: number } = {}
): void {
  const tap = useRef(onTap);
  tap.current = onTap;
  const downAt = useRef<number | null>(null);
  useActionEvents(
    (candidate, down) => {
      if (candidate !== action) return;
      if (down) {
        downAt.current = performance.now();
      } else if (downAt.current !== null) {
        const held = performance.now() - downAt.current;
        downAt.current = null;
        if (held <= maxMs) tap.current();
      }
    },
    { enabled, always }
  );
}
