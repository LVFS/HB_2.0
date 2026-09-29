// URL/tipi delle sprite dei personaggi (Fase 3 del piano, vedi
// docs/PIANO_LIVELLO1_2D.md): pose intere ritagliate dalle turnaround sheet,
// non un rig a pezzi separati — vedi il piano sul perché. 12 file in
// `public/sprites/characters/{variant}/{variant}_{pose}.png`.

export type CharacterVariant = 'D0' | 'D1' | 'Eve';
export type CharacterPose = 'front' | 'back' | 'side' | 'action';

export function getCharacterSpriteUrl(variant: CharacterVariant, pose: CharacterPose): string {
  return `${import.meta.env.BASE_URL}sprites/characters/${variant}/${variant}_${pose}.png`;
}
