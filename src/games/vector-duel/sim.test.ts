import { describe, it, expect } from 'vitest';
import { createSim, stepSim, WORLD, SCORE_VALUES } from './sim';

// deterministic seedable RNG (mulberry32)
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const noInput = { left: false, right: false, thrust: false, fire: false };

describe('vector-duel sim', () => {
  it('is deterministic: two runs with same seed produce identical states after 600 steps', () => {
    const DT = 1 / 60;
    function run(seed: number) {
      const rng = mulberry32(seed);
      let state = createSim(rng);
      for (let i = 0; i < 600; i++) {
        if (state.status !== 'playing') break;
        state = stepSim(state, noInput, DT, mulberry32(seed + i));
      }
      return state;
    }
    const a = run(42);
    const b = run(42);
    expect(a.score).toBe(b.score);
    expect(a.wave).toBe(b.wave);
    expect(a.status).toBe(b.status);
    expect(a.ship.pos.x).toBeCloseTo(b.ship.pos.x, 5);
  });

  it('hitting an L rock gives 20 points and spawns 2 M rocks', () => {
    const rng = mulberry32(1);
    let state = createSim(rng);

    // place bullet directly on first rock
    const rock = state.rocks[0]!;
    expect(rock.size).toBe('L');

    state = {
      ...state,
      bullets: [{ pos: { ...rock.pos }, vel: { x: 0, y: 0 }, ttl: 1 }],
    };

    const rng2 = mulberry32(2);
    const next = stepSim(state, noInput, 1 / 60, rng2);

    const mRocks = next.rocks.filter((r) => r.size === 'M');
    expect(mRocks.length).toBeGreaterThanOrEqual(2);
    expect(next.score).toBeGreaterThanOrEqual(SCORE_VALUES.L);
  });

  it('ship wraps from right edge to left', () => {
    const rng = mulberry32(99);
    let state = createSim(rng);
    state = { ...state, rocks: [], ship: { ...state.ship, pos: { x: WORLD.W - 1, y: 300 }, vel: { x: 200, y: 0 } } };

    const next = stepSim(state, noInput, 1 / 60, rng);
    expect(next.ship.pos.x).toBeLessThan(WORLD.W);
    expect(next.ship.pos.x).toBeGreaterThanOrEqual(0);
  });

  it('ship-rock collision sets status to gameover', () => {
    const rng = mulberry32(7);
    let state = createSim(rng);

    // put a large rock exactly on the ship
    state = {
      ...state,
      rocks: [{ ...state.rocks[0]!, pos: { ...state.ship.pos } }],
    };

    const next = stepSim(state, noInput, 1 / 60, rng);
    expect(next.status).toBe('gameover');
  });

  it('clearing all rocks increments wave', () => {
    const rng = mulberry32(3);
    let state = createSim(rng);
    const startWave = state.wave;

    state = { ...state, rocks: [] };
    const next = stepSim(state, noInput, 1 / 60, rng);
    expect(next.wave).toBe(startWave + 1);
    expect(next.rocks.length).toBeGreaterThan(0);
  });
});
