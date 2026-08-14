import { IMPULSE } from '../wallConfig';
import type { BreakPattern } from './types';

/** Raggio (in unità) del foro netto aperto dal pugno. */
const HOLE_RADIUS = 6;
/** Oltre questa distanza il muro cede solo per contraccolpo. */
const CRACK_RADIUS = 16;

/**
 * Pugno direzionale: un cono di blocchi viene sfondato verso l'interno lungo
 * l'asse del colpo, mentre tutt'intorno il muro si crepa e cede in ritardo.
 *
 * La differenza rispetto a `radial` non è la forza ma la DIREZIONE: qui i
 * blocchi centrali vanno tutti dalla stessa parte (dietro), invece di
 * allontanarsi ognuno per conto proprio.
 */
export const punchBreak: BreakPattern = ({ chunks, origin }) =>
  chunks.map((chunk) => {
    const dx = chunk.position[0] - origin[0];
    const dy = chunk.position[1] - origin[1];

    // Distanza sul PIANO del muro: lo spessore non conta per decidere chi è
    // dentro al foro e chi no.
    const radial = Math.hypot(dx, dy) + 0.001;

    if (radial < HOLE_RADIUS) {
      // Dentro al foro: tutti spinti oltre il muro, con poca dispersione.
      const power = 1 - (radial / HOLE_RADIUS) * 0.45;
      return {
        index: chunk.index,
        impulse: [
          (dx / radial) * IMPULSE.base * 0.35 * power,
          (dy / radial) * IMPULSE.base * 0.35 * power + IMPULSE.base * 0.25,
          -IMPULSE.base * 1.5 * power
        ],
        torque: [
          (chunk.shade - 0.5) * IMPULSE.torque * 1.6,
          (0.5 - chunk.shade) * IMPULSE.torque,
          (chunk.shade - 0.5) * IMPULSE.torque
        ],
        delay: radial / 90
      };
    }

    // Fuori dal foro: la struttura perde appoggio e collassa, tanto più tardi
    // quanto più si è lontani dal punto d'impatto.
    const fade = Math.max(0, 1 - (radial - HOLE_RADIUS) / (CRACK_RADIUS - HOLE_RADIUS));
    return {
      index: chunk.index,
      impulse: [
        (dx / radial) * IMPULSE.base * 0.18 * fade,
        0,
        -IMPULSE.base * 0.3 * fade
      ],
      torque: [
        (chunk.shade - 0.5) * IMPULSE.torque * 0.5 * fade,
        0,
        (0.5 - chunk.shade) * IMPULSE.torque * 0.5 * fade
      ],
      delay: 0.12 + (radial - HOLE_RADIUS) * 0.035
    };
  });
