import * as THREE from 'three';
import { RULES, clamp } from './physics.js';
import { AdventureGame } from './gameplay.js';
import { QUALITY, pixelRatio, sideTargetSize } from './quality.js';
import { SculptedHUD } from './hud-3d.js';
import { RefinedCrystalWorld as CrystalWorld } from './refined-world.js';
import { composition,sideViewDistance } from './composition.js';
import { viewBasis, depthHeat, FrameMeter } from './visual-math.js';
import { MagicMotes } from './vfx.js';

const app = document.getElementById('app');
const mainPanel = document.getElementById('main-panel');
const sidePanel = document.getElementById('side-panel');
const elements = {
  pause: document.getElementById('pause'), sound: document.getElementById('sound'),
  restart: document.getElementById('restart'), center: document.getElementById('center-action'),
  fps: document.getElementById('fps-readout'), status: document.getElementById('game-status'),
};
const errorPanel = document.getElementById('error-panel');
const frameMeter = new FrameMeter();

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false,
    powerPreference: 'high-performance', stencil: false });
} catch (error) {
  errorPanel.hidden = false;
  errorPanel.textContent = '此设备无法开启 WebGL 3D';
  throw error;
}
renderer.setPixelRatio(pixelRatio(window.devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches));
renderer.setSize(Math.max(1, app.clientWidth), Math.max(1, app.clientHeight), false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.28;
renderer.info.autoReset = false;
renderer.autoClear = false;
renderer.domElement.className = 'stage';
renderer.domElement.setAttribute('aria-hidden', 'true');
app.prepend(renderer.domElement);

const game = new AdventureGame();
const scene = new THREE.Scene();
let world = new CrystalWorld(scene, game);

const vfx = new MagicMotes(scene);
const hud = new SculptedHUD(renderer, game, elements);
hud.scene.environment=scene.environment;
let assetsReady=false;
world.dragon.userData.readyPromise.then(()=>{ assetsReady=true; }).catch(error=>{
  paused=true;errorPanel.hidden=false;errorPanel.textContent='龙模型加载失败，请刷新重试';console.error(error);
});
const topCamera = new THREE.OrthographicCamera(-13, 13, 12, -12, .1, 150);
topCamera.position.set(0, 0, 32);
topCamera.up.set(0, 1, 0);
topCamera.lookAt(0, 0, 0);
topCamera.layers.enable(1); // ball silhouette and landing projection: top camera only
const sideCamera = new THREE.PerspectiveCamera(42, 1, .1, 180);
sideCamera.up.set(0, 0, 1);
sideCamera.layers.enable(2); // true-position x-ray glint on side, never the top-projected marker

const sideTarget = new THREE.WebGLRenderTarget(320, 480, {
  depthBuffer: true, stencilBuffer: false,
  minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
  generateMipmaps: false,
});
sideTarget.texture.colorSpace = THREE.SRGBColorSpace;
const screenScene = new THREE.Scene();
const screenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 10);
screenCamera.position.z = 2;
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2),
  new THREE.MeshBasicMaterial({ map: sideTarget.texture, depthTest: false, depthWrite: false,
    toneMapped: false, color:0xc4d0e2 }));
screenScene.add(quad);

let paused = false;
let simulationFrozen = false;
let renderSuspended = new URLSearchParams(location.search).has('qa') && new URLSearchParams(location.search).has('staticQA');
let playingLandscape = true;
let previousTime = performance.now();
let accumulator = 0;
let lastSideFrame = -1e5;
let lastHudUpdate = 0;
let lastMoteTime = 0;
let lastWinBurst = 0;
let width = 1, height = 1, mainWidth = 1, sideWidth = 1;
let sideHeight = 1;
let sideFps = 18;
let sideDistance = 40;
const cameraTarget = new THREE.Vector3(0, 0, 5.3);
const raycaster = new THREE.Raycaster();
const shieldPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -RULES.shieldZ);
const pointer = new THREE.Vector2();
const hitPoint = new THREE.Vector3();
let lastPointer = null;
let pointerGesture = null;
const keys = new Set();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let soundEnabled = true;
let audioContext = null;

