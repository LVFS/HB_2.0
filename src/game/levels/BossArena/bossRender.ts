import { Color } from 'three';
import type { Group, Mesh, MeshBasicMaterial } from 'three';
import type { RefObject } from 'react';
import type { ArenaBossState, ArenaFinale } from './arenaState';
import type { BossContext } from './bossRuntime';
import { unparryableUntil, WARNING_MAX_Y, type WarningTextures } from './bossWarnings';
import { BOSS_HEIGHT } from './arenaConfig';

/**
 * Resa del boss (segnaposto a tinte unite: il colore comunica lo stato —
 * rosso = sta caricando, bianco = colpo attivo, azzurro = barcolla, oro
 * lampeggiante = evento speciale). Funzioni che aggiornano le mesh dalle `refs`
 * ogni frame, senza stato React; i componenti che le disegnano stanno in
 * `BossVisuals.tsx`.
 */

export interface BossVisualRefs {
  group: RefObject<Group>;
  bodyMat: RefObject<MeshBasicMaterial>;
  slash: RefObject<Mesh>;
  slashDebug: RefObject<Mesh>;
  shieldMesh: RefObject<Mesh>;
  shieldMat: RefObject<MeshBasicMaterial>;
  marionetteGroup: RefObject<Group>;
  warningMesh: RefObject<Mesh>;
  warningMat: RefObject<MeshBasicMaterial>;
  teleportMarker: RefObject<Mesh>;
  zoneMesh: RefObject<Mesh>;
  zoneColumn: RefObject<Mesh>;
}

const COLOR_BASE = new Color('#7a4b2a');
const COLOR_WINDUP = new Color('#e0393a');
const COLOR_ACTIVE = new Color('#f5f5f5');
const COLOR_STAGGER = new Color('#7aa7ff');
const COLOR_SPECIAL_A = new Color('#c9a227');
const COLOR_SPECIAL_B = new Color('#fff2a0');
const COLOR_FLASH = new Color('#ffffff');
const COLOR_MARIONETTE = new Color('#cdb892');

/** Spegne l'avviso (usato dal braccio di ferro, dove il blocco di resa non gira). */
export function hideWarning(refs: BossVisualRefs): void {
  if (refs.warningMesh.current) refs.warningMesh.current.visible = false;
}

/**
 * Spegne ciò che il boss lasciava acceso quando una sequenza prende il
 * controllo e il blocco di resa non gira più: avviso, scia e hitbox del colpo,
 * zona elettrica; con `all` anche scudo e marcatore del teletrasporto.
 */
export function hideBossEffects(refs: BossVisualRefs, all = false): void {
  const meshes = [refs.warningMesh, refs.slash, refs.slashDebug, refs.zoneMesh, refs.zoneColumn];
  if (all) meshes.push(refs.shieldMesh, refs.teleportMarker);
  for (const ref of meshes) {
    if (ref.current) ref.current.visible = false;
  }
}

/** Durante la carica con falce il boss è comandato da fuori: solo la posizione. */
export function placeBoss(refs: BossVisualRefs, boss: ArenaBossState): void {
  refs.group.current?.position.set(boss.x, boss.y, 0);
}

/** Durante il finale: posizione, rotazione "tirato dai fili", marionetta e colore. */
export function updateFinaleVisuals(refs: BossVisualRefs, boss: ArenaBossState, finale: ArenaFinale): void {
  const g = refs.group.current;
  if (!g) return;
  g.position.set(boss.x, boss.y, 0);
  g.scale.x = boss.facing;
  // Tirato dai fili: scatta per un istante quando si trasforma.
  g.rotation.z =
    finale.phase === 'transform' && finale.marionette ? Math.sin(finale.t * 45) * 0.1 * Math.max(0, 1 - finale.t) : 0;
  if (refs.marionetteGroup.current) refs.marionetteGroup.current.visible = finale.marionette;
  if (refs.bodyMat.current) refs.bodyMat.current.color.copy(finale.marionette ? COLOR_MARIONETTE : COLOR_STAGGER);
}

