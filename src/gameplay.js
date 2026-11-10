import { CrystalWellGame, RULES, clamp } from './physics.js';
import { QUALITY } from './quality.js';

export const PICKUPS = Object.freeze(['wide', 'slow', 'bind', 'treasure']);
export const SCORE = Object.freeze({ brick: 10, bubble: 100, treasure: 500, clear: 1000, life: 500 });

/** Rules added on top of the original tested collision simulation.
 * readyReason='serve': new life, not a catch. 'capture': explicitly collected bind magic.
 * No timer ever launches a held ball. Click/touch-release/Space is the only release.
 */
export class AdventureGame extends CrystalWellGame {
  restart() {
    super.restart();
    this.score = 0;
    this.bestCombo = 1;
    this.multiplier = 1;
    this.readyReason = 'serve';
    this.readyTimer = Infinity;
    this.heldSince = 0;
    this.respawnUntil = 0;
    this.powerups = [];
    this.nextPickupId = 1;
    this.dropCount = 0;
    this.effects = { wide: 0, slow: 0, bind: 0 };
    this.activeShieldRadius = RULES.shieldRadius;
    this.speedFactor = 1;
    this.lastShieldAt = -100;
    this.lastLaunchAt = -100;
    this.lastPickupAt = -100;
    this.lastMissAt = -100;
    this.lastScoreAt = -100;
  }

  get held() { return this.state === 'ready'; }
  get shieldRadius() { return this.activeShieldRadius; }

