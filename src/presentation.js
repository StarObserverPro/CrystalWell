import * as THREE from 'three';
import { QUALITY } from './quality.js';
import { CrystalWorld } from './world.js';
import { RULES, brickPosition } from './physics.js';
import { depthHeat } from './visual-math.js';
import { makeReflectionEnvironment, makeCrystalMaterial, arcBlock, wallMaterial } from './crystal-material.js';

function rng(seed) {
  return () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
}
function mesh(geometry, material, parent, x=0, y=0, z=0) {
  const m = new THREE.Mesh(geometry, material); m.position.set(x,y,z); parent.add(m); return m;
}
function pbr(color, options={}) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: .17, metalness: .2,
    clearcoat: 1, clearcoatRoughness: .09, envMapIntensity: 1.25, ...options });
}
function crystalBrick() {
  const s = new THREE.Shape();
  s.moveTo(-.39,-.44); s.lineTo(.39,-.44); s.lineTo(.44,-.39);
  s.lineTo(.44,.39); s.lineTo(.39,.44); s.lineTo(-.39,.44);
  s.lineTo(-.44,.39); s.lineTo(-.44,-.39); s.closePath();
  const g = new THREE.ExtrudeGeometry(s,{depth:.76,steps:1,bevelEnabled:true,
    bevelThickness:.055,bevelSize:.035,bevelSegments:1,curveSegments:1});
  g.translate(0,0,-.38); return g;
}

/** More detailed presentation, retaining the tested game/dragon collision rules. */
export class LuminousCrystalWorld extends CrystalWorld {
  constructor(scene, game) {
    super(scene, game);
    const materials = new Set();
    this.dragon.traverse(o => { if (o.material) materials.add(o.material); });
    for (const m of materials) {
      if (m.emissive) m.emissive.multiplyScalar(1.7);
      if (m.specular) m.specular.set(0xc8f6ff);
    }
    this.heatColor = new THREE.Color();
  }

