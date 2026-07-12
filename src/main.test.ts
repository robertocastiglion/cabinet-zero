import { describe, it, expect, vi, beforeEach } from 'vitest';

// minimal DOM stub for testing grid rendering
describe('main shell', () => {
  it('CATALOG has at least 1 entry', async () => {
    const { CATALOG } = await import('./catalog');
    expect(CATALOG.length).toBeGreaterThanOrEqual(1);
  });

  it('game entry load() returns a module with correct slug', async () => {
    const { CATALOG } = await import('./catalog');
    const entry = CATALOG[0]!;
    const mod = await entry.load();
    expect(mod.slug).toBe(entry.slug);
    expect(typeof mod.init).toBe('function');
  });
});
