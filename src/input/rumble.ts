import { useSettingsStore } from '@/store/settingsStore';
import { inputManager, type RumbleResult } from './inputManager';

/** Le vibrazioni del controller (opzionali): niente se l'impostazione `rumble` è spenta o se il browser non le supporta. */
export type RumbleKind = 'tick' | 'hit' | 'parry' | 'stagger' | 'slam';

const PRESETS: Record<RumbleKind, { ms: number; strong: number; weak: number }> = {
  tick: { ms: 70, strong: 0.2, weak: 0.55 },
  hit: { ms: 220, strong: 0.8, weak: 0.5 },
  parry: { ms: 110, strong: 0.35, weak: 1 },
  stagger: { ms: 350, strong: 0.9, weak: 0.6 },
  slam: { ms: 800, strong: 1, weak: 1 }
};

export function rumble(kind: RumbleKind): void {
  if (!useSettingsStore.getState().rumble) return;
  const preset = PRESETS[kind];
  void inputManager.rumble(preset.ms, preset.strong, preset.weak);
}

/** Prova della vibrazione (impostazioni): ignora l'interruttore e dice cosa ha risposto il browser. */
export function testRumble(): Promise<RumbleResult> {
  return inputManager.rumble(600, 1, 1);
}