  makeAtmosphere() {
    const scene = this.scene;
    scene.background = new THREE.Color(0x101c2b);
    scene.fog = new THREE.FogExp2(0x101c2b,.006);
    scene.environment = makeReflectionEnvironment();
    const ambient = new THREE.HemisphereLight(0xc3e3ff,0x445369,1.35);
    ambient.position.set(0,0,1); scene.add(ambient);
    const key = new THREE.DirectionalLight(0xe3f7ff,1.85);
    key.position.set(-7,-10,24); scene.add(key);
    const fill = new THREE.DirectionalLight(0xb49de9,.85);
    fill.position.set(10,4,13); scene.add(fill);
    this.movingLights = [0x62deff,0xc89bff,0x75ffe1,0xffdc9d].map((color,i) => {
      const light = new THREE.PointLight(color,65,28,1.5);
      light.position.set(Math.cos(i*1.6)*9.45,Math.sin(i*1.6)*9.45,2+i*2.1);
      scene.add(light); return light;
    });

    const ground = mesh(new THREE.PlaneGeometry(160,160),
      new THREE.MeshStandardMaterial({color:0x090f1b,roughness:.96}),scene,0,0,-.5);
    ground.name = 'Dark wilderness floor';
    const random = rng(7320), cursor = new THREE.Object3D();
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),
      new THREE.MeshStandardMaterial({color:0x283747,roughness:.84,flatShading:true}),220);
    for (let i=0;i<rocks.count;i++) {
      const a=random()*Math.PI*2, r=11.4+Math.pow(random(),.6)*37, s=.16+random()*1.3;
      cursor.position.set(Math.cos(a)*r,Math.sin(a)*r,-.23);
      cursor.scale.set(s,s*(.5+random()*.65),.2+random()*.8);
      cursor.rotation.set(random()*.4,random()*.4,a); cursor.updateMatrix();
      rocks.setMatrixAt(i,cursor.matrix);
    }
    scene.add(rocks);
    const quartz = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1,0),
      pbr(0x7495aa,{roughness:.3,emissive:0x122c40}),64);
    for (let i=0;i<quartz.count;i++) {
      const a=random()*Math.PI*2, r=11.1+random()*13;
      cursor.position.set(Math.cos(a)*r,Math.sin(a)*r,.2);
      cursor.scale.set(.14+random()*.3,.16+random()*.3,.3+random()*1.1);
      cursor.rotation.set(random()*.5,random()*.5,a);cursor.updateMatrix();quartz.setMatrixAt(i,cursor.matrix);
    }
    scene.add(quartz);

    // Solid annular blocks, not a cylinder outline or a flat ring texture.
    this.wallMat = wallMaterial();
    const wall = new THREE.InstancedMesh(arcBlock(9.81,10.38,Math.PI*2/40,.75),this.wallMat,40*13);
    wall.name = 'Bevelled crystal masonry / camera-relative cutaway';
    for (let k=0;k<13;k++) for(let j=0;j<40;j++) {
      cursor.position.set(0,0,.35+k*.8); cursor.scale.set(1,1,1);
      cursor.rotation.set(0,0,(j+(k%2)*.5)*Math.PI*2/40);cursor.updateMatrix();wall.setMatrixAt(k*40+j,cursor.matrix);
    }
    wall.renderOrder=0;scene.add(wall);
    const coping = new THREE.InstancedMesh(arcBlock(9.64,10.76,Math.PI*2/QUALITY.rimSegments,.36,.065),
      pbr(0xb0c5d7,{metalness:.48,roughness:.22}),QUALITY.rimSegments);
    coping.name='Thick, segmented well coping';
    for(let j=0;j<QUALITY.rimSegments;j++) {
      cursor.position.set(0,0,RULES.shieldZ+.12);cursor.rotation.set(0,0,j*Math.PI*2/QUALITY.rimSegments);cursor.updateMatrix();
      coping.setMatrixAt(j,cursor.matrix);
      coping.setColorAt(j,new THREE.Color(j%8===0?0x8ca5c4:j%2?0xe0eef0:0x9bc9de));
    }
    scene.add(coping);
    const ribs = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1,0),this.wallMat,24);
    for(let j=0;j<24;j++) {
      const a=j*Math.PI*2/24;
      cursor.position.set(Math.cos(a)*10.44,Math.sin(a)*10.44,5.05);
      cursor.rotation.set(0,0,a);cursor.scale.set(.16,.23,5.05);cursor.updateMatrix();ribs.setMatrixAt(j,cursor.matrix);
    }
    // Ribs use the same cutaway to avoid a picket fence over the side view.
    ribs.renderOrder=0; scene.add(ribs);
    const bandMaterial = pbr(0x83bfd2,{emissive:0x1b5368,emissiveIntensity:.3,metalness:.46});
    for(const z of [.05,RULES.shieldZ-.35]) {
      mesh(new THREE.TorusGeometry(10.42,.12,6,96),bandMaterial,scene,0,0,z);
    }
    const rimGemMaterial=pbr(0x9ce9f2,{roughness:.08,emissive:0x2f6d86,emissiveIntensity:.45});
    const gems=new THREE.InstancedMesh(new THREE.OctahedronGeometry(.24,0),rimGemMaterial,16);
    for(let i=0;i<16;i++) {
      const a=i*Math.PI*2/16;
      cursor.position.set(Math.cos(a)*10.2,Math.sin(a)*10.2,RULES.shieldZ+.43);
      cursor.rotation.set(.1,.2,a);cursor.scale.set(.8,.8,1.2);cursor.updateMatrix();gems.setMatrixAt(i,cursor.matrix);
    }
    scene.add(gems);
    this.wallLights=[];
    for(let i=0;i<20;i++) {
      const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:this.glowMap,
        color:[0x62deff,0xc89bff,0x75ffe1,0xffdc9d][i%4],transparent:true,opacity:.7,
        depthWrite:false,blending:THREE.AdditiveBlending}));
      sprite.scale.set(1.4,1.4,1);
      sprite.userData={phase:i*2.4,speed:.055+i*.003,zBase:1.1+(i%7)*1.15};
      this.wallLights.push(sprite);scene.add(sprite);
    }
  }

  makeCrystalField() {
    this.records=[]; this.fieldVersion=0;
    const random=rng(8401), cursor=new THREE.Object3D();
    const palette=[0x4da9cd,0x74a8d4,0x65c3c9,0x969acb,0x9ccedf];
    for(let id=0;id<this.game.grid.length;id++) {
      if(!this.game.grid[id]) continue;
      const k=Math.floor(id/(RULES.cells*RULES.cells)), rem=id%(RULES.cells*RULES.cells);
      const p=brickPosition(rem%RULES.cells,Math.floor(rem/RULES.cells),k);
      cursor.position.set(p.x,p.y,p.z);cursor.updateMatrix();
      const color=new THREE.Color(palette[(Math.floor(random()*4)+k)%palette.length]);
      color.multiplyScalar(.86+random()*.25);
      this.records.push({id,p,k,ix:rem%RULES.cells,iy:Math.floor(rem/RULES.cells),matrix:cursor.matrix.clone(),color,alive:true});
    }
    this.byId=new Map(this.records.map(r=>[r.id,r]));
    const geometry=crystalBrick(), material=makeCrystalMaterial(this.movingLights);
    this.crystals=new THREE.InstancedMesh(geometry,material,this.records.length);
    this.sideCrystals=new THREE.InstancedMesh(geometry.clone(),material,this.records.length);
    for(const [i,body] of [this.crystals,this.sideCrystals].entries()) {
      body.layers.set(i+1); body.name=i?'Side-view sorted crystal volume':'Main-view sorted crystal volume';
      body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);body.renderOrder=3;
      for (const name of ['aOpenPositive','aOpenNegative']) {
        body.geometry.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(this.records.length*3),3).setUsage(THREE.DynamicDrawUsage));
      }
      body.frustumCulled=false;body.userData.lastSort=-Infinity;body.userData.version=-1;
      // Allocate instanceColor before shader compilation.
      this.records.forEach((r,j)=>{body.setMatrixAt(j,r.matrix);body.setColorAt(j,r.color);});
      body.instanceColor.setUsage(THREE.DynamicDrawUsage);this.scene.add(body);
    }
  }
  resetField() {
    this.scene.remove(this.crystals,this.sideCrystals);
    this.crystals.geometry.dispose();this.sideCrystals.geometry.dispose();this.crystals.material.dispose();
    this.crystals.dispose();this.sideCrystals.dispose();
    this.makeCrystalField();
  }
  removeCrystals(ids) {
    for(const id of ids) { const r=this.byId.get(id); if(r) r.alive=false; }
    this.fieldVersion++;
  }
  exposed(r) {
    const {ix,iy,k}=r,g=this.game;
    return !g.occupied(ix+1,iy,k)||!g.occupied(ix-1,iy,k)||!g.occupied(ix,iy+1,k)||
      !g.occupied(ix,iy-1,k)||!g.occupied(ix,iy,k+1)||!g.occupied(ix,iy,k-1);
  }
  prepareView(camera,side,now) {
    const material=this.crystals.material;
    material.uniforms.uEye.value.copy(camera.position);
    this.wallMat.userData.eye.value.copy(camera.position);
    const body=side?this.sideCrystals:this.crystals;
    if(now-body.userData.lastSort<120 && body.userData.version===this.fieldVersion) return;
    // Separate instance buffers: sorting the side view cannot scramble the main view.
    const direction=new THREE.Vector3();camera.getWorldDirection(direction);
    const ordered=this.records.filter(r=>r.alive && this.exposed(r));
    body.userData.logicalCount=this.game.remaining;
    ordered.sort((a,b)=>(b.p.x-a.p.x)*direction.x+(b.p.y-a.p.y)*direction.y+(b.p.z-a.p.z)*direction.z);
    const positive=body.geometry.attributes.aOpenPositive;
    const negative=body.geometry.attributes.aOpenNegative;
    ordered.forEach((r,i)=>{
      body.setMatrixAt(i,r.matrix);body.setColorAt(i,r.color);
      const {ix,iy,k}=r;
      positive.setXYZ(i,+!this.game.occupied(ix+1,iy,k),+!this.game.occupied(ix,iy+1,k),+!this.game.occupied(ix,iy,k+1));
      negative.setXYZ(i,+!this.game.occupied(ix-1,iy,k),+!this.game.occupied(ix,iy-1,k),+!this.game.occupied(ix,iy,k-1));
    });
    positive.needsUpdate=true;negative.needsUpdate=true;
    body.count=ordered.length;body.instanceMatrix.needsUpdate=true;body.instanceColor.needsUpdate=true;
    body.userData.lastSort=now;body.userData.version=this.fieldVersion;
  }

  makeShield() {
    const root=new THREE.Group();root.name='Faceted aegis / crystal lens, crown rim and sapphire boss';
    const silver=pbr(0xd6e5ed,{metalness:.72,roughness:.17,transparent:true,opacity:.93,depthWrite:false});
    const ice=pbr(0x86dbe8,{metalness:.12,roughness:.07,iridescence:.45,
      transparent:true,opacity:.48,depthWrite:false,side:THREE.DoubleSide});
    const gem=pbr(0x87c4ff,{roughness:.055,metalness:.12,emissive:0x215aa0,emissiveIntensity:.55});
    const points=[new THREE.Vector2(0,.20),new THREE.Vector2(.36,.19),
      new THREE.Vector2(.84,.11),new THREE.Vector2(1.22,.015),new THREE.Vector2(1.26,-.10),
      new THREE.Vector2(.8,-.16),new THREE.Vector2(0,-.19)];
    const lens=mesh(new THREE.LatheGeometry(points,24),ice,root);lens.rotation.x=Math.PI/2;
    const tor=mesh(new THREE.TorusGeometry(RULES.shieldRadius-.035,.12,12,96),silver,root);
    const inner=mesh(new THREE.TorusGeometry(.92,.09,10,80),pbr(0xafd7fb,{emissive:0x246d8f,emissiveIntensity:.55}),root,0,0,.15);
    const boss=mesh(new THREE.OctahedronGeometry(.34,1),gem,root,0,0,.24);boss.scale.set(1,1,.75);
    const inset=mesh(new THREE.TorusGeometry(.39,.08,10,56),silver,root,0,0,.20);
    inset.rotation.z=.15;
    const runeGroup=new THREE.Group();root.add(runeGroup);
    for(let i=0;i<12;i++) {
      const a=i*Math.PI*2/12;
      const spoke=mesh(new THREE.OctahedronGeometry(1,0),i%3===0?gem:silver,runeGroup,
        Math.cos(a)*.76,Math.sin(a)*.76,.18);
      spoke.scale.set(.40,.11,.09);spoke.rotation.z=a;
      const tip=mesh(new THREE.OctahedronGeometry(1,0),i%3===0?gem:ice,root,
        Math.cos(a)*1.19,Math.sin(a)*1.19,.07);
      tip.scale.set(.23,.11,.15);tip.rotation.z=a;
    }
    root.position.z=RULES.shieldZ;root.renderOrder=12;
    root.traverse(o=>{if(o.isMesh)o.renderOrder=12;});
    this.shield=root;this.shieldRings={tor,inner,runeGroup};this.scene.add(root);
  }
  makeBall() {
    super.makeBall();
    // A true-position x-ray silhouette replaces the old, misleading Z-flattened dot.
    const dot=this.ghost.children[1];dot.geometry.dispose();
    dot.geometry=new THREE.IcosahedronGeometry(.24,1);
    this.ghost.traverse(o=>{o.renderOrder=60;});
    this.ballHalo.scale.set(1.7,1.7,1);this.ghost.children[0].scale.set(1.6,1.6,1);
    this.predictor.renderOrder=61;this.predictor.scale.setScalar(.7);
  }
  update(dt,t,winRise=0) {
    super.update(dt,t,winRise);
    const color=this.heatColor; color.setRGB(...depthHeat(this.game.ball.z),THREE.SRGBColorSpace);
    this.ball.material.color.copy(color).lerp(new THREE.Color(0xffffff),.37);
    this.ballHalo.material.color.copy(color);this.sideGhost.material.color.copy(color);
    this.ghost.position.copy(this.ball.position);
    this.ghost.children[0].material.color.copy(color);
    this.ghost.children[1].material.color.copy(color).lerp(new THREE.Color(0xffffff),.4);
    this.predictor.position.z=RULES.shieldZ+.04;
    this.predictor.material.color.copy(color);
    for(let i=0;i<this.movingLights.length;i++) {
      const a=t*(.09+i*.018)+i*Math.PI*.5;
      this.movingLights[i].position.set(Math.cos(a)*9.48,Math.sin(a)*9.48,5+Math.sin(t*.35+i*1.7)*3.7);
      this.wallLights[i].position.copy(this.movingLights[i].position);
      this.wallLights[i].material.opacity=.8;
    }
    this.crystals.material.uniforms.uTime.value=t;
    this.crystals.material.uniforms.uBall.value.copy(this.ball.position);
    this.wallMat.userData.time.value=t;
  }
}
