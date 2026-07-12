import type { GameModule, GameOpts, GameHandle } from '../../engine/types';
import { createLoop } from '../../engine/loop';
import { createInput } from '../../engine/input';
import { createSim, stepSim, WORLD } from './sim';

const PALETTE = {
  bg: '#05050f',
  ship: '#00ffcc',
  bullet: '#ffffff',
  rockL: '#7060ff',
  rockM: '#c060ff',
  rockS: '#ff60aa',
  thrust: '#ff8800',
} as const;

const ROCK_VERTS = {
  L: 10,
  M: 8,
  S: 6,
} as const;

function buildPoly(sides: number, radius: number, jitter: (i: number) => number): Array<[number, number]> {
  return Array.from({ length: sides }, (_, i) => {
    const a = (i / sides) * Math.PI * 2;
    const r = radius * jitter(i);
    return [Math.cos(a) * r, Math.sin(a) * r] as [number, number];
  });
}

// stable rock shapes keyed by id
const rockShapes = new Map<number, Array<[number, number]>>();

function getRockShape(id: number, size: 'L' | 'M' | 'S', rng: () => number): Array<[number, number]> {
  if (!rockShapes.has(id)) {
    const radii = { L: 42, M: 24, S: 12 } as const;
    const sides = ROCK_VERTS[size];
    const shape = buildPoly(sides, radii[size], () => 0.7 + rng() * 0.6);
    rockShapes.set(id, shape);
  }
  return rockShapes.get(id)!;
}

function drawPoly(ctx: CanvasRenderingContext2D, verts: Array<[number, number]>, x: number, y: number, angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  const first = verts[0];
  if (!first) { ctx.restore(); return; }
  ctx.moveTo(first[0], first[1]);
  for (let i = 1; i < verts.length; i++) {
    const v = verts[i];
    if (v) ctx.lineTo(v[0], v[1]);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

const SHIP_VERTS: Array<[number, number]> = [
  [14, 0],
  [-10, 8],
  [-6, 0],
  [-10, -8],
];

const slug = 'vector-duel';

export default {
  slug,
  init(canvas: HTMLCanvasElement, opts: GameOpts): GameHandle {
    rockShapes.clear();

    // HiDPI canvas
    const cssW = canvas.clientWidth || 800;
    const cssH = Math.round(cssW * WORLD.H / WORLD.W);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.height = cssH + 'px';

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr * cssW / WORLD.W, dpr * cssH / WORLD.H);

    const input = createInput(window);
    let rngSeed = Date.now();
    const seqRng = (() => {
      let s = rngSeed;
      return () => {
        s |= 0; s = s + 0x6D2B79F5 | 0;
        let t = Math.imul(s ^ s >>> 15, 1 | s);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    })();

    let state = createSim(seqRng);
    let lastScore = -1;
    let gameOverFired = false;

    const loop = createLoop({
      step() {
        const inp = {
          left: input.isDown('ArrowLeft') || input.isDown('KeyA'),
          right: input.isDown('ArrowRight') || input.isDown('KeyD'),
          thrust: input.isDown('ArrowUp') || input.isDown('KeyW'),
          fire: input.isDown('Space'),
        };
        state = stepSim(state, inp, 1 / 60, seqRng);

        if (state.score !== lastScore) {
          lastScore = state.score;
          opts.onScore(state.score);
        }

        if (state.status === 'gameover' && !gameOverFired) {
          gameOverFired = true;
          opts.onGameOver(state.score);
        }
      },
      render() {
        ctx.fillStyle = PALETTE.bg;
        ctx.fillRect(0, 0, WORLD.W, WORLD.H);

        ctx.lineWidth = 1.5;

        // rocks
        for (const rock of state.rocks) {
          const color = rock.size === 'L' ? PALETTE.rockL : rock.size === 'M' ? PALETTE.rockM : PALETTE.rockS;
          ctx.strokeStyle = color;
          const shape = getRockShape(rock.id, rock.size, seqRng);
          drawPoly(ctx, shape, rock.pos.x, rock.pos.y, rock.angle);
        }

        // bullets
        ctx.strokeStyle = PALETTE.bullet;
        ctx.lineWidth = 2;
        for (const b of state.bullets) {
          ctx.beginPath();
          ctx.arc(b.pos.x, b.pos.y, 2.5, 0, Math.PI * 2);
          ctx.stroke();
        }

        // ship
        if (state.status === 'playing') {
          const inp = {
            left: input.isDown('ArrowLeft') || input.isDown('KeyA'),
            right: input.isDown('ArrowRight') || input.isDown('KeyD'),
            thrust: input.isDown('ArrowUp') || input.isDown('KeyW'),
            fire: input.isDown('Space'),
          };
          ctx.strokeStyle = PALETTE.ship;
          ctx.lineWidth = 1.8;
          drawPoly(ctx, SHIP_VERTS, state.ship.pos.x, state.ship.pos.y, state.ship.angle);

          // thrust flame
          if (inp.thrust) {
            ctx.strokeStyle = PALETTE.thrust;
            ctx.lineWidth = 1.5;
            ctx.save();
            ctx.translate(state.ship.pos.x, state.ship.pos.y);
            ctx.rotate(state.ship.angle);
            ctx.beginPath();
            ctx.moveTo(-6, -4);
            ctx.lineTo(-12 - seqRng() * 6, 0);
            ctx.lineTo(-6, 4);
            ctx.stroke();
            ctx.restore();
          }
        }
      },
    });

    loop.start();

    let destroyed = false;
    return {
      destroy() {
        if (destroyed) return;
        destroyed = true;
        loop.stop();
        input.destroy();
      },
    };
  },
} satisfies GameModule;
