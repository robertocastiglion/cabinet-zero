const STEP = 1 / 60;
const MAX_FRAME = 5 * STEP; // max 5 step per frame, anti spiral-of-death

interface LoopConfig {
  step: () => void;
  render: (alpha: number) => void;
  now?: () => number;
  raf?: (cb: FrameRequestCallback) => number;
  cancelRaf?: (id: number) => void;
}

interface LoopHandle {
  start(): void;
  stop(): void;
}

export function createLoop(cfg: LoopConfig): LoopHandle {
  const now = cfg.now ?? (() => performance.now() / 1000);
  const raf = cfg.raf ?? ((cb) => requestAnimationFrame(cb));
  const cancelRaf = cfg.cancelRaf ?? ((id) => cancelAnimationFrame(id));

  let rafId = 0;
  let running = false;
  let prevTime = 0;
  let accumulator = 0;

  function tick(ts: number) {
    if (!running) return;
    rafId = raf(tick);

    const currentTime = now();
    let dt = currentTime - prevTime;
    prevTime = currentTime;

    if (dt > MAX_FRAME) dt = MAX_FRAME;
    accumulator += dt;

    while (accumulator >= STEP) {
      cfg.step();
      accumulator -= STEP;
    }

    cfg.render(accumulator / STEP);
  }

  return {
    start() {
      if (running) return;
      running = true;
      prevTime = now();
      accumulator = 0;
      rafId = raf(tick);
    },
    stop() {
      running = false;
      cancelRaf(rafId);
    },
  };
}
