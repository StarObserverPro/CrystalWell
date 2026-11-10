import { dragonBrow } from './dragon-shape.js';

/** Crystal Well: deterministic, renderer-independent 3D arcade simulation. */
export const RULES = Object.freeze({
  cells: 20, levels: 8, cell: 1,
  brickBottom: 1.92, brickStep: 0.96, brickHalf: 0.465,
  wellRadius: 9.72, crystalRadius: 9.1,
  shieldZ: 10.55, shieldRadius: 1.32,
  ballRadius: 0.34, ballSpeed: 7.4,
  shieldSpeed: 27, lives: 3,
});

export function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
export function length2(x, y) { return Math.hypot(x, y); }
export function brickPosition(ix, iy, k) {
  return { x: (ix - (RULES.cells - 1) / 2) * RULES.cell,
    y: (iy - (RULES.cells - 1) / 2) * RULES.cell,
    z: RULES.brickBottom + k * RULES.brickStep };
}
export function brickIndex(ix, iy, k) {
  return (k * RULES.cells + iy) * RULES.cells + ix;
}
export function within(ix, iy, k) {
  return ix >= 0 && iy >= 0 && k >= 0 && ix < RULES.cells && iy < RULES.cells && k < RULES.levels;
}
function normalize(x, y, z) {
  const l = Math.hypot(x, y, z) || 1;
  return { x: x / l, y: y / l, z: z / l };
}
export function makeLevel() {
  const grid = new Uint8Array(RULES.cells * RULES.cells * RULES.levels);
  let total = 0;
  for (let k = 0; k < RULES.levels; k++) {
    for (let iy = 0; iy < RULES.cells; iy++) {
      for (let ix = 0; ix < RULES.cells; ix++) {
        const { x, y } = brickPosition(ix, iy, k);
        if (Math.hypot(x, y) >= RULES.crystalRadius) continue;
        // Open a pre-existing, irregular notch on the side facing the player (-Y).
        // Several radial columns and height layers are missing: this is NOT a hollow tube.
        const notch = k >= 3 && k <= 7
          && Math.abs(x - 0.5) < (k >= 6 ? 2.65 : 2.05)
          && y < -5.1 + 0.36 * Math.sin(k * 2 + x * 1.6);
        // A small vertical pit, connected to the front notch, welcomes the first shots.
        const lip = k >= 6 && Math.abs(x - 0.5) < 1.75 && y < -4.45 && y > -7.75;
        // Keep space immediately above the dragon's brow.
        const crown = k === 0 && Math.hypot(x, y) < 2.2;
        if (notch || lip || crown) continue;
        grid[brickIndex(ix, iy, k)] = 1;
        total++;
      }
    }
  }
  return { grid, total };
}

export class CrystalWellGame {
  constructor() { this.restart(); }

  restart() {
    const level = makeLevel();
    this.grid = level.grid;
    this.total = level.total;
    this.remaining = level.total;
    this.lives = RULES.lives;
    this.time = 0;
    this.hits = 0;
    this.combo = 0;
    this.lastHitTime = 0;
    this.lastAssistTime = -100;
    this.lastPulseTime = -100;
    this.state = 'ready';
    this.readyTimer = 1.6;
    this.wonAt = null;
    this.events = [{ type: 'restart' }];
    this.shield = { x: 0, y: -5.45, targetX: 0, targetY: -5.45, vx: 0, vy: 0 };
    this.ball = { x: 0, y: -5.45, z: RULES.shieldZ - RULES.ballRadius - 0.25,
      vx: 1.2, vy: 1.15, vz: -7.15, radius: RULES.ballRadius };
  }

  index(ix, iy, k) { return brickIndex(ix, iy, k); }
  occupied(ix, iy, k) { return within(ix, iy, k) && this.grid[brickIndex(ix, iy, k)] === 1; }
  drainEvents() { const current = this.events; this.events = []; return current; }

  aim(x, y) {
    const safeRadius = RULES.wellRadius - (this.activeShieldRadius || RULES.shieldRadius) - 0.08;
    const len = Math.hypot(x, y);
    const f = len > safeRadius ? safeRadius / len : 1;
    this.shield.targetX = x * f;
    this.shield.targetY = y * f;
  }

  launch() {
    if (this.state !== 'ready') return;
    this.state = 'playing';
    const s = this.shield;
    Object.assign(this.ball, { x: s.x, y: s.y,
      z: RULES.shieldZ - RULES.ballRadius - 0.33,
      vx: 1.55, vy: 1.05, vz: -Math.sqrt(RULES.ballSpeed ** 2 - 1.55 ** 2 - 1.05 ** 2) });
    this.events.push({ type: 'launch', x: this.ball.x, y: this.ball.y, z: this.ball.z });
  }

