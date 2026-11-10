/** Art-space measurements of the bundled sculpt, NOT a claim about dragon anatomy.
 * Hair/horns are excluded by a central facial ROI and the original green skin mask.
 * Source +Y runs along the neck; +Z is facial depth; game +Z is vertical.
 */
export const DRAGON_FIT = Object.freeze({
  sourceSkullWidth: 1.134, sourceBodyDiameter: .970,
  headToBody: 1.75, coreWidth: 15.55, wellDiameter: 19.44,
  center: Object.freeze([.227, 4.32, 2.60]),
  pitch: 26 * Math.PI / 180,
  // The upper facial contact surface stays below the first brick layer.
  faceTop: .80, verticalOffset: -6.917136,
});
export const MODEL_SCALE = DRAGON_FIT.coreWidth / DRAGON_FIT.headToBody / DRAGON_FIT.sourceBodyDiameter;
export const HEAD_WIDEN = DRAGON_FIT.headToBody * DRAGON_FIT.sourceBodyDiameter / DRAGON_FIT.sourceSkullWidth;
export const smooth = (a,b,x) => { const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t); };
export function headWeight(x,y,z) { return smooth(3.05,3.95,y)*smooth(.7,1.7,z); }
export function isFaceCore(x,y,z) {
  // Spatially exclude whiskers, horns and the long trailing mane, not just their bounding box.
  return x>-.48 && x<.94 && y>3.77 && y<4.94 && z>1.80 && z<3.46;
}
function basicFit(x,y,z) {
  const w=headWeight(x,y,z),c=DRAGON_FIT.center;
  x=(x-c[0])*(1+(HEAD_WIDEN-1)*w)*MODEL_SCALE;
  y=(y-c[1])*MODEL_SCALE;
  z=(z-c[2])*MODEL_SCALE;
  const cs=Math.cos(DRAGON_FIT.pitch),sn=Math.sin(DRAGON_FIT.pitch);
  return [x,y*cs-z*sn,y*sn+z*cs+DRAGON_FIT.verticalOffset];
}
export const NECK_PIVOT = Object.freeze(basicFit(-.10,3.25,2.00));
export function fitDragonPoint(x,y,z) {
  const p=basicFit(x,y,z),w=headWeight(x,y,z),n=NECK_PIVOT;
  const dx=p[0]-n[0],dy=p[1]-n[1],dz=p[2]-n[2];
  // Fixed neck articulation brings the face towards the incoming ball, independent of camera orbit.
  const cx=Math.cos(-.20943951),sx=Math.sin(-.20943951),cy=Math.cos(-.34906585),sy=Math.sin(-.34906585);
  const py=dy*cx-dz*sx,pz=dy*sx+dz*cx;
  return [p[0]+w*(dx*cy+pz*sy-dx),p[1]+w*(py-dy),p[2]+w*(-dx*sy+pz*cy-dz)];
}
export function headAngles(t) {
  return { pitch:Math.sin(t*1.72)*.032, yaw:Math.sin(t*1.37+.4)*.049,
    roll:Math.sin(t*.91+.8)*.013 };
}
/** Column-major rotation, Rz * Ry * Rx. Shared verbatim by shader and collision samples. */
export function headRotation(t) {
  const a=headAngles(t),cx=Math.cos(a.pitch),sx=Math.sin(a.pitch),
    cy=Math.cos(a.yaw),sy=Math.sin(a.yaw),cz=Math.cos(a.roll),sz=Math.sin(a.roll);
  return [cz*cy,sz*cy,-sy, cz*sy*sx-sz*cx,sz*sy*sx+cz*cx,cy*sx,
    cz*sy*cx+sz*sx,sz*sy*cx-cz*sx,cy*cx];
}
export function moveHeadPoint(x,y,z,w,m) {
  const p=NECK_PIVOT,dx=x-p[0],dy=y-p[1],dz=z-p[2];
  return [x+w*(m[0]*dx+m[3]*dy+m[6]*dz-dx),
    y+w*(m[1]*dx+m[4]*dy+m[7]*dz-dy),z+w*(m[2]*dx+m[5]*dy+m[8]*dz-dz)];
}
