/**
 * Fisica di salto 2D a mano (niente Rapier): salto singolo, doppio salto e
 * spinta verso l'alto, con gravità e terreno. Funzione pura sullo stato di
 * salto, senza dipendenze da React/Three: la usano l'arena del boss e, domani,
 * il tunnel. Convenzione: Y = quota dei piedi, 0 (o `groundY`) = a terra.
 */

export interface JumpState {
  /** Velocità verticale (unità al secondo, positiva verso l'alto). */
  vy: number;
  onGround: boolean;
  /** Salti già fatti dall'ultimo atterraggio. */
  jumpsUsed: number;
}

export interface JumpConfig {
  /** Gravità (negativa, unità/s²). */
  gravity: number;
  groundY: number;
  jumpSpeed: number;
  doubleJumpSpeed: number;
  maxJumps: number;
}

export interface JumpInput {
  /** Il salto è richiesto E consentito (chi chiama controlla azione in corso, stordimento, dash). */
  wantsJump: boolean;
  /** Moltiplicatore della velocità di salto (es. berserk). Default 1. */
  jumpMultiplier?: number;
  /** Spinta verso l'alto in attesa (es. dopo la parata in aria di un fulmine): conta come il
   *  primo salto, il doppio resta disponibile. 0 = nessuna. */
  airBoost?: number;
}

export function createJumpState(): JumpState {
  return { vy: 0, onGround: true, jumpsUsed: 0 };
}

/** Azzera la fisica verticale (quando una sequenza scriptata comanda la posizione). */
export function resetJump(state: JumpState, onGround: boolean): void {
  state.vy = 0;
  state.onGround = onGround;
  state.jumpsUsed = 0;
}

/**
 * Un passo di fisica verticale: applica salto/doppio salto/spinta, la gravità,
 * l'atterraggio. Muta `state` e restituisce la nuova quota dei piedi `y`.
 */
export function stepJump(state: JumpState, config: JumpConfig, input: JumpInput, y: number, dt: number): number {
  const multiplier = input.jumpMultiplier ?? 1;
  if (input.wantsJump) {
    if (state.onGround) {
      state.vy = config.jumpSpeed * multiplier;
      state.onGround = false;
      state.jumpsUsed = 1;
    } else if (state.jumpsUsed < config.maxJumps) {
      // Doppio salto: un secondo impulso in aria.
      state.vy = config.doubleJumpSpeed * multiplier;
      state.jumpsUsed += 1;
    }
  }
  if (input.airBoost && input.airBoost > 0) {
    state.vy = input.airBoost;
    state.onGround = false;
    state.jumpsUsed = Math.min(state.jumpsUsed, 1);
  }
  state.vy += config.gravity * dt;
  let nextY = y + state.vy * dt;
  if (nextY <= config.groundY) {
    nextY = config.groundY;
    state.vy = 0;
    state.onGround = true;
    state.jumpsUsed = 0;
  }
  return nextY;
}
