import { describe, it, expect } from 'vitest';
import {
  createSim, stepSim,
  CENTER, SHIELD_RADIUS, SHIELD_SPAN,
  SCORE_VALUES,
} from './sim';

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const noInput = { left: false, right: false };

describe('nova-shield sim', () => {
  it('is deterministic: two runs with same seed produce identical states after 300 steps', () => {
    const DT = 1 / 60;
    function run(baseSeed: number) {
      const rng = mulberry32(baseSeed);
      let state = createSim(rng);
      for (let i = 0; i < 300; i++) {
        if (state.status !== 'playing') break;
        state = stepSim(state, noInput, DT, mulberry32(baseSeed + i));
      }
      return state;
    }
    const a = run(42);
    const b = run(42);
    expect(a.score).toBe(b.score);
    expect(a.wave).toBe(b.wave);
    expect(a.shieldAngle).toBeCloseTo(b.shieldAngle, 5);
  });

  it('shield deflects a bolt moving toward center', () => {
    const rng = mulberry32(10);
    let state = createSim(rng);
    state = {
      ...state,
      shieldAngle: 0,
      spawnTimer: 10,
      bolts: [{
        id: 1,
        pos: { x: CENTER.x + SHIELD_RADIUS - 5, y: CENTER.y },
        vel: { x: -150, y: 0 },
      }],
    };
    const next = stepSim(state, noInput, 1 / 60, mulberry32(10));
    const bolt = next.bolts[0];
    expect(bolt).toBeDefined();
    expect(bolt!.vel.x).toBeGreaterThan(0);
    expect(next.score).toBe(SCORE_VALUES.deflect);
  });

  it('bolt reaching core causes gameover', () => {
    const rng = mulberry32(20);
    let state = createSim(rng);
    state = {
      ...state,
      shieldAngle: Math.PI, // shield on the left, not covering the right
      spawnTimer: 10,
      bolts: [{
        id: 2,
        pos: { x: CENTER.x + 17, y: CENTER.y },
        vel: { x: -300, y: 0 },
      }],
    };
    const next = stepSim(state, noInput, 1 / 60, mulberry32(20));
    expect(next.status).toBe('gameover');
  });

  it('wave increments when deflection threshold is reached', () => {
    const rng = mulberry32(30);
    let state = createSim(rng);
    const waveAtStart = 1;
    const threshold = 5 + waveAtStart * 2; // = 7
    state = {
      ...state,
      wave: waveAtStart,
      deflected: threshold - 1,
      shieldAngle: 0,
      spawnTimer: 10,
      bolts: [{
        id: 3,
        pos: { x: CENTER.x + SHIELD_RADIUS - 5, y: CENTER.y },
        vel: { x: -150, y: 0 },
      }],
    };
    const next = stepSim(state, noInput, 1 / 60, mulberry32(30));
    expect(next.wave).toBe(waveAtStart + 1);
    expect(next.deflected).toBe(0);
    expect(next.score).toBeGreaterThanOrEqual(SCORE_VALUES.wave_bonus + SCORE_VALUES.deflect);
  });

  it('status stays gameover once set (stepSim is idempotent on gameover)', () => {
    const rng = mulberry32(50);
    let state = createSim(rng);
    state = { ...state, status: 'gameover' };
    const next = stepSim(state, noInput, 1 / 60, rng);
    expect(next.status).toBe('gameover');
    expect(next).toBe(state); // returns same reference when not playing
  });
});
