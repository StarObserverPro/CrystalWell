import * as THREE from 'three';
import { crystal, put, polygon } from './model-kit.js';
import { emblem } from './icons-3d.js';

const SEGMENTS = { '0':[0,1,2,3,4,5], '1':[1,2], '2':[0,1,6,4,3], '3':[0,1,6,2,3],
  '4':[5,6,1,2], '5':[0,5,6,2,3], '6':[0,5,6,4,2,3], '7':[0,1,2], '8':[0,1,2,3,4,5,6],
  '9':[0,1,2,3,5,6], 'F':[0,5,6,4], 'P':[0,1,5,6,4], 'S':[0,5,6,2,3], '-':[6], ' ':[] };
const POS = [[0,1.0,0],[.48,.50,1],[.48,-.5,1],[0,-1,0],[-.48,-.5,1],[-.48,.5,1],[0,0,0]];

/** Solid bevelled crystal ingots, not text textures, lines, SVG or DOM labels. */
export class CrystalDigits extends THREE.Group {
  constructor(maxChars, material, unit = 9) {
    super(); this.maxChars = maxChars; this.unit = unit; this.value = null;
    const geo = polygon([[-.32,-.14],[.32,-.14],[.43,0],[.32,.14],[-.32,.14],[-.43,0]], .20, .03);
    this.mesh = new THREE.InstancedMesh(geo, material, maxChars * 7); this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.add(this.mesh);
    this.set('0');
  }
  set(value) {
    const text = String(value).slice(-this.maxChars);
    if (text === this.value) return;
    this.value = text; const d = new THREE.Object3D(); let index = 0;
    for (let i = 0; i < text.length; i++) for (const s of SEGMENTS[text[i]] || []) {
      const [x,y,v] = POS[s];
      d.position.set((i*1.42+x)*this.unit,y*this.unit,0);
      d.rotation.set(0,0,v?Math.PI/2:0);d.scale.setScalar(this.unit);d.updateMatrix();
      this.mesh.setMatrixAt(index++,d.matrix);
    }
    this.mesh.count=index;this.mesh.instanceMatrix.needsUpdate=true;
  }
}

