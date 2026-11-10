/** Fit the circular subject, rather than hard-code a broad empty left panel. */
export function composition(width,height){
  const mainWidth=Math.round(Math.min(width*.73,Math.max(width*.58,height*1.06)));
  const aspect=mainWidth/height, halfHeight=Math.max(height<550?13.0:12.4,12.4/aspect);
  return {mainWidth,sideWidth:width-mainWidth,halfHeight,centerY:1.8};
}
