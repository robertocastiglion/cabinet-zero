import { describe, it, expect } from 'vitest';
import { createInput } from './input';

function makeKeyEvent(type: string, code: string) {
  return new KeyboardEvent(type, { code, bubbles: true });
}

describe('createInput', () => {
  it('reports key as down after keydown', () => {
    const target = new EventTarget();
    const input = createInput(target);

    target.dispatchEvent(makeKeyEvent('keydown', 'ArrowLeft'));
    expect(input.isDown('ArrowLeft')).toBe(true);
    input.destroy();
  });

  it('reports key as up after keyup', () => {
    const target = new EventTarget();
    const input = createInput(target);

    target.dispatchEvent(makeKeyEvent('keydown', 'ArrowLeft'));
    target.dispatchEvent(makeKeyEvent('keyup', 'ArrowLeft'));
    expect(input.isDown('ArrowLeft')).toBe(false);
    input.destroy();
  });

  it('after destroy, new events do not change state', () => {
    const target = new EventTarget();
    const input = createInput(target);

    input.destroy();
    target.dispatchEvent(makeKeyEvent('keydown', 'Space'));
    expect(input.isDown('Space')).toBe(false);
  });
});
