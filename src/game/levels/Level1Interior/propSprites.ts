// URL delle sprite e dei modelli 3D degli arredi (`Prop` in LDtk, vedi il
// piano di handoff dell'interno Ariston). Sprite: un file per `spriteId`,
// `public/sprites/props/{spriteId}.png`. Modelli: `spriteId` con prefisso
// `model:`, `public/models/props/{nome}.glb` (sorgenti in `assets/blender/`).

export const MODEL_SPRITE_PREFIX = 'model:';

export function getPropSpriteUrl(spriteId: string): string {
  return `${import.meta.env.BASE_URL}sprites/props/${spriteId}.png`;
}

export function getPropModelUrl(name: string): string {
  return `${import.meta.env.BASE_URL}models/props/${name}.glb`;
}
