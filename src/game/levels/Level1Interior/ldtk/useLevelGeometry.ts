import { useMemo } from 'react';
import { useLdtkProject, getLdtkLevel } from './loadLdtkProject';
import { parseLevelGeometry, type LevelGeometry } from './parseLevelGeometry';

/**
 * Fetch (Suspense, cache per URL) + parse di un singolo Level LDtk, in un
 * solo hook: chi ha bisogno SOLO della geometria da disegnare (
 * `InteriorLevelGeometry`) e chi ha bisogno anche di spawn/porte/celle
 * calpestabili per il gameplay (`SceneManager2DIso`) chiamano entrambi
 * questo hook invece di passarsi i dati con un callback — `useLdtkProject`
 * è già cache-keyed per URL (nessun secondo fetch di rete), e `parseLevelGeometry`
 * è una funzione pura ed economica: calcolarla due volte costa meno che
 * inseguire un dato che arriva un frame dopo (bug reale trovato scrivendo
 * `SceneManager2DIso`: uno spawn letto da un callback via `useEffect`
 * arrivava troppo tardi per il primo `position` di `PlayerIso`, che lo legge
 * solo al mount).
 */
export function useLevelGeometry(levelIdentifier: string): LevelGeometry {
  const project = useLdtkProject();
  const level = getLdtkLevel(project, levelIdentifier);
  return useMemo(() => parseLevelGeometry(level), [level]);
}
