import { describe, it, expect, vi } from 'vitest';
import mod from './index';

function makeCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 800;
  c.height = 600;
  const ctx = {
    scale: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    setLineDash: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    shadowBlur: 0,
    shadowColor: '',
    globalAlpha: 1,
    lineCap: 'butt' as CanvasLineCap,
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

describe('nova-shield module', () => {
  it('has correct slug', () => {
    expect(mod.slug).toBe('nova-shield');
  });

  it('init does not throw', () => {
    const handle = mod.init(makeCanvas(), makeOpts());
    handle.destroy();
  });

  it('destroy is idempotent', () => {
    const handle = mod.init(makeCanvas(), makeOpts());
    expect(() => {
      handle.destroy();
      handle.destroy();
      handle.destroy();
    }).not.toThrow();
  });

  it('onGameOver is called at most once', () => {
    const opts = makeOpts();
    const handle = mod.init(makeCanvas(), opts);
    handle.destroy();
    expect(opts.onGameOver.mock.calls.length).toBeLessThanOrEqual(1);
  });
});
