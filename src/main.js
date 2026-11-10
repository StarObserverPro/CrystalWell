import * as THREE from 'three';
import { CrystalWellGame, RULES, clamp } from './physics.js';
import { CrystalWorld } from './world.js';
import { MagicMotes } from './vfx.js';

const app = document.getElementById('app');
const mainPanel = document.getElementById('main-panel');
const sidePanel = document.getElementById('side-panel');
const livesDisplay = document.getElementById('lives');
const progressFill = document.getElementById('progress-ring');
const progressText = document.getElementById('progress-readout');
const restartButton = document.getElementById('restart');
const soundButton = document.getElementById('sound');
const pauseButton = document.getElementById('pause');
const startHint = document.getElementById('start-hint');
const endOverlay = document.getElementById('end-overlay');
const viewRefresh = document.getElementById('view-refresh');
const errorPanel = document.getElementById('error-panel');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false,
    powerPreference: 'high-performance', stencil: false });
} catch (error) {
  errorPanel.hidden = false;
  errorPanel.textContent = '此设备无法开启 WebGL 3D';
  throw error;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1.35 : 1.65));
renderer.setSize(Math.max(1, app.clientWidth), Math.max(1, app.clientHeight), false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
renderer.autoClear = false;
renderer.domElement.className = 'stage';
renderer.domElement.setAttribute('aria-hidden', 'true');
app.prepend(renderer.domElement);

const game = new CrystalWellGame();
const scene = new THREE.Scene();
let world = new CrystalWorld(scene, game);
const vfx = new MagicMotes(scene);
const topCamera = new THREE.OrthographicCamera(-13, 13, 12, -12, .1, 150);
topCamera.position.set(0, 0, 32);
topCamera.up.set(0, 1, 0);
topCamera.lookAt(0, 0, 0);
topCamera.layers.enable(1); // ball silhouette and landing projection: top camera only
const sideCamera = new THREE.PerspectiveCamera(42, 1, .1, 180);
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
    toneMapped: false }));
screenScene.add(quad);

let paused = false;
let playingLandscape = true;
let previousTime = performance.now();
let accumulator = 0;
let lastSideFrame = -1e5;
let lastHudUpdate = 0;
let lastMoteTime = 0;
let lastWinBurst = 0;
let width = 1, height = 1, mainWidth = 1, sideWidth = 1;
let sideFps = 18;
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

function updateLives() {
  livesDisplay.replaceChildren();
  for (let i = 0; i < RULES.lives; i++) {
    const icon = document.createElement('span');
    icon.className = 'life-gem' + (i >= game.lives ? ' extinguished' : '');
    icon.setAttribute('aria-hidden', 'true');
    livesDisplay.append(icon);
  }
  livesDisplay.setAttribute('aria-label', `剩余魔法球 ${game.lives}`);
}

function updateHud() {
  const done = game.total ? 1 - game.remaining / game.total : 0;
  progressFill.style.setProperty('--progress', `${(done * 360).toFixed(1)}deg`);
  progressFill.setAttribute('aria-valuenow', `${Math.round(done * 100)}`);
  progressText.textContent = `${Math.round(done * 100)}`;
  startHint.classList.toggle('hidden', game.state !== 'ready');
  if (game.state === 'lost') {
    endOverlay.classList.add('visible');
    endOverlay.dataset.state = 'lost';
    endOverlay.setAttribute('aria-label', '魔法球耗尽，点按重新开始');
  } else if (game.state === 'won' && game.time - game.wonAt > 4) {
    endOverlay.classList.add('visible');
    endOverlay.dataset.state = 'won';
    endOverlay.setAttribute('aria-label', '神龙解封，点按再玩一次');
  } else endOverlay.classList.remove('visible');
  updateLives();
}

function resize() {
  const bounds = app.getBoundingClientRect();
  width = Math.max(1, Math.floor(bounds.width));
  height = Math.max(1, Math.floor(bounds.height));
  mainWidth = Math.max(1, Math.round(mainPanel.getBoundingClientRect().width));
  sideWidth = Math.max(1, width - mainWidth);
  renderer.setSize(width, height, false);
  playingLandscape = window.innerWidth > window.innerHeight;
  const aspect = mainWidth / height;
  const halfHeight = Math.max(11.6, 11.8 / aspect);
  topCamera.left = -halfHeight * aspect;
  topCamera.right = halfHeight * aspect;
  topCamera.top = halfHeight;
  topCamera.bottom = -halfHeight;
  topCamera.updateProjectionMatrix();
  const sideAspect = sideWidth / height;
  const scale = Math.min(.85, 540 / sideWidth, 760 / height);
  const tw = Math.max(150, Math.round(sideWidth * scale));
  const th = Math.max(150, Math.round(height * scale));
  sideTarget.setSize(tw, th);
  sideCamera.aspect = tw / th;
  sideCamera.updateProjectionMatrix();
  const fovRads = THREE.MathUtils.degToRad(sideCamera.fov);
  const distance = Math.max(31, 21.5 / (2 * Math.tan(fovRads / 2) * sideAspect));
  const dir = new THREE.Vector3(.28, -.88, .38).normalize();
  sideCamera.position.copy(dir.multiplyScalar(distance)).add(new THREE.Vector3(0, 0, 4.8));
  sideCamera.lookAt(0, 0, 4.8);
  sideFps = matchMedia('(pointer: coarse)').matches ? 14 : 18;
  lastSideFrame = -1e5;
}