function initAudio() {
  if (!soundEnabled) return;
  if (!audioContext) {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (Audio) audioContext = new Audio();
  }
  audioContext?.resume().catch(() => {});
}
function chime(type, extra = 0) {
  if (!audioContext || !soundEnabled || audioContext.state !== 'running') return;
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const volume = audioContext.createGain();
  oscillator.type = type === 'crystal' ? 'sine' : type === 'miss' ? 'triangle' : 'sine';
  const start = type === 'shield' ? 460 : type === 'dragon' ? 190 : type === 'miss' ? 230 : 790;
  oscillator.frequency.setValueAtTime(start + extra * 7, now);
  oscillator.frequency.exponentialRampToValueAtTime(type === 'miss' ? 90 : start * 1.45, now + .12);
  volume.gain.setValueAtTime(.0001, now);
  volume.gain.exponentialRampToValueAtTime(type === 'miss' ? .09 : .035, now + .008);
  volume.gain.exponentialRampToValueAtTime(.0001, now + .17);
  oscillator.connect(volume).connect(audioContext.destination);
  oscillator.start(now); oscillator.stop(now + .18);
}

function updateHud(now = performance.now()) {
  hud.update(now / 1000, paused, soundEnabled, playingLandscape, frameMeter.value);
}

function resize() {
  const bounds = app.getBoundingClientRect();
  width = Math.max(1, Math.floor(bounds.width));
  height = Math.max(1, Math.floor(bounds.height));
  const layout=composition(width,height);
  mainWidth=layout.mainWidth;sideWidth=layout.sideWidth;
  mainPanel.style.width=`${mainWidth}px`;sidePanel.style.left=`${mainWidth}px`;
  renderer.setSize(width, height, false);
  playingLandscape = window.innerWidth > window.innerHeight;
  const aspect = mainWidth / height;
  const halfHeight = layout.halfHeight;
  topCamera.left = -halfHeight * aspect;
  topCamera.right = halfHeight * aspect;
  topCamera.top = halfHeight + layout.centerY;
  topCamera.bottom = -halfHeight + layout.centerY;
  topCamera.updateProjectionMatrix();
  sideHeight = height; // HUD overlays the scene; no reserved mobile header strip.
  const sideAspect = sideWidth / sideHeight;
  const [tw, th] = sideTargetSize(sideWidth, sideHeight);
  sideTarget.setSize(tw, th);
  sideCamera.aspect = tw / th;
  sideCamera.updateProjectionMatrix();
  sideDistance = sideViewDistance(sideAspect,sideCamera.fov);
  updateCameras();
  frameMeter.reset();
  sideFps = matchMedia('(pointer: coarse)').matches ? QUALITY.sideTouchHz : QUALITY.sideDesktopHz;
  hud.resize(width, height, mainWidth);
  updateHud();
  lastSideFrame = -1e5;
}

function updateCameras() {
  const basis = viewBasis(game.time, reducedMotion);
  topCamera.position.fromArray(basis.main).multiplyScalar(36).add(cameraTarget);
  topCamera.up.fromArray(basis.up);
  topCamera.lookAt(cameraTarget); topCamera.updateMatrixWorld(true);
  const sideFocus=new THREE.Vector3(0,0,.3);
  sideCamera.position.fromArray(basis.side).multiplyScalar(sideDistance).add(sideFocus);
  sideCamera.lookAt(sideFocus); sideCamera.updateMatrixWorld(true);
}
function reprojectPointer() {
  if (!lastPointer || !playingLandscape || paused) return;
  const r = mainPanel.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return;
  pointer.set(clamp((lastPointer.x-r.left)/r.width,0,1)*2-1,
    1-clamp((lastPointer.y-r.top)/r.height,0,1)*2);
  raycaster.setFromCamera(pointer, topCamera);
  if (raycaster.ray.intersectPlane(shieldPlane, hitPoint)) game.aim(hitPoint.x, hitPoint.y);
}
function aimFromPointer(event) {
  lastPointer = { x: event.clientX, y: event.clientY };
  reprojectPointer();
}
mainPanel.addEventListener('pointerleave', () => { lastPointer = null; });
mainPanel.addEventListener('pointercancel', () => { lastPointer = null; pointerGesture = null; });
mainPanel.addEventListener('pointermove', e => { if (!paused) aimFromPointer(e); });
mainPanel.addEventListener('pointerdown', e => {
  if (!assetsReady || paused || !playingLandscape || e.target.closest('button') || e.button !== 0 || !e.isPrimary) return;
  document.activeElement?.blur?.();
  pointerGesture = { id: e.pointerId, held: game.held, heldSince: game.heldSince };
  initAudio(); mainPanel.setPointerCapture?.(e.pointerId); aimFromPointer(e);
});
mainPanel.addEventListener('pointerup', e => {
  if (mainPanel.hasPointerCapture?.(e.pointerId)) mainPanel.releasePointerCapture(e.pointerId);
  const gesture = pointerGesture; pointerGesture = null;
  if (assetsReady && !paused && playingLandscape && game.held && gesture?.id === e.pointerId
      && gesture.held && gesture.heldSince === game.heldSince) game.launch();
  if (e.pointerType !== 'mouse') lastPointer = null;
});
window.addEventListener('keydown', event => {
  // A focused accessible control owns Space/Enter; never turn its activation into a shot.
  if (event.target.closest?.('button') && (event.key === ' ' || event.key === 'Enter')) return;
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Escape'].includes(event.key)) event.preventDefault();
  if (event.key === 'Escape' || event.key.toLowerCase() === 'p') {
    if (!event.repeat && playingLandscape) togglePause();
    return;
  }
  if (event.key.toLowerCase() === 'r' && !event.repeat) { reset(); return; }
  if (paused || !playingLandscape) return;
  keys.add(event.key.toLowerCase());
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','s','d','w'].includes(event.key)) lastPointer = null;
  if (assetsReady && event.key === ' ' && game.held && !event.repeat) { initAudio(); game.launch(); }
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => setPaused(true));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) setPaused(true);
  previousTime = performance.now(); frameMeter.reset();
});

