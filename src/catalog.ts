import type { GameModule } from './engine/types';

export interface GameEntry {
  slug: string;
  title: string;
  tagline: string;
  year: string;
  accent: string;
  load: () => Promise<GameModule>;
}

export const CATALOG: GameEntry[] = [
  {
    slug: 'vector-duel',
    title: 'VECTOR DUEL',
    tagline: 'Naviga il vuoto. Distruggi le rocce. Sopravvivi.',
    year: '2025',
    accent: '#00ffcc',
    load: () => import('./games/vector-duel/index').then((m) => m.default),
  },
  {
    slug: 'nova-shield',
    title: 'NOVA SHIELD',
    tagline: 'Ruota. Defletti. Sopravvivi.',
    year: '2025',
    accent: '#ff6600',
    load: () => import('./games/nova-shield/index').then((m) => m.default),
  },
];
