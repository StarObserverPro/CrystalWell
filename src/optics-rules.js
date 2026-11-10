/** Bounded optical allocation; no render-library dependency for rule tests. */
export const REFRACTION = Object.freeze({scale:.5,maxSide:720,hz:30,maxBricks:384,ior:1.46});
export function refractionSize(width,height,dpr=1) {
  const f=Math.min(REFRACTION.scale*dpr,REFRACTION.maxSide/Math.max(width,height));
  return [Math.max(1,Math.round(width*f)),Math.max(1,Math.round(height*f))];
}
