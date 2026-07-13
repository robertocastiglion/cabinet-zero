import type { GameModule, GameOpts, GameHandle } from '../../engine/types';
import { createLoop } from '../../engine/loop';
import { createInput } from '../../engine/input';
import {
  createSim, stepSim,
  WORLD, FLOOR_Y, CEIL_Y, FLIP_DUR,
} from './sim';

const BG = '#04040f';
const ACCENT = '#ffcc44';
const CYAN = '#00eedd';

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
}

const slug = 'gravity-well';

export default {
  slug,
  init(canvas: HTMLCanvasElement, opts: GameOpts): GameHandle {
    const cssW = canvas.clientWidth || WORLD.W;
    const cssH = Math.round(cssW * WORLD.H / WORLD.W);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.height = cssH + 'px';

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr * cssW / WORLD.W, dpr * cssH / WORLD.H);

    const input = createInput(window);
    let state = createSim(opts.rng);
    let lastScore = -1;
    let gameOverFired = false;
    let renderTime = 0;

    const loop = createLoop({
      step() {
        const inp = {
          left: input.isDown('ArrowLeft') || input.isDown('KeyA'),
          right: input.isDown('ArrowRight') || input.isDown('KeyD'),
          flip: input.isDown('Space') || input.isDown('ArrowUp') || input.isDown('KeyW'),
        };
        state = stepSim(state, inp, 1 / 60, opts.rng);

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

        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, WORLD.W, WORLD.H);

        // Floor and ceiling lines
        ctx.strokeStyle = CYAN;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 12;
        ctx.shadowColor = CYAN;

        ctx.beginPath();
        ctx.moveTo(0, FLOOR_Y);
        ctx.lineTo(WORLD.W, FLOOR_Y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, CEIL_Y);
        ctx.lineTo(WORLD.W, CEIL_Y);
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Crystals (pulsing cyan circles)
        const crystalAlpha = 0.6 + 0.4 * Math.sin(renderTime * 6);
        for (const crystal of state.crystals) {
          const cy = crystal.side === 'floor' ? FLOOR_Y - 5 : CEIL_Y + 5;
          ctx.globalAlpha = crystalAlpha;
          ctx.fillStyle = CYAN;
          ctx.shadowBlur = 10;
          ctx.shadowColor = CYAN;
          ctx.beginPath();
          ctx.arc(crystal.x, cy, 5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        // Drones (golden diamonds)
        for (const drone of state.drones) {
          const dy = drone.side === 'floor' ? FLOOR_Y - 10 : CEIL_Y + 10;
          ctx.strokeStyle = ACCENT;
          ctx.lineWidth = 1.5;
          ctx.shadowBlur = 14;
          ctx.shadowColor = ACCENT;
          drawDiamond(ctx, drone.x, dy, 10);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // Player
        const p = state.player;
        const floorPlayerY = FLOOR_Y - 7;
        const ceilPlayerY = CEIL_Y + 7;
        let playerY: number;
        if (p.flipTimer > 0) {
          const t = 1 - p.flipTimer / FLIP_DUR;
          const fromY = p.side === 'floor' ? floorPlayerY : ceilPlayerY;
          const toY = p.targetSide === 'floor' ? floorPlayerY : ceilPlayerY;
          playerY = fromY + (toY - fromY) * t;
        } else {
          playerY = p.side === 'floor' ? floorPlayerY : ceilPlayerY;
        }

        const playerColor = p.flashTimer > 0 ? '#ffffff' : ACCENT;
        ctx.fillStyle = playerColor;
        ctx.strokeStyle = playerColor;
        ctx.shadowBlur = 12;
        ctx.shadowColor = playerColor;
        ctx.fillRect(p.x - 7, playerY - 7, 14, 14);
        ctx.shadowBlur = 0;

        // HP bar (top-right)
        const hpBoxSize = 10;
        const hpGap = 3;
        const hpStartX = WORLD.W - 14 - (hpBoxSize + hpGap) * 3;
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = i < p.hp ? CYAN : '#1a2a2a';
          ctx.fillRect(hpStartX + i * (hpBoxSize + hpGap), 10, hpBoxSize, hpBoxSize);
        }

        // Score (top-left)
        ctx.fillStyle = ACCENT;
        ctx.font = '10px "Press Start 2P"';
        ctx.textAlign = 'left';
        ctx.fillText(`SCORE ${state.score}`, 10, 22);

        // Wave flash
        if (state.waveFlash > 0) {
          ctx.globalAlpha = Math.min(1, state.waveFlash / 2);
          ctx.fillStyle = ACCENT;
          ctx.shadowBlur = 20;
          ctx.shadowColor = ACCENT;
          ctx.font = '28px "Press Start 2P"';
          ctx.textAlign = 'center';
          ctx.fillText(`WAVE ${state.wave}`, WORLD.W / 2, WORLD.H / 2);
          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;
          ctx.textAlign = 'left';
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
