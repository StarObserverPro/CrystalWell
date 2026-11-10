import * as THREE from 'three';
import { RULES, brickPosition } from './physics.js';
import { makeDragon } from './dragon.js';
import { createGlowTexture } from './vfx.js';

function seeded(seed) {
  let x = seed >>> 0;
  return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; };
}
function torus(radius, tube, color, opacity = 1, n = 108) {
  return new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 6, n),
    new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity,
      depthWrite: opacity === 1, blending: opacity < 1 ? THREE.AdditiveBlending : THREE.NormalBlending }));
}
function planeRing(inner, outer, z, color, opacity = 1) {
  const mesh = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 120),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true,
      opacity, depthWrite: false }));
  mesh.position.z = z;
  return mesh;
}
function crystalGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-.39, -.46); s.lineTo(.39, -.46); s.lineTo(.45, -.39);
  s.lineTo(.45, .39); s.lineTo(.39, .46); s.lineTo(-.39, .46);
  s.lineTo(-.45, .39); s.lineTo(-.45, -.39); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: .81, steps: 1,
    bevelEnabled: true, bevelSegments: 1, bevelThickness: .04, bevelSize: .035, curveSegments: 1 });
  g.translate(0, 0, -.405);
  return g;
}

export class CrystalWorld {
  constructor(scene, game) {
    this.scene = scene; this.game = game;
    this.glowMap = createGlowTexture();
    this.crystalMap = new Int32Array(game.grid.length).fill(-1);
    this.gemMap = new Int32Array(game.grid.length).fill(-1);
    this.makeAtmosphere();
    this.makeCrystalField();
    this.makeShield();
    this.makeBall();
    this.dragon = makeDragon(); scene.add(this.dragon);
    this.impactFlash = 0;
  }

