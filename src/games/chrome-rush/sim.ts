export const WORLD        = { W: 800, H: 600 } as const;
export const FLOOR_Y      = 498;
export const GRAVITY      = 900;
export const JUMP_VEL     = -490;
export const PLAYER_SPEED = 290;
export const BULLET_SPEED = 500;
export const FIRE_RATE    = 0.15;
export const PLAYER_W     = 22;
export const HIT_DIST     = 30;

export const SCORE_VALUES = { walker: 10, runner: 20, wave_bonus: 50 } as const;

export type EnemyKind = 'walker' | 'runner';

export interface Player {
  x: number; y: number;
  vy: number;
  facing: -1 | 1;
  hp: number;
  iframes: number;
  fireTimer: number;
  flashTimer: number;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  dir: -1 | 1;
  speed: number;
}

export interface Bullet {
  id: number;
  x: number; y: number;
  vx: number;
}

export interface SimInput {
  left: boolean; right: boolean; jump: boolean; fire: boolean;
}

export interface SimState {
  player: Player;
  enemies: Enemy[];
  bullets: Bullet[];
  score: number;
  wave: number;
  killsThisWave: number;
  killTarget: number;
  spawnTimer: number;
  spawnInterval: number;
  waveFlash: number;
  status: 'playing' | 'gameover';
  _nextId: number;
}

export function createSim(_rng: () => number): SimState {
  return {
    player: {
      x: WORLD.W / 2, y: FLOOR_Y,
      vy: 0,
      facing: 1,
      hp: 3,
      iframes: 0,
      fireTimer: 0,
      flashTimer: 0,
    },
    enemies: [],
    bullets: [],
    score: 0,
    wave: 1,
    killsThisWave: 0,
    killTarget: 5,
    spawnTimer: 1.0,
    spawnInterval: 3.2,
    waveFlash: 0,
    status: 'playing',
    _nextId: 0,
  };
}

export function stepSim(state: SimState, input: SimInput, dt: number, rng: () => number): SimState {
  if (state.status !== 'playing') return state;

  let nid = state._nextId;

  // 1. Horizontal movement
  const moveDir = input.right ? 1 : input.left ? -1 : 0;
  let px = state.player.x + moveDir * PLAYER_SPEED * dt;
  px = Math.max(PLAYER_W / 2, Math.min(WORLD.W - PLAYER_W / 2, px));
  let facing: -1 | 1 = state.player.facing;
  if (input.right) facing = 1;
  else if (input.left) facing = -1;

  // 2. Gravity then jump then position then floor clamp
  let vy = state.player.vy + GRAVITY * dt;
  if (input.jump && state.player.y >= FLOOR_Y) vy = JUMP_VEL;
  let py = state.player.y + vy * dt;
  if (py >= FLOOR_Y) { py = FLOOR_Y; vy = 0; }

  // 3. Decay timers
  let iframes    = Math.max(0, state.player.iframes  - dt);
  let flashTimer = Math.max(0, state.player.flashTimer - dt);
  let fireTimer  = Math.max(0, state.player.fireTimer  - dt);
  let waveFlash  = Math.max(0, state.waveFlash - dt);

  // 4. Fire new bullet
  let bullets: Bullet[] = state.bullets.map((b) => ({ ...b }));
  if (input.fire && fireTimer <= 0) {
    bullets = [...bullets, { id: ++nid, x: px, y: py - 21, vx: facing * BULLET_SPEED }];
    fireTimer = FIRE_RATE;
  }

  // 5. Move bullets, remove OOB
  bullets = bullets
    .map((b) => ({ ...b, x: b.x + b.vx * dt }))
    .filter((b) => b.x >= -60 && b.x <= WORLD.W + 60);

  // 6. Move enemies, remove OOB
  let enemies: Enemy[] = state.enemies
    .map((e) => ({ ...e, x: e.x + e.dir * e.speed * dt }))
    .filter((e) => e.x >= -90 && e.x <= WORLD.W + 90);

  // 7. Bullet–enemy collision
  let score = state.score;
  let killsThisWave = state.killsThisWave;
  const hitBullets = new Set<number>();
  const hitEnemies = new Set<number>();
  const enemyCenterY = FLOOR_Y - 18;
  for (const bullet of bullets) {
    for (const enemy of enemies) {
      if (hitEnemies.has(enemy.id) || hitBullets.has(bullet.id)) continue;
      if (Math.abs(bullet.x - enemy.x) < 20 && Math.abs(bullet.y - enemyCenterY) < 26) {
        hitBullets.add(bullet.id);
        hitEnemies.add(enemy.id);
        score += SCORE_VALUES[enemy.kind];
        killsThisWave++;
      }
    }
  }
  bullets  = bullets.filter((b) => !hitBullets.has(b.id));
  enemies  = enemies.filter((e) => !hitEnemies.has(e.id));

  // 8. Enemy–player melee
  let playerHp = state.player.hp;
  const meleeHit = new Set<number>();
  for (const enemy of enemies) {
    if (Math.abs(enemy.x - px) < HIT_DIST && iframes <= 0) {
      playerHp--;
      iframes    = 1.8;
      flashTimer = 0.35;
      meleeHit.add(enemy.id);
    }
  }
  enemies = enemies.filter((e) => !meleeHit.has(e.id));

  // 9. Wave advance
  let wave          = state.wave;
  let killTarget    = state.killTarget;
  let spawnInterval = state.spawnInterval;
  if (killsThisWave >= killTarget) {
    wave++;
    score        += SCORE_VALUES.wave_bonus;
    killTarget   += 3;
    killsThisWave = 0;
    spawnInterval *= 0.85;
    waveFlash     = 2.0;
    enemies = [];
    bullets = [];
  }

  // 10. Game over
  const status: 'playing' | 'gameover' = playerHp <= 0 ? 'gameover' : 'playing';

  // 11. Spawn
  let spawnTimer = state.spawnTimer - dt;
  if (spawnTimer <= 0 && status === 'playing') {
    const left = rng() < 0.5;
    const ex: number  = left ? -30 : WORLD.W + 30;
    const dir: -1 | 1 = left ? 1 : -1;
    const kind: EnemyKind =
      wave === 1 ? 'walker' : rng() < 0.45 ? 'runner' : 'walker';
    const spd =
      kind === 'walker' ? 70 + (wave - 1) * 10 : 115 + (wave - 1) * 13;
    enemies = [...enemies, { id: ++nid, kind, x: ex, dir, speed: spd }];
    spawnTimer = spawnInterval * (0.75 + rng() * 0.5);
  }

  return {
    player:  { x: px, y: py, vy, facing, hp: playerHp, iframes, fireTimer, flashTimer },
    enemies,
    bullets,
    score,
    wave,
    killsThisWave,
    killTarget,
    spawnTimer,
    spawnInterval,
    waveFlash,
    status,
    _nextId: nid,
  };
}
