# Luminous presentation revision — v0.2

This revision implements the nine visual changes requested for Crystal Well. Physics,
level dimensions, the 1,926-brick filled volume, and the player-side excavation are unchanged.

## Art and illumination

- The wilderness remains dark; the playable crystals receive a much stronger illumination floor.
- Four moving, real point lights illuminate the dragon, shield and masonry. Those same positions
  drive a shared crystal shader with analytic refracted-environment bands, Fresnel highlights,
  moving caustics and facet edges. These are deliberately hybrid, stylized optics, not a claim
  of physically correct multiple refraction through thousands of solids.
- Every brick is an extruded, bevelled 3D solid. Its color and lit edge remain distinct. Two
  independently sorted instanced buffers prevent one camera's transparent order from breaking
  the other. Sorting is throttled to 120 ms unless destruction makes a refresh necessary.
- The well wall uses 520 bevelled annular masonry segments; the coping has 64 thick blocks,
  24 vertical crystal ribs and 16 inset rim gems. The near wall becomes a transparent cutaway
  relative to each camera, so the wall itself does not hide the playable field.
- The circular shield is now a faceted lens with a metallic-crystal crown rim, sapphire boss,
  radial crystal inlays and dimensional thickness. The circular collision radius is unchanged.
- Scene objects are mesh models, not SVG illustrations. SVG remains only for a few small
  functional controls and the rotate-phone prompt. The reflection environment is generated
  locally, with no external art asset or licensing dependency.

## Views, depth and controls

Main view: orthographic, 20 degrees off vertical, one slow revolution per 240 seconds.
Side view: horizontal, exactly perpendicular to the main view vector and rotating with it.
The side image is still cached at 18 Hz desktop / 14 Hz coarse pointer, with reduced resolution.
Reduced-motion preference stops the orbit. Pausing stops simulation and camera motion.

Mouse/touch control uses camera ray intersection with the actual shield plane. While the
pointer remains over the main view it is reprojected as the camera rotates. Keyboard motion
also follows screen-space directions. The ball's x-ray silhouette stays at its real 3D
position; it is no longer incorrectly flattened to the top plane.

The depth palette runs blue → cyan → mint → gold → hot orange-red as the ball approaches
the shield. Core, halo, silhouette and newly emitted motes use the same depth palette in
both views. Color encodes distance below the shield, never orbit-dependent camera distance.
The particle pool has 520 entries; color and size buffers are uploaded after emission.

## Performance display and validation

A corner readout shows measured main FPS, measured side FPS and mean frame time over
roughly one second. It uses raw RAF timestamps, not the simulation's capped delta time.
Hidden-tab and portrait intervals reset the measurement. Hover text reports draw calls and
triangles. No automatic quality reduction is enabled in this revision: measure the richer
presentation first, then choose reductions from device results.

`npm test` covers game rules plus tilt, orthogonality, orbit, depth palette and FPS accounting.
`npm run check` covers every runtime module. `tests/browser-smoke.mjs` exercises the actual
WebGL shaders, rotated pointer targeting, true-depth ball marker, gameplay, landscape and
portrait layout. The CI workflow uploads screenshots and a JSON report. CI uses SwiftShader;
its FPS is not representative of a desktop or phone GPU.

The existing Sites project link is preserved. A repository commit alone must not be
reported as a completed Sites deployment.