/** Resa del frame normale: posizione, zona elettrica, scudo, avvisi, colore e hitbox del colpo. */
export function updateBossVisuals(
  { world, rt }: BossContext,
  refs: BossVisualRefs,
  warningTextures: WarningTextures,
  delta: number
): void {
  const { boss } = world;
  const g = refs.group.current;
  if (!g) return;
  g.position.x = boss.x;
  g.position.y = boss.y;
  g.visible = !boss.vanished;

  // Zona elettrica della tempesta: una colonna e una fascia a terra che
  // sfarfallano, larghe quanto il raggio di danno.
  const zoneMesh = refs.zoneMesh.current;
  const zoneColumn = refs.zoneColumn.current;
  if (zoneMesh && zoneColumn) {
    const radius = boss.zoneRadius;
    zoneMesh.visible = zoneColumn.visible = radius !== null;
    if (radius !== null) {
      const flicker = 0.55 + 0.35 * Math.sin(rt.time * 40);
      zoneMesh.position.set(boss.x, 0.14, 0.1);
      zoneMesh.scale.set(radius * 2, 1, 1);
      zoneColumn.position.set(boss.x, 3, -0.05);
      zoneColumn.scale.set(radius * 2, 1, 1);
      (zoneMesh.material as MeshBasicMaterial).opacity = flicker;
      (zoneColumn.material as MeshBasicMaterial).opacity = 0.1 + 0.1 * flicker;
    }
  }

  // Scudo azzurro attorno a Checco finché esistono oggetti del Buen Camino:
  // i colpi vengono bloccati (si accende di più quando ne riceve uno).
  boss.shieldHit = Math.max(0, boss.shieldHit - delta);
  const shieldMesh = refs.shieldMesh.current;
  const shieldMat = refs.shieldMat.current;
  if (shieldMesh && shieldMat) {
    const shielded = world.totems.length > 0 && !boss.vanished;
    shieldMesh.visible = shielded;
    if (shielded) {
      shieldMesh.position.set(boss.x, boss.y + BOSS_HEIGHT / 2, 0.15);
      shieldMat.opacity = boss.shieldHit > 0 ? 0.65 : 0.22 + 0.08 * Math.sin(rt.time * 7);
    }
  }

  // Avviso giallo sopra il boss finché sta caricando un colpo NON parabile
  // (dal via della mossa fino alla fine della finestra non parabile).
  const warnMove = rt.action?.move;
  const warnVisible =
    world.clash === null &&
    warnMove?.warning !== undefined &&
    rt.action !== null &&
    rt.action.t - warnMove.windup < (warnMove.warningUntil ?? unparryableUntil(warnMove));
  const warningMesh = refs.warningMesh.current;
  const warningMat = refs.warningMat.current;
  if (warningMesh && warningMat) {
    warningMesh.visible = warnVisible;
    if (warnVisible && warnMove?.warning) {
      const texture = warningTextures[warnMove.warning];
      if (warningMat.map !== texture) {
        warningMat.map = texture;
        warningMat.needsUpdate = true;
      }
      const pulse = 1 + 0.12 * Math.sin(rt.time * 18);
      // Sopra la testa, ma mai oltre il bordo alto dello schermo (in cima
      // allo schianto Checco esce dall'inquadratura).
      warningMesh.position.set(boss.x, Math.min(boss.y + BOSS_HEIGHT + 0.95, WARNING_MAX_Y), 0.4);
      warningMesh.scale.set(pulse, pulse, 1);
    }
  }
  // Marcatore a terra dove il boss ricomparirà (teletrasporto).
  const teleportMarker = refs.teleportMarker.current;
  if (teleportMarker) {
    teleportMarker.visible = boss.teleportDestX !== null;
    if (boss.teleportDestX !== null) {
      teleportMarker.position.set(boss.teleportDestX, 0.12, 0.25);
      teleportMarker.scale.x = 0.85 + 0.25 * Math.sin(rt.time * 22);
    }
  }
  g.scale.x = boss.facing;

  const mat = refs.bodyMat.current;
  if (mat) {
    if (boss.hitFlash > 0) mat.color.copy(COLOR_FLASH);
    else if (boss.staggerTimer > 0) mat.color.copy(COLOR_STAGGER);
    else if (rt.special || rt.summon) {
      mat.color.copy(COLOR_SPECIAL_A).lerp(COLOR_SPECIAL_B, 0.5 + 0.5 * Math.sin(rt.time * 12));
    } else if (rt.action && rt.action.t < rt.action.move.windup) {
      mat.color.copy(COLOR_BASE).lerp(COLOR_WINDUP, rt.action.t / rt.action.move.windup);
    } else if (boss.y > 0.05) {
      // In aria: resta rosso fino all'atterraggio, è il segnale da leggere.
      mat.color.copy(COLOR_WINDUP);
    } else if (boss.attackBox) mat.color.copy(COLOR_ACTIVE);
    else mat.color.copy(COLOR_BASE);
  }

  const box = boss.attackBox;
  for (const mesh of [refs.slash.current, refs.slashDebug.current]) {
    if (!mesh) continue;
    mesh.visible = box !== null && (mesh === refs.slash.current || import.meta.env.DEV);
    if (box) {
      mesh.position.set(box.x, box.y, 0.2);
      mesh.scale.set(box.halfWidth * 2, box.halfHeight * 2, 1);
    }
  }
}
