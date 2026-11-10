import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMERA_TILT, viewBasis, depthHeat, HEAT_STOPS, FrameMeter } from '../src/visual-math.js';
const dot = (a,b) => a.reduce((v,x,i)=>v+x*b[i],0);
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-9, `${a} != ${b}`);
test('main view is tilted 20 degrees; side is exactly orthogonal throughout orbit', () => {
  near(CAMERA_TILT*180/Math.PI,20);
  for(let t=0;t<500;t+=2.7) {
    const v=viewBasis(t);
    near(dot(v.main,v.side),0);near(dot(v.main,v.up),0);
    near(dot(v.main,v.main),1);near(dot(v.side,v.side),1);near(dot(v.up,v.up),1);
    near(v.side[2],0);near(Math.acos(v.main[2]),CAMERA_TILT);
  }
});
test('orbit is slow, periodic and honors reduced-motion',()=>{
  const a=viewBasis(0),b=viewBasis(240);
  a.main.forEach((x,i)=>near(x,b.main[i]));
  assert.deepEqual(viewBasis(125,true),viewBasis(0,true));
  assert.ok(Math.hypot(...a.main.map((x,i)=>x-viewBasis(1).main[i]))<.01);
});
test('ball heat is clamped, continuous and uses depth rather than camera angle',()=>{
  assert.deepEqual(depthHeat(-200),HEAT_STOPS[0][1]);
  depthHeat(100).forEach((v,i)=>near(v,HEAT_STOPS.at(-1)[1][i]));
  assert.ok(depthHeat(.6)[2]>depthHeat(.6)[0]);
  assert.ok(depthHeat(10.55)[0]>depthHeat(10.55)[2]);
  for(let z=.6;z<10.5;z+=.01) {
    const a=depthHeat(z), b=depthHeat(z+.01);
    assert.ok(a.every(x=>Number.isFinite(x)&&x>=0&&x<=1));
    assert.ok(a.every((x,i)=>Math.abs(x-b[i])<.01));
  }
});
test('FPS uses raw rendered timestamps and actual side passes, not capped physics dt',()=>{
  const meter=new FrameMeter();meter.record(0);
  let result;
  for(let i=1;i<=50;i++) result=meter.record(i*20,i%4===0)||result;
  near(result.fps,50);near(result.sideFps,12);near(result.ms,20);
  meter.reset();meter.record(0);
  const slow=meter.record(2000,true);
  near(slow.fps,.5);near(slow.sideFps,.5);near(slow.ms,2000);
});
test('FPS reset excludes hidden-tab or portrait intervals',()=>{
  const meter=new FrameMeter();meter.record(0);meter.record(20);
  meter.reset();assert.equal(meter.record(10000),null);
  let result;
  for(let i=1;i<=100;i++) result=meter.record(10000+i*10,false)||result;
  near(result.fps,100);near(result.sideFps,0);
});
