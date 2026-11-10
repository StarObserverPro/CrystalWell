/** Fit the circular subject, rather than hard-code a broad empty left panel. */
export function composition(width,height){
  const mainWidth=Math.round(Math.min(width*.73,Math.max(width*.58,height*1.06)));
  const aspect=mainWidth/height, halfHeight=Math.max(height<550?13.0:12.4,12.4/aspect);
  return {mainWidth,sideWidth:width-mainWidth,halfHeight,centerY:1.8};
}

/** Fit the near lip as well as the diameter; fitting width alone crops tall mobile side views. */
export function sideViewDistance(aspect,fovDegrees=42,focusZ=.3) {
  const tangent=Math.tan(fovDegrees*Math.PI/360),radius=12.1,top=12.2,margin=.94;
  return Math.max(radius+(top-focusZ)/(tangent*margin),
    Math.hypot(radius,radius/(tangent*Math.max(.1,aspect)*margin)));
}
