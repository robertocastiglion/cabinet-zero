import type { GameModule, GameOpts, GameHandle } from '../../engine/types';
import { createLoop } from '../../engine/loop';
import { createInput } from '../../engine/input';
import { createSim, stepSim, WORLD, CENTER, SHIELD_RADIUS, SHIELD_SPAN } from './sim';
import type { Vec2 } from './sim';

const BG = '#030308';
const SHIELD_COLOR = '#ff6600';
const CORE_COLOR = '#ffffff';
const CORE_ALERT = '#ff2244';
const RING_ORBIT = 'rgba(255,102,0,0.18)';
const RING_WARN = 'rgba(255,180,0,0.22)';

const BOLT_SLOW: [number, number, number] = [68, 136, 255];
const BOLT_FAST: [number, number, number] = [255, 34, 68];

function lerpColor(a: [number, number, number], b: [number, number, number], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function boltColor(vx: number, vy: number): string {
  const speed = Math.sqrt(vx * vx + vy * vy);
  const t = Math.min(1, Math.max(0, (speed - 130) / 220));
  return lerpColor(BOLT_SLOW, BOLT_FAST, t);
}

function drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

function drawSparks(ctx: CanvasRenderingContext2D, pos: Vec2, alpha: number) {
  const count = 6;
  ctx.strokeStyle = `rgba(255,160,60,${alpha})`;
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 8;
  ctx.shadowColor = '#ff6600';
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const len = 10 + i * 2;
    ctx.beginPath();
    ctx.moveTo(pos.x + Math.cos(a) * 4, pos.y + Math.sin(a) * 4);
    ctx.lineTo(pos.x + Math.cos(a) * len, pos.y + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

const slug = 'nova-shield';

export default {
  slug,
  init(canvas: HTMLCanvasElement, opts: GameOpts): GameHandle {
    const cssW = canvas.clientWidth || 800;
    const cssH = Math.round(cssW * WORLD.H / WORLD.W);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.height = cssH + 'px';

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr * cssW / WORLD.W, dpr * cssH / WORLD.H);

    const input = createInput(window);
    let state = createSim(() => Math.random());
    let lastScore = -1;
    let gameOverFired = false;

    let renderTime = 0;
    let sparkPos: Vec2 | null = null;
    let sparkAge = 99;

    const loop = createLoop({
      step() {
        const inp = {
          left: input.isDown('ArrowLeft') || input.isDown('KeyA'),
          right: input.isDown('ArrowRight') || input.isDown('KeyD'),
        };
        state = stepSim(state, inp, 1 / 60, opts.rng);

        if (state.lastDeflectPos !== null) {
          sparkPos = state.lastDeflectPos;
          sparkAge = 0;
        }

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
        renderTime += 1 / 60;
        sparkAge += 1 / 60;

        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, WORLD.W, WORLD.H);

        // arena rings
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1;

        // shield orbit ring (dashed)
        ctx.strokeStyle = RING_ORBIT;
        ctx.setLineDash([6, 8]);
        drawCircle(ctx, CENTER.x, CENTER.y, SHIELD_RADIUS);
        ctx.stroke();
        ctx.setLineDash([]);

        // warning ring
        ctx.strokeStyle = RING_WARN;
        drawCircle(ctx, CENTER.x, CENTER.y, 40);
        ctx.stroke();

        // death zone (pulsing)
        const pulse = (Math.sin(renderTime * 5) + 1) * 0.5;
        ctx.strokeStyle = `rgba(255,20,40,${0.35 + pulse * 0.45})`;
        ctx.lineWidth = 1.2;
        drawCircle(ctx, CENTER.x, CENTER.y, 18);
        ctx.stroke();

        // bolts
        for (const bolt of state.bolts) {
          const col = boltColor(bolt.vel.x, bolt.vel.y);
          // trail
          for (let t = 3; t >= 1; t--) {
            const alpha = (4 - t) * 0.08;
            const tx = bolt.pos.x - bolt.vel.x * (t / 60);
            const ty = bolt.pos.y - bolt.vel.y * (t / 60);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = col;
            drawCircle(ctx, tx, ty, 4 - t);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          ctx.shadowBlur = 12;
          ctx.shadowColor = col;
          ctx.fillStyle = col;
          drawCircle(ctx, bolt.pos.x, bolt.pos.y, 5);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = 1;

        // deflect sparks
        if (sparkPos !== null && sparkAge < 0.3) {
          drawSparks(ctx, sparkPos, 1 - sparkAge / 0.3);
        }

        // shield arc
        ctx.strokeStyle = SHIELD_COLOR;
        ctx.lineWidth = 5;
        ctx.shadowBlur = 18;
        ctx.shadowColor = SHIELD_COLOR;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(CENTER.x, CENTER.y, SHIELD_RADIUS, state.shieldAngle - SHIELD_SPAN, state.shieldAngle + SHIELD_SPAN);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.lineCap = 'butt';

        // core
        const nearBolt = state.bolts.some((b) => {
          const dx = b.pos.x - CENTER.x, dy = b.pos.y - CENTER.y;
          return dx * dx + dy * dy < 120 * 120;
        });
        const coreColor = nearBolt
          ? `rgba(255,34,68,${0.7 + (Math.sin(renderTime * 12) + 1) * 0.15})`
          : CORE_COLOR;
        ctx.shadowBlur = nearBolt ? 14 : 8;
        ctx.shadowColor = nearBolt ? CORE_ALERT : CORE_COLOR;
        ctx.fillStyle = coreColor;
        drawCircle(ctx, CENTER.x, CENTER.y, 10);
        ctx.fill();
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
