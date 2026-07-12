import { describe, it, expect } from 'vitest';
import { CATALOG } from '../src/catalog';

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

describe('conformance: every game respects GameModule contract', () => {
  for (const entry of CATALOG) {
    it(`${entry.slug}`, async () => {
      const mod = await entry.load();
      expect(mod.slug).toBe(entry.slug);

      const canvas = document.createElement('canvas');
      canvas.width = 800; canvas.height = 600;

      // stub canvas context
      const ctx = {
        scale: () => undefined,
        fillRect: () => undefined,
        beginPath: () => undefined,
        arc: () => undefined,
        moveTo: () => undefined,
        lineTo: () => undefined,
        closePath: () => undefined,
        stroke: () => undefined,
        save: () => undefined,
        restore: () => undefined,
        translate: () => undefined,
        rotate: () => undefined,
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
      };
      // @ts-expect-error canvas stub
      canvas.getContext = () => ctx;

      const scores: number[] = [];
      let overCount = 0;
      const rng = mulberry32(42);

      const handle = mod.init(canvas, {
        rng,
        onScore: (s) => scores.push(s),
        onGameOver: () => overCount++,
      });

      expect(typeof handle.destroy).toBe('function');
      handle.destroy();
      handle.destroy(); // idempotent
      expect(overCount).toBeLessThanOrEqual(1);
    });
  }
});
