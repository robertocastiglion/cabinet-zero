import type { GameModule, GameOpts, GameHandle } from '../../engine/types';
import { createLoop } from '../../engine/loop';
import { createInput } from '../../engine/input';
import {
  createSim, stepSim,
  WORLD, FLOOR_Y,
} from './sim';

const BG         = '#010108';
const FLOOR_COL  = '#00e676';
const PLAYER_COL = '#00e676';
const BULLET_COL = '#00ffcc';
const WALKER_COL = '#ff4422';
const RUNNER_COL = '#ff9900';
const HP_ALIVE   = '#00e676';
const HP_DEAD    = '#1a1a2e';
const WAVE_COL   = '#00e676';

const slug = 'chrome-rush';

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  facing: -1 | 1,
  flash: boolean,
) {
  const col = flash ? '#ffffff' : PLAYER_COL;
  ctx.strokeStyle = col;
  ctx.fillStyle   = col;
  ctx.shadowColor = col;
  ctx.shadowBlur  = flash ? 20 : 10;
  ctx.lineWidth   = 1.5;

  // head
  ctx.beginPath();
  ctx.arc(x, y - 47, 7, 0, Math.PI * 2);
  ctx.stroke();

  // torso triangle
  ctx.beginPath();
  ctx.moveTo(x, y - 40);
  ctx.lineTo(x - 12, y - 14);
  ctx.lineTo(x + 12, y - 14);
  ctx.closePath();
  ctx.stroke();

  // legs
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 14); ctx.lineTo(x - 8, y);
  ctx.moveTo(x + 6, y - 14); ctx.lineTo(x + 8, y);
  ctx.stroke();

  // direction nub above head
  ctx.shadowBlur = 6;
  ctx.beginPath();
  const nx = x + facing * 10;
  ctx.moveTo(x + facing * 4, y - 52);
  ctx.lineTo(nx, y - 50);
  ctx.stroke();

  ctx.shadowBlur = 0;
}

