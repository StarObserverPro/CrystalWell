/** Browser/render checks. CI uses SwiftShader; its FPS is NOT a hardware benchmark. */
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { checkTouchPad } from './touch-pad-browser.mjs';
import { RULES, brickPosition } from '../src/physics.js';
const root=process.cwd();
await fs.mkdir('artifacts/renderer-deps',{recursive:true});
for(const file of ['three.module.js','three.core.js']) await fs.copyFile(path.join(root,'node_modules/three/build',file),path.join('artifacts/renderer-deps',file));
await fs.copyFile(path.join(root,'node_modules/three/LICENSE'),'artifacts/renderer-deps/LICENSE');
const mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const filename=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{res.setHeader('content-type',mime[path.extname(filename)]||'application/octet-stream');res.end(await fs.readFile(filename));}
  catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const gameUrl=`http://127.0.0.1:${server.address().port}/?qa=1&staticQA=1`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const errors=[],metrics={};
const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
const serveThree=async route=>{
  const rel=new URL(route.request().url()).pathname.split('/three@0.187.0/')[1];
  if(!rel||rel.includes('..'))return route.abort();
  await route.fulfill({path:path.join(root,'node_modules/three',rel),contentType:'text/javascript'});
};
const threeUrl='https://cdn.jsdelivr.net/npm/three@0.187.0/**';
await context.route(threeUrl,serveThree);
const page=await context.newPage();
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
// Stop queuing new GPU frames while SwiftShader captures a full-quality image.
async function shot(name) {
  await page.evaluate(()=>window.__crystalWell.suspendRendering());
  await page.evaluate(()=>window.__crystalWell.drawFrame());
  await page.screenshot({path:`artifacts/${name}.png`,timeout:120000});
}

