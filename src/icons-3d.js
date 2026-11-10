import * as THREE from 'three';
import { put, polygon, batchStatic } from './model-kit.js';
import { restartOutline,arcOutline,SYMBOLS } from './symbol-shapes.js';

/** Shape first, crystal second. No detached triangle glued onto a ring. */
export function emblem(kind, material) {
  if(!SYMBOLS.includes(kind))throw new Error(`Unknown emblem: ${kind}`);
  const g=new THREE.Group();g.name=`Solid ${kind}`;g.userData.kind=kind;
  const shape=(p,x=0,y=0)=>put(g,polygon(p,.19,.025),material,[x,y,0]);
  const rect=(x,y,w,h)=>shape([[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]],x,y);
  if(kind==='restart')shape(restartOutline());
  else if(kind==='play')shape([[-.34,-.48],[.49,0],[-.34,.48]]);
  else if(kind==='pause'){rect(-.24,0,.22,.91);rect(.24,0,.22,.91);}
  else if(kind==='sound'){
    shape([[-.51,-.17],[-.29,-.17],[.04,-.43],[.04,.43],[-.29,.17],[-.51,.17]]);
    shape(arcOutline(.43,.13,-.83,.83),-.02,0);
  } else if(kind==='wide'){
    shape([[-.70,0],[-.35,-.28],[-.35,-.10],[-.10,-.10],[-.10,.10],[-.35,.10],[-.35,.28]]);
    shape([[.70,0],[.35,.28],[.35,.10],[.10,.10],[.10,-.10],[.35,-.10],[.35,-.28]]);
  } else if(kind==='slow'){
    // Two opposed bowls with a connected waist; broad caps make an unmistakable hourglass.
    shape([[-.40,.42],[.40,.42],[.31,.22],[.11,.02],[.11,-.02],[.31,-.22],[.40,-.42],[-.40,-.42],[-.31,-.22],[-.11,-.02],[-.11,.02],[-.31,.22]]);
    rect(0,.51,.93,.13);rect(0,-.51,.93,.13);
  } else if(kind==='bind'){
    shape(arcOutline(.38,.17,-.10,Math.PI+.10),0,-.03);
    shape([[-.47,-.04],[.47,-.04],[.47,-.49],[-.47,-.49]]);
    put(g,new THREE.OctahedronGeometry(.13,1),material,[0,-.24,.19]);
  } else if(kind==='treasure'||kind==='seal'){
    shape([[-.46,.14],[-.25,.44],[.25,.44],[.46,.14],[0,-.49]]);
  } else if(kind==='cross'){
    const a=rect(0,0,.19,1);a.rotation.z=Math.PI/4;const b=rect(0,0,.19,1);b.rotation.z=-Math.PI/4;
  } else if(kind==='phone'){
    shape([[-.30,-.52],[.30,-.52],[.30,.52],[-.30,.52]]);
    put(g,new THREE.BoxGeometry(.29,.055,.06),material,[0,.37,.15]);
  } else {const m=put(g,new THREE.BoxGeometry(.72,.62,.38),material);m.rotation.set(.35,.35,.1);}
  return batchStatic(g);
}
