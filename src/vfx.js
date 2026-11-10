import * as THREE from 'three';

// Bounded, pooled magic motes. No per-particle Mesh or draw call.
const CAPACITY = 330;
export function createGlowTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(.13, 'rgba(195,244,255,.9)');
  grd.addColorStop(.39, 'rgba(91,179,250,.29)');
  grd.addColorStop(1, 'rgba(39,79,155,0)');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class MagicMotes {
  constructor(scene) {
    this.particles = Array.from({ length: CAPACITY }, () => ({ life: 0, max: 1, vx: 0, vy: 0, vz: 0 }));
    this.pointer = 0;
    this.positions = new Float32Array(CAPACITY * 3);
    this.colors = new Float32Array(CAPACITY * 3);
    this.alpha = new Float32Array(CAPACITY);
    this.sizes = new Float32Array(CAPACITY);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage));
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uPixelRatio: { value: 1 } },
      vertexShader: `
        attribute vec3 aColor; attribute float aAlpha; attribute float aSize;
        varying vec3 vColor; varying float vAlpha; uniform float uPixelRatio;
        void main(){ vColor=aColor; vAlpha=aAlpha;
          vec4 mv=modelViewMatrix*vec4(position,1.0);
          gl_Position=projectionMatrix*mv;
          gl_PointSize=clamp(aSize*uPixelRatio*(115.0/max(2.0,-mv.z)),1.0,25.0);
        }`,
      fragmentShader: `
        varying vec3 vColor; varying float vAlpha;
        void main(){ float d=length(gl_PointCoord-vec2(.5));
          float a=(1.0-smoothstep(.11,.5,d))*vAlpha;
          gl_FragColor=vec4(vColor,a);
        }`,
    });
    this.object = new THREE.Points(geometry, material);
    this.object.frustumCulled = false;
    scene.add(this.object);
  }

  emit(x, y, z, count = 1, burst = false, hue = 'ice') {
    const color = hue === 'pink' ? [1, .42, .8] : hue === 'gold' ? [1, .82, .48] : [.36, .86, 1];
    for (let n = 0; n < count; n++) {
      const i = this.pointer++ % CAPACITY;
      const j = i * 3;
      const p = this.particles[i];
      const angle = Math.random() * Math.PI * 2;
      const speed = (burst ? 1.7 : .38) * (.3 + Math.random());
      this.positions[j] = x + (Math.random() - .5) * .18;
      this.positions[j + 1] = y + (Math.random() - .5) * .18;
      this.positions[j + 2] = z + (Math.random() - .5) * .18;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.vz = (Math.random() - .25) * speed;
      p.max = (burst ? .9 : .52) * (.6 + Math.random());
      p.life = p.max;
      this.alpha[i] = .7; this.sizes[i] = burst ? 2.1 + Math.random() * 2.5 : 1.35 + Math.random() * 1.6;
      this.colors.set(color, j);
    }
  }

  update(dt, time) {
    for (let i = 0; i < CAPACITY; i++) {
      const p = this.particles[i];
      if (p.life <= 0) { this.alpha[i] = 0; continue; }
      p.life = Math.max(0, p.life - dt);
      const j = i * 3;
      this.positions[j] += p.vx * dt;
      this.positions[j + 1] += p.vy * dt;
      this.positions[j + 2] += p.vz * dt;
      p.vz -= dt * .33;
      this.alpha[i] = (p.life / p.max) ** 1.3 * .8;
    }
    this.object.geometry.attributes.position.needsUpdate = true;
    this.object.geometry.attributes.aAlpha.needsUpdate = true;
    this.object.material.uniforms.uPixelRatio.value = Math.min(2, window.devicePixelRatio || 1);
  }
}