export class SculptedHUD {
  constructor(renderer, game, elements) {
    this.renderer=renderer;this.game=game;this.elements=elements;this.scene=new THREE.Scene();
    this.camera=new THREE.OrthographicCamera(0,1,1,0,-300,300);this.camera.position.z=100;
    this.scene.add(new THREE.AmbientLight(0xc5e5ff,2));
    const key=new THREE.DirectionalLight(0xe7f6ff,3.2);key.position.set(-120,200,200);this.scene.add(key);
    const fill=new THREE.DirectionalLight(0x9f85ff,1.5);fill.position.set(200,-20,80);this.scene.add(fill);
    this.ice=crystal(0x9cdfe7,{metalness:.32,roughness:.21});
    this.gold=crystal(0xffd794,{metalness:.38,emissiveIntensity:.14});
    this.violet=crystal(0xc3a2ed,{metalness:.28,emissiveIntensity:.18});
    this.dim=crystal(0x243444,{metalness:.14,emissiveIntensity:0});
    this.plate=crystal(0x214558,{metalness:.52,roughness:.28});
    this.content=new THREE.Group();this.scene.add(this.content);
    this.lives=new THREE.Group();this.content.add(this.lives);this.lifeGems=[];
    for(let i=0;i<3;i++) {
      const life=put(this.lives,new THREE.IcosahedronGeometry(12,1),this.ice,[i*35,0,0]);
      life.rotation.set(.3,.2,.4);this.lifeGems.push(life);
    }
    this.scoreGroup=new THREE.Group();this.content.add(this.scoreGroup);
    const trophy=emblem('treasure',this.gold);trophy.scale.setScalar(20);trophy.position.set(-25,0,0);this.scoreGroup.add(trophy);
    this.score=new CrystalDigits(7,this.gold,10);this.scoreGroup.add(this.score);
    this.combo=new CrystalDigits(1,this.violet,8);this.combo.position.set(113,0,0);this.scoreGroup.add(this.combo);
    const x=emblem('cross',this.violet);x.scale.setScalar(9);x.position.set(-14,0,0);this.combo.add(x);
    this.buttons={};
    for(const [id,kind] of [['pause','pause'],['sound','sound'],['restart','restart']]) {
      const root=new THREE.Group();this.content.add(root);
      const base=put(root,new THREE.CylinderGeometry(25,25,8,8),this.plate);base.rotation.x=Math.PI/2;
      const symbol=emblem(kind,this.ice);symbol.scale.setScalar(29);symbol.position.z=7;root.add(symbol);
      root.rotation.x=.12;root.userData.symbol=symbol;
      if(id==='pause') {const alt=emblem('play',this.gold);alt.scale.setScalar(28);alt.position.z=7;root.add(alt);root.userData.alt=alt;}
      this.buttons[id]=root;
      const el=elements[id];
      el.addEventListener('pointerenter',()=>{root.userData.hover=true;});el.addEventListener('pointerleave',()=>{root.userData.hover=false;});
      el.addEventListener('focus',()=>{root.userData.hover=true;});el.addEventListener('blur',()=>{root.userData.hover=false;});
    }
    this.progress=new THREE.Group();this.content.add(this.progress);this.progressGems=[];
    const seal=emblem('seal',this.ice);seal.scale.setScalar(19);this.progress.add(seal);
    for(let i=0;i<20;i++) {
      const a=i*Math.PI*2/20;const m=put(this.progress,new THREE.OctahedronGeometry(5.4,0),this.dim,
        [Math.cos(a)*30,Math.sin(a)*30,0],[.68,1.05,.6]);m.rotation.z=a;this.progressGems.push(m);
    }
    this.effects=new THREE.Group();this.content.add(this.effects);this.effectIcons={};
    ['wide','slow','bind'].forEach((kind,i)=>{const icon=emblem(kind,this.violet);icon.scale.setScalar(22);icon.position.set(i*48,0,0);this.effects.add(icon);this.effectIcons[kind]=icon;});
    this.fpsGroup=new THREE.Group();this.content.add(this.fpsGroup);
    this.fpsMaterial=this.ice.clone();this.fps=new CrystalDigits(3,this.fpsMaterial,8);this.fpsGroup.add(this.fps);
    const label=new CrystalDigits(3,this.ice,6);label.set('FPS');label.position.set(47,0,0);this.fpsGroup.add(label);
    this.sideFps=new CrystalDigits(2,this.ice,5);this.sideFps.position.set(18,-24,0);this.fpsGroup.add(this.sideFps);
    const cube=emblem('frame',this.ice);cube.scale.setScalar(9);cube.position.set(0,-24,0);this.fpsGroup.add(cube);
    this.ms=new CrystalDigits(5,this.ice,5);this.ms.position.set(50,-24,0);this.fpsGroup.add(this.ms);

    this.modal=new THREE.Group();this.scene.add(this.modal);
    this.scrim=put(this.modal,new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0x030c18,transparent:true,opacity:.72,depthWrite:false}),[0,0,30]);
    this.modalButton=new THREE.Group();this.modal.add(this.modalButton);this.modalButton.position.z=40;
    const cradle=put(this.modalButton,new THREE.IcosahedronGeometry(53,1),this.plate);cradle.scale.set(1,1,.27);
    this.modalPlay=emblem('play',this.gold);this.modalPlay.scale.setScalar(55);this.modalPlay.position.z=22;this.modalButton.add(this.modalPlay);
    this.modalRestart=emblem('restart',this.gold);this.modalRestart.scale.setScalar(55);this.modalRestart.position.z=22;this.modalButton.add(this.modalRestart);
    this.modalScore=new CrystalDigits(7,this.gold,13);this.modal.add(this.modalScore);this.modalScore.position.z=40;
    this.portrait=new THREE.Group();this.scene.add(this.portrait);
    this.phone=emblem('phone',this.ice);this.phone.scale.setScalar(85);this.portrait.add(this.phone);
    const turn=emblem('restart',this.gold);turn.scale.setScalar(58);turn.position.set(76,0,20);this.portrait.add(turn);
    this.lastA11y='';
  }

  resize(width,height,mainWidth) {
    this.width=width;this.height=height;this.mainWidth=mainWidth;
    this.camera.left=0;this.camera.right=width;this.camera.top=height;this.camera.bottom=0;this.camera.updateProjectionMatrix();
    this.scale=Math.min(1,Math.max(.8,height/650));const s=this.scale;
    this.lives.position.set(32*s,height-37*s,0);this.lives.scale.setScalar(s);
    this.scoreGroup.position.set(160*s,height-37*s,0);this.scoreGroup.scale.setScalar(s);
    let i=0;
    for(const id of ['pause','sound','restart']) {
      const x=width-(160-i*61)*s,y=height-39*s,root=this.buttons[id];root.position.set(x,y,0);root.scale.setScalar(s);
      const e=this.elements[id];Object.assign(e.style,{left:`${x-28*s}px`,top:`${height-y-28*s}px`,width:`${56*s}px`,height:`${56*s}px`});i++;
    }
    this.progress.position.set(46*s,46*s,0);this.progress.scale.setScalar(s);
    this.effects.position.set(107*s,37*s,0);this.effects.scale.setScalar(s);
    this.fpsGroup.position.set(width-135*s,44*s,0);this.fpsGroup.scale.setScalar(s*1.3);
    this.scrim.position.set(width/2,height/2,30);this.scrim.scale.set(width,height,1);
    this.modalButton.position.set(mainWidth/2,height/2,40);this.modalButton.scale.setScalar(s);
    this.modalScore.position.set(mainWidth/2-62*s,height/2-95*s,40);this.modalScore.scale.setScalar(s);
    this.portrait.position.set(width/2-20,height/2,40);
    Object.assign(this.elements.center.style,{left:`${mainWidth/2-64*s}px`,top:`${height/2-64*s}px`,width:`${128*s}px`,height:`${128*s}px`});
  }

  update(time,paused,sound,landscape,metrics) {
    const g=this.game,s=this.scale||1;
    this.content.visible=landscape;this.portrait.visible=!landscape;
    this.phone.rotation.z=Math.sin(time*1.6)*.50;
    const terminal=g.state==='lost'||(g.state==='won'&&g.time-g.wonAt>5.8);
    this.modal.visible=landscape&&(paused||terminal);
    this.elements.center.hidden=!this.modal.visible;
    for(const id of ['pause','sound','restart']) this.elements[id].hidden=!landscape;
    this.modalPlay.visible=!terminal;this.modalRestart.visible=terminal;this.modalScore.visible=terminal;
    this.modalScore.set(g.score);
    this.elements.center.setAttribute('aria-label',terminal?'再来一次':'继续游戏');
    this.score.set(String(g.score).padStart(6,'0'));
    this.scoreGroup.scale.setScalar(s*(1+Math.max(0,1-(g.time-g.lastScoreAt)/.3)*.025));
    this.combo.set(g.multiplier);this.combo.visible=g.multiplier>1;
    this.lifeGems.forEach((m,i)=>{m.material=i<g.lives?this.ice:this.dim;m.scale.setScalar(i<g.lives?1:.65);m.rotation.y=time*.30+i*.35;});
    this.progressGems.forEach((m,i)=>{m.material=i/20<1-g.remaining/g.total?this.ice:this.dim;});
    for(const [kind,icon] of Object.entries(this.effectIcons)) {icon.visible=g.effects[kind]>0;icon.rotation.y=Math.sin(time*1.8)*.18;}
    for(const [id,root] of Object.entries(this.buttons)) root.scale.setScalar(s*(root.userData.hover?1.10:1));
    this.buttons.pause.userData.symbol.visible=!paused;this.buttons.pause.userData.alt.visible=paused;
    this.buttons.sound.userData.symbol.traverse(o=>{if(o.isMesh)o.material=sound?this.ice:this.dim;});
    if(metrics) {
      this.fps.set(Math.round(metrics.fps));this.sideFps.set(Math.round(metrics.sideFps));this.ms.set(Math.round(metrics.ms));
      this.fpsMaterial.color.set(metrics.fps<30?0xffa48d:metrics.fps<45?0xffdb91:0x9cdfe7);
      this.elements.fps.textContent=`${Math.round(metrics.fps)} FPS · 侧 ${Math.round(metrics.sideFps)} · ${metrics.ms.toFixed(1)} ms`;
    }
    const status=`${g.score}分，剩余${g.lives}条命，${paused?'暂停':g.held?(g.readyReason==='capture'?'球被黏住，点击或空格释放':'补发球已就位，点击或空格发射'):g.state}`;
    if(status!==this.lastA11y){this.elements.status.textContent=status;this.lastA11y=status;}
  }

  render() {
    this.renderer.setRenderTarget(null);this.renderer.setScissorTest(false);
    this.renderer.setViewport(0,0,this.width,this.height);this.renderer.clearDepth();
    this.renderer.render(this.scene,this.camera);
  }
}
