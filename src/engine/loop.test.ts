import { describe, it, expect, vi } from 'vitest';
import { createLoop } from './loop';

function makeClockRaf() {
  let time = 0;
  const callbacks: Array<FrameRequestCallback> = [];
  let idSeq = 0;
  const pending = new Map<number, FrameRequestCallback>();

  function now() { return time; }

  function raf(cb: FrameRequestCallback) {
    const id = ++idSeq;
    pending.set(id, cb);
    return id;
  }

  const cancelRaf = vi.fn((id: number) => { pending.delete(id); });

  function tick(dtSeconds: number) {
    time += dtSeconds;
    const cbs = [...pending.values()];
    pending.clear();
    for (const cb of cbs) cb(time * 1000);
  }

  return { now, raf, cancelRaf, tick };
}

describe('createLoop', () => {
  it('calls step ~60 times for 60 frames of 16.7ms', () => {
    const step = vi.fn();
    const render = vi.fn();
    const clock = makeClockRaf();
    const loop = createLoop({ step, render, ...clock });

    loop.start();
    for (let i = 0; i < 60; i++) clock.tick(1 / 60);

    expect(step.mock.calls.length).toBeGreaterThanOrEqual(58);
    expect(step.mock.calls.length).toBeLessThanOrEqual(62);
  });

  it('clamps a 5000ms frame to at most 5 steps', () => {
    const step = vi.fn();
    const render = vi.fn();
    const clock = makeClockRaf();
    const loop = createLoop({ step, render, ...clock });

    loop.start();
    clock.tick(5); // 5 seconds in one frame

    expect(step.mock.calls.length).toBeLessThanOrEqual(5);
  });

  it('stops calling step after stop() and invokes cancelRaf', () => {
    const step = vi.fn();
    const render = vi.fn();
    const clock = makeClockRaf();
    const loop = createLoop({ step, render, ...clock });

    loop.start();
    clock.tick(1 / 60);
    loop.stop();
    const countAtStop = step.mock.calls.length;
    clock.tick(1 / 60);
    clock.tick(1 / 60);

    expect(step.mock.calls.length).toBe(countAtStop);
    expect(clock.cancelRaf).toHaveBeenCalled();
  });
});
