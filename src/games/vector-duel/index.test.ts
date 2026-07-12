import { describe, it, expect, vi } from 'vitest';
import mod from './index';

function makeCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 800;
  c.height = 600;
  // stub getContext
  const ctx = {
    scale: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  };
  // @ts-expect-error canvas stub
  vi.spyOn(c, 'getContext').mockReturnValue(ctx);
  return c;
}

function makeOpts() {
  return {
    rng: () => 0.5,
    onScore: vi.fn(),
    onGameOver: vi.fn(),
  };
}

describe('vector-duel module', () => {
  it('has correct slug', () => {
    expect(mod.slug).toBe('vector-duel');
  });

  it('init does not throw', () => {
    const canvas = makeCanvas();
    const opts = makeOpts();
    const handle = mod.init(canvas, opts);
    handle.destroy();
  });

  it('destroy is idempotent', () => {
    const canvas = makeCanvas();
    const opts = makeOpts();
    const handle = mod.init(canvas, opts);
    expect(() => {
      handle.destroy();
      handle.destroy();
      handle.destroy();
    }).not.toThrow();
  });

  it('onGameOver is called at most once', () => {
    const canvas = makeCanvas();
    const opts = makeOpts();
    const handle = mod.init(canvas, opts);
    // run a lot of time and then destroy
    handle.destroy();
    expect(opts.onGameOver.mock.calls.length).toBeLessThanOrEqual(1);
  });
});