  moveShield(dt) {
    const s = this.shield;
    const dx = s.targetX - s.x, dy = s.targetY - s.y;
    const d = Math.hypot(dx, dy);
    const travel = Math.min(d, RULES.shieldSpeed * dt);
    const nx = d > 1e-6 ? dx * travel / d : 0;
    const ny = d > 1e-6 ? dy * travel / d : 0;
    s.x += nx; s.y += ny;
    s.vx = dt ? nx / dt : 0; s.vy = dt ? ny / dt : 0;
  }

  step(dt) {
    dt = clamp(dt, 0, 1 / 60);
    this.time += dt;
    this.moveShield(dt);
    if (this.state === 'won' || this.state === 'lost') return;
    if (this.state === 'ready') {
      this.ball.x = this.shield.x;
      this.ball.y = this.shield.y;
      this.ball.z = RULES.shieldZ - RULES.ballRadius - 0.25 + Math.sin(this.time * 3) * 0.07;
      this.readyTimer -= dt;
      if (this.readyTimer <= 0) this.launch();
      return;
    }

    const b = this.ball;
    const oldZ = b.z;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    const distance = Math.hypot(b.x, b.y);
    const limit = RULES.wellRadius - b.radius;
    if (distance > limit) {
      const nx = b.x / distance, ny = b.y / distance;
      b.x = nx * (limit - 0.001); b.y = ny * (limit - 0.001);
      this.reflect(-nx, -ny, 0);
      this.events.push({ type: 'wall', x: b.x, y: b.y, z: b.z });
    }
    if (this.hitCrystal()) return;

    // The shield spans a finite XY disk at the well opening.
    if (b.vz > 0 && oldZ + b.radius <= RULES.shieldZ && b.z + b.radius >= RULES.shieldZ) {
      const dx = b.x - this.shield.x, dy = b.y - this.shield.y;
      if (Math.hypot(dx, dy) <= (this.activeShieldRadius || RULES.shieldRadius) + b.radius * 0.55) {
        b.z = RULES.shieldZ - b.radius - 0.003;
        b.vx = clamp(b.vx * 0.54 + dx * 2.0 + this.shield.vx * 0.055, -4.4, 4.4);
        b.vy = clamp(b.vy * 0.54 + dy * 2.0 + this.shield.vy * 0.055, -4.4, 4.4);
        b.vx += Math.sin(this.time * 1.53 + this.hits * .61) * .32;
        b.vy += Math.cos(this.time * 1.21 + this.hits * .77) * .32;
        b.vz = -Math.max(4.4, Math.sqrt(Math.max(1, RULES.ballSpeed ** 2 - b.vx ** 2 - b.vy ** 2)));
        this.setSpeed();
        this.assistIfStalled();
        this.resonanceIfStalled();
        this.events.push({ type: 'shield', x: b.x, y: b.y, z: b.z });
      }
    }
    if (b.z - b.radius > RULES.shieldZ + 0.48) { this.loseBall(); return; }

    // Dragon = cheap moving height field, NOT a detailed mesh collider.
    const brow = dragonBrow(b.x, b.y, this.time);
    if (b.vz < 0 && b.z - b.radius <= brow.z) {
      b.z = brow.z + b.radius + 0.002;
      if (brow.inside) {
        this.reflect(brow.nx, brow.ny, brow.nz);
        b.vx += Math.cos(this.time * .85) * .28;
        this.events.push({ type: 'dragon', x: b.x, y: b.y, z: b.z });
      } else { b.vz = Math.abs(b.vz); this.events.push({ type: 'floor', x: b.x, y: b.y, z: b.z }); }
      this.setSpeed();
      this.assistIfStalled();
      this.resonanceIfStalled();
    }
  }

