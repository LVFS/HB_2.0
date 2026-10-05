import { useArenaStore } from '@/store/arenaStore';

/**
 * Messaggio grande al centro dell'arena (titolo + riga di aiuto) che sparisce
 * da solo dopo qualche secondo. Un solo timer per volta: un messaggio nuovo
 * prende il posto del precedente. Non è React: il boss lo tiene in un ref e lo
 * passa ai moduli che ne hanno bisogno (`BossContext`).
 */
export interface BossMessenger {
  /** Mostra un messaggio per `seconds` secondi (default 2.4). */
  flash: (message: string, hint: string | null, seconds?: number) => void;
  /** Annulla il timer in corso (il messaggio resta finché qualcuno non lo toglie). */
  cancel: () => void;
}

export function createBossMessenger(): BossMessenger & { dispose: () => void } {
  let timer: number | undefined;
  const cancel = () => window.clearTimeout(timer);
  return {
    flash: (message, hint, seconds = 2.4) => {
      useArenaStore.getState().set({ message, hint });
      window.clearTimeout(timer);
      timer = window.setTimeout(() => useArenaStore.getState().set({ message: null, hint: null }), seconds * 1000);
    },
    cancel,
    dispose: cancel
  };
}
