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
export function opticalCrystal(color,thickness=1.6,environment=null) {
  const material = new THREE.MeshPhysicalMaterial({color,metalness:0,roughness:.055,transmission:.93,opacity:1,
    thickness,ior:1.58,dispersion:.34,clearcoat:1,clearcoatRoughness:.035,
    attenuationColor:new THREE.Color(color),attenuationDistance:3.8,envMapIntensity:1.7,
    flatShading:true,side:THREE.FrontSide});
  if(environment){
    material.onBeforeCompile=shader=>{
      shader.uniforms.cwOpticalEnvironment={value:environment};
      shader.vertexShader='varying mat3 cwModel; varying vec3 cwLocal; varying vec3 cwEye;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
        #include <begin_vertex>
        cwLocal=position;cwModel=mat3(modelMatrix);
        cwEye=(inverse(modelMatrix)*vec4(cameraPosition,1.)).xyz;
      `);
      shader.fragmentShader=`
        uniform sampler2D cwOpticalEnvironment; varying mat3 cwModel;
        varying vec3 cwLocal; varying vec3 cwEye;
        vec3 cwSky(vec3 dir){
          dir=normalize(cwModel*dir);
          vec2 uv=vec2(atan(dir.z,dir.x)*.15915494+.5,asin(clamp(dir.y,-1.,1.))*.31830989+.5);
          return texture2D(cwOpticalEnvironment,uv).rgb;
        }
        // Three internal bounces in an approximate seven-sided cut volume.
        // The outer material still supplies actual screen-space transmission.
        vec3 cwPrism(vec3 p,vec3 d){
          vec3 light=vec3(0.);float weight=.55;
          p*=.90;
          for(int bounce=0;bounce<3;bounce++){
            float nearT=100.;vec3 hitN=vec3(0.,0.,1.);
            for(int j=0;j<16;j++){
              vec3 n;float h;
              if(j<14){
                float a=float(j/2)*.8975979;
                n=normalize(vec3(cos(a),sin(a),j-2*(j/2)==0?.72:-.60));h=.82;
              }else{n=vec3(0.,0.,j==14?1.:-1.);h=.62;}
              float den=dot(n,d),t=(h-dot(n,p))/max(den,.0001);
              if(den>.0001&&t>.002&&t<nearT){nearT=t;hitN=n;}
            }
            vec3 escape=refract(d,-hitN,1.58);
            if(dot(escape,escape)>.01){light+=cwSky(escape)*weight;weight*=.30;}
            else weight*=.82;
            p+=d*min(nearT,2.);d=reflect(d,hitN);p+=d*.006;
          }
          return light+cwSky(d)*weight;
        }
      `+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
        vec3 cwN=normalize(cross(dFdx(cwLocal),dFdy(cwLocal)));
        vec3 cwIncoming=normalize(cwLocal-cwEye);
        if(dot(cwN,cwIncoming)>0.)cwN=-cwN;
        vec3 cwInternal=cwPrism(cwLocal,refract(cwIncoming,cwN,1./1.58));
        outgoingLight+=cwInternal*diffuse*.72;
        #include <opaque_fragment>
      `);
    };
    material.customProgramCacheKey=()=> 'optical-crystal-prism-bounces-v04';
  }
  return material;
}
/** Closed 32-facet asymmetric crystal. Each block has broad readable faces. */
export function gemGeometry(seed=1) {
  let n=seed>>>0;const rand=()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return(n>>>0)/4294967296;};
  const sides=7,vertices=[],faces=[];const angles=[];
  for(let j=0;j<sides;j++)angles.push(j*Math.PI*2/sides+(rand()-.5)*.16);
  for(let k=0;k<3;k++)for(let j=0;j<sides;j++){
    const a=angles[j],r=(k===1?1:k===0?.70:.55)*( .91+rand()*.16);
    vertices.push(Math.cos(a)*r,Math.sin(a)*r,(k===0?-.52:k===1?-.05:.56)+(rand()-.5)*.12);
  }
  for(let k=0;k<2;k++)for(let j=0;j<sides;j++){
    const a=k*sides+j,b=k*sides+(j+1)%sides,c=b+sides,d=a+sides;faces.push(a,b,c,a,c,d);
  }
  for(let j=1;j<sides-1;j++){faces.push(0,j+1,j);faces.push(14,14+j,14+j+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(faces);
  const flat=g.toNonIndexed();g.dispose();flat.computeVertexNormals();return flat;
}