function aimFromPointer(event) {
  if (!playingLandscape) return;
  const r = mainPanel.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return;
  const u = clamp((event.clientX - r.left) / r.width, 0, 1);
  const v = clamp((event.clientY - r.top) / r.height, 0, 1);
  game.aim(topCamera.left + u * (topCamera.right - topCamera.left),
    topCamera.top - v * (topCamera.top - topCamera.bottom));
}
mainPanel.addEventListener('pointermove', e => { aimFromPointer(e); });
mainPanel.addEventListener('pointerdown', e => {
  if (e.target.closest('button')) return;
  initAudio();
  mainPanel.setPointerCapture?.(e.pointerId);
  aimFromPointer(e);
  game.launch();
});
mainPanel.addEventListener('pointerup', e => { if (mainPanel.hasPointerCapture?.(e.pointerId)) mainPanel.releasePointerCapture(e.pointerId); });
window.addEventListener('keydown', event => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) event.preventDefault();
  keys.add(event.key.toLowerCase());
  if (event.key.toLowerCase() === 'r') reset();
  if (event.key === ' ' && game.state === 'ready') { initAudio(); game.launch(); }
  if (event.key.toLowerCase() === 'p' || event.key === 'Escape') togglePause();
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => { paused = true; pauseButton.classList.add('is-paused'); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { paused = true; pauseButton.classList.add('is-paused'); }
  previousTime = performance.now();
});

function reset() {
  game.restart();
  // Rebuild only the instanced field, restoring all 3D crystals and accents.
  scene.remove(world.crystals, world.accents);
  world.crystals.geometry.dispose(); world.crystals.material.dispose();
  world.accents.geometry.dispose(); world.accents.material.dispose();
  world.crystalMap = new Int32Array(game.grid.length).fill(-1);
  world.gemMap = new Int32Array(game.grid.length).fill(-1);
  world.makeCrystalField();
  paused = false; pauseButton.classList.remove('is-paused');
  endOverlay.classList.remove('visible');
  updateHud();
}
function togglePause() {
  paused = !paused;
  pauseButton.classList.toggle('is-paused', paused);
  pauseButton.setAttribute('aria-label', paused ? '继续' : '暂停');
}
restartButton.addEventListener('click', () => { initAudio(); reset(); });
endOverlay.addEventListener('click', () => { initAudio(); reset(); });
pauseButton.addEventListener('click', () => togglePause());
soundButton.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  soundButton.classList.toggle('is-muted', !soundEnabled);
  soundButton.setAttribute('aria-label', soundEnabled ? '关闭声音' : '开启声音');
  if (soundEnabled) initAudio();
});
const observer = new ResizeObserver(resize);
observer.observe(app);
window.addEventListener('resize', resize);
resize();
updateHud();

function handleEvent(event) {
  if (event.type === 'crystal' || event.type === 'collapse') world.removeCrystals(event.removed);
  switch (event.type) {
    case 'resonance':
      vfx.emit(event.x, event.y, event.z, reducedMotion ? 8 : 30, true, 'pink');
      chime('dragon', 8);
      break;
    case 'crystal':
      vfx.emit(event.x, event.y, event.z, reducedMotion ? 5 : Math.min(23, 11 + event.removed.length), true,
        event.combo % 3 === 0 ? 'pink' : 'ice');
      chime('crystal', event.combo);
      break;
    case 'shield': vfx.emit(event.x, event.y, event.z, 17, true, 'gold'); chime('shield'); break;
    case 'dragon': vfx.emit(event.x, event.y, event.z, 23, true, 'pink'); chime('dragon'); break;
    case 'wall': vfx.emit(event.x, event.y, event.z, 5, false, 'ice'); break;
    case 'floor': vfx.emit(event.x, event.y, event.z, 5, false, 'pink'); break;
    case 'miss':
      vfx.emit(event.x, event.y, event.z, 35, true, 'gold');
      document.body.classList.remove('was-hit'); void document.body.offsetWidth;
      document.body.classList.add('was-hit');
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
  renderer.render(scene, sideCamera);
  renderer.setRenderTarget(null);
  viewRefresh.classList.toggle('bright');
}

function render(now) {
  renderer.setRenderTarget(null);
  renderer.setScissorTest(true);
  renderer.setViewport(0, 0, width, height);
  renderer.setScissor(0, 0, width, height);
  renderer.setClearColor(0x07111b, 1);
  renderer.clear(true, true, true);
  renderer.setViewport(0, 0, mainWidth, height);
  renderer.setScissor(0, 0, mainWidth, height);
  renderer.render(scene, topCamera);

  renderSide(now);
  renderer.setScissorTest(true);
  renderer.setViewport(mainWidth, 0, sideWidth, height);
  renderer.setScissor(mainWidth, 0, sideWidth, height);
  renderer.clearDepth();
  renderer.render(screenScene, screenCamera);
  renderer.setScissorTest(false);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.045, Math.max(0, (now - previousTime) / 1000));
  previousTime = now;
  if (!playingLandscape) return;
  if (!paused) {
    if (keys.size) {
      const mx = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0);
      const my = (keys.has('arrowup') || keys.has('w') ? 1 : 0) - (keys.has('arrowdown') || keys.has('s') ? 1 : 0);
      if (mx || my) game.aim(game.shield.targetX + mx * dt * 13, game.shield.targetY + my * dt * 13);
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
      vfx.emit(game.ball.x, game.ball.y, game.ball.z, 2, false, 'gold');
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
