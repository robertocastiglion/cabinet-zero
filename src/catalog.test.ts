import { describe, it, expect } from 'vitest';
import { CATALOG } from './catalog';

const BLOCKLIST = [
  'pac-man', 'pacman', 'tetris', 'space invaders', 'asteroids',
  'donkey kong', 'galaga', 'frogger', 'mario', 'sonic',
  'arkanoid', 'breakout', 'centipede', 'defender', 'pong',
];

describe('catalog', () => {
  it('slugs are unique', () => {
    const slugs = CATALOG.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('every entry has all non-empty fields', () => {
    for (const entry of CATALOG) {
      expect(entry.slug.length).toBeGreaterThan(0);
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.tagline.length).toBeGreaterThan(0);
      expect(entry.year.length).toBeGreaterThan(0);
      expect(entry.accent.startsWith('#')).toBe(true);
      expect(typeof entry.load).toBe('function');
    }
  });

  it('no title contains a blocked term', () => {
    for (const entry of CATALOG) {
      const haystack = (entry.title + ' ' + entry.tagline).toLowerCase();
      for (const term of BLOCKLIST) {
        expect(haystack.includes(term), `"${entry.slug}" contains blocked term "${term}"`).toBe(false);
      }
    }
  });
});
