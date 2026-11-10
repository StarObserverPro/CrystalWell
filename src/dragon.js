import * as THREE from 'three';

// Procedural Eastern-style crystal dragon. Its complex silhouette is visual only:
// gameplay collides with the lightweight brow height field in physics.js.
const AMETHYST = 0x786eab;
const INDIGO = 0x3b4b88;
const ICE = 0x91dbe5;

function gemMaterial(color, opacity = 0.86) {
  return new THREE.MeshPhongMaterial({
    color, emissive: new THREE.Color(color).multiplyScalar(0.19),
    shininess: 110, specular: 0x8dccf2,
    flatShading: true, transparent: opacity < 1, opacity,
    depthWrite: opacity >= 1,
  });
}

function taperedSegment(parent, a, b, r0, r1, material, sides = 6) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const geometry = new THREE.CylinderGeometry(r1, r0, dir.length(), sides, 1);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  parent.add(mesh);
  return mesh;
}
function v(x, y, z) { return new THREE.Vector3(x, y, z); }
function tetra(parent, x, y, z, size, colorMaterial, rotation = 0) {
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(size, 0), colorMaterial);
  mesh.position.set(x, y, z); mesh.rotation.set(rotation, .23, rotation * .5);
  parent.add(mesh); return mesh;
}
function whisker(parent, coords, material) {
  const curve = new THREE.CatmullRomCurve3(coords.map(p => v(...p)));
  parent.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 17, .038, 4, false), material));
}

export function makeDragon() {
  const root = new THREE.Group();
  root.name = 'Sleeping Crystal Dragon';
  const purple = gemMaterial(AMETHYST, .94);
  const dark = gemMaterial(INDIGO, .97);
  const azure = gemMaterial(0x56a9bb, .87);
  const frosted = gemMaterial(ICE, .91);
  const pink = gemMaterial(0xdc9fe3, .95);
  const eye = new THREE.MeshBasicMaterial({ color: 0xf9f0bd });
  const vein = new THREE.MeshBasicMaterial({ color: 0x6de5f5, transparent: true, opacity: .82 });

  // The long coiled body becomes visible as the dragon rises from the well.
  const bodyCurve = new THREE.CatmullRomCurve3([
    v(0, .8, .22), v(.6, 2.1, -.6), v(2.3, 1.6, -1.65),
    v(2.0, -1.8, -3.1), v(-1.4, -2.2, -4.8), v(-2.1, 1.4, -6.1),
    v(1.4, 2.2, -7.5), v(2.2, -1.8, -9.0), v(-1.8, -2.0, -10.6),
  ]);
  const body = new THREE.Mesh(new THREE.TubeGeometry(bodyCurve, 80, .52, 7, false), dark);
  root.add(body);
  for (let i = 2; i < 60; i += 3) {
    const t = i / 70;
    const p = bodyCurve.getPoint(t);
    const side = bodyCurve.getTangent(t);
    const up = v(-side.y, side.x, .85).normalize();
    taperedSegment(root, p.clone().addScaledVector(up, .22),
      p.clone().addScaledVector(up, .9 * (1 - t * .35)), .17 * (1 - t * .55), 0, i % 2 ? frosted : purple, 4);
  }

  const head = new THREE.Group();
  head.position.set(0, 0, .94);
  root.add(head);
  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(1.12, 1), purple);
  skull.scale.set(1.03, 1.36, .70); skull.position.set(0, .25, .02);
  head.add(skull);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(.91, 0), azure);
  crown.scale.set(1.02, .95, .42); crown.position.set(0, .06, .53);
  head.add(crown);
  const bridge = new THREE.Mesh(new THREE.IcosahedronGeometry(.64, 1), dark);
  bridge.scale.set(.83, 1.85, .65); bridge.position.set(0, -1.02, -.19);
  head.add(bridge);
  const snout = new THREE.Mesh(new THREE.ConeGeometry(.49, 1.25, 6), frosted);
  snout.rotation.z = Math.PI; snout.position.set(0, -1.85, -.24);
  head.add(snout);
  for (const sign of [-1, 1]) {
    // Characteristic long antler-like horns: avoids generic winged western dragon.
    taperedSegment(head, v(sign * .77, .62, .36), v(sign * 1.27, .83, 1.19), .23, .17, dark);
    taperedSegment(head, v(sign * 1.27, .83, 1.19), v(sign * 1.58, 1.28, 2.12), .17, 0, frosted);
    taperedSegment(head, v(sign * 1.18, .79, 1.05), v(sign * 1.75, .23, 1.61), .10, 0, azure, 5);
    taperedSegment(head, v(sign * 1.40, 1.01, 1.51), v(sign * 1.79, 1.57, 1.79), .08, 0, pink, 5);
    // Angular cheek fins and jaw extensions.
    tetra(head, sign * 1.14, -.12, -.12, .63, sign > 0 ? azure : purple, sign * .35);
    tetra(head, sign * 1.26, .38, .42, .40, frosted, sign * .27);
    const e = new THREE.Mesh(new THREE.SphereGeometry(.17, 9, 6), eye);
    e.position.set(sign * .56, -.78, .12); head.add(e);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(.077, 8, 6), dark);
    pupil.position.set(sign * .59, -.91, .15); head.add(pupil);
    const lower = new THREE.Mesh(new THREE.SphereGeometry(.25, 6, 5), vein);
    lower.scale.set(.7, .22, .3); lower.position.set(sign * .34, -1.51, -.35); head.add(lower);
    whisker(head, [
      [sign * .5, -1.4, -.3], [sign * .97, -2.02, -.28],
      [sign * 1.72, -2.38, -.47], [sign * 2.17, -2.13, -.21],
    ], frosted);
    for (let j = 0; j < 3; j++) {
      const y = -.35 + j * .58;
      taperedSegment(head, v(sign * (.84 + j * .04), y, .36),
        v(sign * (1.27 + j * .17), y + .24, .75 + .19 * j), .16, 0, j % 2 ? pink : frosted, 5);
    }
  }
  // Forehead crystal crown, softly glowing while the dragon is sealed.
  tetra(head, 0, -.42, .86, .43, pink, .4);
  tetra(head, 0, -.02, .98, .29, frosted, .25);
  for (let j = 0; j < 4; j++) tetra(head, 0, .55 + j * .28, .76 + j * .09, .24 + .06 * j, purple, j * .23);

  const glow = new THREE.PointLight(0x8abaff, .62, 10, 2);
  glow.position.set(0, -.5, .6); head.add(glow);
  root.userData.head = head;
  root.userData.glow = glow;
  root.userData.update = (time, rise = 0) => {
    const ease = 1 - Math.pow(1 - Math.min(1, rise), 3);
    root.position.set(Math.sin(time * .85) * .43, Math.cos(time * .63) * .29, ease * 17.5);
    root.rotation.z = ease * Math.PI * 1.35;
    head.rotation.set(Math.sin(time * .6) * .06, Math.sin(time * .92) * .07, Math.sin(time * .47) * .09);
    glow.intensity = .55 + .16 * Math.sin(time * 1.5) + rise * 2;
  };
  return root;
}
