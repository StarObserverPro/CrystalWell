/** Shared visual/physics envelope. The antlers and whiskers are decorative, not colliders. */
export const DRAGON = Object.freeze({ browX: 7.9, browY: 7.25, silhouetteWidth: 17.14 });
export function dragonPose(time) {
  return { x: Math.sin(time * .85) * .25, y: Math.cos(time * .63) * .18 };
}
export function dragonBrow(x, y, time) {
  const p = dragonPose(time), rx = x - p.x, ry = y - p.y;
  const inside = (rx / DRAGON.browX) ** 2 + (ry / DRAGON.browY) ** 2 < 1;
  const z = .83 + .14 * Math.cos(rx * .45) + .12 * Math.sin(ry * .55 + time * .8);
  const nx = .063 * Math.sin(rx * .45), ny = -.066 * Math.cos(ry * .55 + time * .8);
  const length = Math.hypot(nx, ny, 1);
  return { inside, z: inside ? z : -.65, nx: nx / length, ny: ny / length, nz: 1 / length };
}
