import { LDTK_FLOOR_VALUE, LDTK_GRID_SIZE, LDTK_WALL_VALUE } from './ldtkConfig';
import type { LdtkEntityInstance, LdtkLevel } from './ldtkTypes';

export interface GridCell {
  col: number;
  row: number;
}

/** Centro di un'entità, in CELLE (non necessariamente intero: un'entità più
 *  larga/alta di una cella, es. `Door_horizontal_4pz`, ha il centro a metà
 *  del suo ingombro, non nella cella del suo pivot). */
export interface CellCenter {
  col: number;
  row: number;
}

export interface LevelDoor extends CellCenter {
  widthCells: number;
  heightCells: number;
  targetLevel: string;
}

export interface LevelProp extends CellCenter {
  spriteId: string;
  /** Moltiplicatore sulla dimensione di default (1 se il campo LDtk è 0/assente). */
  scale: number;
  /** Alzata da terra, in unità di mondo (celle). */
  offsetY: number;
  /** Spostamento sul pavimento rispetto al centro della cella del marker,
   *  in unità di mondo (celle): serve per centrare un oggetto su un varco
   *  largo 2 celle, il cui centro cade sul bordo tra due celle. */
  offsetX: number;
  offsetZ: number;
  /** Rotazione attorno a Y in gradi, in aggiunta a quella verso la camera. */
  rotY: number;
}

export interface LevelGeometry {
  wallCells: GridCell[];
  floorCells: GridCell[];
  playerSpawn: CellCenter | null;
  doors: LevelDoor[];
  props: LevelProp[];
}

function getStringField(entity: LdtkEntityInstance, identifier: string): string | undefined {
  const field = entity.fieldInstances.find((f) => f.__identifier === identifier);
  return typeof field?.__value === 'string' ? field.__value : undefined;
}

function getNumberField(entity: LdtkEntityInstance, identifier: string): number {
  const field = entity.fieldInstances.find((f) => f.__identifier === identifier);
  return typeof field?.__value === 'number' ? field.__value : 0;
}

/**
 * Centro in celle di un'entità qualunque, a partire dal suo pivot (`__grid`,
 * in alto a sinistra per il pivot [0,0] usato in tutto questo progetto) e dal
 * suo ingombro in pixel (`width`/`height`) — non si può assumere "cella +
 * 0.5" come per muri/pavimento: un `Door_horizontal_4pz` è largo 4 celle, il
 * suo centro reale è 2 celle oltre il pivot, non mezza.
 */
function entityCenter(entity: LdtkEntityInstance): CellCenter & { widthCells: number; heightCells: number } {
  const [col, row] = entity.__grid;
  const widthCells = entity.width / LDTK_GRID_SIZE;
  const heightCells = entity.height / LDTK_GRID_SIZE;
  return { col: col + widthCells / 2, row: row + heightCells / 2, widthCells, heightCells };
}

/**
 * Estrae dati di gioco puri da un `Level` LDtk: nessuna dipendenza da React/
 * Three, stesso principio delle varianti di rottura del muro
 * (`breakPatterns/`) — solo lettura, la resa a schermo è compito di chi
 * chiama questa funzione.
 */
export function parseLevelGeometry(level: LdtkLevel): LevelGeometry {
  const wallCells: GridCell[] = [];
  const floorCells: GridCell[] = [];
  const doors: LevelDoor[] = [];
  const props: LevelProp[] = [];
  let playerSpawn: CellCenter | null = null;

  const wallsLayer = level.layerInstances.find((layer) => layer.__type === 'IntGrid');
  if (wallsLayer) {
    const width = wallsLayer.__cWid;
    wallsLayer.intGridCsv.forEach((value, index) => {
      const col = index % width;
      const row = Math.floor(index / width);
      if (value === LDTK_WALL_VALUE) {
        wallCells.push({ col, row });
      } else if (value === LDTK_FLOOR_VALUE) {
        floorCells.push({ col, row });
      }
    });
  }

  const entitiesLayer = level.layerInstances.find((layer) => layer.__type === 'Entities');
  if (entitiesLayer) {
    for (const entity of entitiesLayer.entityInstances) {
      if (entity.__identifier === 'PlayerSpawn') {
        const { col, row } = entityCenter(entity);
        playerSpawn = { col, row };
      } else if (entity.__identifier.startsWith('Door_')) {
        const targetLevel = getStringField(entity, 'targetLevel');
        if (targetLevel) {
          const { col, row, widthCells, heightCells } = entityCenter(entity);
          doors.push({ col, row, widthCells, heightCells, targetLevel });
        }
      } else if (entity.__identifier === 'Prop') {
        const spriteId = getStringField(entity, 'spriteId');
        if (spriteId) {
          const { col, row } = entityCenter(entity);
          const scale = getNumberField(entity, 'scale');
          props.push({
            col,
            row,
            spriteId,
            scale: scale > 0 ? scale : 1,
            offsetY: getNumberField(entity, 'offsetY'),
            offsetX: getNumberField(entity, 'offsetX'),
            offsetZ: getNumberField(entity, 'offsetZ'),
            rotY: getNumberField(entity, 'rotY')
          });
        }
      }
    }
  }

  return { wallCells, floorCells, playerSpawn, doors, props };
}
