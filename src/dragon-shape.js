import { DRAGON_FIT, headRotation, moveHeadPoint } from './dragon-anatomy.js';
import { barrierSurface } from './barrier-math.js';
export const DRAGON = Object.freeze({ browX:DRAGON_FIT.coreWidth/2, browY:7.25, silhouetteWidth:17.14 });
export function dragonPose(time) { return { x:Math.sin(time*.85)*.16,y:Math.cos(time*.63)*.12 }; }
const SIZE=65,SPAN=24,STEP=SPAN/(SIZE-1),LOW=-100;
let samples=null,weights=null,surface=null,lastTick=NaN;
/** Geometry is sampled once; only a bounded point proxy is animated, not 400k triangles. */
export function installDragonSurface(positions,headWeights=null) {
  const stride=Math.max(1,Math.ceil(positions.length/3/3500));
  const count=Math.ceil(positions.length/3/stride);
  samples=new Float32Array(count*3);weights=new Float32Array(count);
  for(let i=0,j=0;i<positions.length/3;i+=stride,j++) {
    samples.set([positions[i*3],positions[i*3+1],positions[i*3+2]],j*3);
    weights[j]=headWeights?headWeights[i]:0;
  }
  surface=null;lastTick=NaN;
}
function updateSurface(time) {
  const tick=Math.floor(time*30);if(surface&&tick===lastTick)return;
  lastTick=tick;const raw=new Float32Array(SIZE*SIZE).fill(LOW),m=headRotation(tick/30);
  for(let i=0;i<samples.length;i+=3){
    const p=moveHeadPoint(samples[i],samples[i+1],samples[i+2],weights[i/3],m);
    const ix=Math.round((p[0]+SPAN/2)/STEP),iy=Math.round((p[1]+SPAN/2)/STEP);
    if(ix>=0&&iy>=0&&ix<SIZE&&iy<SIZE)raw[iy*SIZE+ix]=Math.max(raw[iy*SIZE+ix],p[2]);
  }
  surface=new Float32Array(raw);
  for(let y=1;y<SIZE-1;y++)for(let x=1;x<SIZE-1;x++){
    let high=LOW;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)high=Math.max(high,raw[(y+j)*SIZE+x+i]-.09*Math.hypot(i,j));
    surface[y*SIZE+x]=high;
  }
}
export function sampledDragonBrow(x,y,time) {
  if(!samples)return null;updateSurface(time);
  const p=dragonPose(time),fx=(x-p.x+SPAN/2)/STEP,fy=(y-p.y+SPAN/2)/STEP;
  const ix=Math.round(fx),iy=Math.round(fy),sea=barrierSurface(x,y,time);
  if(ix<1||iy<1||ix>=SIZE-1||iy>=SIZE-1)return sea;
  const z=surface[iy*SIZE+ix];if(z<=sea.z)return sea;
  const at=(i,j)=>Math.max(sea.z,surface[j*SIZE+i]);
  const nx=Math.max(-.65,Math.min(.65,(at(ix-1,iy)-at(ix+1,iy))/(2*STEP))),
    ny=Math.max(-.65,Math.min(.65,(at(ix,iy-1)-at(ix,iy+1))/(2*STEP)));
  const l=Math.hypot(nx,ny,1);return {inside:true,z,nx:nx/l,ny:ny/l,nz:1/l};
}
export function dragonBrow(x,y,time) {
  const sculpt=sampledDragonBrow(x,y,time);if(sculpt)return sculpt;
  // Deterministic test/loading fallback. Asset readiness still gates real play.
  const p=dragonPose(time),rx=x-p.x,ry=y-p.y,inside=(rx/DRAGON.browX)**2+(ry/DRAGON.browY)**2<1;
  if(!inside)return barrierSurface(x,y,time);
  const z=.83+.14*Math.cos(rx*.45)+.12*Math.sin(ry*.55+time*.8),nx=.063*Math.sin(rx*.45),ny=-.066*Math.cos(ry*.55+time*.8),l=Math.hypot(nx,ny,1);
  return {inside,z,nx:nx/l,ny:ny/l,nz:1/l};
}
