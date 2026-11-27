import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { restartOutline } from '../src/symbol-shapes.js';
import { composition } from '../src/composition.js';
import { installDragonSurface,dragonBrow } from '../src/dragon-shape.js';
import { AdventureGame } from '../src/gameplay.js';
import { RULES, brickPosition } from '../src/physics.js';
import { fitDragonPoint,headWeight,isFaceCore } from '../src/dragon-anatomy.js';

test('restart arrow is one non-self-intersecting continuous outline',()=>{
  const p=restartOutline(),cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  for(let i=0;i<p.length;i++)for(let j=i+2;j<p.length;j++){
    if(i===0&&j===p.length-1)continue;
    const a=p[i],b=p[(i+1)%p.length],c=p[j],d=p[(j+1)%p.length];
    assert.ok(!(cross(a,b,c)*cross(a,b,d)<-1e-10&&cross(c,d,a)*cross(c,d,b)<-1e-10),`crossed edges ${i}/${j}`);
  }
  assert.ok(p.length>80);assert.ok(p.every(v=>v.every(Number.isFinite)));
});
test('composition follows subject aspect and reduces empty primary margins',()=>{
  for(const [w,h] of [[1440,900],[844,390],[2560,1080]]){
    const c=composition(w,h);assert.equal(c.mainWidth+c.sideWidth,w);
    assert.ok(c.mainWidth<=w*.74);assert.ok(c.sideWidth>=w*.25);
    assert.ok(c.halfHeight*c.mainWidth/h>=11.95-.01);
  }
});
test('external model is bundled, hash-verified and licensed, not the generated head',()=>{
  const bytes=fs.readFileSync('assets/dragon/chinese-dragon-source.glb');
  const provenance=JSON.parse(fs.readFileSync('assets/dragon/provenance.json'));
  assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(provenance.license,'CC0-1.0');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),provenance.sha256);
  assert.equal(provenance.origin.ai_content,true);
  assert.match(fs.readFileSync('src/dragon.js','utf8'),/GLTFLoader/);
});
test('the imported brow has room under the lowered seal and the stage can be cleared',()=>{
  const file=fs.readFileSync('assets/dragon/chinese-dragon-source.glb'),len=file.readUInt32LE(12);
  const data=JSON.parse(file.toString('utf8',20,20+len)),access=data.accessors[0],view=data.bufferViews[access.bufferView];
  const start=20+len+8+(view.byteOffset||0)+(access.byteOffset||0),pos=[],weights=[];
  for(let i=0;i<access.count;i++){
    const k=start+i*(view.byteStride||12);
    const x=file.readFloatLE(k),y=file.readFloatLE(k+4),z=file.readFloatLE(k+8),p=fitDragonPoint(x,y,z);
    if(isFaceCore(x,y,z)&&Math.abs(p[0])<8.65&&Math.abs(p[1])<8.1){pos.push(...p);weights.push(headWeight(x,y,z));}
  }
  installDragonSurface(pos,weights);
  const g=new AdventureGame();
  const lowestBricks=[];
  for(let iy=0;iy<RULES.cells;iy++)for(let ix=0;ix<RULES.cells;ix++){
    if(g.occupied(ix,iy,0))lowestBricks.push(brickPosition(ix,iy,0));
  }
  const reach=RULES.brickHalf+RULES.ballRadius;
  const offsets=[-1,-2/3,-1/3,0,1/3,2/3,1].map(offset=>offset*reach);
  let clearance=Infinity;
  for(let time=0;time<=24;time+=.37){
    for(const {x,y,z} of lowestBricks)for(const dx of offsets)for(const dy of offsets){
      const brow=dragonBrow(x+dx,y+dy,time);
      clearance=Math.min(clearance,z-RULES.brickHalf-brow.z);
    }
  }
  assert.ok(clearance>=2*RULES.ballRadius && clearance<1,
    `smallest sampled passage above the sculpt is ${clearance} world units`);
  for(let i=0;i<120*1200&&g.state!=='won'&&g.state!=='lost';i++){
    if(g.held)g.launch();const b=g.ball,t=b.vz>0?Math.max(0,(RULES.shieldZ-b.z)/b.vz):0;
    g.aim(b.x+b.vx*t,b.y+b.vy*t);g.step(1/120);g.drainEvents();
  }
  assert.equal(g.state,'won');assert.equal(g.remaining,0);
});
