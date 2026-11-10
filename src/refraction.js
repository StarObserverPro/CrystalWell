import * as THREE from 'three';

import { REFRACTION,refractionSize } from './optics-rules.js';
export { REFRACTION,refractionSize };

/** Single non-recursive main-view background capture. Side view never samples a mismatched camera. */
export class LimitedRefraction {
  constructor(renderer) {
    this.renderer=renderer;this.enabled=true;this.last=-Infinity;this.version=-1;this.captures=0;
    this.blank=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1);this.blank.needsUpdate=true;
    this.target=new THREE.WebGLRenderTarget(1,1,{depthBuffer:true,stencilBuffer:false,
      type:renderer.extensions.has('EXT_color_buffer_float')?THREE.HalfFloatType:THREE.UnsignedByteType,
      minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,generateMipmaps:false});
    this.target.texture.colorSpace=THREE.LinearSRGBColorSpace;
    this.viewport=new THREE.Vector4();this.scissor=new THREE.Vector4();
  }
  resize(w,h,dpr){const size=refractionSize(w,h,dpr);this.target.setSize(...size);this.invalidate();}
  invalidate(){this.last=-Infinity;}
  capture(scene,world,camera,now) {
    const uniforms=world.crystals.material.uniforms;world.refractionEnabled=this.enabled;
    if(!this.enabled){uniforms.uRefraction.value=0;return false;}
    if(now-this.last<1000/REFRACTION.hz&&this.version===world.fieldVersion)return false;
    const r=this.renderer,oldTarget=r.getRenderTarget(),oldTone=r.toneMapping,
      oldScissor=r.getScissorTest(),hidden=[];
    r.getViewport(this.viewport);r.getScissor(this.scissor);
    // Remove moving gameplay cues from the optical source: one real ball, never refracted duplicates.
    for(const o of [world.ball,world.ballHalo,world.ghost,world.sideGhost,world.shield,world.predictor,
      world.rim,world.wilderness,world.wildernessRocks,...world.bubbles]){
      if(o){hidden.push([o,o.visible]);o.visible=false;}
    }
    world.capturePass=true;
    try{
      // Detach the texture before binding it as an output: no framebuffer feedback loop.
      uniforms.uBackground.value=this.blank;uniforms.uRefraction.value=0;
      r.toneMapping=THREE.NoToneMapping;r.setRenderTarget(this.target);r.setScissorTest(false);
      r.setViewport(0,0,this.target.width,this.target.height);r.clear(true,true,false);
      world.prepareView(camera,false,now);r.render(scene,camera);
      this.last=now;this.version=world.fieldVersion;this.captures++;
    }finally{
      for(const [o,visible] of hidden)o.visible=visible;
      world.capturePass=false;r.toneMapping=oldTone;r.setRenderTarget(oldTarget);
      r.setViewport(this.viewport);r.setScissor(this.scissor);r.setScissorTest(oldScissor);
      uniforms.uBackground.value=this.target.texture;
      uniforms.uBackgroundSize.value.set(this.target.width,this.target.height);
    }
    return true;
  }
  dispose(){this.blank.dispose();this.target.dispose();}
}
