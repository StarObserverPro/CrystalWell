import * as THREE from 'three';
import { put, polygon, batchStatic } from './model-kit.js';

/** Chunky sculpted symbols, shared by HUD and the physical pickup bubbles. Unit-size models. */
export function emblem(kind, material) {
  const g = new THREE.Group(); g.name = `Sculpted ${kind}`;
  const bar = (x, y, w, h, angle = 0) => {
    const m = put(g, polygon([[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]], .16, .035), material, [x,y,0]);
    m.rotation.z = angle; return m;
  };
  if (kind === 'pause') { bar(-.24, 0, .20, .86); bar(.24, 0, .20, .86); }
  else if (kind === 'play') put(g, polygon([[-.34,-.49],[.50,0],[-.34,.49]], .22, .035), material);
  else if (kind === 'restart') {
    put(g, new THREE.TorusGeometry(.37,.095,10,42,Math.PI*1.65),material).rotation.z=.3;
    const arrow=put(g,polygon([[-.18,-.16],[.20,0],[-.18,.16]],.18,.025),material,[.23,-.30,.01]);
    arrow.rotation.z=-.6;
  } else if (kind === 'sound') {
    put(g,polygon([[-.43,-.18],[-.20,-.18],[.12,-.43],[.12,.43],[-.20,.18],[-.43,.18]],.24,.035),material);
    const arc=put(g,new THREE.TorusGeometry(.34,.065,8,24,Math.PI*.8),material,[.03,0,0]);arc.rotation.z=-Math.PI*.4;
  } else if (kind === 'wide') {
    const disc=put(g,new THREE.IcosahedronGeometry(.34,1),material);disc.scale.set(1,1,.42);
    for(const s of [-1,1]) {
      put(g,polygon([[s*.72,0],[s*.38,.3],[s*.38,-.3]],.16,.025),material);
    }
  } else if (kind === 'slow') {
    const top=put(g,new THREE.ConeGeometry(.39,.42,8),material,[0,.2,0]);top.rotation.z=Math.PI;
    put(g,new THREE.ConeGeometry(.39,.42,8),material,[0,-.2,0]);
    bar(0,.46,.85,.12);bar(0,-.46,.85,.12);
  } else if (kind === 'bind') {
    put(g,new THREE.IcosahedronGeometry(.20,1),material,[0,0,.1]);
    for(let i=0;i<3;i++) { const a=i*Math.PI*2/3;
      const m=put(g,new THREE.OctahedronGeometry(1,0),material,[Math.cos(a)*.36,Math.sin(a)*.36,0],[.28,.13,.15]);m.rotation.z=a;
    }
  } else if (kind === 'treasure' || kind === 'seal') {
    const m=put(g,new THREE.OctahedronGeometry(.56,1),material);m.scale.set(.72,1,.55);
    if(kind==='treasure') for(const s of [-1,1]) put(g,new THREE.OctahedronGeometry(.23,0),material,[s*.48,-.17,0]);
  } else if (kind === 'frame') {
    const m=put(g,new THREE.BoxGeometry(.72,.62,.38),material);m.rotation.set(.35,.35,.1);
  } else if (kind === 'cross') { bar(0,0,.18,1,.78);bar(0,0,.18,1,-.78); }
  else if (kind === 'phone') {
    put(g,polygon([[-.28,-.53],[.28,-.53],[.28,.53],[-.28,.53]],.16,.07),material);
  }
  return batchStatic(g);
}