  /** Tiny late-hit correction so long empty channels do not trap the ball forever. */
  assistIfStalled() {
    if (this.state !== 'playing' || this.time - this.lastHitTime < 6 || this.time - this.lastAssistTime < 2.1) return;
    const b = this.ball;
    let best = null;
    let score = Infinity;
    const direction = Math.sign(b.vz);
    for (let i = 0; i < this.grid.length; i++) {
      if (!this.grid[i]) continue;
      const k = Math.floor(i / (RULES.cells * RULES.cells));
      const planeIndex = i % (RULES.cells * RULES.cells);
      const iy = Math.floor(planeIndex / RULES.cells), ix = planeIndex % RULES.cells;
      const q = brickPosition(ix, iy, k);
      if ((q.z - b.z) * direction < 0) continue;
      const dx = q.x - b.x, dy = q.y - b.y;
      const travel = Math.abs(q.z - b.z) / Math.max(4, Math.abs(b.vz));
      const far = Math.hypot(dx, dy);
      const jitter = .16 * Math.sin(i * 2.1 + this.hits * .37);
      const s = far + Math.abs(q.z - b.z) * .16 + jitter
        + Math.max(0, far - (3 + travel * 5)) * 1.6;
      if (s < score) { score = s; best = q; }
    }
    if (!best) return;
    const flight = Math.max(.35, Math.abs(best.z - b.z) / Math.max(4, Math.abs(b.vz)));
    const targetVX = clamp((best.x - b.x) / flight, -4.7, 4.7);
    const targetVY = clamp((best.y - b.y) / flight, -4.7, 4.7);
    b.vx = b.vx * .23 + targetVX * .77;
    b.vy = b.vy * .23 + targetVY * .77;
    this.setSpeed();
    this.lastAssistTime = this.time;
    this.events.push({ type: 'guide', x: b.x, y: b.y, z: b.z });
  }

