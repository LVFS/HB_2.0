import { IMPULSE } from '../wallConfig';
import type { BreakPattern } from './types';

/**
 * Esplosione radiale: i blocchi vengono spinti via dal punto d'impatto, con
 * forza che cala con la distanza. Nessun ritardo tra centro e bordi: con
 * `AFFECT_RADIUS` ampliato a tutta una sezione di muro, un'onda d'urto che si
 * propaga visibilmente (fino a ~1s tra il centro e il bordo) leggeva come un
 * lag piuttosto che un effetto — l'esplosione deve sembrare istantanea.
 */
export const radialBreak: BreakPattern = ({ chunks, origin }) =>
  chunks.map((chunk) => {
    const dx = chunk.position[0] - origin[0];
    const dy = chunk.position[1] - origin[1];
    const dz = chunk.position[2] - origin[2];

    // +0.001 evita la divisione per zero sul blocco esattamente al centro.
    const distance = Math.hypot(dx, dy, dz) + 0.001;

    // Caduta quadratica dolce: al centro 1, ai bordi del muro ~0.4.
    const falloff = 1 / (1 + (distance / 18) ** 2);
    const strength = IMPULSE.base * falloff;

    return {
      index: chunk.index,
      impulse: [
        (dx / distance) * strength * 0.8,
        // Componente verticale extra: senza, i detriti scivolano via piatti
        // e l'esplosione sembra spenta.
        (dy / distance) * strength * 0.8 + strength * 0.35,
        // Spinta VERSO la camera, non lontano da lei: è la differenza tra
        // un'esplosione che ti arriva addosso e un muro che si sbriciola di
        // là, dove non si vede niente.
        strength * 1.15
      ],
      torque: [
        (chunk.shade - 0.5) * IMPULSE.torque,
        (chunk.shade * 7.3 - 3.65) * IMPULSE.torque * 0.4,
        (0.5 - chunk.shade) * IMPULSE.torque
      ],
      delay: 0
    };
  });