function reset() {
  game.restart(); world.resetField(); vfx.clear();world.sea.reset();
  accumulator = 0; lastPointer = null; pointerGesture = null; lastSideFrame = -1e5; keys.clear();
  frameMeter.reset(); updateCameras(); paused = false; simulationFrozen = false;
  world.update(0, game.time); updateHud();
}
function setPaused(value) {
  if (game.state === 'lost' || game.state === 'won') return;
  paused = value; keys.clear(); lastPointer = null; pointerGesture = null; accumulator = 0;
  previousTime = performance.now(); frameMeter.reset(); updateHud();
  elements.pause.setAttribute('aria-label', paused ? '继续游戏' : '暂停游戏');
}
function togglePause() { setPaused(!paused); }
elements.restart.addEventListener('click', () => { initAudio(); reset(); });
elements.center.addEventListener('click', () => {
  initAudio(); if (game.state === 'lost' || game.state === 'won') reset(); else setPaused(false);
});
elements.pause.addEventListener('click', () => togglePause());
elements.sound.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  elements.sound.setAttribute('aria-label', soundEnabled ? '关闭声音' : '开启声音');
  if (soundEnabled) initAudio();
  updateHud();
});
// Pointer activation returns keyboard control to the game. Tab activation retains focus.
for (const control of [elements.pause, elements.sound, elements.restart, elements.center]) {
  control.addEventListener('click', event => { if (event.detail > 0) control.blur(); });
}
const observer = new ResizeObserver(resize);
observer.observe(app);
window.addEventListener('resize', resize);
resize();
updateHud();

function handleEvent(event) {
  if (['crystal', 'collapse', 'resonance'].includes(event.type)) world.removeCrystals(event.removed);
  switch (event.type) {
    case 'resonance':
      vfx.emit(event.x, event.y, event.z, reducedMotion ? 8 : 60, true, 'pink');
      chime('dragon', 8);
      break;
    case 'crystal':
      vfx.emit(event.x, event.y, event.z, reducedMotion ? 5 : Math.min(46, 22 + event.removed.length), true,
        event.combo % 3 === 0 ? 'pink' : 'ice');
      chime('crystal', event.combo);
      break;
    case 'shield':
      if (!game.held) { vfx.emit(event.x,event.y,event.z,30,true,'gold',true); chime('shield'); }
      break;
    case 'release': vfx.emit(event.x,event.y,event.z,40,true,'gold',true); chime('shield',12); break;
    case 'capture': vfx.emit(event.x,event.y,event.z,32,true,'pink'); chime('dragon',14); break;
    case 'serve': vfx.emit(event.x,event.y,event.z,28,true,'ice'); break;
    case 'pickup': vfx.emit(event.x,event.y,event.z,48,true,event.kind==='bind'?'pink':'gold'); chime('crystal',18); break;
    case 'barrier': world.sea.impact(event.x,event.y,game.time);vfx.emit(event.x,event.y,event.z,16,true,'ice');break;
    case 'dragon': world.sea.impact(event.x,event.y,game.time,.55);vfx.emit(event.x, event.y, event.z, 23, true, 'pink'); chime('dragon'); break;
    case 'wall': vfx.emit(event.x, event.y, event.z, 5, false, 'ice'); break;
    case 'floor': vfx.emit(event.x, event.y, event.z, 5, false, 'pink'); break;
    case 'miss':
      vfx.emit(event.x, event.y, event.z, 35, true, 'gold');
      chime('miss');
      if (navigator.vibrate) navigator.vibrate(35);
      break;
    case 'win': chime('dragon', 19); break;
  }
}

