import assert from 'node:assert/strict';

export async function checkTouchPad(browser, url, threeUrl, serveThree, errors) {
  const phone = await browser.newContext({viewport:{width:844,height:390}, deviceScaleFactor:2,
    hasTouch:true, isMobile:true});
  await phone.route(threeUrl, serveThree);
  const page = await phone.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const cdp = await phone.newCDPSession(page);
  const touch = (type, points = []) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints:points});
  const state = () => page.evaluate(() => window.__crystalWell.game.state);
  const target = () => page.evaluate(() => {
    const {targetX,targetY} = window.__crystalWell.game.shield;
    return [targetX,targetY];
  });
  try {
    await page.goto(url, {waitUntil:'networkidle'});
    await page.waitForFunction(() => window.__crystalWell?.assetsReady, null, {timeout:60000});
    await page.evaluate(() => {
      const q=window.__crystalWell;q.freeze();q.game.time=.7;q.refresh();
    });
    const pad = page.locator('#shield-pad');
    const rect = await pad.boundingBox();
    const main = await page.locator('#main-panel').boundingBox();
    assert.ok(rect && rect.x > main.x+main.width && Math.abs(rect.width-rect.height)<1);
    const point = (x,y,id=1) => ({id, x:rect.x+(1+x)*rect.width/2, y:rect.y+(1-y)*rect.height/2});
    const start = await target();
    await page.touchscreen.tap(main.width/2, main.height/2);
    await page.touchscreen.tap(main.width+12, main.height/2);
    assert.deepEqual(await target(),start,'touches on the two views leave aim alone');
    assert.equal(await state(),'ready');

    // Recover the two screen coordinates from the actual left camera projection.
    const samples=[];
    async function checkPosition(x,y) {
      const sample=await page.evaluate(() => {
        const q=window.__crystalWell, g=q.game, cam=q.topCamera;
        for(let i=0;i<120;i++)g.moveShield(1/120);
        q.refresh();
        const vector=cam.position.clone(), z=q.world.shield.position.z;
        const center=vector.set(0,0,z).project(cam).clone();
        const drawn=q.world.shield.position.clone().project(cam).sub(center);
        const radius=g.shieldTravelRadius, tilt=Math.abs(cam.getWorldDirection(vector).z);
        return {x:drawn.x*(cam.right-cam.left)/(2*radius),y:drawn.y*(cam.top-cam.bottom)/(2*radius*tilt),
          cursor:q.hud.shieldPad.cursor.position.toArray().slice(0,2),radius};
      });
      assert.ok(Math.abs(sample.x-x)<.018 && Math.abs(sample.y-y)<.018,
        `shield at (${sample.x}, ${sample.y}), expected (${x}, ${y})`);
      assert.ok(Math.abs(sample.cursor[0]-sample.x)<.001 && Math.abs(sample.cursor[1]-sample.y)<.001);
      samples.push(sample);
    }
    const resting={id:9,x:main.width/2,y:main.height/2};
    await touch('touchStart',[resting]);
    await touch('touchStart',[resting,point(.4,0)]);
    await checkPosition(.4,0);
    await touch('touchCancel');
    await touch('touchStart',[point(0,0)]);
    await checkPosition(0,0);
    const positions=[[.75,.1],[-.38,.67],[.2,-.69]];
    for (const [index,[x,y]] of positions.entries()) {
      await page.evaluate(time=>{const q=window.__crystalWell;q.game.time=time;q.refresh();},index*60);
      await touch('touchMove',[point(x,y)]);
      await checkPosition(x,y);
    }
    await page.evaluate(()=>{const q=window.__crystalWell;q.drawFrame();});
    await page.screenshot({path:'artifacts/touch-pad-active.png',timeout:120000});
    const first=point(-1.4,1.4);
    await touch('touchMove',[first]);
    await checkPosition(-Math.SQRT1_2,Math.SQRT1_2);
    const ownerTarget=await target();
    await touch('touchStart',[first,point(.2,-.3,2)]);
    await touch('touchMove',[first,point(.6,.4,2)]);
    assert.deepEqual(await target(),ownerTarget,'a second finger cannot steal the drag');
    await touch('touchCancel');
    assert.equal(await state(),'ready','cancelling a drag never serves');

    await pad.tap();
    assert.equal(await state(),'playing','a fresh touch and release serves the held ball');
    await touch('touchStart',[point(.2,.2)]);
    await page.evaluate(()=>{
      const q=window.__crystalWell;q.game.state='ready';q.game.readyReason='capture';q.game.heldSince++;
      q.refresh();
    });
    await touch('touchEnd');
    assert.equal(await state(),'ready','catching the ball during a drag requires a fresh release gesture');
    await page.locator('#pause').tap();
    assert.equal(await pad.isVisible(),false);
    await page.touchscreen.tap(point(0,0).x,point(0,0).y);
    assert.equal(await state(),'ready');
    await page.locator('#center-action').tap();
    await touch('touchStart',[point(.3,0)]);
    await page.setViewportSize({width:390,height:844});
    await pad.waitFor({state:'hidden'});
    await touch('touchEnd');
    await page.setViewportSize({width:667,height:375});
    await pad.waitFor({state:'visible'});
    assert.equal(await state(),'ready','rotation cancels the previous gesture');
    const small=await pad.boundingBox(),left=await page.locator('#main-panel').boundingBox();
    assert.ok(small.x>=left.width && small.x+small.width<=667 && small.y+small.height<=375);
    return {viewport:'844 × 390',dpr:2,diameter:rect.width,smallDiameter:small.width,samples};
  } finally {
    await phone.close();
  }
}
