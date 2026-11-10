import test from 'node:test';
import assert from 'node:assert/strict';
import { CrystalWellGame, RULES, makeLevel, brickPosition, brickIndex } from '../src/physics.js';

test('cylinder is filled across radii and eight levels, rather than a single barrel shell', () => {
  const { grid, total } = makeLevel();
  assert.ok(total > 1500 && total < 2500, `unexpected count ${total}`);
  assert.equal(grid[brickIndex(10, 10, 4)], 1); // inner layer
  assert.equal(grid[brickIndex(16, 10, 4)], 1); // outer radius
  assert.equal(grid[brickIndex(10, 10, 2)], 1); // height layer
  assert.equal(grid[brickIndex(10, 10, 7)], 1);
});

test('front-facing wall has a connected indentation and the bottom allows a dragon crown', () => {
  const { grid } = makeLevel();
  assert.equal(grid[brickIndex(10, 3, 6)], 0);
  assert.equal(grid[brickIndex(10, 2, 5)], 0);
  assert.equal(grid[brickIndex(10, 10, 0)], 0);
  assert.equal(grid[brickIndex(6, 6, 0)], 1);
});

test('break event removes genuine occupied voxels and reports progress', () => {
  const game = new CrystalWellGame();
  const before = game.remaining;
  const ix = 13, iy = 12, k = 4;
  assert.ok(game.occupied(ix, iy, k));
  game.fracture(ix, iy, k, brickPosition(ix, iy, k));
  assert.ok(game.remaining < before);
  assert.equal(game.occupied(ix, iy, k), false);
  const ev = game.drainEvents().find(e => e.type === 'crystal');
  assert.ok(ev?.removed.includes(brickIndex(ix, iy, k)));
  assert.equal(before - game.remaining, ev.removed.length);
});

test('aim is clamped within reachable well area', () => {
  const game = new CrystalWellGame();
  game.aim(100, 100);
  const r = Math.hypot(game.shield.targetX, game.shield.targetY);
  assert.ok(r < RULES.wellRadius - RULES.shieldRadius);
  assert.ok(r > RULES.wellRadius - RULES.shieldRadius - 0.2);
});

test('shield catches a rising ball inside disk and sends it downward', () => {
  const game = new CrystalWellGame();
  game.state = 'playing';
  game.grid.fill(0); // ensure no crystals in the collision step
  Object.assign(game.shield, { x: 1, y: 0, targetX: 1, targetY: 0 });
  Object.assign(game.ball, { x: 1.1, y: 0, z: RULES.shieldZ - RULES.ballRadius - 0.03,
    vx: 0, vy: 0, vz: 7.4 });
  game.step(1 / 60);
  assert.ok(game.ball.vz < 0);
  assert.ok(game.drainEvents().some(e => e.type === 'shield'));
});

test('missing the shield consumes a life and ultimately loses', () => {
  const game = new CrystalWellGame();
  game.state = 'playing';
  game.grid.fill(0);
  for (let i = 0; i < RULES.lives; i++) {
    game.state = 'playing';
    Object.assign(game.ball, { x: 5, y: 5, z: RULES.shieldZ + 1.5, vx: 0, vy: 0, vz: 7.4 });
    game.step(1 / 120);
  }
  assert.equal(game.lives, 0);
  assert.equal(game.state, 'lost');
});

test('legacy collision kernel auto-serve remains finite (production uses explicit AdventureGame serve)', () => {
  const game = new CrystalWellGame();
  for (let i = 0; i < 4800; i++) {
    game.step(1 / 120);
    for (const k of ['x', 'y', 'z', 'vx', 'vy', 'vz']) assert.ok(Number.isFinite(game.ball[k]), `${k} failed at ${i}`);
    if (game.state === 'lost' || game.state === 'won') break;
  }
  assert.ok(game.total > 1500);
  assert.ok(game.remaining <= game.total);
});

test('wall collision reflects outward motion inward rather than pinning ball to wall', () => {
  const game = new CrystalWellGame(); game.state = 'playing'; game.grid.fill(0);
  Object.assign(game.ball, { x: RULES.wellRadius - RULES.ballRadius - .02, y: 0,
    z: 5, vx: 7.4, vy: 0, vz: 0 });
  game.step(1 / 120);
  assert.ok(game.ball.vx < 0, 'the outgoing lateral velocity must reverse');
  assert.ok(game.drainEvents().some(e => e.type === 'wall'));
});

test('an ideal shield tracker can complete the full seal, not get stuck in an empty tunnel', () => {
  const game = new CrystalWellGame();
  for (let i = 0; i < 120 * 900 && game.state !== 'won' && game.state !== 'lost'; i++) {
    const b = game.ball;
    const untilTop = b.vz > 0 ? Math.max(0, (RULES.shieldZ - b.z) / b.vz) : 0;
    game.aim(b.x + b.vx * untilTop, b.y + b.vy * untilTop);
    game.step(1 / 120);
    game.drainEvents();
  }
  assert.equal(game.state, 'won');
  assert.equal(game.remaining, 0);
});