  addScore(amount, reason) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.score += Math.round(amount);
    this.lastScoreAt = this.time;
    this.events.push({ type: 'score', amount: Math.round(amount), total: this.score, reason });
  }

  fracture(ix, iy, k, position) {
    if (!this.occupied(ix, iy, k) || this.state === 'won' || this.state === 'lost') return;
    const start = this.events.length;
    super.fracture(ix, iy, k, position);
    const event = this.events.slice(start).find(e => e.type === 'crystal');
    if (!event) return;
    this.multiplier = 1 + Math.min(3, Math.floor(this.combo / 4));
    this.bestCombo = Math.max(this.bestCombo, this.multiplier);
    this.addScore(event.removed.length * SCORE.brick * this.multiplier, 'brick');
    if (this.state === 'playing' && this.hits % 10 === 6) {
      this.spawnPickup(position, PICKUPS[this.dropCount++ % PICKUPS.length]);
    }
  }

  resonanceIfStalled() {
    const start = this.events.length;
    super.resonanceIfStalled();
    const event = this.events.slice(start).find(e => e.type === 'resonance');
    if (event) this.addScore(event.removed.length * SCORE.brick, 'resonance');
  }

  completeIfBroken() {
    if (this.state === 'won' || this.state === 'lost') return;
    const start = this.events.length;
    super.completeIfBroken();
    const collapse = this.events.slice(start).find(e => e.type === 'collapse');
    if (collapse) this.addScore(collapse.removed.length * SCORE.brick, 'collapse');
    if (this.state === 'won') {
      this.addScore(SCORE.clear + this.lives * SCORE.life, 'clear');
      this.powerups.length = 0;
    }
  }

  launch() {
    if (!this.held) return;
    const reason = this.readyReason;
    super.launch();
    this.setSpeed();
    this.lastLaunchAt = this.time;
    this.readyReason = null;
    this.events.push({ type: 'release', reason, x: this.ball.x, y: this.ball.y, z: this.ball.z });
  }

  loseBall() {
    // Guard against repeated calls from presentation or a second out-of-bounds tick.
    if (this.state !== 'playing') return;
    super.loseBall();
    this.lastMissAt = this.time;
    this.combo = 0; this.multiplier = 1;
    this.effects = { wide: 0, slow: 0, bind: 0 };
    this.activeShieldRadius = RULES.shieldRadius; this.speedFactor = 1;
    this.powerups.length = 0;
    if (this.state !== 'lost') {
      this.state = 'respawning';
      this.respawnUntil = this.time + .85;
      this.readyReason = 'serve';
    }
  }

  spawnPickup(position, kind) {
    if (!PICKUPS.includes(kind) || this.powerups.length >= QUALITY.maxBubbles) return null;
    const r = Math.hypot(position.x, position.y);
    const factor = r > RULES.wellRadius - 1 ? (RULES.wellRadius - 1) / r : 1;
    const orb = { id: this.nextPickupId++, kind, x: position.x * factor, y: position.y * factor,
      z: position.z, radius: .65, bornAt: this.time, collected: false };
    this.powerups.push(orb);
    this.events.push({ type: 'bubble', ...orb });
    return orb;
  }

  collectPickup(orb) {
    if (orb.collected) return;
    orb.collected = true;
    this.lastPickupAt = this.time;
    if (orb.kind === 'wide') this.effects.wide = 18;
    if (orb.kind === 'slow') this.effects.slow = 14;
    if (orb.kind === 'bind') this.effects.bind = Math.min(3, this.effects.bind + 2);
    this.addScore(orb.kind === 'treasure' ? SCORE.treasure : SCORE.bubble, 'pickup');
    this.applyEffects();
    this.events.push({ type: 'pickup', kind: orb.kind, x: orb.x, y: orb.y, z: orb.z });
  }

  applyEffects() {
    this.activeShieldRadius = RULES.shieldRadius * (this.effects.wide > 0 ? 1.5 : 1);
    const next = this.effects.slow > 0 ? .72 : 1;
    const changed = this.speedFactor !== next;
    this.speedFactor = next;
    if (changed && this.state === 'playing') this.setSpeed();
    this.aim(this.shield.targetX, this.shield.targetY);
  }

  step(dt) {
    dt = clamp(dt, 0, 1 / 60);
    if (this.state === 'respawning') {
      this.time += dt; this.moveShield(dt);
      if (this.time >= this.respawnUntil) {
        this.state = 'ready'; this.readyReason = 'serve'; this.readyTimer = Infinity;
        this.heldSince = this.time;
        Object.assign(this.ball, { x: this.shield.x, y: this.shield.y,
          z: RULES.shieldZ - RULES.ballRadius - .25, vx: 0, vy: 0, vz: 0 });
        this.events.push({ type: 'serve', x: this.ball.x, y: this.ball.y, z: this.ball.z });
      }
      return;
    }
    if (this.held) this.readyTimer = Infinity;
    if (this.state === 'playing') {
      this.effects.wide = Math.max(0, this.effects.wide - dt);
      this.effects.slow = Math.max(0, this.effects.slow - dt);
    }
    this.applyEffects();
    const start = this.events.length;
    super.step(dt);
    const caught = this.events.slice(start).find(e => e.type === 'shield');
    if (caught && this.state === 'playing') {
      this.lastShieldAt = this.time;
      if (this.effects.bind > 0) {
        this.effects.bind--;
        this.state = 'ready'; this.readyReason = 'capture'; this.heldSince = this.time;
        this.readyTimer = Infinity;
        Object.assign(this.ball, { x: this.shield.x, y: this.shield.y,
          z: RULES.shieldZ - RULES.ballRadius - .25, vx: 0, vy: 0, vz: 0 });
        this.events.push({ type: 'capture', x: this.ball.x, y: this.ball.y, z: this.ball.z });
      }
    }
    if (this.state === 'won' || this.state === 'lost' || this.state === 'respawning') return;
    for (const orb of this.powerups) {
      const oldZ = orb.z;
      orb.z += dt * 1.65;
      if (!orb.collected && oldZ <= RULES.shieldZ && orb.z >= RULES.shieldZ &&
          Math.hypot(orb.x - this.shield.x, orb.y - this.shield.y) <= this.shieldRadius + orb.radius * .45) {
        this.collectPickup(orb);
      }
    }
    this.powerups = this.powerups.filter(o => !o.collected && o.z < RULES.shieldZ + 2);
    if (this.time - this.lastHitTime >= 2.5) this.multiplier = 1;
  }
}
