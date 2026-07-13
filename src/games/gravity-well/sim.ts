export const WORLD = { W: 800, H: 500 } as const;
export const FLOOR_Y = 480;
export const CEIL_Y = 20;
export const HIT_DIST = 22;
export const PLAYER_SPEED = 260;
export const DRONE_BASE_SPEED = 90;
export const CRYSTAL_INTERVAL = 2.8;
export const FLIP_DUR = 0.12;
export const SCORE_CRYSTAL = 5;
export const SCORE_WAVE = 20;
export const CRYSTALS_PER_WAVE = 8;

export type Side = 'floor' | 'ceil';

export interface Player {
  x: number;
  side: Side;
  flipTimer: number;
  targetSide: Side;
  hp: number;
  iframes: number;
  flashTimer: number;
}

export interface Drone {
  id: number;
  x: number;
  dir: 1 | -1;
  speed: number;
  side: Side;
}

export interface Crystal {
  id: number;
  x: number;
  side: Side;
}

export interface SimInput {
  left: boolean;
  right: boolean;
  flip: boolean;
}

export interface SimState {
  player: Player;
  drones: Drone[];
  crystals: Crystal[];
  score: number;
  wave: number;
  crystalsThisWave: number;
  crystalTimer: number;
  droneBaseSpeed: number;
  status: 'playing' | 'gameover';
  _nextId: number;
  waveFlash: number;
}

export function createSim(_rng: () => number): SimState {
  return {
    player: {
      x: WORLD.W / 2,
      side: 'floor',
      flipTimer: 0,
      targetSide: 'floor',
      hp: 3,
      iframes: 0,
      flashTimer: 0,
    },
    drones: [{ id: 1, x: 200, dir: 1, speed: DRONE_BASE_SPEED, side: 'floor' }],
    crystals: [],
    score: 0,
    wave: 1,
    crystalsThisWave: 0,
    crystalTimer: CRYSTAL_INTERVAL,
    droneBaseSpeed: DRONE_BASE_SPEED,
    status: 'playing',
    _nextId: 2,
    waveFlash: 0,
  };
}

export function stepSim(
  state: SimState,
  input: SimInput,
  dt: number,
  rng: () => number,
): SimState {
  if (state.status !== 'playing') return state;

  // 1. Player horizontal movement
  const dx = (input.right ? 1 : input.left ? -1 : 0) * PLAYER_SPEED * dt;
  const playerX = Math.min(Math.max(state.player.x + dx, 20), WORLD.W - 20);

  // 2. Flip gravity
  let side: Side = state.player.side;
  let targetSide: Side = state.player.targetSide;
  let flipTimer = state.player.flipTimer;

  if (input.flip && flipTimer <= 0) {
    targetSide = side === 'floor' ? 'ceil' : 'floor';
    flipTimer = FLIP_DUR;
  }
  const prevFlipTimer = flipTimer;
  flipTimer = Math.max(0, flipTimer - dt);
  if (prevFlipTimer > 0 && flipTimer <= 0) {
    side = targetSide;
  }

  // 3. Decay timers
  let iframes = Math.max(0, state.player.iframes - dt);
  let flashTimer = Math.max(0, state.player.flashTimer - dt);
  let hp = state.player.hp;
  const waveFlash = Math.max(0, state.waveFlash - dt);

  // 4. Move drones (bounce at walls)
  let drones: Drone[] = state.drones.map((d) => {
    let nx = d.x + d.dir * d.speed * dt;
    let ndir: 1 | -1 = d.dir;
    if (nx < 20) { nx = 20; ndir = 1; }
    if (nx > WORLD.W - 20) { nx = WORLD.W - 20; ndir = -1; }
    return { ...d, x: nx, dir: ndir };
  });

  // 5. Drone-player collision (remove colliding drone, apply damage once per frame)
  const survivingDrones: Drone[] = [];
  for (const drone of drones) {
    if (iframes <= 0 && drone.side === side && Math.abs(drone.x - playerX) < HIT_DIST) {
      hp -= 1;
      iframes = 1.5;
      flashTimer = 0.35;
    } else {
      survivingDrones.push(drone);
    }
  }
  drones = survivingDrones;

  // 6. Crystal spawn
  let crystalTimer = state.crystalTimer - dt;
  let nextId = state._nextId;
  let crystals: Crystal[] = state.crystals.slice();
  if (crystalTimer <= 0) {
    const newCrystal: Crystal = {
      id: nextId++,
      x: 60 + rng() * (WORLD.W - 120),
      side: rng() < 0.5 ? 'floor' : 'ceil',
    };
    crystals = [...crystals, newCrystal];
    crystalTimer = CRYSTAL_INTERVAL;
  }

  // 7. Collect crystals (only when not mid-flip)
  let score = state.score;
  let crystalsThisWave = state.crystalsThisWave;
  const remainingCrystals: Crystal[] = [];
  for (const crystal of crystals) {
    if (flipTimer <= 0 && crystal.side === side && Math.abs(crystal.x - playerX) < 20) {
      score += SCORE_CRYSTAL;
      crystalsThisWave += 1;
    } else {
      remainingCrystals.push(crystal);
    }
  }
  crystals = remainingCrystals;

  // 8. Wave advance
  let wave = state.wave;
  let droneBaseSpeed = state.droneBaseSpeed;
  let newWaveFlash = waveFlash;
  if (crystalsThisWave >= CRYSTALS_PER_WAVE) {
    wave += 1;
    score += SCORE_WAVE;
    crystalsThisWave = 0;
    droneBaseSpeed = droneBaseSpeed * 1.08;
    newWaveFlash = 2.0;
    const spawnLeft = rng() < 0.5;
    const newDroneSide: Side = rng() < 0.5 ? 'floor' : 'ceil';
    const spawnX = spawnLeft ? 50 : WORLD.W - 50;
    const spawnDir: 1 | -1 = spawnLeft ? 1 : -1;
    drones = [...drones, { id: nextId++, x: spawnX, dir: spawnDir, speed: droneBaseSpeed, side: newDroneSide }];
  }

  // 9. Game over
  const status: 'playing' | 'gameover' = hp <= 0 ? 'gameover' : 'playing';

  return {
    player: { x: playerX, side, flipTimer, targetSide, hp, iframes, flashTimer },
    drones,
    crystals,
    score,
    wave,
    crystalsThisWave,
    crystalTimer,
    droneBaseSpeed,
    status,
    _nextId: nextId,
    waveFlash: newWaveFlash,
  };
}
