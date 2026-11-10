import * as THREE from 'three';
import { dragonPose, DRAGON } from './dragon-shape.js';
import { put, crystal, taperedCurve, batchStatic } from './model-kit.js';

/** A broad Eastern dragon: long muzzle, heavy eyebrows, antlers, mane, beard and swept whiskers.
 * The entire head silhouette fits within the 19.44-unit well; only its brow is a collider.
 */
export function makeDragon() {
  const root = new THREE.Group(); root.name = 'Crystal sovereign / full-well dragon';
  const jade = crystal(0x438ca4, { roughness: .22, metalness: .26 });
  const dark = crystal(0x293d73, { roughness: .3, metalness: .32 });
  const blue = crystal(0x759ddc, { roughness: .16 });
  const ice = crystal(0xa5e9ed, { roughness: .13 });
  const violet = crystal(0xa890ce, { roughness: .16 });
  const black = crystal(0x07131f, { roughness: .35, metalness: .05 });
  const gold = crystal(0xffd58b, { emissiveIntensity: .8, roughness: .12 });
  const head = new THREE.Group(); head.name = '17.14-wide antlered head'; root.add(head);
  const ellipsoid = (p, s, mat, detail = 2) => put(head, new THREE.IcosahedronGeometry(1, detail), mat, p, s);
  ellipsoid([0, .6, -.3], [4.7, 4.5, 1.12], jade);
  ellipsoid([0, -.6, .08], [3.55, 3.45, .8], blue);
  ellipsoid([0, -3.5, -.34], [2.5, 2.8, .76], jade);
  ellipsoid([0, -5.55, -.34], [2.72, 1.18, .65], ice);
  // A genuinely separate jaw and nose, rather than a triangular cone for a face.
  ellipsoid([0, -4.55, -.99], [2.58, 2.25, .35], dark);
  ellipsoid([0, -5.9, -.77], [2.5, .7, .28], violet);
  ellipsoid([0, -5.65, .03], [1.82, .76, .35], blue);
  for (const sign of [-1, 1]) {
    const nostril = ellipsoid([sign * 1.14, -6.17, .12], [.40, .21, .14], black, 1);
    nostril.rotation.z = -sign * .2;
    // Eyes look up towards the player under thick, slanted brows.
    const socket = ellipsoid([sign * 2.55, -2.6, .48], [1.12, .75, .24], dark);
    socket.rotation.z = sign * .24;
    const eye = ellipsoid([sign * 2.5, -2.78, .67], [.66, .36, .14], gold);
    eye.rotation.z = sign * .26;
    ellipsoid([sign * 2.5, -2.79, .81], [.11, .28, .045], black, 1);
    const brow = ellipsoid([sign * 2.5, -2.12, .76], [1.35, .48, .34], ice, 1);
    brow.rotation.z = sign * .30;
    ellipsoid([sign * 4.0, -.85, -.05], [1.55, 2.0, .87], blue, 1);
    // Broad ear fins and overlapping cheek mane plates.
    for (let j = 0; j < 7; j++) {
      const a = -.8 + j * .25;
      const plate = put(head, new THREE.OctahedronGeometry(1, 1), j % 2 ? violet : ice,
        [sign * (4.4 + Math.sin(j * .45) * .5), -1.7 + j * .91, .02], [1.50, .55, .35]);
      plate.rotation.z = sign * a;
    }
    // Long antlers spread along the rim, staying below the first crystal layer.
    const horn = [[sign * 3.6, 2.0, .25], [sign * 4.9, 3.4, .88],
      [sign * 5.9, 4.2, 1.04], [sign * 5.8, 5.6, 1.17], [sign * 6.3, 6.0, 1.2]];
    put(head, taperedCurve(horn, .52, .04, 32, 10), ice);
    for (let j = 0; j < 3; j++) {
      const x = 4.9 + j * .36, y = 3.4 + j * .66;
      put(head, taperedCurve([[sign * x, y, .85], [sign * (x + 1.3), y + .13, 1.03],
        [sign * (x + 1.7), y + .55, 1.13]], .22, .025, 14, 8), j % 2 ? violet : blue);
    }
    // Sculpted thick whiskers; not wire strokes or line primitives.
    put(head, taperedCurve([[sign * 2.0, -5.52, -.03], [sign * 4.3, -6.16, .1],
      [sign * 6.7, -5.6, .30], [sign * 8.45, -2.50, .55], [sign * 8.25, -.8, .8]], .24, .07, 40, 10), ice);
    for (let j = 0; j < 3; j++) {
      const fang = put(head, new THREE.ConeGeometry(.16, .48, 8), ice,
        [sign * (1.0 + j * .56), -5.25 - j * .12, -.84]);
      fang.rotation.x = Math.PI / 2;
    }
    // Beard clumps fan below the chin.
    for (let j = 0; j < 3; j++) {
      put(head, taperedCurve([[sign * (.4 + j * .45), -5.9, -.8], [sign * (1 + j * .6), -7.0, -.7],
        [sign * (1.4 + j * .65), -7.5 + j * .26, -.3]], .28, .035, 18, 8), j % 2 ? violet : ice);
    }
  }
  // Overlapping crown scales make the forehead a coherent sculpted surface.
  for (let row = 0; row < 5; row++) for (let col = -2; col <= 2; col++) {
    const x = col * 1.03, y = -.85 + row * .96;
    const s = put(head, new THREE.OctahedronGeometry(1, 1), (row + col) % 3 ? jade : violet,
      [x, y, .72 - row * .018], [.62, .84, .19]);
    s.rotation.z = .12 * col;
  }
  put(head, new THREE.OctahedronGeometry(.66, 1), gold, [0, -1.10, .95], [.8, 1.2, .3]);
  for (let j = 0; j < 5; j++) {
    put(head, new THREE.OctahedronGeometry(1, 1), j % 2 ? blue : ice,
      [0, 1.2 + j * .68, .74], [.38, .66, .30]);
  }
  batchStatic(head);

  const body = new THREE.Group(); body.name = 'Coiled crystal body'; root.add(body);
  const curve = [[0, 4.1, -1.3], [3.4, 3.8, -3.1], [4, -2, -5.4],
    [-3.8, -2.5, -7.4], [-4, 3.5, -10], [4.1, 2.2, -12.6], [1.6, -4.8, -15.3], [-3.5, -2.5, -19]];
  put(body, taperedCurve(curve, 1.75, .12, 160, 14), jade);
  const spine = new THREE.CatmullRomCurve3(curve.map(p => new THREE.Vector3(...p)));
  for (let j = 1; j < 40; j++) {
    const t = j / 42, p = spine.getPointAt(t);
    const scale = 1 - .72 * t;
    put(body, new THREE.OctahedronGeometry(1, 1), j % 2 ? ice : violet,
      [p.x, p.y, p.z + .7], [.45 * scale, .8 * scale, .9 * scale]);
  }
  batchStatic(body);
  const glow = new THREE.PointLight(0x7fe2ff, 5, 18, 1.8);
  glow.position.set(0, -2, 2.6); root.add(glow);
  root.userData.head = head; root.userData.glow = glow; root.userData.silhouetteWidth = DRAGON.silhouetteWidth;
  root.userData.update = (time, rise = 0) => {
    const ease = 1 - Math.pow(1 - Math.min(1, rise), 3), p = dragonPose(time);
    root.position.set(p.x, p.y, ease * 26);
    root.rotation.z = ease * Math.PI * 1.35;
    // Very small motion: the head is massive. The shared brow supplies the collision slopes.
    head.rotation.set(Math.sin(time * .6) * .009, Math.sin(time * .92) * .012, Math.sin(time * .47) * .018);
    glow.intensity = 5 + Math.sin(time * 1.5) + rise * 5;
  };
  return root;
}
