import * as THREE from 'three';

/** The HUD and the hit area share a CSS-pixel circle. Its axes follow the main camera. */
export class ShieldPad extends THREE.Group {
  constructor() {
    super();
    this.visible = false;
    const glass = new THREE.MeshBasicMaterial({
      color: 0x102c40, transparent: true, opacity: .18, depthWrite: false,
    });
    this.add(new THREE.Mesh(new THREE.CircleGeometry(.98, 72), glass));

    this.trim = new THREE.MeshStandardMaterial({
      color: 0xa3e6ec, emissive: 0x204951, roughness: .32, metalness: .28,
      transparent: true, opacity: .48, depthWrite: false,
    });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.976, .019, 6, 72), this.trim);
    rim.renderOrder = 1;
    this.add(rim);

    const marks = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1), this.trim, 5);
    const stamp = new THREE.Object3D();
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2;
      stamp.position.set(.87 * Math.cos(angle), .87 * Math.sin(angle), .015);
      stamp.rotation.z = angle;
      stamp.scale.set(.064, .025, .025);
      stamp.updateMatrix();
      marks.setMatrixAt(i, stamp.matrix);
    }
    stamp.position.set(0, 0, .015);
    stamp.scale.setScalar(.032);
    stamp.updateMatrix();
    marks.setMatrixAt(4, stamp.matrix);
    marks.renderOrder = 1;
    this.add(marks);

    const inlay = new THREE.MeshBasicMaterial({
      color: 0xc5fff5, transparent: true, opacity: .88, depthWrite: false,
    });
    this.cursor = new THREE.Mesh(new THREE.TorusGeometry(.086, .021, 6, 32), inlay);
    this.cursor.renderOrder = 2;
    this.add(this.cursor);
  }

  layout(rect, appRect) {
    this.scale.setScalar(rect.width / 2);
    this.position.set(rect.left - appRect.left + rect.width / 2,
      appRect.bottom - rect.top - rect.height / 2, 0);
  }

  track(game, basis, pressed) {
    const { x, y } = game.shield;
    const radius = game.shieldTravelRadius;
    this.cursor.position.set((x * basis.right[0] + y * basis.right[1]) / radius,
      (x * basis.screenUp[0] + y * basis.screenUp[1]) / radius, .04);
    this.trim.opacity = pressed ? .86 : .48;
    this.cursor.scale.setScalar(pressed ? 1.2 : 1);
  }
}
