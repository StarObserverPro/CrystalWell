/** Browser/render checks. CI uses SwiftShader; its FPS is NOT a hardware benchmark. */
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
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
await new Promise(resolve=>server.listen(4173,'127.0.0.1',resolve));
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const errors=[],metrics={};
const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
await context.route('https://cdn.jsdelivr.net/npm/three@0.187.0/**',async route=>{
  const rel=new URL(route.request().url()).pathname.split('/three@0.187.0/')[1];
  if(!rel||rel.includes('..'))return route.abort();
  await route.fulfill({path:path.join(root,'node_modules/three',rel),contentType:'text/javascript'});
});
const page=await context.newPage();
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
// Stop queuing new GPU frames while SwiftShader captures a full-quality image.
async function shot(name) {
  await page.evaluate(()=>window.__crystalWell.suspendRendering());
  await page.evaluate(()=>window.__crystalWell.drawFrame());
  await page.screenshot({path:`artifacts/${name}.png`,timeout:120000});
  await page.evaluate(()=>window.__crystalWell.resumeRendering());
}
try{
  await page.goto('http://127.0.0.1:4173/?qa=1',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__crystalWell,{timeout:30000});
  await page.evaluate(()=>{const q=window.__crystalWell;q.reset();q.game.time=.65;q.freeze();q.refresh();});
  await page.waitForTimeout(300);await shot('desktop');
  metrics.desktop=await page.evaluate(()=>{const q=window.__crystalWell;let lines=0;q.world.scene.traverse(o=>{if(o.isLine)lines++;});return {
    draws:q.renderer.info.render.calls,triangles:q.renderer.info.render.triangles,crystals:q.world.crystals.count,
    sideCrystals:q.world.sideCrystals.count,pixelRatio:q.renderer.getPixelRatio(),fps:document.querySelector('#fps-readout').textContent,
    lives:q.game.lives,lines,score:q.hud.score.value,heldCue:q.world.heldCue.visible};});
  assert.equal(metrics.desktop.lives,3);assert.equal(metrics.desktop.lines,0);assert.equal(metrics.desktop.heldCue,true);
  assert.equal(metrics.desktop.crystals,metrics.desktop.sideCrystals);assert.equal(metrics.desktop.score,'000000');
  assert.ok(Math.abs(metrics.desktop.pixelRatio-Math.SQRT2)<1e-9);assert.match(metrics.desktop.fps,/\d+ FPS/);
  assert.equal(await page.locator('svg').count(),0);
  // All on-screen HUD artwork is geometry. HTML buttons supply only accessible hit areas.
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('button')].every(b=>b.children.length===0&&getComputedStyle(b).borderWidth==='0px')),true);
  assert.equal(await page.evaluate(()=>{const q=window.__crystalWell,V=q.topCamera.position.constructor;
    for(let i=0;i<128;i++){const a=i*Math.PI*2/128,p=new V(Math.cos(a)*11.65,Math.sin(a)*11.65,11.7).project(q.topCamera);if(Math.abs(p.x)>.98||Math.abs(p.y)>.98)return false;}return true;}),true,'Expanded coping fits main view');
  // Screen-space aiming after substantial orbit.
  const xy=await page.evaluate(()=>{const q=window.__crystalWell;q.game.time=68;q.refresh();const V=q.topCamera.position.constructor,p=new V(2,-3,10.55).project(q.topCamera),r=document.querySelector('#main-panel').getBoundingClientRect();return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};});
  await page.mouse.move(xy.x,xy.y);const aim=await page.evaluate(()=>window.__crystalWell.game.shield);
  assert.ok(Math.abs(aim.targetX-2)<.025&&Math.abs(aim.targetY+3)<.025);
  // Pausing cannot launch or move the shield. Repeated Esc keydown must not toggle twice.
  await page.evaluate(()=>window.__crystalWell.unfreeze());
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__crystalWell.paused),true);
  const frozen=await page.evaluate(()=>({time:window.__crystalWell.game.time,score:window.__crystalWell.game.score}));
  await page.keyboard.press('Space');await page.waitForTimeout(180);
  assert.equal(await page.evaluate(()=>window.__crystalWell.game.state),'ready');
  assert.equal(await page.evaluate(()=>window.__crystalWell.game.time),frozen.time);
  await shot('paused');
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__crystalWell.paused),false);
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
  await page.evaluate(()=>{const q=window.__crystalWell;q.game.time=240.65;q.game.heldSince=240.2;q.refresh();});
  await shot('dragon-front');
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
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.evaluate(()=>{const h=window.__crystalWell.hud;return h.scoreGroup.position.x<200 &&
    h.fpsGroup.scale.x>=1 && parseFloat(document.querySelector('#pause').style.width)>=44;}),true,'Mobile score clears the rim and touch targets stay large');
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
  await shot('portrait');
  assert.equal(await page.evaluate(()=>window.__crystalWell.hud.portrait.visible),true);
  assert.equal(await page.evaluate(()=>window.__crystalWell.hud.content.visible),false);
  assert.deepEqual(errors,[],'Browser/shader errors');
}catch(error){
  metrics.failure=String(error);
  throw error;
}finally{
  await fs.writeFile('artifacts/browser-report.json',JSON.stringify({metrics,errors},null,2));
  await browser.close();server.close();
}
