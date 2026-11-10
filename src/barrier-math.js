/** A horizontal sea-like seal through the middle of the head, never a cylindrical wall. */
export const BARRIER = Object.freeze({ z:-8.321255, radius:9.72, visualRadius:256,
  waves:Object.freeze([[.28,.53,.31,.72],[.15,-.38,.67,-.53],[.08,.95,-.41,1.11]]) });
export function barrierSurface(x,y,t) {
  let z=BARRIER.z,dx=0,dy=0;
  for(const [a,kx,ky,w] of BARRIER.waves){const p=kx*x+ky*y+w*t;z+=a*Math.sin(p);dx+=a*kx*Math.cos(p);dy+=a*ky*Math.cos(p);}
  const l=Math.hypot(dx,dy,1);return {inside:false,collidable:x*x+y*y<=BARRIER.radius*BARRIER.radius,z,nx:-dx/l,ny:-dy/l,nz:1/l};
}
