import * as THREE from 'three';
import { LuminousCrystalWorld } from './presentation.js';
import { RULES, clamp } from './physics.js';
import { QUALITY } from './quality.js';
import { arcBlock } from './crystal-material.js';
import { crystal, put, batchStatic } from './model-kit.js';
import { emblem } from './icons-3d.js';

const BUBBLE_COLORS={wide:0x72e8dd,slow:0x83b6ff,bind:0xcc9eff,treasure:0xffd581};

export class RoyalCrystalWorld extends LuminousCrystalWorld {
  constructor(scene,game) {
    super(scene,game);
    this.bubbles=Array.from({length:QUALITY.maxBubbles},()=>this.createBubble());
    this.heldCue=new THREE.Group();this.heldCue.name='Open crystal cradle / held-ball state';this.shield.add(this.heldCue);
    this.holdMaterial=crystal(0x91f1ee,{emissiveIntensity:.45,transparent:true,opacity:.92,depthWrite:false});
    for(let i=0;i<3;i++) {
      const a=i*Math.PI*2/3;
      const petal=put(this.heldCue,new THREE.OctahedronGeometry(1,1),this.holdMaterial,
        [Math.cos(a)*.54,Math.sin(a)*.54,-.48],[.25,.16,.45]);petal.rotation.y=.3;petal.rotation.z=a;
    }
    this.launchGlyph=emblem('play',this.holdMaterial);this.launchGlyph.scale.setScalar(.47);
    this.launchGlyph.position.set(0,-.88,.44);this.shield.add(this.launchGlyph);
    this.bindGems=[];
    for(let i=0;i<3;i++) this.bindGems.push(put(this.shield,new THREE.OctahedronGeometry(.12,1),this.holdMaterial,[-.28+i*.28,.96,.24]));
    // Replace the old fine ring marker with a broad, faceted landing pebble.
    this.predictor.geometry.dispose();this.predictor.geometry=new THREE.OctahedronGeometry(.43,0);
    this.predictor.material.opacity=.48;
    this.predictor.name='Faceted landing stone, not a fine outline';
    this.shield.traverse(o=>{if(o.isMesh)o.renderOrder=12;});
    this.heldCue.traverse(o=>{if(o.isMesh)o.renderOrder=62;});
    this.launchGlyph.traverse(o=>{if(o.isMesh)o.renderOrder=63;});
  }

