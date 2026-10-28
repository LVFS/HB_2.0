import {
  TUNNEL_LANE_START,
  TUNNEL_LANE_HIT_TOLERANCE,
  TUNNEL_LANE_SCALE,
  TUNNEL_LANE_Z,
  TUNNEL_LANES
} from './tunnelConfig';
import type { TunnelWorld } from './tunnelState';

/**
 * Le tre vie del tunnel (FASE 10, tappa 2): D scivola su tre ringhiere a profondità diverse e le
 * cambia con W/S. Ogni minaccia, oggetto e proiettile sta in UNA via; la via di D è continua
 * (`world.lane.pos`) e durante il cambio D sta "fra due vie". Funzioni pure (niente React/Three).
 */

/** Tiene un indice di via dentro 0..`TUNNEL_LANES - 1`. */
export function clampLane(lane: number): number {
  return Math.min(TUNNEL_LANES - 1, Math.max(0, Math.round(lane)));
}

/** Interpola una tabella per via (profondità, scala…) alla posizione continua `pos`. */
function lerpLane(table: readonly number[], pos: number): number {
  const clamped = Math.min(table.length - 1, Math.max(0, pos));
  const low = Math.floor(clamped);
  const high = Math.min(table.length - 1, low + 1);
  return table[low] + (table[high] - table[low]) * (clamped - low);
}

/** Profondità (z) di una via, anche non intera. */
export function laneZ(pos: number): number {
  return lerpLane(TUNNEL_LANE_Z, pos);
}

/** Ingrandimento visivo di una via (la lontana è più piccola). */
export function laneScale(pos: number): number {
  return lerpLane(TUNNEL_LANE_SCALE, pos);
}

/** D torna sulla via di partenza (ripartenze, raffica a doppia spada). */
export function resetLane(world: TunnelWorld): void {
  world.lane.pos = TUNNEL_LANE_START;
  world.lane.target = TUNNEL_LANE_START;
}

/** `lane` è la via di D (o abbastanza vicina da contare)? Decide chi colpisce, chi si para e cosa si raccoglie. */
export function inPlayerLane(world: TunnelWorld, lane: number, tolerance = TUNNEL_LANE_HIT_TOLERANCE): boolean {
  return Math.abs(world.lane.pos - lane) < tolerance;
}
