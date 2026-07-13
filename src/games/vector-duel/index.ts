import type { GameModule, GameOpts, GameHandle } from '../../engine/types';
import { createLoop } from '../../engine/loop';
import { createInput } from '../../engine/input';
import { createSim, stepSim, WORLD } from './sim';
import type { Rock } from './sim';

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

const ROCK_COLOR: Record<'L' | 'M' | 'S', string> = {
  L: PALETTE.rockL,
  M: PALETTE.rockM,
  S: PALETTE.rockS,
};

const EXPLODE_COUNT: Record<'L' | 'M' | 'S', number> = { L: 13, M: 9, S: 6 };
const EXPLODE_SIZE: Record<'L' | 'M' | 'S', number> = { L: 10, M: 7, S: 4 };

interface ExplodeParticle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  col: string; size: number;
}

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

// Deterministic starfield via sin-hash (visual only, no injected RNG needed)
const stars = Array.from({ length: 60 }, (_, i) => {
  const h = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  const frac = h - Math.floor(h);
  const h2 = Math.sin(i * 269.5 + 183.3) * 43758.5453;
  const frac2 = h2 - Math.floor(h2);
  return { x: frac * WORLD.W, y: frac2 * WORLD.H, r: 0.8 + frac * 1.2, a: 0.15 + frac2 * 0.4 };
});

const TRAIL_LEN = 14;

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

    // Visual-only renderer state
    const trailPos: Array<{ x: number; y: number }> = [];
    let explodeParticles: ExplodeParticle[] = [];
    let prevRocks: Rock[] = state.rocks;

    const loop = createLoop({
      step() {
        const inp = {
          left: input.isDown('ArrowLeft') || input.isDown('KeyA'),
          right: input.isDown('ArrowRight') || input.isDown('KeyD'),
          thrust: input.isDown('ArrowUp') || input.isDown('KeyW'),
          fire: input.isDown('Space'),
        };

        const prevRocksSnap = prevRocks;
        state = stepSim(state, inp, 1 / 60, seqRng);

        if (state.score !== lastScore) {
          lastScore = state.score;
          opts.onScore(state.score);
        }

        if (state.status === 'gameover' && !gameOverFired) {
          gameOverFired = true;
          opts.onGameOver(state.score);
        }

        // Ship trail
        if (state.status === 'playing') {
          trailPos.push({ x: state.ship.pos.x, y: state.ship.pos.y });
          if (trailPos.length > TRAIL_LEN) trailPos.shift();
        }

        // Explosion particles for destroyed rocks
        if (state.rocks.length < prevRocksSnap.length) {
          const currentIds = new Set(state.rocks.map(r => r.id));
          for (const r of prevRocksSnap) {
            if (!currentIds.has(r.id)) {
              const n = EXPLODE_COUNT[r.size];
              const col = ROCK_COLOR[r.size];
              const sz = EXPLODE_SIZE[r.size];
              for (let i = 0; i < n; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 40 + Math.random() * 120;
                const life = 0.6 + Math.random() * 0.5;
                explodeParticles.push({
                  x: r.pos.x, y: r.pos.y,
                  vx: Math.cos(angle) * speed,
                  vy: Math.sin(angle) * speed,
                  life, maxLife: life,
                  col, size: sz,
                });
              }
            }
          }
        }
        prevRocks = state.rocks;

        // Update particles
        const dt = 1 / 60;
        explodeParticles = explodeParticles
          .map(p => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, life: p.life - dt }))
          .filter(p => p.life > 0);
      },
      render() {
        ctx.fillStyle = PALETTE.bg;
        ctx.fillRect(0, 0, WORLD.W, WORLD.H);

        // Starfield
        for (const s of stars) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${s.a})`;
          ctx.fill();
        }

        ctx.lineWidth = 1.5;

        // rocks (with glow)
        for (const rock of state.rocks) {
          const color = ROCK_COLOR[rock.size];
          ctx.strokeStyle = color;
          ctx.shadowBlur = 10;
          ctx.shadowColor = color;
          const shape = getRockShape(rock.id, rock.size, seqRng);
          drawPoly(ctx, shape, rock.pos.x, rock.pos.y, rock.angle);
          ctx.shadowBlur = 0;
        }

        // bullets (with glow)
        ctx.shadowBlur = 8;
        ctx.shadowColor = PALETTE.bullet;
        ctx.strokeStyle = PALETTE.bullet;
        ctx.lineWidth = 2;
        for (const b of state.bullets) {
          ctx.beginPath();
          ctx.arc(b.pos.x, b.pos.y, 2.5, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;

        // ship trail
        for (let i = 0; i < trailPos.length; i++) {
          const alpha = (i / TRAIL_LEN) * 0.35;
          const tp = trailPos[i];
          if (!tp) continue;
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0,255,204,${alpha})`;
          ctx.shadowBlur = 4;
          ctx.shadowColor = '#00ffcc';
          ctx.fill();
        }
        ctx.shadowBlur = 0;

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

        // explosion particles
        for (const p of explodeParticles) {
          const alpha = p.life / p.maxLife;
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = p.col;
          ctx.lineWidth = 1.5;
          ctx.shadowBlur = 6;
          ctx.shadowColor = p.col;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
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