async function mainBallPixels(z) {
  return page.evaluate(z => {
    const q=window.__crystalWell,{game,world,renderer,topCamera}=q;
    const radius=game.ball.radius;
    game.state='playing';
    game.time=.7;
    Object.assign(game.ball,{x:1.2,y:1.4,z,vx:0,vy:0,vz:-7.4});
    q.refresh();
    const projected=world.ball.position.clone().project(topCamera);
    const mainWidth=document.querySelector('#main-panel').getBoundingClientRect().width;
    const dpr=renderer.getPixelRatio(), gl=renderer.getContext();
    const x=Math.round((projected.x+1)*mainWidth*dpr/2);
    const y=Math.round((projected.y+1)*innerHeight*dpr/2);
    const halfWidth=Math.ceil(18*dpr), span=halfWidth*2+1;
    const row=()=>{
      const pixels=new Uint8Array(span*4);
      gl.readPixels(x-halfWidth,y,span,1,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      return pixels;
    };
    q.drawFrame();
    const visible=row();
    world.ghost.visible=false;
    world.ball.visible=false;
    world.ballHalo.visible=false;
    q.drawFrame();
    const hidden=row();
    world.ghost.visible=true;
    world.ball.visible=true;
    world.ballHalo.visible=true;
    const center=halfWidth*4;
    const differs=i=>[0,1,2].reduce((sum,k)=>sum+Math.abs(visible[i*4+k]-hidden[i*4+k]),0)>80;
    let left=halfWidth,right=halfWidth;
    while(left>0 && differs(left-1))left--;
    while(right<span-1 && differs(right+1))right++;
    return {z,diameter:(right-left+1)/dpr,rgb:[...visible.slice(center,center+3)],
      radius,mainLayerOnly:!world.ball.layers.test(topCamera.layers)&&world.ghost.layers.test(topCamera.layers),
      overlayMeshes:world.ghost.children.filter(o=>o.isMesh).map(o=>o.geometry.type),
      atPhysicalPosition:world.ghost.position.equals(world.ball.position)};
  },z);
}

try{
  await page.goto(gameUrl,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__crystalWell?.assetsReady,{timeout:60000});
  await page.evaluate(()=>{const q=window.__crystalWell;q.reset();q.game.time=.65;q.freeze();q.refresh();});
  await page.waitForTimeout(300);await shot('desktop');
  metrics.desktop=await page.evaluate(()=>{const q=window.__crystalWell;let lines=0;q.world.scene.traverse(o=>{if(o.isLine)lines++;});return {
    draws:q.renderer.info.render.calls,triangles:q.renderer.info.render.triangles,crystals:q.world.crystals.count,
    sideCrystals:q.world.sideCrystals.count,pixelRatio:q.renderer.getPixelRatio(),fps:document.querySelector('#fps-readout').textContent,
    lives:q.game.lives,lines,score:q.hud.score.value,heldCue:q.world.heldCue.visible};});
  assert.equal(await page.evaluate(()=>window.__crystalWell.world.rim.children.length),10);
  assert.equal(await page.evaluate(()=>window.__crystalWell.world.dragon.userData.ready),true);
  assert.match(await page.evaluate(()=>window.__crystalWell.world.dragon.userData.source),/Grab3D/);
  assert.equal(metrics.desktop.lives,3);assert.equal(metrics.desktop.lines,0);assert.equal(metrics.desktop.heldCue,true);
  assert.equal(metrics.desktop.crystals,metrics.desktop.sideCrystals);assert.equal(metrics.desktop.score,'000000');
  assert.ok(Math.abs(metrics.desktop.pixelRatio-Math.SQRT2)<1e-9);assert.match(metrics.desktop.fps,/\d+ FPS/);
  assert.equal(await page.locator('svg').count(),0);
  // All on-screen HUD artwork is geometry. HTML buttons supply only accessible hit areas.
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('button')].every(b=>b.children.length===0&&getComputedStyle(b).borderWidth==='0px')),true);
  assert.equal(await page.evaluate(()=>{const q=window.__crystalWell,V=q.topCamera.position.constructor;
    for(let i=0;i<128;i++){const a=i*Math.PI*2/128,p=new V(Math.cos(a)*11.65,Math.sin(a)*11.65,11.7).project(q.topCamera);if(Math.abs(p.x)>.98||Math.abs(p.y)>.98)return false;}return true;}),true,'Expanded coping fits main view');
  metrics.optimization=await page.evaluate(()=>{const q=__crystalWell;let transmitting=0;
    q.world.scene.traverse(o=>{if(o.isMesh&&(o.material?.transmission||0)>0)transmitting++;});
    return {transmitting,hasRefraction:!!q.refraction,visible:q.world.crystals.count,logical:q.game.remaining,
      seaRadius:q.world.sea.mesh.userData.visualRadius,collisionRadius:q.world.sea.mesh.userData.collisionRadius,
      matte:q.world.dragon.userData.model.children.every(o=>o.material.userData.matteBody)};});
  assert.equal(metrics.optimization.transmitting,0,'No hidden transmission prepass');
  assert.equal(metrics.optimization.hasRefraction,false,'No refraction target, sampler or capture');
  assert.ok(metrics.optimization.visible<metrics.optimization.logical,'Buried crystals do not consume drawing budget');
  assert.ok(metrics.optimization.seaRadius>200);assert.equal(metrics.optimization.collisionRadius,9.72);
  assert.equal(metrics.optimization.matte,true);
  metrics.surfaceCache=await page.evaluate(()=>{
    const q=window.__crystalWell,{world,game}=q;
    const occupied=game.occupied;
    let reads=0;
    game.occupied=function(...coords){reads++;return occupied.apply(this,coords);};
    const prepareBoth=now=>{
      world.prepareView(q.topCamera,false,now);
      world.prepareView(q.sideCamera,true,now);
    };
    try {
      q.game.time=60;q.refresh();prepareBoth(performance.now()+500);
      const orbitReads=reads;
      const visible=new Set(world.exposedCrystals().map(brick=>brick.id));
      const buried=world.records.find(brick=>!visible.has(brick.id));
      const neighbor=game.index(buried.ix,buried.iy,buried.k+1);
      game.grid[neighbor]=0;game.remaining--;world.removeCrystals([neighbor]);
      prepareBoth(performance.now()+501);
      return {orbitReads,afterBreakReads:reads-orbitReads,openTop:buried.openPositive.z,
        exposedInBoth:[world.crystals,world.sideCrystals].every(mesh=>mesh.userData.order.includes(buried))};
    }finally{game.occupied=occupied;q.reset();q.freeze();q.refresh();}
  });
  assert.equal(metrics.surfaceCache.orbitReads,0);
  assert.ok(metrics.surfaceCache.afterBreakReads>0);
  assert.equal(metrics.surfaceCache.openTop,1);
  assert.equal(metrics.surfaceCache.exposedInBoth,true);
  metrics.ballDepth=await page.evaluate(()=>{const q=window.__crystalWell,g=q.game;const radius=g.ball.radius;
    g.state='playing';g.ball.z=-8;q.refresh();const far=q.world.ball.scale.x;
    g.ball.z=10;q.refresh();const near=q.world.ball.scale.x;
    return {far,near,radius,unchanged:g.ball.radius===radius,halo:q.world.ballHalo.scale.x,ghost:q.world.ghost.scale.x};});
  assert.ok(metrics.ballDepth.near/metrics.ballDepth.far>1.45);assert.equal(metrics.ballDepth.unchanged,true);
  await page.evaluate(()=>{const q=window.__crystalWell;q.reset();q.freeze();q.game.time=2.4;q.refresh();});
  // Screen-space aiming after substantial orbit.
  const xy=await page.evaluate(()=>{const q=window.__crystalWell;q.game.time=68;q.refresh();const V=q.topCamera.position.constructor,p=new V(2,-3,10.55).project(q.topCamera),r=document.querySelector('#main-panel').getBoundingClientRect();return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};});
  await page.mouse.move(xy.x,xy.y);const aim=await page.evaluate(()=>window.__crystalWell.game.shield);
  assert.ok(Math.abs(aim.targetX-2)<.025&&Math.abs(aim.targetY+3)<.025);
  // Pausing cannot launch or move the shield. Repeated Esc keydown must not toggle twice.
  await page.evaluate(()=>{window.__crystalWell.unfreeze();window.__crystalWell.resumeRendering();});
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__crystalWell.paused),true);
  const frozen=await page.evaluate(()=>({time:window.__crystalWell.game.time,score:window.__crystalWell.game.score}));
  await page.keyboard.press('Space');await page.waitForTimeout(180);
  assert.equal(await page.evaluate(()=>window.__crystalWell.game.state),'ready');
  assert.equal(await page.evaluate(()=>window.__crystalWell.game.time),frozen.time);
  await shot('paused');
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__crystalWell.paused),false);
  await page.evaluate(()=>window.__crystalWell.suspendRendering());
  await page.evaluate(()=>window.__crystalWell.freeze());
  // HUD interaction must not be mistaken for shield input or a launch.
  await page.locator('#sound').click();assert.equal(await page.evaluate(()=>window.__crystalWell.game.state),'ready');
  await page.locator('#sound').focus();await page.keyboard.press('Space');
  assert.equal(await page.evaluate(()=>window.__crystalWell.game.state),'ready','Space on a focused HUD button cannot shoot');
  await page.locator('#sound').evaluate(el=>el.blur());
  await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>window.__crystalWell.game.state),'playing');
  // Force a bind catch through the real physics path, then inspect its visual state.
  metrics.capture=await page.evaluate(()=>{const q=window.__crystalWell,g=q.game;
    g.grid.fill(0);q.world.removeCrystals(q.world.records.map(r=>r.id));g.effects.bind=2;g.state='playing';
    Object.assign(g.shield,{x:0,y:-3,targetX:0,targetY:-3});Object.assign(g.ball,{x:0,y:-3,z:10.18,vx:0,vy:0,vz:7.4});
    g.step(1/60);g.time+=.45;q.refresh();return {state:g.state,reason:g.readyReason,charges:g.effects.bind,cue:q.world.heldCue.visible,launchGlyph:q.world.launchGlyph.visible};});
  assert.equal(metrics.capture.reason,'capture');assert.equal(metrics.capture.cue,true);assert.equal(metrics.capture.launchGlyph,true);
  await page.waitForTimeout(150);await shot('dragon-held');
  metrics.heldViews=[];
  // Advance beyond the capture timestamp; do not reverse the impact animation clock.
  for (const time of [240,300,360,420]) {
    const reading=await page.evaluate(time=>{
      const q=window.__crystalWell;q.game.time=time;q.refresh();q.drawFrame();
      const V=q.topCamera.position.constructor,p=q.world.heldCore.getWorldPosition(new V()).project(q.topCamera);
      const ratio=q.renderer.getPixelRatio(),w=document.querySelector('#main-panel').getBoundingClientRect().width;
      const x=Math.round((p.x+1)*w*.5*ratio),y=Math.round((p.y+1)*innerHeight*.5*ratio),rgba=new Uint8Array(4);
      const gl=q.renderer.getContext();gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
      return {time,rgba:[...rgba],above:q.world.heldCue.position.z>0,visible:q.world.heldCue.visible};
    },time);
    metrics.heldViews.push(reading);assert.equal(reading.above&&reading.visible,true);
    assert.ok(reading.rgba[0]>reading.rgba[1]+10&&reading.rgba[2]>reading.rgba[1]+10,'purple held beacon remains readable through the shield');
    if(time===360)await shot('held-back');
  }
  await page.evaluate(()=>{const q=window.__crystalWell;q.game.time=240.65;q.game.heldSince=240.2;q.refresh();});
  await shot('dragon-front');
  metrics.head=await page.evaluate(()=>{const q=window.__crystalWell;q.game.time=241;q.refresh();const a=[...q.world.dragon.userData.motion.value.elements];q.game.time=242.7;q.refresh();return {a,b:[...q.world.dragon.userData.motion.value.elements],sea:q.world.sea.mesh.visible};});
  assert.notDeepEqual(metrics.head.a,metrics.head.b);assert.equal(metrics.head.sea,true);
  await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>window.__crystalWell.game.state),'playing');
  // A capture arriving during an existing drag must not launch when that drag ends.
  await page.mouse.move(400,450);await page.mouse.down();
  await page.evaluate(()=>{const q=window.__crystalWell;q.game.state='ready';q.game.readyReason='capture';q.game.heldSince+=1;q.refresh();});
  await page.mouse.up();assert.equal(await page.evaluate(()=>window.__crystalWell.game.state),'ready');
  await page.keyboard.press('Space');
  // Rising pickup models have distinctive solids inside their translucent spheres.
  await page.evaluate(()=>{const q=window.__crystalWell,g=q.game;g.score=12340;g.multiplier=3;
    ['wide','slow','bind','treasure'].forEach((kind,i)=>g.spawnPickup({x:-4.5+i*3,y:-4,z:6.5+i*.65},kind));q.refresh();});
  await page.waitForTimeout(200);await shot('bubbles');
  // Miss -> empty shield -> new manual serve, not an unexplained recapture.
  metrics.respawn=await page.evaluate(()=>{const q=window.__crystalWell,g=q.game;g.loseBall();q.refresh();
    const missing={state:g.state,visible:q.world.ball.visible,lives:g.lives};for(let i=0;i<120;i++)g.step(1/120);q.refresh();
    return {missing,ready:g.state,reason:g.readyReason,visible:q.world.ball.visible};});
  assert.equal(metrics.respawn.missing.visible,false);assert.equal(metrics.respawn.reason,'serve');assert.equal(metrics.respawn.missing.lives,2);
  // Winning must actually show the dragon animation before the restart modal.
  await page.evaluate(()=>{const q=window.__crystalWell;q.game.state='won';q.game.wonAt=q.game.time;q.refresh();});
  assert.equal(await page.evaluate(()=>window.__crystalWell.hud.modal.visible),false);
  await page.evaluate(()=>{const q=window.__crystalWell;q.game.time+=3;q.world.update(0,q.game.time,.5);q.refresh();q.world.update(0,q.game.time,.5);});
  await page.waitForTimeout(150);await shot('dragon-rising');
  // Restore the full brick field for mobile composition checks.
  await page.setViewportSize({width:844,height:390});
  await page.evaluate(()=>{const q=window.__crystalWell;q.reset();q.game.time=.7;q.freeze();q.refresh();});
  await page.waitForTimeout(350);await shot('landscape');
  assert.equal(await page.evaluate(()=>{const q=__crystalWell,V=q.sideCamera.position.constructor;
    for(let i=0;i<128;i++){const a=i*Math.PI*2/128,p=new V(Math.cos(a)*11.9,Math.sin(a)*11.9,12.05).project(q.sideCamera);if(Math.abs(p.x)>.98||Math.abs(p.y)>.98)return false;}return true;}),true,'Full near-side rim stays inside the mobile secondary view');
  metrics.crystalSpacing=await page.evaluate(()=>{
    const q=window.__crystalWell,{topCamera,sideCamera,world,game}=q;
    const vertex=sideCamera.position.clone();
    const geometry=world.sideCrystals.geometry;
    geometry.computeBoundingBox();
    const {min,max}=geometry.boundingBox;
    const corners=world.records.flatMap(({p})=>
      [min.x,max.x].flatMap(dx=>[min.y,max.y].flatMap(dy=>[min.z,max.z].map(dz=>[p.x+dx,p.y+dy,p.z+dz]))));
    let maxMainExtent=0,minSideGap=Infinity;
    for(let time=0;time<240;time+=20){
      game.time=time;q.refresh();
      let sealTop=-Infinity,lipBottom=Infinity;
      for(const [x,y,z] of corners){
        vertex.set(x,y,z).project(topCamera);
        maxMainExtent=Math.max(maxMainExtent,Math.abs(vertex.x),Math.abs(vertex.y));
        sealTop=Math.max(sealTop,vertex.set(x,y,z).project(sideCamera).y);
      }
      for(const segment of world.rim.children){
        const positions=segment.geometry.attributes.position;
        for(let i=0;i<positions.count;i++){
          const y=vertex.fromBufferAttribute(positions,i).applyMatrix4(segment.matrixWorld).project(sideCamera).y;
          lipBottom=Math.min(lipBottom,y);
        }
      }
      // Even a shield at the farthest reachable edge must clear the top tier in projection.
      sideCamera.getWorldDirection(vertex).multiplyScalar(game.shieldTravelRadius+game.shieldRadius);
      vertex.z=world.shield.position.z-.23;
      const shieldBottom=vertex.project(sideCamera).y;
      minSideGap=Math.min(minSideGap,(Math.min(lipBottom,shieldBottom)-sealTop)*innerHeight/2);
    }
    return {maxMainExtent,minSideGap};
  });
  assert.ok(metrics.crystalSpacing.maxMainExtent<.985,'the lowered crystals fit inside the rotating main view');
  assert.ok(metrics.crystalSpacing.minSideGap>=27,
    `the mobile side view needs clear air above the seal, measured ${metrics.crystalSpacing.minSideGap}px`);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.evaluate(()=>{const q=window.__crystalWell;return Math.abs(q.sideTarget.width/q.sideTarget.height-(innerWidth-document.querySelector('#main-panel').getBoundingClientRect().width)/innerHeight)<.01;}),true,'Mobile side scene uses full height beneath the HUD');
  assert.equal(await page.evaluate(()=>{const h=window.__crystalWell.hud;return h.scoreGroup.position.x<200 &&
    h.fpsGroup.scale.x>=1 && parseFloat(document.querySelector('#pause').style.width)>=44;}),true,'Mobile score clears the rim and touch targets stay large');
  const topCrystal = brickPosition(0,0,RULES.levels-1).z+RULES.brickHalf;
  metrics.mainBall={};
  for(const [name,z] of [['mouth',RULES.shieldZ-RULES.ballRadius],['seal',topCrystal+RULES.ballRadius],['dragon',-3.1]]) {
    const sample=metrics.mainBall[name]=await mainBallPixels(z);
    assert.equal(sample.radius,RULES.ballRadius);
    assert.equal(sample.atPhysicalPosition,true);
    assert.equal(sample.mainLayerOnly,true);
    assert.deepEqual(sample.overlayMeshes,['IcosahedronGeometry'],'a single sphere, with no dark ring');
    await shot(`ball-${name}`);
  }
  const {mouth,seal,dragon}=metrics.mainBall;
  assert.ok(mouth.diameter>=19 && mouth.diameter/seal.diameter>=1.42 &&
    mouth.diameter/dragon.diameter>=2.4 && dragon.diameter>=7,
    `Readably different flight sizes in the main view: ${JSON.stringify(metrics.mainBall)}`);
  assert.ok(mouth.rgb[0]-mouth.rgb[1]>85 && mouth.rgb[0]-mouth.rgb[2]>100, 'orange-red at the opening');
  assert.ok(seal.rgb[1]-seal.rgb[0]>100 && seal.rgb[1]-seal.rgb[2]>45, 'green at the first crystal bounce');
  assert.ok(dragon.rgb[2]-dragon.rgb[0]>95 && dragon.rgb[2]-dragon.rgb[1]>95, 'blue-violet at the dragon');
  await page.evaluate(()=>{const q=window.__crystalWell;q.reset();q.freeze();q.refresh();});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
  await shot('portrait');
  assert.equal(await page.evaluate(()=>window.__crystalWell.hud.portrait.visible),true);
  assert.equal(await page.evaluate(()=>window.__crystalWell.hud.content.visible),false);
  await context.close();
  metrics.touchPad=await checkTouchPad(browser,gameUrl,threeUrl,serveThree,errors);
  assert.deepEqual(errors,[],'Browser/shader errors');
}catch(error){
  metrics.failure=String(error);
  throw error;
}finally{
  await fs.writeFile('artifacts/browser-report.json',JSON.stringify({metrics,errors},null,2));
  await browser.close();server.close();
}