  makeAtmosphere() {
    const scene = this.scene;
    scene.background = new THREE.Color('#070f19');
    scene.fog = new THREE.FogExp2(0x07111b, .017);
    scene.add(new THREE.HemisphereLight(0x91b9da, 0x1d1b2a, 1.1));
    const ambientBlue = new THREE.PointLight(0x53bbda, 15, 21, 2);
    ambientBlue.position.set(-6, -6, 6); scene.add(ambientBlue);
    const ambientViolet = new THREE.PointLight(0xac8be7, 13, 21, 2);
    ambientViolet.position.set(6, 5, 4); scene.add(ambientViolet);
    this.movingLights = [ambientBlue, ambientViolet];

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(150, 150),
      new THREE.MeshLambertMaterial({ color: 0x0d151b, side: THREE.DoubleSide }));
    ground.position.z = -.37; ground.receiveShadow = false;
    scene.add(ground);
    const rand = seeded(7320);
    const stone = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshLambertMaterial({ color: 0x27353e, flatShading: true }), 280);
    const marker = new THREE.Object3D();
    for (let i = 0; i < 280; i++) {
      const a = rand() * Math.PI * 2, r = 10.7 + Math.pow(rand(), .65) * 33;
      marker.position.set(Math.cos(a) * r, Math.sin(a) * r, -.13);
      const s = .16 + rand() * 1.15;
      marker.scale.set(s, s * (.52 + rand() * .65), .23 + rand() * .8);
      marker.rotation.set(rand() * .5, rand() * .5, rand() * Math.PI * 2);
      marker.updateMatrix(); stone.setMatrixAt(i, marker.matrix);
      stone.setColorAt(i, new THREE.Color().setHSL(.57 + rand() * .1, .12 + rand() * .11, .085 + rand() * .13));
    }
    stone.instanceMatrix.needsUpdate = true;
    scene.add(stone);

    // The masonry is a translucent cylinder *around* the full 3D crystal volume.
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(RULES.wellRadius, RULES.wellRadius, RULES.shieldZ + .45, 112, 1, true),
      new THREE.MeshPhongMaterial({ color: 0x2e5265, emissive: 0x0b2639,
        transparent: true, opacity: .10, side: THREE.DoubleSide, depthWrite: false, shininess: 60 }));
    wall.rotation.x = Math.PI / 2;
    wall.position.z = RULES.shieldZ / 2 - .03;
    scene.add(wall);
    const rimBase = planeRing(9.5, 10.37, RULES.shieldZ + .30, 0x182e3e, .96);
    rimBase.material.depthWrite = true;
    scene.add(rimBase);
    const outer = torus(10.20, .19, 0x486b78, .85);
    outer.position.z = RULES.shieldZ + .31; scene.add(outer);
    const inner = torus(9.58, .065, 0x90d6eb, .65);
    inner.position.z = RULES.shieldZ + .38; scene.add(inner);
    const bottom = torus(9.72, .17, 0x34546b, .67);
    bottom.position.z = .2; scene.add(bottom);
    for (let k = 1; k <= 6; k++) {
      const seam = torus(9.73, .016, k % 2 ? 0x52859b : 0x6b72a6, .18, 112);
      seam.position.z = k * 1.48; scene.add(seam);
    }
    // Small runic marks encode the magic barrier instead of explanatory labels.
    for (let j = 0; j < 48; j++) {
      const theta = j * (Math.PI * 2 / 48);
      const rune = new THREE.Mesh(new THREE.TetrahedronGeometry(j % 4 === 0 ? .22 : .12, 0),
        new THREE.MeshBasicMaterial({ color: j % 3 ? 0x618596 : 0x90dce7, transparent: true, opacity: .72 }));
      rune.position.set(9.99 * Math.cos(theta), 9.99 * Math.sin(theta), RULES.shieldZ + .43);
      rune.rotation.z = theta; scene.add(rune);
    }

    this.wallLights = [];
    const glowMaterial = [0x71c7f6, 0xb992f2, 0x70ddc8];
    for (let i = 0; i < 15; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowMap,
        color: glowMaterial[i % 3], transparent: true, opacity: .42,
        blending: THREE.AdditiveBlending, depthWrite: false }));
      sprite.scale.set(1.35 + (i % 3) * .4, 1.35 + (i % 3) * .4, 1);
      sprite.userData = { phase: i * 2.4, speed: .055 + i * .003, zBase: 1.1 + (i % 7) * 1.15 };
      this.wallLights.push(sprite); scene.add(sprite);
    }
  }

  makeCrystalField() {
    const { game, scene } = this;
    const body = new THREE.InstancedMesh(crystalGeometry(),
      new THREE.MeshPhongMaterial({ color: 0xffffff, vertexColors: true,
        specular: 0xa6f4ff, shininess: 110, flatShading: true,
        transparent: true, opacity: .20, depthWrite: false,
        side: THREE.FrontSide }), game.total);
    body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    body.name = 'Eight-layer filled crystalline voxel well';
    const rand = seeded(8401), cursor = new THREE.Object3D();
    const accentIds = [];
    let i = 0;
    for (let id = 0; id < game.grid.length; id++) {
      if (!game.grid[id]) continue;
      const k = Math.floor(id / (RULES.cells * RULES.cells));
      const rem = id % (RULES.cells * RULES.cells);
      const iy = Math.floor(rem / RULES.cells), ix = rem % RULES.cells;
      const pos = brickPosition(ix, iy, k);
      cursor.position.set(pos.x, pos.y, pos.z);
      cursor.scale.set(.99, .99, 1); cursor.rotation.set(0, 0, 0);
      cursor.updateMatrix(); body.setMatrixAt(i, cursor.matrix);
      const radius = Math.hypot(pos.x, pos.y);
      const color = new THREE.Color().setHSL(
        .51 + .2 * rand() + .015 * Math.sin(k * 1.5),
        .54 + rand() * .28, .47 + .18 * (1 - radius / RULES.crystalRadius) + rand() * .12);
      body.setColorAt(i, color);
      this.crystalMap[id] = i;
      if ((id * 13 + k * 7) % 11 === 0) accentIds.push({ id, pos, color });
      i++;
    }
    body.count = i;
    body.instanceMatrix.needsUpdate = true;
    body.instanceColor.needsUpdate = true;
    body.computeBoundingSphere();
    body.renderOrder = 2;
    scene.add(body); this.crystals = body;

    const accents = new THREE.InstancedMesh(new THREE.OctahedronGeometry(.33, 0),
      new THREE.MeshPhongMaterial({ color: 0xffffff, vertexColors: true,
        emissive: 0x122a47, shininess: 125, flatShading: true,
        transparent: true, opacity: .34, depthWrite: false }), accentIds.length);
    accents.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    accentIds.forEach((item, index) => {
      const { pos } = item;
      cursor.position.set(pos.x + .09, pos.y - .03, pos.z + .17);
      cursor.rotation.set(.5, .22, (index % 7) * .65);
      cursor.scale.set(.72, .85, 1.0); cursor.updateMatrix();
      accents.setMatrixAt(index, cursor.matrix);
      accents.setColorAt(index, item.color.clone().lerp(new THREE.Color(0xb5f0ee), .24));
      this.gemMap[item.id] = index;
    });
    accents.instanceMatrix.needsUpdate = true;
    if (accentIds.length) accents.instanceColor.needsUpdate = true;
    accents.renderOrder = 3; scene.add(accents); this.accents = accents;
  }

  makeShield() {
    const root = new THREE.Group();
    root.name = 'Player magic circular downward-facing shield';
    const core = new THREE.Mesh(new THREE.CircleGeometry(RULES.shieldRadius, 72),
      new THREE.MeshBasicMaterial({ color: 0x8dd5ea, transparent: true,
        opacity: .16, depthWrite: false, side: THREE.DoubleSide }));
    root.add(core);
    const tor = torus(RULES.shieldRadius, .085, 0x8ef1ff, .9, 72); root.add(tor);
    const inner = torus(RULES.shieldRadius * .63, .028, 0xe9d1ff, .81, 72);
    inner.position.z = .025; root.add(inner);
    const runeGroup = new THREE.Group(); root.add(runeGroup);
    for (let i = 0; i < 8; i++) {
      const angle = i / 8 * Math.PI * 2;
      const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(.13, 0),
        new THREE.MeshBasicMaterial({ color: i % 2 ? 0xbea4f3 : 0xa1eafb }));
      shard.position.set(Math.cos(angle) * .95, Math.sin(angle) * .95, .08);
      shard.rotation.z = angle;
      runeGroup.add(shard);
    }
    root.position.z = RULES.shieldZ;
    this.scene.add(root);
    this.shield = root;
    this.shieldRings = { tor, inner, runeGroup };
  }

  makeBall() {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(RULES.ballRadius, 2),
      new THREE.MeshBasicMaterial({ color: 0xf8f2d4 }));
    mesh.name = 'Magic ball'; this.scene.add(mesh); this.ball = mesh;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowMap,
      color: 0xa7e7ff, blending: THREE.AdditiveBlending,
      transparent: true, opacity: .85, depthWrite: false }));
    halo.scale.set(2.1, 2.1, 1);
    this.scene.add(halo); this.ballHalo = halo;
    const topGhost = new THREE.Group();
    topGhost.layers.set(1); // orthographic main camera only
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowMap,
      color: 0xc4efff, opacity: .75, transparent: true,
      depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(2.65, 2.65, 1);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(.22, 20),
      new THREE.MeshBasicMaterial({ color: 0xfdf5d5, transparent: true,
        opacity: .85, depthTest: false, depthWrite: false }));
    topGhost.add(glow, dot);
    topGhost.traverse(part => part.layers.set(1)); // children must also be invisible in the side camera
    topGhost.position.z = RULES.shieldZ + 1.3;
    this.scene.add(topGhost); this.ghost = topGhost;
    const sideGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowMap,
      color: 0xd4f4ff, opacity: .67, transparent: true,
      depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    sideGlow.layers.set(2); // independent true-3D silhouette for side view, not projection
    sideGlow.scale.set(1.75, 1.75, 1);
    sideGlow.renderOrder = 50;
    this.scene.add(sideGlow); this.sideGhost = sideGlow;
    const predictor = torus(.53, .032, 0xf2dba4, .5, 42);
    predictor.layers.set(1); predictor.material.depthTest = false;
    predictor.position.z = RULES.shieldZ + 1.15;
    this.scene.add(predictor); this.predictor = predictor;
  }

  removeCrystals(ids) {
    const dummy = new THREE.Object3D();
    dummy.position.set(0, 0, -120);
    dummy.scale.setScalar(.001);
    dummy.updateMatrix();
    for (const id of ids) {
      const i = this.crystalMap[id];
      if (i >= 0) this.crystals.setMatrixAt(i, dummy.matrix);
      const gem = this.gemMap[id];
      if (gem >= 0) this.accents.setMatrixAt(gem, dummy.matrix);
    }
    this.crystals.instanceMatrix.needsUpdate = true;
    this.accents.instanceMatrix.needsUpdate = true;
  }

  update(dt, t, winRise = 0) {
    const g = this.game;
    this.shield.position.set(g.shield.x, g.shield.y, RULES.shieldZ);
    this.shieldRings.runeGroup.rotation.z = t * .36;
    this.shieldRings.inner.rotation.z = -t * .23;
    this.shieldRings.tor.material.opacity = .75 + Math.sin(t * 3) * .13;
    this.ball.position.set(g.ball.x, g.ball.y, g.ball.z);
    this.ballHalo.position.copy(this.ball.position);
    this.sideGhost.position.copy(this.ball.position);
    this.sideGhost.material.opacity = .50 + .14 * Math.sin(t * 8);
    this.ballHalo.material.opacity = .63 + .13 * Math.sin(t * 11);
    this.ghost.position.set(g.ball.x, g.ball.y, RULES.shieldZ + 1.6);
    this.ghost.children[0].material.opacity = .52 + .16 * Math.sin(t * 8);
    const ball = g.ball;
    const approaching = g.state === 'playing' && ball.vz > 1 && ball.z > 4.4;
    this.predictor.visible = approaching;
    if (approaching) {
      const future = Math.max(0, (RULES.shieldZ - ball.z) / ball.vz);
      const x = ball.x + ball.vx * future, y = ball.y + ball.vy * future;
      const r = Math.hypot(x, y);
      const ratio = r > RULES.wellRadius ? RULES.wellRadius / r : 1;
      this.predictor.position.set(x * ratio, y * ratio, RULES.shieldZ + 1.2);
      this.predictor.material.opacity = .24 + .34 * Math.min(1, ball.z / RULES.shieldZ);
      this.predictor.scale.setScalar(1 + Math.sin(t * 7) * .09);
    }
    for (const [i, light] of this.movingLights.entries()) {
      const a = t * (.11 + .05 * i) + i * Math.PI;
      light.position.set(Math.cos(a) * 8.1, Math.sin(a) * 8.1, 3.8 + Math.sin(t * .5 + i) * 2.6);
    }
    for (const glow of this.wallLights) {
      const { phase, speed, zBase } = glow.userData;
      const angle = phase + t * speed;
      glow.position.set(Math.cos(angle) * 9.56, Math.sin(angle) * 9.56,
        zBase + Math.sin(t * .49 + phase) * .67);
      glow.material.opacity = .20 + .2 * (1 + Math.sin(t * .83 + phase)) * .5;
    }
    this.dragon.userData.update(t, winRise);
  }
}
