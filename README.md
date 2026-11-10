# 水晶之井 · Crystal Well

A playable, almost wordless, desktop / landscape-mobile 3D brick breaker. An Eastern-style crystal dragon sleeps under eight **solid layers of breakable crystal bricks** in a stone well. Catch the returning magical ball with a round shield above the opening; break the crystals and release the dragon.

## Play

The game is **static**: no account, keys, server, build system, or development UI is needed. Serve the repository root over HTTP and open its URL in a modern WebGL2 browser.

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

It uses a pinned [Three.js](https://threejs.org/) ES module (`0.187.0`) from jsDelivr, so an internet connection is needed on initial load. GitHub Pages, Vercel, or any static host can serve the same files directly. For offline distribution, vendor Three.js locally and update the import map in `index.html`.

**Controls:** move the pointer or drag a finger within the large top-down view to move the circular shield in XY; tapping/clicking sends the first orb downward early. Keyboard: arrows or WASD to move, Space to launch, P/Esc to pause, R to restart. All of these are optional; the orb launches automatically after a short visual cue. Portrait layout shows a rotate-device prompt instead of a squeezed game. The small controls use icons rather than explanatory copy.

## Implementation and performance

- `src/physics.js`: deterministic fixed-step 3D sphere-vs-voxel, circular stone wall, 2D XY shield plane, moving dragon forehead **height-field collider**. Rendering never drives the physics.
- `src/world.js`: one instanced mesh for the roughly 2,000 beveled semi-transparent brick bodies, one sparse instanced gemstone overlay, 3D stone rim, procedural dark wilderness, drifting well-wall glows, 2 real moving point lights, magic shield and persistent ball-location ghost seen **only from above**.
- `src/dragon.js`: original stylized Eastern crystal dragon mesh (antlers, snout, whiskers, eyes, coiled body), with independent lightweight gameplay collider. The whole model is replaceable.
- `src/vfx.js`: 330 pooled magic motes in one draw call, additive glows and chip bursts. Particle counts are bounded.
- `src/main.js`: main orthographic clear top view every display frame; the half-perspective side view renders to a **low-resolution WebGLRenderTarget at 18 FPS desktop / 14 FPS touch**, then blits its cached texture cheaply every main frame. One WebGL context, one renderer.

Crystal transparency is a **stylized approximation**, not physically accurate per-crystal refraction. This controls transparency overdraw, which is the main rendering risk. The secondary view remains intentionally lower resolution and framerate. Every defeated voxel disappears from the existing instanced mesh without generating hundreds of individual mesh objects.

The initial level's **front (-Y) surface contains a concave notch several voxels deep**. The grid is genuinely filled radially from center to outer layer and along eight height layers; it is not a single hollow cylindrical band. Crystal damage spreads in small local fractures, with late-stage resonance pulses to avoid laborious cleanup. Victory is triggered only when the level's crystals have all been removed (a tiny last cluster collapses together), causing the crystal dragon to rise from the well.

## Development checks

```bash
npm test       # Node's built-in unit runner; no npm install required
npm run check  # JavaScript parse checks; no npm install required
```

The WebGL rendering path still needs visual/performance QA in a device browser. Suggested acceptance checks: readable ball and shield in the top view even through eight crystal layers; original concavity visible from the side; 60 FPS target on ordinary desktop and 14–18 FPS side refresh; correct capture/miss and no ball tunneling; comfortable thumb input in landscape mobile; dragon eruption and no uncaught WebGL errors. No specific FPS claim is made before device testing.

## Asset policy

All geometry, particles, glyphs, textures, and UI are created in this repository's code, rather than bundling third-party meshes. For later dragon-art upgrades, a promising **CC0** source is [Quaternius Animated Monster Pack](https://quaternius.com/packs/animatedmonster.html), also catalogued as [Dragon at Poly Pizza](https://poly.pizza/m/VBvzjFIYws). Its design is western/cartoonish; the original in-code placeholder intentionally uses a more elongated Eastern dragon silhouette. If replacing it with an external model, first verify that the *specific* file is CC0, document source and license, and normalize its scale/orientation. The runtime collider should remain the cheap height field.

Three.js © contributors, MIT License, loaded as a third-party dependency (not copied into this repository).
