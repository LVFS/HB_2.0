import { LDTK_PROJECT_URL } from './ldtkConfig';
import type { LdtkLevel, LdtkProject } from './ldtkTypes';

type CacheEntry =
  | { status: 'pending'; promise: Promise<void> }
  | { status: 'resolved'; data: LdtkProject }
  | { status: 'rejected'; error: unknown };

const cache = new Map<string, CacheEntry>();

/**
 * Risorsa Suspense per il progetto LDtk: stesso pattern "render-as-you-fetch"
 * di `useGLTF`/`useTexture` di drei (throw della promise finché il fetch non
 * è completo, cache per URL) ma per un file che quelle utility non sanno
 * caricare — è JSON puro, non un formato 3D/texture. Va chiamato dentro un
 * componente avvolto da `<Suspense>`, come da convenzione del progetto.
 */
export function useLdtkProject(url: string = LDTK_PROJECT_URL): LdtkProject {
  let entry = cache.get(url);
  if (!entry) {
    const promise = fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`LDtk fetch fallita (${response.status}): ${url}`);
        }
        return response.json() as Promise<LdtkProject>;
      })
      .then((data) => {
        cache.set(url, { status: 'resolved', data });
      })
      .catch((error: unknown) => {
        cache.set(url, { status: 'rejected', error });
      });
    entry = { status: 'pending', promise };
    cache.set(url, entry);
  }
  if (entry.status === 'pending') {
    throw entry.promise;
  }
  if (entry.status === 'rejected') {
    throw entry.error;
  }
  return entry.data;
}

export function getLdtkLevel(project: LdtkProject, identifier: string): LdtkLevel {
  const level = project.levels.find((lvl) => lvl.identifier === identifier);
  if (!level) {
    throw new Error(`Level LDtk "${identifier}" non trovato in ${LDTK_PROJECT_URL}`);
  }
  return level;
}
