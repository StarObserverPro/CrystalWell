import * as THREE from 'three';

/** High-contrast HDR studio reflections: bright broad panels, dark gaps, no painted outlines. */
export function crystalEnvironment() {
  const w=1024,h=512,data=new Float32Array(w*h*4);
  const panels=[[.10,.30,.020,.20,9.0,[.65,.88,1]], [.37,.38,.045,.12,5.0,[.47,1,.90]],
    [.66,.25,.028,.23,11.0,[.83,.78,1]], [.90,.43,.060,.075,5.0,[1,.90,.72]]];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const u=x/w,v=y/h,i=(y*w+x)*4;
    let c=[.025+.08*(1-v),.04+.11*(1-v),.075+.16*(1-v)];
    for(const [px,py,sx,sy,power,tint] of panels){
      const dx=Math.min(Math.abs(u-px),1-Math.abs(u-px))/sx,dy=(v-py)/sy;
      const f=Math.exp(-Math.pow(dx,6)-Math.pow(dy,8))*power;
      c=c.map((a,k)=>a+f*tint[k]);
    }
    data.set([...c,1],i);
  }
  const texture=new THREE.DataTexture(data,w,h,THREE.RGBAFormat,THREE.FloatType);
  texture.mapping=THREE.EquirectangularReflectionMapping;texture.needsUpdate=true;return texture;
}
/** Single-pass crystal: broad reflected facets and tinted interior, no scene capture or ray loops. */
export function opticalCrystal(color,thickness=1.6,environment=null) {
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.FrontSide,
    uniforms:{uTint:{value:new THREE.Color(color)},uEnvironment:{value:environment},uThickness:{value:thickness}},
    vertexShader:`varying vec3 vWorld,vNormal;
      void main(){vec4 p=modelMatrix*vec4(position,1.);vWorld=p.xyz;vNormal=normalize(mat3(modelMatrix)*normal);
        gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader:`uniform vec3 uTint;uniform sampler2D uEnvironment;uniform float uThickness;
      varying vec3 vWorld,vNormal;
      vec3 sky(vec3 d){d=normalize(d);return texture2D(uEnvironment,vec2(atan(d.z,d.x)*.15915494+.5,asin(clamp(d.y,-1.,1.))*.31830989+.5)).rgb;}
      void main(){vec3 N=normalize(vNormal),V=normalize(cameraPosition-vWorld);float facing=abs(dot(N,V));
        float fresnel=.10+.70*pow(1.-facing,4.);
        vec3 R=reflect(-V,N),reflected=sky(R),interior=sky(normalize(R+N*.24));
        float path=uThickness/max(.40,facing);vec3 absorb=exp(-(1.-uTint)*path*.40);
        float key=.45+.55*max(0.,dot(N,normalize(vec3(-.45,-.35,1.))));
        vec3 color=uTint*key*.34+reflected*(.16+.70*fresnel)+interior*uTint*absorb*.14;
        color+=uTint*pow(max(dot(reflect(normalize(vec3(.45,.35,-1.)),N),V),0.),48.)*.85;
        gl_FragColor=vec4(color,mix(.84,.98,fresnel));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  material.userData.optics='single-pass reflected facets; no transmission capture';return material;
}

/** Ten joined elongated prisms with broad irregular cuts. Shared end profiles avoid pebble gaps. */
export function rimSegmentGeometry(index,count=10) {
  const positions=[],indices=[],sides=6,stations=4,step=Math.PI*2/count;
  const profile=(a,t)=>{
    const swell=Math.sin(Math.PI*t),outer=11.35+.13*Math.sin(a*3+.4)+swell*.16*Math.sin(index*2.4),inner=9.86+.045*Math.sin(a*5)-swell*.07;
    const low=10.30+.10*Math.sin(a*4),top=11.38+.20*Math.sin(a*3+.7)+swell*(.12+.18*Math.sin(index*1.7));
    return [[inner,low+.08],[inner,top-.32],[inner+.25,top],
      [outer-.24,top+.05*Math.sin(a*7)],[outer,top-.35],[outer,low]];
  };
  for(let k=0;k<stations;k++){
    const t=k/(stations-1),a=step*(index+t)-.006+t*.012;
    for(const [r,z] of profile(a,t))positions.push(Math.cos(a)*r,Math.sin(a)*r,z);
  }
  for(let k=0;k<stations-1;k++)for(let j=0;j<sides;j++){
    const a=k*sides+j,b=k*sides+(j+1)%sides,c=b+sides,d=a+sides;
    indices.push(a,b,c,a,c,d);
  }
  for(let j=1;j<sides-1;j++){indices.push(0,j+1,j);const o=(stations-1)*sides;indices.push(o,o+j,o+j+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);
  const flat=g.toNonIndexed();g.dispose();flat.computeVertexNormals();flat.computeBoundingBox();return flat;
}