  /** As the seal weakens, stalled ball returns shake loose nearby cracked clusters. */
  resonanceIfStalled() {
    if (this.remaining >= this.total * .25 || this.time - this.lastHitTime < 5.5
      || this.time - this.lastPulseTime < 5.5 || !this.remaining) return;
    let bestIndex = -1, score = Infinity;
    for (let i = 0; i < this.grid.length; i++) {
      if (!this.grid[i]) continue;
      const k = Math.floor(i / (RULES.cells * RULES.cells));
      const p = i % (RULES.cells * RULES.cells);
      const q = brickPosition(p % RULES.cells, Math.floor(p / RULES.cells), k);
      const s = Math.hypot(q.x - this.ball.x, q.y - this.ball.y) + Math.abs(q.z - this.ball.z) * .12;
      if (s < score) { score = s; bestIndex = i; }
    }
    if (bestIndex < 0) return;
    const k0 = Math.floor(bestIndex / (RULES.cells * RULES.cells));
    const p0 = bestIndex % (RULES.cells * RULES.cells);
    const x0 = p0 % RULES.cells, y0 = Math.floor(p0 / RULES.cells);
    const radius = this.remaining < this.total * .11 ? 2.65 : 2.1;
    const removed = [];
    for (let dz = -3; dz <= 3; dz++) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const ix = x0 + dx, iy = y0 + dy, kz = k0 + dz;
      if (Math.hypot(dx, dy, dz * .9) > radius || !this.occupied(ix, iy, kz)) continue;
      const idx = brickIndex(ix, iy, kz);
      this.grid[idx] = 0; this.remaining--; removed.push(idx);
    }
    if (!removed.length) return;
    const q = brickPosition(x0, y0, k0);
    this.events.push({ type: 'resonance', x: q.x, y: q.y, z: q.z,
      removed, remaining: this.remaining });
    this.lastPulseTime = this.time;
    this.lastHitTime = this.time;
    this.completeIfBroken();
  }

  reflect(nx, ny, nz) {
    const b = this.ball;
    const dot = b.vx * nx + b.vy * ny + b.vz * nz;
    if (dot < 0) {
      b.vx -= 2 * dot * nx;
      b.vy -= 2 * dot * ny;
      b.vz -= 2 * dot * nz;
    }
    this.setSpeed();
  }

  setSpeed() {
    const b = this.ball;
    if (Math.abs(b.vz) < 1.9) b.vz = (b.vz < 0 ? -1 : 1) * 1.9;
    const l = Math.hypot(b.vx, b.vy, b.vz) || 1;
    const speed = (RULES.ballSpeed + Math.min(1.1, this.hits * 0.004)) * (this.speedFactor ?? 1);
    b.vx *= speed / l; b.vy *= speed / l; b.vz *= speed / l;
  }

  hitCrystal() {
    const b = this.ball;
    const half = RULES.brickHalf;
    if (b.z > RULES.brickBottom + (RULES.levels - 1) * RULES.brickStep + half + b.radius || b.z < RULES.brickBottom - half - b.radius) return false;
    const baseX = Math.round(b.x + (RULES.cells - 1) / 2);
    const baseY = Math.round(b.y + (RULES.cells - 1) / 2);
    const baseK = Math.round((b.z - RULES.brickBottom) / RULES.brickStep);
    let hit = null;
    for (let k = baseK - 1; k <= baseK + 1; k++) {
      for (let iy = baseY - 1; iy <= baseY + 1; iy++) {
        for (let ix = baseX - 1; ix <= baseX + 1; ix++) {
          if (!this.occupied(ix, iy, k)) continue;
          const q = brickPosition(ix, iy, k);
          const cx = clamp(b.x, q.x - half, q.x + half);
          const cy = clamp(b.y, q.y - half, q.y + half);
          const cz = clamp(b.z, q.z - half, q.z + half);
          let dx = b.x - cx, dy = b.y - cy, dz = b.z - cz;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= b.radius * b.radius) continue;
          const d = Math.sqrt(d2);
          let n;
          if (d > 1e-6) n = { x: dx / d, y: dy / d, z: dz / d };
          else {
            // Fully inside a brick: use opposing incoming velocity for escape.
            const ax = Math.abs(b.vx), ay = Math.abs(b.vy), az = Math.abs(b.vz);
            n = az >= ax && az >= ay ? { x: 0, y: 0, z: -Math.sign(b.vz || 1) }
              : ax >= ay ? { x: -Math.sign(b.vx || 1), y: 0, z: 0 }
                : { x: 0, y: -Math.sign(b.vy || 1), z: 0 };
          }
          const penetration = b.radius - d;
          if (!hit || penetration > hit.penetration) hit = { ix, iy, k, q, n, penetration };
        }
      }
    }
    if (!hit) return false;
    b.x += hit.n.x * (hit.penetration + 0.008);
    b.y += hit.n.y * (hit.penetration + 0.008);
    b.z += hit.n.z * (hit.penetration + 0.008);
    this.reflect(hit.n.x, hit.n.y, hit.n.z);
    this.fracture(hit.ix, hit.iy, hit.k, hit.q);
    return true;
  }

  fracture(ix, iy, k, position) {
    const removed = [];
    const remove = (x, y, z) => {
      if (!this.occupied(x, y, z)) return;
      const idx = brickIndex(x, y, z);
      this.grid[idx] = 0; this.remaining--; removed.push(idx);
    };
    remove(ix, iy, k);
    this.hits++;
    this.combo = this.time - this.lastHitTime < 2.5 ? Math.min(14, this.combo + 1) : 0;
    this.lastHitTime = this.time;
    const radius = this.remaining < this.total * .36 ? 1.8 : 1.26 + Math.min(.38, this.combo * .028);
    for (let dk = -2; dk <= 2; dk++) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (!dx && !dy && !dk) continue;
          const dist = Math.hypot(dx, dy, dk * 1.12);
          if (dist > radius) continue;
          // Stable sparse fracture for intact inner layers; makes hitting a crack worthwhile.
          if ((Math.abs(dx * 7 + dy * 11 + dk * 3 + this.hits) % 5) === 0 && this.remaining > this.total * .38) continue;
          remove(ix + dx, iy + dy, k + dk);
        }
      }
    }
    // Resonance pulse: later rounds clear small connected pockets rather than 1-by-1 cleanup.
    if (this.hits % 13 === 0) {
      for (let dk = -1; dk <= 1; dk++) {
        for (let j = -3; j <= 3; j++) {
          if (Math.abs(j) <= 1 || this.remaining < this.total * .6) remove(ix + j, iy, k + dk);
        }
      }
    }
    this.events.push({ type: 'crystal', x: position.x, y: position.y, z: position.z,
      removed, combo: this.combo, remaining: this.remaining });
    this.completeIfBroken();
  }


  completeIfBroken() {
    if (this.remaining > Math.max(12, Math.floor(this.total * .006))) return;
    const tail = [];
    for (let i = 0; i < this.grid.length; i++) if (this.grid[i]) { this.grid[i] = 0; tail.push(i); }
    this.remaining = 0;
    if (tail.length) this.events.push({ type: 'collapse', removed: tail });
    this.state = 'won'; this.wonAt = this.time;
    this.events.push({ type: 'win' });
  }

  loseBall() {
    this.lives--;
    this.events.push({ type: 'miss', x: this.ball.x, y: this.ball.y, z: this.ball.z, lives: this.lives });
    if (this.lives <= 0) {
      this.state = 'lost'; this.events.push({ type: 'lose' });
    } else {
      this.state = 'ready';
      this.readyTimer = 1.25;
    }
  }
}