function drawWalker(ctx: CanvasRenderingContext2D, x: number) {
  const cy = FLOOR_Y - 18;
  ctx.strokeStyle = WALKER_COL;
  ctx.shadowColor = WALKER_COL;
  ctx.shadowBlur  = 8;
  ctx.lineWidth   = 1.3;
  ctx.beginPath();
  const r = 14, sides = 6;
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
    const nx = x + Math.cos(a) * r;
    const ny = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(nx, ny); else ctx.lineTo(nx, ny);
  }
  ctx.closePath();
  ctx.stroke();
  // stub legs
  ctx.beginPath();
  ctx.moveTo(x - 8, cy + r); ctx.lineTo(x - 8, cy + r + 8);
  ctx.moveTo(x + 8, cy + r); ctx.lineTo(x + 8, cy + r + 8);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawRunner(ctx: CanvasRenderingContext2D, x: number, dir: -1 | 1) {
  const cy = FLOOR_Y - 18;
  ctx.strokeStyle = RUNNER_COL;
  ctx.shadowColor = RUNNER_COL;
  ctx.shadowBlur  = 8;
  ctx.lineWidth   = 1.3;
  // diamond leaning in travel direction
  const lean = dir * 5;
  ctx.beginPath();
  ctx.moveTo(x + lean,     cy - 16);
  ctx.lineTo(x + 14 + lean, cy);
  ctx.lineTo(x + lean,     cy + 12);
  ctx.lineTo(x - 14 + lean, cy);
  ctx.closePath();
  ctx.stroke();
  // fast legs
  ctx.beginPath();
  ctx.moveTo(x - 4 + lean, cy + 12);
  ctx.lineTo(x - 6 + lean + dir * 4, cy + 20);
  ctx.moveTo(x + 4 + lean, cy + 12);
  ctx.lineTo(x + 6 + lean + dir * 4, cy + 20);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawBullets(ctx: CanvasRenderingContext2D, bullets: { x: number; y: number; vx: number }[]) {
  ctx.fillStyle  = BULLET_COL;
  ctx.shadowColor = BULLET_COL;
  for (const b of bullets) {
    // trail
    for (let t = 3; t >= 1; t--) {
      ctx.globalAlpha = (4 - t) * 0.1;
      ctx.shadowBlur  = 0;
      ctx.fillRect(b.x - (b.vx > 0 ? t * 5 : -t * 5), b.y - 2, 10, 4);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 12;
    ctx.fillRect(b.x - 7, b.y - 2, 14, 4);
  }
  ctx.shadowBlur  = 0;
  ctx.globalAlpha = 1;
}

function drawFloor(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = FLOOR_COL;
  ctx.shadowColor = FLOOR_COL;
  ctx.shadowBlur  = 14;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(0, FLOOR_Y);
  ctx.lineTo(WORLD.W, FLOOR_Y);
  ctx.stroke();
  // dim platform fill below
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(0,230,118,0.04)';
  ctx.fillRect(0, FLOOR_Y, WORLD.W, WORLD.H - FLOOR_Y);
}

function drawHP(ctx: CanvasRenderingContext2D, hp: number) {
  const size = 12, gap = 4;
  const totalW = 3 * size + 2 * gap;
  const sx = WORLD.W - totalW - 12;
  const sy = 12;
  for (let i = 0; i < 3; i++) {
    const filled = i < hp;
    ctx.fillStyle   = filled ? HP_ALIVE : HP_DEAD;
    ctx.shadowColor = filled ? HP_ALIVE : 'transparent';
    ctx.shadowBlur  = filled ? 6 : 0;
    ctx.fillRect(sx + i * (size + gap), sy, size, size);
  }
  ctx.shadowBlur = 0;
}

type Building = [number, number, number, number];

const CITY_LAYERS: { speed: number; color: string; buildings: Building[] }[] = [
  { speed: 12, color: '#05051a', buildings: [
    [0,160,60,80],[80,140,50,100],[150,170,70,70],[240,155,55,85],
    [320,145,65,95],[410,160,45,80],[480,150,70,90],[570,155,55,85],
    [650,140,60,100],[730,165,50,75],
  ]},
  { speed: 28, color: '#080820', buildings: [
    [0,200,80,60],[100,185,60,75],[180,195,75,65],[280,180,55,80],
    [360,200,80,60],[460,190,65,70],[550,200,80,60],[660,185,60,75],
    [740,195,70,65],
  ]},
  { speed: 55, color: '#0c0c28', buildings: [
    [0,260,90,50],[110,250,70,60],[210,265,100,45],[340,255,80,55],
    [450,260,90,50],[570,250,70,60],[670,265,100,45],
  ]},
];

function drawCityBg(ctx: CanvasRenderingContext2D, bgOffset: number) {
  for (const layer of CITY_LAYERS) {
    ctx.fillStyle = layer.color;
    const scroll = bgOffset * layer.speed % WORLD.W;
    for (const [bx, by, bw, bh] of layer.buildings) {
      const rx = ((bx - scroll) % WORLD.W + WORLD.W) % WORLD.W;
      ctx.fillRect(rx, by, bw, bh);
      if (rx + bw > WORLD.W) ctx.fillRect(rx - WORLD.W, by, bw, bh);
    }
  }
}

export default {
  slug,
  init(canvas: HTMLCanvasElement, opts: GameOpts): GameHandle {
    const cssW = canvas.clientWidth || 800;
    const cssH = Math.round(cssW * WORLD.H / WORLD.W);
    const dpr  = window.devicePixelRatio || 1;
    canvas.width  = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.height = cssH + 'px';

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr * cssW / WORLD.W, dpr * cssH / WORLD.H);

    const input = createInput(window);
    let state    = createSim(opts.rng);
    let lastScore    = -1;
    let gameOverFired = false;
    let bgOffset = 0;

    const loop = createLoop({
      step() {
        const inp = {
          left:  input.isDown('ArrowLeft')  || input.isDown('KeyA'),
          right: input.isDown('ArrowRight') || input.isDown('KeyD'),
          jump:  input.isDown('ArrowUp')    || input.isDown('KeyW'),
          fire:  input.isDown('Space')      || input.isDown('KeyX'),
        };
        state = stepSim(state, inp, 1 / 60, opts.rng);
        bgOffset += 1 / 60;

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
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, WORLD.W, WORLD.H);

        drawCityBg(ctx, bgOffset);
        drawFloor(ctx);

        // bullets
        drawBullets(ctx, state.bullets);

        // enemies
        for (const e of state.enemies) {
          if (e.kind === 'walker') drawWalker(ctx, e.x);
          else drawRunner(ctx, e.x, e.dir);
        }

        // player
        drawPlayer(
          ctx,
          state.player.x, state.player.y,
          state.player.facing,
          state.player.flashTimer > 0,
        );

        // HP
        drawHP(ctx, state.player.hp);

        // wave flash
        if (state.waveFlash > 0) {
          ctx.globalAlpha = state.waveFlash / 2.0;
          ctx.fillStyle    = WAVE_COL;
          ctx.shadowColor  = WAVE_COL;
          ctx.shadowBlur   = 24;
          ctx.font         = '32px "Press Start 2P", monospace';
          ctx.textAlign    = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`WAVE ${state.wave}`, WORLD.W / 2, WORLD.H / 2 - 40);
          ctx.globalAlpha  = 1;
          ctx.shadowBlur   = 0;
          ctx.textAlign    = 'left';
          ctx.textBaseline = 'alphabetic';
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
