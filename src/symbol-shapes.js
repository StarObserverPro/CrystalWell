/** Continuous, correctly joined 2D silhouettes, extruded by icons-3d.js. */
export const SYMBOLS=Object.freeze(['play','pause','restart','sound','wide','slow','bind','treasure','seal','frame','cross','phone']);
export function restartOutline() {
  const R=.40, half=.095, start=Math.PI*1.15, end=start+Math.PI*1.35, points=[];
  for(let i=0;i<=48;i++){const a=start+(end-start)*i/48;points.push([(R+half)*Math.cos(a),(R+half)*Math.sin(a)]);}
  const c=Math.cos(end),s=Math.sin(end);
  points.push([(R+.23)*c,(R+.23)*s],[R*c-.30*s,R*s+.30*c],[(R-.23)*c,(R-.23)*s]);
  for(let i=48;i>=0;i--){const a=start+(end-start)*i/48;points.push([(R-half)*Math.cos(a),(R-half)*Math.sin(a)]);}
  return points;
}
export function arcOutline(radius,thickness,start,end,steps=24){
  const p=[];for(let i=0;i<=steps;i++){const a=start+(end-start)*i/steps;p.push([(radius+thickness/2)*Math.cos(a),(radius+thickness/2)*Math.sin(a)]);}
  for(let i=steps;i>=0;i--){const a=start+(end-start)*i/steps;p.push([(radius-thickness/2)*Math.cos(a),(radius-thickness/2)*Math.sin(a)]);}return p;
}
