export const SCORE_VALUES = { deflect: 10, wave_bonus: 50 } as const;
export const WORLD = { W: 800, H: 600 } as const;
export const CENTER = { x: 400, y: 300 } as const;
export const SHIELD_RADIUS = 90;
export const SHIELD_SPAN = Math.PI * 0.44;
export const SHIELD_TURN = 2.8;

export interface Vec2 { x: number; y: number }

export interface Bolt {
  id: number;
  pos: Vec2;
  vel: Vec2;
}

export interface SimInput {
  left: boolean;
  right: boolean;
}

export interface SimState {
  shieldAngle: number;
  bolts: Bolt[];
  score: number;
  wave: number;
  deflected: number;
  spawnTimer: number;
  spawnInterval: number;
  status: 'playing' | 'gameover';
  lastDeflectPos: Vec2 | null;
}

let _idSeq = 0;
function nextId() { return ++_idSeq; }

function vecDist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function normalizeAngle(a: number): number {
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r < -Math.PI) r += Math.PI * 2;
  return r;
}

function spawnBolt(rng: () => number, wave: number): Bolt {
  const theta = rng() * Math.PI * 2;
  const pos: Vec2 = {
    x: CENTER.x + Math.cos(theta) * 490,
    y: CENTER.y + Math.sin(theta) * 490,
  };
  const speed = 130 + wave * 18 + rng() * 30;
  const dx = CENTER.x - pos.x;
  const dy = CENTER.y - pos.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const nx = dx / d, ny = dy / d;
  const offset = (rng() - 0.5) * 0.2;
  const cos = Math.cos(offset), sin = Math.sin(offset);
  return {
    id: nextId(),
    pos,
    vel: { x: (nx * cos - ny * sin) * speed, y: (nx * sin + ny * cos) * speed },
  };
}

export function createSim(_rng: () => number): SimState {
  _idSeq = 0;
  return {
    shieldAngle: 0,
    bolts: [],
    score: 0,
    wave: 1,
    deflected: 0,
    spawnTimer: 0,
    spawnInterval: 2.0,
    status: 'playing',
    lastDeflectPos: null,
  };
}

export function stepSim(state: SimState, input: SimInput, dt: number, rng: () => number): SimState {
  if (state.status !== 'playing') return state;

  // 1. Shield rotation
  const turn = (input.right ? 1 : input.left ? -1 : 0) * SHIELD_TURN * dt;
  let shieldAngle = state.shieldAngle + turn;
  shieldAngle = ((shieldAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

  // 2. Move bolts
  let bolts: Bolt[] = state.bolts.map((b) => ({
    ...b,
    pos: { x: b.pos.x + b.vel.x * dt, y: b.pos.y + b.vel.y * dt },
  }));

  let score = state.score;
  let deflected = state.deflected;
  let wave = state.wave;
  let spawnInterval = state.spawnInterval;
  let status: 'playing' | 'gameover' = 'playing';
  let lastDeflectPos: Vec2 | null = null;

  // 3. Shield collision
  const reflected: Bolt[] = [];
  for (const bolt of bolts) {
    const dx = bolt.pos.x - CENTER.x;
    const dy = bolt.pos.y - CENTER.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d > 0 && d >= SHIELD_RADIUS - 20 && d <= SHIELD_RADIUS + 6) {
      const boltAngle = Math.atan2(dy, dx);
      const diff = normalizeAngle(boltAngle - shieldAngle);

      if (Math.abs(diff) <= SHIELD_SPAN) {
        const rx = dx / d, ry = dy / d;
        const vr = bolt.vel.x * rx + bolt.vel.y * ry;
        score += SCORE_VALUES.deflect;
        deflected += 1;
        lastDeflectPos = { x: bolt.pos.x, y: bolt.pos.y };
        reflected.push({ ...bolt, vel: { x: bolt.vel.x - 2 * vr * rx, y: bolt.vel.y - 2 * vr * ry } });
        continue;
      }
    }
    reflected.push(bolt);
  }
  bolts = reflected;

  // 4. Wave check
  const waveThreshold = 5 + wave * 2;
  if (deflected >= waveThreshold) {
    wave += 1;
    score += SCORE_VALUES.wave_bonus;
    deflected = 0;
    spawnInterval = spawnInterval * 0.85;
  }

  // 5. Death check
  for (const bolt of bolts) {
    if (vecDist(bolt.pos, CENTER) < 18) {
      status = 'gameover';
      break;
    }
  }

  // 6. Remove out-of-range bolts
  bolts = bolts.filter((b) => vecDist(b.pos, CENTER) <= 700);

  // 7. Spawn timer
  let spawnTimer = state.spawnTimer - dt;
  if (spawnTimer <= 0) {
    bolts = [...bolts, spawnBolt(rng, wave)];
    spawnTimer = spawnInterval;
  }

  return { shieldAngle, bolts, score, wave, deflected, spawnTimer, spawnInterval, status, lastDeflectPos };
}
