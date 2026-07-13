import { describe, it, expect } from 'vitest';
import {
  createSim, stepSim,
  SCORE_CRYSTAL, SCORE_WAVE, CRYSTALS_PER_WAVE,
  WORLD, DRONE_BASE_SPEED,
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

const noInput = { left: false, right: false, flip: false };

describe('gravity-well sim', () => {
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
    expect(a.player.x).toBeCloseTo(b.player.x, 5);
  });

  it('flip trigger: input flip sets targetSide=ceil and flipTimer>0', () => {
    const rng = mulberry32(1);
    const state = createSim(rng);
    expect(state.player.side).toBe('floor');
    const next = stepSim(state, { left: false, right: false, flip: true }, 1 / 60, rng);
    expect(next.player.targetSide).toBe('ceil');
    expect(next.player.flipTimer).toBeGreaterThan(0);
  });

  it('crystal collect: crystal on same side removed, score increases', () => {
    const rng = mulberry32(2);
    const state = createSim(rng);
    const playerX = state.player.x;
    const stateWithCrystal: SimState = {
      ...state,
      crystals: [{ id: 99, x: playerX + 5, side: 'floor' }],
      crystalTimer: 999,
    };
    const next = stepSim(stateWithCrystal, noInput, 1 / 60, rng);
    expect(next.crystals.length).toBe(0);
    expect(next.score).toBe(SCORE_CRYSTAL);
  });

  it('drone hit: reduces hp, sets iframes, removes drone', () => {
    const rng = mulberry32(3);
    const state = createSim(rng);
    const playerX = state.player.x;
    const stateWithDrone: SimState = {
      ...state,
      drones: [{ id: 77, x: playerX + 10, dir: 1, speed: 0, side: 'floor' }],
      player: { ...state.player, iframes: 0 },
    };
    const next = stepSim(stateWithDrone, noInput, 1 / 60, rng);
    expect(next.player.hp).toBe(2);
    expect(next.player.iframes).toBeGreaterThan(0);
    expect(next.drones.length).toBe(0);
  });

  it('wave advance: collecting 8th crystal triggers wave++, adds drone, adds SCORE_WAVE', () => {
    const rng = mulberry32(4);
    const state = createSim(rng);
    const playerX = state.player.x;
    const stateNearWave: SimState = {
      ...state,
      crystalsThisWave: CRYSTALS_PER_WAVE - 1,
      crystals: [{ id: 55, x: playerX + 3, side: 'floor' }],
      crystalTimer: 999,
      drones: [],
    };
    const next = stepSim(stateNearWave, noInput, 1 / 60, rng);
    expect(next.wave).toBe(2);
    expect(next.score).toBeGreaterThanOrEqual(SCORE_CRYSTAL + SCORE_WAVE);
    expect(next.drones.length).toBeGreaterThanOrEqual(1);
    // Speed should be scaled up
    expect(next.droneBaseSpeed).toBeGreaterThan(DRONE_BASE_SPEED);
    // world dimensions still valid
    expect(WORLD.W).toBe(800);
  });
});
