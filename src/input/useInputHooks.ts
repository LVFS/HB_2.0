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
}

/** Ogni pressione (`down: true`) e rilascio di un'azione, da qualunque dispositivo. `handler` può cambiare a ogni render. */
export function useActionEvents(handler: PressListener, { enabled = true, padOnly = false }: UseActionEventsOptions = {}): void {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    if (!enabled) return;
    return inputManager.subscribe((action, down, token) => {
      if (padOnly && !token.startsWith('pad:')) return;
      latest.current(action, down, token);
    });
  }, [enabled, padOnly]);
}

/** Solo le PRESSIONI di un'azione. */
export function useActionPress(handler: (action: GameAction, token: string) => void, options: UseActionEventsOptions = {}): void {
  useActionEvents((action, down, token) => {
    if (down) handler(action, token);
  }, options);
}
