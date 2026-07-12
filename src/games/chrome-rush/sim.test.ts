import { describe, it, expect } from 'vitest';
import {
  createSim, stepSim,
  FLOOR_Y, JUMP_VEL, BULLET_SPEED,
} from './sim';
import type { SimState } from './sim';

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const noInput = { left: false, right: false, jump: false, fire: false };
const DT = 1 / 60;

describe('chrome-rush sim', () => {
  it('determinism: same seed → identical state after 300 steps', () => {
    function run() {
      const rng = mulberry32(42);
      let s = createSim(rng);
      for (let i = 0; i < 300; i++) s = stepSim(s, noInput, DT, rng);
      return s;
    }
    const a = run();
    const b = run();
    expect(a.score).toBe(b.score);
    expect(a.wave).toBe(b.wave);
    expect(a.player.x).toBe(b.player.x);
    expect(a.player.y).toBe(b.player.y);
  });

  it('jump from ground: vy becomes JUMP_VEL then gravity increases it', () => {
    const rng = mulberry32(1);
    const s0 = createSim(rng);
    expect(s0.player.y).toBe(FLOOR_Y);

    const s1 = stepSim(s0, { ...noInput, jump: true }, DT, rng);
    expect(s1.player.vy).toBe(JUMP_VEL);

    const s2 = stepSim(s1, noInput, DT, rng);
    expect(s2.player.vy).toBeGreaterThan(JUMP_VEL);
  });

  it('bullet fired on fire input: vx === BULLET_SPEED (facing=1)', () => {
    const rng = mulberry32(2);
    const s0 = createSim(rng);
    const s1 = stepSim(s0, { ...noInput, fire: true }, DT, rng);
    expect(s1.bullets.length).toBe(1);
    expect(s1.bullets[0]!.vx).toBe(BULLET_SPEED);
  });

  it('enemy killed by bullet: enemies cleared, killsThisWave increments', () => {
    const rng = mulberry32(3);
    const base = createSim(rng);
    const s0: SimState = {
      ...base,
      player: { ...base.player, x: 200, y: FLOOR_Y, facing: 1 },
      enemies: [{ id: 1, kind: 'walker', x: 220, dir: -1, speed: 0 }],
      bullets: [{ id: 2, x: 215, y: FLOOR_Y - 21, vx: BULLET_SPEED }],
    };
    const s1 = stepSim(s0, noInput, DT, rng);
    expect(s1.enemies.length).toBe(0);
    expect(s1.killsThisWave).toBe(1);
  });

  it('iframes prevent double-hit', () => {
    const rng = mulberry32(4);
    const base = createSim(rng);
    const s0: SimState = {
      ...base,
      enemies: [{ id: 1, kind: 'walker', x: base.player.x + 20, dir: -1, speed: 0 }],
    };
    const s1 = stepSim(s0, noInput, DT, rng);
    expect(s1.player.hp).toBe(2);
    expect(s1.player.iframes).toBeGreaterThan(0);

    // re-insert same enemy; iframes still active → no second hit
    const s1b: SimState = {
      ...s1,
      enemies: [{ id: 2, kind: 'walker', x: s1.player.x + 20, dir: -1, speed: 0 }],
    };
    const s2 = stepSim(s1b, noInput, DT, rng);
    expect(s2.player.hp).toBe(2);
  });
});
