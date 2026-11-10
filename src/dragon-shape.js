/** Shared visual/physics envelope. The antlers and whiskers are decorative, not colliders. */
export const DRAGON = Object.freeze({ browX: 7.9, browY: 7.25, silhouetteWidth: 17.14 });
export function dragonPose(time) {
  return { x: Math.sin(time * .85) * .25, y: Math.cos(time * .63) * .18 };
}
export function dragonBrow(x, y, time) {
  const sculpt = sampledDragonBrow(x,y,time); if (sculpt) return sculpt;
  const p = dragonPose(time), rx = x - p.x, ry = y - p.y;
  const inside = (rx / DRAGON.browX) ** 2 + (ry / DRAGON.browY) ** 2 < 1;
  const z = .83 + .14 * Math.cos(rx * .45) + .12 * Math.sin(ry * .55 + time * .8);
  const nx = .063 * Math.sin(rx * .45), ny = -.066 * Math.cos(ry * .55 + time * .8);
  const length = Math.hypot(nx, ny, 1);
  return { inside, z: inside ? z : -.65, nx: nx / length, ny: ny / length, nz: 1 / length };
}

// A coarse height proxy sampled once from the imported sculpt; not triangle physics.
const SIZE=45, SPAN=18, STEP=SPAN/(SIZE-1);
let surface=null;
export function installDragonSurface(positions) {
  const values=new Float32Array(SIZE*SIZE).fill(-11);
  for(let i=0;i<positions.length;i+=3){
    const x=positions[i], y=positions[i+1], z=positions[i+2];
    if(Math.abs(x)>9||Math.abs(y)>9||z < -11)continue;
    const ix=Math.round((x+9)/STEP),iy=Math.round((y+9)/STEP);
    values[iy*SIZE+ix]=Math.max(values[iy*SIZE+ix],z);
  }
  // Conservative local pooling fills sampling gaps while retaining the recognizable forehead.
  surface=new Float32Array(values);
  for(let y=1;y<SIZE-1;y++)for(let x=1;x<SIZE-1;x++){
    let high=-11;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)high=Math.max(high,values[(y+j)*SIZE+x+i]-.10*Math.hypot(i,j));
    surface[y*SIZE+x]=high;
  }
}
export function sampledDragonBrow(x,y,time) {
  if(!surface)return null;
  const p=dragonPose(time),ix=Math.round((x-p.x+9)/STEP),iy=Math.round((y-p.y+9)/STEP);
  if(ix<1||iy<1||ix>=SIZE-1||iy>=SIZE-1)return {inside:false,z:-11,nx:0,ny:0,nz:1};
  const z=surface[iy*SIZE+ix];
  const nx=Math.max(-.55,Math.min(.55,(surface[iy*SIZE+ix-1]-surface[iy*SIZE+ix+1])/(2*STEP)));
  const ny=Math.max(-.55,Math.min(.55,(surface[(iy-1)*SIZE+ix]-surface[(iy+1)*SIZE+ix])/(2*STEP)));
  const l=Math.hypot(nx,ny,1);return {inside:z>-10.9,z,nx:nx/l,ny:ny/l,nz:1/l};
}
