import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { dragonPose, installDragonSurface } from './dragon-shape.js';

/** External CC0 model: see assets/dragon/provenance.json. No generated replacement head. */
export function makeDragon() {
  const root = new THREE.Group(); root.name = 'Grab3D Chinese Dragon / external GLB';
  root.userData.ready = false;
  root.userData.source = 'Grab3D Chinese Dragon (CC0-1.0, AI-assisted origin)';
  const model = new THREE.Group(); root.add(model);
  const sealRise={value:0};
  root.userData.readyPromise = new GLTFLoader().loadAsync('./assets/dragon/chinese-dragon-source.glb').then(gltf => {
    const samples = [];
    gltf.scene.updateMatrixWorld(true);
    const pitch = new THREE.Matrix4().makeRotationX(0);
    const scale = 5.20, heightScale=3.50, depthScale=3.70, centerY = 3.70, top = 3.999325;
    const transform = new THREE.Matrix4().makeTranslation(0, -centerY*heightScale, 1.05-top*depthScale)
      .multiply(new THREE.Matrix4().makeScale(scale,heightScale,depthScale)).multiply(pitch);
    gltf.scene.traverse(o => {
      if (!o.isMesh) return;
      const geometry = o.geometry.clone().applyMatrix4(transform.clone().multiply(o.matrixWorld));
      const original = o.material;
      const material = new THREE.MeshPhysicalMaterial({
        map: original.map, color: 0xffffff, metalness: .18, roughness: .13,
        clearcoat: 1, clearcoatRoughness: .06, envMapIntensity: .65,
        transmission: .06, thickness: 1.15, ior: 1.52,
        attenuationColor: new THREE.Color(0x64cdd9), attenuationDistance: 6,
      });
      // Retain the external asset's sculpt and albedo detail, but recolor its jade/gold zones.
      material.onBeforeCompile = shader => {
        shader.uniforms.cwSealRise=sealRise;
        shader.vertexShader='varying vec3 cwDragonPosition;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
          #include <begin_vertex>
          cwDragonPosition=(modelMatrix*vec4(position,1.)).xyz;
        `);
        shader.fragmentShader='varying vec3 cwDragonPosition;uniform float cwSealRise;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('void main() {',`void main() {
          if(length(cwDragonPosition.xy)>9.65+cwSealRise*80. || cwDragonPosition.z < -11.25-cwSealRise*80.)discard;
        `);
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
          #include <map_fragment>
          float cwGold=smoothstep(-.015,.15,diffuseColor.r-diffuseColor.g);
          float cwL=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
          vec3 cwIce=mix(vec3(.07,.34,.46),vec3(.32,.57,.73),cwGold);
          diffuseColor.rgb=cwIce*(.23+.91*pow(cwL,.38));
          diffuseColor.rgb*=mix(.13,1.,smoothstep(.015,.11,cwL));
        `);
      };
      material.customProgramCacheKey=()=> 'external-dragon-ice-v04';
      const mesh = new THREE.Mesh(geometry,material); mesh.name='Licensed dragon sculpt'; model.add(mesh);
      const pos=geometry.attributes.position;
      for(let i=0;i<pos.count;i++) samples.push(pos.getX(i),pos.getY(i),pos.getZ(i));
      o.geometry.dispose();
    });
    installDragonSurface(samples);
    root.userData.ready = true;
    root.userData.model = model;
    root.userData.silhouetteWidth = 17.04;
    root.userData.triangles = 399999;
    return root;
  }).catch(error => { root.userData.loadError=String(error); throw error; });
  root.userData.update=(time,rise=0)=>{
    const p=dragonPose(time), t=THREE.MathUtils.smoothstep(rise,0,1);sealRise.value=rise;
    root.position.set(p.x,p.y,t*52);
    root.rotation.set(t*.85,Math.sin(time*.55)*.008,t*Math.PI*.70+Math.sin(time*.4)*.008);
  };
  return root;
}
