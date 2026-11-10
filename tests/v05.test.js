import test from 'node:test';
import assert from 'node:assert/strict';
import {DRAGON_FIT,MODEL_SCALE,HEAD_WIDEN,fitDragonPoint,headAngles,headRotation,moveHeadPoint,NECK_PIVOT} from '../src/dragon-anatomy.js';
import {BARRIER,barrierSurface} from '../src/barrier-math.js';
import {ballDepthScale} from '../src/visual-math.js';
import {sideViewDistance} from '../src/composition.js';
import {REFRACTION,refractionSize} from '../src/optics-rules.js';
import {CrystalWellGame,RULES} from '../src/physics.js';

test('cranial fit excludes the ornament envelope and treats 1.75 as an art parameter',()=>{
  assert.equal(DRAGON_FIT.headToBody,1.75);
  assert.ok(Math.abs(MODEL_SCALE*HEAD_WIDEN*DRAGON_FIT.sourceSkullWidth-DRAGON_FIT.coreWidth)<1e-8);
  assert.ok(DRAGON_FIT.coreWidth/DRAGON_FIT.wellDiameter>.78&&DRAGON_FIT.coreWidth/DRAGON_FIT.wellDiameter<.83);
  assert.ok(DRAGON_FIT.sourceSkullWidth<3.277/2);
});
test('head rotation is bounded and orthonormal; the neck hinge stays fixed',()=>{
  for(let t=0;t<40;t+=.37){
    const a=headAngles(t),m=headRotation(t);assert.ok(Math.abs(a.pitch)<=.032&&Math.abs(a.yaw)<=.049);
    for(let i=0;i<3;i++)for(let j=0;j<3;j++){let d=0;for(let k=0;k<3;k++)d+=m[i*3+k]*m[j*3+k];assert.ok(Math.abs(d-(i===j?1:0))<1e-12);}
    assert.deepEqual(moveHeadPoint(...NECK_PIVOT,1,m),NECK_PIVOT);
    const p=fitDragonPoint(.3,4.3,2.6);assert.deepEqual(moveHeadPoint(...p,0,m),p);
  }
});
test('magical sea is a horizontal bounded wave field with matching analytic normals',()=>{
  for(let t=0;t<10;t+=.7)for(let x=-9;x<=9;x+=3){
    const h=barrierSurface(x,2,t),e=.00001,dx=(barrierSurface(x+e,2,t).z-barrierSurface(x-e,2,t).z)/(2*e);
    assert.ok(Math.abs(h.z-BARRIER.z)<=.511);assert.ok(Math.abs(-h.nx/h.nz-dx)<1e-8);assert.ok(h.nz>.94);
  }
});
test('edge misses at the bottom bounce off the sea, not an invisible flat floor',()=>{
  const g=new CrystalWellGame();g.state='playing';g.grid.fill(0);
  const b=g.ball,s=barrierSurface(9,0,g.time+1/120);
  Object.assign(b,{x:9,y:0,z:s.z+RULES.ballRadius+.002,vx:0,vy:0,vz:-7.4});g.step(1/120);
  assert.ok(b.vz>0);assert.ok(g.drainEvents().some(e=>e.type==='barrier'));
});
test('ball size grows towards the opening continuously without changing collision dimensions',()=>{
  const radius=RULES.ballRadius;
  assert.equal(ballDepthScale(100),1.30);assert.ok(ballDepthScale(-100)>.81&&ballDepthScale(-100)<.83);
  let last=0;for(let z=-20;z<=20;z+=.01){const size=ballDepthScale(z);assert.ok(size>=last-1e-12);last=size;}
  assert.equal(RULES.ballRadius,radius);
});
test('refraction resolution, update rate and brick count have explicit upper bounds',()=>{
  assert.equal(REFRACTION.maxBricks,384);assert.equal(REFRACTION.hz,30);
  for(const [w,h,d] of [[954,900,1.414],[490,390,1.91],[4000,2000,3]]){
    const [a,b]=refractionSize(w,h,d);assert.ok(a<=720&&b<=720);assert.ok(a*b<w*h*d*d*.27);
    assert.ok(Math.abs(a/b-w/h)<.015);
  }
});

test('side view fits the near elevated lip even in short landscape viewports',()=>{
  for(const aspect of [.45,.60,.90,1.5]){
    const d=sideViewDistance(aspect),tan=Math.tan(21*Math.PI/180);
    for(let i=0;i<256;i++){
      const a=i*Math.PI*2/256,x=12.1*Math.cos(a),forward=12.1*Math.sin(a),depth=d-forward;
      assert.ok(Math.abs(x/(depth*tan*aspect))<.95);
      assert.ok((12.2-.3)/(depth*tan)<.95);
    }
  }
});