function renderSide(now) {
  const interval = 1000 / sideFps;
  if (now - lastSideFrame < interval) return;
  lastSideFrame = now;
  renderer.setScissorTest(false);
  renderer.setRenderTarget(sideTarget);
  renderer.setViewport(0, 0, sideTarget.width, sideTarget.height);
  renderer.setClearColor(0x07111b, 1);
  renderer.clear(true, true, true);
  world.prepareView(sideCamera, true, now);
  renderer.render(scene, sideCamera);
  renderer.setRenderTarget(null);
  return true;
}

function render(now) {
  renderer.info.reset(); renderer.setRenderTarget(null); renderer.setScissorTest(false);
  renderer.setViewport(0,0,width,height); renderer.setClearColor(0x091324,1); renderer.clear(true,true,true);
  let sideRendered = false;
  if (playingLandscape) {
    renderer.setScissorTest(true); renderer.setViewport(0,0,mainWidth,height);renderer.setScissor(0,0,mainWidth,height);
    world.prepareView(topCamera,false,now);renderer.render(scene,topCamera);
    sideRendered=renderSide(now)===true;
    renderer.setScissorTest(true);renderer.setViewport(mainWidth,0,sideWidth,sideHeight);renderer.setScissor(mainWidth,0,sideWidth,sideHeight);
    renderer.clearDepth();renderer.render(screenScene,screenCamera);
  }
  updateHud(now);hud.render();
  if (playingLandscape) {
    const sample=frameMeter.record(now,sideRendered);
    if(sample) elements.fps.title=`${renderer.info.render.calls} draws · ${Math.round(renderer.info.render.triangles/1000)}k triangles · single-pass crystals`;
  } else frameMeter.reset();
}

function frame(now) {
  requestAnimationFrame(frame);
  if (renderSuspended) { previousTime = now; return; }
  const dt = Math.min(.045, Math.max(0, (now - previousTime) / 1000));
  previousTime = now;
  if (!playingLandscape) { frameMeter.reset(); render(now); return; }
  updateCameras();
  if (assetsReady && !paused && !simulationFrozen) {
    reprojectPointer();
    if (keys.size) {
      const mx = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0);
      const my = (keys.has('arrowup') || keys.has('w') ? 1 : 0) - (keys.has('arrowdown') || keys.has('s') ? 1 : 0);
      if (mx || my) {
        const basis = viewBasis(game.time, reducedMotion);
        game.aim(game.shield.targetX + (mx*basis.right[0]+my*basis.screenUp[0])*dt*13,
          game.shield.targetY + (mx*basis.right[1]+my*basis.screenUp[1])*dt*13);
      }
    }
    accumulator += dt;
    let steps = 0;
    while (accumulator >= 1 / 120 && steps++ < 7) {
      game.step(1 / 120);
      accumulator -= 1 / 120;
    }
    if (steps >= 7) accumulator = 0;
    for (const event of game.drainEvents()) handleEvent(event);
    if (game.state === 'playing' && now - lastMoteTime >= (reducedMotion ? 48 : 18)) {
      vfx.emit(game.ball.x, game.ball.y, game.ball.z, 6, false, depthHeat(game.ball.z));
      lastMoteTime = now;
    }
    const rise = game.state === 'won' ? clamp((game.time - game.wonAt) / 6, 0, 1) : 0;
    if (rise > 0 && now - lastWinBurst > 170 && !reducedMotion) {
      vfx.emit((Math.random() - .5) * 2.6, (Math.random() - .5) * 2.6,
        rise * 16, 12, true, 'pink');
      lastWinBurst = now;
    }
    world.update(dt, game.time, rise);
    vfx.update(dt, game.time);
    if (now - lastHudUpdate > 120 || game.state === 'won') {
      updateHud(); lastHudUpdate = now;
    }
  }
  render(now);
}
requestAnimationFrame(frame);

if (new URLSearchParams(location.search).has('qa')) {
  window.__crystalWell = { game, world, renderer, topCamera, sideCamera, frameMeter, hud, sideTarget, quality: QUALITY, reset,
    get assetsReady(){return assetsReady;},
    get paused() { return paused; },
    suspendRendering: () => { renderSuspended = true; }, resumeRendering: () => { renderSuspended = false; },
    drawFrame: () => { render(performance.now()); renderer.getContext().finish(); },
    freeze: () => { simulationFrozen = true; }, unfreeze: () => { simulationFrozen = false; },
    pause: () => setPaused(true), resume: () => setPaused(false),
    refresh: () => { updateCameras(); world.update(0, game.time); updateHud();  lastSideFrame = -1e5; } };
}
