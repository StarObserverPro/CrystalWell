import * as THREE from 'three';
import { LuminousCrystalWorld } from './presentation.js';
import { RULES,clamp } from './physics.js';
import { wallMaterial } from './crystal-material.js';
import { crystalEnvironment,opticalCrystal,gemGeometry } from './gem-optics.js';
import { emblem } from './icons-3d.js';
import { crystal,put } from './model-kit.js';
import { QUALITY } from './quality.js';

const COLORS={wide:0x71e6d6,slow:0x8aaeff,bind:0xca98ff,treasure:0xffd383};
export class RefinedCrystalWorld extends LuminousCrystalWorld {
  constructor(scene,game){
    super(scene,game);
    this.bubbles=Array.from({length:QUALITY.maxBubbles},()=>this.createBubble());
    this.holdMaterial=new THREE.MeshBasicMaterial({color:0x87fff2,transparent:true,opacity:.84,
      depthTest:false,depthWrite:false,side:THREE.DoubleSide});
    this.heldCue=new THREE.Group();this.heldCue.name='Above-shield held-ball beacon';this.shield.add(this.heldCue);
    this.heldCue.position.z=1.05;this.heldCue.renderOrder=100;
    this.heldCore=put(this.heldCue,new THREE.IcosahedronGeometry(.33,2),this.holdMaterial);
    this.heldCore.renderOrder=90;
    // Solid cradle pieces ABOVE the shield, visible through any rim or shield face.
    for(let i=0;i<3;i++){
      const a=i*Math.PI*2/3;
      const piece=put(this.heldCue,new THREE.OctahedronGeometry(1,0),this.holdMaterial,
        [Math.cos(a)*.53,Math.sin(a)*.53,-.04],[.19,.13,.35]);piece.rotation.z=a;piece.renderOrder=90;
    }
    this.launchGlyph=emblem('play',this.holdMaterial);this.launchGlyph.scale.setScalar(.38);
    this.launchGlyph.renderOrder=101;this.launchGlyph.position.set(0,-.92,.75);this.launchGlyph.traverse(o=>{o.renderOrder=91;});this.shield.add(this.launchGlyph);
    this.bindGems=[];
    for(let i=0;i<3;i++){const m=put(this.shield,new THREE.OctahedronGeometry(.14,0),this.holdMaterial,[-.35+i*.35,.98,.58]);m.renderOrder=90;this.bindGems.push(m);}
    this.predictor.geometry.dispose();this.predictor.geometry=new THREE.OctahedronGeometry(.42,0);this.predictor.material.opacity=.4;
  }
  makeAtmosphere(){
    const scene=this.scene;
    scene.background=new THREE.Color(0x081220);scene.fog=new THREE.FogExp2(0x081220,.003);
    scene.environment=crystalEnvironment();
    scene.add(new THREE.HemisphereLight(0xc1e6ff,0x1c344d,.65));
    const key=new THREE.DirectionalLight(0xe0f7ff,2.4);key.position.set(-7,-5,19);scene.add(key);
    const fill=new THREE.DirectionalLight(0x95abff,1.1);fill.position.set(8,4,11);scene.add(fill);
    this.movingLights=[0x69dcff,0xb8a1ff,0x8bffe0,0xffe0b0].map((color,i)=>{
      const l=new THREE.PointLight(color,55,30,1.5);l.position.set(9,0,3+i*2);scene.add(l);return l;
    });
    const ground=put(scene,new THREE.RingGeometry(9.8,90,128),new THREE.MeshStandardMaterial({color:0x02050a,roughness:.96,envMapIntensity:.10}),[0,0,-.5]);
    ground.name='Dark wilderness floor';this.wilderness=ground;
    put(scene,new THREE.CircleGeometry(9.8,96),new THREE.MeshStandardMaterial({color:0x0c2b37,roughness:.25}),[0,0,-11.4]);
    // A quiet optical sleeve, not masonry competing with the 26 large rim crystals.
    this.wallMat=wallMaterial();this.wallMat.opacity=.30;
    const wall=put(scene,new THREE.CylinderGeometry(9.82,9.82,21.5,96,1,true),this.wallMat,[0,0,-.35]);
    wall.rotation.x=Math.PI/2;wall.name='Transparent well sleeve';
    this.rim=new THREE.Group();this.rim.name='26 irregular optical crystals';scene.add(this.rim);
    const palette=[0xd8f6ff,0xc2e8ff,0xdbd6ff,0xcefff4];
    this.rimMaterials=palette.map(c=>opticalCrystal(c,1.6,scene.environment));
    for(let i=0;i<26;i++){
      const a=i*Math.PI*2/26,noise=Math.sin(i*13.71),r=10.72+Math.sin(i*7.3)*.10;
      const gem=put(this.rim,gemGeometry(974+i*811),this.rimMaterials[i%4],
        [Math.cos(a)*r,Math.sin(a)*r,10.82+noise*.18],[1.06+noise*.14,1.37+Math.cos(i*9.1)*.18,1.05+Math.sin(i*3.3)*.25]);
      gem.rotation.set(Math.cos(i*5.9)*.10,Math.sin(i*4.1)*.12,a+Math.sin(i*2.7)*.08);
      gem.name=`Optical rim crystal ${i+1}`;
    }
    // Sparse rocky wilderness; it stays subordinate to the playable well.
    const rocks=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),new THREE.MeshStandardMaterial({color:0x09111d,roughness:.95,envMapIntensity:.12,flatShading:true}),90);
    const d=new THREE.Object3D();for(let i=0;i<90;i++){
      const a=i*2.399,r=13+(i%19)*1.31,s=.25+(i%7)*.14;
      d.position.set(Math.cos(a)*r,Math.sin(a)*r,-.3);d.scale.set(s,s*.8,s*.45);d.rotation.set(.2,.4,a);d.updateMatrix();rocks.setMatrixAt(i,d.matrix);
    }scene.add(rocks);this.wildernessRocks=rocks;
    this.wallLights=[];
    for(let i=0;i<12;i++){
      const s=new THREE.Sprite(new THREE.SpriteMaterial({map:this.glowMap,color:[0x84deff,0xb5c6ff,0xb1fff0][i%3],transparent:true,opacity:.5,depthWrite:false,blending:THREE.AdditiveBlending}));
      s.scale.set(1.3,1.3,1);s.userData={phase:i*2.4,speed:.06,zBase:1+(i%5)*1.8};this.wallLights.push(s);scene.add(s);
    }
  }
  makeShield(){
    super.makeShield();
    // The center is no longer an opaque boss over the caught ball.
    for(const m of [...this.shield.children]){
      if(m.isMesh&&m.geometry.type==='OctahedronGeometry'&&Math.hypot(m.position.x,m.position.y)<.01){m.removeFromParent();m.geometry.dispose();}
      if(m.isMesh&&m.geometry.type==='LatheGeometry')m.material.opacity=.23;
    }
  }
  createBubble(){
    const root=new THREE.Group();root.name='Rising magic bubble';root.visible=false;this.scene.add(root);
    const shell=put(root,new THREE.SphereGeometry(.68,24,16),new THREE.MeshPhysicalMaterial({
      color:0xceefff,transparent:true,opacity:.23,depthWrite:false,roughness:.08,metalness:.03,clearcoat:1,iridescence:1,envMapIntensity:1.5}));shell.renderOrder=8;
    const icons={};for(const [kind,color] of Object.entries(COLORS)){
      const symbol=emblem(kind,crystal(color,{metalness:.08,emissiveIntensity:.34}));symbol.scale.setScalar(.68);root.add(symbol);icons[kind]=symbol;
    }root.userData={shell,icons};return root;
  }
  update(dt,t,rise=0){
    super.update(dt,t,rise);
    const g=this.game,held=g.held,hidden=['respawning','lost','won'].includes(g.state);
    // Flight silhouettes stay at the physical location; held state gets ONE above-shield beacon.
    this.ball.visible=!hidden&&!held;this.ballHalo.visible=!hidden&&!held;this.ghost.visible=!hidden&&!held;this.sideGhost.visible=!hidden&&!held;
    this.heldCue.visible=held;this.launchGlyph.visible=held;this.predictor.visible=!held&&!hidden&&this.predictor.visible;
    this.heldCore.scale.setScalar(1+Math.sin(t*3)*.08);
    this.holdMaterial.color.set(g.readyReason==='capture'?0xd2a0ff:0x87fff2);
    this.heldCue.rotation.z=t*.4;
    this.bindGems.forEach((m,i)=>{m.visible=i<g.effects.bind;});
    const grow=g.shieldRadius/RULES.shieldRadius,hit=clamp(1-(t-g.lastShieldAt)/.22,0,1);
    this.shield.scale.set(grow*(1+.05*hit),grow*(1+.05*hit),1-.18*hit);
    this.launchGlyph.scale.setScalar(.39*(1+Math.sin(t*3)*.12));
    this.bubbles.forEach((root,i)=>{
      const orb=g.powerups[i];root.visible=!!orb;if(!orb)return;
      root.position.set(orb.x,orb.y,orb.z);root.userData.shell.material.color.set(COLORS[orb.kind]);
      for(const [kind,icon] of Object.entries(root.userData.icons))icon.visible=kind===orb.kind;
    });
  }
  prepareView(camera,side,now){
    super.prepareView(camera,side,now);
    this.wilderness.visible=!side;this.wildernessRocks.visible=!side;
    // These are 3D solid silhouettes, billboarded per actual rendering camera, not flat SVGs.
    const q=camera.quaternion;this.launchGlyph.quaternion.copy(q);
    for(const root of this.bubbles)for(const icon of Object.values(root.userData.icons))icon.quaternion.copy(q);
  }
}
