import * as THREE from 'three';
import { QUALITY } from './quality.js';

/** A small, generated reflection environment. No network assets or SVG textures. */
export function makeReflectionEnvironment() {
  const canvas = document.createElement('canvas');
  canvas.width = QUALITY.reflectionWidth; canvas.height = QUALITY.reflectionHeight;
  const ctx = canvas.getContext('2d');
  ctx.scale(QUALITY.reflectionWidth / 512, QUALITY.reflectionHeight / 256);
  const sky = ctx.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0, '#bddaff'); sky.addColorStop(.32, '#758dad');
  sky.addColorStop(.49, '#dbf7ff'); sky.addColorStop(.54, '#354967');
  sky.addColorStop(1, '#15283d'); ctx.fillStyle = sky; ctx.fillRect(0, 0, 512, 256);
  for (const [x, color, w] of [[65, '#d9fbff', 19], [205, '#95fff3', 10], [335, '#e8ceff', 27], [455, '#fff0cd', 11]]) {
    const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, color); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(x - w, 12, w * 2, 196);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Hybrid optics: actual faceted geometry, analytic refracted light and caustics.
 * No expensive per-brick transmission pass; lamps also illuminate the PBR models.
 */
export function makeCrystalMaterial(lamps) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.FrontSide,
    uniforms: {
      uTime: { value: 0 }, uEye: { value: new THREE.Vector3(0, -12, 38) },
      uBall: { value: new THREE.Vector3() },
      uLamps: { value: lamps.map(l => l.position) },
    },
    vertexShader: `
      attribute vec3 aOpenPositive; attribute vec3 aOpenNegative;
      varying float vSurface;
      varying vec3 vWorld; varying vec3 vNormal; varying vec3 vLocal; varying vec3 vTint;
      void main() {
        vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorld = world.xyz; vLocal = position; vTint = instanceColor;
        // Highlight actual exposed faces, not every buried face in an eight-layer stack.
        vSurface = clamp(dot(max(normal,vec3(0.)),aOpenPositive)
                       + dot(max(-normal,vec3(0.)),aOpenNegative),0.,1.);
        vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      varying float vSurface;
      uniform float uTime; uniform vec3 uEye; uniform vec3 uBall; uniform vec3 uLamps[4];
      varying vec3 vWorld; varying vec3 vNormal; varying vec3 vLocal; varying vec3 vTint;
      void main() {
        vec3 N = normalize(vNormal), V = normalize(uEye - vWorld);
        vec3 q = abs(vLocal) / vec3(.49, .50, .45);
        float edge = smoothstep(.78, .99, max(min(q.x,q.y), max(min(q.y,q.z),min(q.x,q.z))));
        float fresnel = pow(1.0 - abs(dot(N,V)), 3.0);
        vec3 refracted = refract(-V, N, .68);
        float band = pow(.5+.5*sin(dot(refracted,vec3(7.,11.,5.))), 12.);
        vec3 light = vec3(.31, .36, .44);
        float sparkle = 0.;
        for (int i=0; i<4; i++) {
          vec3 d = uLamps[i] - vWorld;
          float attenuation = 1.0 / (1.0 + dot(d,d) * .027);
          vec3 L = normalize(d);
          vec3 tint = i == 0 ? vec3(.55,.92,1.) : i == 1 ? vec3(.85,.65,1.) : i == 2 ? vec3(.55,1.,.85) : vec3(1.,.88,.64);
          float diffuse = .32 + .68 * abs(dot(N,L));
          float wave = sin(dot(vWorld,vec3(2.1,1.4,1.7)) + uTime*.75 + float(i)*1.7)
                     * sin(dot(vWorld,vec3(-1.2,2.4,.8)) - uTime*.53);
          float caustic = pow(1.0-abs(wave), 13.);
          light += tint * attenuation * (diffuse*.55 + caustic*.52);
          sparkle += pow(max(dot(reflect(-L,N),V),0.),64.) * attenuation;
        }
        vec3 color = vTint * light;
        color += vec3(.35,.68,.86) * (fresnel*.42 + band*.20);
        color += mix(vTint,vec3(.70,.90,1.),.5) * band*.12 + vec3(sparkle*.65);
        // A slight bevel shadow separates bricks without drawing a wireframe over the scene.
        color *= mix(1.,.70,smoothstep(.72,.87,max(q.x,q.y))*(1.-edge));
        // Near faces retain stronger definition; distant layers stay translucent.
        float alpha = mix(.025 + edge*.025, .57 + edge*.20 + fresnel*.08, vSurface);
        float clearBall = 1.0-smoothstep(.6,1.65,length(vWorld-uBall));
        alpha *= 1.0 - clearBall*.65;
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

/** Real bevelled annular masonry, with a small seam between adjacent segments. */
export function arcBlock(inner, outer, angle, height, bevel = .045) {
  const shape = new THREE.Shape();
  const gap = .007;
  shape.absarc(0, 0, outer, gap, angle-gap, false);
  shape.lineTo(inner*Math.cos(angle-gap), inner*Math.sin(angle-gap));
  shape.absarc(0, 0, inner, angle-gap, gap, true); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, steps: 1,
    bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 3 });
  geometry.translate(0, 0, -height/2);
  return geometry;
}

/** Camera-relative cutaway on the real wall; never fade the playable crystals. */
export function wallMaterial() {
  const material = new THREE.MeshStandardMaterial({ color: 0x4b7790, metalness: .32,
    roughness: .28, emissive: 0x123046, emissiveIntensity: .33,
    transparent: true, opacity: .62, depthWrite: false });
  const eye = { value: new THREE.Vector3(0, -12, 38) };
  const time = { value: 0 };
  material.userData.eye = eye; material.userData.time = time;
  material.onBeforeCompile = shader => {
    shader.uniforms.cwEye = eye; shader.uniforms.cwTime = time;
    shader.vertexShader = 'varying vec3 cwWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
      #include <project_vertex>
      vec4 cwP = vec4(transformed,1.0);
      #ifdef USE_INSTANCING
        cwP = instanceMatrix * cwP;
      #endif
      cwWorld = (modelMatrix * cwP).xyz;
    `);
    shader.fragmentShader = 'varying vec3 cwWorld; uniform vec3 cwEye; uniform float cwTime;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float cwFront = dot(normalize(cwWorld.xy), normalize(cwEye.xy));
      float cwOpening = smoothstep(-.12,.45,cwFront);
      diffuseColor.a *= mix(1.0,.075,cwOpening);
      float cwFlow = pow(.5+.5*sin(cwWorld.z*2.5+atan(cwWorld.y,cwWorld.x)*9.-cwTime*.7),18.);
      diffuseColor.rgb += vec3(.12,.40,.48)*cwFlow;
    `);
  };
  material.customProgramCacheKey = () => 'crystal-well-wall-cutaway-v1';
  return material;
}
