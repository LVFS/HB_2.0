// Dati statici dei frammenti raccoglibili.
// Vivono qui (e non dentro un componente) perché servono sia alla scena 3D
// sia all'overlay della UI: nessuno dei due deve dipendere dall'altro.

export interface FragmentInfo {
  id: string;
  label: string;
  color: string;
  position: [number, number, number];
}

export const fragments: FragmentInfo[] = [
  { id: 'forest-crystal', label: 'Cristallo del bosco', color: '#86efac', position: [-5, 0.6, -2] },
  { id: 'water-core', label: 'Nucleo d’acqua', color: '#7dd3fc', position: [4, 0.6, -4] },
  { id: 'ice-blade', label: 'Lama di ghiaccio', color: '#c7d2fe', position: [-2, 0.6, 5] },
  { id: 'aurora-flame', label: 'Fiamma aurora', color: '#fb7185', position: [3, 0.6, 3] },
  { id: 'memory-seed', label: 'Seme di memoria', color: '#fcd34d', position: [0, 0.6, -8] }
];

export const totalFragments = fragments.length;
