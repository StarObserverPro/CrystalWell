import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {EAR_NOD,EAR_AXIS,EAR_PIVOT,nodAroundEars} from '../src/dragon-anatomy.js';
import {BARRIER,barrierSurface} from '../src/barrier-math.js';

test('30 degree nod is about the across-ear axis, not a screen-axis guess',()=>{
  assert.ok(Math.abs(EAR_NOD-Math.PI/6)<1e-10);
  const p=EAR_PIVOT,a=EAR_AXIS;
  const earA=p.map((n,i)=>n+a[i]*3),earB=p.map((n,i)=>n-a[i]*3);
  for(const e of [earA,earB])assert.ok(nodAroundEars(e).every((n,i)=>Math.abs(n-e[i])<1e-10));
  const nose=[-4.78827256,-1.72615570,-2.43702603],lower=nodAroundEars(nose);
  assert.ok(lower[2]<nose[2]-3,'nose drops towards the barrier');
  assert.deepEqual(nodAroundEars(nose,0),nose);
});
test('expanding the visible sea never expands the playable collision disk',()=>{
  assert.ok(BARRIER.visualRadius>=256);assert.equal(BARRIER.radius,9.72);
  assert.equal(barrierSurface(0,0,0).collidable,true);
  assert.equal(barrierSurface(10,0,0).collidable,false);
  assert.equal(barrierSurface(90,90,0).collidable,false);
});
test('the complete expensive refraction capture path has been removed',()=>{
  assert.equal(fs.existsSync('src/refraction.js'),false);
  assert.equal(fs.existsSync('src/optics-rules.js'),false);
  const main=fs.readFileSync('src/main.js','utf8');
  assert.doesNotMatch(main,/LimitedRefraction|refraction\.capture|transmissionResolutionScale/);
  const gem=fs.readFileSync('src/gem-optics.js','utf8');
  assert.doesNotMatch(gem,/cwPrism|bounce<3|transmission\s*:/);
  const field=fs.readFileSync('src/crystal-material.js','utf8');
  assert.doesNotMatch(field,/uBackground|uRefraction|aOpticalTier/);
});
test('matte dragon keeps separate eye roughness without enabling transmission',()=>{
  const src=fs.readFileSync('src/dragon.js','utf8');
  assert.match(src,/MeshStandardMaterial/);assert.match(src,/roughness:\.90/);
  assert.match(src,/roughnessFactor=mix\(\.90,\.095,cwEyeMask\(\)\)/);
  assert.doesNotMatch(src,/transmission\s*:|clearcoat\s*:/);
});
