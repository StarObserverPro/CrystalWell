import * as THREE from 'three';

export const vec = (x, y, z) => new THREE.Vector3(x, y, z);
export function put(parent, geometry, material, position = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...position); m.scale.set(...scale); parent.add(m); return m;
}
export function crystal(color, options = {}) {
  return new THREE.MeshPhysicalMaterial({ color, metalness: .22, roughness: .19,
    clearcoat: 1, clearcoatRoughness: .12, envMapIntensity: 1.3,
    emissive: color, emissiveIntensity: .055, ...options });
}
export function polygon(points, depth = .2, bevel = .04) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: bevel > 0,
    bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 3 });
  g.translate(0, 0, -depth / 2); return g;
}
export function taperedCurve(points, radius, endRadius = 0, steps = 24, sides = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => vec(...p)));
  const frames = curve.computeFrenetFrames(steps, false), positions = [], indices = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, c = curve.getPointAt(t), r = radius * (1 - t) + endRadius * t;
    for (let j = 0; j < sides; j++) {
      const a = j / sides * Math.PI * 2;
      const p = c.clone().addScaledVector(frames.normals[i], Math.cos(a) * r)
        .addScaledVector(frames.binormals[i], Math.sin(a) * r);
      positions.push(p.x, p.y, p.z);
      if (i < steps) {
        const k = i * sides + j, n = i * sides + (j + 1) % sides;
        indices.push(k, n, k + sides, n, n + sides, k + sides);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices); g.computeVertexNormals(); return g;
}

/** Bake static component meshes by material. Keeps sculptural detail without one draw per scale. */
export function batchStatic(root) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert(), batches = new Map(), originals = [];
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material)) return;
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
    g.applyMatrix4(inverse.clone().multiply(o.matrixWorld));
    const key = o.material.uuid + ':' + o.renderOrder;
    if (!batches.has(key)) batches.set(key, { material: o.material, order: o.renderOrder, geometries: [] });
    batches.get(key).geometries.push(g); originals.push(o);
  });
  for (const o of originals) o.removeFromParent();
  for (const batch of batches.values()) {
    const g = new THREE.BufferGeometry();
    for (const name of ['position', 'normal']) {
      const length = batch.geometries.reduce((n, x) => n + x.attributes[name].array.length, 0);
      const data = new Float32Array(length); let offset = 0;
      for (const part of batch.geometries) { data.set(part.attributes[name].array, offset); offset += part.attributes[name].array.length; }
      g.setAttribute(name, new THREE.BufferAttribute(data, 3));
    }
    const m = new THREE.Mesh(g, batch.material); m.renderOrder = batch.order; root.add(m);
    for (const x of batch.geometries) x.dispose();
  }
  // Shared source geometries are disposed once, after all transformations are baked.
  const unique = new Set(originals.map(o => o.geometry));
  for (const g of unique) g.dispose();
  return root;
}