  makeAtmosphere() {
    super.makeAtmosphere();
    const scene=this.scene, ground=scene.getObjectByName('Dark wilderness floor');
    // An actual hole in the ground makes the lower jaw and well recess visible.
    ground.geometry.dispose();ground.geometry=new THREE.RingGeometry(10.1,85,160);
    const floor=put(scene,new THREE.CircleGeometry(9.8,96),crystal(0x102d42,{roughness:.34,metalness:.5}),[0,0,-1.6]);
    floor.name='Recessed basin below the dragon';
    const decor=new THREE.Group();decor.name='Carved tiered crystal coping';scene.add(decor);
    const pearl=crystal(0xaad8e1,{metalness:.44,roughness:.2});
    const dark=crystal(0x38657c,{metalness:.48,roughness:.26});
    const jewel=crystal(0x75c5dc,{emissiveIntensity:.2,roughness:.10});
    const violet=crystal(0x9d8eca,{roughness:.18});
    const cursor=new THREE.Object3D();
    for(const [inner,outer,z,h,mat] of [[9.67,10.98,10.43,.28,dark],[9.68,11.20,10.76,.26,pearl],[10.45,11.14,11.03,.18,dark]]) {
      const count=QUALITY.rimSegments;
      const band=new THREE.InstancedMesh(arcBlock(inner,outer,Math.PI*2/count,h,.035),mat,count);
      band.name='Stepped bevelled coping blocks';
      for(let i=0;i<count;i++) {cursor.position.set(0,0,z);cursor.rotation.set(0,0,i*Math.PI*2/count);cursor.scale.set(1,1,1);cursor.updateMatrix();band.setMatrixAt(i,cursor.matrix);}
      decor.add(band);
    }
    for(let i=0;i<QUALITY.rimJewels;i++) {
      const a=i*Math.PI*2/QUALITY.rimJewels;
      const gem=put(decor,new THREE.OctahedronGeometry(1,1),i%4?jewel:violet,
        [Math.cos(a)*10.5,Math.sin(a)*10.5,11.19],[.43,.22,.23]);gem.rotation.z=a;
      // Deep, solid leaf carving around each inset gem. Not thin engraved strokes.
      for(const s of [-1,1]) {
        const plate=put(decor,new THREE.OctahedronGeometry(1,0),pearl,
          [Math.cos(a+s*.026)*10.57,Math.sin(a+s*.026)*10.57,11.07],[.52,.22,.13]);plate.rotation.z=a+s*.30;
      }
    }
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4;
      const corbel=put(decor,new THREE.IcosahedronGeometry(1,1),dark,
        [Math.cos(a)*10.88,Math.sin(a)*10.88,10.32],[.57,.53,.84]);corbel.rotation.z=a;
      const crown=put(decor,new THREE.OctahedronGeometry(1,1),i%2?jewel:violet,
        [Math.cos(a)*10.96,Math.sin(a)*10.96,11.20],[.49,.40,.42]);crown.rotation.z=a;
    }
    batchStatic(decor);
  }

  createBubble() {
    const root=new THREE.Group();root.name='Rising magic bubble';this.scene.add(root);root.visible=false;
    const shell=put(root,new THREE.SphereGeometry(.65,32,20),new THREE.MeshPhysicalMaterial({
      color:0xc6efff,transparent:true,opacity:.20,depthWrite:false,metalness:.12,roughness:.07,
      clearcoat:1,iridescence:1,iridescenceIOR:1.3,envMapIntensity:2.1,side:THREE.FrontSide}));
    shell.renderOrder=8;
    const icons={};
    for(const kind of Object.keys(BUBBLE_COLORS)) {
      const icon=emblem(kind,crystal(BUBBLE_COLORS[kind],{emissiveIntensity:.55}));
      icon.scale.setScalar(.67);icon.rotation.x=Math.PI/5;icon.visible=false;icon.renderOrder=9;
      icon.traverse(o=>{if(o.isMesh)o.renderOrder=9;});root.add(icon);icons[kind]=icon;
    }
    const glint=put(root,new THREE.IcosahedronGeometry(.11,1),crystal(0xeeffff,{emissiveIntensity:.6}),[-.26,-.18,.51]);
    glint.renderOrder=9;
    root.userData={icons,shell};return root;
  }

  update(dt,t,rise=0) {
    super.update(dt,t,rise);
    const g=this.game,held=g.held,hidden=g.state==='respawning'||g.state==='lost'||g.state==='won';
    for(const object of [this.ball,this.ballHalo,this.ghost,this.sideGhost]) object.visible=!hidden;
    this.predictor.visible=!hidden&&!held&&this.predictor.visible;
    const grow=g.shieldRadius/RULES.shieldRadius;
    const hit=Math.max(0,1-(t-g.lastShieldAt)/.22);
    this.shield.scale.set(grow*(1+hit*.06),grow*(1+hit*.06),1-hit*.23);
    this.heldCue.visible=held;this.launchGlyph.visible=held;
    this.heldCue.rotation.z=t*.55;
    const breathe=1+Math.sin(t*3)*.10;
    this.heldCue.scale.set(breathe,breathe,1);
    this.holdMaterial.color.set(g.readyReason==='capture'||g.effects.bind>0?0xd19aff:0x80f5e8);
    this.holdMaterial.emissive.copy(this.holdMaterial.color);
    this.launchGlyph.scale.setScalar(.46*(1+Math.sin(t*3)*.15));
    this.bindGems.forEach((o,i)=>{o.visible=i<g.effects.bind;});
    if(held) {
      const appear=clamp((t-g.heldSince)/.35,0,1);
      this.ball.scale.setScalar(Math.max(.05,appear));
      this.ghost.children[1].scale.setScalar(Math.max(.05,appear));
    } else {this.ball.scale.setScalar(1);this.ghost.children[1].scale.setScalar(1);}
    for(let i=0;i<this.bubbles.length;i++) {
      const root=this.bubbles[i],orb=g.powerups[i];root.visible=!!orb;
      if(!orb)continue;
      root.position.set(orb.x,orb.y,orb.z);root.rotation.z=Math.sin(t*.75+orb.id)*.25;
      const pulse=1+Math.sin(t*2+orb.id)*.04;root.scale.setScalar(pulse);
      root.userData.shell.material.color.set(BUBBLE_COLORS[orb.kind]);
      for(const [kind,icon] of Object.entries(root.userData.icons)) {icon.visible=kind===orb.kind;icon.rotation.y=Math.sin(t+orb.id)*.30;}
    }
  }
}
