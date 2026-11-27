import { RULES } from './physics.js';
import { CAMERA_TILT } from './visual-math.js';

export const MAIN_FOCUS_Z = 5.3;
const RIM_RADIUS = 11.8, RIM_TOP_Z = 12;
const cosTilt = Math.cos(CAMERA_TILT), sinTilt = Math.sin(CAMERA_TILT);
const sealRadius = RULES.crystalRadius + Math.SQRT2 * RULES.brickHalf;
const frameTop = RIM_RADIUS * cosTilt + (RIM_TOP_Z - MAIN_FOCUS_Z) * sinTilt;
const frameBottom = -sealRadius * cosTilt + (RULES.brickBottom - RULES.brickHalf - MAIN_FOCUS_Z) * sinTilt;

/** Fit the far lip and the near underside of the lowered seal throughout the orbit. */
export function composition(width,height){
  const mainWidth=Math.round(Math.min(width*.73,Math.max(width*.58,height*1.06)));
  const aspect=mainWidth/height;
  const halfHeight=Math.max((frameTop-frameBottom)/2+.35,11.95/aspect);
  return {mainWidth,sideWidth:width-mainWidth,halfHeight,centerY:(frameTop+frameBottom)/2};
}

/** Fit the near lip as well as the diameter; fitting width alone crops tall mobile side views. */
export function sideViewDistance(aspect,fovDegrees=42,focusZ=.3) {
  const tangent=Math.tan(fovDegrees*Math.PI/360),margin=.97;
  return Math.max(RIM_RADIUS+(RIM_TOP_Z-focusZ)/(tangent*margin),
    Math.hypot(RIM_RADIUS,RIM_RADIUS/(tangent*Math.max(.1,aspect)*margin)));
}
