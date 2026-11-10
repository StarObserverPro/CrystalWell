import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { dragonPose, installDragonSurface } from './dragon-shape.js';
import { DRAGON_FIT, NECK_PIVOT, fitDragonPoint, headWeight, isFaceCore, headRotation } from './dragon-anatomy.js';
import { BARRIER } from './barrier-math.js';

/** The same licensed sculpt, now fitted by the facial core, not by horns or whiskers. */
export function makeDragon() {
  const root=new THREE.Group();root.name='Grab3D Chinese Dragon / fitted facial core';
  root.userData.ready=false;root.userData.source='Grab3D Chinese Dragon (CC0-1.0, AI-assisted origin)';
  const model=new THREE.Group();root.add(model);
  const riseUniform={value:0},motion={value:new THREE.Matrix3()},pivot={value:new THREE.Vector3(...NECK_PIVOT)};
  root.userData.fit=DRAGON_FIT;root.userData.motion=motion;
  root.userData.readyPromise=new GLTFLoader().loadAsync('./assets/dragon/chinese-dragon-source.glb').then(gltf=>{
    const samples=[],sampleWeights=[];let triangles=0;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(o=>{
      if(!o.isMesh)return;
      const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld),pos=geometry.attributes.position,
        source=new Float32Array(pos.count*3),weights=new Float32Array(pos.count);
      for(let i=0;i<pos.count;i++){
        const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),f=fitDragonPoint(x,y,z),w=headWeight(x,y,z);
        source.set([x,y,z],i*3);weights[i]=w;pos.setXYZ(i,...f);
        if(isFaceCore(x,y,z)&&Math.abs(f[0])<8.65&&Math.abs(f[1])<8.1){samples.push(...f);sampleWeights.push(w);}
      }
      geometry.setAttribute('aDragonSource',new THREE.BufferAttribute(source,3));
      geometry.setAttribute('aHeadWeight',new THREE.BufferAttribute(weights,1));
      geometry.computeVertexNormals();geometry.computeBoundingSphere();
      const material=new THREE.MeshPhysicalMaterial({
        map:o.material.map,color:0xffffff,metalness:.10,roughness:.20,
        clearcoat:.85,clearcoatRoughness:.11,envMapIntensity:.40,
        transmission:.08,thickness:1.30,ior:1.52,
        attenuationColor:new THREE.Color(0x4abcc6),attenuationDistance:7,
      });
      material.onBeforeCompile=shader=>{
        Object.assign(shader.uniforms,{cwSealRise:riseUniform,cwHeadRotation:motion,cwNeckPivot:pivot});
        shader.vertexShader=`attribute float aHeadWeight;attribute vec3 aDragonSource;
          uniform mat3 cwHeadRotation;uniform vec3 cwNeckPivot;
          varying vec3 cwDragonPosition;varying vec3 cwSource;\n`+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`
          #include <beginnormal_vertex>
          objectNormal=normalize(mix(objectNormal,cwHeadRotation*objectNormal,aHeadWeight));
        `).replace('#include <begin_vertex>',`
          #include <begin_vertex>
          transformed=mix(transformed,cwNeckPivot+cwHeadRotation*(transformed-cwNeckPivot),aHeadWeight);
          cwDragonPosition=(modelMatrix*vec4(transformed,1.)).xyz;cwSource=aDragonSource;
        `);
        shader.fragmentShader='varying vec3 cwDragonPosition;varying vec3 cwSource;uniform float cwSealRise;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('void main() {',`void main(){
          // Only the sealed region is constrained by the well. The lower body is never z-clipped.
          if(cwDragonPosition.z>${(BARRIER.z-.8).toFixed(6)} && length(cwDragonPosition.xy)>9.65+cwSealRise*80.)discard;
        `).replace('#include <map_fragment>',`
          #include <map_fragment>
          float warmMask=smoothstep(-.01,.16,diffuseColor.r-diffuseColor.g);
          float value=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
          float cheek=smoothstep(.22,.78,abs(cwSource.x-.20));
          float muzzle=smoothstep(2.72,3.36,cwSource.z)*smoothstep(3.75,4.20,cwSource.y);
          vec3 jade=mix(vec3(.035,.31,.26),vec3(.16,.115,.36),cheek*.68);
          jade=mix(jade,vec3(.16,.45,.53),muzzle*.70);
          vec3 amber=mix(vec3(.18,.075,.02),vec3(.38,.19,.055),smoothstep(3.6,5.2,cwSource.y));
          vec3 pigment=mix(jade,amber,warmMask*.94);
          float neck=smoothstep(2.55,3.80,cwSource.y);
          diffuseColor.rgb=pigment*(.20+.83*pow(value,.45))*mix(.62,1.,neck);
          diffuseColor.rgb*=mix(.10,1.,smoothstep(.018,.12,value));
        `);
      };
      material.customProgramCacheKey=()=> 'external-dragon-anatomical-v05';
      const mesh=new THREE.Mesh(geometry,material);mesh.name='Licensed sculpt / weighted neck articulation';
      // Vertex articulation can extend beyond the rest-pose bounds.
      mesh.frustumCulled=false;model.add(mesh);
      triangles+=(geometry.index?geometry.index.count:pos.count)/3;
    });
    installDragonSurface(samples,sampleWeights);
    Object.assign(root.userData,{ready:true,model,triangles,silhouetteWidth:DRAGON_FIT.coreWidth,
      faceSamples:samples.length/3,coreIsEstimate:true});
    return root;
  }).catch(error=>{root.userData.loadError=String(error);throw error;});
  root.userData.update=(time,rise=0)=>{
    const p=dragonPose(time),t=THREE.MathUtils.smoothstep(rise,0,1);riseUniform.value=rise;
    motion.value.fromArray(headRotation(time));
    root.position.set(p.x,p.y,t*74);
    root.rotation.set(t*.40,0,t*Math.PI*.70);
  };
  return root;
}
