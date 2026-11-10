/** Renderer-independent presentation rules, shared by camera/input and tests. */
export const CAMERA_TILT = Math.PI / 9; // 20 degrees away from the vertical.
export const ORBIT_SPEED = Math.PI * 2 / 240;
const saturate = x => Math.min(1, Math.max(0, x));
export function viewBasis(time, reducedMotion = false) {
  const angle = -Math.PI / 2 + (reducedMotion ? 0 : time * ORBIT_SPEED);
  const c = Math.cos(angle), s = Math.sin(angle);
  return {
    main: [Math.sin(CAMERA_TILT) * c, Math.sin(CAMERA_TILT) * s, Math.cos(CAMERA_TILT)],
    side: [-s, c, 0], // Exactly perpendicular to main; a genuinely horizontal side view.
    up: [-Math.cos(CAMERA_TILT) * c, -Math.cos(CAMERA_TILT) * s, Math.sin(CAMERA_TILT)],
    right: [-s, c, 0],
    screenUp: [-c, -s, 0],
  };
}
// Distance means depth below the shield, not distance to the orbiting camera.
// Colors are sRGB. The same palette is used by both views and the particle trail.
export const HEAT_STOPS = Object.freeze([
  [0, [0.23, 0.27, 1]], [.28, [.10, .73, 1]],
  [.54, [.37, 1, .82]], [.77, [1, .76, .16]], [1, [1, .20, .065]],
]);
export function depthHeat(z, shieldZ = 10.55, floorZ = .6) {
  const u = saturate((z - floorZ) / (shieldZ - floorZ));
  let i = 1;
  while (i < HEAT_STOPS.length - 1 && u > HEAT_STOPS[i][0]) i++;
  const [a, ca] = HEAT_STOPS[i - 1], [b, cb] = HEAT_STOPS[i];
  const t = saturate((u - a) / (b - a));
  return ca.map((v, k) => v + (cb[k] - v) * t);
}
export class FrameMeter {
  constructor() { this.reset(); }
  reset() { this.start = null; this.frames = 0; this.sideFrames = 0; this.value = null; }
  record(now, sideRendered = false) {
    if (this.start === null) { this.start = now; return null; }
    this.frames++; if (sideRendered) this.sideFrames++;
    const elapsed = now - this.start;
    if (elapsed < 1000) return null;
    this.value = { fps: this.frames * 1000 / elapsed, sideFps: this.sideFrames * 1000 / elapsed,
      ms: elapsed / this.frames };
    this.start = now; this.frames = 0; this.sideFrames = 0;
    return this.value;
  }
}
