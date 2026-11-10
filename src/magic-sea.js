import * as THREE from 'three';
import { BARRIER } from './barrier-math.js';

/** One bounded horizontal surface. Analytic normals and physics use the same three waves. */
export class MagicSea {
  constructor(scene,environment) {
    const rings=40,sectors=112,positions=[0,0,0],indices=[];
    for(let r=1;r<=rings;r++)for(let s=0;s<sectors;s++){
      const a=s*Math.PI*2/sectors,d=BARRIER.radius*r/rings;positions.push(Math.cos(a)*d,Math.sin(a)*d,0);
    }
    for(let s=0;s<sectors;s++)indices.push(0,1+s,1+(s+1)%sectors);
    for(let r=1;r<rings;r++)for(let s=0;s<sectors;s++){
      const a=1+(r-1)*sectors+s,b=1+(r-1)*sectors+(s+1)%sectors;
      indices.push(a,a+sectors,b,b,a+sectors,b+sectors);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);
    this.impacts=Array.from({length:6},()=>new THREE.Vector4(0,0,-100,0));this.cursor=0;
    this.material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
      uniforms:{uTime:{value:0},uRise:{value:0},uEye:{value:new THREE.Vector3()},uEnvironment:{value:environment},uImpacts:{value:this.impacts}},
      vertexShader:`
        uniform float uTime;varying vec3 vWorld;varying vec3 vNormal;
        void main(){vec3 p=position;float z=${BARRIER.z.toFixed(6)};vec2 dz=vec2(0.);
          ${BARRIER.waves.map(([a,x,y,w],i)=>`float t${i}=dot(p.xy,vec2(${x},${y}))+uTime*${w};z+=${a}*sin(t${i});dz+=${a}*vec2(${x},${y})*cos(t${i});`).join('\n')}
          p.z=z;vNormal=normalize(vec3(-dz,1.));vWorld=(modelMatrix*vec4(p,1.)).xyz;
          gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);
        }`,
      fragmentShader:`
        uniform float uTime,uRise;uniform vec3 uEye;uniform sampler2D uEnvironment;uniform vec4 uImpacts[6];
        varying vec3 vWorld,vNormal;
        vec3 environment(vec3 d){return texture2D(uEnvironment,vec2(atan(d.z,d.x)*.15915494+.5,asin(clamp(d.y,-1.,1.))*.31830989+.5)).rgb;}
        void main(){
          vec3 N=normalize(vNormal),V=normalize(uEye-vWorld);float f=pow(1.-abs(dot(N,V)),3.);
          float wave=pow(1.-abs(sin(vWorld.x*1.15+vWorld.y*.73+uTime*.65)*sin(vWorld.y*1.38-vWorld.x*.49-uTime*.52)),10.);
          float swell=.5+.5*sin(vWorld.x*.29-vWorld.y*.37+uTime*.55);
          vec3 color=mix(vec3(.018,.15,.24),vec3(.05,.31,.33),swell);
          color+=environment(reflect(-V,N))*.15*(.22+f)+vec3(.06,.32,.40)*wave*.65;
          float ripple=0.;for(int i=0;i<6;i++){
            float age=uTime-uImpacts[i].z;
            if(age>=0.&&age<2.4){float d=length(vWorld.xy-uImpacts[i].xy);ripple+=exp(-pow((d-age*3.2)*2.7,2.))*exp(-age*1.25)*uImpacts[i].w;}
          }
          color+=vec3(.22,.68,.72)*ripple;
          float rim=1.-smoothstep(12.4,12.8,length(vWorld.xy));
          float alpha=(.43+.13*f+.08*wave+.12*ripple)*rim*(1.-smoothstep(.1,.85,uRise));
          gl_FragColor=vec4(color,alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`});
    this.mesh=new THREE.Mesh(geometry,this.material);this.mesh.name='Undulating horizontal magical sea';this.mesh.renderOrder=2;this.mesh.frustumCulled=false;
    scene.add(this.mesh);
  }
  impact(x,y,time,strength=1){this.impacts[this.cursor++%this.impacts.length].set(x,y,time,strength);}
  update(time,rise=0){this.material.uniforms.uTime.value=time;this.material.uniforms.uRise.value=rise;this.mesh.visible=rise<.88;}
  view(camera){this.material.uniforms.uEye.value.copy(camera.position);}
  reset(){for(const v of this.impacts)v.set(0,0,-100,0);this.cursor=0;}
}
