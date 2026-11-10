# Crystal Well — first-playable design contract

## Player-visible contract

No developer-facing explanation text in the game, no tutorial panels. Visual hierarchy: **primary transparent orthographic top view** with the magical ball position always legible and a player-controlled circular shield; **secondary half-perspective view** shows the stacked levels, notch, the dragon at the bottom, and the depth of the projectile. HUD is only three life crystals, seal-removal ring, and small pause/audio/reset icons.

Desktop and mobile landscape only. Portrait displays a single orientation pictogram and brief prompt. Pointer/touch directly moves the shield across the X/Y disk. A dot of light at the top projection indicates the magical ball even when it is buried in crystals; a pale ring offers an approximate landing hint when it approaches the opening (not a promised collision-accurate prediction).

## Geometry / mechanics

- Circular well, radius 9.72 units; grid spans 20×20 one-unit cells in XY, eight stacked Z levels, filled to radius 9.1. There are many radial layers of bricks, not merely an outer wall.
- The face toward the player is -Y in world coordinates. A deterministic multi-height notch opens from that side, and the top lip has a connected concavity.
- Circular shield radius 1.32 at Z=10.55, moves in X/Y, reflects upward-traveling ball **down into the well**. Miss = ball leaves the well at the opening and breaks; three lives.
- Ball begins near front notch, glows, leaves a capped particle trail. Wall bounces are safe, but exiting the top without the shield is not.
- Bottom dragon forehead is a slowly moving non-planar height field with normal-based reflection. Outside its forehead, the well floor also returns a ball. No detailed mesh collider required.
- Crystals are broken by a collision and a small local fracture. Resonance periodically spreads through nearby rows. Endgame collapses a negligible last cluster, leaving **zero** crystals; then an animated dragon rises from the well.

## Render budget / quality knobs

- 1 instanced material for crystal bodies and 1 sparse accent mesh; no independent draw call per brick. Side wall lights are primarily sprite fakes; two actual moving lights provide modulation. Avoid MeshPhysicalMaterial transmission on thousands of crystals.
- Top-down view renders once per frame at capped DPR 1.35–1.65. Side view is **cached in a render target**, refreshed at 18 Hz on desktop / 14 Hz on touch, rendered at ~85% CSS panel resolution with a cap of 540×760 pixels. It is composited every frame as a single textured quad.
- Ball top silhouette is a separate camera layer to keep readability even if crystal alpha stack would obscure it; side camera excludes this layer. Visual representation can therefore diverge slightly from true optical occlusion (intentional gameplay aid).
- Pooled particles: 330; no shadow maps or SSR. All decorative lights have capped count. Crystal opacity initially .20, tunable after actual device tests.

## Future improvements, not prerequisites

- Replace the procedural head with a locally stored, verified-license GLB, perhaps including a full serpentine animation. Keep gameplay collision independent from mesh triangles.
- Image-to-voxel brick art generator, level selection, multiple seal patterns and special crystal fracture types.
- Browser benchmark / visual regression, adjustable quality presets and context-restoration QA.
