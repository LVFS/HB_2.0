import { useSettingsStore } from '@/store/settingsStore';
import { inputManager } from './inputManager';

/** Le vibrazioni del controller (FASE 14, opzionali): niente se l'impostazione `rumble` è spenta o se il browser non le supporta. */
export type RumbleKind = 'hit' | 'parry' | 'stagger' | 'slam';

const PRESETS: Record<RumbleKind, { ms: number; strong: number; weak: number }> = {
  hit: { ms: 140, strong: 0.55, weak: 0.3 },
  parry: { ms: 80, strong: 0.15, weak: 0.9 },
  stagger: { ms: 260, strong: 0.7, weak: 0.4 },
  slam: { ms: 650, strong: 1, weak: 0.8 }
};

export function rumble(kind: RumbleKind): void {
  if (!useSettingsStore.getState().rumble) return;
  const preset = PRESETS[kind];
  inputManager.rumble(preset.ms, preset.strong, preset.weak);
}
