import test from 'node:test';
import assert from 'node:assert/strict';
import { AdventureGame, SCORE } from '../src/gameplay.js';
import { RULES, brickPosition, brickIndex } from '../src/physics.js';
import { QUALITY, sideTargetSize } from '../src/quality.js';
import { dragonBrow, DRAGON } from '../src/dragon-shape.js';
const advance=(g,seconds)=>{for(let i=0;i<seconds*120;i++)g.step(1/120);};
function riseToShield(g,x=0) {
  g.state='playing';g.grid.fill(0);
  Object.assign(g.shield,{x:0,y:0,targetX:0,targetY:0});
  Object.assign(g.ball,{x,y:0,z:RULES.shieldZ-RULES.ballRadius-.02,vx:0,vy:0,vz:7.4});
  g.step(1/60);
}

test('new runs have exactly three lives and never silently launch',()=>{
  const g=new AdventureGame();advance(g,5);
  assert.equal(g.lives,3);assert.equal(g.state,'ready');assert.equal(g.readyReason,'serve');assert.equal(g.score,0);
  g.launch();assert.equal(g.state,'playing');assert.ok(g.ball.vz<0);
});
test('normal shield contact is a rebound, not a recapture',()=>{
  const g=new AdventureGame();riseToShield(g);
  assert.equal(g.state,'playing');assert.ok(g.ball.vz<0);
  assert.equal(g.drainEvents().some(e=>e.type==='capture'),false);
});
test('bind pickup gives deliberate captures with stationary ball and manual release',()=>{
  const g=new AdventureGame();g.collectPickup({kind:'bind',x:0,y:0,z:10});riseToShield(g);
  assert.equal(g.readyReason,'capture');assert.equal(g.effects.bind,1);assert.equal(g.ball.vz,0);
  advance(g,6);assert.equal(g.state,'ready');g.aim(2,2);advance(g,.2);
  assert.equal(g.ball.x,g.shield.x);assert.equal(g.ball.y,g.shield.y);
  g.launch();assert.equal(g.state,'playing');assert.ok(g.ball.vz<0);
  assert.ok(g.drainEvents().some(e=>e.type==='release'&&e.reason==='capture'));
});
test('miss is visibly separated from the new serve and consumes one life only',()=>{
  const g=new AdventureGame();g.launch();g.loseBall();g.loseBall();
  assert.equal(g.lives,2);assert.equal(g.state,'respawning');advance(g,.5);assert.equal(g.state,'respawning');
  advance(g,.4);assert.equal(g.state,'ready');assert.equal(g.readyReason,'serve');advance(g,3);assert.equal(g.state,'ready');
});
test('all three misses end the game; restart resets score, magic and lives',()=>{
  const g=new AdventureGame();g.score=765;g.effects.bind=2;
  for(let i=0;i<3;i++){g.state='playing';g.loseBall();}
  assert.equal(g.state,'lost');assert.equal(g.lives,0);
  g.restart();assert.equal(g.lives,3);assert.equal(g.score,0);assert.equal(g.effects.bind,0);assert.equal(g.powerups.length,0);
});
test('brick scoring uses actually removed voxels and cannot farm an empty cell',()=>{
  const g=new AdventureGame();g.launch();const q=brickPosition(13,12,4),before=g.remaining;
  g.fracture(13,12,4,q);const expected=(before-g.remaining)*SCORE.brick*g.multiplier;
  assert.equal(g.score,expected);g.fracture(13,12,4,q);assert.equal(g.score,expected);
});
test('bubbles rise, collect only at the shield and award exactly once',()=>{
  const g=new AdventureGame();g.launch();g.grid.fill(0);
  const orb=g.spawnPickup({x:g.shield.x,y:g.shield.y,z:RULES.shieldZ-.01},'treasure');
  g.step(1/60);assert.equal(g.score,SCORE.treasure);assert.equal(g.powerups.length,0);
  g.collectPickup(orb);assert.equal(g.score,SCORE.treasure);
  const miss=g.spawnPickup({x:7,y:2,z:RULES.shieldZ-.01},'bind');g.step(1/60);assert.equal(g.effects.bind,0);assert.ok(miss.z>RULES.shieldZ);
});
test('bubble count is bounded and unknown types cannot spawn',()=>{
  const g=new AdventureGame();for(let i=0;i<20;i++)g.spawnPickup({x:0,y:0,z:5},'wide');
  assert.equal(g.powerups.length,QUALITY.maxBubbles);assert.equal(g.spawnPickup({x:0,y:0,z:5},'other'),null);
});
test('wide magic changes the actual collision radius, then expires',()=>{
  const g=new AdventureGame();g.collectPickup({kind:'wide',x:0,y:0,z:10});riseToShield(g,1.82);
  assert.equal(g.state,'playing');assert.ok(g.ball.vz<0);assert.equal(g.shieldRadius,RULES.shieldRadius*1.5);
  g.effects.wide=.001;g.step(1/60);assert.equal(g.shieldRadius,RULES.shieldRadius);
});
test('slow magic changes actual speed and restores it, never just the visuals',()=>{
  const g=new AdventureGame();g.launch();const speed=()=>Math.hypot(g.ball.vx,g.ball.vy,g.ball.vz);
  const old=speed();g.collectPickup({kind:'slow',x:0,y:0,z:10});assert.ok(Math.abs(speed()/old-.72)<1e-8);
  g.effects.slow=0;g.applyEffects();assert.ok(Math.abs(speed()-old)<1e-8);
});
test('large dragon brow is finite and spans most of the well',()=>{
  assert.ok(DRAGON.silhouetteWidth/(RULES.wellRadius*2)>.88);
  assert.equal(dragonBrow(6,0,0).inside,true);assert.equal(dragonBrow(9.5,0,0).inside,false);
  for(let t=0;t<10;t++)for(let x=-8;x<9;x++)assert.ok(Number.isFinite(dragonBrow(x,1,t).z));
});
test('high profile doubles particle and target pixel allowances, not side refresh',()=>{
  assert.equal(QUALITY.particles,520*2);assert.equal(QUALITY.reflectionWidth*QUALITY.reflectionHeight,512*256*2);
  assert.equal(QUALITY.sideDesktopHz,18);assert.equal(QUALITY.sideTouchHz,14);
  const [w,h]=sideTargetSize(374,900),base=Math.min(.85,540/374,760/900);
  assert.ok(Math.abs((w*h)/(374*base*900*base)-2)<.01);
});
test('score, bubbles and manual serves do not prevent complete clearance',()=>{
  const g=new AdventureGame();
  for(let i=0;i<120*900&&g.state!=='won'&&g.state!=='lost';i++){
    if(g.held)g.launch();
    const b=g.ball,dt=b.vz>0?Math.max(0,(RULES.shieldZ-b.z)/b.vz):0;
    g.aim(b.x+b.vx*dt,b.y+b.vy*dt);g.step(1/120);g.drainEvents();
  }
  assert.equal(g.state,'won');assert.equal(g.remaining,0);assert.ok(g.score>g.total*10);
  const score=g.score;g.completeIfBroken();assert.equal(g.score,score);
});
