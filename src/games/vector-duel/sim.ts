export const SCORE_VALUES = { S: 100, M: 50, L: 20 } as const;

export const WORLD = { W: 800, H: 600 } as const;

const SHIP_ACCEL = 300;
const SHIP_FRICTION = 0.98;
const SHIP_TURN_SPEED = 3.5;
const BULLET_SPEED = 500;
const BULLET_TTL = 1.2;
const BULLET_COOLDOWN = 0.25;

const ROCK_RADII = { L: 42, M: 24, S: 12 } as const;
const ROCK_SPEEDS = { L: 60, M: 100, S: 150 } as const;

type RockSize = 'L' | 'M' | 'S';

export interface Vec2 { x: number; y: number }
export interface Ship { pos: Vec2; vel: Vec2; angle: number; cooldown: number; alive: boolean }
export interface Bullet { pos: Vec2; vel: Vec2; ttl: number }
export interface Rock { id: number; pos: Vec2; vel: Vec2; angle: number; spin: number; size: RockSize }
export type SimStatus = 'playing' | 'gameover';

export interface SimState {
  ship: Ship;
  bullets: Bullet[];
  rocks: Rock[];
  score: number;
  wave: number;
  status: SimStatus;
}

export interface SimInput {
  left: boolean;
  right: boolean;
  thrust: boolean;
  fire: boolean;
}

let _idSeq = 0;
function nextId() { return ++_idSeq; }

function wrap(v: Vec2): Vec2 {
  return {
    x: ((v.x % WORLD.W) + WORLD.W) % WORLD.W,
    y: ((v.y % WORLD.H) + WORLD.H) % WORLD.H,
  };
}

function dist2(a: Vec2, b: Vec2) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function spawnRocks(count: number, rng: () => number): Rock[] {
  const rocks: Rock[] = [];
  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    const speed = ROCK_SPEEDS.L * (0.6 + rng() * 0.8);
    rocks.push({
      id: nextId(),
      pos: { x: rng() * WORLD.W, y: rng() * WORLD.H },
      vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      angle: rng() * Math.PI * 2,
      spin: (rng() - 0.5) * 2,
      size: 'L',
    });
  }
  return rocks;
}

export function createSim(rng: () => number): SimState {
  _idSeq = 0;
  return {
    ship: {
      pos: { x: WORLD.W / 2, y: WORLD.H / 2 },
      vel: { x: 0, y: 0 },
      angle: -Math.PI / 2,
      cooldown: 0,
      alive: true,
    },
    bullets: [],
    rocks: spawnRocks(3, rng),
    score: 0,
    wave: 1,
    status: 'playing',
  };
}

function splitRock(rock: Rock, rng: () => number): Rock[] {
  if (rock.size === 'S') return [];
  const childSize: RockSize = rock.size === 'L' ? 'M' : 'S';
  return [0, 1].map(() => {
    const angle = rng() * Math.PI * 2;
    const speed = ROCK_SPEEDS[childSize] * (0.7 + rng() * 0.6);
    return {
      id: nextId(),
      pos: { ...rock.pos },
      vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      angle: rng() * Math.PI * 2,
      spin: (rng() - 0.5) * 3,
      size: childSize,
    };
  });
}

export function stepSim(state: SimState, input: SimInput, dt: number, rng: () => number): SimState {
  if (state.status !== 'playing') return state;

  const ship = { ...state.ship, pos: { ...state.ship.pos }, vel: { ...state.ship.vel } };
  let bullets = state.bullets.map((b) => ({ ...b, pos: { ...b.pos }, vel: { ...b.vel } }));
  let rocks = state.rocks.map((r) => ({ ...r, pos: { ...r.pos }, vel: { ...r.vel } }));
  let score = state.score;
  let wave = state.wave;
  let status: SimStatus = 'playing';

  // ship rotation
  if (input.left) ship.angle -= SHIP_TURN_SPEED * dt;
  if (input.right) ship.angle += SHIP_TURN_SPEED * dt;

  // thrust
  if (input.thrust) {
    ship.vel.x += Math.cos(ship.angle) * SHIP_ACCEL * dt;
    ship.vel.y += Math.sin(ship.angle) * SHIP_ACCEL * dt;
  }

  ship.vel.x *= Math.pow(SHIP_FRICTION, dt * 60);
  ship.vel.y *= Math.pow(SHIP_FRICTION, dt * 60);

  ship.pos.x += ship.vel.x * dt;
  ship.pos.y += ship.vel.y * dt;
  ship.pos = wrap(ship.pos);

  // fire
  ship.cooldown = Math.max(0, ship.cooldown - dt);
  if (input.fire && ship.cooldown === 0) {
    ship.cooldown = BULLET_COOLDOWN;
    bullets.push({
      pos: { ...ship.pos },
      vel: {
        x: Math.cos(ship.angle) * BULLET_SPEED + ship.vel.x,
        y: Math.sin(ship.angle) * BULLET_SPEED + ship.vel.y,
      },
      ttl: BULLET_TTL,
    });
  }

  // update bullets
  bullets = bullets
    .map((b) => ({ ...b, pos: wrap({ x: b.pos.x + b.vel.x * dt, y: b.pos.y + b.vel.y * dt }), ttl: b.ttl - dt }))
    .filter((b) => b.ttl > 0);

  // update rocks
  rocks = rocks.map((r) => ({
    ...r,
    pos: wrap({ x: r.pos.x + r.vel.x * dt, y: r.pos.y + r.vel.y * dt }),
    angle: r.angle + r.spin * dt,
  }));

  // bullet-rock collisions
  const survivingRocks: Rock[] = [];
  const hitBulletIndices = new Set<number>();

  for (const rock of rocks) {
    const r = ROCK_RADII[rock.size];
    let hit = -1;
    for (let i = 0; i < bullets.length; i++) {
      if (hitBulletIndices.has(i)) continue;
      const b = bullets[i];
      if (b === undefined) continue;
      if (dist2(b.pos, rock.pos) < (r + 4) * (r + 4)) {
        hit = i;
        break;
      }
    }
    if (hit >= 0) {
      hitBulletIndices.add(hit);
      score += SCORE_VALUES[rock.size];
      survivingRocks.push(...splitRock(rock, rng));
    } else {
      survivingRocks.push(rock);
    }
  }

  bullets = bullets.filter((_, i) => !hitBulletIndices.has(i));
  rocks = survivingRocks;

  // ship-rock collision
  if (ship.alive) {
    const SHIP_RADIUS = 10;
    for (const rock of rocks) {
      const r = ROCK_RADII[rock.size] + SHIP_RADIUS;
      if (dist2(ship.pos, rock.pos) < r * r) {
        status = 'gameover';
        break;
      }
    }
  }

  // next wave
  if (rocks.length === 0 && status === 'playing') {
    wave += 1;
    rocks = spawnRocks(2 + wave, rng);
  }

  return { ship, bullets, rocks, score, wave, status };
}
