/** Run in CI: npm install --no-save three@0.187.0 @playwright/test@1.56.1 */
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
const root=process.cwd();
await fs.mkdir('artifacts',{recursive:true});
const mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const filename=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try { res.setHeader('content-type',mime[path.extname(filename)]||'application/octet-stream');res.end(await fs.readFile(filename)); }
  catch { res.writeHead(404).end(); }
});
await new Promise(resolve=>server.listen(4173,'127.0.0.1',resolve));
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const errors=[];const metrics={};
const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
// Test exactly the pinned production library without depending on CDN availability.
await context.route('https://cdn.jsdelivr.net/npm/three@0.187.0/**',async route=>{
  const rel=new URL(route.request().url()).pathname.split('/three@0.187.0/')[1];
  if(!rel||rel.includes('..')) return route.abort();
  await route.fulfill({path:path.join(root,'node_modules/three',rel),contentType:'text/javascript'});
});
const page=await context.newPage();
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
try {
  await page.goto('http://127.0.0.1:4173/?qa=1',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__crystalWell,{timeout:30000});
  await page.evaluate(()=>{const q=window.__crystalWell;q.reset();q.pause();q.refresh();});
  await page.waitForTimeout(1800);
  await page.screenshot({path:'artifacts/desktop.png'});
  metrics.desktop=await page.evaluate(()=>{
    const q=window.__crystalWell;
    return {fps:document.querySelector('#fps-readout').textContent,draws:q.renderer.info.render.calls,
      triangles:q.renderer.info.render.triangles,crystals:q.world.crystals.count,sideCrystals:q.world.sideCrystals.count};
  });
  assert.ok(metrics.desktop.crystals>1800);
  assert.equal(metrics.desktop.sideCrystals,metrics.desktop.crystals);
  assert.match(metrics.desktop.fps,/\d+ FPS/);
  // Check screen-space control after the camera has rotated substantially.
  const xy=await page.evaluate(()=>{
    const q=window.__crystalWell;q.game.time=68;q.refresh();
    const V=q.topCamera.position.constructor;
    const p=new V(2,-3,10.55).project(q.topCamera);
    const r=document.querySelector('#main-panel').getBoundingClientRect();
    return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};
  });
  await page.mouse.move(xy.x,xy.y);
  const aim=await page.evaluate(()=>window.__crystalWell.game.shield);
  assert.ok(Math.abs(aim.targetX-2)<.025&&Math.abs(aim.targetY+3)<.025,JSON.stringify(aim));
  // A deep ball must stay at its true 3D position in both views.
  metrics.deep=await page.evaluate(()=>{
    const q=window.__crystalWell;q.game.ball.z=2;q.game.ball.x=1;q.game.ball.y=-2;q.refresh();
    const a=q.topCamera.position.clone().sub(new q.topCamera.position.constructor(0,0,5.3)).normalize();
    const b=q.sideCamera.position.clone().sub(new q.topCamera.position.constructor(0,0,5.3)).normalize();
    return {dot:a.dot(b),ghostZ:q.world.ghost.position.z,ballZ:q.world.ball.position.z,
      ballColor:q.world.ballHalo.material.color.toArray()};
  });
  assert.ok(Math.abs(metrics.deep.dot)<1e-8);assert.equal(metrics.deep.ghostZ,metrics.deep.ballZ);
  assert.ok(metrics.deep.ballColor[2]>metrics.deep.ballColor[0]);
  await page.waitForTimeout(250);await page.screenshot({path:'artifacts/rotated-deep.png'});
  // The frame loop and game simulation also work while playing.
  await page.evaluate(()=>{const q=window.__crystalWell;q.reset();q.game.launch();q.resume();});
  await page.waitForTimeout(1400);await page.screenshot({path:'artifacts/playing.png'});
  await page.setViewportSize({width:844,height:390});
  await page.evaluate(()=>{window.__crystalWell.reset();window.__crystalWell.pause();});
  await page.waitForTimeout(800);await page.screenshot({path:'artifacts/landscape.png'});
  metrics.landscape=await page.evaluate(()=>({
    overflow:document.documentElement.scrollWidth>innerWidth,
    gate:getComputedStyle(document.querySelector('.portrait-gate')).display,
  }));
  assert.equal(metrics.landscape.overflow,false);assert.equal(metrics.landscape.gate,'none');
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);
  await page.screenshot({path:'artifacts/portrait.png'});
  assert.notEqual(await page.locator('.portrait-gate').evaluate(e=>getComputedStyle(e).display),'none');
  assert.deepEqual(errors,[],'Browser or shader errors');
} finally {
  await fs.writeFile('artifacts/browser-report.json',JSON.stringify({metrics,errors},null,2));
  await browser.close();server.close();
}
