import type { ArenaBackdropId } from '@/store/arenaStore';

/**
 * Potenziamenti che si scelgono quando si interrompe l'evento "Avvia il film".
 * Ognuno è un cambio di location e di asset (sfondo, equipaggiamento, regole di
 * difesa/abilità del giocatore). Per aggiungerne uno: nuovo id in `PowerUpId`,
 * voce nel `Record` (il compilatore blocca se si dimentica), e la logica del suo
 * equipaggiamento in `PlayerArena`/`playerShots.ts` leggendo `world.powerUp`.
 */
export type PowerUpId = 'bloodborne';

export interface PowerUpDef {
  id: PowerUpId;
  label: string;
  /** Riga sotto il nome nella carta di scelta. */
  description: string;
  backdrop: ArenaBackdropId;
  intro: {
    title: string;
    subtitle: string;
    /** Quando ci sarà il video: percorso sotto `public/` (la scritta resta come ripiego). */
    videoSrc?: string;
  };
}

export const POWER_UPS: Record<PowerUpId, PowerUpDef> = {
  bloodborne: {
    id: 'bloodborne',
    label: 'Bloodborne',
    description: 'Spada e pistola: si para sparando. Abilità a distanza e carica con falce. Berserk.',
    backdrop: 'bloodborne',
    intro: { title: 'BLOODBORNE', subtitle: 'La caccia ha inizio' }
  }
};

export const POWER_UP_IDS = Object.keys(POWER_UPS) as PowerUpId[];
